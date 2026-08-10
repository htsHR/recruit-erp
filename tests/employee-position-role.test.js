'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const xlsx=require('../js/employee-master-xlsx-import.js');

const root=path.resolve(__dirname,'..');
const employeesSource=fs.readFileSync(path.join(root,'js','employees.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const supabaseFiles=fs.readdirSync(path.join(root,'supabase'),{recursive:true}).map(String);
const schools=[];
const base={id:'employee-base',empNo:'V-ROLE-001',name:'가상 직무사원',hireDate:'2026-01-01',status:'재직중',createdAt:'2026-01-01T00:00:00.000Z'};

function record(position,role){return{sourceSheet:'(주)에이치티솔루션 사원명부',sourceRow:4,sourceType:'active',special:false,empNo:base.empNo,name:base.name,hireDate:'2026-01-01',status:'재직중',position,role,validationIssues:[]};}
function plan(existing,incoming){return xlsx.buildImportPlan({records:[incoming],employees:[existing],schools,asOf:'2026-08-05',now:'2026-08-05T00:00:00.000Z'}).nextEmployees[0];}

// 1~3. 한 필드만 있거나 두 필드가 서로 달라도 독립적으로 유지됩니다.
assert.deepEqual({position:plan({...base,position:'팀장',role:''},record('팀장','')).position,role:plan({...base,position:'팀장',role:''},record('팀장','')).role},{position:'팀장',role:''});
assert.deepEqual({position:plan({...base,position:'',role:'설비기술'},record('','설비기술')).position,role:plan({...base,position:'',role:'설비기술'},record('','설비기술')).role},{position:'',role:'설비기술'});
const different=plan({...base,position:'기존직책',role:'기존직무'},record('파트장','품질검사'));
assert.equal(different.position,'파트장');assert.equal(different.role,'품질검사');

// 4. XLSX의 직책/직책·직무 열은 서로 다른 매핑입니다.
const parsed=xlsx.recordsFromSheet({name:'(주)에이치티솔루션 사원명부',rows:[['사원번호','성명','직책','직책/직무','입사일'],['V-XLSX-ROLE','가상 엑셀사원','그룹장','공정기술','2026-01-01']]}).records[0];
assert.equal(parsed.position,'그룹장');assert.equal(parsed.role,'공정기술');

// 5~6. 브라우저 저장/새로고침과 클라우드 재조회에 해당하는 직렬화 경계에서도 값이 합쳐지지 않습니다.
const reloaded=JSON.parse(JSON.stringify(different));assert.equal(reloaded.position,'파트장');assert.equal(reloaded.role,'품질검사');
const cloudRoundTrip=plan({...reloaded,id:'cloud-row'},record('파트장','품질검사'));assert.equal(cloudRoundTrip.position,'파트장');assert.equal(cloudRoundTrip.role,'품질검사');

// 7~8. 각 빈 열은 반대 필드나 기존 값을 지우지 않습니다.
const blanks=plan({...base,position:'기존직책',role:'기존직무'},record('',''));
assert.equal(blanks.position,'기존직책');assert.equal(blanks.role,'기존직무');

// 9. 레거시처럼 한 필드만 가진 객체를 현대 필드로 강제 복제하는 코드가 없습니다.
assert.match(employeesSource,/const position=String\(e\.position\|\|''\)\.trim\(\);/);
assert.match(employeesSource,/const role=String\(e\.role\|\|''\)\.trim\(\);/);
assert.doesNotMatch(employeesSource,/role:String\(e\.role\|\|position/);
assert.doesNotMatch(employeesSource,/if\(c\.field==='position'\)patch\.role/);
assert.doesNotMatch(employeesSource,/const position=.*\|\|.*직책\/직무/,'레거시 XLSX 변환에서도 직책/직무를 직책으로 합치면 안 됩니다.');
assert.match(employeesSource,/role:\['role'\]/);
assert.match(employeesSource,/const EMPLOYEE_CLOUD_FIELDS=\[[\s\S]*'role'[\s\S]*\.\.\.EMPLOYEE_EXTENDED_FIELDS/);
assert.match(employeesSource,/EMPLOYEE_EXTENDED_FIELDS=\[[\s\S]*'position'/);
assert.match(employeesSource,/normalized\.position===normalized\.role/,'레거시 클라우드 형식은 두 값이 같은 경우에만 사용해야 합니다.');
assert.match(index,/id="empPosition"/);assert.match(index,/id="empRole"/);
assert.match(employeesSource,/openEmployeeExcelCompare\(\)\{if\(window\.erpPermissions&&!window\.erpPermissions\.require\('employee\.write'\)\)/,'엑셀 미리보기 함수도 사원 수정 권한을 확인해야 합니다.');

// 10. 일반 사원 내보내기와 XLSX 결과 모두 두 열을 별도로 둡니다.
assert.match(employeesSource,/\['사번','성명'[\s\S]*'직책','직책\/직무'/);
const bytes=xlsx.createXlsxBytes([{name:'명단',headers:['직책','직책/직무'],rows:[['파트장','품질검사']]}]);
const raw=Buffer.from(bytes).toString('utf8');assert.match(raw,/파트장/);assert.match(raw,/품질검사/);
assert.ok(!supabaseFiles.some(file=>/v11[_-]1[_-]0/i.test(file)),'v11.1.0 신규 Supabase migration을 추가하면 안 됩니다.');

console.log('employee-position-role.test.js: 직책·직책/직무 10개 분리 보존 경로 확인 완료');
