'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const applicants=read('js/applicants.js');
const css=read('css/applicant-quick-detail.css');
const rebootCss=read('css/ux-reboot-v12.css');
const index=read('index.html');
const feature=applicants.match(/const APPLICANT_QUICK_DETAIL_EMPTY=[\s\S]*?function renderApplicantPagination/)?.[0]||'';
const renderer=applicants.match(/function renderApplicantQuickDetail\(\)[\s\S]*?function openApplicantQuickDetail\(/)?.[0]||'';
const readActions=applicants.match(/function openApplicantQuickDetail\([\s\S]*?function startApplicantQuickEdit\(/)?.[0]||'';
const saveAction=applicants.match(/function saveApplicantQuickEdit\(\)[\s\S]*?function applicantQuickDetailFocusables/)?.[0]||'';
const allowed=['name','phone','email','region','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo'];

assert.ok(feature,'지원자 빠른 보기 구현을 찾지 못했습니다.');
assert.match(index,/css\/applicant-quick-detail\.css\?v=12\.5\.1/);
assert.match(feature,/if\(document\.getElementById\('applicantQuickDetail'\)\)return/,'빠른 보기 패널은 한 번만 만들어야 합니다.');
assert.equal((feature.match(/shell\.id='applicantQuickDetail'/g)||[]).length,1,'빠른 보기 패널 생성 지점은 하나여야 합니다.');
assert.match(feature,/role="dialog"/);assert.match(feature,/aria-modal="true"/);assert.match(feature,/aria-labelledby="applicantQuickDetailTitle"/);
assert.match(feature,/event\.key==='Escape'/);assert.match(feature,/event\.key!=='Tab'/);assert.match(feature,/restoreFocus/);
assert.match(feature,/filtered\(\)/);assert.match(feature,/Math\.floor\(nextIndex\/applicantPageSize\)\+1/);assert.match(feature,/currentApplicantPage=targetPage/);
assert.match(feature,/applicantQuickDetailCanWrite/);assert.match(feature,/data-required-permission="applicant\.write"/);
assert.deepEqual([...feature.matchAll(/const APPLICANT_QUICK_EDIT_FIELDS=Object\.freeze\(\[([^\]]+)\]\)/g)][0][1].match(/'([^']+)'/g).map(value=>value.slice(1,-1)),allowed);
allowed.forEach(field=>assert.match(feature,new RegExp(`data-quick-field=\\"${field}\\"`)));
assert.match(feature,/button,select,a,input,textarea,label,summary,details/,'행 안의 기존 조작 요소를 빠른 보기에서 제외해야 합니다.');
assert.match(applicants,/class="applicant-row-more"/,'행별 반복 버튼 대신 보조 행동 더보기 메뉴를 유지해야 합니다.');
assert.match(applicants,/role="menuitem" data-erp-handler="event\.stopPropagation\(\);viewApplicant/,'더보기 메뉴에서 전체 상세보기 동작을 유지해야 합니다.');
assert.match(applicants,/data-erp-handler="event\.stopPropagation\(\);editApplicant/);assert.match(applicants,/data-erp-handler="event\.stopPropagation\(\);deleteApplicant/);
assert.doesNotMatch(renderer,/residentNumber|Object\.values/,'빠른 보기는 허용 필드만 명시적으로 표시하고 주민등록번호를 참조하지 않아야 합니다.');
assert.doesNotMatch(feature,/residentNumber|employeeNo|deleteApplicant|erpSharedStorage|\/storage\/snapshot/,'빠른 수정은 허용 범위 밖 정보나 삭제·공용저장 기능을 참조하면 안 됩니다.');
assert.doesNotMatch(readActions,/\bsave\s*\(/,'빠른 보기 열기·이동·닫기는 저장을 호출하면 안 됩니다.');
assert.equal((saveAction.match(/\bsave\(\)/g)||[]).length,1,'빠른 수정 저장은 기존 save()를 정확히 한 번만 호출해야 합니다.');
assert.match(saveAction,/if\(!applicantQuickDetailCanWrite\(\)/);assert.match(saveAction,/applicants=before/);assert.match(saveAction,/applicantQuickDetailState\.mode='edit'/);assert.match(saveAction,/입력 내용은 유지/);
assert.match(feature,/applicantQuickDetailConfirmDiscard/);assert.match(feature,/applicantQuickDetailIsDirty/);assert.match(feature,/btnApplicantQuickDetailCancel/);assert.match(feature,/btnApplicantQuickDetailSave/);
assert.match(rebootCss,/width:clamp\(360px,28vw,420px\)/);assert.match(css,/@media\(max-width:900px\)[\s\S]*width:100%/);assert.match(css,/body\.applicant-quick-detail-open\{overflow:hidden\}/);
assert.match(rebootCss,/applicant-quick-detail-panel\.is-editing[^{]*\{[^}]*560px/);assert.match(css,/applicant-quick-edit-grid/);
assert.match(feature,/erpUx12Router\?\.onQuickOpen/);assert.match(feature,/erpUx12Router\?\.onQuickClose/);

console.log('applicant-quick-detail.test.js: 단일 패널·13개 허용필드·명시 저장 1회·원복·권한·접근성 확인 완료');
