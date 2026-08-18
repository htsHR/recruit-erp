'use strict';

const assert=require('node:assert/strict');
const automation=require('../js/hire-waiting-automation.js');

const applicant=(id,name,birthYear,extra={})=>({id,name,birthYear,status:'입사예정',hireDate:'2026-08-10',careerType:'신입',...extra});
const byId=plan=>Object.fromEntries(plan.rows.map(row=>[row.applicantId,row]));
const baseApplicants=[
  applicant('auto-a','가상신입나','1992-04-03',{hireDate:'2026-08-28'}),
  applicant('auto-b','가상신입다','1985/01/02',{hireDate:'2026-08-02'}),
  applicant('auto-c','가상신입가','1990.06.15',{hireDate:'2026-08-15'})
];

// A. 선택 날짜가 아니라 8월 전체를 생년월일순으로 채번한다.
const planA=automation.planAutomation({selectedDate:'2026-08-10',applicants:baseApplicants,profiles:[],employees:[]});
assert.equal(planA.ok,true);
assert.equal(planA.summary.total,3);
assert.equal(byId(planA)['auto-b'].proposedEmployeeNo,'S2608001');
assert.equal(byId(planA)['auto-c'].proposedEmployeeNo,'S2608002');
assert.equal(byId(planA)['auto-a'].proposedEmployeeNo,'S2608003');

// B. 001, 003이 이미 사용 중이면 가장 작은 빈 번호 002, 004를 사용한다.
const planB=automation.planAutomation({
  selectedDate:'2026-08-01',
  applicants:[applicant('auto-d','가상신입라','1990-01-01'),applicant('auto-e','가상신입마','1991-01-01')],
  profiles:[{applicantId:'used-1',employeeNo:'s2608001'},{applicantId:'used-3',employeeNo:'S2608003'}],
  employees:[]
});
assert.deepEqual(planB.rows.filter(row=>row.willAssignNumber).map(row=>row.proposedEmployeeNo),['S2608002','S2608004']);

// C. 사원명부 번호도 사용 중인 번호로 보고 건너뛴다.
const planC=automation.planAutomation({selectedDate:'2026-08-05',applicants:[applicant('auto-f','가상신입바','1990-01-01')],profiles:[],employees:[{id:'employee-1',empNo:'s2608001'}]});
assert.equal(planC.rows[0].proposedEmployeeNo,'S2608002');

// D. 기존 수기 사번은 생년월일 순서와 관계없이 절대 바꾸지 않는다.
const planD=automation.planAutomation({selectedDate:'2026-08-05',applicants:[applicant('auto-g','가상신입사','1980-01-01')],profiles:[{applicantId:'auto-g',employeeNo:'S2608007'}],employees:[]});
assert.equal(planD.rows[0].currentEmployeeNo,'S2608007');
assert.equal(planD.rows[0].proposedEmployeeNo,'S2608007');
assert.equal(planD.rows[0].willAssignNumber,false);

// E. 불완전·잘못된 생년월일은 주민번호가 있어도 채번하지 않는다.
const invalidBirthApplicants=[
  applicant('birth-empty','가상생년미입력','',{residentNumber:'000000-0000000'}),
  applicant('birth-year','가상연도만','2000',{residentNumber:'000000-0000000'}),
  applicant('birth-short','가상짧은날짜','000520',{residentNumber:'000000-0000000'}),
  applicant('birth-calendar','가상없는날짜','2000-02-30',{residentNumber:'000000-0000000'}),
  applicant('birth-valid','가상정상날짜','2000-05-20')
];
const planE=automation.planAutomation({selectedDate:'2026-08-20',applicants:invalidBirthApplicants,profiles:[],employees:[]});
for(const id of ['birth-empty','birth-year','birth-short','birth-calendar']){
  assert.equal(byId(planE)[id].proposedEmployeeNo,'');
  assert.equal(byId(planE)[id].numberAction,'생년월일 확인 필요');
}
assert.equal(byId(planE)['birth-valid'].proposedEmployeeNo,'S2608001');
assert.equal(planE.summary.needsBirth,4);

// F. 수기 비고는 공백을 포함한 원문 그대로 유지한다.
const manualRemarks='수기 비고 원문 유지 ';
const planF=automation.planAutomation({selectedDate:'2026-08-10',applicants:[applicant('remark-manual','가상수기비고','1990-01-01',{careerType:'경력',career:'자동작성하면 안 됨'})],profiles:[{applicantId:'remark-manual',remarks:manualRemarks}],employees:[]});
assert.equal(planF.rows[0].proposedRemarks,manualRemarks);
assert.equal(planF.rows[0].remarkAction,'수기 비고 유지');
const nextF=automation.buildNextProfiles({plan:planF,profiles:[{applicantId:'remark-manual',remarks:manualRemarks}],employees:[],now:'2026-08-18T00:00:00.000Z'});
assert.equal(nextF.profiles[0].remarks,manualRemarks);

