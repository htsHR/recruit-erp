'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const index=read('index.html');
const applicants=read('js/applicants.js');
const enhancements=read('js/ui-enhancements.js');
const permissions=read('js/permissions.js');
const audit=read('js/audit-history.js');
const layout=read('css/layout.css');
const uiLayout=read('css/ui-layout.css');
const listLayout=read('css/list-layout.css');
const clearview=read('css/applicant-clearview.css');
const calm=read('css/design-calm-cascade.css');

const queue=index.match(/<div class="home-work-queue"[^>]*>([\s\S]*?)<\/div>/)?.[1]||'';
const queueTargets=[...queue.matchAll(/class="queue-card[^\"]*" data-task-target="([^"]+)"/g)].map(match=>match[1]);
assert.deepEqual(queueTargets,['today','overdue','contact','decision','hire'],'홈 업무 카드가 정확히 5개여야 합니다.');
assert.doesNotMatch(uiLayout,/queue-card[^\n{}]*nth-child[^{}]*display\s*:\s*none/i);
assert.match(enhancements,/today:'interviewToday',overdue:'overdue',contact:'contact',decision:'resultPending',hire:'hireUpcoming'/);

['no-head','name-head','workplace-head','status-head','actions-head'].forEach(className=>assert.match(index,new RegExp(`class="${className}"`)));
['sticky-app-no','sticky-app-name','sticky-app-workplace','sticky-app-status','sticky-app-actions'].forEach(className=>assert.match(applicants,new RegExp(className)));
assert.doesNotMatch(listLayout,/applicant-table[^\n{]*nth-child/,'지원자 열 소유권은 applicant-clearview.css에만 있어야 합니다.');
assert.doesNotMatch(clearview,/applicant-table\s+(?:thead\s+)?th:nth-child/,'지원자 고정 열은 의미 클래스를 사용해야 합니다.');
assert.doesNotMatch(calm,/applicant-table\s+thead\s+th:nth-child/,'최종 디자인도 지원자 열 번호에 의존하면 안 됩니다.');
assert.match(clearview,/\.workplace-head[\s\S]*\.workplace-cell/);assert.match(clearview,/\.actions-head[\s\S]*\.applicant-actions[\s\S]*right:0/);

const statusWorkflow=enhancements.match(/\/\* ---------- Status workflow ---------- \*\/[\s\S]*?\/\* ---------- Shared task cards ---------- \*\//)?.[0]||'';
assert.match(statusWorkflow,/applicantStatusModal/);assert.match(statusWorkflow,/aria-modal/);assert.match(statusWorkflow,/event\.key==='Escape'/);assert.match(statusWorkflow,/event\.key==='Tab'/);assert.doesNotMatch(statusWorkflow,/\bprompt\s*\(/);
assert.match(statusWorkflow,/uxAppendStatusMemo/);assert.match(statusWorkflow,/메모 추가/);assert.match(statusWorkflow,/if\(newMemo\)patch\.memo/);assert.match(statusWorkflow,/applicants=previous;renderAll\(\)/);
assert.match(enhancements,/required:\['name','phone','applyDate','workplace'\]/);assert.match(enhancements,/step-needs-review/);assert.match(enhancements,/optional:true/);assert.match(enhancements,/선택 입력/);assert.match(enhancements,/필수 \$\{requiredComplete\}\/\$\{requiredTotal\} 단계 완료/);
assert.doesNotMatch(calm,/^\.page-intro-card\{display:flex!important;\}/m);assert.match(calm,/\.page-intro-card\.safety-intro-card\{display:flex!important;\}/);assert.match(uiLayout,/#home \.home-dashboard-intro,#stats \.stats-intro\{display:none!important;\}/);

assert.match(permissions,/permission-matrix-row/);assert.match(permissions,/마지막 관리자 계정/);assert.match(permissions,/permission-result-notice/);
assert.match(audit,/auditTypeFilter/);assert.match(audit,/auditActionFilter/);assert.match(audit,/AUDIT_PAGE_SIZE=20/);assert.match(audit,/audit-detail/);
assert.match(layout,/html\{background:#f5f6f8;overflow-x:hidden;\}/);assert.match(layout,/body\{background:#f5f6f8;overflow-x:hidden;\}/);
assert.match(calm,/focus-visible/);assert.match(calm,/min-height:44px/);
assert.match(applicants,/document\.body\.dataset\.activePage=page/);
assert.match(uiLayout,/body\[data-active-page="form"\] \.topbar/);
const visualTest=read('tests/ui-visual-layout.js');
assert.match(visualTest,/formWorkflowBanner/);assert.match(visualTest,/formActions\.overlaps,false/);
assert.match(visualTest,/390x844-status-modal\.png'\),fullPage:false/);
assert.match(visualTest,/390x844-sync-conflict\.png'\),fullPage:false/);

const emptyTopbarButtons=[...index.matchAll(/<button[^>]*class="[^"]*topbar-icon-btn[^"]*"[^>]*>[\s\S]*?<\/button>/g)];
assert.equal(emptyTopbarButtons.length,0,'기능 없는 상단 아이콘 버튼이 남아 있습니다.');
assert.match(read('css/privacy-security.css'),/\.privacy-shield-button\{display:inline-grid!important/);

console.log('ui-layout.test.js: 5개 업무 카드·의미 기반 고정 열·모바일 권한/감사·상태 팝업 확인 완료');
