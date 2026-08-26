'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'js','reports.js'),'utf8');
const core=fs.readFileSync(path.join(root,'js','core.js'),'utf8');
const STORAGE_KEY='recruit_erp_applicants_stable';
const DATE_A='2026-08-21';
const DATE_B='2026-08-22';
const clone=value=>JSON.parse(JSON.stringify(value));
const ids=rows=>Array.from(rows,row=>row.id);

function syntheticApplicant(id,overrides={}){
  return {
    id,name:`가상면접자${id}`,phone:`010-0000-${String(id).replace(/\D/g,'').slice(-4).padStart(4,'0')}`,
    email:`synthetic-${id}@example.invalid`,status:'면접예정',interviewDate:DATE_A,interviewTime:'09:00',
    createdAt:`2026-08-20T${String((Number(String(id).replace(/\D/g,''))||0)%24).padStart(2,'0')}:00:00.000Z`,
    source:'가상채널',memo:'가상 메모',career:'가상 경력',gender:'남자',birthYear:'2000',
    ...overrides
  };
}

function createHarness(){
  const storage=new Map();
  const listeners=new Map();
  const classSet=new Set();
  const makeNode=id=>({
    id,value:'',innerHTML:'',textContent:'',className:'',hidden:false,disabled:false,dataset:{},attributes:{},events:{},
    classList:{add(...names){names.forEach(name=>classSet.add(`${id}:${name}`));},remove(...names){names.forEach(name=>classSet.delete(`${id}:${name}`));},contains(name){return classSet.has(`${id}:${name}`);}},
    addEventListener(type,handler){this.events[type]=handler;},setAttribute(name,value){this.attributes[name]=String(value);},getAttribute(name){return this.attributes[name]??null;},
    querySelectorAll(){return [];},querySelector(){return null;},getClientRects(){return [{}];},focus(){document.activeElement=this;}
  });
  const ids=['rosterDate','rosterOrderEditor','rosterOrderEditorList','rosterOrderEditorDate','rosterOrderEditorCount','rosterOrderEditorStatus','rosterOrderEditorFeedback','btnRosterOrderEdit','btnCalendarRosterOrderEdit','btnRosterOrderClose','btnRosterOrderCancel','btnRosterOrderTimeSort','btnRosterOrderSave'];
  const nodes=Object.fromEntries(ids.map(id=>[id,makeNode(id)]));
  const backdrop=makeNode('rosterOrderEditorBackdrop');
  const body=makeNode('body');
  const document={
    activeElement:nodes.btnRosterOrderEdit,body,
    querySelector(selector){return selector==='[data-roster-order-close]'?backdrop:null;},
    addEventListener(type,handler){listeners.set(type,handler);}
  };
  let canWrite=true,requireCalls=0,saveCalls=0,alerts=[],confirms=[],confirmResult=true;
  let saveBehavior=null;
  const context={
    applicants:[],normalizeStatus:value=>String(value||''),formatBirthDisplay:value=>String(value||''),
    esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
    document,localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},STORAGE_KEY,
    window:{
      addEventListener(){},requestAnimationFrame:callback=>callback(),print(){},editApplicant(){},
      erpPermissions:{has:permission=>permission==='applicant.write'&&canWrite,require(){requireCalls++;return canWrite;}}
    },
    $:id=>nodes[id]||null,
    bind(id,type,handler){nodes[id]?.addEventListener(type,handler);},requestAnimationFrame:callback=>callback(),
    alert(message){alerts.push(String(message));},confirm(message){confirms.push(String(message));return confirmResult;},
    renderAll(){},selectedCalendarDate:'',moveCalendarMonth(){},goCalendarToday(){},resetCalendarEventForm(){},renderCalendar(){},saveCalendarEventFromForm(){},deleteCalendarEvent(){},calendarWorkplaceFilter:'',
    console,Date,Map,Set,JSON,Number,String,Object,Array,Math
  };
  context.window.window=context.window;
  context.save=()=>{saveCalls++;return saveBehavior?saveBehavior(context,storage):true;};
  vm.runInNewContext(reports,context,{filename:'reports.js'});
  const api=context.window.erpRosterOrderEditor;
  return {
    context,api,nodes,storage,listeners,
    setApplicants(rows,{persist=true}={}){context.applicants=clone(rows);nodes.rosterDate.value=DATE_A;if(persist)storage.set(STORAGE_KEY,JSON.stringify(context.applicants));},setCalendarDate(value){context.selectedCalendarDate=value;},
    setCanWrite(value){canWrite=value;},setConfirm(value){confirmResult=value;},setSaveBehavior(fn){saveBehavior=fn;},
    resetCounters(){saveCalls=0;requireCalls=0;alerts=[];confirms=[];},
    counts(){return{saveCalls,requireCalls,alerts:[...alerts],confirms:[...confirms]};}
  };
}

