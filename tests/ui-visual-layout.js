'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');

const root=path.resolve(__dirname,'..');
const port=4183;
const baseUrl=`http://127.0.0.1:${port}`;
const outputDir=process.env.UI_SCREENSHOT_DIR||path.join(root,'artifacts','ui-v10.59.0');
fs.mkdirSync(outputDir,{recursive:true});
const executableCandidates=process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=executableCandidates.find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('자동 UI 검사에 사용할 Chrome/Chromium을 찾지 못했습니다.');

const fakeApplicants=[
  {id:'11111111-1111-4111-8111-111111111111',name:'테스트지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',education:'대졸',school:'테스트대학교',createdAt:'2026-08-01T01:00:00.000Z',updatedAt:'2026-08-01T01:00:00.000Z'},
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
      assert.equal(await page.title(),'채용관리 시스템 v10.59.0');
      const queue=page.locator('#homeTodayGrid .queue-card');assert.equal(await queue.count(),5);for(let i=0;i<5;i++)assert.notEqual(await queue.nth(i).evaluate(el=>getComputedStyle(el).display),'none');
      for(const screen of screens){
        await page.evaluate(id=>window.setPage?.(id),screen);await page.waitForTimeout(30);
        const layout=await page.evaluate(()=>({active:document.querySelector('.page.active')?.id,body:document.body.scrollWidth,html:document.documentElement.scrollWidth,width:innerWidth}));
        assert.equal(layout.active,screen,`${viewport.name} ${screen} 화면 전환 실패`);
        assert.ok(layout.body<=layout.width+1&&layout.html<=layout.width+1,`${viewport.name} ${screen} 본문 가로 넘침: ${layout.body}/${layout.html}/${layout.width}`);
      }
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
      }
      await page.evaluate(()=>window.setPage?.('home'));await queue.first().focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'today');await page.evaluate(()=>window.setPage?.('home'));await queue.nth(4).focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'today');
      if(viewport.width===390||viewport.width===1366)await page.screenshot({path:path.join(outputDir,`${viewport.name}-home.png`),fullPage:true});
      await context.close();
    }

    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await page.addInitScript(applicants=>localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(applicants)),fakeApplicants);await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
    await page.evaluate(()=>window.setPage?.('applicants'));const statusTarget=page.locator('#applicantTbody .status-inline').first(),statusTargetId=await statusTarget.evaluate(el=>el.closest('tr').dataset.applicantId),before=await page.evaluate(id=>applicants.find(item=>item.id===id).status,statusTargetId);await statusTarget.selectOption({label:'면접예정'});await page.locator('#applicantStatusModal.show').waitFor();assert.ok(await page.evaluate(()=>document.querySelector('#applicantStatusModal').contains(document.activeElement)));await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#applicantStatusModal').contains(document.activeElement)));await page.screenshot({path:path.join(outputDir,'390x844-status-modal.png'),fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.evaluate(id=>applicants.find(item=>item.id===id).status,statusTargetId),before,'상태 팝업 취소는 자료를 바꾸면 안 됩니다.');
    await statusTarget.selectOption({label:'면접예정'});await page.locator('#statusInterviewDate').fill('2026-08-03');await page.locator('#statusInterviewDate').press('Enter');await page.locator('#applicantStatusModal.show').waitFor({state:'detached'});await page.waitForFunction(id=>applicants.find(item=>item.id===id).status==='면접예정',statusTargetId);assert.equal(await page.evaluate(id=>applicants.find(item=>item.id===id).status,statusTargetId),'면접예정');
    await page.evaluate(()=>{window.erpAudit.recordEvent({entityType:'applicant',entityId:'fake',entityLabel:'테*',action:'update',fields:['phone','memo'],before:{phone:'010-9999-9999',memo:'비밀메모'},after:{phone:'010-8888-8888',memo:'변경메모'},reason:'연락처 010-7777-7777 test@example.com'});window.setPage('auditHistory');window.erpAudit.renderPage();});assert.ok(!(await page.locator('#auditHistory').innerText()).includes('010-7777-7777'));assert.ok(!(await page.locator('#auditHistory').innerText()).includes('test@example.com'));
    for(const role of ['admin','recruiter','viewer']){
      await page.evaluate(async role=>{window.sb={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{user_id:'fake-user',email:'fake@example.com',display_name:'가상 사용자',role}})})};await window.erpPermissions.load({user:{id:'fake-user',email:'fake@example.com'}});},role);
      const state=await page.evaluate(()=>({role:window.erpPermissions.current().role,formHidden:document.querySelector('[data-page="form"]')?.classList.contains('erp-permission-hidden'),backupHidden:document.querySelector('[data-page="backup"]')?.classList.contains('erp-permission-hidden'),auditHidden:document.querySelector('[data-page="auditHistory"]')?.classList.contains('erp-permission-hidden')}));assert.equal(state.role,role);if(role==='admin')assert.ok(!state.formHidden&&!state.backupHidden&&!state.auditHidden);if(role==='recruiter')assert.ok(!state.formHidden&&state.backupHidden&&state.auditHidden);if(role==='viewer')assert.ok(state.formHidden&&state.backupHidden&&state.auditHidden);
    }
    await page.evaluate(()=>{window.erpPermissions.useLocal();document.getElementById('loginOverlay').style.display='none';});await page.locator('#btnPrivacyShield').click();assert.ok(await page.locator('#privacyShieldOverlay').isVisible());await page.locator('#btnPrivacyUnlock').click();
    await page.evaluate(()=>window.erpSyncSafety.openConflicts());assert.ok(await page.locator('#syncConflictModal').isVisible());await page.screenshot({path:path.join(outputDir,'390x844-sync-conflict.png'),fullPage:true});await page.locator('#btnCloseSyncConflicts').click();await page.evaluate(()=>window.erpSyncSafety.openDeletes());assert.ok(await page.locator('#syncDeleteModal').isVisible());await page.locator('#btnCloseSyncDeletes').click();
    await page.evaluate(()=>window.openHireWaitingList?.('2026-08-08'));if(await page.locator('#hireWaitingModal.show').count())assert.ok(await page.locator('#hireWaitingModal .page-intro-card').count());
    await context.close();
    assert.deepEqual(consoleErrors,[],`브라우저 오류: ${consoleErrors.join('\n')}`);
    console.log(`ui-visual-layout.js: 5개 화면 크기·13개 화면·3개 역할·상태/보안/동기화 팝업 통과\n스크린샷: ${outputDir}`);
  }finally{await browser.close();server.kill();}
})().catch(error=>{server.kill();console.error(error);process.exitCode=1;});
