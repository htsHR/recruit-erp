'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'css','components.css'),'utf8');
const reports=fs.readFileSync(path.join(root,'js','reports.js'),'utf8');
const rosterCss=css.slice(css.indexOf('#rosterPrintArea'),css.indexOf('/* =========================================================',css.indexOf('#rosterPrintArea')));

assert.match(rosterCss,/--roster-print-line-color:#000;/);
assert.match(rosterCss,/--roster-print-line-width:0\.35mm;/);
assert.match(rosterCss,/#rosterPrintArea[\s\S]*-webkit-print-color-adjust:exact;[\s\S]*print-color-adjust:exact;/);
assert.match(rosterCss,/\.roster-table\{[^}]*border:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\) !important;[^}]*border-collapse:collapse;/);
assert.match(rosterCss,/\.roster-table th,\.roster-table td\{\s*border:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\) !important;/);
assert.match(rosterCss,/\.roster-name-head-divider\{[^}]*border-top:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\);/);
assert.match(rosterCss,/\.roster-oath-box\{[^}]*border:var\(--roster-print-line-width\) solid var\(--roster-print-line-color\);/);
assert.doesNotMatch(rosterCss,/border(?:-top)?:1px solid/,'면접표 인쇄선에 화면용 1px 선이 남으면 안 됩니다.');
assert.doesNotMatch(rosterCss,/border(?:-top)?:[^;]*(?:rgba?\(|#[1-9a-f][0-9a-f]{2,5})/i,'면접표 인쇄선에 회색·알파 색상을 사용하면 안 됩니다.');
assert.match(rosterCss,/@page\{ size:A4 landscape; margin:12mm 23mm 15mm 23mm; \}/);

const reportsHash=crypto.createHash('sha256').update(reports).digest('hex');
assert.equal(reportsHash,'4e60ffed53267047adb65c4c087237d8404fe4def1f2b5585d8d6f65839d7cb2','면접표 텍스트·자동입력·5명 분할 로직은 변경하면 안 됩니다.');

const context={
  applicants:[],
  normalizeStatus:value=>value,
  formatBirthDisplay:value=>String(value||''),
  esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  window:{addEventListener(){}},
  bind(){},
  requestAnimationFrame(){},
  alert(){},confirm(){return false;},
  document:{body:{classList:{remove(){},add(){}}}},
  $(){return {value:'',innerHTML:''};},
  selectedCalendarDate:'',moveCalendarMonth(){},goCalendarToday(){},resetCalendarEventForm(){},renderCalendar(){},saveCalendarEventFromForm(){},deleteCalendarEvent(){},calendarWorkplaceFilter:'',
  console,Date
};
context.window.window=context.window;
vm.runInNewContext(reports,context,{filename:'reports.js'});

const date='2026-08-21';
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
}

console.log('roster-print-border.test.js: 순흑색 0.35mm 인쇄선·불변 보고서 로직·0/1/5/6/10명 페이지 분할 확인 완료');