const h=createHarness();
const {api,context,nodes,storage}=h;

// 기본 시간순: 유효시간 우선, 빈 시간 후순위, 같은 시간은 생성시각/ID/원본순으로 안정 정렬한다.
const defaultRows=[
  syntheticApplicant('1',{interviewTime:'09:00',createdAt:'2026-08-20T01:00:00.000Z'}),
  syntheticApplicant('2',{interviewTime:'',createdAt:'2026-08-20T02:00:00.000Z'}),
  syntheticApplicant('3',{interviewTime:'08:30',createdAt:'2026-08-20T03:00:00.000Z'}),
  syntheticApplicant('4',{interviewTime:'09:00',createdAt:'2026-08-20T04:00:00.000Z'})
];
assert.deepEqual(ids(api.orderedApplicants(DATE_A,defaultRows)),['3','1','4','2']);
assert.deepEqual(ids(api.orderedApplicants(DATE_A,defaultRows)),ids(api.orderedApplicants(DATE_A,clone(defaultRows))),'기본 정렬은 새로고침 후에도 안정적이어야 합니다.');

// 저장된 기존 5명 뒤에 더 빠른 시간의 신규 면접자를 붙인다.
const savedFive=Array.from({length:5},(_,index)=>syntheticApplicant(`saved-${index+1}`,{interviewTime:`0${index+9}:00`.slice(-5),rosterOrderDate:DATE_A,rosterOrder:index+1,createdAt:`2026-08-19T0${index}:00:00.000Z`}));
const earlyNew=syntheticApplicant('new-early',{interviewTime:'07:30',createdAt:'2026-08-21T00:00:00.000Z'});
assert.deepEqual(ids(api.orderedApplicants(DATE_A,[earlyNew,...savedFive])),[...savedFive.map(row=>row.id),'new-early']);
assert.deepEqual(ids(api.orderedApplicants(DATE_A,savedFive.map((row,index)=>({...row,interviewTime:`${String(18-index).padStart(2,'0')}:00`})))),savedFive.map(row=>row.id),'외부에서 기존 면접시간만 바뀌어도 저장 순서는 자동 재계산하면 안 됩니다.');

// 신규 다수, 동일/빈 시간, createdAt 누락과 잘못된 순서도 반복 계산에서 흔들리지 않는다.
const mixed=[
  ...savedFive,
  syntheticApplicant('new-b',{interviewTime:'',createdAt:''}),
  syntheticApplicant('new-a',{interviewTime:'08:00',createdAt:''}),
  syntheticApplicant('bad-order',{interviewTime:'06:00',rosterOrderDate:DATE_A,rosterOrder:'잘못된값',createdAt:'2026-08-18T00:00:00.000Z'})
];
const mixedOrder=ids(api.orderedApplicants(DATE_A,mixed));
assert.deepEqual(mixedOrder,[...savedFive.map(row=>row.id),'bad-order','new-a','new-b']);
assert.deepEqual(ids(api.orderedApplicants(DATE_A,clone(mixed))),mixedOrder);

// 날짜별 순서는 격리되고 날짜를 옮긴 지원자의 과거 순서는 무시한다.
const dateRows=[
  syntheticApplicant('date-a-2',{rosterOrderDate:DATE_A,rosterOrder:2}),
  syntheticApplicant('date-a-1',{rosterOrderDate:DATE_A,rosterOrder:1}),
  syntheticApplicant('date-b-2',{interviewDate:DATE_B,rosterOrderDate:DATE_B,rosterOrder:2}),
  syntheticApplicant('date-b-1',{interviewDate:DATE_B,rosterOrderDate:DATE_B,rosterOrder:1}),
  syntheticApplicant('moved',{interviewDate:DATE_B,interviewTime:'07:00',rosterOrderDate:DATE_A,rosterOrder:1})
];
assert.deepEqual(ids(api.orderedApplicants(DATE_A,dateRows)),['date-a-1','date-a-2']);
assert.deepEqual(ids(api.orderedApplicants(DATE_B,dateRows)),['date-b-1','date-b-2','moved']);
const excluded=['면접거절','면접불참','면접완료','다음면접','입사예정','불합격','서류탈락'].map((status,index)=>syntheticApplicant(`excluded-${index}`,{status}));
assert.deepEqual(ids(api.orderedApplicants(DATE_A,[syntheticApplicant('eligible'),...excluded])),['eligible'],'기존 면접예정 대상 기준 외 상태는 포함하면 안 됩니다.');

