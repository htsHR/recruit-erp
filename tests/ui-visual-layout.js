'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');

const root=path.resolve(__dirname,'..');
const port=4183;
const baseUrl=`http://127.0.0.1:${port}`;
const outputDir=process.env.UI_SCREENSHOT_DIR||path.join(root,'artifacts','ui-v12.5.2');
fs.mkdirSync(outputDir,{recursive:true});
const executableCandidates=process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=executableCandidates.find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('자동 UI 검사에 사용할 Chrome/Chromium을 찾지 못했습니다.');

const fakeApplicants=[
  {id:'11111111-1111-4111-8111-111111111111',name:'가상지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',school:'가상대학교',createdAt:'2026-08-01T01:00:00.000Z'},
  {id:'22222222-2222-4222-8222-222222222222',name:'가상지원자2',phone:'010-0000-0002',applyDate:'2026-08-02',workplace:'평택',status:'면접예정',interviewDate:'2099-08-02',interviewTime:'10:00',createdAt:'2026-08-02T01:00:00.000Z'},
  {id:'33333333-3333-4333-8333-333333333333',name:'가상지원자3',phone:'010-0000-0003',applyDate:'2026-08-03',workplace:'천안',status:'입사예정',hireDate:'2099-08-06',createdAt:'2026-08-03T01:00:00.000Z'},
  ...Array.from({length:6},(_,index)=>({
    id:`synthetic-roster-browser-${index+1}`,name:`가상면접자${index+1}`,phone:`010-0000-10${String(index+1).padStart(2,'0')}`,applyDate:'2099-09-01',workplace:index%2?'평택':'천안',gender:index%2?'여자':'남자',birthYear:'2000-01-01',age:'26',status:'면접예정',interviewDate:'2099-09-03',interviewTime:`${String(9+Math.floor(index/2)).padStart(2,'0')}:${index%2?'30':'00'}`,createdAt:`2099-09-01T00:00:0${index}.000Z`
  }))
];
const server=spawn(process.execPath,[path.join(__dirname,'serve-static.js')],{cwd:root,env:{...process.env,ERP_TEST_PORT:String(port)},stdio:['ignore','pipe','pipe']});
const waitForServer=()=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('로컬 UI 서버 시작 시간 초과')),5000);
  server.stdout.on('data',data=>{if(String(data).includes(baseUrl)){clearTimeout(timer);resolve();}});
  server.once('exit',code=>{clearTimeout(timer);reject(new Error(`로컬 UI 서버 종료: ${code}`));});
});

