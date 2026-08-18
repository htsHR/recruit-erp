'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const applicants=read('js/applicants.js');
const css=read('css/applicant-quick-detail.css');
const index=read('index.html');
const feature=applicants.match(/const APPLICANT_QUICK_DETAIL_EMPTY=[\s\S]*?function renderApplicantPagination/)?.[0]||'';
const renderer=applicants.match(/function renderApplicantQuickDetail\(\)[\s\S]*?function openApplicantQuickDetail\(/)?.[0]||'';

assert.ok(feature,'지원자 빠른 보기 구현을 찾지 못했습니다.');
assert.match(index,/css\/applicant-quick-detail\.css\?v=11\.4\.1/);
assert.match(feature,/if\(document\.getElementById\('applicantQuickDetail'\)\)return/,'빠른 보기 패널은 한 번만 만들어야 합니다.');
assert.equal((feature.match(/shell\.id='applicantQuickDetail'/g)||[]).length,1,'빠른 보기 패널 생성 지점은 하나여야 합니다.');
assert.match(feature,/role="dialog"/);assert.match(feature,/aria-modal="true"/);assert.match(feature,/aria-labelledby="applicantQuickDetailTitle"/);
assert.match(feature,/event\.key==='Escape'/);assert.match(feature,/event\.key!=='Tab'/);assert.match(feature,/restoreFocus/);
assert.match(feature,/filtered\(\)/);assert.match(feature,/Math\.floor\(nextIndex\/applicantPageSize\)\+1/);assert.match(feature,/currentApplicantPage=targetPage/);
assert.match(feature,/applicantQuickDetailCanWrite/);assert.match(feature,/data-required-permission="applicant\.write"/);
assert.match(feature,/button,select,a,input,textarea,label,summary,details/,'행 안의 기존 조작 요소를 빠른 보기에서 제외해야 합니다.');
assert.match(applicants,/class="view" data-erp-handler="event\.stopPropagation\(\);viewApplicant/,'기존 전체 상세보기 동작을 유지해야 합니다.');
assert.match(applicants,/data-erp-handler="event\.stopPropagation\(\);editApplicant/);assert.match(applicants,/data-erp-handler="event\.stopPropagation\(\);deleteApplicant/);
assert.doesNotMatch(renderer,/residentNumber|Object\.values/,'빠른 보기는 허용 필드만 명시적으로 표시하고 주민등록번호를 참조하지 않아야 합니다.');
assert.doesNotMatch(feature,/localStorage|sessionStorage|erpSharedStorage|\/storage\/snapshot|\bsave\s*\(/,'빠른 보기 열기·이동·닫기는 저장 계층을 호출하면 안 됩니다.');
assert.match(css,/width:clamp\(420px,34vw,480px\)/);assert.match(css,/@media\(max-width:900px\)[\s\S]*width:100%/);assert.match(css,/body\.applicant-quick-detail-open\{overflow:hidden\}/);

console.log('applicant-quick-detail.test.js: 단일 패널·읽기 전용 필드·기존 조작 분리·권한·접근성·저장 비호출 확인 완료');
