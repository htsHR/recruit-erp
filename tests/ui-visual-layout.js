'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');
const employeeXlsx=require('../js/employee-master-xlsx-import.js');
const {createBridgeServer,HOST:bridgeHost,PORT:bridgePort}=require('../bridge/erp-bridge.js');

const root=path.resolve(__dirname,'..');
const port=4183;
const baseUrl=`http://127.0.0.1:${port}`;
const bridgeTempRoot=fs.realpathSync(os.tmpdir());
const bridgeTempParent=fs.mkdtempSync(path.join(bridgeTempRoot,'erp-bridge-ui-'));
const bridgeSharedFolder=path.join(bridgeTempParent,'RecruitERP');
const bridgeExistingFile=path.join(bridgeSharedFolder,'existing-company-file.txt');
fs.mkdirSync(bridgeSharedFolder);
fs.writeFileSync(bridgeExistingFile,'existing file must not change','utf8');
const bridgeServer=createBridgeServer({allowedOrigin:baseUrl,rootPath:bridgeSharedFolder,port:bridgePort});
const outputDir=process.env.UI_SCREENSHOT_DIR||path.join(root,'artifacts','ui-v12.0.0');
fs.mkdirSync(outputDir,{recursive:true});
const executableCandidates=process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'];
const executablePath=executableCandidates.find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('자동 UI 검사에 사용할 Chrome/Chromium을 찾지 못했습니다.');

