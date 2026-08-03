'use strict';

const assert=require('node:assert/strict');
const onboarding=require('../js/onboarding-management.js');

const applicant={id:'applicant-1',name:'가상입사자',status:'입사예정',finalDecision:'합격',hireDate:'2026-08-10',workplace:'천안',school:'가상대학교'};
const completeProfile={applicantId:applicant.id,documentsRequestedAt:'2026-08-03T00:00:00.000Z',submittedDocuments:[...onboarding.REQUIRED_DOCUMENTS],employeeNo:'V-1001',groupName:'가상부서',product:'가상제품',part:'가상파트',rank:'사원',commuteMethod:'출퇴근',trainingDate:'2026-08-09'};

assert.deepEqual(onboarding.missingDocuments({submittedDocuments:['신분증 사본']}),['통장 사본','졸업증명서']);
assert.equal(onboarding.progress(applicant,{},[]).next,'입사서류 요청');
assert.equal(onboarding.progress(applicant,completeProfile,[]).next,'출근 확인');
assert.equal(onboarding.progress({...applicant,status:'출근'},completeProfile,[]).next,'사원명부 전환');

const duplicateEmployee={id:'employee-old',empNo:'v-1001',name:'가상기존사원',applicantId:'other-applicant'};
assert.equal(onboarding.validateEmployeeNumber('V-1001',applicant.id,[duplicateEmployee],[]).code,'DUPLICATE_EMPLOYEE_NUMBER');
assert.equal(onboarding.validateEmployeeNumber('V-2000',applicant.id,[],[{applicantId:'other-applicant',employeeNo:'v-2000'}]).code,'DUPLICATE_EMPLOYEE_NUMBER');

const beforeAttendance=onboarding.planConversion({applicant,profile:completeProfile,employees:[],profiles:[completeProfile],idFactory:()=> 'employee-new'});
assert.equal(beforeAttendance.code,'ATTENDANCE_REQUIRED');
const converted=onboarding.planConversion({applicant:{...applicant,status:'출근'},profile:completeProfile,employees:[],profiles:[completeProfile],idFactory:()=> 'employee-new',now:'2026-08-03T03:00:00.000Z'});
assert.equal(converted.ok,true);assert.equal(converted.created,true);assert.equal(converted.employee.applicantId,applicant.id);assert.equal(converted.applicant.employeeId,'employee-new');assert.equal(converted.employee.empNo,'V-1001');
for(const sensitive of ['residentNumber','phone','email','address'])assert.ok(!(sensitive in converted.employee),`사원 전환 자료에 ${sensitive}가 포함되면 안 됩니다.`);

const second=onboarding.planConversion({applicant:{...applicant,status:'출근',employeeId:'employee-new'},profile:completeProfile,employees:[converted.employee],profiles:[completeProfile],idFactory:()=> 'must-not-create'});
assert.equal(second.ok,true);assert.equal(second.created,false);assert.equal(second.employee.id,'employee-new');

const reverseLinked=onboarding.planConversion({applicant:{...applicant,status:'출근'},profile:completeProfile,employees:[converted.employee],profiles:[completeProfile],idFactory:()=> 'must-not-create'});
assert.equal(reverseLinked.created,false,'사원 쪽 applicantId 연결이 있으면 새 사원을 만들면 안 됩니다.');
const conflicting=onboarding.planConversion({applicant:{...applicant,status:'출근',employeeId:'employee-other'},profile:completeProfile,employees:[{...converted.employee,id:'employee-other',applicantId:'another-applicant'}],profiles:[completeProfile]});
assert.equal(conflicting.code,'LINK_CONFLICT','양방향 연결이 다르면 새 사원을 만들지 말고 충돌로 멈춰야 합니다.');

const cancelled={...applicant,status:'입사철회',finalDecision:'입사철회'};
assert.equal(onboarding.planConversion({applicant:cancelled,profile:completeProfile,employees:[],profiles:[completeProfile]}).code,'CANCELLED');
assert.equal(onboarding.progress(cancelled,completeProfile,[]).cancelled,true);

const rows=onboarding.buildRows([applicant,{...applicant,id:'applicant-2',name:'가상취소자',status:'입사철회',finalDecision:'입사철회'},{...applicant,id:'applicant-3',name:'가상준비자'}],[completeProfile],[]);
assert.equal(rows.length,3);assert.equal(onboarding.summary(rows).missingDocs,1);assert.equal(onboarding.summary(rows).missingNo,1);

const source=JSON.stringify(onboarding.buildRows([applicant],[{...completeProfile,residentNumber:'000000-0000000'}],[]).map(row=>({name:row.applicant.name,next:row.progress.next,missing:row.missing})));
assert.ok(!source.includes('000000-0000000'),'온보딩 요약 결과에 주민등록번호를 포함하면 안 됩니다.');

const many=Array.from({length:5000},(_,index)=>({...applicant,id:`applicant-${index}`,name:`가상입사자${index}`}));
const started=performance.now();assert.equal(onboarding.buildRows(many,[],[]).length,5000);assert.ok(performance.now()-started<1000,'5,000명 온보딩 분류가 1초 안에 끝나야 합니다.');

console.log('onboarding-management.test.js: 9단계·미제출 서류·사번 중복·1회 전환·취소·민감정보 최소화·5,000명 검사 통과');