(async()=>{
  let browser;
  try{
    await waitForServer();
    browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
    for(const viewport of [{name:'desktop',width:1366,height:768},{name:'mobile',width:390,height:844}]){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
      const page=await context.newPage();
      await page.addInitScript(()=>{
        Object.defineProperty(window,'print',{configurable:true,writable:true,value:()=>{window.__rosterPrintCalls=(window.__rosterPrintCalls||0)+1;}});
        window.__rosterPrintCalls=0;window.__rosterPrintStubInstalled=true;window.__rosterPrintLifecycle=[];
        window.addEventListener('beforeprint',()=>window.__rosterPrintLifecycle.push({event:'beforeprint',active:document.body?.classList.contains('roster-printing')}),true);
        window.addEventListener('afterprint',()=>window.__rosterPrintLifecycle.push({event:'afterprint',active:document.body?.classList.contains('roster-printing')}),true);
      });
      const errors=[];
      let rosterPrivacyConfirm='';
      page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
      page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});
      page.on('dialog',dialog=>{
        if(/지원자 명단 인쇄/.test(dialog.message())){rosterPrivacyConfirm=dialog.message();return dialog.accept();}
        return dialog.dismiss();
      });
      await page.goto(baseUrl,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.body?.classList.contains('ux12-ready'));
      await page.evaluate(rows=>{
        localStorage.setItem('recruit_erp_data_epoch','v12.0.2-reset-1');
        localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(rows));
        localStorage.setItem('recruit_erp_schools',JSON.stringify([{id:'legacy-school',name:'보존학교'}]));
        localStorage.setItem('recruit_erp_employees',JSON.stringify([{id:'legacy-employee',name:'보존사원'}]));
      },fakeApplicants);
      await page.reload({waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.body?.classList.contains('ux12-ready'));
      assert.deepEqual(await page.evaluate(()=>({stored:JSON.parse(localStorage.getItem('recruit_erp_applicants_stable')||'[]').length,loaded:applicants.length})),{stored:fakeApplicants.length,loaded:fakeApplicants.length},`${viewport.name}: 기존 지원자 데이터 복원`);
      assert.equal(await page.evaluate(()=>document.body.innerText.trim().length>0),true,`${viewport.name}: 빈 화면`);
      assert.equal(await page.locator('.nav-btn').count(),4,`${viewport.name}: 메뉴는 4개여야 합니다.`);
      assert.deepEqual(await page.locator('section.page').evaluateAll(nodes=>nodes.map(node=>node.id)),['home','applicants','form','today','calendar','backup']);
      assert.equal(await page.locator('#stats,#schools,#employees,#templates,#advancedSearch,#dataHealth,#duplicates,#permissions,#auditHistory,#onboarding,#storagePerformance,#productionReadiness').count(),0);
      for(const target of ['home','applicants','calendar','backup']){
        if(viewport.width<=1020){
          await page.locator('#sidebarToggle').click();
          await page.waitForFunction(()=>document.body.classList.contains('sidebar-mobile-open'));
        }
        await page.locator(`.nav-btn[data-page="${target}"]`).click();
        await page.waitForFunction(id=>document.querySelector('.page.active')?.id===id,target);
        if(viewport.width<=1020){
          assert.equal(await page.evaluate(()=>document.body.classList.contains('sidebar-mobile-open')),false,`${viewport.name}: 메뉴 선택 뒤 사이드바 닫기`);
          await page.waitForFunction(()=>document.querySelector('.sidebar')?.getBoundingClientRect().right<=1);
        }
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-${target}.png`),fullPage:true});
      }
      await page.evaluate(()=>window.setPage('form'));
      assert.equal(await page.locator('.page.active').getAttribute('id'),'form');
      await page.evaluate(()=>window.setPage('today'));
      assert.equal(await page.locator('.page.active').getAttribute('id'),'today');
      await page.evaluate(()=>window.setPage('applicants'));
      assert.equal(await page.locator('#applicantTbody tr.applicant-row').count(),fakeApplicants.length);
      await page.locator('#btnListExcelRowPaste').click();
      await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='form'&&document.querySelector('#excelRowPasteModal')?.classList.contains('show'));
      assert.equal(await page.locator('#excelPasteRaw').isVisible(),true,`${viewport.name}: 엑셀 붙여넣기 창 표시`);
      const pasteRows=[
        ['NO','지원날짜','연락상태','면접날짜','시간','입사날짜','지원경로','지원구분','성별','지원파트','성명','이메일','학력구분','학교','학과','연락처','나이','생년월일','지역','경력','자격증','비고'],
        ['1','2026-09-01','서류검토','','','','사람인','신입','남','천안','가상붙여넣기1','paste1@example.com','대졸','가상대학교','반도체과','010-1234-5001','26','2000-01-01','천안','','','출퇴근'],
        ['2','2026-09-01','서류검토','','','','잡코리아','경력','여','평택','가상붙여넣기2','paste2@example.com','전졸','가상전문대','전자과','010-1234-5002','27','1999-01-01','평택','가상회사 PM','','기숙사']
      ].map(row=>row.join('\t')).join('\n');
      await page.locator('#excelPasteRaw').fill(pasteRows);
      await page.locator('#btnParseExcelRow').click();
      assert.equal(await page.locator('#excelPasteBatch').isVisible(),true,`${viewport.name}: 여러 행 검토 화면 표시`);
      assert.match(await page.locator('#excelBatchCounts').innerText(),/신규\s*2/,`${viewport.name}: 여러 행 신규 분류`);
      await page.locator('#btnCloseExcelRowPaste').click();
      if(viewport.name==='desktop'){
        const rosterDate='2099-09-03';
        await page.evaluate(date=>{
          window.__rosterPrintCalls=0;
          window.setPage('today');
          document.querySelector('#rosterDate').value=date;
        },rosterDate);
        assert.equal(await page.evaluate(()=>window.__rosterPrintStubInstalled),true,'desktop: 브라우저 print 대체가 페이지 로드 전에 준비되어야 합니다.');
        assert.equal(await page.evaluate(date=>rosterApplicantsOn(date).length,rosterDate),6,'desktop: 인쇄 대상 합성 지원자는 6명이어야 합니다.');
        await page.locator('#btnRosterPrint').click();
        assert.match(rosterPrivacyConfirm,/지원자 명단 인쇄/,'desktop: 개인정보 인쇄 확인을 거쳐야 합니다.');
        const rosterClickState=await page.evaluate(()=>({calls:window.__rosterPrintCalls,date:document.querySelector('#rosterDate')?.value||'',eligible:rosterApplicantsOn(document.querySelector('#rosterDate')?.value||'').length,active:window.erpRosterOrderEditor.__test.printState.active,pages:document.querySelectorAll('#rosterPrintArea .roster-page').length,buttonDisabled:document.querySelector('#btnRosterPrint')?.disabled===true}));
        console.log('desktop roster print click state:',JSON.stringify(rosterClickState));
        assert.equal(rosterClickState.calls,1,`desktop: 명단표 버튼은 print를 한 번 호출해야 합니다. ${JSON.stringify(rosterClickState)}`);
        await page.evaluate(()=>{const state=window.erpRosterOrderEditor.__test.printState;if(state.cleanupTimer){clearTimeout(state.cleanupTimer);state.cleanupTimer=0;}});
        assert.equal(await page.locator('#rosterPrintArea .roster-page').count(),2,'desktop: 6명은 2페이지여야 합니다.');
        assert.deepEqual(await page.locator('#rosterPrintArea').evaluate(node=>{const style=getComputedStyle(node);return{display:style.display,position:style.position,visibility:style.visibility};}),{display:'block',position:'fixed',visibility:'hidden'},'desktop: 인쇄 전에 화면 밖에서 레이아웃을 계산해야 합니다.');
        assert.equal(await page.evaluate(()=>openRosterPrint()),false,'desktop: 인쇄 중 중복 요청은 거부해야 합니다.');
        assert.equal(await page.evaluate(()=>window.__rosterPrintCalls),1,'desktop: 중복 요청으로 print가 추가 호출되면 안 됩니다.');
        await page.emulateMedia({media:'print'});
        assert.deepEqual(await page.locator('#rosterPrintArea').evaluate(node=>{const style=getComputedStyle(node);return{display:style.display,position:style.position,visibility:style.visibility};}),{display:'block',position:'static',visibility:'visible'},'desktop: 인쇄 미디어에서는 평가표를 표시해야 합니다.');
        assert.equal(await page.locator('.app-shell').evaluate(node=>getComputedStyle(node).display),'none','desktop: 인쇄에는 앱 화면이 섞이면 안 됩니다.');
        const rosterPrePdfState=await page.evaluate(()=>{const area=document.querySelector('#rosterPrintArea'),first=area?.querySelector('.roster-page'),areaStyle=getComputedStyle(area),firstStyle=getComputedStyle(first),areaRect=area.getBoundingClientRect(),firstRect=first.getBoundingClientRect();return{area:{display:areaStyle.display,visibility:areaStyle.visibility,opacity:areaStyle.opacity,width:areaRect.width,height:areaRect.height,offsetWidth:area.offsetWidth,offsetHeight:area.offsetHeight},first:{display:firstStyle.display,visibility:firstStyle.visibility,opacity:firstStyle.opacity,width:firstRect.width,height:firstRect.height,offsetWidth:first.offsetWidth,offsetHeight:first.offsetHeight}};});
        console.log('desktop roster pre-pdf state:',JSON.stringify(rosterPrePdfState));
        assert.ok(rosterPrePdfState.area.width>0&&rosterPrePdfState.area.height>0&&rosterPrePdfState.first.width>0&&rosterPrePdfState.first.height>0,'desktop: PDF 생성 전에 명단표 레이아웃 크기가 있어야 합니다.');
        const rosterPdfPath=path.join(outputDir,'desktop-roster-print-6.pdf');
        await page.pdf({path:rosterPdfPath,landscape:true,printBackground:true,preferCSSPageSize:true});
        const rosterPdfSize=fs.statSync(rosterPdfPath).size;
        const rosterPhysicalPages=(fs.readFileSync(rosterPdfPath).toString('latin1').match(/\/Type \/Page\b/g)||[]).length;
        const rosterPdfState=await page.evaluate(()=>{const area=document.querySelector('#rosterPrintArea'),page=area?.querySelector('.roster-page'),style=area?getComputedStyle(area):null,rect=area?.getBoundingClientRect(),pageRect=page?.getBoundingClientRect();return{lifecycle:window.__rosterPrintLifecycle,active:document.body.classList.contains('roster-printing'),text:area?.innerText.length||0,display:style?.display,visibility:style?.visibility,rect:rect&&{width:rect.width,height:rect.height},pageRect:pageRect&&{width:pageRect.width,height:pageRect.height}};});
        console.log('desktop roster print pdf state:',JSON.stringify({size:rosterPdfSize,physicalPages:rosterPhysicalPages,...rosterPdfState}));
        assert.ok(rosterPdfSize>15000,'desktop: 실제 인쇄 PDF가 비어 있으면 안 됩니다.');
        assert.equal(rosterPhysicalPages,2,'desktop: 6명 평가표는 실제 PDF에서도 2장이어야 합니다.');
        await page.emulateMedia({media:'screen'});
        await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
        assert.equal(await page.evaluate(()=>document.body.classList.contains('roster-printing')),false,'desktop: 인쇄 완료 뒤 상태를 정리해야 합니다.');
        assert.equal(await page.locator('#btnRosterPrint').isEnabled(),true,'desktop: 인쇄 완료 뒤 버튼을 복구해야 합니다.');
      }
      const overflow=await page.evaluate(()=>({body:document.body.scrollWidth-document.body.clientWidth,html:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
      assert.ok(overflow.body<=1&&overflow.html<=1,`${viewport.name}: 가로 넘침 ${JSON.stringify(overflow)}`);
      assert.deepEqual(errors,[],`${viewport.name}: 브라우저 오류 ${errors.join(' | ')}`);
      await context.close();
    }
    console.log('ui-visual-layout.js: 핵심 4메뉴·6화면·데스크톱/모바일·콘솔 오류 0건 확인 완료');
  }finally{
    if(browser)await browser.close();
    if(!server.killed)server.kill('SIGTERM');
  }
})().catch(error=>{console.error(error);if(!server.killed)server.kill('SIGTERM');process.exitCode=1;});
