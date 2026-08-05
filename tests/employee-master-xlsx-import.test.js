'use strict';

const assert=require('node:assert/strict');
const xlsx=require('../js/employee-master-xlsx-import.js');

function rowSheet(name,headers,rows){return{name,rows:[headers,...rows]};}

const active=rowSheet('(주)에이치티솔루션 사원명부',
  ['사원번호','성명','팀','그룹','제품','파트','직급','직책','직책/직무','입사일','입사경위','채용채널','최종학력','최종학교','전공','성별','전 PM社'],
  [
    ['V-001','가상사원1','가상팀','가상그룹','가상제품','가상파트','SE1-2','팀장','검사',46023,'공채','학교','대학교','가상대학교','가상학과','여자','비지원값'],
    ['V-002','가상사원2','','','','','E1','','설비','2026.03.01','','','','가상대학교','','남자','무시값']
  ]
);
const leave={name:'휴직자 명단',rows:[['휴직자'],['사원번호','성명','직급','직책','직책/직무','입사일','휴직기간','최종학교'],['V-003','가상휴직자','E2-2','담당','품질','26.02.01','26.07.01~26.12.31','가상대학교']]};
const retired=rowSheet('퇴직자 현황',['사원번호','성명','직급','직책','직책/직무','입사일','퇴사일','최종학교'],[['V-004','가상퇴직자','PE2-5','매니저','공정','2024-01-01','2026-01-01','샘플대학교']]);

const parsedActive=xlsx.recordsFromSheet(active);
assert.equal(parsedActive.records.length,2);
assert.equal(parsedActive.records[0].position,'팀장');
assert.equal(parsedActive.records[0].role,'검사');
assert.equal(Object.prototype.hasOwnProperty.call(parsedActive.records[0],'previousPmCompany'),false);
assert.equal(Object.values(parsedActive.records[0]).includes('비지원값'),false);
assert.equal(parsedActive.records[0].hireDate.length,10);

const special={name:'특수직',rows:[['특수직'],[],['NO','입사일','성명','성별','주민번호','주소'],[1,'2026-01-01','가상특수직1','여자','000000-0000000','가상주소'],[2,'2026-01-02','가상특수직2','남자','000000-0000000','가상주소']]};
const specialResult=xlsx.inspectSpecialSheet(special);
assert.equal(specialResult.dataRows,2);
assert.equal(specialResult.linkableRows,0);
assert.equal(specialResult.excludedRows,2);
assert.equal(specialResult.hasEmpNo,false);
assert.equal(specialResult.hasSchool,false);
assert.ok(specialResult.issues.every(issue=>!JSON.stringify(issue).includes('000000-0000000')));

const extracted=xlsx.extractWorkbookRecords({sheets:[active,leave,retired,special],availableSheets:[active.name,leave.name,retired.name,special.name,'연고채용인원']});
assert.equal(extracted.records.length,4);
assert.equal(extracted.special.excludedRows,2);

const schools=[{id:'school-1',name:'가상대학교',aliases:['가상대']},{id:'school-2',name:'샘플대학교',aliases:[]}];
const employees=[
  {id:'employee-1',empNo:'V-001',name:'가상사원1',position:'기존직책',role:'기존직무',team:'기존팀',department:'기존팀',school:'가상대학교',schoolId:'school-1',notes:'기존 메모',returnDate:'2025-01-01',applicantId:'applicant-1',createdAt:'2024-01-01T00:00:00.000Z',status:'재직중'},
  {id:'employee-2',empNo:'V-002',name:'가상사원2',position:'보존직책',role:'보존직무',school:'가상대학교',schoolId:'school-1',createdAt:'2025-01-01T00:00:00.000Z',status:'재직중'}
];
const plan=xlsx.buildImportPlan({records:extracted.records,employees,schools,asOf:'2026-08-05',now:'2026-08-05T00:00:00.000Z',idFactory:(()=>{let id=10;return()=>`employee-${id++}`;})()});
assert.equal(plan.summary.added,2);
assert.equal(plan.summary.updated,2);
const updatedOne=plan.nextEmployees.find(row=>row.id==='employee-1');
assert.equal(updatedOne.position,'팀장');
assert.equal(updatedOne.role,'검사');
assert.equal(updatedOne.notes,'기존 메모');
assert.equal(updatedOne.returnDate,'2025-01-01');
assert.equal(updatedOne.applicantId,'applicant-1');
const updatedTwo=plan.nextEmployees.find(row=>row.id==='employee-2');
assert.equal(updatedTwo.position,'보존직책');
assert.equal(updatedTwo.role,'설비');

