'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');

const root=path.resolve(__dirname,'..');
const port=4183;
const baseUrl=`http://127.0.0.1:${port}`;
const outputDir=process.env.UI_SCREENSHOT_DIR||path.join(root,'artifacts','ui-v10.60.0');
fs.mkdirSync(outputDir,{recursive:true});
const executableCandidates=process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=executableCandidates.find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('자동 UI 검사에 사용할 Chrome/Chromium을 찾지 못했습니다.');

const fakeApplicants=[
  {id:'11111111-1111-4111-8111-111111111111',name:'테스트지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',education:'대졸',school:'테스트대학교',memo:'기존 메모',createdAt:'2026-08-01T01:00:00.000Z',updatedAt:'2026-08-01T01:00:00.000Z'},
  {id:'22222222-2222-4222-8222-222222222222',name:'테스트지원자2',phone:'010-0000-0002',applyDate:'2026-08-02',workplace:'평택',status:'면접예정',interviewDate:'2026-08-02',interviewTime:'10:00',createdAt:'2026-08-02T01:00:00.000Z',updatedAt:'2026-08-02T01:00:00.000Z'},
  {id:'33333333-3333-4333-8333-333333333333',name:'테스트지원자3',phone:'010-0000-0003',applyDate:'2026-08-01',workplace:'천안',status:'입사예정',hireDate:'2026-08-08',dormUse:'출퇴근',createdAt:'2026-08-01T02:00:00.000Z',updatedAt:'2026-08-01T02:00:00.000Z'}
];
const viewports=[
  {name:'1920x1080',width:1920,height:1080},
  {name:'1366x768',width:1366,height:768},
  {name:'1024x768',width:1024,height:768},
  {name:'768x1024',width:768,height:1024},
  {name:'390x844',width:390,height:844}
];
const screens=['home','applicants','form','today','calendar','stats','schools','employees','backup','dataHealth','duplicates','permissions','auditHistory'];
const server=spawn(process.execPath,[path.join(__dirname,'serve-static.js')],{cwd:root,env:{...process.env,ERP_TEST_PORT:String(port)},stdio:['ignore','pipe','pipe']});
const waitForServer=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('로컬 UI 서버 시작 시간 초과')),5000);server.stdout.on('data',data=>{if(String(data).includes(baseUrl)){clearTimeout(timer);resolve();}});server.once('exit',code=>{clearTimeout(timer);reject(new Error(`로컬 UI 서버 종료: ${code}`));});});
async function submitStatusChange(page,id,status,{date='2026-08-03',memo=''}={}){
  await page.evaluate(()=>window.setPage?.('applicants'));
  const select=page.locator(`#applicantTbody tr[data-applicant-id="${id}"] .status-inline`);
  await select.selectOption({label:status});
  await page.locator('#applicantStatusModal.show').waitFor();
  if(['면접예정','다음면접'].includes(status))await page.locator('#statusInterviewDate').fill(date);
  if(status==='입사예정')await page.locator('#statusHireDate').fill(date);
  if(memo)await page.locator('#statusMemo').fill(memo);
  await page.locator('#btnSaveApplicantStatus').click();
  await page.locator('#applicantStatusModal.show').waitFor({state:'detached'});
}
async function openEncryptedRestoreFixture(page){
  await page.evaluate(async()=>window.erpEncryptedBackupUI.inspectFile(new File([window.__fakeEncryptedBackup],'fake_v10.60.0.erpbackup',{type:'application/json'})));
  await page.locator('#encryptedBackupPassword').fill('가상 복원 전용 긴 비밀번호 2026');await page.locator('#encryptedBackupSubmit').click();await page.locator('#bcInspection.visible').waitFor();await page.locator('#encryptedBackupDialog').waitFor({state:'hidden'});
}

