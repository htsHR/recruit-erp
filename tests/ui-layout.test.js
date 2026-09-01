'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('index.html');
const applicants=read('js/applicants.js');
const reports=read('js/reports.js');
const bindings=read('js/app-bindings.js');
const bulk=read('js/applicant-bulk.js');
const backup=read('js/backup-center.js');
const components=read('css/components.css');
const responsive=read('css/production-gate-responsive-polish.css');

for(const id of ['home','applicants','form','today','calendar','backup','applicantForm','applicantTbody','detailModal','excelRowPasteModal','bulkModal','calendarDecisionModal','rosterOrderEditor','rosterPrintArea'])assert.match(index,new RegExp(`id="${id}"`),`${id} 핵심 UI가 없습니다.`);
for(const page of ['stats','schools','employees','templates','advancedSearch','dataHealth','duplicates','permissions','auditHistory','onboarding','storagePerformance','productionReadiness'])assert.doesNotMatch(index,new RegExp(`id="${page}"`));
assert.equal((index.match(/class="nav-btn[^"]*"/g)||[]).length,4);
assert.match(index,/data-page="home"/);assert.match(index,/data-page="applicants"/);assert.match(index,/data-page="calendar"/);assert.match(index,/data-page="backup"/);
assert.match(index,/id="btnQuickApplicantEntry"/);assert.match(index,/data-go="form"/);assert.match(index,/data-go="today"/);
assert.equal((index.match(/data-excel-paste-shortcut/g)||[]).length,2,'홈·지원자 목록 엑셀 등록 바로가기가 모두 있어야 합니다.');
assert.match(index,/id="btnListExcelRowPaste"/);
assert.match(index,/id="searchInput"/);assert.match(index,/id="sortSelect"/);assert.match(index,/id="hideFinished"/);assert.match(index,/id="quickFilters"/);assert.match(index,/id="workplaceTabs"/);
assert.match(index,/id="btnRosterOrderEdit"/);assert.match(index,/id="btnRosterPrint"/);
assert.match(reports,/function rosterOrderedApplicants\(/);assert.match(reports,/function saveRosterOrderEditor\(/);assert.match(reports,/erpPermissions\.has\('applicant\.write'\)/);
assert.match(components,/--roster-print-line-color:#000/,'평가표 인쇄 격자 색은 검정이어야 합니다.');
assert.match(components,/border:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\) !important/);
assert.match(applicants,/applicant-list-empty-state/);assert.match(applicants,/applicant-empty-register/);assert.match(applicants,/applicant-empty-reset/);
assert.match(bindings,/findApplicantPhoneEmailDuplicate/);assert.match(bindings,/openNewApplicantExcelPaste/);assert.match(bindings,/openExcelRowPaste/);assert.match(bindings,/jsonImportMerge/);
assert.match(bulk,/bulkField/);assert.match(bulk,/bulkCsv/);assert.match(bulk,/bulkPrint/);assert.doesNotMatch(bulk,/advancedSearch|saved_advanced|messages\(/i);
assert.match(backup,/exportEncrypted/);assert.match(index,/id="bcEncryptedPanel"|id="bcCompanySection"/);
assert.match(responsive,/@media/,'핵심 화면의 반응형 스타일은 유지해야 합니다.');

console.log('ui-layout.test.js: 핵심 화면·입력·목록·평가표·백업 UI와 검정 인쇄 격자 확인 완료');