const fakeApplicants=[
  {id:'11111111-1111-4111-8111-111111111111',name:'테스트지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',education:'대졸',school:'테스트대학교',memo:'기존 메모',createdAt:'2026-08-01T01:00:00.000Z',updatedAt:'2026-08-01T01:00:00.000Z'},
  {id:'22222222-2222-4222-8222-222222222222',name:'테스트지원자2',phone:'010-0000-0002',applyDate:'2026-08-02',workplace:'평택',status:'면접예정',interviewDate:'2026-08-02',interviewTime:'10:00',createdAt:'2026-08-02T01:00:00.000Z',updatedAt:'2026-08-02T01:00:00.000Z'},
  {id:'33333333-3333-4333-8333-333333333333',name:'가상긴이름지원자삼',phone:'010-0000-0003',email:'very-long-synthetic-address@recruit-erp.example',applyDate:'2026-08-01',workplace:'천안',status:'입사예정',hireDate:'2026-08-06',dormUse:'출퇴근',education:'대학교',school:'가상으로만사용하는매우긴대학교명',major:'가상스마트설비자동화융합전공',region:'가상광역시테스트구역',createdAt:'2026-08-01T02:00:00.000Z',updatedAt:'2026-08-01T02:00:00.000Z'}
];
const denseApplicants=Array.from({length:60},(_,index)=>{
  const number=index+1,statuses=['서류검토','면접예정','입사예정','서류합격','부재중','서류탈락'];
  const status=statuses[index%statuses.length],day=String((index%18)+1).padStart(2,'0');
  return {
    id:`90000000-0000-4000-8000-${String(number).padStart(12,'0')}`,
    name:`가상밀도지원자${String(number).padStart(2,'0')}`,
    phone:`010-9000-${String(number).padStart(4,'0')}`,
    email:`density-${number}@example.invalid`,
    applyDate:`2026-08-${day}`,
    workplace:index%3===0?'평택':'천안',status,
    interviewDate:status==='면접예정'?`2026-08-${String((index%9)+19).padStart(2,'0')}`:'',
    interviewTime:status==='면접예정'?'10:00':'',
    hireDate:status==='입사예정'?`2026-09-${String((index%9)+1).padStart(2,'0')}`:'',
    source:index%2?'가상 채용채널':'',careerType:index%3?'경력':'',dormUse:index%2?'출퇴근':'',
    education:index%4?'대학교':'',school:index%4?'가상밀도대학교':'',major:index%5?'가상설비전공':'',region:index%3?'가상지역':'',
    career:index===29?'가상 장비 유지보수와 현장 대응 경험을 여러 단계에 걸쳐 검토하기 위한 긴 경력 설명입니다. '.repeat(7):'',
    certs:index===29?'가상설비자격 · 가상안전자격 · 가상전기자격':'',memo:index===1?'':index===12?'<img src=x onerror=alert(1)>':index===29?'긴 메모의 줄바꿈과 스크롤을 확인합니다.\n'.repeat(18):'UI 밀도 자동검사용 가상 메모',
    ...(index===0?{lastContactDate:'2026-08-18',nextContactDate:'2099-08-20',progressHistory:[{id:'synthetic-history-1',type:'contact',createdAt:'2026-08-18T09:30:00.000Z',summary:'가상 후속 연락 안내 완료',title:'전화 기록',detail:'가상 후속 연락 안내 완료'}]}:{}),
    ...(index===1?{nextContactDate:'2000-01-01'}:{}),
    ...(index===10?{residentNumber:'991231-1234567'}:{}),
    createdAt:`2026-08-${day}T01:00:00.000Z`,updatedAt:`2026-08-${day}T01:00:00.000Z`
  };
});
const worksheetApplicants=[...fakeApplicants.map(row=>({...row})),...denseApplicants.slice(0,57).map((row,index)=>{
  const copy={...row,id:`80000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,createdAt:`2026-07-${String((index%27)+1).padStart(2,'0')}T01:00:00.000Z`,updatedAt:''};
  delete copy.residentNumber;return copy;
})];
const fakeHireWaitingProfiles=[
  {applicantId:'33333333-3333-4333-8333-333333333333',employeeNo:'V-1003',groupName:'가상부서',product:'가상제품',part:'가상파트',rank:'사원',commuteMethod:'출퇴근',remarks:'가상 업무 확인용으로 충분히 긴 비고이며 실제 개인정보나 운영 내용은 포함하지 않습니다.',documentsRequestedAt:'2026-08-02T00:00:00.000Z',submittedDocuments:['신분증 사본','통장 사본','졸업증명서'],trainingDate:'2026-08-05',residentNumber:'000000-0000000'}
];
const fakeWorkforce={
  schools:[{id:'school-ui-1',name:'가상인력대학교',aliases:['가상인력대']}],
  employees:[
    {id:'employee-ui-1',empNo:'UI-1001',name:'가상재직자',status:'재직중',hireDate:'2023-01-10',schoolId:'school-ui-1',school:'가상인력대학교',rank:'E1-2',position:'파트장',role:'설비기술',team:'가상기술팀',groupName:'가상1그룹',recruitType:'공채',recruitChannel:'학교추천',education:'대졸',major:'기계공학',gender:'여자'},
    {id:'employee-ui-2',empNo:'UI-1002',name:'가상휴직자',status:'휴직',hireDate:'2024-02-20',leaveStartDate:'2026-07-01',schoolId:'school-ui-1',school:'가상인력대학교',rank:'SE1-2',position:'',role:'품질검사',team:'가상품질팀',groupName:'가상2그룹',recruitType:'경력',recruitChannel:'사람인',education:'전문대',major:'전기공학',gender:'남자'},
    {id:'employee-ui-3',empNo:'UI-1003',name:'가상퇴직자',status:'퇴사',hireDate:'2022-03-15',leaveDate:'2026-05-01',schoolId:'school-ui-1',school:'가상인력대학교',rank:'PE2-5',position:'그룹장',role:'공정기술',team:'가상공정팀',groupName:'가상3그룹',recruitType:'공채',recruitChannel:'학교추천',education:'대졸',major:'화학공학',gender:'여자'}
  ],
  upcoming:{id:'applicant-ui-upcoming',name:'가상입사예정자',status:'입사예정',hireDate:'2099-08-06',schoolId:'school-ui-1',school:'가상인력대학교',source:'학교추천',education:'대졸',major:'산업공학',gender:'남자'}
};
const viewports=[
  {name:'1920x1080',width:1920,height:1080},
  {name:'1440x900',width:1440,height:900},
  {name:'1366x768',width:1366,height:768},
  {name:'1280x720',width:1280,height:720},
  {name:'1024x768',width:1024,height:768},
  {name:'768x1024',width:768,height:1024},
  {name:'390x844',width:390,height:844},
  {name:'360x640',width:360,height:640}
];
const savedAdvancedSearchFixture=[
  {name:'천안 채용 <보기> & "A"',criteria:{ApplyFrom:'',ApplyTo:'',InterviewFrom:'',InterviewTo:'',HireFrom:'',HireTo:'',Status:'all',Workplace:'천안',School:'all',Manager:'all',Contact:'all',Dorm:'all',Keyword:'가상'},createdAt:'2026-08-19T00:00:00.000Z'}
];
const hireWaitingKeys=['no','employeeNo','contactStatus','hireDate','workplace','pmtc','gender','groupName','product','part','name','rank','residentNumber','birthDate','age','email','education','school','major','phone','region','commuteMethod','remarks'];
const hireWaitingWidths={no:52,employeeNo:124,contactStatus:88,hireDate:104,workplace:90,pmtc:108,gender:64,groupName:112,product:112,part:112,name:118,rank:88,residentNumber:150,birthDate:112,age:60,email:230,education:100,school:210,major:210,phone:136,region:120,commuteMethod:108,remarks:420};
const screens=['home','applicants','form','today','calendar','templates','advancedSearch','stats','schools','employees','onboarding','backup','dataHealth','duplicates','permissions','auditHistory','storagePerformance','productionReadiness'];
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
  await page.evaluate(async()=>window.erpEncryptedBackupUI.inspectFile(new File([window.__fakeEncryptedBackup],'fake_v11.0.0.erpbackup',{type:'application/json'})));
  await page.locator('#encryptedBackupPassword').fill('가상 복원 전용 긴 비밀번호 2026');await page.locator('#encryptedBackupSubmit').click();await page.locator('#bcInspection.visible').waitFor();await page.locator('#encryptedBackupDialog').waitFor({state:'hidden'});
}
async function openSchoolWorkforceFixture(page){
  await page.evaluate(fixture=>{
    if(!window.__schoolWorkforceFixtureOriginal)window.__schoolWorkforceFixtureOriginal={employees,schools,applicants};
    employees=fixture.employees.map(row=>({...row}));schools=fixture.schools.map(row=>({...row}));applicants=[...applicants.filter(row=>row.id!==fixture.upcoming.id),{...fixture.upcoming}];
    window.openSchoolWorkforceAnalytics('school-ui-1');
  },fakeWorkforce);
  await page.locator('#schoolWorkforceModal.show').waitFor();await page.waitForTimeout(80);
}
async function restoreSchoolWorkforceFixture(page){
  await page.evaluate(()=>{const original=window.__schoolWorkforceFixtureOriginal;if(original){employees=original.employees;schools=original.schools;applicants=original.applicants;delete window.__schoolWorkforceFixtureOriginal;}window.openSchoolWorkforceAnalytics&&document.querySelector('#btnCloseSchoolWorkforce')?.click();});
}
async function verifyUiDensity(page,label){
  const baseline=await page.evaluate(()=>{
    window.__densityOriginalApplicants=applicants;
    window.__densityEmployeesJson=JSON.stringify(employees);
    window.__densitySchoolsJson=JSON.stringify(schools);
    return {
      applicants:localStorage.getItem('recruit_erp_applicants_stable'),
      employees:localStorage.getItem('recruit_erp_employees'),
      schools:localStorage.getItem('recruit_erp_schools'),
      events:localStorage.getItem('recruit_erp_calendar_events')
    };
  });
  await page.evaluate(rows=>{applicants=rows.map(row=>({...row}));window.__densityApplicantsJson=JSON.stringify(applicants);resetListFiltersToAll();renderAll();setPage('applicants');},denseApplicants);
  await page.waitForTimeout(80);
  const density=await page.evaluate(()=>{
    const wrap=document.querySelector('#applicants .table-wrap'),wrapRect=wrap.getBoundingClientRect();
    const header=document.querySelector('#applicants .applicant-table thead').getBoundingClientRect();
    const rows=[...document.querySelectorAll('#applicantTbody tr.applicant-row')].map(row=>row.getBoundingClientRect());
    const regions=['.applicant-list-header-row','.applicant-list-tool-row','.applicant-list-filter-stack'].map(selector=>{const rect=document.querySelector(`#applicants ${selector}`).getBoundingClientRect();return{selector,top:Math.round(rect.top),height:rect.height};});
    const storage=document.querySelector('#storageNote'),auth=document.querySelector('#authNote'),sidebar=document.querySelector('.sidebar'),nav=document.querySelector('.nav'),stateArea=document.querySelector('[data-sidebar-status-area]');
    const sidebarRect=sidebar.getBoundingClientRect(),navRect=nav.getBoundingClientRect(),stateRect=stateArea.getBoundingClientRect();
    const kpiKeys=[...document.querySelectorAll('#statsGrid [data-home-target]')].map(node=>node.dataset.homeTarget);
    const taskKeys=[...document.querySelectorAll('#homeTodayGrid [data-task-target]')].map(node=>node.dataset.taskTarget);
    return {
      sidebarWidth:document.querySelector('.sidebar').getBoundingClientRect().width,
      sidebarBounds:{top:sidebarRect.top,bottom:sidebarRect.bottom,stateTop:stateRect.top,stateBottom:stateRect.bottom,navTop:navRect.top,navBottom:navRect.bottom},
      navHeights:[...document.querySelectorAll('.nav-btn')].filter(node=>getComputedStyle(node).display!=='none').map(node=>node.getBoundingClientRect().height),
      stateAreas:document.querySelectorAll('[data-sidebar-status-area]').length,
      stateChildren:!!storage?.closest('[data-sidebar-status-area]')&&!!auth?.closest('[data-sidebar-status-area]'),
      authDescriptions:document.querySelectorAll('#authLoggedOut>strong,#authLoggedOut>span,#authLoggedIn small,#authUserMark').length,
      authActions:document.querySelectorAll('#btnOpenLogin,#btnLogout').length,
      visibleAuthActions:[...document.querySelectorAll('#btnOpenLogin,#btnLogout')].filter(node=>node.getClientRects().length>0).length,
      kpiKeys,taskKeys,
      regions,visualRows:new Set(regions.map(region=>region.top)).size,
      visibleRows:rows.filter(rect=>rect.top>=header.bottom-1&&rect.bottom<=Math.min(wrapRect.bottom,innerHeight)+1).length,
      headerVisible:header.top>=wrapRect.top-1&&header.bottom<=Math.min(wrapRect.bottom,innerHeight)+1,
      bodyOverflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,
      internalScroll:wrap.scrollWidth>wrap.clientWidth,
      tableOverflow:getComputedStyle(wrap).overflowX,
      controlIds:['searchInput','sortSelect','hideFinished','btnOpenApplicantFilter','bulkModeButton','btnResetFilters'].every(id=>!!document.getElementById(id)),
      statusFilters:[...document.querySelectorAll('#quickFilters [data-filter]')].map(node=>node.dataset.filter),
      statusCounts:[...document.querySelectorAll('#quickFilters [data-filter-count]')].map(node=>node.dataset.filterCount),
      workplaceFilters:[...document.querySelectorAll('#workplaceTabs [data-workplace]')].map(node=>node.dataset.workplace),
      workplaceCounts:[...document.querySelectorAll('#workplaceTabs [data-workplace-count]')].map(node=>node.dataset.workplaceCount)
    };
  });
  assert.ok(Math.abs(density.sidebarWidth-216)<=1,`${label} 데스크톱 사이드바는 216px이어야 합니다: ${density.sidebarWidth}`);
  assert.ok(density.navHeights.length&&density.navHeights.every(height=>height>=36),`${label} 데스크톱 메뉴 버튼은 36px 이상이어야 합니다.`);
  assert.ok(density.sidebarBounds.stateBottom<=density.sidebarBounds.bottom+1&&density.sidebarBounds.navBottom<=density.sidebarBounds.stateTop+1,`${label} 메뉴와 하단 상태 영역이 잘리거나 겹치면 안 됩니다: ${JSON.stringify(density.sidebarBounds)}`);
  assert.deepEqual({areas:density.stateAreas,children:density.stateChildren,descriptions:density.authDescriptions,actions:density.authActions,visibleActions:density.visibleAuthActions},{areas:1,children:true,descriptions:0,actions:2,visibleActions:1},`${label} 사이드바 상태 설명과 로그인 동작이 중복되었습니다.`);
  assert.deepEqual(density.kpiKeys,['all','today','review','interview','overdue']);
  assert.equal(density.kpiKeys.some(key=>density.taskKeys.includes(key)),false,'홈 누적 KPI와 오늘 업무 키가 겹치면 안 됩니다.');
  assert.equal(density.visualRows,3,`${label} 지원자 상단 제어영역은 3개 시각 행이어야 합니다: ${JSON.stringify(density.regions)}`);
  const regionLimits={'.applicant-list-header-row':60,'.applicant-list-tool-row':70,'.applicant-list-filter-stack':56};
  assert.ok(density.regions.every(region=>region.height<=regionLimits[region.selector]),`${label} 지원자 상단 제어행이 과도하게 높습니다: ${JSON.stringify(density.regions)}`);
  assert.ok(density.headerVisible&&density.visibleRows>=3,`${label} 768px 높이에서 표 헤더와 지원자 3행 이상이 보여야 합니다: ${JSON.stringify(density)}`);
  assert.ok(density.bodyOverflow<=1,`${label} 본문 가로 넘침: ${density.bodyOverflow}`);
  assert.ok(density.internalScroll&&density.tableOverflow!=='visible',`${label} 넓은 지원자 표는 table-wrap 안에서만 스크롤되어야 합니다.`);
  assert.equal(density.controlIds,true,'지원자 검색·정렬·상세조건·선택·초기화 제어가 유지되어야 합니다.');
  assert.deepEqual(density.statusFilters,['all','todayAction','interview','contact','active','docpass','hire','finished','decision','duplicate']);
  assert.deepEqual(density.statusCounts,density.statusFilters);
  assert.deepEqual(density.workplaceFilters,['all','천안','평택','기타']);
  assert.deepEqual(density.workplaceCounts,density.workplaceFilters);
  await page.screenshot({path:path.join(outputDir,`${label}-applicants-normal.png`),fullPage:false});
  await page.locator('.sidebar').screenshot({path:path.join(outputDir,`${label}-sidebar.png`)});

  for(const key of ['all','today','review','interview']){
    await page.evaluate(()=>window.setPage?.('home'));
    await page.locator(`#statsGrid [data-home-target="${key}"]`).click();
    assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'applicants',`${key} KPI는 지원자 목록으로 이동해야 합니다.`);
  }
  await page.locator('#quickFilters [data-filter="interview"]').click();
  await page.locator('#sidebarToggle').click();
  await page.waitForFunction(()=>document.body.classList.contains('sidebar-collapsed')&&Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-72)<=1);
  const collapsed=await page.evaluate(()=>({labels:[...document.querySelectorAll('.nav-btn>span:last-child')].filter(node=>node.getClientRects().length).length,icons:[...document.querySelectorAll('.nav-btn .nav-ico')].filter(node=>node.getClientRects().length).length,width:document.querySelector('.sidebar').getBoundingClientRect().width}));
  assert.ok(collapsed.icons>0&&collapsed.labels===0&&Math.abs(collapsed.width-72)<=1,`데스크톱 메뉴 접기는 글자를 숨기고 아이콘 레일을 유지해야 합니다: ${JSON.stringify(collapsed)}`);
  await page.screenshot({path:path.join(outputDir,`${label}-sidebar-collapsed.png`),fullPage:false});
  await page.locator('.sidebar').hover();await page.waitForFunction(()=>document.body.classList.contains('sidebar-preview-expanded')&&Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-216)<=1);
  const preview=await page.evaluate(()=>({expanded:document.body.classList.contains('sidebar-preview-expanded'),sidebar:document.querySelector('.sidebar').getBoundingClientRect().width,main:document.querySelector('.main').getBoundingClientRect().left,labelRects:[...document.querySelectorAll('.nav-btn>span:last-child')].filter(node=>node.getClientRects().length).map(node=>{const rect=node.getBoundingClientRect();return{width:rect.width,height:rect.height};})}));
  assert.ok(preview.expanded&&Math.abs(preview.sidebar-216)<=1&&Math.abs(preview.main-72)<=1&&preview.labelRects.every(rect=>rect.width>0&&rect.height<=20),`${label} 접힌 메뉴 호버는 정상 한 줄 문구를 보이며 본문을 밀지 않는 임시 오버레이여야 합니다: ${JSON.stringify(preview)}`);
  await page.screenshot({path:path.join(outputDir,`${label}-sidebar-hover-preview.png`),fullPage:false});
  await page.locator('#sidebarToggle').click();await page.waitForFunction(()=>!document.body.classList.contains('sidebar-collapsed')&&Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-216)<=1);assert.ok(!await page.evaluate(()=>document.body.classList.contains('sidebar-collapsed')),'핀 버튼은 임시 확장을 고정해야 합니다.');
  await page.locator('#sidebarToggle').click();await page.mouse.move(800,400);await page.waitForFunction(()=>!document.body.classList.contains('sidebar-preview-expanded')&&Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-72)<=1);
  await page.locator('.nav-btn[data-page="home"]').focus();await page.waitForFunction(()=>document.body.classList.contains('sidebar-preview-expanded')&&Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-216)<=1);assert.ok(await page.evaluate(()=>document.body.classList.contains('sidebar-preview-expanded')),'아이콘 레일에 키보드 포커스가 들어오면 임시 확장되어야 합니다.');
  await page.locator('#globalSearchInput').focus();await page.waitForFunction(()=>!document.body.classList.contains('sidebar-preview-expanded')&&Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-72)<=1,null,{timeout:1000});assert.ok(!await page.evaluate(()=>document.body.classList.contains('sidebar-preview-expanded')),'포인터와 포커스가 빠지면 400~600ms 후 아이콘 레일로 돌아가야 합니다.');
  await page.locator('#sidebarToggle').click();await page.waitForFunction(()=>!document.body.classList.contains('sidebar-collapsed')&&Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width-216)<=1);
  const readOnlyState=await page.evaluate(snapshot=>({
    memory:JSON.stringify(applicants)===window.__densityApplicantsJson,
    employeeMemory:JSON.stringify(employees)===window.__densityEmployeesJson,
    schoolMemory:JSON.stringify(schools)===window.__densitySchoolsJson,
    applicants:localStorage.getItem('recruit_erp_applicants_stable')===snapshot.applicants,
    employees:localStorage.getItem('recruit_erp_employees')===snapshot.employees,
    schools:localStorage.getItem('recruit_erp_schools')===snapshot.schools,
    events:localStorage.getItem('recruit_erp_calendar_events')===snapshot.events
  }),baseline);
  assert.deepEqual(readOnlyState,{memory:true,employeeMemory:true,schoolMemory:true,applicants:true,employees:true,schools:true,events:true},'화면 이동·필터·사이드바 동작이 업무 배열이나 localStorage를 변경하면 안 됩니다.');

  await page.evaluate(()=>{applicants=[];resetListFiltersToAll();renderTable();});
  const emptyAdmin=await page.evaluate(()=>{const state=document.querySelector('.applicant-list-empty-state').getBoundingClientRect();return{height:state.height,register:!!document.querySelector('.applicant-empty-register'),reset:!!document.querySelector('.applicant-empty-reset')};});
  assert.ok(emptyAdmin.height<=240&&emptyAdmin.register&&emptyAdmin.reset,`관리자 빈 목록은 240px 이하에서 등록·초기화를 제공해야 합니다: ${JSON.stringify(emptyAdmin)}`);
  await page.evaluate(()=>{window.__densityPermissionHas=window.erpPermissions.has;window.erpPermissions.has=permission=>permission==='applicant.write'?false:window.__densityPermissionHas(permission);renderTable();});
  assert.equal(await page.locator('.applicant-empty-register').count(),0,'조회 전용 빈 목록에는 등록 버튼이 보이면 안 됩니다.');
  await page.evaluate(()=>{
    window.erpPermissions.has=window.__densityPermissionHas;delete window.__densityPermissionHas;
    applicants=window.__densityOriginalApplicants;delete window.__densityOriginalApplicants;delete window.__densityApplicantsJson;delete window.__densityEmployeesJson;delete window.__densitySchoolsJson;
    resetListFiltersToAll();renderAll();setPage('applicants');
  });
  const restored=await page.evaluate(snapshot=>({
    applicants:localStorage.getItem('recruit_erp_applicants_stable')===snapshot.applicants,
    employees:localStorage.getItem('recruit_erp_employees')===snapshot.employees,
    schools:localStorage.getItem('recruit_erp_schools')===snapshot.schools,
    events:localStorage.getItem('recruit_erp_calendar_events')===snapshot.events
  }),baseline);
  assert.deepEqual(restored,{applicants:true,employees:true,schools:true,events:true},'UI 밀도 검사는 기존 업무 저장값을 변경하면 안 됩니다.');
}
async function verifyRoutingHistory(page,label){
  const beforeErpUrl=baseUrl+'/favicon.svg';await page.goto(beforeErpUrl);await page.goto(baseUrl+'#/today',{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
  const visit=async(pageId,hash)=>{await page.locator(`.nav-btn[data-page="${pageId}"]`).click();await page.waitForFunction(expected=>location.hash===expected,hash);assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),pageId);};
  await visit('applicants','#/applicants');await visit('calendar','#/calendar');
  await page.goBack();await page.waitForFunction(()=>location.hash==='#/applicants');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'applicants');assert.equal(await page.locator('#page-title').innerText(),'지원자');
  await page.goBack();await page.waitForFunction(()=>location.hash==='#/today');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'home');
  await page.goForward();await page.waitForFunction(()=>location.hash==='#/applicants');assert.equal(await page.evaluate(()=>document.querySelector('.nav-btn.active')?.dataset.page),'applicants');
  await page.goBack();await page.waitForFunction(()=>location.hash==='#/today');await page.goBack();await page.waitForURL(beforeErpUrl);assert.equal(page.url(),beforeErpUrl,'ERP 첫 이력 이전의 브라우저 페이지를 가로채면 안 됩니다.');

  await page.goto(baseUrl+'#/calendar',{waitUntil:'domcontentloaded'});await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'calendar');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(650);assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'calendar','hash route 새로고침은 같은 화면을 복원해야 합니다.');
  await page.goto(baseUrl+'#/not-a-real-route',{waitUntil:'domcontentloaded'});await page.waitForTimeout(650);assert.deepEqual(await page.evaluate(()=>({page:document.querySelector('.page.active')?.id,hash:location.hash})),{page:'home',hash:'#/today'},'알 수 없는 라우트는 오늘 화면으로 안전하게 대체해야 합니다.');
  await page.goto(baseUrl+'#/applicants/quick',{waitUntil:'domcontentloaded'});await page.waitForTimeout(650);assert.deepEqual(await page.evaluate(()=>({page:document.querySelector('.page.active')?.id,hash:location.hash,quick:document.querySelector('#applicantQuickDetail')?.classList.contains('is-open')})),{page:'applicants',hash:'#/applicants',quick:false},'지원자 내부 ID가 없는 빠른 보기 직접 URL은 안전하게 목록으로 대체해야 합니다.');
  await page.evaluate(()=>{document.querySelector('[data-page="permissions"]')?.classList.add('erp-permission-hidden');location.hash='#/admin/permissions';});await page.waitForFunction(()=>location.hash==='#/today');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'home','권한 없는 라우트는 접근 가능한 첫 화면으로 대체해야 합니다.');

  const globalSearchHistory=await page.evaluate(()=>Number(history.state?.erpIndex)||0);await page.locator('#globalSearchInput').fill('가상');const globalResult=page.locator('#globalSearchResults button').first();await globalResult.waitFor();await globalResult.click();await page.locator('#applicantQuickDetail.is-open').waitFor();await page.waitForFunction(()=>location.hash==='#/applicants/quick');assert.ok(await page.evaluate(before=>(Number(history.state?.erpIndex)||0)>before,globalSearchHistory),'전체 검색에서 지원자 이동은 브라우저 이력을 추가해야 합니다.');
  await page.goBack();await page.locator('#applicantQuickDetail').waitFor({state:'hidden'});await page.goBack();await page.waitForFunction(()=>location.hash==='#/today'&&document.querySelector('.page.active')?.id==='home');
  const dailyHistory=await page.evaluate(()=>Number(history.state?.erpIndex)||0),dailyShortcut=page.locator('#priorityList .home-daily-work-item').first();assert.ok(await dailyShortcut.count()>0,'오늘 우선 업무 바로가기용 가상 업무가 필요합니다.');await dailyShortcut.click();await page.locator('#applicantQuickDetail.is-open').waitFor();await page.waitForFunction(()=>location.hash==='#/applicants/quick');assert.ok(await page.evaluate(before=>(Number(history.state?.erpIndex)||0)>before,dailyHistory),'오늘 업무 바로가기는 브라우저 이력을 추가해야 합니다.');
  await page.goBack();await page.locator('#applicantQuickDetail').waitFor({state:'hidden'});await page.goBack();await page.waitForFunction(()=>location.hash==='#/today'&&document.querySelector('.page.active')?.id==='home');

  await page.evaluate(()=>window.setPage('applicants'));const controlHistory=await page.evaluate(()=>({length:history.length,index:Number(history.state?.erpIndex)||0,hash:location.hash}));await page.locator('#searchInput').fill('가상');await page.locator('#sortSelect').selectOption('nameAsc');await page.locator('#quickFilters [data-filter="interview"]').click();assert.deepEqual(await page.evaluate(()=>({length:history.length,index:Number(history.state?.erpIndex)||0,hash:location.hash})),controlHistory,'검색·필터·정렬 변경은 브라우저 이력을 추가하면 안 됩니다.');

  await page.evaluate(()=>{window.setPage('applicants');resetListFiltersToAll();currentSearch='가상';document.getElementById('searchInput').value='가상';renderTable();const wrap=document.querySelector('#applicants .table-wrap');wrap.scrollLeft=Math.min(120,wrap.scrollWidth-wrap.clientWidth);});
  const routeContext=await page.evaluate(()=>({search:currentSearch,tableLeft:document.querySelector('#applicants .table-wrap').scrollLeft}));
  await page.locator('#applicantTbody .applicant-row').first().focus();await page.keyboard.press('Enter');await page.locator('#applicantQuickDetail.is-open').waitFor();assert.equal(await page.evaluate(()=>location.hash),'#/applicants/quick');
  const privateNeedles=await page.evaluate(()=>[applicants[0]?.name,applicants[0]?.phone,applicants[0]?.email].filter(Boolean));const href=await page.evaluate(()=>location.href);assert.ok(privateNeedles.every(value=>!href.includes(encodeURIComponent(value))&&!href.includes(value)),`${label} URL에 지원자 개인정보가 포함되면 안 됩니다.`);
  await page.goBack();await page.locator('#applicantQuickDetail').waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>({page:document.querySelector('.page.active')?.id,hash:location.hash,search:currentSearch,tableLeft:document.querySelector('#applicants .table-wrap').scrollLeft})),{page:'applicants',hash:'#/applicants',...routeContext},'빠른 보기 뒤로가기는 목록 조건과 스크롤을 유지해야 합니다.');
  await page.goForward();await page.locator('#applicantQuickDetail.is-open').waitFor();assert.equal(await page.evaluate(()=>location.hash),'#/applicants/quick','앞으로가기는 빠른 보기를 복원해야 합니다.');await page.goBack();await page.locator('#applicantQuickDetail').waitFor({state:'hidden'});

  await page.evaluate(()=>{window.setPage('form');});await page.locator('#name').fill('가상 미저장 입력');
  const formDialog=page.waitForEvent('dialog');await page.evaluate(()=>history.back());const dialog=await formDialog;assert.ok(dialog.message().includes('저장하지 않은 입력'));await dialog.dismiss();await page.waitForFunction(()=>location.hash==='#/applicants/new');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'form','등록 이탈 취소는 현재 화면을 유지해야 합니다.');assert.equal(await page.locator('#name').inputValue(),'가상 미저장 입력');await page.evaluate(()=>resetForm());

  await page.evaluate(()=>{window.setPage('home');window.setPage('applicants');window.erpApplicantWorksheet.setViewMode('worksheet');window.erpApplicantWorksheet.setDirty(applicants[0].id,'memo','가상 워크시트 임시 변경');});
  await page.evaluate(()=>history.back());await page.locator('#applicantWorksheetGuard:not([hidden])').waitFor();await page.locator('#btnWorksheetGuardStay').click();await page.waitForFunction(()=>location.hash==='#/applicants');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'applicants');assert.ok(await page.evaluate(()=>window.erpApplicantWorksheet.state.dirty.size>0),'워크시트 이탈 취소는 임시 변경을 유지해야 합니다.');
  await page.evaluate(()=>{window.erpApplicantWorksheet.discard();window.erpApplicantWorksheet.setViewMode('normal');});
  await page.screenshot({path:path.join(outputDir,`${label}-routing-history.png`),fullPage:false});
}
async function verifyUsabilityPolish(page,label){
  const accessible=await page.evaluate(()=>Object.fromEntries(['searchInput','sortSelect','calendarWorkplaceFilter','dailyWorkflowSearch','rosterDate'].map(id=>[id,document.getElementById(id)?.getAttribute('aria-label')||''])));
  assert.ok(Object.values(accessible).every(Boolean),`${label} 핵심 검색·정렬·날짜 컨트롤에 접근 가능한 이름이 필요합니다: ${JSON.stringify(accessible)}`);

  await page.evaluate(()=>window.setPage?.('applicants'));await page.waitForTimeout(40);
  const filterLayout=await page.evaluate(()=>{
    const card=document.querySelector('#applicants .applicant-list-filter-card'),quick=document.getElementById('quickFilters'),workplace=document.getElementById('workplaceTabs');
    const buttons=[...document.querySelectorAll('#quickFilters button,#workplaceTabs button,#btnOpenApplicantFilter,#bulkModeButton,#btnResetFilters')].filter(node=>node.getClientRects().length);
    return{cardOverflow:card.scrollWidth-card.clientWidth,quickOverflow:quick.scrollWidth-quick.clientWidth,workplaceOverflow:workplace.scrollWidth-workplace.clientWidth,heights:buttons.map(button=>button.getBoundingClientRect().height)};
  });
  assert.ok(filterLayout.cardOverflow<=1&&filterLayout.quickOverflow<=1&&filterLayout.workplaceOverflow<=1,`${label} 데스크톱 지원자 필터 내부에 가로 스크롤이나 잘림이 있으면 안 됩니다: ${JSON.stringify(filterLayout)}`);
  assert.ok(filterLayout.heights.length&&filterLayout.heights.every(height=>height>=36),`${label} 반복 필터와 주요 조작 버튼은 36px 이상이어야 합니다: ${JSON.stringify(filterLayout.heights)}`);
  await page.locator('#searchInput').fill('가상검색');await page.locator('#sortSelect').selectOption('nameAsc');await page.locator('#quickFilters [data-filter="interview"]').click();await page.locator('#workplaceTabs [data-workplace="평택"]').click();await page.locator('#hideFinished').check();
  assert.deepEqual(await page.evaluate(()=>({search:currentSearch,sort:currentSort,filter:currentFilter,workplace:currentWorkplace,hidden:hideFinished})),{search:'가상검색',sort:'nameAsc',filter:'interview',workplace:'평택',hidden:true},`${label} 검색·정렬·필터 선택값이 유지되어야 합니다.`);
  await page.locator('#btnResetFilters').click();assert.deepEqual(await page.evaluate(()=>({search:currentSearch,sort:currentSort,filter:currentFilter,workplace:currentWorkplace,hidden:hideFinished})),{search:'',sort:'recent',filter:'all',workplace:'all',hidden:false},`${label} 필터 초기화가 기존 동작을 유지해야 합니다.`);

  await page.evaluate(()=>{window.setPage?.('calendar');window.__v1141CalendarEvents=calendarEvents;calendarEvents=[...calendarEvents,{id:'calendar-v1141-synthetic',title:'가상 오늘 일정',date:today(),type:'중요',workplace:'전체',importance:'normal'}];goCalendarToday();});await page.waitForTimeout(40);
  const todayCell=await page.locator('#calendar .calendar-day.today').evaluate(cell=>{const dot=cell.querySelector('.calendar-today-dot'),date=cell.querySelector('.calendar-date-num'),style=getComputedStyle(cell),dotStyle=getComputedStyle(dot),dateStyle=getComputedStyle(date);return{selected:cell.classList.contains('selected'),ariaCurrent:cell.getAttribute('aria-current'),ariaLabel:cell.getAttribute('aria-label'),background:style.backgroundColor,dateColor:dateStyle.color,dotBackground:dotStyle.backgroundColor,dotColor:dotStyle.color,dotText:dot.textContent,events:cell.querySelectorAll('.calendar-day-line').length};});
  assert.ok(todayCell.selected&&todayCell.ariaCurrent==='date'&&todayCell.ariaLabel.includes('오늘')&&todayCell.dotText==='오늘'&&todayCell.events>=1,`${label} 오늘 날짜는 텍스트·접근성 이름·일정과 함께 구분되어야 합니다: ${JSON.stringify(todayCell)}`);
  assert.notEqual(todayCell.background,todayCell.dateColor,`${label} 오늘 날짜 숫자와 배경색이 같으면 안 됩니다.`);assert.notEqual(todayCell.dotBackground,todayCell.dotColor,`${label} 오늘 배지 글자와 배경색이 같으면 안 됩니다.`);
  await page.screenshot({path:path.join(outputDir,`${label}-calendar-today.png`),fullPage:true});
  await page.evaluate(()=>{calendarEvents=window.__v1141CalendarEvents;delete window.__v1141CalendarEvents;renderCalendar();});

  const sidebar=await page.evaluate(()=>{
    localStorage.setItem('recruit_erp_ui_operation_environment','home');updateStorageNote();
    const nav=document.querySelector('.sidebar .nav'),area=document.querySelector('.sidebar-status-area'),last=[...nav.querySelectorAll('.nav-btn')].filter(node=>node.getClientRects().length).at(-1);nav.scrollTop=nav.scrollHeight;
    const nr=nav.getBoundingClientRect(),ar=area.getBoundingClientRect(),lr=last.getBoundingClientRect(),result={navClient:nav.clientHeight,navScroll:nav.scrollHeight,lastBottom:lr.bottom,navBottom:nr.bottom,statusTop:ar.top,statusBottom:ar.bottom,sidebarBottom:document.querySelector('.sidebar').getBoundingClientRect().bottom,badge:document.querySelector('.local-mode-badge')?.textContent||'',status:document.querySelector('#storageNote strong')?.textContent||''};
    nav.scrollTop=0;localStorage.setItem('recruit_erp_ui_operation_environment','company');updateStorageNote();return result;
  });
  assert.ok(sidebar.lastBottom<=sidebar.navBottom+1&&sidebar.navBottom<=sidebar.statusTop+1&&sidebar.statusBottom<=sidebar.sidebarBottom+1,`${label} 사이드바 메뉴 끝과 상태 영역이 겹치거나 가려지면 안 됩니다: ${JSON.stringify(sidebar)}`);
  assert.equal(sidebar.badge,'집 운영',`${label} 상단에는 운영 환경만 표시해야 합니다.`);assert.ok(sidebar.status.length>0&&sidebar.status!==sidebar.badge,`${label} 모드 표시와 저장 상태를 분리해야 합니다.`);
}
const applicantTableGeometryMetrics=[];
async function verifyApplicantNormalTableGeometry(page,label){
  await page.evaluate(()=>{window.setPage('applicants');window.erpApplicantWorksheet?.setViewMode?.('normal');resetListFiltersToAll();renderTable();});
  const positions=await page.locator('#applicants .table-wrap').evaluate(wrap=>{const max=Math.max(0,wrap.scrollWidth-wrap.clientWidth);return[0,Math.round(max/2),max];});
  for(const [index,target] of positions.entries()){
    await page.locator('#applicants .table-wrap').evaluate((wrap,left)=>{wrap.scrollLeft=left;},target);await page.waitForTimeout(30);
    const state=await page.evaluate(()=>{
      const wrap=document.querySelector('#applicants .table-wrap'),row=document.querySelector('#applicantTbody .applicant-row');
      const pairs=[['no-head','no-cell'],['name-head','applicant-name-cell'],['phone-head','phone-cell'],['posting-head','posting-cell'],['stage-head','stage-cell'],['next-head','next-action-cell'],['schedule-head','schedule-cell'],['manager-head','manager-cell'],['apply-date-head','apply-date-cell'],['decision-head','decision-cell'],['actions-head','applicant-actions']];
      const box=(headClass,cellClass)=>{const head=document.querySelector(`#applicants .${headClass}`),cell=row.querySelector(`.${cellClass}`),hr=head.getBoundingClientRect(),cr=cell.getBoundingClientRect(),hs=getComputedStyle(head),cs=getComputedStyle(cell);return{key:headClass.replace('-head',''),head:{left:hr.left,right:hr.right,width:hr.width,position:hs.position,background:hs.backgroundColor,z:hs.zIndex},cell:{left:cr.left,right:cr.right,width:cr.width,position:cs.position,background:cs.backgroundColor,z:cs.zIndex}};};
      const columns=pairs.map(pair=>box(...pair)),byKey=Object.fromEntries(columns.map(column=>[column.key,column]));
      return{viewport:innerWidth,clientWidth:wrap.clientWidth,scrollWidth:wrap.scrollWidth,scrollLeft:wrap.scrollLeft,globalOverflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,columns,sticky:['no','name','phone'].map(key=>byKey[key]),statusApply:[byKey.stage.head,byKey['apply-date'].head],decisionActions:[byKey.decision.head,byKey.actions.head],nonSticky:['posting','stage','next','schedule','manager','apply-date','decision','actions'].map(key=>byKey[key].head)};
    });
    assert.ok(state.columns.every(column=>Math.abs(column.head.left-column.cell.left)<=1&&Math.abs(column.head.right-column.cell.right)<=1),`${label} ${target}px 헤더/본문 열 경계 오차: ${JSON.stringify(state.columns)}`);
    assert.ok(Math.abs(state.sticky[1].head.left-state.sticky[0].head.right)<=1&&Math.abs(state.sticky[2].head.left-state.sticky[1].head.right)<=1,`${label} ${target}px NO·성명·연락처 누적 고정 위치 오류`);
    assert.ok(state.sticky.every(column=>column.head.position==='sticky'&&column.cell.position==='sticky'&&column.head.background!=='rgba(0, 0, 0, 0)'&&column.cell.background!=='rgba(0, 0, 0, 0)'),`${label} ${target}px 고정 열 배경/position 오류`);
    assert.ok(state.statusApply[0].right<=state.statusApply[1].left+1,`${label} ${target}px 상태/지원일 겹침: ${JSON.stringify(state.statusApply)}`);
    assert.ok(state.decisionActions[0].right<=state.decisionActions[1].left+1,`${label} ${target}px 판정/관리 겹침: ${JSON.stringify(state.decisionActions)}`);
    for(let column=1;column<state.nonSticky.length;column++)assert.ok(state.nonSticky[column-1].right<=state.nonSticky[column].left+1,`${label} ${target}px 일반 열 겹침: ${JSON.stringify(state.nonSticky)}`);
    assert.ok(state.globalOverflow<=1,`${label} ${target}px 전역 가로 넘침: ${state.globalOverflow}`);
    applicantTableGeometryMetrics.push({label,position:['scroll-0','scroll-mid','scroll-max'][index],clientWidth:state.clientWidth,scrollWidth:state.scrollWidth,scrollLeft:state.scrollLeft,maxHeaderBodyError:Math.max(...state.columns.flatMap(column=>[Math.abs(column.head.left-column.cell.left),Math.abs(column.head.right-column.cell.right)])),stickyWidths:state.sticky.map(column=>Math.round(column.head.width))});
    await page.screenshot({path:path.join(outputDir,`${label}-applicant-list-${['scroll-0','scroll-mid','scroll-max'][index]}.png`),fullPage:false});
  }
}
async function verifyApplicantMyViews(page,label,{exercise=false}={}){
  await page.evaluate(()=>{window.setPage('applicants');window.erpApplicantWorksheet?.setViewMode?.('normal');window.erpSavedAdvancedSearches?.render();});
  await page.locator('#applicantMyViews').evaluate(host=>host.scrollIntoView({block:'center'}));
  const layout=await page.locator('#applicantMyViews').evaluate(host=>{const rect=host.getBoundingClientRect();return{left:rect.left,right:rect.right,width:rect.width,viewport:innerWidth,overflow:host.scrollWidth-host.clientWidth,text:host.innerText,images:host.querySelectorAll('img').length,controls:[...host.querySelectorAll('select,button')].map(node=>{const box=node.getBoundingClientRect();return{left:box.left,right:box.right,top:box.top,bottom:box.bottom};})};});
  assert.ok(layout.left>=-1&&layout.right<=layout.viewport+1&&layout.overflow<=1&&layout.controls.every(control=>control.left>=-1&&control.right<=layout.viewport+1),`${label} 내 보기 툴바가 겹치거나 잘렸습니다: ${JSON.stringify(layout)}`);
  assert.equal(layout.images,0);assert.ok(layout.text.includes('천안 채용 <보기> & "A"'),'저장 보기의 특수문자는 실행되지 않고 글자로 보여야 합니다.');
  await page.screenshot({path:path.join(outputDir,`${label}-applicant-my-view.png`),fullPage:false});
  if(!exercise)return;
  let bridgePuts=0;const requestListener=request=>{if(request.method()==='PUT'&&request.url()==='http://127.0.0.1:17840/storage/snapshot')bridgePuts++;};page.on('request',requestListener);
  const before=await page.evaluate(()=>({arrays:JSON.stringify(applicants),storage:{...localStorage},saved:localStorage.getItem('recruit_erp_saved_advanced_searches'),filters:{currentWorkplace,currentFilter,currentSearch,currentSort,hideFinished,currentSchoolFilterId}}));
  await page.locator('#applicantMyViewSelect').selectOption('0');await page.locator('#btnApplyApplicantMyView').click();
  const loaded=await page.evaluate(()=>({ids:[...window.__erpAdvancedFilterIds],visible:[...document.querySelectorAll('#applicantTbody .applicant-row')].map(row=>row.dataset.applicantId),criteria:{status:document.getElementById('asStatus').value,workplace:document.getElementById('asWorkplace').value,keyword:document.getElementById('asKeyword').value},arrays:JSON.stringify(applicants),storage:{...localStorage},saved:localStorage.getItem('recruit_erp_saved_advanced_searches')}));
  const expected=await page.evaluate(()=>applicants.filter(row=>row.workplace==='천안'&&[row.name,row.phone,row.school,row.workplace,row.status].join(' ').toLowerCase().includes('가상')).map(row=>row.id));
  assert.deepEqual(loaded.ids,expected);assert.deepEqual(loaded.visible,expected);assert.deepEqual(loaded.criteria,{status:'all',workplace:'천안',keyword:'가상'});assert.equal(loaded.arrays,before.arrays);assert.deepEqual(loaded.storage,before.storage);assert.equal(loaded.saved,before.saved,'내 보기 불러오기는 기존 저장 검색조건을 다시 쓰면 안 됩니다.');
  const viewer=await page.evaluate(()=>{const original=window.erpPermissions.has;window.erpPermissions.has=permission=>permission==='applicant.write'?false:original(permission);const result=window.erpSavedAdvancedSearches.load(0);window.erpPermissions.has=original;return{result,ids:[...window.__erpAdvancedFilterIds],saved:localStorage.getItem('recruit_erp_saved_advanced_searches')};});
  assert.equal(viewer.result,true);assert.deepEqual(viewer.ids,expected);assert.equal(viewer.saved,before.saved,'조회 전용 내 보기 불러오기도 저장값을 바꾸면 안 됩니다.');
  const emptyStates=await page.evaluate(original=>{localStorage.setItem('recruit_erp_saved_advanced_searches','{}');window.erpSavedAdvancedSearches.render();const legacy=document.getElementById('applicantMyViews').innerText;localStorage.setItem('recruit_erp_saved_advanced_searches','[]');window.erpSavedAdvancedSearches.render();const empty=document.getElementById('applicantMyViews').innerText;localStorage.setItem('recruit_erp_saved_advanced_searches',original);window.erpSavedAdvancedSearches.render();return{legacy,empty};},before.saved);
  assert.deepEqual(emptyStates,{legacy:'내 보기 없음',empty:'내 보기 없음'});
  assert.equal(bridgePuts,0,'내 보기 조회는 Bridge 저장을 호출하면 안 됩니다.');page.off('request',requestListener);
  await page.evaluate(filters=>{currentWorkplace=filters.currentWorkplace;currentFilter=filters.currentFilter;currentSearch=filters.currentSearch;currentSort=filters.currentSort;hideFinished=filters.hideFinished;currentSchoolFilterId=filters.currentSchoolFilterId;window.__erpAdvancedFilterIds=null;renderTable();},before.filters);
}
async function verifyApplicantQuickDetail(page,label,{exercise=false}={}){
  const closeQuickDetail=async()=>{
    await page.waitForFunction(()=>document.getElementById('applicantQuickDetail')?.contains(document.activeElement));
    await page.keyboard.press('Escape');
    await page.locator('#applicantQuickDetail').waitFor({state:'hidden'});
  };
  let bridgeSaveRequests=0;
  let precheckedSafety=null;
  const requestListener=request=>{if(request.method()==='PUT'&&request.url()==='http://127.0.0.1:17840/storage/snapshot')bridgeSaveRequests++;};
  page.on('request',requestListener);
  await page.evaluate(rows=>{
    window.__quickDetailOriginalApplicants=applicants;
    applicants=rows.map(row=>({...row}));
    resetListFiltersToAll();currentSort='nameAsc';applicantPageSize=30;currentApplicantPage=1;
    const sort=document.getElementById('sortSelect');if(sort)sort.value='nameAsc';
    renderTable();setPage('applicants');
    const keys=['recruit_erp_applicants_stable','recruit_erp_employees','recruit_erp_schools','recruit_erp_calendar_events','recruit_erp_hire_waiting_profiles'];
    window.__quickDetailBaseline={arrays:{applicants:JSON.stringify(applicants),employees:JSON.stringify(employees),schools:JSON.stringify(schools),events:typeof calendarEvents==='undefined'?'':JSON.stringify(calendarEvents)},storage:Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),filters:{currentWorkplace,currentFilter,currentSearch,currentSort,hideFinished,currentSchoolFilterId,applicantPageSize}};
    window.__quickDetailRealSave=window.save;window.__quickDetailSaveCalls=0;window.save=function(){window.__quickDetailSaveCalls++;return window.__quickDetailRealSave.apply(this,arguments);};
  },denseApplicants);
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#applicantQuickDetail').count(),1,`${label} 빠른 보기 패널은 정확히 하나여야 합니다.`);
  assert.equal(await page.locator('#applicantQuickDetail').getAttribute('aria-hidden'),'true');

  await page.locator('#applicantTbody .applicant-row').first().locator('.status-inline').click();
  assert.equal(await page.locator('#applicantQuickDetail').getAttribute('aria-hidden'),'true','상태 선택 클릭은 빠른 보기를 열면 안 됩니다.');
  await page.locator('#applicantTbody .applicant-row').first().locator('.applicant-row-more summary').click();
  await page.locator('#applicantTbody .applicant-row').first().locator('.applicant-row-more-menu [data-erp-handler*="viewApplicant"]').click();
  await page.locator('#detailModal.show').waitFor();assert.equal(await page.locator('#applicantQuickDetail').getAttribute('aria-hidden'),'true','기존 상세 버튼은 전체 상세만 열어야 합니다.');await page.locator('#btnCloseDetail').click();
  await page.evaluate(()=>{const keys=Object.keys(window.__quickDetailBaseline.storage);window.__quickDetailBaseline={arrays:{applicants:JSON.stringify(applicants),employees:JSON.stringify(employees),schools:JSON.stringify(schools),events:typeof calendarEvents==='undefined'?'':JSON.stringify(calendarEvents)},storage:Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),filters:{currentWorkplace,currentFilter,currentSearch,currentSort,hideFinished,currentSchoolFilterId,applicantPageSize}};});

  const firstRow=page.locator('#applicantTbody .applicant-row').first();
  await firstRow.focus();await page.keyboard.press('Enter');await page.locator('#applicantQuickDetail.is-open').waitFor();await page.waitForFunction(()=>document.activeElement?.id==='btnApplicantQuickDetailClose');
  assert.ok((await page.locator('#applicantQuickDetailPosition').innerText()).includes('1 / 60'));
  const nextActionText=await page.locator('.applicant-quick-detail-next-action').innerText();
  assert.ok(nextActionText.includes('2026-08-18')&&nextActionText.includes('2099-08-20')&&nextActionText.includes('D-')&&nextActionText.includes('2026-08-18 · 연락')&&nextActionText.includes('가상 후속 연락 안내 완료'),`${label} 다음 액션 날짜·상태·최근 이력이 정확하지 않습니다: ${nextActionText}`);
  const panelState=await page.evaluate(()=>{
    const shell=document.getElementById('applicantQuickDetail'),panel=shell.querySelector('.applicant-quick-detail-panel'),header=shell.querySelector('.applicant-quick-detail-header'),footer=shell.querySelector('.applicant-quick-detail-footer'),pr=panel.getBoundingClientRect(),hr=header.getBoundingClientRect(),fr=footer.getBoundingClientRect();
    return {panel:{left:pr.left,right:pr.right,top:pr.top,bottom:pr.bottom,width:pr.width,height:pr.height},header:{top:hr.top,bottom:hr.bottom},footer:{top:fr.top,bottom:fr.bottom},viewport:{width:innerWidth,height:innerHeight},bodyOverflow:getComputedStyle(document.body).overflow,buttons:[...shell.querySelectorAll('button:not([hidden])')].map(button=>{const rect=button.getBoundingClientRect();return{id:button.id,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};}),text:shell.innerText,html:shell.innerHTML};
  });
  assert.ok(panelState.panel.left>=-1&&panelState.panel.right<=panelState.viewport.width+1&&panelState.panel.top>=-1&&panelState.panel.bottom<=panelState.viewport.height+1,`${label} 빠른 보기 패널 잘림: ${JSON.stringify(panelState.panel)}`);
  if(panelState.viewport.width>=1280)assert.ok(panelState.panel.width>=360&&panelState.panel.width<=420,`${label} v12 데스크톱 빠른 보기 폭: ${panelState.panel.width}`);else if(panelState.viewport.width>900)assert.ok(panelState.panel.width>=420&&panelState.panel.width<=480,`${label} 확대·노트북 빠른 보기 폭: ${panelState.panel.width}`);else assert.ok(Math.abs(panelState.panel.width-panelState.viewport.width)<=1,`${label} 모바일·태블릿 빠른 보기는 화면 너비를 사용해야 합니다.`);
  assert.ok(panelState.header.top>=-1&&panelState.footer.bottom<=panelState.viewport.height+1&&panelState.footer.top>panelState.header.bottom,`${label} 빠른 보기 고정 머리말·작업영역 배치 오류`);
  assert.ok(panelState.buttons.every(button=>button.left>=-1&&button.right<=panelState.viewport.width+1&&button.top>=-1&&button.bottom<=panelState.viewport.height+1),`${label} 빠른 보기 버튼 잘림: ${JSON.stringify(panelState.buttons)}`);
  assert.equal(panelState.bodyOverflow,'hidden');assert.ok(!panelState.html.includes('residentNumber')&&!/\d{6}-?\d{7}/.test(panelState.text),'빠른 보기 DOM에 주민등록번호 필드나 형태가 있으면 안 됩니다.');
  await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>document.getElementById('applicantQuickDetail').contains(document.activeElement)),'Shift+Tab 포커스가 빠른 보기 안에 있어야 합니다.');
  await page.screenshot({path:path.join(outputDir,`${label}-applicant-quick-detail-next-action.png`),fullPage:false});
  await page.keyboard.press('Escape');await page.locator('#applicantQuickDetail').waitFor({state:'hidden'});await page.waitForFunction(expected=>document.activeElement?.dataset?.applicantId===expected,denseApplicants[0].id);assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.applicantId),denseApplicants[0].id,'Escape 후 실행한 행으로 포커스가 돌아가야 합니다.');

  if(exercise){
    await page.evaluate(()=>{currentApplicantPage=1;renderTable();const wrap=document.querySelector('#applicants .table-wrap');wrap.scrollLeft=Math.min(180,Math.max(0,wrap.scrollWidth-wrap.clientWidth));window.scrollTo(0,Math.min(120,document.documentElement.scrollHeight-innerHeight));});
    await page.locator('#applicantTbody .applicant-row').nth(29).locator('.apply-date-cell').click();await page.locator('#applicantQuickDetail.is-open').waitFor();
    const contextBefore=await page.evaluate(()=>{const wrap=document.querySelector('#applicants .table-wrap');return{windowY:scrollY,tableLeft:wrap.scrollLeft,filters:{currentWorkplace,currentFilter,currentSearch,currentSort,hideFinished,currentSchoolFilterId,applicantPageSize}};});
    assert.ok((await page.locator('#applicantQuickDetailPosition').innerText()).includes('30 / 60'));await page.locator('#applicantQuickDetailBody').evaluate(body=>{body.scrollTop=body.scrollHeight;});await page.screenshot({path:path.join(outputDir,`${label}-applicant-quick-detail-long-memo.png`),fullPage:false});
    await page.locator('#btnApplicantQuickDetailNext').click();await page.waitForFunction(()=>currentApplicantPage===2&&document.querySelector('#applicantQuickDetailPosition')?.textContent.includes('31 / 60'));
    const crossPage=await page.evaluate(()=>{const wrap=document.querySelector('#applicants .table-wrap');return{page:currentApplicantPage,id:window.erpApplicantQuickDetail.state.id,windowY:scrollY,tableLeft:wrap.scrollLeft,filters:{currentWorkplace,currentFilter,currentSearch,currentSort,hideFinished,currentSchoolFilterId,applicantPageSize}};});
    assert.equal(crossPage.page,2);assert.deepEqual(crossPage.filters,contextBefore.filters,'이전·다음은 검색·필터·정렬·페이지 크기를 바꾸면 안 됩니다.');assert.equal(crossPage.windowY,contextBefore.windowY);assert.equal(crossPage.tableLeft,contextBefore.tableLeft,'페이지 경계 이동이 원래 표 가로 위치를 잃으면 안 됩니다.');
    await page.locator('#btnApplicantQuickDetailPrevious').click();await page.waitForFunction(()=>currentApplicantPage===1&&document.querySelector('#applicantQuickDetailPosition')?.textContent.includes('30 / 60'));await closeQuickDetail();

    await page.evaluate(()=>{currentApplicantPage=1;renderTable();});await page.locator('#applicantTbody .applicant-row').nth(1).locator('.apply-date-cell').click();assert.ok((await page.locator('.applicant-quick-detail-next-action').innerText()).includes('경과 · 확인 필요'),'기한 경과는 색상뿐 아니라 텍스트로 표시해야 합니다.');await closeQuickDetail();
    await page.locator('#applicantTbody .applicant-row').nth(2).locator('.apply-date-cell').click();const emptyAction=await page.locator('.applicant-quick-detail-next-action').innerText();assert.ok(emptyAction.includes('기록 없음')&&emptyAction.includes('미정'),'빈 다음 액션은 기록 없음·미정으로 표시해야 합니다.');assert.ok(await page.locator('#applicantQuickDetailBody .is-empty').count()>=6,'빈 핵심정보는 미입력으로 일관되게 표시해야 합니다.');await page.screenshot({path:path.join(outputDir,`${label}-applicant-quick-detail-empty.png`),fullPage:false});await closeQuickDetail();
    await page.evaluate(id=>window.openApplicantQuickDetail(id),denseApplicants[12].id);assert.equal(await page.locator('#applicantQuickDetailBody img').count(),0,'지원자 입력값이 HTML로 실행되면 안 됩니다.');assert.ok((await page.locator('#applicantQuickDetailBody').innerText()).includes('<img src=x onerror=alert(1)>'));await closeQuickDetail();
    await page.locator('#applicantTbody .applicant-row').first().locator('.apply-date-cell').click();assert.equal(await page.locator('#btnApplicantQuickDetailPrevious').isDisabled(),true);await page.screenshot({path:path.join(outputDir,`${label}-applicant-quick-detail-first.png`),fullPage:false});await closeQuickDetail();
    await page.evaluate(()=>{currentApplicantPage=2;renderTable();});await page.locator('#applicantTbody .applicant-row').last().locator('.apply-date-cell').click();assert.equal(await page.locator('#btnApplicantQuickDetailNext').isDisabled(),true);await page.screenshot({path:path.join(outputDir,`${label}-applicant-quick-detail-last.png`),fullPage:false});await closeQuickDetail();

    precheckedSafety=await page.evaluate(()=>{const baseline=window.__quickDetailBaseline,keys=Object.keys(baseline.storage);return{saveCalls:window.__quickDetailSaveCalls,arrays:{applicants:JSON.stringify(applicants)===baseline.arrays.applicants,employees:JSON.stringify(employees)===baseline.arrays.employees,schools:JSON.stringify(schools)===baseline.arrays.schools,events:(typeof calendarEvents==='undefined'?'':JSON.stringify(calendarEvents))===baseline.arrays.events},storage:keys.every(key=>localStorage.getItem(key)===baseline.storage[key])};});
    assert.deepEqual(precheckedSafety,{saveCalls:0,arrays:{applicants:true,employees:true,schools:true,events:true},storage:true},`${label} 빠른 보기 동작은 업무 배열·저장값·save를 변경하면 안 됩니다.`);
    await page.evaluate(()=>{currentApplicantPage=1;renderTable();});await page.locator('#applicantTbody .applicant-row').first().locator('.apply-date-cell').click();await page.locator('#btnApplicantQuickDetailFull').click();await page.locator('#detailModal.show').waitFor();assert.equal(await page.locator('#applicantQuickDetail').getAttribute('aria-hidden'),'true');await page.locator('#btnCloseDetail').click();
    await page.locator('#applicantTbody .applicant-row').first().locator('.apply-date-cell').click();assert.equal(await page.locator('#btnApplicantQuickDetailEdit').isVisible(),true);await page.locator('#btnApplicantQuickDetailEdit').click();assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'form');assert.equal(await page.locator('#editId').inputValue(),denseApplicants[0].id);await page.evaluate(()=>window.setPage('applicants'));
  }

  const safety=await page.evaluate(prechecked=>{
    const baseline=window.__quickDetailBaseline,keys=Object.keys(baseline.storage),result=prechecked||{saveCalls:window.__quickDetailSaveCalls,arrays:{applicants:JSON.stringify(applicants)===baseline.arrays.applicants,employees:JSON.stringify(employees)===baseline.arrays.employees,schools:JSON.stringify(schools)===baseline.arrays.schools,events:(typeof calendarEvents==='undefined'?'':JSON.stringify(calendarEvents))===baseline.arrays.events},storage:keys.every(key=>localStorage.getItem(key)===baseline.storage[key])};
    window.save=window.__quickDetailRealSave;applicants=window.__quickDetailOriginalApplicants;delete window.__quickDetailRealSave;delete window.__quickDetailOriginalApplicants;delete window.__quickDetailBaseline;delete window.__quickDetailSaveCalls;resetListFiltersToAll();renderAll();setPage('applicants');return result;
  },precheckedSafety);
  page.off('request',requestListener);
  assert.deepEqual(safety,{saveCalls:0,arrays:{applicants:true,employees:true,schools:true,events:true},storage:true},`${label} 빠른 보기 동작은 업무 배열·저장값·save를 변경하면 안 됩니다.`);
  assert.equal(bridgeSaveRequests,0,`${label} 빠른 보기 동작은 Bridge 저장 PUT을 호출하면 안 됩니다.`);
}
async function verifyApplicantWorksheet(page,label,{exercise=false}={}){
  await page.evaluate(rows=>{
    window.__worksheetUiOriginalApplicants=applicants;
    window.__worksheetUiOriginalStorage=localStorage.getItem('recruit_erp_applicants_stable');
    applicants=rows.map(row=>({...row}));resetListFiltersToAll();applicantPageSize=30;currentApplicantPage=1;renderAll();
  },worksheetApplicants);
  const restoreFixture=()=>page.evaluate(()=>{
    window.erpApplicantWorksheet?.discard?.();
    applicants=window.__worksheetUiOriginalApplicants;
    if(window.__worksheetUiOriginalStorage===null)localStorage.removeItem('recruit_erp_applicants_stable');else localStorage.setItem('recruit_erp_applicants_stable',window.__worksheetUiOriginalStorage);
    delete window.__worksheetUiOriginalApplicants;delete window.__worksheetUiOriginalStorage;resetListFiltersToAll();renderAll();setPage('applicants');
  });
  await page.evaluate(()=>window.setPage?.('applicants'));await page.locator('#btnApplicantWorksheetView').click();await page.locator('#applicantWorksheet:not([hidden])').waitFor();
  const layout=await page.evaluate(()=>{
    const section=document.querySelector('#applicants'),wrap=document.querySelector('.applicant-worksheet-scroll'),table=document.querySelector('.applicant-worksheet-table'),first=document.querySelector('#applicantWorksheet tbody tr[data-applicant-id]');
    const no=first?.querySelector('[data-field="no"]'),name=first?.querySelector('[data-field="name"]'),phone=first?.querySelector('[data-field="phone"]');
    const headers=[...document.querySelectorAll('.applicant-worksheet-table thead [data-field]')],alignments=headers.map(header=>{const cell=first.querySelector('[data-field="'+header.dataset.field+'"]'),headRect=header.getBoundingClientRect(),cellRect=cell.getBoundingClientRect();return{field:header.dataset.field,left:Math.abs(headRect.left-cellRect.left),right:Math.abs(headRect.right-cellRect.right)};});
    return {fields:headers.map(node=>node.dataset.field),firstValues:Object.fromEntries([...first.querySelectorAll('[data-field]')].map(cell=>[cell.dataset.field,cell.innerText.trim()])),normalHidden:document.querySelector('#applicantTbody').closest('.table-wrap').hidden,bodyOverflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,internalScroll:wrap.scrollWidth>wrap.clientWidth,noPosition:getComputedStyle(no).position,namePosition:getComputedStyle(name).position,phonePosition:getComputedStyle(phone).position,noLeft:no.getBoundingClientRect().left-wrap.getBoundingClientRect().left,nameLeft:name.getBoundingClientRect().left-no.getBoundingClientRect().right,phoneLeft:phone.getBoundingClientRect().left-name.getBoundingClientRect().right,sectionWidth:section.clientWidth,tableWidth:table.getBoundingClientRect().width,visibleRows:document.querySelectorAll('#applicantWorksheet tbody tr[data-applicant-id]').length,totalApplicants:applicants.length,alignments};
  });
  assert.deepEqual(layout.fields,['no','name','phone','email','region','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo'],label+' 워크시트 열 순서가 달라졌습니다.');
  assert.equal(layout.firstValues.interviewDate,'2026-08-02');assert.equal(layout.firstValues.interviewTime,'10:00','면접일과 면접시간이 서로 다른 열에 유지되어야 합니다.');
  assert.deepEqual({visibleRows:layout.visibleRows,totalApplicants:layout.totalApplicants},{visibleRows:30,totalApplicants:60},'합성 지원자 60명에서 현재 페이지 30행을 표시해야 합니다.');
  assert.ok(layout.alignments.every(item=>item.left<=1&&item.right<=1),'워크시트 헤더와 데이터 셀 경계가 맞아야 합니다: '+JSON.stringify(layout.alignments));
  assert.equal(layout.normalHidden,true);assert.equal(layout.noPosition,'sticky');assert.equal(layout.namePosition,'sticky');assert.equal(layout.phonePosition,'sticky');assert.ok(Math.abs(layout.noLeft)<=1&&Math.abs(layout.nameLeft)<=1&&Math.abs(layout.phoneLeft)<=1,label+' NO·성명·연락처 고정 열 위치가 맞지 않습니다: '+JSON.stringify(layout));
  assert.ok((layout.internalScroll||layout.tableWidth<=layout.sectionWidth)&&layout.bodyOverflow<=1,label+' 워크시트는 필요한 경우 표 내부에서만 가로 스크롤되어야 합니다: '+JSON.stringify(layout));
  assert.equal(await page.locator('#applicantWorksheet [data-field="residentNumber"]').count(),0,'주민등록번호는 워크시트 열에 없어야 합니다.');
  await page.evaluate(()=>{const wrap=document.querySelector('.applicant-worksheet-scroll');wrap.scrollLeft=wrap.scrollWidth;});await page.waitForTimeout(30);
  const sticky=await page.evaluate(()=>{
    const wrap=document.querySelector('.applicant-worksheet-scroll'),row=document.querySelector('#applicantWorksheet tbody tr[data-applicant-id]');
    const cell=field=>{const body=row.querySelector(`[data-field="${field}"]`),head=document.querySelector(`#applicantWorksheet thead [data-field="${field}"]`),br=body.getBoundingClientRect(),hr=head.getBoundingClientRect();return{left:br.left,right:br.right,width:br.width,headLeft:hr.left,headRight:hr.right,value:body.innerText.trim(),position:getComputedStyle(body).position};};
    return{scrollLeft:wrap.scrollLeft,wrapLeft:wrap.getBoundingClientRect().left,no:cell('no'),name:cell('name'),phone:cell('phone')};
  });
  assert.ok(sticky.scrollLeft>100,`${label} 워크시트 실제 가로 스크롤이 필요합니다.`);assert.deepEqual([sticky.no.value,sticky.name.value,sticky.phone.value],[layout.firstValues.no,layout.firstValues.name,layout.firstValues.phone],`${label} 가로 스크롤 뒤 행 식별값이 유지되어야 합니다.`);
  assert.ok(Math.abs(sticky.no.left-sticky.wrapLeft)<=1&&Math.abs(sticky.name.left-sticky.no.right)<=1&&Math.abs(sticky.phone.left-sticky.name.right)<=1,`${label} 누적 고정 열 offset이 실제 렌더 너비와 맞아야 합니다: ${JSON.stringify(sticky)}`);
  assert.ok(Math.abs(sticky.no.left-sticky.no.headLeft)<=1&&Math.abs(sticky.name.left-sticky.name.headLeft)<=1&&Math.abs(sticky.phone.left-sticky.phone.headLeft)<=1,`${label} 고정 헤더와 본문 위치가 맞아야 합니다.`);
  await page.evaluate(({id,otherPhone})=>{window.erpApplicantWorksheet.setDirty(id,'name','가상 고정열 수정');window.erpApplicantWorksheet.setDirty(id,'phone',otherPhone);},{id:worksheetApplicants[0].id,otherPhone:worksheetApplicants[1].phone});
  await page.locator(`#applicantWorksheet tr[data-applicant-id="${worksheetApplicants[0].id}"] [data-field="phone"]`).click();await page.evaluate(()=>{const wrap=document.querySelector('.applicant-worksheet-scroll');wrap.scrollLeft=wrap.scrollWidth;});
  const stickyStates=await page.evaluate(id=>{const row=document.querySelector(`#applicantWorksheet tr[data-applicant-id="${id}"]`),read=field=>[...row.querySelector(`[data-field="${field}"]`).classList];return{no:read('no'),name:read('name'),phone:read('phone')};},worksheetApplicants[0].id);
  assert.ok(stickyStates.no.includes('is-readonly')&&stickyStates.name.includes('is-dirty')&&stickyStates.phone.includes('is-duplicate')&&stickyStates.phone.includes('is-current'),`${label} 고정 열에서 읽기전용·변경·중복·선택 상태가 유지되어야 합니다: ${JSON.stringify(stickyStates)}`);
  await page.evaluate(id=>window.erpApplicantWorksheet.setDirty(id,'phone','010-12'),worksheetApplicants[0].id);await page.evaluate(()=>{const wrap=document.querySelector('.applicant-worksheet-scroll');wrap.scrollLeft=wrap.scrollWidth;});
  assert.equal(await page.locator(`#applicantWorksheet tr[data-applicant-id="${worksheetApplicants[0].id}"] [data-field="phone"]`).evaluate(cell=>cell.classList.contains('is-error')),true,`${label} 고정 연락처 열의 오류 표시가 유지되어야 합니다.`);
  await page.evaluate(()=>window.erpApplicantWorksheet.discard());
  await page.evaluate(()=>{currentSearch='__v11_4_1_empty__';document.getElementById('searchInput').value=currentSearch;window.erpApplicantWorksheet.render();});
  const empty=await page.locator('#applicantWorksheet .worksheet-empty').evaluate(node=>{const r=node.getBoundingClientRect(),wrap=node.closest('.applicant-worksheet-scroll').getBoundingClientRect();return{center:r.left+r.width/2,viewportCenter:wrap.left+wrap.width/2,width:r.width,viewportWidth:wrap.width};});
  assert.ok(Math.abs(empty.center-empty.viewportCenter)<=1&&empty.width<=empty.viewportWidth+1,`${label} 빈 상태는 1854px 표가 아니라 보이는 워크시트 영역 중앙에 있어야 합니다: ${JSON.stringify(empty)}`);
  await page.evaluate(()=>{currentSearch='';document.getElementById('searchInput').value='';window.erpApplicantWorksheet.render();});
  await page.screenshot({path:path.join(outputDir,label+'-applicant-worksheet.png'),fullPage:false});
  if(!exercise){await restoreFixture();return;}

  const id=fakeApplicants[0].id,otherId=fakeApplicants[1].id;
  let bridgePuts=0;
  const bridgeListener=request=>{if(request.method()==='PUT'&&request.url()==='http://127.0.0.1:17840/storage/snapshot')bridgePuts++;};
  page.on('request',bridgeListener);
  const before=await page.evaluate(()=>({applicants:JSON.stringify(applicants),employees:JSON.stringify(employees),schools:JSON.stringify(schools),events:typeof calendarEvents==='undefined'?'':JSON.stringify(calendarEvents),storage:localStorage.getItem('recruit_erp_applicants_stable')}));

  const nameCell=page.locator('#applicantWorksheet tr[data-applicant-id="'+id+'"] [data-field="name"]');
  await nameCell.click();await page.keyboard.press('Enter');await nameCell.locator('.worksheet-editor').fill('  가상워크시트수정  ');await page.keyboard.press('Enter');
  const phoneCell=page.locator('#applicantWorksheet tr[data-applicant-id="'+id+'"] [data-field="phone"]');
  await phoneCell.click();await page.keyboard.press('Enter');await phoneCell.locator('.worksheet-editor').fill('010 7777 0001');await page.keyboard.press('Enter');
  const emailCell=page.locator('#applicantWorksheet tr[data-applicant-id="'+id+'"] [data-field="email"]');
  await emailCell.click();await emailCell.evaluate(cell=>{const data=new DataTransfer();data.setData('text/plain','worksheet@example.invalid\t 가상지역 ');cell.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  let staged=await page.evaluate(id=>({row:applicants.find(item=>item.id===id),storage:localStorage.getItem('recruit_erp_applicants_stable'),dirty:window.erpApplicantWorksheet.state.dirty.size,undo:window.erpApplicantWorksheet.state.history.undo.length,redo:window.erpApplicantWorksheet.state.history.redo.length}),id);
  assert.equal(staged.row.name,'테스트지원자1');assert.equal(staged.storage,before.storage);assert.deepEqual({dirty:staged.dirty,undo:staged.undo,redo:staged.redo},{dirty:4,undo:3,redo:0});
  assert.equal(bridgePuts,0,'저장 전에는 Bridge PUT을 호출하면 안 됩니다.');

  await emailCell.click();await page.keyboard.press('Control+z');
  assert.deepEqual(await page.evaluate(()=>({dirty:window.erpApplicantWorksheet.state.dirty.size,undo:window.erpApplicantWorksheet.state.history.undo.length,redo:window.erpApplicantWorksheet.state.history.redo.length})),{dirty:2,undo:2,redo:1},'붙여넣기 전체가 한 번에 실행 취소되어야 합니다.');
  await page.keyboard.press('Control+y');
  assert.deepEqual(await page.evaluate(()=>({dirty:window.erpApplicantWorksheet.state.dirty.size,undo:window.erpApplicantWorksheet.state.history.undo.length,redo:window.erpApplicantWorksheet.state.history.redo.length})),{dirty:4,undo:3,redo:0},'붙여넣기 전체가 한 번에 다시 실행되어야 합니다.');

  const memoCell=page.locator('#applicantWorksheet tr[data-applicant-id="'+id+'"] [data-field="memo"]');
  await memoCell.click();await page.keyboard.press('Enter');await memoCell.locator('.worksheet-editor').fill('가상 입력 중');const historyBeforeNative=await page.evaluate(()=>window.erpApplicantWorksheet.state.history.undo.length);await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(()=>window.erpApplicantWorksheet.state.history.undo.length),historyBeforeNative,'편집기 내부 Ctrl+Z는 전역 undo로 처리하면 안 됩니다.');await page.keyboard.press('Escape');

  await page.evaluate(id=>window.erpApplicantWorksheet.setDirty(id,'phone','010-12'),id);
  assert.equal(await page.locator('.worksheet-review-block.is-error').isVisible(),true);assert.equal(await page.locator('#btnWorksheetSave').isDisabled(),true);
  assert.equal(await page.locator('#applicantWorksheet img').count(),0);await page.screenshot({path:path.join(outputDir,label+'-applicant-worksheet-errors.png'),fullPage:false});
  await page.locator('.worksheet-review-item.is-error').first().click();assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.field),'phone');
  await page.locator('#btnWorksheetUndo').click();

  const otherPhone=await page.evaluate(otherId=>applicants.find(item=>item.id===otherId).phone,otherId);
  await page.evaluate(({id,phone})=>window.erpApplicantWorksheet.setDirty(id,'phone',phone),{id,phone:otherPhone});
  assert.ok(await page.locator('.worksheet-review-block.is-duplicate').count()>0,'기존 지원자와 같은 연락처는 중복 후보여야 합니다.');
  assert.equal(await page.locator('#btnWorksheetSave').isDisabled(),true,'중복 확인 전에는 저장을 차단해야 합니다.');
  await page.screenshot({path:path.join(outputDir,label+'-applicant-worksheet-duplicates.png'),fullPage:false});
  await page.locator('#btnWorksheetConfirmDuplicates').click();assert.equal(await page.locator('#btnWorksheetSave').isEnabled(),true);

  const stateBeforeReview=await page.evaluate(()=>({dirty:window.erpApplicantWorksheet.state.dirty.size,undo:window.erpApplicantWorksheet.state.history.undo.length}));
  await page.locator('#btnWorksheetSave').click();await page.locator('#applicantWorksheetReview:not([hidden])').waitFor();await page.screenshot({path:path.join(outputDir,label+'-applicant-worksheet-final-review.png'),fullPage:false});
  const duplicateReview=await page.locator('#applicantWorksheetReviewSummary>div').nth(3).evaluate(card=>{const strong=card.querySelector('strong'),children=[...strong.children].map(node=>{const rect=node.getBoundingClientRect();return{text:node.textContent.trim(),top:Math.round(rect.top),width:rect.width,scrollWidth:node.scrollWidth};});return{text:strong.innerText.replace(/\s+/g,' ').trim(),lines:new Set(children.map(child=>child.top)).size,children};});
  assert.equal(duplicateReview.text,'중복 후보 1건 · 확인 완료','최종 확인의 네 번째 카드는 중복 후보 건수와 확인 상태를 함께 보여야 합니다.');assert.ok(duplicateReview.lines<=2&&duplicateReview.children.every(child=>child.scrollWidth<=child.width+1),`${label} 중복 확인 문구가 낱말 단위로 3줄 이상 갈라졌습니다: ${JSON.stringify(duplicateReview)}`);
  await page.locator('#btnWorksheetReviewCancel').click();
  assert.deepEqual(await page.evaluate(()=>({dirty:window.erpApplicantWorksheet.state.dirty.size,undo:window.erpApplicantWorksheet.state.history.undo.length})),stateBeforeReview,'최종 확인 취소는 dirty와 히스토리를 유지해야 합니다.');

  await page.evaluate(()=>{window.__worksheetRealSave=window.save;window.__worksheetSaveCalls=0;window.save=function(){window.__worksheetSaveCalls++;return window.__worksheetRealSave();};});
  await page.locator('#btnWorksheetSave').click();await page.locator('#applicantWorksheetReview:not([hidden])').waitFor();await page.locator('#btnWorksheetReviewConfirm').click();await page.waitForFunction(()=>window.erpApplicantWorksheet.state.dirty.size===0);
  const saved=await page.evaluate(id=>{const result={calls:window.__worksheetSaveCalls,row:applicants.find(item=>item.id===id),stored:JSON.parse(localStorage.getItem('recruit_erp_applicants_stable')).find(item=>item.id===id),undo:window.erpApplicantWorksheet.state.history.undo.length,redo:window.erpApplicantWorksheet.state.history.redo.length};window.save=window.__worksheetRealSave;delete window.__worksheetRealSave;return result;},id);
  assert.equal(saved.calls,1,'워크시트 저장은 기존 save를 정확히 한 번만 호출해야 합니다.');assert.equal(saved.row.name,'가상워크시트수정');assert.equal(saved.row.phone,otherPhone);assert.equal(saved.row.email,'worksheet@example.invalid');assert.equal(saved.row.region,'가상지역');assert.equal(saved.stored.name,'가상워크시트수정');assert.deepEqual({undo:saved.undo,redo:saved.redo},{undo:0,redo:0});
  const bridgePutsAfterSuccess=bridgePuts;

  await page.evaluate(id=>{window.erpApplicantWorksheet.setDirty(id,'region','가상실패지역');window.__worksheetFailureBefore=JSON.stringify(applicants);window.__worksheetFailureStorage=localStorage.getItem('recruit_erp_applicants_stable');window.__worksheetHistoryBefore=window.erpApplicantWorksheet.state.history.undo.length;window.__worksheetRealSave=window.save;window.__worksheetSaveCalls=0;window.save=()=>{window.__worksheetSaveCalls++;return false;};},id);
  await page.locator('#btnWorksheetSave').click();await page.locator('#btnWorksheetReviewConfirm').click();
  const failed=await page.evaluate(()=>{const result={calls:window.__worksheetSaveCalls,memory:JSON.stringify(applicants)===window.__worksheetFailureBefore,storage:localStorage.getItem('recruit_erp_applicants_stable')===window.__worksheetFailureStorage,dirty:window.erpApplicantWorksheet.state.dirty.size,history:window.erpApplicantWorksheet.state.history.undo.length===window.__worksheetHistoryBefore};window.save=window.__worksheetRealSave;delete window.__worksheetRealSave;return result;});
  assert.deepEqual(failed,{calls:1,memory:true,storage:true,dirty:1,history:true},'저장 실패는 전체 원상복구하고 dirty·히스토리를 유지해야 합니다.');
  assert.equal(bridgePuts,bridgePutsAfterSuccess,'저장 실패 중 추가 Bridge PUT이 발생하면 안 됩니다.');

  await page.evaluate(id=>window.erpApplicantWorksheet.setDirty(id,'name','<img src=x onerror=alert(1)>'),id);
  assert.equal(await page.locator('#applicantWorksheet img').count(),0,'사용자 문자열이 HTML 요소로 실행되면 안 됩니다.');
  assert.ok((await page.locator('#applicantWorksheet tr[data-applicant-id="'+id+'"] [data-field="name"]').innerText()).includes('<img src=x onerror=alert(1)>'));

  await page.locator('#btnApplicantNormalView').click();await page.locator('#applicantWorksheetGuard:not([hidden])').waitFor();await page.locator('#btnWorksheetGuardStay').click();assert.equal(await page.locator('#applicantWorksheet').isVisible(),true,'계속 편집은 워크시트와 변경목록을 유지해야 합니다.');
  await page.locator('#btnApplicantNormalView').click();await page.locator('#btnWorksheetGuardDiscard').click();await page.waitForFunction(()=>window.erpApplicantWorksheet.state.dirty.size===0);assert.equal(await page.locator('#applicantTbody').isVisible(),true,'변경 취소 뒤 일반보기를 열어야 합니다.');
  await page.locator('#btnApplicantWorksheetView').click();
  const viewer=await page.evaluate(id=>{window.__worksheetRealHas=window.erpPermissions.has;window.erpPermissions.has=permission=>permission==='applicant.write'?false:window.__worksheetRealHas(permission);document.dispatchEvent(new CustomEvent('erp:permission-change'));return {changed:window.erpApplicantWorksheet.setDirty(id,'memo','금지'),undo:window.erpApplicantWorksheet.undo(),redo:window.erpApplicantWorksheet.redo(),duplicate:window.erpApplicantWorksheet.confirmDuplicates(),save:window.erpApplicantWorksheet.save(),dirty:window.erpApplicantWorksheet.state.dirty.size};},id);
  assert.deepEqual(viewer,{changed:false,undo:false,redo:false,duplicate:false,save:false,dirty:0});assert.equal(await page.locator('#btnWorksheetSave').isDisabled(),true,'조회 전용은 워크시트 저장을 사용할 수 없어야 합니다.');assert.equal(await page.locator('#btnWorksheetUndo').isDisabled(),true);assert.equal(await page.locator('#btnWorksheetRedo').isDisabled(),true);
  await page.evaluate(()=>{window.erpPermissions.has=window.__worksheetRealHas;delete window.__worksheetRealHas;document.dispatchEvent(new CustomEvent('erp:permission-change'));});

  const unchanged=await page.evaluate(baseline=>({employees:JSON.stringify(employees)===baseline.employees,schools:JSON.stringify(schools)===baseline.schools,events:(typeof calendarEvents==='undefined'?'':JSON.stringify(calendarEvents))===baseline.events}),before);
  assert.deepEqual(unchanged,{employees:true,schools:true,events:true});
  page.off('request',bridgeListener);
  await restoreFixture();
}
async function verifyHireWaitingGrid(page,label,{mobile=false}={}){
  await page.evaluate(()=>window.openHireWaitingList?.('2026-08-06'));
  await page.locator('#hireWaitingModal.show').waitFor();
  await page.waitForTimeout(120);
  const initial=await page.evaluate(({keys,widths})=>{
    const wrap=document.querySelector('.hire-waiting-table-wrap'),table=document.querySelector('#hireWaitingTable'),row=document.querySelector('#hireWaitingBody tr[data-applicant-id]');
    const headers=[...table.querySelectorAll('thead th')],cells=row?[...row.querySelectorAll('td')]:[];
    const widthMap=Object.fromEntries(keys.map(key=>[key,{header:table.querySelector(`thead [data-col-key="${key}"]`)?.getBoundingClientRect().width||0,cell:row?.querySelector(`[data-col-key="${key}"]`)?.getBoundingClientRect().width||0,expected:widths[key]}]));
    return{headerKeys:headers.map(node=>node.dataset.colKey),cellKeys:cells.map(node=>node.dataset.colKey),widthMap,table:{rect:table.getBoundingClientRect().width,style:getComputedStyle(table).width,min:getComputedStyle(table).minWidth,layout:getComputedStyle(table).tableLayout},internalScroll:wrap.scrollWidth>wrap.clientWidth,overflow:getComputedStyle(wrap).overflowX,bodyOverflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,values:Object.fromEntries(['no','employeeNo','name'].map(key=>[key,row?.querySelector(`[data-col-key="${key}"]`)?.innerText||row?.querySelector(`[data-col-key="${key}"] input`)?.value||'']))};
  },{keys:hireWaitingKeys,widths:hireWaitingWidths});
  assert.deepEqual(initial.headerKeys,hireWaitingKeys,`${label} 입사대기 헤더 의미 키 23개가 순서대로 필요합니다.`);
  assert.deepEqual(initial.cellKeys,hireWaitingKeys,`${label} 입사대기 본문 의미 키 23개가 순서대로 필요합니다.`);
  Object.entries(initial.widthMap).forEach(([key,value])=>{assert.ok(Math.abs(value.header-value.expected)<=2&&Math.abs(value.cell-value.expected)<=2,`${label} ${key} 열 너비 불일치: ${JSON.stringify({value,table:initial.table,widthMap:initial.widthMap})}`);assert.ok(Math.abs(value.header-value.cell)<=1,`${label} ${key} 헤더/본문 너비 불일치`);});
  assert.ok(initial.internalScroll&&initial.overflow!=='visible',`${label} 입사대기 표는 팝업 내부에서 가로 스크롤되어야 합니다.`);
  assert.ok(initial.bodyOverflow<=1,`${label} 입사대기 팝업이 페이지 본문을 가로로 넘기면 안 됩니다.`);
  await page.locator('.hire-waiting-table-wrap').evaluate(node=>{node.scrollLeft=1100;});await page.waitForTimeout(40);
  const scrolled=await page.evaluate(({mobile,values})=>{
    const wrap=document.querySelector('.hire-waiting-table-wrap'),row=document.querySelector('#hireWaitingBody tr[data-applicant-id]'),modal=document.querySelector('.hire-waiting-modal-card'),footer=document.querySelector('.hire-waiting-statusbar');
    const box=key=>{const cell=row.querySelector(`[data-col-key="${key}"]`),header=document.querySelector(`#hireWaitingTable thead [data-col-key="${key}"]`),r=cell.getBoundingClientRect(),h=header.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width,headerLeft:h.left,headerWidth:h.width,position:getComputedStyle(cell).position,value:cell.innerText||cell.querySelector('input')?.value||''};};
    const readable=Object.fromEntries(['name','email','school','major','phone','region'].map(key=>{const span=row.querySelector(`[data-col-key="${key}"] span`),style=getComputedStyle(span);return[key,{ellipsis:style.textOverflow,whiteSpace:style.whiteSpace,text:span.textContent}];}));
    const modalRect=modal.getBoundingClientRect(),footerRect=footer.getBoundingClientRect(),wrapRect=wrap.getBoundingClientRect();
    return{mobile,width:innerWidth,scrollLeft:wrap.scrollLeft,wrapLeft:wrapRect.left,no:box('no'),employeeNo:box('employeeNo'),name:box('name'),readable,values,stickyValues:Object.fromEntries(['no','employeeNo','name'].map(key=>[key,box(key).value])),stickyArea:box('name').right-wrapRect.left,modal:{left:modalRect.left,right:modalRect.right,top:modalRect.top,bottom:modalRect.bottom},footer:{left:footerRect.left,right:footerRect.right,top:footerRect.top,bottom:footerRect.bottom},viewport:{width:innerWidth,height:innerHeight},residentTitle:row.querySelector('[data-col-key="residentNumber"]')?.getAttribute('title')||row.querySelector('[data-col-key="residentNumber"] input')?.getAttribute('title')||''};
  },{mobile,values:initial.values});
  assert.deepEqual(scrolled.stickyValues,initial.values,`${label} 가로 스크롤 뒤 고정 열의 같은 행 값이 유지되어야 합니다.`);
  assert.equal(scrolled.no.position,'sticky',`${label} NO 열은 고정되어야 합니다.`);assert.equal(scrolled.name.position,'sticky',`${label} 성명 열은 고정되어야 합니다.`);
  assert.ok(Math.abs(scrolled.no.left-scrolled.no.headerLeft)<=1&&Math.abs(scrolled.name.left-scrolled.name.headerLeft)<=1,`${label} 고정 헤더와 본문 위치가 맞아야 합니다.`);
  assert.ok(scrolled.scrollLeft>100,`${label} 실제 가로 스크롤 뒤 고정 열을 검사해야 합니다.`);assert.ok(Math.abs(scrolled.no.left-scrolled.wrapLeft)<=1,`${label} NO 열은 표 왼쪽에 맞아야 합니다.`);
  if(mobile){assert.notEqual(scrolled.employeeNo.position,'sticky',`${label} 모바일에서는 사원번호 고정을 해제해야 합니다.`);assert.ok(Math.abs(scrolled.name.left-scrolled.no.right)<=1,`${label} 모바일 NO·성명 열이 빈틈이나 겹침 없이 맞아야 합니다.`);assert.ok(scrolled.stickyArea<=scrolled.width*.6,`${label} 모바일 고정 영역은 화면의 60% 이하여야 합니다: ${scrolled.stickyArea}/${scrolled.width}`);}
  else{assert.equal(scrolled.employeeNo.position,'sticky',`${label} 데스크톱 사원번호 열은 고정되어야 합니다.`);assert.ok(Math.abs(scrolled.employeeNo.left-scrolled.no.right)<=1&&Math.abs(scrolled.name.left-scrolled.employeeNo.right)<=1,`${label} 데스크톱 고정 열이 빈틈이나 겹침 없이 맞아야 합니다: ${JSON.stringify(scrolled)}`);}
  Object.entries(scrolled.readable).forEach(([key,value])=>{assert.notEqual(value.ellipsis,'ellipsis',`${label} ${key} 값은 말줄임표로 숨기면 안 됩니다.`);assert.notEqual(value.whiteSpace,'nowrap',`${label} ${key} 긴 값은 줄바꿈으로 확인할 수 있어야 합니다.`);assert.ok(value.text.length>0);});
  assert.equal(scrolled.residentTitle,'','주민등록번호 셀에 값이 노출될 수 있는 title/tooltip을 두면 안 됩니다.');
  assert.ok(scrolled.modal.left>=-1&&scrolled.modal.right<=scrolled.viewport.width+1&&scrolled.modal.top>=-1&&scrolled.modal.bottom<=scrolled.viewport.height+1,`${label} 입사대기 팝업 잘림: ${JSON.stringify(scrolled.modal)}`);
  assert.ok(scrolled.footer.left>=scrolled.modal.left-1&&scrolled.footer.right<=scrolled.modal.right+1&&scrolled.footer.bottom<=scrolled.modal.bottom+1,`${label} 상태·저장 버튼 영역이 팝업 밖으로 나가면 안 됩니다.`);
  await page.screenshot({path:path.join(outputDir,`${label}-hire-waiting-grid.png`),fullPage:false});
  const employeeInput=page.locator('#hireWaitingBody [data-hire-field="employeeNo"]').first();await employeeInput.focus();
  const focusState=await employeeInput.evaluate(input=>({cell:input.closest('td').matches(':focus-within'),row:input.closest('tr').matches(':focus-within'),shadow:getComputedStyle(input.closest('td')).boxShadow}));
  assert.ok(focusState.cell&&focusState.row&&focusState.shadow!=='none',`${label} 현재 셀과 행 포커스 강조가 필요합니다.`);
  const group=page.locator('#hireWaitingBody [data-hire-field="groupName"]').first();await group.fill('');await page.evaluate(()=>validateHireWaitingGrid());assert.ok(await group.evaluate(input=>input.classList.contains('is-missing')),'빈 권장 입력은 기존 보완 필요 표시를 유지해야 합니다.');await group.fill('가상부서');
  const resident=page.locator('#hireWaitingBody [data-hire-field="residentNumber"]').first();await resident.fill('123');await page.evaluate(()=>validateHireWaitingGrid());assert.deepEqual(await resident.evaluate(input=>({invalid:input.classList.contains('is-invalid'),aria:input.getAttribute('aria-invalid'),title:input.getAttribute('title')})),{invalid:true,aria:'true',title:null},'주민등록번호 오류는 값 노출 가능성이 있는 tooltip 없이 접근성 상태로 표시해야 합니다.');await resident.fill('000000-0000000');await page.evaluate(()=>validateHireWaitingGrid());
  await page.evaluate(()=>closeHireWaitingList(true));
}