// 날짜 없음, 열기/보기/이동/시간순/취소는 저장 0회다.
h.setApplicants(defaultRows);h.resetCounters();nodes.rosterDate.value='';
assert.equal(api.open(),false);assert.equal(h.counts().saveCalls,0);assert.ok(h.counts().alerts[0].includes('날짜'));
nodes.rosterDate.value=DATE_A;const storageBeforeDraft=storage.get(STORAGE_KEY);
assert.equal(api.open(),true);assert.equal(api.move('2',0),true);assert.equal(api.setPosition('4',2),true);assert.equal(api.setPosition('4',0),false);assert.equal(api.setPosition('4',99),false);
assert.equal(api.sortByTime(),true);assert.equal(api.setTime('3','08:45'),true);assert.equal(api.setTime('3','25:10'),false);
assert.equal(h.counts().saveCalls,0);assert.equal(storage.get(STORAGE_KEY),storageBeforeDraft,'편집 초안은 localStorage를 변경하면 안 됩니다.');
h.setConfirm(true);assert.equal(api.close(),true);assert.equal(h.counts().saveCalls,0);

// 일정관리의 선택 날짜 바로가기는 같은 편집기를 열고 숨은 오늘 할 일 날짜도 동기화하며 조회만으로 저장하지 않는다.
h.setApplicants(defaultRows);h.resetCounters();h.setCalendarDate(DATE_A);nodes.rosterDate.value='';context.document.activeElement=nodes.btnCalendarRosterOrderEdit;
assert.equal(api.openFromCalendar(),true);assert.equal(nodes.rosterDate.value,DATE_A);assert.equal(api.state.date,DATE_A);assert.equal(h.counts().saveCalls,0);
assert.equal(api.close(),true);assert.equal(context.document.activeElement,nodes.btnCalendarRosterOrderEdit);h.setCalendarDate('');

// 드래그와 위·아래가 사용하는 동일 move, 직접 순번, 시간 변경을 한 번 저장하고 재열기에도 유지한다.
h.setApplicants(defaultRows);h.resetCounters();assert.equal(api.open(DATE_A),true);
assert.equal(api.move('2',0),true); // 드래그/아래·위 버튼도 이 함수를 공유한다.
assert.equal(api.move('3',3),true);
assert.equal(api.setPosition('4',2),true);
assert.equal(api.setTime('4','11:20'),true);
const expectedSavedOrder=ids(api.state.rows);
const beforeObjects=clone(context.applicants),nonTarget=syntheticApplicant('other-date',{interviewDate:DATE_B,status:'면접예정'});
context.applicants=[...context.applicants,clone(nonTarget)];api.state.baselineIds=api.__test.targetIds(DATE_A);
h.setSaveBehavior((ctx,store)=>{store.set(STORAGE_KEY,JSON.stringify(ctx.applicants));return true;});
assert.equal(api.save(),true);assert.equal(h.counts().saveCalls,1,'성공 저장은 기존 save를 정확히 한 번 호출해야 합니다.');
assert.deepEqual(ids(api.state.rows),expectedSavedOrder);assert.equal(api.state.dirty,false);
const persisted=JSON.parse(storage.get(STORAGE_KEY));
assert.deepEqual(persisted.filter(row=>row.interviewDate===DATE_A).sort((a,b)=>a.rosterOrder-b.rosterOrder).map(row=>row.id),expectedSavedOrder);
assert.deepEqual(persisted.find(row=>row.id==='other-date'),nonTarget,'비대상 지원자 객체는 그대로 보존해야 합니다.');
for(const previous of beforeObjects){
  const current=persisted.find(row=>row.id===previous.id),allowed=new Set(['rosterOrderDate','rosterOrder','interviewTime']);
  assert.deepEqual(Object.fromEntries(Object.entries(current).filter(([key])=>!allowed.has(key))),Object.fromEntries(Object.entries(previous).filter(([key])=>!allowed.has(key))),`${previous.id}의 비대상 필드는 보존해야 합니다.`);
}
api.close({force:true});context.applicants=clone(persisted);assert.equal(api.open(DATE_A),true);assert.deepEqual(ids(api.state.rows),expectedSavedOrder,'저장·새로고침·재열기 순서가 같아야 합니다.');api.close({force:true});