// G. 경력직은 career 원문을 trim한 값으로 비고를 만든다.
const planG=automation.planAutomation({selectedDate:'2026-08-10',applicants:[applicant('remark-career','가상경력직','1990-01-01',{careerType:'경력',career:'  반도체 설비 PM 2년  '})],profiles:[],employees:[]});
assert.equal(planG.rows[0].autoRemarks,'반도체 설비 PM 2년');
assert.equal(planG.rows[0].remarkAction,'경력사항 자동작성');

// H. 신입은 두 값이 모두 정상일 때만 지정 형식의 비고를 만든다.
const planH=automation.planAutomation({selectedDate:'2026-08-10',applicants:[applicant('remark-new','가상신입키체중','1990-01-01')],profiles:[],employees:[],draftMeasurements:{'remark-new':{heightCm:'182',weightKg:'78'}}});
assert.equal(planH.rows[0].autoRemarks,'182cm/78kg');
const nextH=automation.buildNextProfiles({plan:planH,profiles:[],employees:[],now:'2026-08-18T00:00:00.000Z'});
assert.equal(nextH.profiles[0].heightCm,'182');
assert.equal(nextH.profiles[0].weightKg,'78');
assert.equal(nextH.profiles[0].remarks,'182cm/78kg');

// I. 한쪽 값만 있으면 자동비고와 선택 필드 모두 만들지 않는다.
const planI=automation.planAutomation({selectedDate:'2026-08-10',applicants:[applicant('remark-partial','가상신입부분','1990-01-01')],profiles:[],employees:[],draftMeasurements:{'remark-partial':{heightCm:'182',weightKg:''}}});
assert.equal(planI.rows[0].autoRemarks,'');
assert.equal(planI.rows[0].measurementIncomplete,true);
const nextI=automation.buildNextProfiles({plan:planI,profiles:[],employees:[],now:'2026-08-18T00:00:00.000Z'});
assert.equal(Object.prototype.hasOwnProperty.call(nextI.profiles[0],'heightCm'),false);
assert.equal(Object.prototype.hasOwnProperty.call(nextI.profiles[0],'weightKg'),false);

// J. 미리보기와 취소는 배열과 저장소 대역을 한 글자도 바꾸지 않는다.
const previewApplicants=[applicant('preview-safe','가상미리보기','1990-01-01')];
const previewProfiles=[{applicantId:'preview-safe',remarks:''}];
const previewEmployees=[];
const fakeLocalStorage={value:'변경 전 저장값'};
const previewBefore=JSON.stringify({previewApplicants,previewProfiles,previewEmployees,fakeLocalStorage});
automation.planAutomation({selectedDate:'2026-08-10',applicants:previewApplicants,profiles:previewProfiles,employees:previewEmployees});
assert.equal(JSON.stringify({previewApplicants,previewProfiles,previewEmployees,fakeLocalStorage}),previewBefore);

// K. 저장 함수가 실패하면 원본 배열을 유지하고 부분 결과를 반환하지 않는다.
const rollbackProfiles=[{applicantId:'rollback-old',employeeNo:'OLD-001',remarks:'기존'}];
const rollbackBefore=JSON.stringify(rollbackProfiles);
const rollbackPlan=automation.planAutomation({selectedDate:'2026-08-10',applicants:[applicant('rollback-new','가상롤백','1990-01-01')],profiles:rollbackProfiles,employees:[]});
let attempted=null;
const rollbackResult=automation.executeApply({plan:rollbackPlan,profiles:rollbackProfiles,employees:[],persist:next=>{attempted=next;return false;},now:'2026-08-18T00:00:00.000Z'});
assert.equal(rollbackResult.ok,false);
assert.equal(rollbackResult.code,'SAVE_FAILED');
assert.equal(JSON.stringify(rollbackProfiles),rollbackBefore);
assert.notEqual(attempted,rollbackProfiles);
assert.equal(rollbackResult.profiles,rollbackProfiles);

// L. 같은 입력의 반복 미리보기는 행 순서와 사번이 완전히 같다.
const repeatInput={selectedDate:'2026-08-10',applicants:baseApplicants,profiles:[],employees:[]};
assert.deepEqual(automation.planAutomation(repeatInput),automation.planAutomation(repeatInput));

console.log('hire-waiting-automation.test.js: 월별 사번·비고 미리보기/보호/rollback 12개 핵심 조건 통과');