async function verifyRecruiterDailyUsability(page,label,{exerciseQuick=false}={}){
  await page.evaluate(rows=>{window.__v115OriginalApplicants=applicants;applicants=rows.map(row=>({...row}));resetListFiltersToAll();renderAll();},denseApplicants);
  const shared=await page.evaluate(()=>{
    const selection=window.dailyWorkflowSelection();
    window.setPage('home');
    const homeFirst=document.querySelector('#priorityList [data-home-applicant-id]')?.dataset.homeApplicantId||'';
    window.setPage('today');
    const todayFirst=document.querySelector('#dailyWorkflowList [data-applicant-id]')?.dataset.applicantId||'';
    const panel=document.querySelector('.daily-workflow-panel').getBoundingClientRect(),summary=document.querySelector('.daily-automation-summary').getBoundingClientRect(),metrics=document.querySelector('.daily-workflow-metrics').getBoundingClientRect();
    const first=document.querySelector('#dailyWorkflowList .daily-work-item');
    return {selectorFirst:selection.rows[0]?.applicant.id||'',homeFirst,todayFirst,panelTop:panel.top,summaryTop:summary.top,metricsTop:metrics.top,summaryVisible:summary.top<innerHeight,metricsVisible:metrics.top<innerHeight,rowText:first?.innerText||'',rows:document.querySelectorAll('#dailyWorkflowList .daily-work-item').length,overflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth};
  });
  assert.ok(shared.selectorFirst&&shared.homeFirst===shared.selectorFirst&&shared.todayFirst===shared.selectorFirst,`${label} 홈과 오늘 업무의 첫 대상이 공통 선택기와 같아야 합니다: ${JSON.stringify(shared)}`);
  assert.ok(shared.summaryTop<shared.metricsTop&&shared.metricsTop<shared.panelTop&&shared.summaryVisible&&shared.metricsVisible&&shared.rows>0,`${label} 오늘 요약·KPI가 처리 목록보다 먼저 보여야 합니다: ${JSON.stringify(shared)}`);
  assert.ok(shared.rowText.includes('추천 다음 작업')&&shared.overflow<=1,`${label} 오늘 실행 행의 다음 작업 또는 화면 폭이 잘못되었습니다: ${JSON.stringify(shared)}`);
  await page.screenshot({path:path.join(outputDir,`${label}-today-first-screen.png`),fullPage:false});

  await page.evaluate(()=>window.setPage('applicants'));
  await page.locator('#searchInput').fill('가상');await page.locator('#sortSelect').selectOption('nameAsc');await page.locator('#workplaceTabs [data-workplace="천안"]').click();
  const beforeToggle=await page.evaluate(()=>({search:currentSearch,sort:currentSort,workplace:currentWorkplace,filter:currentFilter,page:currentApplicantPage}));
  await page.locator('.applicant-auxiliary-filters summary').click();
  const afterToggle=await page.evaluate(()=>({search:currentSearch,sort:currentSort,workplace:currentWorkplace,filter:currentFilter,page:currentApplicantPage}));
  assert.deepEqual(afterToggle,beforeToggle,`${label} 보조 조건 접기는 조회 상태를 바꾸면 안 됩니다.`);
  await page.locator('.applicant-auxiliary-filters summary').click();
  await page.locator('#quickFilters [data-filter="todayAction"]').click();
  assert.equal(await page.evaluate(()=>currentFilter),'todayAction',`${label} 오늘 조치 고정 프리셋이 적용되어야 합니다.`);

  await page.evaluate(()=>window.setPage('form'));await page.waitForTimeout(30);
  const formSizing=await page.evaluate(()=>({
    labels:[...document.querySelectorAll('#form .resume-input-grid label')].filter(node=>node.getClientRects().length).map(node=>parseFloat(getComputedStyle(node).fontSize)),
    controls:[...document.querySelectorAll('#form .resume-input-grid input,#form .resume-input-grid select,#form .resume-input-grid textarea')].filter(node=>node.getClientRects().length).map(node=>node.getBoundingClientRect().height),
    optionalCollapsed:document.querySelector('[data-form-step="2"]')?.classList.contains('is-collapsed'),
    statusVisible:!!document.querySelector('[data-form-step="2"] [data-form-step-status]')?.getClientRects().length
  }));
  const minimumLabel=innerWidthForLabel(label)<=700?13:12,minimumControl=innerWidthForLabel(label)<=700?44:40;
  assert.ok(formSizing.labels.length&&formSizing.labels.every(size=>size>=minimumLabel),`${label} 상세 폼 라벨 크기 부족: ${JSON.stringify(formSizing)}`);
  assert.ok(formSizing.controls.length&&formSizing.controls.every(size=>size>=minimumControl),`${label} 상세 폼 컨트롤 높이 부족: ${JSON.stringify(formSizing)}`);
  assert.ok(formSizing.optionalCollapsed&&formSizing.statusVisible,`${label} 선택 입력 영역은 접혀도 상태 배지가 보여야 합니다.`);

  await page.evaluate(()=>window.setPage('home'));await page.locator('#btnQuickApplicantEntry').click();
  const quickBounds=await page.locator('.applicant-quick-entry-card').evaluate(card=>{const rect=card.getBoundingClientRect();return{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,width:innerWidth,height:innerHeight,active:document.activeElement?.id};});
  assert.ok(quickBounds.left>=-1&&quickBounds.right<=quickBounds.width+1&&quickBounds.top>=-1&&quickBounds.bottom<=quickBounds.height+1&&quickBounds.active==='quickEntryName',`${label} 빠른 등록 팝업 잘림 또는 최초 포커스 오류: ${JSON.stringify(quickBounds)}`);
  await page.screenshot({path:path.join(outputDir,`${label}-quick-entry.png`),fullPage:false});await page.locator('[data-quick-entry-close]').last().click();

  if(exerciseQuick){
    await page.evaluate(()=>{window.setPage('home');window.__v115RealSave=window.save;window.__v115SaveCalls=0;window.save=function(){window.__v115SaveCalls++;return true;};});
    await page.locator('#btnQuickApplicantEntry').click();await page.locator('#quickEntryName').fill('');await page.locator('#btnQuickEntrySave').click();
    assert.equal(await page.evaluate(()=>window.__v115SaveCalls),0,'필수값 오류는 저장을 호출하면 안 됩니다.');
    await page.locator('#quickEntryName').fill('가상중복확인');await page.locator('#quickEntryPhone').fill(denseApplicants[0].phone);await page.locator('#btnQuickEntrySave').click();
    assert.ok((await page.locator('#quickEntryDuplicate').innerText()).includes('중복 가능성'));assert.equal(await page.evaluate(()=>window.__v115SaveCalls),0,'중복 미확인은 저장을 호출하면 안 됩니다.');
    await page.locator('[data-quick-entry-close]').last().click();

    await page.locator('#btnQuickApplicantEntry').click();await page.locator('#quickEntryName').fill('가상빠른등록성공');await page.locator('#quickEntryPhone').fill('010-7777-7777');
    page.once('dialog',dialog=>dialog.accept());await page.locator('#btnQuickEntrySave').click();await page.locator('#applicantQuickDetail.is-open').waitFor();
    assert.equal(await page.evaluate(()=>window.__v115SaveCalls),1,'빠른 등록 성공은 기존 save()를 정확히 한 번 호출해야 합니다.');await page.keyboard.press('Escape');

    const failureBaseline=await page.evaluate(()=>{window.__v115FailureApplicants=JSON.stringify(applicants);window.__v115FailureStorage=localStorage.getItem(STORAGE_KEY);window.save=function(){window.__v115SaveCalls++;localStorage.setItem(STORAGE_KEY,'synthetic-corrupt');return false;};return{count:applicants.length,storage:window.__v115FailureStorage};});
    await page.locator('#btnQuickApplicantEntry').click();await page.locator('#quickEntryName').fill('가상저장실패');await page.locator('#quickEntryMemo').fill('실패 후 유지할 입력');page.once('dialog',dialog=>dialog.accept());await page.locator('#btnQuickEntrySave').click();
    const failed=await page.evaluate(()=>({count:applicants.length,memory:JSON.stringify(applicants)===window.__v115FailureApplicants,storage:localStorage.getItem(STORAGE_KEY),name:document.getElementById('quickEntryName').value,memo:document.getElementById('quickEntryMemo').value,open:window.erpApplicantQuickEntry.state.open}));
    assert.deepEqual({count:failed.count,memory:failed.memory,storage:failed.storage},{count:failureBaseline.count,memory:true,storage:failureBaseline.storage},'저장 실패 시 메모리와 브라우저 저장값을 원상복구해야 합니다.');
    assert.ok(failed.open&&failed.name==='가상저장실패'&&failed.memo==='실패 후 유지할 입력','저장 실패 뒤 입력과 오류 화면을 유지해야 합니다.');
    await page.locator('[data-quick-entry-close]').last().click();
    const viewerBlocked=await page.evaluate(()=>{const real=window.erpPermissions.has;window.erpPermissions.has=permission=>permission==='applicant.write'?false:real(permission);const result=window.erpApplicantQuickEntry.open();window.erpPermissions.has=real;return result;});
    assert.equal(viewerBlocked,false,'조회 전용의 빠른 등록 직접 호출을 차단해야 합니다.');
    await page.evaluate(()=>{window.save=window.__v115RealSave;delete window.__v115RealSave;delete window.__v115SaveCalls;applicants=window.__v115OriginalApplicants;delete window.__v115OriginalApplicants;delete window.__v115FailureApplicants;delete window.__v115FailureStorage;resetListFiltersToAll();renderAll();});
  }else await page.evaluate(()=>{applicants=window.__v115OriginalApplicants;delete window.__v115OriginalApplicants;resetListFiltersToAll();renderAll();});
}
async function verifyProductionGateContentSafety(page,label){
  await page.evaluate(()=>{
    window.__v1151Snapshot={
      applicants,employees,profiles:hireWaitingProfiles,save:window.save,fetch:window.fetch,
      applicantStorage:localStorage.getItem('recruit_erp_applicants_stable'),employeeStorage:localStorage.getItem('recruit_erp_employees'),profileStorage:localStorage.getItem('recruit_erp_hire_waiting_profiles')
    };
    window.__v1151SaveCalls=0;window.__v1151FetchCalls=0;window.__v1151Copied='';
    window.save=function(){window.__v1151SaveCalls++;return true;};
    window.fetch=function(...args){window.__v1151FetchCalls++;return window.__v1151Snapshot.fetch(...args);};
    applicants=[];employees=[];hireWaitingProfiles=[];window.setPage('onboarding');window.erpOnboarding.render();
  });
  const empty=page.locator('#onboarding .onboarding-empty-state');await empty.waitFor();
  assert.ok((await empty.innerText()).includes('최종합격 처리된 지원자가 여기에 표시됩니다.'));
  const move=empty.locator('[data-onboarding-go-applicants]');assert.equal(await move.innerText(),'지원자 목록으로 이동');await move.focus();await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'applicants','온보딩 빈 상태 버튼은 기존 지원자 목록 경로로 이동해야 합니다.');
  const emptySafety=await page.evaluate(snapshot=>({saveCalls:window.__v1151SaveCalls,applicantStorage:localStorage.getItem('recruit_erp_applicants_stable')===snapshot.applicantStorage,employeeStorage:localStorage.getItem('recruit_erp_employees')===snapshot.employeeStorage,profileStorage:localStorage.getItem('recruit_erp_hire_waiting_profiles')===snapshot.profileStorage}),await page.evaluate(()=>window.__v1151Snapshot));
  assert.deepEqual(emptySafety,{saveCalls:0,applicantStorage:true,employeeStorage:true,profileStorage:true},'빈 상태 이동은 업무 저장소나 save를 호출하면 안 됩니다.');

  await page.evaluate(()=>{
    window.setPage('templates');
    const clipboard={writeText:async value=>{window.__v1151Copied=String(value);}};
    try{Object.defineProperty(navigator,'clipboard',{configurable:true,value:clipboard});}catch{navigator.clipboard.writeText=clipboard.writeText;}
    document.getElementById('messageTemplateBody').value='가상 안내문 전용 문장';
  });
  assert.equal(await page.locator('#btnCopyMessageTemplate').innerText(),'문자 내용 복사');await page.locator('#btnCopyMessageTemplate').click();
  await page.waitForFunction(()=>document.body.innerText.includes('복사됨 · 알리고에서 붙여넣으세요'));
  const copySafety=await page.evaluate(snapshot=>({copied:window.__v1151Copied,saveCalls:window.__v1151SaveCalls,fetchCalls:window.__v1151FetchCalls,applicantStorage:localStorage.getItem('recruit_erp_applicants_stable')===snapshot.applicantStorage,employeeStorage:localStorage.getItem('recruit_erp_employees')===snapshot.employeeStorage,profileStorage:localStorage.getItem('recruit_erp_hire_waiting_profiles')===snapshot.profileStorage}),await page.evaluate(()=>window.__v1151Snapshot));
  assert.deepEqual(copySafety,{copied:'가상 안내문 전용 문장',saveCalls:0,fetchCalls:0,applicantStorage:true,employeeStorage:true,profileStorage:true},'문자 복사는 clipboard 외 네트워크·Bridge·업무 저장을 호출하면 안 됩니다.');
  await page.screenshot({path:path.join(outputDir,`${label}-template-copy.png`),fullPage:false});
  await page.evaluate(()=>{const snapshot=window.__v1151Snapshot;applicants=snapshot.applicants;employees=snapshot.employees;hireWaitingProfiles=snapshot.profiles;window.save=snapshot.save;window.fetch=snapshot.fetch;delete window.__v1151Snapshot;delete window.__v1151SaveCalls;delete window.__v1151FetchCalls;delete window.__v1151Copied;renderAll();});
}
function innerWidthForLabel(label){return /^360x/.test(label)?360:/^390x/.test(label)?390:/^768x/.test(label)?768:/^1024x/.test(label)?1024:/^1280x/.test(label)?1280:1366;}

