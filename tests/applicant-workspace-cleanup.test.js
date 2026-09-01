'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const applicants=read('js/applicants.js');
const detail=read('js/applicant-tools.js');
const screening=read('js/screening-workbench.js');
const advanced=read('js/applicant-bulk.js');
const reboot=read('js/ux-reboot-v12.js');
const index=read('index.html');
const applicantPageId=index.indexOf('id="applicants"');
const applicantPage=index.slice(index.lastIndexOf('<section',applicantPageId),index.indexOf('<section class="page" id="form"',applicantPageId));

const textFunction=applicants.match(/function excelPasteText\(v\)\{[^\n]+\}/)?.[0]||'';
const careerFunction=applicants.match(/function excelPasteCareerType\(value\)\{[\s\S]*?\n\}/)?.[0]||'';
assert.ok(textFunction&&careerFunction,'지원구분 붙여넣기 함수를 찾지 못했습니다.');
const classify=new Function(`${textFunction}\n${careerFunction}\nreturn excelPasteCareerType;`)();
assert.equal(classify('','가상 회사 경력 5년'),'','경력 문장만으로 지원구분을 자동 추정하면 안 됩니다.');
assert.equal(classify('신입','가상 회사 경력 5년'),'신입');
assert.equal(classify('경력',''),'경력');
assert.match(applicants,/present\.careerType=!!get\('careerType'\)/);
assert.doesNotMatch(applicants,/present\.careerType=[^;]*get\('career'\)/);

const expectedColumns=['no','name','phone','source','stage','next','schedule','apply-date','actions'];
const runtimeCols=reboot.match(/colgroup\.innerHTML='([^']+)'/)?.[1]||'';
assert.deepEqual([...runtimeCols.matchAll(/applicant-col-([a-z-]+)/g)].map(match=>match[1]),expectedColumns);
assert.deepEqual([...reboot.match(/head\.innerHTML='([^']+)'/)?.[1].matchAll(/class="([a-z-]+)-head"/g)||[]].map(match=>match[1]),expectedColumns);
assert.match(applicantPage,/지원경로/);assert.match(applicants,/a\.source\|\|'미입력'/);
assert.doesNotMatch(applicantPage,/지원 공고|담당자|검토점수|판정/);

const applicantUiSources=[applicants,detail,screening,advanced,reboot].join('\n');
for(const phrase of ['검토점수','우선검토','검토가능','추가확인','조건미흡 가능성','평가 요약','지원 공고 미연결','공고 미연결','채용경로 미입력'])assert.doesNotMatch(applicantUiSources,new RegExp(phrase),`${phrase} 자동평가·공고 UI 문구가 남아 있습니다.`);
assert.doesNotMatch(detail,/추천등급|전공적합도|경력적합도|자격적합도|현장적응도|직무적합분류/);
assert.doesNotMatch(screening,/deriveScores|calcScore/);
assert.doesNotMatch(advanced,/recruit_erp_applicant_manager_assignments|asManager|Manager|saveManagers|담당자 미지정/);
assert.doesNotMatch(reboot,/recruit_erp_applicant_manager_assignments|managerAssignments|managerOf|postingOf|지원자·공고·담당자/);
assert.match(reboot,/지원자·연락처·지원경로 검색/);
assert.doesNotMatch(applicants,/\[a\.school,a\.careerType\]/,'목록 성명 보조줄은 지원구분을 표시하면 안 됩니다.');

console.log('applicant-workspace-cleanup.test.js: 자동평가·담당자·공고 UI 제거, 9열, 지원구분 명시값 처리 확인 완료');
