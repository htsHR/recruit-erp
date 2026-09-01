'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('index.html');
const state=read('js/state-init.js');
const backup=read('js/backup-center.js');
const core=read('js/core.js');

const pageIds=[...index.matchAll(/<section\b[^>]*class="[^"]*\bpage\b[^"]*"[^>]*id="([^"]+)"|<section\b[^>]*id="([^"]+)"[^>]*class="[^"]*\bpage\b[^"]*"/g)].map(match=>match[1]||match[2]);
assert.deepEqual(pageIds,['home','applicants','form','today','calendar','backup']);
const navPages=[...index.matchAll(/class="nav-btn[^"]*"[^>]*data-page="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(navPages,['home','applicants','calendar','backup']);

const retiredPages=['stats','schools','employees','templates','advancedSearch','dataHealth','duplicates','permissions','auditHistory','onboarding','storagePerformance','productionReadiness'];
retiredPages.forEach(id=>assert.doesNotMatch(index,new RegExp(`id="${id}"`),`${id} 화면이 남아 있습니다.`));
for(const file of [
  'js/statistics.js','js/schools.js','js/employees.js','js/message-templates.js','js/applicant-filter.js','js/data-health.js',
  'js/onboarding-management.js','js/storage-performance.js','js/production-readiness.js','js/interview-operations.js',
  'css/permissions.css','css/audit-history.css','css/onboarding-management.css','css/storage-performance.css','css/production-readiness.css',
  'bridge/erp-bridge.js'
])assert.equal(fs.existsSync(path.join(root,file)),false,`${file}은(는) 핵심업무판에서 제거되어야 합니다.`);

for(const key of ['SCHOOLS_KEY','EMPLOYEES_KEY','HIRE_WAITING_PROFILES_KEY','MESSAGE_TEMPLATES_KEY']){
  assert.match(core,new RegExp(`const ${key} =`));
  assert.match(state,new RegExp(`${key}\\)`),`${key} 데이터는 전체 백업 호환을 위해 읽어야 합니다.`);
}
for(const dataset of ['schools','employees','hireWaitingProfiles','messageTemplates'])assert.match(backup,new RegExp(`key:'${dataset}'`));
assert.match(backup,/key:'applicants'[^\n]+critical:true/);
assert.doesNotMatch(backup,/key:'(?:schools|employees)'[^\n]+critical:true/);
assert.doesNotMatch(index,/btnDetailTemplate|bulkMessages|btnOpenApplicantFilter|applicantMyViews/);

console.log('core-only-scope.test.js: 핵심 6화면·4메뉴·불필요 모듈 삭제·구버전 데이터 백업 보존 확인 완료');