(async()=>{
  await new Promise((resolve,reject)=>{bridgeServer.once('error',reject);bridgeServer.listen(bridgePort,bridgeHost,resolve);});
  await waitForServer();
  const browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
  const consoleErrors=[];
  try{
    for(const viewport of viewports){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
      const page=await context.newPage();
      page.on('pageerror',error=>consoleErrors.push(`${viewport.name}: ${error.message}`));
      page.on('console',message=>{if(message.type()==='error'&&!/favicon/i.test(message.text()))consoleErrors.push(`${viewport.name}: ${message.text()}`);});
      await page.addInitScript(fixture=>{
        localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(fixture.applicants));
        localStorage.setItem('recruit_erp_hire_waiting_profiles',JSON.stringify(fixture.profiles));
        localStorage.setItem('recruit_erp_saved_advanced_searches',JSON.stringify(fixture.savedViews));
        localStorage.setItem('recruit_erp_ui_operation_environment','company');
      },{applicants:fakeApplicants,profiles:fakeHireWaitingProfiles,savedViews:savedAdvancedSearchFixture});
      await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForTimeout(800);
      assert.equal(await page.title(),'채용관리 시스템 v12.0.0');
      assert.equal(await page.evaluate(()=>window.erpAppVersion?.VERSION),'12.0.0','화면은 단일 현재 버전 소스를 사용해야 합니다.');
      assert.equal(await page.locator('#homeTodayGrid').count(),0,'홈의 중복 숫자 업무 카드는 제거되어야 합니다.');
      for(const screen of screens){
        await page.evaluate(id=>window.setPage?.(id),screen);await page.waitForTimeout(30);
        const layout=await page.evaluate(id=>({active:window.erpUx12Router.activePageId(),body:document.body.scrollWidth,html:document.documentElement.scrollWidth,width:innerWidth,hash:location.hash,expected:window.erpUx12Router.routeForPage(id)}),screen);
        assert.equal(layout.active,screen,`${viewport.name} ${screen} 화면 전환 실패`);
        assert.equal(layout.hash,layout.expected,`${viewport.name} ${screen} 고유 URL 라우트 복원 실패`);
        assert.ok(layout.body<=layout.width+1&&layout.html<=layout.width+1,`${viewport.name} ${screen} 본문 가로 넘침: ${layout.body}/${layout.html}/${layout.width}`);
      }
      const photoFree=await page.evaluate(()=>({applicantImages:document.querySelectorAll('#applicants img,#applicantQuickDetail img,.applicant-row .avatar-mini,#applicantQuickDetail .avatar-large').length,imageInputs:[...document.querySelectorAll('input[type="file"]')].filter(input=>/image/i.test(input.accept||'')).length}));
      assert.deepEqual(photoFree,{applicantImages:0,imageInputs:0},`${viewport.name} 지원자 목록·빠른 보기에는 사진·얼굴·인물 아바타·사진 업로드 필드가 없어야 합니다.`);
      const semanticBadges=await page.evaluate(()=>document.body.innerText);
      for(const oldBadge of ['v11.0.0 ONBOARDING','v11.0.0 ENCRYPTED','v11.0.0 STORAGE','v11.0.0 PRODUCTION','SCHOOL WORKFORCE · v11.1.0'])assert.ok(!semanticBadges.includes(oldBadge),`${viewport.name} 화면에 예전 제품형 배지가 남아 있습니다: ${oldBadge}`);
      if(viewport.width===768){
        await page.evaluate(()=>{window.setPage('home');window.scrollTo(0,0);});
        const topbar=await page.evaluate(()=>{
          const box=selector=>{const node=document.querySelector(selector),rect=node.getBoundingClientRect();return{selector,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,visible:!!node.getClientRects().length};};
          const items=[box('#page-title'),box('#btnPrivacyShield'),box('.local-mode-badge')];
          const overlap=(a,b)=>!(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom);
          return{items,width:innerWidth,overlaps:[[0,1],[0,2],[1,2]].filter(([a,b])=>overlap(items[a],items[b]))};
        });
        assert.ok(topbar.items.every(item=>item.visible&&item.left>=-1&&item.right<=topbar.width+1),`768 상단 제목·잠금·회사 배지가 잘렸습니다: ${JSON.stringify(topbar)}`);
        assert.deepEqual(topbar.overlaps,[],`768 상단 제목·잠금·회사 배지가 겹쳤습니다: ${JSON.stringify(topbar)}`);
        await page.screenshot({path:path.join(outputDir,'768x1024-topbar.png'),fullPage:false});
      }
      await page.evaluate(()=>window.setPage('schools'));await page.locator('#schoolSubTabs [data-schooltab="manage"]').click();await page.waitForTimeout(30);
      const schoolKpis=await page.locator('#schoolManageKpiGrid>.school-kpi-card').evaluateAll(cards=>cards.slice(0,4).map(card=>{const rect=card.getBoundingClientRect();return{left:Math.round(rect.left),top:Math.round(rect.top),width:Math.round(rect.width)};}));
      if(viewport.width>=1366){assert.equal(new Set(schoolKpis.map(card=>card.top)).size,1,`${viewport.name} 학교 앞 4개 KPI는 한 행이어야 합니다.`);assert.ok(Math.max(...schoolKpis.map(card=>card.width))-Math.min(...schoolKpis.map(card=>card.width))<=1,`${viewport.name} 학교 앞 4개 KPI 너비가 같아야 합니다.`);}
      if(viewport.width===768)assert.equal(new Set(schoolKpis.map(card=>card.top)).size,2,`768 학교 앞 4개 KPI는 2×2여야 합니다: ${JSON.stringify(schoolKpis)}`);
      if(viewport.width<=412)assert.equal(new Set(schoolKpis.map(card=>card.top)).size,4,`${viewport.name} 학교 KPI는 한 열이어야 합니다.`);
      if(viewport.width===1366){
        await page.evaluate(()=>window.setPage('stats'));await page.waitForTimeout(30);
        const statsToolbar=await page.locator('#stats>.stats-filter-panel').evaluate(panel=>{const style=getComputedStyle(panel),select=panel.querySelector('select').getBoundingClientRect(),note=panel.querySelector('.stats-filter-note').getBoundingClientRect();return{background:style.backgroundColor,height:panel.getBoundingClientRect().height,selectTop:select.top,noteTop:note.top};});
        assert.notEqual(statsToolbar.background,'rgb(10, 50, 117)','통계 근무지 도구막대는 진한 파란 배너가 아니어야 합니다.');assert.ok(statsToolbar.height<=70&&Math.abs(statsToolbar.selectTop-statsToolbar.noteTop)<=12,`통계 도구막대는 작고 설명이 선택 옆에 있어야 합니다: ${JSON.stringify(statsToolbar)}`);
        await page.screenshot({path:path.join(outputDir,'1366x768-stats-toolbar.png'),fullPage:false});
      }
      await verifyRecruiterDailyUsability(page,viewport.name,{exerciseQuick:viewport.width===1366});
      if(viewport.width===1366)await verifyProductionGateContentSafety(page,viewport.name);
      if(viewport.width===390||viewport.width===1366){
        await verifyHireWaitingGrid(page,viewport.name,{mobile:viewport.width===390});
        await page.evaluate(()=>window.setPage?.('today'));await page.waitForTimeout(80);
        const todayState=await page.evaluate(()=>({summary:document.querySelectorAll('.daily-automation-summary>div').length,hireLabel:document.querySelector('[data-daily-filter="hireUpcoming"]')?.textContent||'',rows:document.querySelectorAll('#dailyWorkflowList .daily-work-item').length,overflow:document.querySelector('#today').scrollWidth-document.querySelector('#today').clientWidth}));
        assert.equal(todayState.summary,4);assert.ok(todayState.hireLabel.includes('3일 내 입사')&&todayState.hireLabel.includes('D-3'));assert.ok(todayState.rows>=3);assert.ok(todayState.overflow<=1,`${viewport.name} 오늘 할 일 화면 가로 넘침: ${JSON.stringify(todayState)}`);
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-today-automation.png`),fullPage:true});
        await page.evaluate(()=>window.setPage?.('onboarding'));await page.waitForTimeout(80);
        const onboardingState=await page.evaluate(()=>({cards:document.querySelectorAll('#onboarding .onboarding-card').length,stages:document.querySelectorAll('#onboarding .onboarding-stage').length,text:document.querySelector('#onboarding')?.innerText||'',overflow:document.querySelector('#onboarding').scrollWidth-document.querySelector('#onboarding').clientWidth}));
        assert.ok(onboardingState.cards>=1&&onboardingState.stages===9);assert.ok(onboardingState.overflow<=1,`${viewport.name} 온보딩 화면 가로 넘침: ${JSON.stringify(onboardingState)}`);assert.ok(!onboardingState.text.includes('000000-0000000'),'온보딩 화면에 주민등록번호가 보이면 안 됩니다.');
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-onboarding.png`),fullPage:true});
        await page.evaluate(async()=>{window.setPage?.('storagePerformance');await window.erpStoragePerformance.mirrorAll();});
        await page.locator('#storagePerformanceBody .storage-metric-grid').waitFor();
        const storageState=await page.evaluate(()=>({active:document.querySelector('.page.active')?.id,count:document.querySelectorAll('#storagePerformanceBody .storage-metric-grid article').length,overflow:document.querySelector('#storagePerformance').scrollWidth-document.querySelector('#storagePerformance').clientWidth,mirror:document.querySelector('#storagePerformanceBody')?.innerText||''}));
        assert.equal(storageState.active,'storagePerformance');assert.equal(storageState.count,4);assert.ok(storageState.overflow<=1,`${viewport.name} 저장소 화면 가로 넘침: ${JSON.stringify(storageState)}`);assert.ok(storageState.mirror.includes('지원자')&&storageState.mirror.includes('3건'));
        assert.ok(storageState.mirror.includes('로컬 Bridge 연결 테스트'),'로컬 Bridge 연결 진단 버튼이 보여야 합니다.');
        assert.ok(storageState.mirror.includes('공용 ERP 저장소'),'공용 ERP 영구 저장 상태가 보여야 합니다.');
        if(viewport.width===390){
          const bridgeBefore=await page.evaluate(()=>{const values={...localStorage};delete values.recruit_erp_shared_storage_revision_meta_v1;return JSON.stringify(values);});
          await page.locator('#btnLocalBridgeTest').click();
          try{await page.locator('#bridgeTestResult.is-success').waitFor({timeout:7000});}
          catch(error){
            const diagnostic=await page.evaluate(async()=>{try{const response=await fetch('http://127.0.0.1:17840/health',{headers:{Accept:'application/json'}});return {status:response.status,text:await response.text(),result:document.querySelector('#bridgeTestResult')?.innerText||''};}catch(fetchError){return {error:String(fetchError),result:document.querySelector('#bridgeTestResult')?.innerText||''};}});
            throw new Error(`Bridge 브라우저 연결 실패: ${JSON.stringify(diagnostic)} / ${error.message}`);
          }
          const bridgeState=await page.evaluate(()=>{const values={...localStorage};delete values.recruit_erp_shared_storage_revision_meta_v1;return {after:JSON.stringify(values),result:document.querySelector('#bridgeTestResult')?.innerText||''};});
          assert.equal(bridgeState.after,bridgeBefore,'Bridge 연결 테스트는 localStorage를 변경하면 안 됩니다.');assert.ok(bridgeState.result.includes('ERP Bridge 연결 성공')&&bridgeState.result.includes('로컬 저장 프로그램과 ERP 통신이 가능합니다.'));
          page.once('dialog',dialog=>dialog.accept());await page.locator('#btnSharedStorageInitialize').click();
          await page.waitForFunction(()=>window.erpSharedStorage?.publicState?.().phase==='ready',null,{timeout:15000});
          await page.waitForFunction(()=>document.querySelector('.shared-storage-panel')?.innerText.includes('공용 ERP 연결됨'));
          const sharedState=await page.evaluate(()=>{const values={...localStorage};delete values.recruit_erp_shared_storage_revision_meta_v1;return {after:JSON.stringify(values),state:window.erpSharedStorage.publicState(),result:document.querySelector('.shared-storage-panel')?.innerText||''};});
          assert.equal(sharedState.after,bridgeBefore,'공용 저장소 초기화는 기존 localStorage 내용을 바꾸면 안 됩니다.');
          assert.ok(sharedState.result.includes('공용 ERP 연결됨')&&sharedState.state.revision===1);
          assert.equal(await page.locator('#btnSharedStorageInitialize').count(),0,'master 생성 후 초기화 버튼이 다시 보이면 안 됩니다.');
          assert.equal(await page.locator('#btnSharedStorageSave').count(),0,'정상 운영 화면에 반복 수동 저장 버튼을 표시하면 안 됩니다.');
          assert.equal(fs.readFileSync(bridgeExistingFile,'utf8'),'existing file must not change','공용폴더 기존 파일을 바꾸면 안 됩니다.');
          assert.deepEqual(fs.readdirSync(bridgeSharedFolder).sort(),['ERP_DATA','existing-company-file.txt']);
          const sharedMaster=fs.readFileSync(path.join(bridgeSharedFolder,'ERP_DATA','erp-data.json'),'utf8');
          assert.ok(!sharedMaster.includes('residentNumber')&&!/000000-?0000000/.test(sharedMaster),'공용 snapshot에 주민번호 필드와 값이 있으면 안 됩니다.');
        }
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-storage-performance.png`),fullPage:true});
        await page.evaluate(()=>window.setPage?.('backup'));await page.waitForTimeout(80);
        assert.ok(await page.locator('#bcEncryptedPanel').isVisible(),'암호화 백업이 기본 화면에 보여야 합니다.');
        assert.equal(await page.locator('.legacy-backup-details').getAttribute('open'),null,'평문 JSON은 기본적으로 접혀 있어야 합니다.');
        await page.locator('#bcEncryptedFull').focus();await page.locator('#bcEncryptedFull').click();await page.locator('#encryptedBackupDialog:not([hidden])').waitFor();await page.waitForFunction(()=>document.activeElement?.id==='encryptedBackupPassword');
        const modalLayout=await page.locator('.encrypted-backup-dialog').evaluate(dialog=>{const r=dialog.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,active:document.activeElement?.id};});
        assert.ok(modalLayout.left>=0&&modalLayout.right<=modalLayout.width&&modalLayout.top>=0&&modalLayout.bottom<=modalLayout.height,`${viewport.name} 암호화 비밀번호 팝업 잘림: ${JSON.stringify(modalLayout)}`);
        assert.equal(modalLayout.active,'encryptedBackupPassword');await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>document.querySelector('#encryptedBackupDialog').contains(document.activeElement)),'Tab 포커스가 암호화 팝업 안에 있어야 합니다.');
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-encrypted-backup-modal.png`),fullPage:false});await page.keyboard.press('Escape');await page.locator('#encryptedBackupDialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.activeElement?.id),'bcEncryptedFull','팝업을 닫으면 원래 버튼으로 포커스가 돌아가야 합니다.');
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-encrypted-backup-center.png`),fullPage:true});
        await page.evaluate(()=>window.setPage?.('productionReadiness'));await page.waitForTimeout(120);
        const readinessState=await page.evaluate(()=>({automatic:document.querySelectorAll('#productionReadiness .readiness-check').length,manual:document.querySelectorAll('#productionReadiness [data-readiness-manual]').length,text:document.querySelector('#productionReadiness')?.innerText||'',overflow:document.querySelector('#productionReadiness').scrollWidth-document.querySelector('#productionReadiness').clientWidth}));
        assert.deepEqual({automatic:readinessState.automatic,manual:readinessState.manual},{automatic:8,manual:7});assert.ok(readinessState.overflow<=1,`${viewport.name} 운영 준비 화면 가로 넘침: ${JSON.stringify(readinessState)}`);assert.ok(!/000000-0000000|010-0000-0001/.test(readinessState.text),'운영 준비 화면에 가상 개인정보 원문도 표시하면 안 됩니다.');
        assert.ok(readinessState.text.includes('v12.0.0 화면·브랜드·정적 파일 버전이 일치합니다.'),'운영 준비 화면이 v12.0.0 일치 결과를 보여야 합니다.');
        assert.equal(readinessState.text.split('Supabase Free 요금제 사용으로 Leaked Password Protection은 미사용.').length-1,1,'유출 비밀번호 요금제 제한 설명은 같은 화면에 한 번만 표시해야 합니다.');
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-production-readiness.png`),fullPage:true});
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
      await verifyApplicantQuickDetail(page,viewport.name,{exercise:viewport.width===1366});
      if(viewport.width===390||viewport.width===1366)await verifyApplicantMyViews(page,viewport.name,{exercise:viewport.width===1366});
      if([1280,1366,1440,1920].includes(viewport.width))await verifyApplicantNormalTableGeometry(page,viewport.name);
      if(viewport.width===390||viewport.width===360){
        await page.evaluate(()=>{resetListFiltersToAll();renderTable();const scroller=document.querySelector('.applicant-fixed-presets');if(scroller)scroller.scrollLeft=0;});
        const quickFilter=await page.evaluate(()=>{
          const button=document.querySelector('#quickFilters [data-filter="all"]'),label=button.querySelector('span:first-child'),container=document.querySelector('.applicant-fixed-presets');
          const b=button.getBoundingClientRect(),l=label.getBoundingClientRect(),c=container.getBoundingClientRect();
          const bs=getComputedStyle(button),cs=getComputedStyle(container);
          return{button:{left:b.left,right:b.right,width:b.width,marginLeft:bs.marginLeft,transform:bs.transform},label:{left:l.left,right:l.right,width:l.width},container:{left:c.left,right:c.right,width:c.width,scrollLeft:container.scrollLeft,scrollWidth:container.scrollWidth,justifyContent:cs.justifyContent,direction:cs.direction,transform:cs.transform},summaryStarts:[...document.querySelectorAll('#listSummary span')].map(node=>node.textContent.trim()).filter(text=>text.startsWith('·')),width:innerWidth};
        });
        assert.ok(quickFilter.button.left>=quickFilter.container.left-1&&quickFilter.button.right<=quickFilter.container.right+1&&quickFilter.label.width>0&&quickFilter.label.left>=quickFilter.button.left&&quickFilter.label.right<=quickFilter.button.right,`${viewport.name} 빠른필터 전체가 잘렸습니다: ${JSON.stringify(quickFilter)}`);
        assert.deepEqual(quickFilter.summaryStarts,[],`${viewport.name} 목록 요약의 새 줄이 ·로 시작하면 안 됩니다.`);
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-applicant-filters.png`),fullPage:false});
      }
      if(viewport.width>760){
        const columns=await page.locator('#applicants .no-head,#applicants .name-head,#applicants .phone-head').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,position:getComputedStyle(el).position}}));
        assert.equal(columns.length,3);assert.ok(columns.every(column=>column.position==='sticky'));for(let i=1;i<columns.length;i++)assert.ok(Math.abs(columns[i].left-columns[i-1].right)<=1,`${viewport.name} 지원자 NO·성명·연락처 고정 열 겹침: ${JSON.stringify(columns)}`);
        if(viewport.width<=1024){const tableScroll=await page.locator('#applicants .table-wrap').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,overflow:getComputedStyle(el).overflowX}));assert.ok(tableScroll.scroll>tableScroll.client&&tableScroll.overflow!=='visible','1024 목록은 표 내부에서 가로 스크롤되어야 합니다.');}
      }else{
        assert.notEqual(await page.locator('#applicants .applicant-row').first().evaluate(el=>getComputedStyle(el).display),'table-row','760 이하 지원자 목록은 카드형이어야 합니다.');
      }
      if(viewport.width===1366){await verifyUiDensity(page,viewport.name);await verifyUsabilityPolish(page,viewport.name);await verifyRoutingHistory(page,viewport.name);}
      if(viewport.width===390){
        await page.evaluate(()=>window.scrollTo(0,0));
        const mobileApplicantControls=await page.evaluate(()=>{
          const rect=selector=>{const value=document.querySelector(selector).getBoundingClientRect();return{left:value.left,right:value.right,width:value.width,height:value.height};};
          return{search:rect('#searchInput'),status:rect('#applicants .applicant-status-filter-group'),workplace:rect('#applicants .applicant-workplace-filter-group'),width:innerWidth};
        });
        assert.ok(mobileApplicantControls.search.width>=300&&mobileApplicantControls.search.height<=50,`390 지원자 검색창이 세로로 눌리거나 과도하게 늘어나면 안 됩니다: ${JSON.stringify(mobileApplicantControls)}`);
        assert.ok([mobileApplicantControls.status,mobileApplicantControls.workplace].every(group=>group.width>=300&&group.left>=-1&&group.right<=mobileApplicantControls.width+1),`390 상태·근무지 필터는 읽을 수 있는 한 열 너비를 유지해야 합니다: ${JSON.stringify(mobileApplicantControls)}`);
        await page.screenshot({path:path.join(outputDir,'390x844-applicants-normal.png'),fullPage:false});
      }
      if(viewport.width===390){
        await page.evaluate(()=>{window.setPage?.('home');window.scrollTo(0,0);});
        const mobileHomeBounds=await page.evaluate(()=>{const action=document.querySelector('.top-actions .primary').getBoundingClientRect(),kpi=document.querySelector('#statsGrid .ux12-summary-item').getBoundingClientRect();return{action:{left:action.left,right:action.right,top:action.top,bottom:action.bottom},kpi:{left:kpi.left,right:kpi.right,top:kpi.top,bottom:kpi.bottom},width:innerWidth,overlaps:!(action.right<=kpi.left||action.left>=kpi.right||action.bottom<=kpi.top||action.top>=kpi.bottom)};});
        assert.ok(mobileHomeBounds.action.left>=-1&&mobileHomeBounds.action.right<=mobileHomeBounds.width+1&&!mobileHomeBounds.overlaps,`390 홈 등록 버튼이 KPI와 겹치거나 잘리면 안 됩니다: ${JSON.stringify(mobileHomeBounds)}`);
        await page.locator('#sidebarToggle').click();assert.ok(await page.evaluate(()=>document.body.classList.contains('sidebar-mobile-open')));await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().left>=-1);
        const mobileNav=await page.evaluate(()=>{const sidebar=document.querySelector('.sidebar').getBoundingClientRect(),toggle=document.querySelector('.sidebar-status-toggle'),details=document.querySelector('.sidebar-status-details');return{heights:[...document.querySelectorAll('.nav-btn')].filter(node=>node.getClientRects().length).map(node=>node.getBoundingClientRect().height),stateAreas:document.querySelectorAll('[data-sidebar-status-area]').length,toggleVisible:!!toggle?.getClientRects().length,expanded:toggle?.getAttribute('aria-expanded'),detailsVisible:!!details?.getClientRects().length,sidebar:{left:sidebar.left,right:sidebar.right,top:sidebar.top,bottom:sidebar.bottom},width:innerWidth,height:innerHeight};});
        assert.ok(mobileNav.heights.length&&mobileNav.heights.every(height=>height>=44),'모바일 메뉴 버튼은 44px 이상이어야 합니다.');assert.equal(mobileNav.stateAreas,1);assert.deepEqual({toggleVisible:mobileNav.toggleVisible,expanded:mobileNav.expanded,detailsVisible:mobileNav.detailsVisible},{toggleVisible:true,expanded:'false',detailsVisible:false},'모바일 사이드바는 기본적으로 한 줄 상태 요약만 보여야 합니다.');assert.ok(mobileNav.sidebar.left>=-1&&mobileNav.sidebar.right<=mobileNav.width+1&&mobileNav.sidebar.top>=-1&&mobileNav.sidebar.bottom<=mobileNav.height+1,`모바일 메뉴가 화면 안에 보여야 합니다: ${JSON.stringify(mobileNav)}`);
        await page.locator('.sidebar-status-toggle').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.sidebar-status-toggle').getAttribute('aria-expanded'),'true','상태 상세 토글은 키보드로 펼쳐져야 합니다.');
        const systemAccessible=await page.evaluate(()=>{const nav=document.querySelector('.sidebar .nav'),button=document.querySelector('[data-page="storagePerformance"]');nav.scrollTop=nav.scrollHeight;const rect=button.getBoundingClientRect(),bounds=nav.getBoundingClientRect();return{visible:!!button.getClientRects().length,top:rect.top,bottom:rect.bottom,navTop:bounds.top,navBottom:bounds.bottom};});
        assert.ok(systemAccessible.visible&&systemAccessible.bottom<=systemAccessible.navBottom+1&&systemAccessible.top>=systemAccessible.navTop-1,`모바일 사이드바의 시스템 하단 메뉴에 접근할 수 있어야 합니다: ${JSON.stringify(systemAccessible)}`);
        await page.locator('.sidebar-status-toggle').focus();await page.keyboard.press('Enter');
        const homeStorageLabel=await page.evaluate(()=>{localStorage.setItem('recruit_erp_ui_operation_environment','home');document.documentElement.dataset.operationEnvironment='home';updateStorageNote();const text=document.querySelector('[data-sidebar-status-area]').innerText;localStorage.setItem('recruit_erp_ui_operation_environment','company');document.documentElement.dataset.operationEnvironment='company';updateStorageNote();return text;});
        assert.ok(!homeStorageLabel.includes('공용 ERP 저장소 확인 중'),'집 운영 모드에서 공용 저장소 확인 중으로 표시하면 안 됩니다.');
        await page.screenshot({path:path.join(outputDir,'390x844-mobile-menu.png'),fullPage:false});
        await page.locator('[data-page="today"]').click();assert.ok(!await page.evaluate(()=>document.body.classList.contains('sidebar-mobile-open')),'모바일 메뉴가 화면 이동 뒤 닫혀야 합니다.');
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
      if([1280,1366,1440,1920].includes(viewport.width))await verifyApplicantWorksheet(page,viewport.name,{exercise:viewport.width===1366});
      await page.evaluate(()=>window.setPage?.('home'));
      const homeFirst=page.locator('#priorityList .home-daily-work-item').first();
      if(await homeFirst.count()){await homeFirst.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'applicants');assert.equal(await page.locator('#applicantQuickDetail.is-open').count(),1);await page.keyboard.press('Escape');}
      if([390,1280,1366,1440,1920].includes(viewport.width)){
        await page.evaluate(()=>{window.setPage?.('home');window.scrollTo(0,0);});await page.waitForTimeout(30);
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-home.png`),fullPage:true});
      }
      if(viewport.width===390||viewport.width===1366){
        await openSchoolWorkforceFixture(page);
        const workforce=await page.evaluate(()=>{const card=document.querySelector('.school-workforce-card').getBoundingClientRect(),body=document.querySelector('.school-workforce-body'),text=document.querySelector('#schoolWorkforceModal').innerText,topElement=document.elementFromPoint(card.right-24,card.top+24);return{card:{left:card.left,right:card.right,top:card.top,bottom:card.bottom},width:innerWidth,height:innerHeight,bodyOverflow:body.scrollWidth-body.clientWidth,kpis:document.querySelectorAll('#schoolWorkforceKpis>div').length,rosterRows:document.querySelectorAll('#schoolWorkforceRoster tbody tr').length,modalOnTop:!!topElement?.closest('#schoolWorkforceModal'),text};});
        assert.ok(workforce.card.left>=-1&&workforce.card.right<=workforce.width+1&&workforce.card.top>=-1&&workforce.card.bottom<=workforce.height+1,`${viewport.name} 학교 인력분석 팝업 잘림: ${JSON.stringify(workforce)}`);
        if(viewport.width<=900)assert.ok(workforce.card.top<=10&&workforce.height-workforce.card.bottom<=10,`${viewport.name} 학교 인력분석은 모바일 화면 높이를 충분히 사용해야 합니다: ${JSON.stringify(workforce.card)}`);
        assert.equal(workforce.modalOnTop,true,`${viewport.name} 학교 인력분석 팝업이 상단바 아래에 가려지면 안 됩니다.`);assert.equal(workforce.kpis,6);assert.equal(workforce.rosterRows,4);assert.ok(workforce.text.includes('파트장')&&workforce.text.includes('설비기술')&&workforce.text.includes('입사예정'));assert.ok(!workforce.text.includes('전 PM'));assert.equal(await page.locator('#schoolWorkforceLeaveFrom,#schoolWorkforceLeaveTo,#schoolWorkforceLeaveYearFrom,#schoolWorkforceLeaveYearTo,#schoolWorkforcePromotionFrom,#schoolWorkforcePromotionTo,#schoolWorkforcePromotionYearFrom,#schoolWorkforcePromotionYearTo').count(),8,'퇴사·승격 날짜와 연도 필터가 모두 있어야 합니다.');
        if(viewport.width===1366){
          await page.locator('#schoolWorkforceSearch').fill('가상재직자');page.once('dialog',dialog=>dialog.accept('가상 저장조건'));await page.locator('#btnSaveSchoolWorkforceView').click();let saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('recruit_erp_school_workforce_saved_views_v1')));assert.equal(saved.length,1);assert.equal(saved[0].filters.search,'','저장 분석조건에는 사번·성명 검색 원문을 남기면 안 됩니다.');assert.ok(!JSON.stringify(saved).includes('가상재직자'));
          page.once('dialog',dialog=>dialog.accept('가상 변경조건'));await page.locator('#btnRenameSchoolWorkforceView').click();saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('recruit_erp_school_workforce_saved_views_v1')));assert.equal(saved[0].name,'가상 변경조건');
          await page.locator('#schoolWorkforceSearch').fill('');await page.locator('#btnApplySchoolWorkforceFilters').click();const [workforceDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#btnSchoolWorkforceExport').click()]);const workforceBuffer=fs.readFileSync(await workforceDownload.path()),workforceWorkbook=await employeeXlsx.readWorkbookArrayBuffer(workforceBuffer.buffer.slice(workforceBuffer.byteOffset,workforceBuffer.byteOffset+workforceBuffer.byteLength));assert.deepEqual(workforceWorkbook.availableSheets,['조회결과','집계요약','적용조건','데이터확인필요']);await page.evaluate(()=>localStorage.removeItem('recruit_erp_school_workforce_saved_views_v1'));
        }
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-school-workforce.png`),fullPage:false});await restoreSchoolWorkforceFixture(page);
      }
      await context.close();
    }

    const sidebarContext=await browser.newContext({viewport:{width:1363,height:936}}),sidebarPage=await sidebarContext.newPage();
    sidebarPage.on('pageerror',error=>consoleErrors.push(`1363x936-sidebar: ${error.message}`));
    await sidebarPage.addInitScript(fixture=>{localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(fixture.applicants));localStorage.setItem('recruit_erp_ui_operation_environment','company');}, {applicants:fakeApplicants});
    await sidebarPage.goto(baseUrl,{waitUntil:'domcontentloaded'});await sidebarPage.waitForTimeout(700);await verifyUsabilityPolish(sidebarPage,'1363x936-sidebar');
    await sidebarPage.locator('.sidebar').screenshot({path:path.join(outputDir,'1363x936-sidebar.png')});await sidebarContext.close();

    const zoomContext=await browser.newContext({viewport:{width:1093,height:614},deviceScaleFactor:1.25}),zoomPage=await zoomContext.newPage();
    zoomPage.on('pageerror',error=>consoleErrors.push(`1366x768-zoom125: ${error.message}`));
    zoomPage.on('console',message=>{if(message.type()==='error'&&!/favicon/i.test(message.text()))consoleErrors.push(`1366x768-zoom125: ${message.text()}`);});
    await zoomPage.addInitScript(fixture=>{localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(fixture.applicants));localStorage.setItem('recruit_erp_hire_waiting_profiles',JSON.stringify(fixture.profiles));localStorage.setItem('recruit_erp_saved_advanced_searches',JSON.stringify(fixture.savedViews));localStorage.setItem('recruit_erp_ui_operation_environment','company');},{applicants:fakeApplicants,profiles:fakeHireWaitingProfiles,savedViews:savedAdvancedSearchFixture});
    await zoomPage.goto(baseUrl,{waitUntil:'domcontentloaded'});await zoomPage.waitForTimeout(700);
    await verifyApplicantQuickDetail(zoomPage,'1366x768-zoom125');
    await verifyHireWaitingGrid(zoomPage,'1366x768-zoom125');
    await verifyApplicantWorksheet(zoomPage,'1366x768-zoom125',{exercise:true});
    await verifyApplicantMyViews(zoomPage,'1366x768-zoom125',{exercise:true});
    await verifyUsabilityPolish(zoomPage,'1366x768-zoom125');
    for(const screen of ['home','applicants','form','today','onboarding','storagePerformance','productionReadiness']){
      await zoomPage.evaluate(id=>window.setPage?.(id),screen);await zoomPage.waitForTimeout(50);
      const layout=await zoomPage.evaluate(()=>({screen:document.querySelector('.page.active')?.id,width:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth}));
      assert.equal(layout.width,1093,'1366×768의 125% 확대는 약 1093px 유효 폭으로 검사합니다.');
      assert.ok(layout.body<=layout.width+1&&layout.html<=layout.width+1,`1366×768 125% ${screen} 본문 가로 넘침: ${JSON.stringify(layout)}`);
    }
    await zoomPage.screenshot({path:path.join(outputDir,'1366x768-zoom125-storage-performance.png'),fullPage:true});
    await zoomPage.evaluate(()=>window.setPage?.('today'));await zoomPage.waitForTimeout(50);await zoomPage.screenshot({path:path.join(outputDir,'1366x768-zoom125-today-automation.png'),fullPage:true});
    await zoomPage.evaluate(()=>window.setPage?.('onboarding'));await zoomPage.waitForTimeout(50);await zoomPage.screenshot({path:path.join(outputDir,'1366x768-zoom125-onboarding.png'),fullPage:true});
    await zoomPage.evaluate(()=>window.setPage?.('productionReadiness'));await zoomPage.waitForTimeout(80);await zoomPage.screenshot({path:path.join(outputDir,'1366x768-zoom125-production-readiness.png'),fullPage:true});
    await zoomPage.evaluate(()=>window.setPage?.('form'));await zoomPage.waitForTimeout(50);
    const zoomFormBounds=await zoomPage.locator('#form').evaluate(form=>({width:innerWidth,labels:[...form.querySelectorAll('.resume-input-grid>label')].map(label=>{const rect=label.getBoundingClientRect();return {text:label.innerText.slice(0,18),left:rect.left,right:rect.right};}),controls:[...form.querySelectorAll('.resume-input-grid input,.resume-input-grid select,.resume-input-grid textarea')].map(control=>{const rect=control.getBoundingClientRect();return {id:control.id,left:rect.left,right:rect.right};}),buttons:[...document.querySelectorAll('.form-top-actions button')].filter(button=>getComputedStyle(button).display!=='none').map(button=>{const rect=button.getBoundingClientRect();return {id:button.id,left:rect.left,right:rect.right};})}));
    assert.ok(zoomFormBounds.labels.every(label=>label.left>=-1&&label.right<=zoomFormBounds.width+1),`1366×768 125% 등록 입력칸 잘림: ${JSON.stringify(zoomFormBounds)}`);
    assert.ok(zoomFormBounds.controls.every(control=>control.left>=-1&&control.right<=zoomFormBounds.width+1),`1366×768 125% 등록 컨트롤 잘림: ${JSON.stringify(zoomFormBounds)}`);
    assert.ok(zoomFormBounds.buttons.every(button=>button.left>=-1&&button.right<=zoomFormBounds.width+1),`1366×768 125% 상단 버튼 잘림: ${JSON.stringify(zoomFormBounds)}`);
    await zoomPage.screenshot({path:path.join(outputDir,'1366x768-zoom125-form.png'),fullPage:true});
    await openSchoolWorkforceFixture(zoomPage);const zoomWorkforce=await zoomPage.evaluate(()=>{const card=document.querySelector('.school-workforce-card').getBoundingClientRect(),topElement=document.elementFromPoint(card.right-24,card.top+24);return{left:card.left,right:card.right,top:card.top,bottom:card.bottom,width:innerWidth,height:innerHeight,modalOnTop:!!topElement?.closest('#schoolWorkforceModal')};});assert.ok(zoomWorkforce.left>=-1&&zoomWorkforce.right<=zoomWorkforce.width+1&&zoomWorkforce.top>=-1&&zoomWorkforce.bottom<=zoomWorkforce.height+1,`1366×768 125% 학교 인력분석 팝업 잘림: ${JSON.stringify(zoomWorkforce)}`);assert.equal(zoomWorkforce.modalOnTop,true,'1366×768 125% 학교 인력분석 팝업은 상단바보다 위에 보여야 합니다.');await zoomPage.screenshot({path:path.join(outputDir,'1366x768-zoom125-school-workforce.png'),fullPage:false});await restoreSchoolWorkforceFixture(zoomPage);
    await zoomContext.close();

    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
    await page.addInitScript(fixture=>{localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(fixture.applicants));localStorage.setItem('recruit_erp_hire_waiting_profiles',JSON.stringify(fixture.profiles));localStorage.setItem('recruit_erp_saved_advanced_searches',JSON.stringify(fixture.savedViews));},{applicants:fakeApplicants,profiles:fakeHireWaitingProfiles,savedViews:savedAdvancedSearchFixture});await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
    await page.evaluate(()=>window.setPage?.('form'));
    assert.equal(await page.locator('[data-form-step="2"] [data-form-step-status]').innerText(),'선택 입력');
    assert.equal(await page.locator('#formProgressText').innerText(),'필수 0/1 단계 완료');
    await page.locator('#name').fill('가상지원자');await page.locator('#phone').fill('010-0000-0099');await page.locator('#applyDate').fill('2026-08-02');await page.locator('#workplace').selectOption('천안');
    assert.equal(await page.locator('#formProgressText').innerText(),'필수 1/1 단계 완료');assert.equal(await page.locator('#formProgressBar').getAttribute('style'),'width: 100%;');
    await page.locator('#status').selectOption('면접예정');assert.equal(await page.locator('[data-form-step="3"] [data-form-step-status]').innerText(),'확인 필요');assert.equal(await page.locator('#formProgressText').innerText(),'필수 1/2 단계 완료');
    await page.locator('#interviewDate').fill('2026-08-03');assert.equal(await page.locator('#formProgressText').innerText(),'필수 2/2 단계 완료');await page.evaluate(()=>window.resetForm?.());

    await page.evaluate(()=>{document.getElementById('loginOverlay').style.display='none';window.setPage?.('today');});await page.locator('[data-applicant-id="22222222-2222-4222-8222-222222222222"] [data-erp-handler*="decision"]').click();await page.locator('#detailModal.show').waitFor();assert.equal(await page.evaluate(()=>document.activeElement?.id),'detailQuickStatus','결과 입력은 상세 상태 선택으로 바로 이동해야 합니다.');await page.locator('#btnCloseDetail').click();
    await page.evaluate(()=>{applicants=applicants.map(item=>item.id==='33333333-3333-4333-8333-333333333333'?{...item,hireDate:'2026-08-02'}:item);renderAll();setPage('today');});await page.locator('[data-applicant-id="33333333-3333-4333-8333-333333333333"] [data-erp-handler*="attendance"]').click();await page.locator('#applicantStatusModal.show').waitFor();assert.equal(await page.locator('#applicantStatusNext').innerText(),'출근');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>applicants.find(item=>item.id==='33333333-3333-4333-8333-333333333333').status),'입사예정','출근 확인 취소는 상태를 바꾸면 안 됩니다.');await page.evaluate(()=>{applicants=applicants.map(item=>item.id==='33333333-3333-4333-8333-333333333333'?{...item,hireDate:'2026-08-06'}:item);renderAll();});

    const onboardingBaseline=await page.evaluate(()=>({applicants:localStorage.getItem('recruit_erp_applicants_stable'),employees:localStorage.getItem('recruit_erp_employees')||'[]',profiles:localStorage.getItem('recruit_erp_hire_waiting_profiles')}));
    await page.evaluate(()=>window.setPage?.('onboarding'));await page.locator('[data-onboarding-open="33333333-3333-4333-8333-333333333333"]').click();await page.locator('#onboardingModal.show').waitFor();assert.ok(!(await page.locator('#onboardingModal').innerText()).includes('000000-0000000'),'온보딩 팝업에 주민등록번호가 보이면 안 됩니다.');await page.waitForTimeout(3200);const onboardingButtons=await page.locator('#onboardingModal .onboarding-modal-actions').evaluate(actions=>{const modal=document.querySelector('.onboarding-modal-card').getBoundingClientRect();return[...actions.querySelectorAll('button')].filter(button=>getComputedStyle(button).display!=='none').map(button=>{const rect=button.getBoundingClientRect();return{id:button.id,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,modal:{left:modal.left,right:modal.right,top:modal.top,bottom:modal.bottom}};});});assert.ok(onboardingButtons.every(button=>button.left>=button.modal.left-1&&button.right<=button.modal.right+1&&button.top>=button.modal.top-1&&button.bottom<=button.modal.bottom+1),`390 온보딩 작업 버튼 잘림: ${JSON.stringify(onboardingButtons)}`);await page.screenshot({path:path.join(outputDir,'390x844-onboarding-modal.png'),fullPage:false});
    await page.evaluate(()=>{window.__onboardingSetItem=Storage.prototype.setItem;window.__failOnboardingApplicantWrite=true;Storage.prototype.setItem=function(key,value){if(window.__failOnboardingApplicantWrite&&key==='recruit_erp_applicants_stable'){window.__failOnboardingApplicantWrite=false;throw new Error('가상 온보딩 저장 실패');}return window.__onboardingSetItem.call(this,key,value);};});const onboardingFailureDialogs=[];const onboardingFailureHandler=dialog=>{onboardingFailureDialogs.push(dialog.type());return dialog.accept();};page.on('dialog',onboardingFailureHandler);await page.locator('#btnOnboardingAttendance').click();await page.waitForTimeout(100);page.off('dialog',onboardingFailureHandler);await page.evaluate(()=>{Storage.prototype.setItem=window.__onboardingSetItem;delete window.__onboardingSetItem;delete window.__failOnboardingApplicantWrite;});const onboardingRollback=await page.evaluate(snapshot=>({status:applicants.find(item=>item.id==='33333333-3333-4333-8333-333333333333').status,employeeCount:employees.length,applicantsSame:localStorage.getItem('recruit_erp_applicants_stable')===snapshot.applicants,employeesSame:(localStorage.getItem('recruit_erp_employees')||'[]')===snapshot.employees,profilesSame:localStorage.getItem('recruit_erp_hire_waiting_profiles')===snapshot.profiles}),onboardingBaseline);assert.deepEqual(onboardingRollback,{status:'입사예정',employeeCount:0,applicantsSame:true,employeesSame:true,profilesSame:true},'온보딩 저장 실패는 지원자·사원·입사대기 정보를 모두 원상복구해야 합니다.');assert.ok(onboardingFailureDialogs.includes('alert'));
    await page.locator('#btnOnboardingAttendance').click();await page.locator('#onboardingModal.show').waitFor({state:'detached'});
    const conversion=await page.evaluate(()=>{const a=applicants.find(item=>item.id==='33333333-3333-4333-8333-333333333333'),e=employees.find(item=>item.applicantId===a.id);return{status:a.status,employeeId:a.employeeId,employeeCount:employees.length,employeeApplicantId:e?.applicantId,employeeNo:e?.empNo};});assert.deepEqual(conversion,{status:'출근',employeeId:conversion.employeeId,employeeCount:1,employeeApplicantId:'33333333-3333-4333-8333-333333333333',employeeNo:'V-1003'});assert.ok(conversion.employeeId,'지원자와 새 사원의 양방향 연결이 필요합니다.');
    await page.evaluate(()=>window.erpOnboarding.openModal('33333333-3333-4333-8333-333333333333'));assert.equal(await page.locator('#btnOnboardingConvert').isVisible(),false,'이미 전환된 지원자에게 전환 버튼을 다시 보여주면 안 됩니다.');await page.keyboard.press('Escape');
    await page.evaluate(snapshot=>{localStorage.setItem('recruit_erp_applicants_stable',snapshot.applicants);localStorage.setItem('recruit_erp_employees',snapshot.employees);localStorage.setItem('recruit_erp_hire_waiting_profiles',snapshot.profiles);applicants=load();employees=loadEmployees();hireWaitingProfiles=loadHireWaitingProfiles();renderAll();},onboardingBaseline);

    const employeeImportRollbackDialogs=[],employeeImportRollbackHandler=dialog=>{employeeImportRollbackDialogs.push(dialog.type());return dialog.accept();};page.on('dialog',employeeImportRollbackHandler);const employeeImportRollback=await page.evaluate(async()=>{
      const employeeStorageBefore=localStorage.getItem('recruit_erp_employees')||'[]',operationModeBefore=localStorage.getItem('recruit_erp_ui_operation_environment'),undoBefore=JSON.stringify({at:'2026-08-01T00:00:00.000Z',before:[],newIds:['previous-fake-id']});localStorage.setItem('recruit_erp_employee_excel_compare_undo_v1',undoBefore);localStorage.setItem('recruit_erp_ui_operation_environment','home');
      const originalBackup=window.employeeExcelSafetyBackup,originalSetItem=Storage.prototype.setItem,token='excel-rollback:__create__';window.employeeExcelSafetyBackup=()=>({});employeeExcelCompareState={fileName:'가상명단.xlsx',meta:{sourceType:'xlsx',sourceIssues:[],issues:[]},rows:[{key:'excel-rollback',record:{empNo:'V-ROLLBACK',name:'가상복구사원',hireDate:'2026-01-01',status:'재직중'},plannedEmployee:{empNo:'V-ROLLBACK',name:'가상복구사원',hireDate:'2026-01-01',status:'재직중'},employee:null,status:'new',errors:[],changes:[]}],filter:'actionable',page:1,pageSize:35,selected:new Set([token]),lastResult:null};document.getElementById('employeeExcelConfirm').checked=true;
      Storage.prototype.setItem=function(key,value){if(key==='recruit_erp_employees')throw new Error('가상 사원 저장 실패');return originalSetItem.call(this,key,value);};
      try{await window.applyEmployeeExcelCompare();}finally{Storage.prototype.setItem=originalSetItem;window.employeeExcelSafetyBackup=originalBackup;if(operationModeBefore===null)localStorage.removeItem('recruit_erp_ui_operation_environment');else localStorage.setItem('recruit_erp_ui_operation_environment',operationModeBefore);}
      return{employeeCount:employees.length,employeeStorageSame:localStorage.getItem('recruit_erp_employees')===employeeStorageBefore,undoSame:localStorage.getItem('recruit_erp_employee_excel_compare_undo_v1')===undoBefore,selectionPreserved:employeeExcelCompareState.selected.has(token)};
    });page.off('dialog',employeeImportRollbackHandler);
    assert.deepEqual(employeeImportRollback,{employeeCount:0,employeeStorageSame:true,undoSame:true,selectionPreserved:true},'사원 XLSX 로컬 저장 실패는 사원·실행취소·미리보기 선택 상태를 원상복구해야 합니다.');
    assert.ok(employeeImportRollbackDialogs.includes('confirm')&&employeeImportRollbackDialogs.includes('alert'));

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
      await page.evaluate(()=>{window.setPage('applicants');window.erpApplicantWorksheet?.setViewMode?.('normal');renderTable();window.openApplicantQuickDetail(applicants[0]?.id);});await page.locator('#applicantQuickDetail.is-open').waitFor();
      const quickPermission=await page.evaluate(()=>({editVisible:document.getElementById('btnApplicantQuickDetailEdit').getClientRects().length>0,deleteButtons:document.querySelectorAll('#applicantQuickDetail [data-erp-handler*="delete"],#applicantQuickDetail .delete').length,page:document.querySelector('.page.active')?.id,text:document.getElementById('applicantQuickDetail').innerText}));
      assert.equal(quickPermission.editVisible,role!=='viewer',`${role} 빠른 보기 수정 권한 표시가 잘못되었습니다.`);assert.equal(quickPermission.deleteButtons,0,'빠른 보기에는 삭제 동작이 없어야 합니다.');assert.ok(!/000000-0000000|\d{6}-\d{7}/.test(quickPermission.text),'역할별 빠른 보기에 주민등록번호가 표시되면 안 됩니다.');
      if(role==='viewer'){await page.locator('#btnApplicantQuickDetailEdit').evaluate(button=>button.click());assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'applicants','조회 전용은 숨은 수정 버튼을 실행해도 편집 화면으로 이동하면 안 됩니다.');}
      await page.evaluate(()=>window.closeApplicantQuickDetail());
      const roleView=await page.evaluate(()=>{const before=localStorage.getItem('recruit_erp_saved_advanced_searches'),result=window.erpSavedAdvancedSearches.load(0),after=localStorage.getItem('recruit_erp_saved_advanced_searches'),count=window.__erpAdvancedFilterIds.length;window.__erpAdvancedFilterIds=null;renderTable();return{result,before,after,count};});
      assert.ok(roleView.result&&roleView.count>=1&&roleView.before===roleView.after,`${role} 내 보기 불러오기는 허용되고 저장 검색조건은 변경하지 않아야 합니다.`);
      const state=await page.evaluate(()=>{window.setPage('onboarding');window.erpOnboarding.openModal('33333333-3333-4333-8333-333333333333');const value={role:window.erpPermissions.current().role,formHidden:document.querySelector('[data-page="form"]')?.classList.contains('erp-permission-hidden'),backupHidden:document.querySelector('[data-page="backup"]')?.classList.contains('erp-permission-hidden'),auditHidden:document.querySelector('[data-page="auditHistory"]')?.classList.contains('erp-permission-hidden'),readinessHidden:document.querySelector('[data-page="productionReadiness"]')?.classList.contains('erp-permission-hidden'),dailyStartHidden:document.querySelector('#btnDailyStartFirst')?.classList.contains('erp-permission-hidden'),onboardingVisible:document.querySelector('[data-page="onboarding"]')&&!document.querySelector('[data-page="onboarding"]').classList.contains('erp-permission-hidden'),saveVisible:!document.querySelector('#btnOnboardingSave').hidden,convertVisible:!document.querySelector('#btnOnboardingConvert').hidden};window.erpOnboarding.closeModal();return value;});assert.equal(state.role,role);assert.ok(state.onboardingVisible);if(role==='admin')assert.ok(!state.formHidden&&!state.backupHidden&&!state.auditHidden&&!state.readinessHidden&&!state.dailyStartHidden&&state.saveVisible&&state.convertVisible);if(role==='recruiter')assert.ok(!state.formHidden&&state.backupHidden&&state.auditHidden&&state.readinessHidden&&!state.dailyStartHidden&&state.saveVisible&&!state.convertVisible);if(role==='viewer')assert.ok(state.formHidden&&state.backupHidden&&state.auditHidden&&state.readinessHidden&&state.dailyStartHidden&&!state.saveVisible&&!state.convertVisible);
      await openSchoolWorkforceFixture(page);const workforcePermission=await page.evaluate(()=>({privacy:!!document.querySelector('#schoolWorkforceRoster .school-workforce-privacy'),rows:document.querySelectorAll('#schoolWorkforceRoster tbody tr').length,exportDisabled:document.querySelector('#btnSchoolWorkforceExport').disabled,text:document.querySelector('#schoolWorkforceRoster').innerText}));if(role==='viewer'){assert.equal(workforcePermission.privacy,true);assert.equal(workforcePermission.rows,0);assert.equal(workforcePermission.exportDisabled,true);assert.ok(!workforcePermission.text.includes('가상재직자'));}else{assert.equal(workforcePermission.privacy,false);assert.ok(workforcePermission.rows>=3);assert.equal(workforcePermission.exportDisabled,false);}await restoreSchoolWorkforceFixture(page);
    }
    await page.evaluate(()=>{window.erpPermissions.useLocal();document.getElementById('loginOverlay').style.display='none';localStorage.setItem('recruit_erp_ui_operation_environment','company');document.documentElement.dataset.operationEnvironment='company';window.setPage('productionReadiness');});await page.waitForFunction(()=>document.querySelector('#productionReadinessBody')?.innerText.includes('로컬 참고용'));const localRoles=page.locator('[data-readiness-manual="roles_rls"]');const leakedPlanLimit=page.locator('[data-readiness-manual="leaked_credential_protection"]');assert.equal(await localRoles.isDisabled(),true,'local_admin은 roles_rls를 체크할 수 없어야 합니다.');assert.equal(await leakedPlanLimit.isDisabled(),true,'알려진 요금제 제한은 수동 체크 항목이 아니어야 합니다.');const readinessText=await page.locator('#productionReadiness').innerText();assert.ok(readinessText.includes('Supabase 관리자 계정으로 로그인한 상태에서만 확인할 수 있습니다.'));assert.ok(readinessText.includes('알려진 요금제 제한'));assert.ok(readinessText.includes('Supabase Free 요금제 사용으로 Leaked Password Protection은 미사용.'));await page.locator('#btnReadinessCapacity').click();await page.waitForFunction(()=>document.querySelector('#productionReadinessBody')?.innerText.includes('최근 검사'));const readinessCapacity=await page.evaluate(()=>JSON.parse(localStorage.getItem('recruit_erp_production_readiness_v1100'))?.capacity);assert.deepEqual(readinessCapacity.counts,{applicants:5000,employees:1000,schools:500});assert.equal(readinessCapacity.passed,true);const readinessStored=await page.evaluate(()=>localStorage.getItem('recruit_erp_production_readiness_v1100'));assert.ok(!JSON.parse(readinessStored).manual.roles_rls,'로컬 상태에서 roles_rls 기록을 만들면 안 됩니다.');for(const secret of ['테스트지원자1','010-0000-0001','000000-0000000'])assert.ok(!readinessStored.includes(secret),`운영 준비 상태에 개인정보가 남으면 안 됩니다: ${secret}`);const [readinessDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#btnReadinessExport').click()]);const readinessReport=JSON.parse(fs.readFileSync(await readinessDownload.path(),'utf8'));assert.equal(readinessReport.format,'recruit-erp-production-readiness');assert.equal(readinessReport.overall,'not-ready');assert.equal(readinessReport.verificationSource,'local');assert.equal(readinessReport.migrationVerified,false);assert.equal(readinessReport.knownLimitations.length,1);assert.match(readinessReport.limitation,/전자서명된 증명서가 아닙니다/);assert.ok(!JSON.stringify(readinessReport).includes('테스트지원자1'));
    await page.evaluate(async()=>{window.__readinessOriginalSb=window.sb;window.__readinessOriginalCanUseCloud=window.canUseCloud;window.sb={auth:{getSession:async()=>({data:{session:{user:{id:'fake-cloud-admin'}}}})},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{user_id:'fake-cloud-admin',email:'admin@example.com',display_name:'가상 관리자',role:'admin'}})})};window.canUseCloud=()=>true;localStorage.setItem('recruit_erp_ui_operation_environment','home');document.documentElement.dataset.operationEnvironment='home';await window.erpPermissions.load({user:{id:'fake-cloud-admin',email:'admin@example.com'}});document.dispatchEvent(new CustomEvent('erp:operation-environment-change',{detail:{mode:'home'}}));window.setPage('productionReadiness');});await page.waitForFunction(()=>document.querySelector('#productionReadinessBody')?.innerText.includes('클라우드 검증'));assert.equal(await page.locator('[data-readiness-manual="roles_rls"]').isDisabled(),false,'cloud admin은 roles_rls를 체크할 수 있어야 합니다.');assert.equal(await page.locator('[data-readiness-manual="leaked_credential_protection"]').isDisabled(),true,'cloud admin에서도 알려진 요금제 제한은 체크하지 않아야 합니다.');await page.locator('[data-readiness-manual="roles_rls"]').check();const cloudReadinessStored=JSON.parse(await page.evaluate(()=>localStorage.getItem('recruit_erp_production_readiness_v1100')));assert.equal(cloudReadinessStored.manual.roles_rls.role,'admin');assert.equal(cloudReadinessStored.manual.roles_rls.source,'cloud');assert.equal(cloudReadinessStored.manual.leaked_credential_protection,undefined);await page.evaluate(()=>{window.erpPermissions.useLocal();window.sb=window.__readinessOriginalSb;window.canUseCloud=window.__readinessOriginalCanUseCloud;delete window.__readinessOriginalSb;delete window.__readinessOriginalCanUseCloud;});
    await page.locator('#btnPrivacyShield').click();assert.ok(await page.locator('#privacyShieldOverlay').isVisible());await page.locator('#btnPrivacyUnlock').click();
    await page.evaluate(()=>{localStorage.setItem('recruit_erp_ui_operation_environment','home');window.setPage('backup');});await page.locator('#bcEncryptedFull').click();await page.locator('#encryptedBackupPassword').fill('가상 내보내기 긴 비밀번호 2026');await page.locator('#encryptedBackupConfirm').fill('가상 내보내기 긴 비밀번호 2026');const [encryptedDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#encryptedBackupSubmit').click()]);assert.match(encryptedDownload.suggestedFilename(),/\.erpbackup$/);const downloadedEnvelope=JSON.parse(fs.readFileSync(await encryptedDownload.path(),'utf8'));assert.equal(downloadedEnvelope.format,'recruit-erp-encrypted-backup');assert.ok(!JSON.stringify(downloadedEnvelope).includes('테스트지원자1'),'암호화 다운로드 파일에 가상 이름도 평문으로 노출되면 안 됩니다.');const downloadedPackage=await page.evaluate(async({envelope,password})=>window.erpEncryptedBackup.decryptEnvelope(envelope,password),{envelope:downloadedEnvelope,password:'가상 내보내기 긴 비밀번호 2026'});assert.equal(downloadedPackage.format,'recruit-erp-backup');assert.equal(downloadedPackage.schemaVersion,2);assert.equal(downloadedPackage.data.applicants.length,3);assert.ok(!await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}).includes('가상 내보내기 긴 비밀번호 2026')),'비밀번호는 브라우저 저장소에 남으면 안 됩니다.');await page.locator('#encryptedBackupDialog').waitFor({state:'hidden'});
    const normalizeLogs=await page.evaluate(()=>{const logs=[];const originalWarn=console.warn;const originalNormalize=window.normalize;console.warn=(...args)=>logs.push(args.map(String).join(' '));window.normalize=()=>{throw new Error('가상개인정보 010-9876-5432 000000-0000000');};try{window.erpBackupCenter.__test.normalizeRows('applicants',[{id:'safe-log-row',name:'가상개인정보',phone:'010-9876-5432',residentNumber:'000000-0000000'}]);}finally{window.normalize=originalNormalize;console.warn=originalWarn;}return logs;});assert.deepEqual(normalizeLogs,['백업 데이터 정규화 실패: applicants, 1번째 행']);for(const secret of ['가상개인정보','010-9876-5432','000000-0000000'])assert.ok(!normalizeLogs.join(' ').includes(secret),`정규화 로그에 개인정보가 남으면 안 됩니다: ${secret}`);
    const exportAuditBefore=await page.evaluate(()=>window.erpAudit.readLocal().filter(row=>row.reason==='암호화 백업 생성 실패').length);await page.evaluate(()=>{window.__realEncryptForAudit=window.erpEncryptedBackup.encryptObject;window.erpEncryptedBackup.encryptObject=async()=>{throw new Error('가상 내보내기 실패 010-9999-9999');};window.setPage('backup');});await page.locator('#bcEncryptedFull').click();await page.locator('#encryptedBackupPassword').fill('감사로그 시험용 긴 비밀번호 2026');await page.locator('#encryptedBackupConfirm').fill('감사로그 시험용 긴 비밀번호 2026');await page.locator('#encryptedBackupSubmit').click();await page.locator('#encryptedBackupHelp.error').waitFor();assert.equal(await page.locator('#encryptedBackupHelp').innerText(),'암호화 작업을 완료하지 못했습니다.');const exportAudit=await page.evaluate(before=>{window.erpEncryptedBackup.encryptObject=window.__realEncryptForAudit;delete window.__realEncryptForAudit;const rows=window.erpAudit.readLocal().filter(row=>row.reason==='암호화 백업 생성 실패');return {delta:rows.length-before,row:rows[0]};},exportAuditBefore);assert.equal(exportAudit.delta,1,'암호화 내보내기 실패 감사로그는 정확히 1건이어야 합니다.');assert.equal(exportAudit.row.action,'export');assert.equal(exportAudit.row.entity_type,'export');const auditText=JSON.stringify(exportAudit.row);assert.ok(!auditText.includes('감사로그 시험용 긴 비밀번호 2026'));assert.doesNotMatch(auditText,/"(?:salt|iv|ciphertext|payload)"/i);await page.keyboard.press('Escape');await page.evaluate(()=>{window.setPage('auditHistory');window.erpAudit.renderPage();});assert.equal(await page.locator('#auditTypeFilter option[value="export"]').innerText(),'백업·내보내기');await page.locator('#auditTypeFilter').selectOption('export');assert.ok((await page.locator('#auditHistory').innerText()).includes('암호화 백업 생성 실패'));await page.evaluate(()=>window.setPage('backup'));
    await page.evaluate(async()=>{
      const original=applicants;applicants=[...original,{id:'44444444-4444-4444-8444-444444444444',name:'가상복원지원자',phone:'010-0000-0044',applyDate:'2026-08-02',workplace:'천안',status:'서류검토',createdAt:'2026-08-02T03:00:00.000Z',updatedAt:'2026-08-02T03:00:00.000Z'}];const pack=window.erpBackupCenter.__test.packageFor(['applicants','schools','employees','calendarEvents','hireWaitingProfiles','messageTemplates'],'가상 UI 복원 시험');applicants=original;
      const envelope=await window.erpEncryptedBackup.encryptObject(pack,'가상 복원 전용 긴 비밀번호 2026',{iterations:100000});window.__fakeEncryptedBackup=JSON.stringify(envelope);
      await window.erpEncryptedBackupUI.inspectFile(new File([window.__fakeEncryptedBackup],'fake_v11.0.0.erpbackup',{type:'application/json'}));
    });
    const restoreBaseline=await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable'));await page.locator('#encryptedBackupDialog:not([hidden])').waitFor();await page.locator('#encryptedBackupPassword').fill('틀린 가상 비밀번호 12345');await page.locator('#encryptedBackupSubmit').click();await page.locator('#encryptedBackupHelp.error').waitFor();assert.equal(await page.locator('#encryptedBackupHelp').innerText(),'비밀번호가 맞지 않거나 파일이 손상되었습니다.');assert.equal(await page.locator('#encryptedBackupPassword').inputValue(),'','실패 후 비밀번호 입력값을 지워야 합니다.');assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'비밀번호 오류는 ERP 데이터를 바꾸면 안 됩니다.');await page.screenshot({path:path.join(outputDir,'390x844-encrypted-wrong-password.png'),fullPage:false});await page.keyboard.press('Escape');
    await page.evaluate(async()=>{const malicious=JSON.parse('{"format":"recruit-erp-backup","schemaVersion":2,"data":{"applicants":[{"id":"safe-app-9","constructor":{"polluted":true}}]}}');const envelope=await window.erpEncryptedBackup.encryptObject(malicious,'가상 복원 전용 긴 비밀번호 2026',{iterations:100000});await window.erpEncryptedBackupUI.inspectFile(new File([JSON.stringify(envelope)],'fake-malicious.erpbackup',{type:'application/json'}));});await page.locator('#encryptedBackupPassword').fill('가상 복원 전용 긴 비밀번호 2026');await page.locator('#encryptedBackupSubmit').click();await page.locator('#encryptedBackupHelp.error').waitFor();assert.equal(await page.locator('#encryptedBackupHelp').innerText(),'복호화된 백업의 안전 검사에 실패했습니다.');assert.equal(await page.evaluate(()=>window.erpBackupCenter.getStatus().inspection),null,'위험한 암호화 백업은 미리보기를 만들면 안 됩니다.');assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'위험한 암호화 백업은 ERP 데이터를 바꾸면 안 됩니다.');await page.keyboard.press('Escape');
    await openEncryptedRestoreFixture(page);await page.evaluate(()=>window.setPage('home'));assert.equal(await page.evaluate(()=>window.erpBackupCenter.getStatus().inspection),null,'백업 화면을 떠나면 복호화 미리보기를 폐기해야 합니다.');
    await page.evaluate(()=>window.setPage('backup'));await openEncryptedRestoreFixture(page);await page.locator('#btnPrivacyShield').click();assert.equal(await page.evaluate(()=>window.erpBackupCenter.getStatus().inspection),null,'화면 잠금 시 복호화 미리보기를 폐기해야 합니다.');await page.locator('#btnPrivacyUnlock').click();
    for(const eventName of ['erp:auth-logout','erp:permission-change','erp:operation-environment-change','pagehide']){await page.evaluate(()=>window.setPage('backup'));await openEncryptedRestoreFixture(page);await page.evaluate(name=>name==='pagehide'?window.dispatchEvent(new Event(name)):document.dispatchEvent(new CustomEvent(name)),eventName);assert.equal(await page.evaluate(()=>window.erpBackupCenter.getStatus().inspection),null,`${eventName} 시 복호화 미리보기를 폐기해야 합니다.`);}
    await openEncryptedRestoreFixture(page);assert.ok((await page.locator('#bcInspection').innerText()).includes('ERP 전체 백업 JSON'));assert.ok((await page.locator('#bcInspection').innerText()).includes('지원자'));await page.screenshot({path:path.join(outputDir,'390x844-encrypted-restore-preview.png'),fullPage:true});await page.locator('#bcClearInspection').click();assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'복원 미리보기 취소는 ERP 데이터를 바꾸면 안 됩니다.');
    await openEncryptedRestoreFixture(page);await page.evaluate(()=>{window.__realEncryptedExport=window.erpEncryptedBackup.encryptObject;window.erpEncryptedBackup.encryptObject=async()=>{throw new Error('가상 안전 백업 실패');};});const safetyDialogs=[];const safetyDialogHandler=dialog=>{safetyDialogs.push(dialog.type());return dialog.accept();};page.on('dialog',safetyDialogHandler);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});page.off('dialog',safetyDialogHandler);await page.evaluate(()=>{window.erpEncryptedBackup.encryptObject=window.__realEncryptedExport;delete window.__realEncryptedExport;});assert.ok(safetyDialogs.includes('confirm')&&safetyDialogs.includes('alert'),'안전 백업 실패 시 확인과 중단 안내가 필요합니다.');assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'안전 백업 생성 실패 시 실제 적용을 차단해야 합니다.');
    await openEncryptedRestoreFixture(page);await page.evaluate(()=>{window.__realStorageSetItem=Storage.prototype.setItem;window.__failApplicantWrite=true;Storage.prototype.setItem=function(key,value){if(window.__failApplicantWrite&&key==='recruit_erp_applicants_stable'){window.__failApplicantWrite=false;throw new Error('가상 저장 실패');}return window.__realStorageSetItem.call(this,key,value);};});const rollbackDialogs=[];const rollbackDialogHandler=dialog=>{rollbackDialogs.push(dialog.type());return dialog.accept();};page.on('dialog',rollbackDialogHandler);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});page.off('dialog',rollbackDialogHandler);await page.evaluate(()=>{Storage.prototype.setItem=window.__realStorageSetItem;delete window.__realStorageSetItem;delete window.__failApplicantWrite;});assert.ok(rollbackDialogs.filter(type=>type==='confirm').length>=2&&rollbackDialogs.includes('alert'),'저장 실패 전 안전 백업 확인과 원상복구 안내가 필요합니다.');assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable')),restoreBaseline,'적용 저장 실패 시 localStorage를 원상복구해야 합니다.');assert.equal(await page.evaluate(()=>applicants.length),3,'적용 저장 실패 시 메모리 데이터도 원상복구해야 합니다.');
    const mergeDialogHandler=dialog=>dialog.accept();page.on('dialog',mergeDialogHandler);await openEncryptedRestoreFixture(page);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>applicants.length),4,'첫 병합은 가상 지원자 1건을 추가해야 합니다.');await openEncryptedRestoreFixture(page);await page.locator('#bcMergeApply').click();await page.locator('#bcInspection').waitFor({state:'hidden'});page.off('dialog',mergeDialogHandler);assert.equal(await page.evaluate(()=>applicants.length),4,'같은 암호화 파일을 다시 병합해도 중복이 늘면 안 됩니다.');
    await page.evaluate(()=>window.erpSyncSafety.openConflicts());assert.ok(await page.locator('#syncConflictModal').isVisible());assert.ok(await page.locator('#syncConflictModal .safety-intro-card').count());await page.screenshot({path:path.join(outputDir,'390x844-sync-conflict.png'),fullPage:false});await page.locator('#btnCloseSyncConflicts').click();await page.evaluate(()=>window.erpSyncSafety.openDeletes());assert.ok(await page.locator('#syncDeleteModal').isVisible());assert.ok(await page.locator('#syncDeleteModal .safety-intro-card').count());await page.locator('#btnCloseSyncDeletes').click();
    assert.ok(await page.locator('#employeeOrgImportModal .employee-org-import-notice.safety-intro-card').count(),'조직정보 Import 안전 안내가 명시적으로 표시되어야 합니다.');
    await page.evaluate(()=>{
      window.__hireAutomationFixture={applicants,hireWaitingProfiles};
      applicants=[...applicants,
        {id:'55555555-5555-4555-8555-555555555555',name:'가상자동신입',status:'입사예정',hireDate:'2026-08-10',birthYear:'2000-05-20',careerType:'신입'},
        {id:'66666666-6666-4666-8666-666666666666',name:'가상자동경력',status:'입사예정',hireDate:'2026-08-20',birthYear:'1990.01.02',careerType:'경력',career:'가상 설비 PM 2년'},
        {id:'77777777-7777-4777-8777-777777777777',name:'가상생년확인',status:'입사예정',hireDate:'2026-08-28',birthYear:'2000년생',careerType:'경력'}
      ];
      window.__hireAutomationBefore={applicants:JSON.stringify(applicants),profiles:JSON.stringify(hireWaitingProfiles),storage:localStorage.getItem('recruit_erp_hire_waiting_profiles')};
      window.openHireWaitingList?.('2026-08-10');
    });
    await page.locator('#hireWaitingModal.show').waitFor();assert.ok(await page.locator('#hireWaitingModal .safety-intro-card').count());
    await page.locator('#btnHireWaitingAutomation').click();await page.locator('#hireWaitingAutomationModal.show').waitFor();
    assert.equal(await page.locator('#hireWaitingAutomationBody tr').count(),3);assert.equal(await page.locator('#hireWaitingAutomationNeedsBirth').innerText(),'1명');
    assert.ok((await page.locator('#hireWaitingAutomationBody').innerText()).includes('S2608'));assert.equal(await page.locator('[data-automation-measurement]').count(),2);
    const previewUnchanged=await page.evaluate(()=>({applicants:JSON.stringify(applicants)===window.__hireAutomationBefore.applicants,profiles:JSON.stringify(hireWaitingProfiles)===window.__hireAutomationBefore.profiles,storage:localStorage.getItem('recruit_erp_hire_waiting_profiles')===window.__hireAutomationBefore.storage}));
    assert.deepEqual(previewUnchanged,{applicants:true,profiles:true,storage:true},'자동작성 미리보기는 브라우저 데이터와 배열을 변경하면 안 됩니다.');
    await page.locator('[data-automation-measurement="heightCm"]').fill('182');await page.locator('[data-automation-measurement="weightKg"]').fill('78');await page.locator('[data-automation-measurement="weightKg"]').press('Tab');
    await page.screenshot({path:path.join(outputDir,'390x844-hire-waiting-automation.png'),fullPage:false});
    await page.locator('#btnHireWaitingAutomationCancel').click();
    const cancelUnchanged=await page.evaluate(()=>({applicants:JSON.stringify(applicants)===window.__hireAutomationBefore.applicants,profiles:JSON.stringify(hireWaitingProfiles)===window.__hireAutomationBefore.profiles,storage:localStorage.getItem('recruit_erp_hire_waiting_profiles')===window.__hireAutomationBefore.storage}));
    assert.deepEqual(cancelUnchanged,{applicants:true,profiles:true,storage:true},'자동작성 취소는 브라우저 데이터와 배열을 변경하면 안 됩니다.');
    await page.locator('#btnHireWaitingAutomation').click();await page.locator('#hireWaitingAutomationModal.show').waitFor();
    await page.locator('[data-automation-measurement="heightCm"]').fill('182');await page.locator('[data-automation-measurement="weightKg"]').fill('78');await page.locator('[data-automation-measurement="weightKg"]').press('Tab');
    await page.locator('#btnHireWaitingAutomationApply').click();await page.locator('#hireWaitingAutomationModal.show').waitFor({state:'detached'});
    const appliedHighlight=await page.evaluate(()=>({fields:[...document.querySelectorAll('#hireWaitingBody td.is-auto-filled')].map(cell=>cell.dataset.colKey).sort(),stored:localStorage.getItem('recruit_erp_hire_waiting_profiles')}));
    assert.deepEqual(appliedHighlight.fields,['employeeNo','remarks'],'자동작성 직후 새로 채운 사번·비고 셀만 강조해야 합니다.');
    assert.ok(!/is-auto-filled|autoHighlight|highlightCells/i.test(appliedHighlight.stored),'자동입력 강조 상태는 저장 데이터에 남으면 안 됩니다.');
    const existingHighlight=await page.evaluate(()=>{hireWaitingCurrentDate='2026-08-06';renderHireWaitingTable();return document.querySelectorAll('#hireWaitingBody td.is-auto-filled').length;});
    assert.equal(existingHighlight,0,'기존 사번·비고가 있는 셀은 자동작성 강조 대상이 아니어야 합니다.');
    await page.evaluate(()=>{hireWaitingCurrentDate='2026-08-10';renderHireWaitingTable();});
    await page.waitForFunction(()=>document.querySelectorAll('#hireWaitingBody td.is-auto-filled').length===0,null,{timeout:6500});
    assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_hire_waiting_profiles')),appliedHighlight.stored,'임시 강조 종료가 업무 데이터를 다시 저장하면 안 됩니다.');
    await page.evaluate(()=>{const start=document.querySelector('#hireWaitingBody [data-hire-field="groupName"]');hireWaitingApplyPaste(start,'가상그룹2\t가상제품2\t가상파트2');});
    assert.deepEqual(await page.locator('#hireWaitingBody [data-hire-field="groupName"],#hireWaitingBody [data-hire-field="product"],#hireWaitingBody [data-hire-field="part"]').evaluateAll(inputs=>inputs.map(input=>input.value)),['가상그룹2','가상제품2','가상파트2'],'가로 붙여넣기 입력 순서를 유지해야 합니다.');
    await page.locator('#hireWaitingBody [data-hire-field="rank"]').fill('가상직급');await page.locator('#hireWaitingBody [data-hire-field="residentNumber"]').fill('000000-0000000');await page.locator('#hireWaitingBody [data-hire-field="commuteMethod"]').selectOption('출퇴근');
    await page.locator('#btnHireWaitingSave').click();
    const hireWaitingExportState=await page.evaluate(()=>{const checked=validateHireWaitingGrid(),row=checked.rows[0]||{};return{invalid:checked.invalid,missing:HIRE_WAITING_REQUIRED_FIELDS.filter(field=>!String(row[field]||'').trim()),disabled:document.querySelector('#btnHireWaitingExport').disabled,status:document.querySelector('#hireWaitingStatusText').innerText};});
    assert.deepEqual(hireWaitingExportState,{invalid:0,missing:[],disabled:false,status:'1명 모두 입력 완료'},`입사대기 붙여넣기·저장 후 출력 준비 상태가 올바르지 않습니다: ${JSON.stringify(hireWaitingExportState)}`);
    page.once('dialog',dialog=>dialog.accept());
    const [hireWaitingDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#btnHireWaitingExport').click()]);
    assert.match(hireWaitingDownload.suggestedFilename(),/^입사대기자_명단_2026-08-10\.xlsx$/,'입사대기 XLSX 출력 파일명을 유지해야 합니다.');
    const hireWaitingHeaderOrder=await page.evaluate(()=>{const sheet=hireWaitingWorkbookFiles(hireWaitingGridRows())['xl/worksheets/sheet1.xml'],positions=HIRE_WAITING_COLUMNS.map(column=>sheet.indexOf(`>${column.label}<`));return positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1]));});
    assert.equal(hireWaitingHeaderOrder,true,'입사대기 XLSX 23열 순서를 유지해야 합니다.');
    await page.evaluate(()=>{closeHireWaitingList(true);applicants=window.__hireAutomationFixture.applicants;hireWaitingProfiles=window.__hireAutomationFixture.hireWaitingProfiles;delete window.__hireAutomationFixture;delete window.__hireAutomationBefore;});
    await context.close();
    assert.deepEqual(consoleErrors,[],`브라우저 오류: ${consoleErrors.join('\n')}`);
    console.log(`지원자 일반목록 geometry: ${JSON.stringify(applicantTableGeometryMetrics)}`);
    console.log(`ui-visual-layout.js: 8개 뷰포트+125% 확대·18개 화면·지원자 일반목록 3개 scroll 위치/빠른 보기 다음 액션/내 보기/워크시트·학교 인력분석·오늘 자동화·온보딩·운영 준비·3개 역할·암호화/상태/보안/동기화 팝업 통과\n스크린샷: ${outputDir}`);
  }finally{
    await browser.close();server.kill();await new Promise(resolve=>bridgeServer.close(resolve));
    const resolved=fs.realpathSync(bridgeTempParent);
    if(path.dirname(resolved)!==bridgeTempRoot)throw new Error('Bridge UI 임시 폴더 범위가 올바르지 않습니다.');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
})().catch(error=>{server.kill();if(bridgeServer.listening)bridgeServer.close();console.error(error);process.exitCode=1;});
