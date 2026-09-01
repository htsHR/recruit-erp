'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'js','reports.js'),'utf8');
const css=fs.readFileSync(path.join(root,'css','components.css'),'utf8');
const date='2026-09-03';
const classes=new Set();
const events={};
const documentEvents={};
const timers=new Map();
let timerSequence=0;
let layoutReads=0;
let printCalls=0;
const alerts=[];

function button(id,disabled=false){
  const attributes=new Map();
  return {
    id,disabled,attributes,
    closest(selector){return selector.split(',').some(item=>item.trim()===`#${id}`)?this:null;},
    setAttribute(name,value){attributes.set(name,String(value));},removeAttribute(name){attributes.delete(name);}
  };
}
const elements={
  rosterDate:{value:date},
  rosterPrintArea:{innerHTML:'',get offsetHeight(){layoutReads+=1;return 1120;}},
  btnRosterPrint:button('btnRosterPrint'),
  btnCalendarPrintRoster:button('btnCalendarPrintRoster'),
  btnRosterOrderSavePrint:button('btnRosterOrderSavePrint',true)
};
const context={
  applicants:[{id:'synthetic-print-1',name:'가상인쇄지원자',gender:'남자',birthYear:'2000-01-01',age:'26',status:'면접예정',interviewDate:date,interviewTime:'09:00'}],
  normalizeStatus:value=>value,
  formatBirthDisplay:value=>String(value||''),
  esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
  window:{
    addEventListener(name,handler){(events[name]??=[]).push(handler);},
    print(){
      printCalls+=1;
      assert.equal(classes.has('roster-printing'),true,'print 호출 전에 인쇄 상태가 활성화되어야 합니다.');
      assert.match(elements.rosterPrintArea.innerHTML,/가상인쇄지원자/,'print 호출 전에 명단 HTML이 준비되어야 합니다.');
    }
  },
  bind(){},requestAnimationFrame(callback){callback();},
  setTimeout(handler){const id=++timerSequence;timers.set(id,handler);return id;},
  clearTimeout(id){timers.delete(id);},
  alert(message){alerts.push(message);},confirm(){return false;},
  document:{body:{classList:{add(name){classes.add(name);},remove(name){classes.delete(name);}}},activeElement:null,querySelector(){return null;},addEventListener(name,handler){(documentEvents[name]??=[]).push(handler);}},
  $:id=>elements[id]||null,
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},STORAGE_KEY:'recruit_erp_applicants_stable',save(){return true;},renderAll(){},
  selectedCalendarDate:'',moveCalendarMonth(){},goCalendarToday(){},resetCalendarEventForm(){},renderCalendar(){},saveCalendarEventFromForm(){},deleteCalendarEvent(){},calendarWorkplaceFilter:'',
  console:{...console,error(){}},Date
};
context.window.window=context.window;
vm.runInNewContext(reports,context,{filename:'reports.js'});

let defaultPrevented=false;
assert.equal(documentEvents.click.length,1,'인쇄 버튼 클릭은 교체되지 않는 document에 위임해야 합니다.');
documentEvents.click[0]({target:elements.btnRosterPrint,preventDefault(){defaultPrevented=true;}});
assert.equal(defaultPrevented,true,'인쇄 버튼의 기본 동작을 차단해야 합니다.');
assert.equal(printCalls,1,'인쇄 버튼 한 번은 print를 한 번만 호출해야 합니다.');
assert.equal(layoutReads,1,'print 호출 전에 출력 영역 레이아웃을 강제로 계산해야 합니다.');
assert.equal(context.window.erpRosterOrderEditor.__test.printState.active,true,'인쇄 완료 이벤트 전에는 중복 요청을 잠가야 합니다.');
assert.equal(elements.btnRosterPrint.disabled,true,'인쇄 중에는 기본 인쇄 버튼을 잠가야 합니다.');
assert.equal(elements.btnRosterPrint.attributes.get('aria-busy'),'true','인쇄 중 상태를 보조기기에 알려야 합니다.');
assert.equal(context.openRosterPrint(),false,'인쇄 중 두 번째 요청은 거부해야 합니다.');
assert.equal(printCalls,1,'중복 클릭으로 print가 추가 호출되면 안 됩니다.');

events.afterprint[0]();
assert.equal(classes.has('roster-printing'),false,'인쇄 완료 뒤 인쇄 클래스를 제거해야 합니다.');
assert.equal(context.window.erpRosterOrderEditor.__test.printState.active,false,'인쇄 완료 뒤 잠금을 해제해야 합니다.');
assert.equal(elements.btnRosterPrint.disabled,false,'기본 인쇄 버튼 상태를 복원해야 합니다.');
assert.equal(elements.btnRosterOrderSavePrint.disabled,true,'원래 비활성 버튼은 기존 상태를 유지해야 합니다.');
assert.equal(elements.btnRosterPrint.attributes.has('aria-busy'),false,'인쇄 완료 뒤 busy 상태를 제거해야 합니다.');
assert.equal(timers.size,0,'인쇄 완료 뒤 남은 정리 타이머가 없어야 합니다.');

context.window.print=()=>{throw new Error('synthetic print failure');};
assert.equal(context.openRosterPrint(),false,'브라우저 print 예외는 실패로 반환해야 합니다.');
assert.equal(classes.has('roster-printing'),false,'print 예외 뒤 화면 상태를 즉시 복구해야 합니다.');
assert.equal(context.window.erpRosterOrderEditor.__test.printState.active,false,'print 예외 뒤 재시도할 수 있어야 합니다.');
assert.match(alerts.at(-1),/인쇄 창을 열지 못했습니다/,'print 예외는 사용자에게 안내해야 합니다.');

const openPrintSource=reports.slice(reports.indexOf('function openRosterPrint(){'),reports.indexOf('function openRosterPrintFromOrderEditor(){'));
assert.doesNotMatch(openPrintSource,/requestAnimationFrame/,'print 호출을 화면 갱신 콜백에 중복 예약하면 안 됩니다.');
assert.match(openPrintSource,/void printArea\.offsetHeight;[\s\S]*window\.print\(\);/,'선레이아웃 뒤 같은 사용자 동작 안에서 print를 호출해야 합니다.');
assert.doesNotMatch(reports,/bind\('btn(?:RosterPrint|CalendarPrintRoster|RosterOrderSavePrint)'/,'교체될 수 있는 인쇄 버튼에 직접 이벤트를 묶으면 안 됩니다.');
assert.match(reports,/document\.addEventListener\('click',handleRosterPrintClick\)/,'인쇄 버튼은 document 위임 이벤트로 연결해야 합니다.');
assert.match(css,/body\.roster-printing #rosterPrintArea\{[\s\S]*display:block;[\s\S]*position:fixed;[\s\S]*visibility:hidden;/,'화면 밖 선레이아웃 규칙이 필요합니다.');
assert.match(css,/@media print\{[\s\S]*body\.roster-printing #rosterPrintArea\{[^}]*position:static !important;[^}]*visibility:visible !important;/,'실제 인쇄에서는 출력 영역을 보여야 합니다.');

console.log('roster-print-flow.test.js: 위임 클릭·단일 print 호출·중복 차단·선레이아웃·완료/실패 복구 확인 완료');
