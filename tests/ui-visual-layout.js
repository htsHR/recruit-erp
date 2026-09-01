'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');

const root=path.resolve(__dirname,'..');
const port=4183;
const baseUrl=`http://127.0.0.1:${port}`;
const outputDir=process.env.UI_SCREENSHOT_DIR||path.join(root,'artifacts','ui-v12.5.0');
fs.mkdirSync(outputDir,{recursive:true});
const executableCandidates=process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=executableCandidates.find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('자동 UI 검사에 사용할 Chrome/Chromium을 찾지 못했습니다.');

const fakeApplicants=[
  {id:'11111111-1111-4111-8111-111111111111',name:'가상지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',school:'가상대학교',createdAt:'2026-08-01T01:00:00.000Z'},
  {id:'22222222-2222-4222-8222-222222222222',name:'가상지원자2',phone:'010-0000-0002',applyDate:'2026-08-02',workplace:'평택',status:'면접예정',interviewDate:'2099-08-02',interviewTime:'10:00',createdAt:'2026-08-02T01:00:00.000Z'},
  {id:'33333333-3333-4333-8333-333333333333',name:'가상지원자3',phone:'010-0000-0003',applyDate:'2026-08-03',workplace:'천안',status:'입사예정',hireDate:'2099-08-06',createdAt:'2026-08-03T01:00:00.000Z'}
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
      const errors=[];
      page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
      page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});
      page.on('dialog',dialog=>dialog.dismiss());
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
      assert.deepEqual(await page.evaluate(()=>({stored:JSON.parse(localStorage.getItem('recruit_erp_applicants_stable')||'[]').length,loaded:applicants.length})),{stored:3,loaded:3},`${viewport.name}: 기존 지원자 데이터 복원`);
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
