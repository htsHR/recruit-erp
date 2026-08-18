'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const automation=require('../js/today-automation.js');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js','tasks.js'),'utf8');
const permissionsSource=fs.readFileSync(path.join(root,'js','permissions.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const TODAY='2026-08-03';
const row=(id,status,extra={})=>({id,name:`가상지원자-${id}`,status,applyDate:'2026-08-01',createdAt:'2026-08-01T09:00:00.000Z',...extra});
const rows=[
  row('screen','서류검토'),
  row('phone','서류합격'),
  row('recall-today','부재중',{nextContactDate:TODAY}),
  row('recall-overdue','부재중',{nextContactDate:'2026-08-02'}),
  row('interview','면접예정',{interviewDate:TODAY}),
  row('result','면접완료',{interviewDate:'2026-08-02'}),
  row('hire-0','입사예정',{hireDate:TODAY}),
  row('hire-3','입사예정',{hireDate:'2026-08-06'}),
  row('hire-4','입사예정',{hireDate:'2026-08-07'}),
  row('attendance','입사예정',{hireDate:'2026-08-02'}),
  row('stale','서류검토',{createdAt:'2026-07-20T09:00:00.000Z'}),
  row('recent','서류검토',{progressHistory:[{createdAt:'2026-08-02T10:00:00.000Z'}]}),
  row('finished','불합격',{interviewDate:'2026-08-01'}),
  row('decided','면접완료',{interviewDate:'2026-08-01',finalDecision:'합격'})
];

const groups=automation.buildGroups(rows,{today:TODAY});
const ids=group=>groups[group].map(item=>item.id);
assert.equal(automation.VERSION,'11.0.0');
assert.equal(automation.STALE_DAYS,14);
assert.equal(automation.HIRE_SOON_DAYS,3);
assert.deepEqual(ids('contactToday'),['recall-today']);
assert.deepEqual(ids('contactOverdue'),['recall-overdue']);
assert.deepEqual(ids('interviewToday'),['interview']);
assert.deepEqual(ids('resultPending'),['result']);
assert.deepEqual(ids('hireUpcoming'),['hire-0','hire-3'],'입사 임박은 당일부터 3일 이내만 포함해야 합니다.');
assert.ok(!ids('hireUpcoming').includes('hire-4'),'D-4 지원자는 3일 내 입사에 포함되면 안 됩니다.');
assert.deepEqual(ids('attendancePending'),['attendance']);
assert.ok(ids('stagnant').includes('stale'),'정확히 14일 지난 지원자는 장기 미처리에 포함해야 합니다.');
assert.ok(!ids('stagnant').includes('recent'),'최근 변경 이력이 있으면 장기 미처리에서 제외해야 합니다.');
assert.ok(!Object.values(groups).flat().some(item=>item.id==='finished'||item.id==='decided'),'종료·최종 판정 지원자는 처리 큐에서 제외해야 합니다.');
assert.equal(new Set(groups.overdue.map(item=>item.id)).size,groups.overdue.length,'여러 조건에 걸린 지원자는 한 번만 표시해야 합니다.');
assert.deepEqual(automation.summary(groups),{dueToday:3,overdue:3,changedToday:0,urgent:4});

const bulk=Array.from({length:5000},(_,index)=>row(`perf-${index}`,'서류검토',{createdAt:'2026-08-01T09:00:00.000Z'}));
const started=Date.now();
const bulkGroups=automation.buildGroups(bulk,{today:TODAY});
assert.equal(bulkGroups.screening.length,5000);
assert.ok(Date.now()-started<3000,'지원자 5,000명 분류는 3초 안에 끝나야 합니다.');

assert.match(index,/js\/today-automation\.js\?v=11\.3\.0/);
assert.match(index,/오늘부터 D-3까지/);
assert.match(index,/입사 임박[\s\S]*D-3 이내/);
assert.match(index,/dailySummaryUrgent/);
assert.match(index,/data-required-permission="applicant\.write" id="btnDailyStartFirst"/);
assert.match(source,/erpTodayAutomation\.buildGroups/);
assert.match(source,/updateApplicantStatus\(a\.id,'출근'\)/);
assert.match(source,/\$\('detailQuickStatus'\)/);
assert.match(source,/data-required-permission="applicant\.write"/);
assert.match(permissionsSource,/#btnDailyStartFirst/);

console.log('today-automation.test.js: 오늘 연락·면접·결과·D-3 입사·출근·14일 정체·권한·5,000명 성능 확인 완료');
