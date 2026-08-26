'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const head=index.match(/<head>[\s\S]*?<\/head>/)?.[0]||'';
const body=index.match(/<body[\s\S]*?<\/body>/)?.[0]||'';
const scripts=markup=>[...markup.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/g)].map(match=>({attrs:`${match[1]} ${match[3]}`,src:match[2].split('?')[0]}));

const headScripts=scripts(head);
const bodyScripts=scripts(body);
const critical=[
  'js/app-version.js',
  'js/factory-reset-v12.js',
  'js/safety.js',
  'js/security.js',
  'js/today-automation.js'
];
const application=[
  'js/permissions.js','js/audit-history.js','js/encrypted-backup.js','js/core.js','js/schools.js',
  'js/school-merge-manager.js','js/school-workforce-analytics.js','js/employee-master-xlsx-import.js',
  'js/employees.js','js/applicants.js','js/tasks.js','js/calendar.js','js/hire-waiting-automation.js',
  'js/hire-waiting-list.js','js/statistics.js','js/school-relations.js','js/detail-views.js',
  'js/school-workforce-ui.js','js/school-management-core.js','js/school-analytics.js','js/state-init.js',
  'js/reports.js','js/school-data-control.js','js/bindings.js','js/applicant-quick-entry.js',
  'js/recruiter-daily-usability.js','js/local-only-init.js','js/ui-enhancements.js','js/message-templates.js',
  'js/backup-center.js','js/encrypted-backup-ui.js','js/data-health.js','js/advanced-bulk.js',
  'js/applicant-filter.js','js/school-report.js','js/applicant-progress-history.js','js/form-flow-stability.js',
  'js/screening-workbench.js','js/phone-interview.js','js/privacy-security.js','js/storage-performance.js',
  'js/onboarding-management.js','js/production-readiness.js','js/applicant-worksheet.js','js/ux-reboot-v12.js'
];

assert.deepEqual(headScripts.map(script=>script.src),critical,'공장 초기화·안전 설정 5개는 head에서 먼저 실행되어야 합니다.');
headScripts.forEach(script=>{
  assert.doesNotMatch(script.attrs,/\bdefer\b/,'안전 선실행 스크립트에 defer를 추가하면 안 됩니다.');
  assert.doesNotMatch(script.attrs,/\basync\b/,'안전 선실행 스크립트에 async를 추가하면 안 됩니다.');
});
assert.deepEqual(bodyScripts.map(script=>script.src),application,'본문 스크립트의 의존 실행 순서가 바뀌면 안 됩니다.');
assert.equal(bodyScripts.length,45,'본문 앱 스크립트 수가 달라지면 로딩 계약을 다시 검토해야 합니다.');
bodyScripts.forEach(script=>{
  assert.match(script.attrs,/\bdefer\b/,'본문 앱 스크립트는 순서 보장형 병렬 다운로드를 사용해야 합니다.');
  assert.doesNotMatch(script.attrs,/\basync\b/,'의존 순서를 깨뜨리는 async를 사용하면 안 됩니다.');
});
assert.match(index,/<html class="ux12-booting"/);
assert.match(index,/id="ux12BootGuard"/);
assert.ok(application.indexOf('js/core.js')<application.indexOf('js/applicants.js'));
assert.ok(application.indexOf('js/state-init.js')<application.indexOf('js/reports.js'));
assert.equal(application.at(-1),'js/ux-reboot-v12.js');

console.log('initial-loading.test.js: 안전 선실행 5개·순서 보장 defer 45개 확인 완료');