(async()=>{
  await waitForServer();
  const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
  const consoleErrors=[];
  try{
    for(const viewport of viewports){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
      const page=await context.newPage();
      page.on('pageerror',error=>consoleErrors.push(`${viewport.name}: ${error.message}`));
      page.on('console',message=>{if(message.type()==='error'&&!/favicon/i.test(message.text()))consoleErrors.push(`${viewport.name}: ${message.text()}`);});
      await page.addInitScript(applicants=>{
        localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(applicants));
        localStorage.setItem('recruit_erp_ui_operation_environment','company');
      },fakeApplicants);
      await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForTimeout(800);
      assert.equal(await page.title(),'채용관리 시스템 v10.60.0');
      const queue=page.locator('#homeTodayGrid .queue-card');assert.equal(await queue.count(),5);for(let i=0;i<5;i++)assert.notEqual(await queue.nth(i).evaluate(el=>getComputedStyle(el).display),'none');
      for(const screen of screens){
        await page.evaluate(id=>window.setPage?.(id),screen);await page.waitForTimeout(30);
        const layout=await page.evaluate(()=>({active:document.querySelector('.page.active')?.id,body:document.body.scrollWidth,html:document.documentElement.scrollWidth,width:innerWidth}));
        assert.equal(layout.active,screen,`${viewport.name} ${screen} 화면 전환 실패`);
        assert.ok(layout.body<=layout.width+1&&layout.html<=layout.width+1,`${viewport.name} ${screen} 본문 가로 넘침: ${layout.body}/${layout.html}/${layout.width}`);
      }
      if(viewport.width===390||viewport.width===1366){
        await page.evaluate(()=>window.setPage?.('backup'));await page.waitForTimeout(80);
        assert.ok(await page.locator('#bcEncryptedPanel').isVisible(),'암호화 백업이 기본 화면에 보여야 합니다.');
        assert.equal(await page.locator('.legacy-backup-details').getAttribute('open'),null,'평문 JSON은 기본적으로 접혀 있어야 합니다.');
        await page.locator('#bcEncryptedFull').focus();await page.locator('#bcEncryptedFull').click();await page.locator('#encryptedBackupDialog:not([hidden])').waitFor();
        const modalLayout=await page.locator('.encrypted-backup-dialog').evaluate(dialog=>{const r=dialog.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,active:document.activeElement?.id};});
        assert.ok(modalLayout.left>=0&&modalLayout.right<=modalLayout.width&&modalLayout.top>=0&&modalLayout.bottom<=modalLayout.height,`${viewport.name} 암호화 비밀번호 팝업 잘림: ${JSON.stringify(modalLayout)}`);
        assert.equal(modalLayout.active,'encryptedBackupPassword');await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>document.querySelector('#encryptedBackupDialog').contains(document.activeElement)),'Tab 포커스가 암호화 팝업 안에 있어야 합니다.');
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-encrypted-backup-modal.png`),fullPage:false});await page.keyboard.press('Escape');await page.locator('#encryptedBackupDialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.activeElement?.id),'bcEncryptedFull','팝업을 닫으면 원래 버튼으로 포커스가 돌아가야 합니다.');
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-encrypted-backup-center.png`),fullPage:true});
      }
      const introState=await page.evaluate(()=>({
        home:getComputedStyle(document.querySelector('#home .home-dashboard-intro')).display,
        stats:getComputedStyle(document.querySelector('#stats .stats-intro')).display,
        required:['#dataHealth .health-hero','#duplicates .duplicate-hero','#backup .backup-center-hero','#permissions .page-intro-card','#auditHistory .page-intro-card'].map(selector=>({selector,safety:document.querySelector(selector)?.classList.contains('safety-intro-card'),display:getComputedStyle(document.querySelector(selector)).display}))
      }));
      assert.equal(introState.home,'none','홈은 중복 인트로 카드를 숨겨 세로 공간을 줄여야 합니다.');
      assert.equal(introState.stats,'none','통계는 중복 인트로 카드를 숨겨 세로 공간을 줄여야 합니다.');
      assert.ok(introState.required.every(item=>item.safety&&item.display!=='none'),`안전 화면 안내 카드 누락: ${JSON.stringify(introState.required)}`);
      await page.evaluate(()=>window.setPage?.('applicants'));await page.waitForTimeout(30);
      if(viewport.width>760){
        const columns=await page.locator('#applicants .no-head,#applicants .name-head,#applicants .workplace-head,#applicants .status-head').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,position:getComputedStyle(el).position}}));
        assert.equal(columns.length,4);assert.ok(columns.every(column=>column.position==='sticky'));for(let i=1;i<columns.length;i++)assert.ok(columns[i].left>=columns[i-1].right-1,`${viewport.name} 지원자 고정 열 겹침: ${JSON.stringify(columns)}`);
        if(viewport.width<=1024){const tableScroll=await page.locator('#applicants .table-wrap').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).overflowX}));assert.ok(tableScroll.scroll>tableScroll.client&&tableScroll.overflow!=='visible','1024 목록은 표 내부에서 가로 스크롤되어야 합니다.');}
      }else{
        assert.notEqual(await page.locator('#applicants .applicant-row').first().evaluate(el=>getComputedStyle(el).display),'table-row','760 이하 지원자 목록은 카드형이어야 합니다.');
      }
      if(viewport.width===390){
        await page.evaluate(()=>window.setPage?.('home'));await page.locator('#sidebarToggle').click();assert.ok(await page.evaluate(()=>document.body.classList.contains('sidebar-mobile-open')));await page.locator('[data-page="today"]').click();assert.ok(!await page.evaluate(()=>document.body.classList.contains('sidebar-mobile-open')),'모바일 메뉴가 화면 이동 뒤 닫혀야 합니다.');
        await page.evaluate(()=>window.setPage?.('permissions'));const permissionWidth=await page.locator('#permissions').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,widest:[...el.querySelectorAll('*')].map(node=>({name:node.className||node.tagName,scroll:node.scrollWidth,client:node.clientWidth})).sort((a,b)=>b.scroll-a.scroll).slice(0,4)}));assert.ok(permissionWidth.scroll<=permissionWidth.client+1,`390 권한 화면 넘침: ${JSON.stringify(permissionWidth)}`);
        await page.evaluate(()=>window.setPage?.('form'));await page.waitForTimeout(50);
        assert.equal(await page.locator('[data-form-step="2"] [data-form-step-status]').innerText(),'선택 입력');
        const formActions=await page.locator('.form-top-actions').evaluate(el=>{const banner=document.querySelector('#formWorkflowBanner').getBoundingClientRect(),submit=document.querySelector('#submitBtn').getBoundingClientRect();const overlaps=!(submit.right<=banner.left||submit.left>=banner.right||submit.bottom<=banner.top||submit.top>=banner.bottom);return {submitVisible:getComputedStyle(document.querySelector('#submitBtn')).display!=='none',buttons:[...el.querySelectorAll('button')].filter(button=>getComputedStyle(button).display!=='none').map(button=>{const rect=button.getBoundingClientRect();return {id:button.id,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};}),banner:{left:banner.left,right:banner.right,top:banner.top,bottom:banner.bottom},submit:{left:submit.left,right:submit.right,top:submit.top,bottom:submit.bottom},overlaps,width:innerWidth,height:innerHeight};});
        assert.ok(formActions.submitVisible&&formActions.buttons.length>0,'390 지원자 등록 저장 버튼이 보여야 합니다.');
        assert.ok(formActions.buttons.every(button=>button.left>=-1&&button.right<=formActions.width+1&&button.top>=-1&&button.bottom<=formActions.height+1),`390 지원자 등록 상단 버튼 잘림: ${JSON.stringify(formActions)}`);
        assert.equal(formActions.overlaps,false,`390 파란 등록 버튼과 formWorkflowBanner가 겹치면 안 됩니다: ${JSON.stringify(formActions)}`);
        assert.ok(formActions.submit.bottom<=formActions.banner.top,`390 등록 버튼은 formWorkflowBanner 위에서 끝나야 합니다: ${JSON.stringify(formActions)}`);
        await page.screenshot({path:path.join(outputDir,'390x844-form.png'),fullPage:true});
      }
      await page.evaluate(()=>window.setPage?.('home'));await queue.first().focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'today');await page.evaluate(()=>window.setPage?.('home'));await queue.nth(4).focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'today');
      if(viewport.width===390||viewport.width===1366)await page.screenshot({path:path.join(outputDir,`${viewport.name}-home.png`),fullPage:true});
      await context.close();
    }

    const zoomContext=await browser.newContext({viewport:{width:1093,height:614},deviceScaleFactor:1.25}),zoomPage=await zoomContext.newPage();
    zoomPage.on('pageerror',error=>consoleErrors.push(`1366x768-zoom125: ${error.message}`));
    zoomPage.on('console',message=>{if(message.type()==='error'&&!/favicon/i.test(message.text()))consoleErrors.push(`1366x768-zoom125: ${message.text()}`);});
    await zoomPage.addInitScript(applicants=>{localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(applicants));localStorage.setItem('recruit_erp_ui_operation_environment','company');},fakeApplicants);
    await zoomPage.goto(baseUrl,{waitUntil:'domcontentloaded'});await zoomPage.waitForTimeout(700);
    for(const screen of ['home','applicants','form']){
      await zoomPage.evaluate(id=>window.setPage?.(id),screen);await zoomPage.waitForTimeout(50);
      const layout=await zoomPage.evaluate(()=>({screen:document.querySelector('.page.active')?.id,width:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth}));
      assert.equal(layout.width,1093,'1366×768의 125% 확대는 약 1093px 유효 폭으로 검사합니다.');
      assert.ok(layout.body<=layout.width+1&&layout.html<=layout.width+1,`1366×768 125% ${screen} 본문 가로 넘침: ${JSON.stringify(layout)}`);
    }
    const zoomFormBounds=await zoomPage.locator('#form').evaluate(form=>({width:innerWidth,labels:[...form.querySelectorAll('.resume-input-grid>label')].map(label=>{const rect=label.getBoundingClientRect();return {text:label.innerText.slice(0,18),left:rect.left,right:rect.right};}),controls:[...form.querySelectorAll('.resume-input-grid input,.resume-input-grid select,.resume-input-grid textarea')].map(control=>{const rect=control.getBoundingClientRect();return {id:control.id,left:rect.left,right:rect.right};}),buttons:[...document.querySelectorAll('.form-top-actions button')].filter(button=>getComputedStyle(button).display!=='none').map(button=>{const rect=button.getBoundingClientRect();return {id:button.id,left:rect.left,right:rect.right};})}));
    assert.ok(zoomFormBounds.labels.every(label=>label.left>=-1&&label.right<=zoomFormBounds.width+1),`1366×768 125% 등록 입력칸 잘림: ${JSON.stringify(zoomFormBounds)}`);
    assert.ok(zoomFormBounds.controls.every(control=>control.left>=-1&&control.right<=zoomFormBounds.width+1),`1366×768 125% 등록 컨트롤 잘림: ${JSON.stringify(zoomFormBounds)}`);
    assert.ok(zoomFormBounds.buttons.every(button=>button.left>=-1&&button.right<=zoomFormBounds.width+1),`1366×768 125% 상단 버튼 잘림: ${JSON.stringify(zoomFormBounds)}`);
    await zoomPage.screenshot({path:path.join(outputDir,'1366x768-zoom125-form.png'),fullPage:true});
    await zoomContext.close();

    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await page.addInitScript(applicants=>localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(applicants)),fakeApplicants);await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
    await page.evaluate(()=>window.setPage?.('form'));
    assert.equal(await page.locator('[data-form-step="2"] [data-form-step-status]').innerText(),'선택 입력');
    assert.equal(await page.locator('#formProgressText').innerText(),'필수 0/1 단계 완료');
    await page.locator('#name').fill('가상지원자');await page.locator('#phone').fill('010-0000-0099');await page.locator('#applyDate').fill('2026-08-02');await page.locator('#workplace').selectOption('천안');
    assert.equal(await page.locator('#formProgressText').innerText(),'필수 1/1 단계 완료');assert.equal(await page.locator('#formProgressBar').getAttribute('style'),'width: 100%;');
    await page.locator('#status').selectOption('면접예정');assert.equal(await page.locator('[data-form-step="3"] [data-form-step-status]').innerText(),'확인 필요');assert.equal(await page.locator('#formProgressText').innerText(),'필수 1/2 단계 완료');
    await page.locator('#interviewDate').fill('2026-08-03');assert.equal(await page.locator('#formProgressText').innerText(),'필수 2/2 단계 완료');await page.evaluate(()=>window.resetForm?.());

    const existingId='11111111-1111-4111-8111-111111111111',emptyMemoId='22222222-2222-4222-8222-222222222222',newMemoId='33333333-3333-4333-8333-333333333333';
    await page.evaluate(()=>window.setPage?.('applicants'));const statusTarget=page.locator(`#applicantTbody tr[data-applicant-id="${existingId}"] .status-inline`),before=await page.evaluate(id=>applicants.find(item=>item.id===id).status,existingId);await statusTarget.selectOption({label:'면접예정'});await page.locator('#applicantStatusModal.show').waitFor();assert.ok(await page.evaluate(()=>document.querySelector('#applicantStatusModal').contains(document.activeElement)));assert.ok((await page.locator('#applicantStatusModal').innerText()).includes('메모 추가'));await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#applicantStatusModal').contains(document.activeElement)));await page.screenshot({path:path.join(outputDir,'390x844-status-modal.png'),fullPage:false});await page.keyboard.press('Escape');assert.equal(await page.evaluate(id=>applicants.find(item=>item.id===id).status,existingId),before,'상태 팝업 취소는 자료를 바꾸면 안 됩니다.');
    const memoCases=await page.evaluate(()=>({existingNoNew:window.erpAppendStatusMemo('기존 메모','','면접예정','2026-08-02'),emptyNoNew:window.erpAppendStatusMemo('','','면접예정','2026-08-02'),existingNew:window.erpAppendStatusMemo('기존 메모','추가 메모','면접예정','2026-08-02'),emptyNew:window.erpAppendStatusMemo('','추가 메모','면접예정','2026-08-02')}));
    assert.deepEqual(memoCases,{existingNoNew:'기존 메모',emptyNoNew:'',existingNew:'기존 메모\n\n[2026-08-02 · 상태 변경: 면접예정]\n추가 메모',emptyNew:'[2026-08-02 · 상태 변경: 면접예정]\n추가 메모'});
    await submitStatusChange(page,existingId,'면접예정');assert.equal(await page.evaluate(id=>applicants.find(item=>item.id===id).memo,existingId),'기존 메모','기존 메모 + 새 메모 없음은 그대로 유지되어야 합니다.');
    await submitStatusChange(page,existingId,'다음면접',{memo:'추가 메모'});const appendedMemo=await page.evaluate(id=>applicants.find(item=>item.id===id).memo,existingId);assert.ok(appendedMemo.startsWith('기존 메모\n\n[')&&appendedMemo.includes('상태 변경: 다음면접')&&appendedMemo.endsWith('\n추가 메모'),'기존 메모 뒤에 날짜·변경 상태·새 메모가 추가되어야 합니다.');
    await submitStatusChange(page,emptyMemoId,'다음면접');assert.equal(await page.evaluate(id=>applicants.find(item=>item.id===id).memo||'',emptyMemoId),'','기존 메모 없음 + 새 메모 없음은 빈 상태를 유지해야 합니다.');
    await submitStatusChange(page,newMemoId,'면접예정',{memo:'첫 추가 메모'});const firstMemo=await page.evaluate(id=>applicants.find(item=>item.id===id).memo,newMemoId);assert.ok(firstMemo.startsWith('[')&&firstMemo.includes('상태 변경: 면접예정')&&firstMemo.endsWith('\n첫 추가 메모'),'기존 메모가 없으면 새 이력 메모만 추가되어야 합니다.');
    const rollbackBefore=await page.evaluate(id=>{const a=applicants.find(item=>item.id===id);return {status:a.status,memo:a.memo};},existingId);await page.evaluate(()=>{window.__uiOriginalSave=window.save;window.save=()=>false;});await submitStatusChange(page,existingId,'입사예정',{memo:'저장되면 안 되는 메모'});await page.evaluate(()=>{window.save=window.__uiOriginalSave;delete window.__uiOriginalSave;});const rollbackAfter=await page.evaluate(id=>{const a=applicants.find(item=>item.id===id);return {status:a.status,memo:a.memo};},existingId);assert.deepEqual(rollbackAfter,rollbackBefore,'저장 실패 시 상태와 메모가 모두 원상복구되어야 합니다.');
    await page.evaluate(()=>{window.erpAudit.recordEvent({entityType:'applicant',entityId:'fake',entityLabel:'테*',action:'update',fields:['phone','memo'],before:{phone:'010-9999-9999',memo:'비밀메모'},after:{phone:'010-8888-8888',memo:'변경메모'},reason:'연락처 010-7777-7777 test@example.com'});window.setPage('auditHistory');window.erpAudit.renderPage();});assert.ok(!(await page.locator('#auditHistory').innerText()).includes('010-7777-7777'));assert.ok(!(await page.locator('#auditHistory').innerText()).includes('test@example.com'));
    for(const role of ['admin','recruiter','viewer']){
      await page.evaluate(async role=>{window.sb={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{user_id:'fake-user',email:'fake@example.com',display_name:'가상 사용자',role}})})};await window.erpPermissions.load({user:{id:'fake-user',email:'fake@example.com'}});},role);
      const state=await page.evaluate(()=>({role:window.erpPermissions.current().role,formHidden:document.querySelector('[data-page="form"]')?.classList.contains('erp-permission-hidden'),backupHidden:document.querySelector('[data-page="backup"]')?.classList.contains('erp-permission-hidden'),auditHidden:document.querySelector('[data-page="auditHistory"]')?.classList.contains('erp-permission-hidden')}));assert.equal(state.role,role);if(role==='admin')assert.ok(!state.formHidden&&!state.backupHidden&&!state.auditHidden);if(role==='recruiter')assert.ok(!state.formHidden&&state.backupHidden&&state.auditHidden);if(role==='viewer')assert.ok(state.formHidden&&state.backupHidden&&state.auditHidden);
    }
    await page.evaluate(()=>{window.erpPermissions.useLocal();document.getElementById('loginOverlay').style.display='none';});await page.locator('#btnPrivacyShield').click();assert.ok(await page.locator('#privacyShieldOverlay').isVisible());await page.locator('#btnPrivacyUnlock').click();
    await page.evaluate(()=>{localStorage.setItem('recruit_erp_ui_operation_environment','home');window.setPage('backup');});await page.locator('#bcEncryptedFull').click();await page.locator('#encryptedBackupPassword').fill('가상 내보내기 긴 비밀번호 2026');await page.locator('#encryptedBackupConfirm').fill('가상 내보내기 긴 비밀번호 2026');const [encryptedDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#encryptedBackupSubmit').click()]);assert.match(encryptedDownload.suggestedFilename(),/\.erpbackup$/);const downloadedEnvelope=JSON.parse(fs.readFileSync(await encryptedDownload.path(),'utf8'));assert.equal(downloadedEnvelope.format,'recruit-erp-encrypted-backup');assert.ok(!JSON.stringify(downloadedEnvelope).includes('테스트지원자1'),'암호화 다운로드 파일에 가상 이름도 평문으로 노출되면 안 됩니다.');const downloadedPackage=await page.evaluate(async({envelope,password})=>window.erpEncryptedBackup.decryptEnvelope(envelope,password),{envelope:downloadedEnvelope,password:'가상 내보내기 긴 비밀번호 2026'});assert.equal(downloadedPackage.format,'recruit-erp-backup');assert.equal(downloadedPackage.schemaVersion,2);assert.equal(downloadedPackage.data.applicants.length,3);assert.ok(!await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('가상 내보내기 긴 비밀번호 2026')),'비밀번호는 브라우저 저장소에 남으면 안 됩니다.');await page.locator('#encryptedBackupDialog').waitFor({state:'hidden'});
    await page.evaluate(async()=>{
      const original=applicants;applicants=[...original,{id:'44444444-4444-4444-8444-444444444444',name:'가상복원지원자',phone:'010-0000-0044',applyDate:'2026-08-02',workplace:'천안',status:'서류검토',createdAt:'2026-08-02T03:00:00.000Z',updatedAt:'2026-08-02T03:00:00.000Z'}];const pack=window.erpBackupCenter.__test.packageFor(['applicants','schools','employees','calendarEvents','hireWaitingProfiles','messageTemplates'],'가상 UI 복원 시험');applicants=original;
      const envelope=await window.erpEncryptedBackup.encryptObject(pack,'가상 복원 전용 긴 비밀번호 2026',{iterations:100000});window.__fakeEncryptedBackup=JSON.stringify(envelope);
      await window.erpEncryptedBackupUI.inspectFile(new File([window.__fakeEncryptedBackup],'fake_v10.60.0.erpbackup',{type:'application/json'}));
    });
    const restoreBaseline=await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable'));await page.locator('#encryptedBackupDialog:not([hidden])').waitFor();await page.locator('#encryptedBackupPassword').fill('틀린 가상 비밀번호 12345');await page.locator('#encryptedBackupSubmit').click();await page.locator('#encryptedBackupHelp.error').waitFor();assert.equal(await page.locator('#encryptedBackupHelp').innerText(),'비밀번호가 맞지 않거나 파일이 손상되었습니다.');assert.equal(await page.locator('#encryptedBackupPassword').inputValue(),'','실패 후 비밀번호 입력값을 지워야 합니다.');assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'비밀번호 오류는 ERP 데이터를 바꾸면 안 됩니다.');await page.screenshot({path:path.join(outputDir,'390x844-encrypted-wrong-password.png'),fullPage:false});await page.keyboard.press('Escape');
    await openEncryptedRestoreFixture(page);assert.ok((await page.locator('#bcInspection').innerText()).includes('ERP 전체 백업 JSON'));assert.ok((await page.locator('#bcInspection').innerText()).includes('지원자'));await page.screenshot({path:path.join(outputDir,'390x844-encrypted-restore-preview.png'),fullPage:true});await page.locator('#bcClearInspection').click();assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'복원 미리보기 취소는 ERP 데이터를 바꾸면 안 됩니다.');
    await openEncryptedRestoreFixture(page);await page.evaluate(()=>{window.__realEncryptedExport=window.erpEncryptedBackup.encryptObject;window.erpEncryptedBackup.encryptObject=async()=>{throw new Error('가상 안전 백업 실패');};});const safetyDialogs=[];const safetyDialogHandler=dialog=>{safetyDialogs.push(dialog.type());return dialog.accept();};page.on('dialog',safetyDialogHandler);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});page.off('dialog',safetyDialogHandler);await page.evaluate(()=>{window.erpEncryptedBackup.encryptObject=window.__realEncryptedExport;delete window.__realEncryptedExport;});assert.ok(safetyDialogs.includes('confirm')&&safetyDialogs.includes('alert'),'안전 백업 실패 시 확인과 중단 안내가 필요합니다.');assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'안전 백업 생성 실패 시 실제 적용을 차단해야 합니다.');
    await openEncryptedRestoreFixture(page);await page.evaluate(()=>{window.__realStorageSetItem=Storage.prototype.setItem;window.__failApplicantWrite=true;Storage.prototype.setItem=function(key,value){if(window.__failApplicantWrite&&key==='recruit_erp_applicants_stable'){window.__failApplicantWrite=false;throw new Error('가상 저장 실패');}return window.__realStorageSetItem.call(this,key,value);};});const rollbackDialogs=[];const rollbackDialogHandler=dialog=>{rollbackDialogs.push(dialog.type());return dialog.accept();};page.on('dialog',rollbackDialogHandler);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});page.off('dialog',rollbackDialogHandler);await page.evaluate(()=>{Storage.prototype.setItem=window.__realStorageSetItem;delete window.__realStorageSetItem;delete window.__failApplicantWrite;});assert.ok(rollbackDialogs.filter(type=>type==='confirm').length>=2&&rollbackDialogs.includes('alert'),'저장 실패 전 안전 백업 확인과 원상복구 안내가 필요합니다.');assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'적용 저장 실패 시 localStorage를 원상복구해야 합니다.');assert.equal(await page.evaluate(()=>applicants.length),3,'적용 저장 실패 시 메모리 데이터도 원상복구해야 합니다.');
    const mergeDialogHandler=dialog=>dialog.accept();page.on('dialog',mergeDialogHandler);await openEncryptedRestoreFixture(page);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>applicants.length),4,'첫 병합은 가상 지원자 1건을 추가해야 합니다.');await openEncryptedRestoreFixture(page);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});page.off('dialog',mergeDialogHandler);assert.equal(await page.evaluate(()=>applicants.length),4,'같은 암호화 파일을 다시 병합해도 중복이 늘면 안 됩니다.');
    await page.evaluate(()=>window.erpSyncSafety.openConflicts());assert.ok(await page.locator('#syncConflictModal').isVisible());assert.ok(await page.locator('#syncConflictModal .safety-intro-card').count());await page.screenshot({path:path.join(outputDir,'390x844-sync-conflict.png'),fullPage:false});await page.locator('#btnCloseSyncConflicts').click();await page.evaluate(()=>window.erpSyncSafety.openDeletes());assert.ok(await page.locator('#syncDeleteModal').isVisible());assert.ok(await page.locator('#syncDeleteModal .safety-intro-card').count());await page.locator('#btnCloseSyncDeletes').click();
    assert.ok(await page.locator('#employeeOrgImportModal .employee-org-import-notice.safety-intro-card').count(),'조직정보 Import 안전 안내가 명시적으로 표시되어야 합니다.');
    await page.evaluate(()=>window.openHireWaitingList?.('2026-08-08'));if(await page.locator('#hireWaitingModal.show').count())assert.ok(await page.locator('#hireWaitingModal .safety-intro-card').count());
    await context.close();
    assert.deepEqual(consoleErrors,[],`브라우저 오류: ${consoleErrors.join('\n')}`);
    console.log(`ui-visual-layout.js: 6개 화면 조건(5개 뷰포트+125% 확대)·13개 화면·3개 역할·암호화/상태/보안/동기화 팝업 통과\n스크린샷: ${outputDir}`);
  }finally{await browser.close();server.kill();}
})().catch(error=>{server.kill();console.error(error);process.exitCode=1;});
