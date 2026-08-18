'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const automation=require('../js/today-automation.js');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const TODAY='2026-08-19';
const base=(id,status,extra={})=>({id,name:`가상지원자-${id}`,status,createdAt:'2026-08-18T09:00:00.000Z',applyDate:'2026-08-18',...extra});
const fixtures=[
  base('overdue-old','부재중',{nextContactDate:'2026-08-17',lastContactDate:'2026-08-01'}),
  base('overdue-new','부재중',{nextContactDate:'2026-08-18',lastContactDate:'2026-08-10'}),
  base('interview','면접예정',{interviewDate:TODAY}),
  base('recall','부재중',{nextContactDate:TODAY}),
  base('result','면접완료',{interviewDate:'2026-08-18'}),
  base('hire','입사예정',{hireDate:'2026-08-22'}),
  base('stagnant','서류검토',{createdAt:'2026-07-01T09:00:00.000Z'}),
  base('multi','부재중',{nextContactDate:'2026-08-18',createdAt:'2026-07-01T09:00:00.000Z'}),
  base('tie-a','부재중',{nextContactDate:'2026-08-18',createdAt:'2026-08-01T09:00:00.000Z'}),
  base('tie-b','부재중',{nextContactDate:'2026-08-18',createdAt:'2026-08-01T09:00:00.000Z'})
];
while(fixtures.length<60)fixtures.push(base(`normal-${fixtures.length}`,'서류검토',{createdAt:'2026-08-18T09:00:00.000Z'}));

const selection=automation.buildWorkflowRows(fixtures,{today:TODAY});
assert.equal(automation.VERSION,'11.5.0');
assert.equal(selection.rows.length,new Set(selection.rows.map(row=>row.applicant.id)).size,'한 지원자는 실행 목록에 한 번만 보여야 합니다.');
const priorities=selection.rows.map(row=>row.priority);
assert.deepEqual(priorities,[...priorities].sort((a,b)=>a-b),'업무 우선순위가 기한경과→오늘면접→재연락→결과→입사→정체 순이어야 합니다.');
const multi=selection.rows.find(row=>row.applicant.id==='multi');
assert.deepEqual(multi.reasons.map(reason=>reason.key),['overdue','recall','stagnant'],'여러 사유는 한 행의 배지로 함께 보여야 합니다.');
assert.ok(selection.rows.findIndex(row=>row.applicant.id==='overdue-old')<selection.rows.findIndex(row=>row.applicant.id==='overdue-new'),'같은 우선순위에서는 오래 미처리된 대상이 먼저여야 합니다.');
assert.ok(selection.rows.findIndex(row=>row.applicant.id==='tie-a')<selection.rows.findIndex(row=>row.applicant.id==='tie-b'),'동률이면 기존 입력 순서를 안정적으로 유지해야 합니다.');
assert.deepEqual(automation.buildWorkflowRows([],{today:TODAY}).rows,[],'빈 데이터는 빈 실행 목록이어야 합니다.');

const tasks=read('js/tasks.js'),applicants=read('js/applicants.js'),quick=read('js/applicant-quick-entry.js'),index=read('index.html');
assert.match(tasks,/function dailyWorkflowSelection\(\)/);
assert.match(tasks,/erpTodayAutomation\.buildWorkflowRows/);
assert.match(applicants,/window\.dailyWorkflowSelection\?\.\(\)/,'홈도 오늘 업무와 같은 선택기를 사용해야 합니다.');
assert.match(tasks,/role="button" tabindex="0"/);
assert.match(tasks,/openApplicantQuickDetailFromWorkflow/);
assert.match(index,/id="btnQuickApplicantEntry"/);
assert.match(index,/id="applicantAuxiliaryFilterSummary"/);
assert.match(index,/data-filter="todayAction"/);
assert.doesNotMatch(quick,/QUICK_DEFAULTS_KEY|localStorage\.setItem\([^\n]*quick/i,'빠른 등록 전용 저장 키를 만들면 안 됩니다.');
assert.match(quick,/if\(!canWrite\(\)\)/,'직접 함수 호출도 쓰기 권한을 검사해야 합니다.');
assert.match(quick,/let saved=false;try\{saved=save\(\)===true;/,'최종 확인 뒤 기존 save()를 한 번만 호출해야 합니다.');
assert.equal((quick.match(/save\(\)===true/g)||[]).length,1,'빠른 등록 저장 호출은 정확히 한 곳이어야 합니다.');
assert.match(quick,/applicants=beforeApplicants/);
assert.match(quick,/restoreBrowserSnapshot\(beforeStorage\)/);
assert.match(quick,/중복 가능성을 확인해야 등록할 수 있습니다/);

console.log('recruiter-daily-workflow.test.js: 60명 우선순위·중복제거·다중사유·동률·빈상태·공통선택기·빠른등록 보호 확인 완료');