const blankRecord={...parsedActive.records[1],role:'',position:'',hireDate:'2026-03-01'};
const blankPlan=xlsx.buildImportPlan({records:[blankRecord],employees:[employees[1]],schools,asOf:'2026-08-05',now:'2026-08-05T00:00:00.000Z'});
assert.equal(blankPlan.nextEmployees[0].position,'보존직책');
assert.equal(blankPlan.nextEmployees[0].role,'보존직무');

const duplicateRows=[{...parsedActive.records[0],sourceSheet:'시트A'},{...parsedActive.records[0],sourceSheet:'시트B'}];
const duplicatePlan=xlsx.buildImportPlan({records:duplicateRows,employees:[],schools,asOf:'2026-08-05'});
assert.equal(duplicatePlan.summary.blocked,2);
assert.ok(duplicatePlan.rows.every(row=>row.errors.some(error=>error.includes('중복'))));

const erpDuplicatePlan=xlsx.buildImportPlan({records:[parsedActive.records[0]],employees:[employees[0],{...employees[0],id:'employee-duplicate'}],schools,asOf:'2026-08-05'});
assert.equal(erpDuplicatePlan.summary.blocked,1);

const conflictEmployee={...employees[0],schoolId:'school-2',school:'샘플대학교'};
const conflictPlan=xlsx.buildImportPlan({records:[parsedActive.records[0]],employees:[conflictEmployee],schools,asOf:'2026-08-05'});
assert.equal(conflictPlan.nextEmployees[0].schoolId,'school-2');
assert.equal(conflictPlan.nextEmployees[0].school,'샘플대학교');
assert.equal(conflictPlan.summary.schoolNeeds,1);

const missingNo=xlsx.recordsFromSheet(rowSheet('(주)에이치티솔루션 사원명부',['사원번호','성명','입사일','최종학교'],[['','가상누락','2026-01-01','가상대학교']])).records[0];
assert.equal(xlsx.buildImportPlan({records:[missingNo],employees:[],schools,asOf:'2026-08-05'}).summary.blocked,1);
const future={...parsedActive.records[0],empNo:'V-FUTURE',hireDate:'2026-12-01'};
assert.equal(xlsx.buildImportPlan({records:[future],employees:[],schools,asOf:'2026-08-05'}).summary.blocked,1);

async function roundTrip(){
  const bytes=xlsx.createXlsxBytes([
    {name:'(주)에이치티솔루션 사원명부',headers:['사원번호','성명','입사일','최종학교'],rows:[['V-XLSX','가상XLSX',46023,'가상대학교']]},
    {name:'특수직',headers:['성명','입사일'],rows:[['가상특수직','2026-01-01']]},
    {name:'연고채용인원',headers:['성명'],rows:[['읽으면 안 되는 가상값']]}
  ]);
  const workbook=await xlsx.readWorkbookArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.deepEqual(workbook.readSheets,['(주)에이치티솔루션 사원명부','특수직']);
  assert.ok(workbook.availableSheets.includes('연고채용인원'));
  assert.equal(workbook.sheets.some(sheet=>sheet.name==='연고채용인원'),false);

  const exportBytes=xlsx.createXlsxBytes([{name:'조회결과',headers:['사번','성명','직책','직무'],rows:[['V-001','=가상수식','팀장','검사']]}]);
  const raw=Buffer.from(exportBytes).toString('utf8');
  assert.match(raw,/직책/);assert.match(raw,/직무/);assert.match(raw,/팀장/);assert.match(raw,/검사/);
  assert.doesNotMatch(raw,/<f>/);assert.match(raw,/&apos;=가상수식/);
}

roundTrip().then(()=>console.log('employee-master-xlsx-import.test.js: all checks passed')).catch(error=>{console.error(error);process.exit(1);});
