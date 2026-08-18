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
const outputDir=process.env.UI_SCREENSHOT_DIR||path.join(root,'artifacts','ui-v11.3.0');
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
  {name:'1024x768',width:1024,height:768},
  {name:'768x1024',width:768,height:1024},
  {name:'390x844',width:390,height:844}
];
const hireWaitingKeys=['no','employeeNo','contactStatus','hireDate','workplace','pmtc','gender','groupName','product','part','name','rank','residentNumber','birthDate','age','email','education','school','major','phone','region','commuteMethod','remarks'];
const hireWaitingWidths={no:52,employeeNo:124,contactStatus:88,hireDate:104,workplace:90,pmtc:108,gender:64,groupName:112,product:112,part:112,name:118,rank:88,residentNumber:150,birthDate:112,age:60,email:230,education:100,school:210,major:210,phone:136,region:120,commuteMethod:108,remarks:420};
const screens=['home','applicants','form','today','calendar','stats','schools','employees','onboarding','backup','dataHealth','duplicates','permissions','auditHistory','storagePerformance','productionReadiness'];
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
async function verifyApplicantWorksheet(page,label,{exercise=false}={}){
  await page.evaluate(()=>window.setPage?.('applicants'));await page.locator('#btnApplicantWorksheetView').click();await page.locator('#applicantWorksheet:not([hidden])').waitFor();
  const layout=await page.evaluate(()=>{
    const section=document.querySelector('#applicants'),wrap=document.querySelector('.applicant-worksheet-scroll'),table=document.querySelector('.applicant-worksheet-table'),first=document.querySelector('#applicantWorksheet tbody tr[data-applicant-id]');
    const no=first?.querySelector('[data-field="no"]'),name=first?.querySelector('[data-field="name"]');
    return {fields:[...document.querySelectorAll('.applicant-worksheet-table thead [data-field]')].map(node=>node.dataset.field),firstValues:Object.fromEntries([...first.querySelectorAll('[data-field]')].map(cell=>[cell.dataset.field,cell.innerText.trim()])),normalHidden:document.querySelector('#applicantTbody').closest('.table-wrap').hidden,bodyOverflow:Math.max(document.body.scrollWidth,document.documentElement.scrollWidth)-innerWidth,internalScroll:wrap.scrollWidth>wrap.clientWidth,noPosition:getComputedStyle(no).position,namePosition:getComputedStyle(name).position,noLeft:no.getBoundingClientRect().left-wrap.getBoundingClientRect().left,nameLeft:name.getBoundingClientRect().left-no.getBoundingClientRect().right,sectionWidth:section.clientWidth,tableWidth:table.getBoundingClientRect().width};
  });
  assert.deepEqual(layout.fields,['no','name','phone','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo'],`${label} 워크시트 열 순서가 달라졌습니다.`);
  assert.equal(layout.firstValues.interviewDate,'2026-08-02');assert.equal(layout.firstValues.interviewTime,'10:00','면접일과 면접시간이 서로 다른 열에 유지되어야 합니다.');
  assert.equal(layout.normalHidden,true);assert.equal(layout.noPosition,'sticky');assert.equal(layout.namePosition,'sticky');assert.ok(Math.abs(layout.noLeft)<=1&&Math.abs(layout.nameLeft)<=1,`${label} NO·성명 고정 열 위치가 맞지 않습니다: ${JSON.stringify(layout)}`);
  assert.ok((layout.internalScroll||layout.tableWidth<=layout.sectionWidth)&&layout.bodyOverflow<=1,`${label} 워크시트는 필요한 경우 표 내부에서만 가로 스크롤되어야 합니다: ${JSON.stringify(layout)}`);
  await page.screenshot({path:path.join(outputDir,`${label}-applicant-worksheet.png`),fullPage:false});
  if(!exercise)return;
  const id=fakeApplicants[0].id,storageBefore=await page.evaluate(()=>localStorage.getItem('recruit_erp_applicants_stable'));
  const nameCell=page.locator(`#applicantWorksheet tr[data-applicant-id="${id}"] [data-field="name"]`);await nameCell.click();await page.keyboard.press('Enter');assert.equal(await nameCell.locator('.worksheet-editor').count(),0,'성명은 워크시트에서 편집할 수 없어야 합니다.');
  const workplace=page.locator(`#applicantWorksheet tr[data-applicant-id="${id}"] [data-field="workplace"]`);await workplace.click();await page.keyboard.press('Enter');await workplace.locator('select').selectOption('평택');
  const staged=await page.evaluate(id=>({memory:applicants.find(row=>row.id===id).workplace,storage:localStorage.getItem('recruit_erp_applicants_stable'),dirty:window.erpApplicantWorksheet.state.dirty.size}),id);
  assert.equal(staged.memory,'천안');assert.equal(staged.storage,storageBefore);assert.equal(staged.dirty,1,'편집은 저장 전 메모리 변경목록에만 남아야 합니다.');
  const sourceCell=page.locator(`#applicantWorksheet tr[data-applicant-id="${id}"] [data-field="source"]`);await sourceCell.click();
  await sourceCell.evaluate(cell=>{const data=new DataTransfer();data.setData('text/plain','가상워크시트\t경력\t출퇴근\t가상 메모');cell.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  assert.equal(await page.evaluate(()=>window.erpApplicantWorksheet.state.dirty.size),5,'직사각형 붙여넣기는 4개 셀을 추가 변경해야 합니다.');
  page.once('dialog',dialog=>dialog.accept());
  await page.locator(`#applicantWorksheet tr[data-applicant-id="${id}"] [data-field="memo"]`).evaluate(cell=>{const data=new DataTransfer();data.setData('text/plain','범위초과\t금지');cell.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
  assert.equal(await page.evaluate(()=>window.erpApplicantWorksheet.state.dirty.size),5,'범위 밖 붙여넣기는 부분 적용 없이 전체 취소되어야 합니다.');
  const settingState=await page.evaluate(()=>{const raw=localStorage.getItem('recruit_erp_applicant_worksheet_view_v1'),parsed=JSON.parse(raw);return {keys:Object.keys(parsed),raw};});
  assert.deepEqual(settingState.keys,['viewMode','currentWorkplace','currentFilter','currentSort','hideFinished','applicantPageSize']);assert.ok(!settingState.raw.includes('가상지원자1')&&!settingState.raw.includes('010-0000-0001'),'워크시트 UI 설정에 검색어나 지원자 정보가 들어가면 안 됩니다.');
  await page.evaluate(()=>{window.__worksheetRealSave=window.save;window.__worksheetSaveCalls=0;window.save=function(){window.__worksheetSaveCalls++;return window.__worksheetRealSave();};});
  page.once('dialog',dialog=>dialog.accept());await page.locator('#btnWorksheetSave').click();await page.waitForFunction(()=>window.erpApplicantWorksheet.state.dirty.size===0);
  const saved=await page.evaluate(id=>{const result={calls:window.__worksheetSaveCalls,row:applicants.find(item=>item.id===id),stored:JSON.parse(localStorage.getItem('recruit_erp_applicants_stable')).find(item=>item.id===id)};window.save=window.__worksheetRealSave;delete window.__worksheetRealSave;return result;},id);
  assert.equal(saved.calls,1,'워크시트 저장은 기존 save를 정확히 한 번만 호출해야 합니다.');assert.equal(saved.row.workplace,'평택');assert.equal(saved.stored.memo,'가상 메모');assert.equal(saved.row.name,'테스트지원자1');assert.equal(saved.row.phone,'010-0000-0001');
  await page.evaluate(id=>{window.erpApplicantWorksheet.setDirty(id,'workplace','천안');window.__worksheetFailureBefore=JSON.stringify(applicants);window.__worksheetFailureStorage=localStorage.getItem('recruit_erp_applicants_stable');window.__worksheetRealSave=window.save;window.__worksheetSaveCalls=0;window.save=()=>{window.__worksheetSaveCalls++;return false;};},id);
  page.once('dialog',dialog=>dialog.accept());await page.locator('#btnWorksheetSave').click();
  const failed=await page.evaluate(()=>{const result={calls:window.__worksheetSaveCalls,memory:JSON.stringify(applicants)===window.__worksheetFailureBefore,storage:localStorage.getItem('recruit_erp_applicants_stable')===window.__worksheetFailureStorage,dirty:window.erpApplicantWorksheet.state.dirty.size};window.save=window.__worksheetRealSave;delete window.__worksheetRealSave;return result;});
  assert.deepEqual(failed,{calls:1,memory:true,storage:true,dirty:1},'저장 실패는 전체 원상복구하고 변경목록을 유지해야 합니다.');
  await page.locator('#btnApplicantNormalView').click();await page.locator('#applicantWorksheetGuard:not([hidden])').waitFor();await page.locator('#btnWorksheetGuardStay').click();assert.equal(await page.locator('#applicantWorksheet').isVisible(),true,'계속 편집은 워크시트와 변경목록을 유지해야 합니다.');
  await page.locator('#btnApplicantNormalView').click();await page.locator('#btnWorksheetGuardDiscard').click();await page.waitForFunction(()=>window.erpApplicantWorksheet.state.dirty.size===0);assert.equal(await page.locator('#applicantTbody').isVisible(),true,'변경 취소 뒤 일반보기를 열어야 합니다.');
  await page.locator(`#applicantTbody tr[data-applicant-id="${id}"] .name-button`).click();await page.locator('#detailModal.show').waitFor();await page.locator('#btnCloseDetail').click();
  await page.locator('#btnApplicantWorksheetView').click();
  const viewer=await page.evaluate(id=>{window.__worksheetRealHas=window.erpPermissions.has;window.erpPermissions.has=permission=>permission==='applicant.write'?false:window.__worksheetRealHas(permission);document.dispatchEvent(new CustomEvent('erp:permission-change'));return {changed:window.erpApplicantWorksheet.setDirty(id,'memo','금지'),dirty:window.erpApplicantWorksheet.state.dirty.size};},id);
  assert.deepEqual(viewer,{changed:false,dirty:0});assert.equal(await page.locator('#btnWorksheetSave').isDisabled(),true,'조회 전용은 워크시트 저장을 사용할 수 없어야 합니다.');
  await page.evaluate(()=>{window.erpPermissions.has=window.__worksheetRealHas;delete window.__worksheetRealHas;document.dispatchEvent(new CustomEvent('erp:permission-change'));});
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
        localStorage.setItem('recruit_erp_ui_operation_environment','company');
      },{applicants:fakeApplicants,profiles:fakeHireWaitingProfiles});
      await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForTimeout(800);
      assert.equal(await page.title(),'채용관리 시스템 v11.3.0');
      const queue=page.locator('#homeTodayGrid .queue-card');assert.equal(await queue.count(),5);for(let i=0;i<5;i++)assert.notEqual(await queue.nth(i).evaluate(el=>getComputedStyle(el).display),'none');
      for(const screen of screens){
        await page.evaluate(id=>window.setPage?.(id),screen);await page.waitForTimeout(30);
        const layout=await page.evaluate(()=>({active:document.querySelector('.page.active')?.id,body:document.body.scrollWidth,html:document.documentElement.scrollWidth,width:innerWidth}));
        assert.equal(layout.active,screen,`${viewport.name} ${screen} 화면 전환 실패`);
        assert.ok(layout.body<=layout.width+1&&layout.html<=layout.width+1,`${viewport.name} ${screen} 본문 가로 넘침: ${layout.body}/${layout.html}/${layout.width}`);
      }
      if(viewport.width===390||viewport.width===1366){
        await verifyHireWaitingGrid(page,viewport.name,{mobile:viewport.width===390});
        await page.evaluate(()=>window.setPage?.('today'));await page.waitForTimeout(80);
        const todayState=await page.evaluate(()=>({summary:document.querySelectorAll('.daily-automation-summary>div').length,hireLabel:document.querySelector('[data-daily-filter="hireUpcoming"]')?.innerText||'',rows:document.querySelectorAll('#dailyWorkflowList .daily-work-item').length,overflow:document.querySelector('#today').scrollWidth-document.querySelector('#today').clientWidth}));
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
      if([1366,1440,1920].includes(viewport.width))await verifyApplicantWorksheet(page,viewport.name,{exercise:viewport.width===1366});
      await page.evaluate(()=>window.setPage?.('home'));await queue.first().focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'today');await page.evaluate(()=>window.setPage?.('home'));await queue.nth(4).focus();await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>document.querySelector('.page.active')?.id),'today');
      if(viewport.width===390||viewport.width===1366){
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-home.png`),fullPage:true});
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

    const zoomContext=await browser.newContext({viewport:{width:1093,height:614},deviceScaleFactor:1.25}),zoomPage=await zoomContext.newPage();
    zoomPage.on('pageerror',error=>consoleErrors.push(`1366x768-zoom125: ${error.message}`));
    zoomPage.on('console',message=>{if(message.type()==='error'&&!/favicon/i.test(message.text()))consoleErrors.push(`1366x768-zoom125: ${message.text()}`);});
    await zoomPage.addInitScript(fixture=>{localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(fixture.applicants));localStorage.setItem('recruit_erp_hire_waiting_profiles',JSON.stringify(fixture.profiles));localStorage.setItem('recruit_erp_ui_operation_environment','company');},{applicants:fakeApplicants,profiles:fakeHireWaitingProfiles});
    await zoomPage.goto(baseUrl,{waitUntil:'domcontentloaded'});await zoomPage.waitForTimeout(700);
    await verifyHireWaitingGrid(zoomPage,'1366x768-zoom125');
    await verifyApplicantWorksheet(zoomPage,'1366x768-zoom125');
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
    await page.addInitScript(fixture=>{localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(fixture.applicants));localStorage.setItem('recruit_erp_hire_waiting_profiles',JSON.stringify(fixture.profiles));},{applicants:fakeApplicants,profiles:fakeHireWaitingProfiles});await page.goto(baseUrl,{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
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
    console.log(`ui-visual-layout.js: 8개 화면 조건(6개 뷰포트+125% 확대)·17개 화면·지원자 워크시트·학교 인력분석·오늘 자동화·온보딩·운영 준비·3개 역할·암호화/상태/보안/동기화 팝업 통과\n스크린샷: ${outputDir}`);
  }finally{
    await browser.close();server.kill();await new Promise(resolve=>bridgeServer.close(resolve));
    const resolved=fs.realpathSync(bridgeTempParent);
    if(path.dirname(resolved)!==bridgeTempRoot)throw new Error('Bridge UI 임시 폴더 범위가 올바르지 않습니다.');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
})().catch(error=>{server.kill();if(bridgeServer.listening)bridgeServer.close();console.error(error);process.exitCode=1;});
