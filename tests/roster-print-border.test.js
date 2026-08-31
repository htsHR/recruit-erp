'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'css','components.css'),'utf8');
const reports=fs.readFileSync(path.join(root,'js','reports.js'),'utf8');
const rosterCss=css.slice(css.indexOf('#rosterPrintArea'),css.indexOf('/* =========================================================',css.indexOf('#rosterPrintArea')));

assert.match(rosterCss,/--roster-print-line-color:#000;/);
assert.match(rosterCss,/--roster-print-line-width:0\.50mm;/);
assert.match(rosterCss,/#rosterPrintArea[\s\S]*-webkit-print-color-adjust:exact;[\s\S]*print-color-adjust:exact;/);
assert.match(rosterCss,/#rosterPrintArea \.roster-table\{[^}]*border:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\) !important;[^}]*border-collapse:separate !important;[^}]*border-spacing:0 !important;/);
assert.match(rosterCss,/#rosterPrintArea \.roster-table th,#rosterPrintArea \.roster-table td\{\s*border:0 !important;\s*border-right:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\) !important;\s*border-bottom:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\) !important;/);
assert.match(rosterCss,/#rosterPrintArea \.roster-table thead tr:first-child>th:last-child,[\s\S]*#rosterPrintArea \.roster-table tbody td\.roster-opinion\{border-right:0 !important;\}/);
assert.match(rosterCss,/#rosterPrintArea \.roster-table tbody tr:last-child>td,[\s\S]*#rosterPrintArea \.roster-table tbody tr:nth-last-child\(2\)>td\[rowspan="2"\]\{border-bottom:0 !important;\}/);
assert.doesNotMatch(rosterCss,/\.roster-table\{[^}]*border-collapse:collapse/,'평가표는 인쇄 시 회색으로 합성되는 collapsed border를 사용하면 안 됩니다.');
assert.match(rosterCss,/\.roster-name-head-divider\{[^}]*border-top:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\);/);
assert.match(rosterCss,/\.roster-oath-box\{[^}]*border:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\);/);
assert.doesNotMatch(rosterCss,/border(?:-top)?:1px solid/,'면접표 인쇄선에 화면용 1px 선이 남으면 안 됩니다.');
assert.doesNotMatch(rosterCss,/border(?:-top)?:[^;]*(?:rgba?\(|#[1-9a-f][0-9a-f]{2,5})/i,'면접표 인쇄선에 회색·알파 색상을 사용하면 안 됩니다.');
assert.match(rosterCss,/@page\{ size:A4 landscape; margin:12mm 23mm 15mm 23mm; \}/);

const context={
  applicants:[],
  normalizeStatus:value=>value,
  formatBirthDisplay:value=>String(value||''),
  esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  window:{addEventListener(){}},
  bind(){},
  requestAnimationFrame(){},
  alert(){},confirm(){return false;},
  document:{body:{classList:{remove(){},add(){}}},activeElement:null,querySelector(){return null;},addEventListener(){}},
  $(){return null;},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},STORAGE_KEY:'recruit_erp_applicants_stable',save(){return true;},renderAll(){},
  selectedCalendarDate:'',moveCalendarMonth(){},goCalendarToday(){},resetCalendarEventForm(){},renderCalendar(){},saveCalendarEventFromForm(){},deleteCalendarEvent(){},calendarWorkplaceFilter:'',
  console,Date
};
context.window.window=context.window;
vm.runInNewContext(reports,context,{filename:'reports.js'});

const date='2026-08-21';
context.applicants=[{id:'synthetic-semantic-1',name:'가상자동채움지원자',gender:'여자',birthYear:'2000-01-02',age:'26',status:'면접예정',interviewDate:date,interviewTime:'08:30'}];
const semanticHtml=context.buildRosterHtml(date);
[
  '에이치티솔루션','채용 면접 평가표',
  '본 평가에 있어 면접관 본인은 면접 응시자에 대한 주관을 배제하고 객관적으로 평가하였음을 밝힙니다.',
  '또한 평가자료, 평가 후 평가결과에 대해 외부로 그 내용을 절대 누설하지 않을 것을 서약합니다.',
  '면접일','면접관','NO','성명(성별)','생년월일(나이)','평가항목','지원동기/준비','지식/역량','규범/적극','태도/인성','합격여부','면접의견','Y / N',
  '- 평가 등급 : S(탁월), A(우수), B+(보통), B(미흡), C(매우 미흡)',
  '- 합격 기준 : 전문대↑(이공계) - 평균 B+ 이상 / 전문대↑(比이공계), 고교 - 평균 A 이상'
].forEach(text=>assert.ok(semanticHtml.includes(text),`평가표 고정 문구가 유지되어야 합니다: ${text}`));
assert.ok(semanticHtml.includes('가상자동채움지원자 (여)'),'성명과 성별 자동채움이 유지되어야 합니다.');
assert.ok(semanticHtml.includes('2000-01-02(26)'),'생년월일과 나이 자동채움이 유지되어야 합니다.');
assert.doesNotMatch(semanticHtml,/08:30|면접시간|순서 편집/,'면접시간과 순서 편집 UI는 인쇄물에 포함하면 안 됩니다.');

const expectedPages=new Map([[0,1],[1,1],[5,1],[6,2],[10,2]]);
for(const [count,pages] of expectedPages){
  context.applicants=Array.from({length:count},(_,index)=>({
    id:`synthetic-roster-${index+1}`,
    name:`가상지원자${index+1}`,
    gender:index%2?'여자':'남자',
    birthYear:'2000',
    status:'면접예정',
    interviewDate:date,
    interviewTime:`${String(9+Math.floor(index/2)).padStart(2,'0')}:${index%2?'30':'00'}`
  }));
  const html=context.buildRosterHtml(date);
  assert.equal((html.match(/class="roster-page"/g)||[]).length,pages,`${count}명 페이지 수`);
  assert.equal((html.match(/class="roster-table"/g)||[]).length,pages,`${count}명 표 수`);
  assert.equal((html.match(/class="roster-row-top"/g)||[]).length,pages*5,`${count}명은 페이지마다 5개 평가행을 유지해야 합니다.`);
  assert.equal((html.match(/가상지원자\d+/g)||[]).length,count,`${count}명 자동입력 수`);
  assert.deepEqual([...html.matchAll(/class="roster-no" rowspan="2">(\d+)</g)].map(match=>Number(match[1])),Array.from({length:count},(_,index)=>index+1),`${count}명 연속 번호`);
}

context.applicants=Array.from({length:6},(_,index)=>({id:`synthetic-manual-${index+1}`,name:`가상수동순서${index+1}`,gender:'남자',birthYear:'2001',age:'25',status:'면접예정',interviewDate:date,interviewTime:'09:00',rosterOrderDate:date,rosterOrder:6-index}));
const orderedHtml=context.buildRosterHtml(date);
assert.deepEqual([...orderedHtml.matchAll(/가상수동순서(\d+)/g)].map(match=>Number(match[1])),[6,5,4,3,2,1],'저장된 순서가 인쇄 성명 순서와 일치해야 합니다.');
assert.deepEqual([...orderedHtml.matchAll(/class="roster-no" rowspan="2">(\d+)</g)].map(match=>Number(match[1])),[1,2,3,4,5,6],'두 번째 페이지에서도 번호는 1부터 연속이어야 합니다.');

console.log('roster-print-border.test.js: 독립 순흑색 0.50mm 격자·고정 문구·자동채움·순서·0/1/5/6/10명 분할 확인 완료');