// 명시적 시간순 재배치는 저장 전 write 0회이며 저장 뒤에만 유지된다.
h.setApplicants(savedFive.map((row,index)=>({...row,rosterOrder:savedFive.length-index})));h.resetCounters();assert.equal(api.open(DATE_A),true);const preSortStorage=storage.get(STORAGE_KEY);
assert.equal(api.sortByTime(),true);assert.equal(h.counts().saveCalls,0);assert.equal(storage.get(STORAGE_KEY),preSortStorage);
assert.equal(api.save(),true);assert.equal(h.counts().saveCalls,1);api.close({force:true});

// 편집 중 대상 집합이 달라지면 부분 저장을 거부한다.
h.setApplicants(defaultRows);h.resetCounters();assert.equal(api.open(DATE_A),true);api.move('2',0);
context.applicants=[...context.applicants,syntheticApplicant('late-target',{interviewTime:'10:30'})];
assert.equal(api.save(),false);assert.equal(h.counts().saveCalls,0);assert.ok(api.state.feedback.includes('대상자'));api.close({force:true});

// 실패 시 메모리 전체, 정확한 localStorage, 편집 초안을 모두 원상복구한다.
h.setApplicants(defaultRows);h.resetCounters();assert.equal(api.open(DATE_A),true);api.move('2',0);api.setTime('2','10:40');
const rollbackApplicants=clone(context.applicants),rollbackStorage=storage.get(STORAGE_KEY),rollbackDraft=clone(api.state.rows);
h.setSaveBehavior((ctx,store)=>{store.set(STORAGE_KEY,'synthetic-partial-write');return false;});
assert.equal(api.save(),false);assert.equal(h.counts().saveCalls,1);assert.deepEqual(context.applicants,rollbackApplicants);assert.equal(storage.get(STORAGE_KEY),rollbackStorage);assert.deepEqual(api.state.rows,rollbackDraft);assert.equal(api.state.dirty,true);api.close({force:true});

// viewer는 화면 열기와 숨은 직접 함수 호출 모두 차단되어 save가 0회다.
h.setApplicants(defaultRows);h.resetCounters();h.setCanWrite(false);assert.equal(api.open(DATE_A),false);assert.equal(h.counts().requireCalls,1);assert.equal(h.counts().saveCalls,0);
h.setCanWrite(true);assert.equal(api.open(DATE_A),true);api.move('2',0);h.resetCounters();h.setCanWrite(false);
const viewerDraft=clone(api.state.rows);assert.equal(api.move('1',2),false);assert.equal(api.setPosition('1',2),false);assert.equal(api.setTime('1','12:00'),false);assert.equal(api.sortByTime(),false);assert.equal(api.save(),false);assert.deepEqual(clone(api.state.rows),viewerDraft);assert.equal(h.counts().saveCalls,0);h.setCanWrite(true);api.close({force:true});

// 기존 normalize와 JSON 백업·복원 왕복에서 두 필드를 보존하고 잘못된 값은 빈값으로 만든다.
const coreContext={
  window:{erpSecurity:{isValidId:()=>true},erpAppVersion:{LOCAL_ONLY:true}},document:{getElementById(){return null;}},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},formatPhoneDisplay:value=>String(value||''),formatBirthDisplay:value=>String(value||''),
  renderAll(){},alert(){},prompt(){return null;},console,Date,Math,JSON,Object,Array,String,Number,globalThis:{crypto:{randomUUID:()=>`synthetic-${Date.now()}`}}
};
coreContext.window.window=coreContext.window;
vm.runInNewContext(`${core}\nthis.__normalizeRosterFixture=value=>normalize(value);`,coreContext,{filename:'core.js'});
const normalized=coreContext.__normalizeRosterFixture(syntheticApplicant('roundtrip',{rosterOrderDate:DATE_A,rosterOrder:'3'}));
const restored=coreContext.__normalizeRosterFixture(JSON.parse(JSON.stringify(normalized)));
assert.equal(restored.rosterOrderDate,DATE_A);assert.equal(restored.rosterOrder,3);
assert.deepEqual({date:coreContext.__normalizeRosterFixture(syntheticApplicant('bad-date',{rosterOrderDate:'2026-02-30',rosterOrder:0})).rosterOrderDate,order:coreContext.__normalizeRosterFixture(syntheticApplicant('bad-order-2',{rosterOrderDate:DATE_A,rosterOrder:'x'})).rosterOrder},{date:'',order:''});

console.log('roster-order-editor.test.js: 시간순·수동순서·신규후순위·날짜격리·1회저장·rollback·viewer·normalize 확인 완료');
