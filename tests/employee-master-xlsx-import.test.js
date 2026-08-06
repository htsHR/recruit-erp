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

const selfClosing=xlsx.parseWorksheetXml(`
  <worksheet><sheetData>
    <row r="2"><c r="H2" s="1"/><c r="I2" t="s"><v>0</v></c><c r="J2"/><c r="K2"/><c r="L2"><v>46239</v></c></row>
    <row r="4"><c r="A4"/><c r="C4" t="inlineStr"><is><t>가상값</t></is></c><c r="E4" t="b"><v>1</v></c></row>
  </sheetData></worksheet>`,['가상성명']);
assert.equal(selfClosing.rows[1][7],'');
assert.equal(selfClosing.rows[1][8],'가상성명');
assert.equal(selfClosing.rows[1][9],'');
assert.equal(selfClosing.rows[1][10],'');
assert.equal(selfClosing.rows[1][11],46239);
assert.equal(selfClosing.rows[3][0],'');
assert.equal(selfClosing.rows[3][2],'가상값');
assert.equal(selfClosing.rows[3][4],true);
assert.equal(selfClosing.cellStates[1][7].kind,'empty');

const typedCells=xlsx.parseWorksheetXml(`
  <worksheet><sheetData><row r="1">
    <c r="A1" t="s"><v>0</v></c>
    <c r="B1" t="inlineStr"><is><t>인라인</t></is></c>
    <c r="C1"><v>42</v></c>
    <c r="D1" t="b"><v>0</v></c>
    <c r="E1" t="str"><v>캐시문자열</v></c>
    <c r="F1"><f>1+1</f><v>2</v></c>
    <c r="G1"><f t="shared" si="0"/></c>
    <c r="H1" t="e"><f>VLOOKUP()</f><v>#N/A</v></c>
    <c r="I1"/>
  </row></sheetData></worksheet>`,['공유문자열']);
assert.deepEqual(typedCells.rows[0].slice(0,9),['공유문자열','인라인',42,false,'캐시문자열',2,'','', '']);
assert.equal(typedCells.cellStates[0][5].kind,'formula-cached');
assert.equal(typedCells.cellStates[0][6].kind,'formula-missing-cache');
assert.equal(typedCells.cellStates[0][7].kind,'error');
assert.equal(typedCells.cellStates[0][8].kind,'empty');

const structureShared=['직급','직책','성명','입사일','직책/직무','사원번호','E1-2','가상정상성명','검사직무','V-PARSER'];
const structureParsed=xlsx.parseWorksheetXml(`
  <worksheet><sheetData>
    <row r="1"><c r="A1" t="s"><v>5</v></c><c r="B1" t="s"><v>2</v></c><c r="C1" t="s"><v>0</v></c><c r="D1" t="s"><v>1</v></c><c r="E1" t="s"><v>3</v></c><c r="F1" t="s"><v>4</v></c></row>
    <row r="2"><c r="A2" t="s"><v>9</v></c><c r="B2" t="s"><v>7</v></c><c r="C2" t="s"><v>6</v></c><c r="D2"/><c r="E2"><v>46239</v></c><c r="F2" t="s"><v>8</v></c></row>
  </sheetData></worksheet>`,structureShared);
const structureRecord=xlsx.recordsFromSheet({name:'(주)에이치티솔루션 사원명부',...structureParsed}).records[0];
assert.equal(structureRecord.empNo,'V-PARSER');
assert.equal(structureRecord.rank,'E1-2');
assert.equal(structureRecord.position,'');
assert.equal(structureRecord.name,'가상정상성명');
assert.equal(structureRecord.hireDate,'2026-08-05');
assert.equal(structureRecord.role,'검사직무');

const errorParsed=xlsx.parseWorksheetXml(`<worksheet><sheetData>
  <row r="1"><c r="A1" t="inlineStr"><is><t>사원번호</t></is></c><c r="B1" t="inlineStr"><is><t>성명</t></is></c><c r="C1" t="inlineStr"><is><t>입사일</t></is></c><c r="D1" t="inlineStr"><is><t>퇴사일</t></is></c></row>
  <row r="2"><c r="A2" t="e"><f>VLOOKUP()</f><v>#N/A</v></c><c r="B2" t="e"><f>VLOOKUP()</f><v>#N/A</v></c><c r="C2"><f>VLOOKUP()</f></c><c r="D2"/></row>
</sheetData></worksheet>`,[]);
const errorRecord=xlsx.recordsFromSheet({name:'퇴직자 현황',...errorParsed}).records[0];
const errorPlan=xlsx.buildImportPlan({records:[errorRecord],employees:[],schools:[],asOf:'2026-08-05'});
assert.equal(errorPlan.summary.blocked,1);
assert.ok(errorPlan.rows[0].errors.some(value=>value.includes('성명 셀')));
assert.ok(errorPlan.rows[0].errors.some(value=>value.includes('캐시값')));
assert.ok(errorPlan.issues.every(issue=>!Object.prototype.hasOwnProperty.call(issue,'name')&&!Object.prototype.hasOwnProperty.call(issue,'empNo')));

function referenceSheet(name,label,dateCell){const parsed=xlsx.parseWorksheetXml(`<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>${label}</t></is></c>${dateCell}</row></sheetData></worksheet>`,[]);return{name,...parsed};}
const referenceWorkbook={sheets:[
  referenceSheet('(주)에이치티솔루션 사원명부','오늘날짜:', '<c r="B1"><v>46239</v></c>'),
  referenceSheet('퇴직자 현황',' 오늘\n날짜 ： ', '<c r="B1" t="str"><v>2026-08-05</v></c>'),
  referenceSheet('특수직','오늘날짜', '<c r="B1"><f>TODAY()</f><v>46239</v></c>')
]};
const reference=xlsx.detectWorkbookReferenceDate(referenceWorkbook,{fallbackDate:'2026-08-06'});
assert.equal(reference.date,'2026-08-05');
assert.equal(reference.source,'workbook');
assert.equal(reference.conflict,false);
assert.deepEqual(reference.foundSheets,['(주)에이치티솔루션 사원명부','퇴직자 현황','특수직']);
const conflict=xlsx.detectWorkbookReferenceDate({sheets:[referenceWorkbook.sheets[0],referenceSheet('퇴직자 현황','오늘날짜:', '<c r="B1" t="str"><v>2026-08-04</v></c>')]},{fallbackDate:'2026-08-06'});
assert.equal(conflict.conflict,true);
assert.equal(conflict.date,'');
const missingReference=xlsx.detectWorkbookReferenceDate({sheets:[{name:'(주)에이치티솔루션 사원명부',rows:[['파일명 260728']],cellStates:[[]]}]},{fallbackDate:'2026-08-06'});
assert.equal(missingReference.date,'2026-08-06');
assert.equal(missingReference.missing,true);

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
  assert.equal(workbook.referenceDate.missing,true);

  const exportBytes=xlsx.createXlsxBytes([{name:'조회결과',headers:['사번','성명','직책','직무'],rows:[['V-001','=가상수식','팀장','검사']]}]);
  const raw=Buffer.from(exportBytes).toString('utf8');
  assert.match(raw,/직책/);assert.match(raw,/직무/);assert.match(raw,/팀장/);assert.match(raw,/검사/);
  assert.doesNotMatch(raw,/<f>/);assert.match(raw,/&apos;=가상수식/);
}

roundTrip().then(()=>console.log('employee-master-xlsx-import.test.js: all checks passed')).catch(error=>{console.error(error);process.exit(1);});
