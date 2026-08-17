'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

class MemoryStorage{
  constructor(){this.map=new Map();this.failKey='';}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){if(key===this.failKey)throw new Error('quota');this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
  clear(){this.map.clear();}
}

const localStorage=new MemoryStorage();
globalThis.localStorage=localStorage;
globalThis.uxGetOperationEnvironment=()=> 'company';
globalThis.erpPermissions={has:()=>true,require:()=>true};
globalThis.alert=()=>{};
const shared=require('../js/shared-storage.js');

function fakeDatasets(seed='001'){
  return {
    applicants:[{id:`applicant-${seed}`,name:'가상 지원자'}],
    hireWaitingProfiles:[{applicantId:`applicant-${seed}`,employeeNo:`TEST-${seed}`,remarks:'가상 정보'}],
    employees:[{id:`employee-${seed}`,empNo:`TEST-${seed}`,name:'가상 사원'}],
    schools:[{id:`school-${seed}`,name:'가상대학교'}],
    calendarEvents:[{id:`event-${seed}`,title:'가상 일정',date:'2026-08-13'}],
    messageTemplates:[{id:`template-${seed}`,title:'가상 안내'}],
    interviewSessions:[{id:`interview-${seed}`}],
    applicantManagerAssignments:{[`applicant-${seed}`]:'가상 담당자'},
    auditLogs:[{client_event_id:`audit-${seed}`,action:'update'}],
    sensitiveExportLog:[{id:`export-${seed}`,label:'가상 내보내기',at:'2026-08-13T00:00:00.000Z'}],
    savedAdvancedSearches:[{id:`search-${seed}`,name:'가상 검색'}],
    schoolWorkforceSavedViews:[{id:`view-${seed}`,name:'가상 분석'}]
  };
}
function snapshot(datasets=fakeDatasets(),revision=1){return {format:shared.FORMAT,schemaVersion:shared.SCHEMA_VERSION,revision,savedAt:'2026-08-13T02:30:00.000Z',datasets};}
function seedLocal(datasets=fakeDatasets()){
  localStorage.clear();
  for(const name of shared.DATASET_NAMES)localStorage.setItem(shared.DATASETS[name].storageKey,JSON.stringify(datasets[name]));
  localStorage.setItem('supabase.auth.token','never-export');
  localStorage.setItem('recruit_erp_cloud_sync_pending_v1053','never-export');
}
function response(status,body){return {ok:status>=200&&status<300,status,json:async()=>body};}
function fakeBridge({masterExists=true,revision=1,datasets=fakeDatasets(),conflict=false}={}){
  const calls=[];let current=snapshot(datasets,revision);
  const fetchImpl=async(url,options={})=>{
    calls.push({url,options});
    if(url===`${shared.BASE_URL}/health`)return response(200,{ok:true,service:'Recruit ERP Bridge',version:shared.VERSION,bridgeToken:'test-token-with-at-least-32-characters'});
    assert.equal(options.headers['X-ERP-Bridge-Token'],'test-token-with-at-least-32-characters');
    if(url===`${shared.BASE_URL}/storage/status`)return response(200,{ok:true,masterExists,revision:masterExists?current.revision:0,savedAt:masterExists?current.savedAt:'',schemaVersion:masterExists?1:null,fileSize:123,datasetCounts:masterExists?shared.datasetCounts(current.datasets):{}});
    if(url===`${shared.BASE_URL}/storage/snapshot`&&options.method==='GET')return response(200,{ok:true,snapshot:current});
    if(url===`${shared.BASE_URL}/storage/initialize`){const body=JSON.parse(options.body);current=snapshot(body.datasets,1);masterExists=true;return response(201,{ok:true,snapshot:current,fileSize:456,datasetCounts:shared.datasetCounts(current.datasets)});}
    if(url===`${shared.BASE_URL}/storage/snapshot`&&options.method==='PUT'){
      const body=JSON.parse(options.body);
      if(conflict||body.expectedRevision!==current.revision)return response(409,{ok:false,code:'REVISION_CONFLICT',currentRevision:current.revision});
      current=snapshot(body.datasets,current.revision+1);return response(200,{ok:true,snapshot:current,fileSize:789,datasetCounts:shared.datasetCounts(current.datasets)});
    }
    throw new Error(`unexpected URL ${url}`);
  };
  return {fetchImpl,calls,current:()=>current};
}

(async()=>{
  assert.equal(shared.BASE_URL,'http://127.0.0.1:17840');assert.equal(shared.SCHEMA_VERSION,1);
  assert.deepEqual(Object.keys(shared.DATASETS),['applicants','hireWaitingProfiles','employees','schools','calendarEvents','messageTemplates','interviewSessions','applicantManagerAssignments','auditLogs','sensitiveExportLog','savedAdvancedSearches','schoolWorkforceSavedViews']);

  const localFixture=fakeDatasets();localFixture.applicants[0].password='must-not-export';localFixture.hireWaitingProfiles[0].residentNumber='';seedLocal(localFixture);
  const collected=shared.collectDatasets();
  assert.equal('residentNumber' in collected.hireWaitingProfiles[0],false,'residentNumber 필드는 snapshot에서 제거해야 합니다.');
  assert.equal('password' in collected.applicants[0],false,'비밀번호 필드는 snapshot에서 제거해야 합니다.');
  assert.ok(!JSON.stringify(collected).includes('never-export'),'토큰·동기화 대기 키는 allowlist snapshot에 포함하면 안 됩니다.');
  assert.equal(shared.primaryLocalCounts().total,5);

  const rrn=fakeDatasets('002');rrn.hireWaitingProfiles[0].remarks='900101-1000001';seedLocal(rrn);
  assert.throws(()=>shared.collectDatasets(),error=>error.code==='RESIDENT_NUMBER_BLOCKED');
  const dangerous=JSON.parse('{"safe":{"__proto__":{"polluted":true}}}');assert.throws(()=>shared.assertSafeTree(dangerous),error=>error.code==='UNSAFE_SNAPSHOT_KEY');
  const deep={};let cursor=deep;for(let index=0;index<14;index+=1){cursor.next={};cursor=cursor.next;}assert.throws(()=>shared.assertSafeTree(deep),error=>error.code==='SNAPSHOT_TOO_DEEP');
  const duplicate=fakeDatasets('003');duplicate.employees.push({...duplicate.employees[0]});assert.throws(()=>shared.validateDatasets(duplicate),error=>error.code==='DUPLICATE_ROW_ID');

  seedLocal(fakeDatasets('010'));
  const initializeBridge=fakeBridge({masterExists:false});
  const emptyState=await shared.connect({fetchImpl:initializeBridge.fetchImpl,autoApplyEmpty:false});assert.equal(emptyState.phase,'empty');
  assert.equal(await shared.initialize({fetchImpl:initializeBridge.fetchImpl}),true);assert.equal(shared.publicState().revision,1);
  const initCall=initializeBridge.calls.find(call=>call.url.endsWith('/storage/initialize'));assert.ok(initCall);assert.equal(initCall.options.credentials,'omit');assert.equal(initCall.options.cache,'no-store');
  const initBody=JSON.parse(initCall.options.body);assert.equal('residentNumber' in initBody.datasets.hireWaitingProfiles[0],false);

  localStorage.clear();
  const restoreBridge=fakeBridge({masterExists:true,revision:7,datasets:fakeDatasets('020')});
  const restored=await shared.connect({fetchImpl:restoreBridge.fetchImpl,autoApplyEmpty:true});assert.equal(restored.phase,'ready');assert.equal(restored.revision,7);
  assert.equal(JSON.parse(localStorage.getItem(shared.DATASETS.employees.storageKey))[0].id,'employee-020','빈 새 PC는 공용 master를 불러와야 합니다.');

  seedLocal(fakeDatasets('030'));
  const confirmationBridge=fakeBridge({masterExists:true,revision:8,datasets:fakeDatasets('031')});
  const confirmation=await shared.connect({fetchImpl:confirmationBridge.fetchImpl,autoApplyEmpty:true});assert.equal(confirmation.phase,'needs-confirmation','기존 로컬 데이터는 사용자 확인 없이 바꾸면 안 됩니다.');
  assert.equal(JSON.parse(localStorage.getItem(shared.DATASETS.employees.storageKey))[0].id,'employee-030');
  const blockedRows=fakeDatasets('032').applicants;localStorage.setItem(shared.DATASETS.applicants.storageKey,JSON.stringify(blockedRows));
  const blockedPutCount=confirmationBridge.calls.filter(call=>call.options.method==='PUT').length;
  assert.equal(shared.scheduleSave({detail:{key:shared.DATASETS.applicants.storageKey}}),false,'needs-confirmation에서는 공용 저장을 예약하면 안 됩니다.');
  await new Promise(resolve=>setTimeout(resolve,550));
  assert.equal(confirmationBridge.calls.filter(call=>call.options.method==='PUT').length,blockedPutCount,'needs-confirmation의 localStorage 변경은 PUT 요청을 만들면 안 됩니다.');
  assert.equal(JSON.parse(localStorage.getItem(shared.DATASETS.applicants.storageKey))[0].id,'applicant-032','공용 저장이 차단되어도 localStorage 변경은 유지해야 합니다.');
  assert.equal(await shared.loadLatest({fetchImpl:confirmationBridge.fetchImpl}),true);assert.equal(JSON.parse(localStorage.getItem(shared.DATASETS.employees.storageKey))[0].id,'employee-031');
  assert.equal(shared.publicState().writeArmed,true);assert.equal(shared.readConfirmedRevision(),8);
  const approvedRows=fakeDatasets('033').applicants;localStorage.setItem(shared.DATASETS.applicants.storageKey,JSON.stringify(approvedRows));
  const originalFetch=globalThis.fetch;globalThis.fetch=confirmationBridge.fetchImpl;
  try{assert.equal(shared.scheduleSave({detail:{key:shared.DATASETS.applicants.storageKey}}),true);await new Promise(resolve=>setTimeout(resolve,550));}
  finally{globalThis.fetch=originalFetch;}
  assert.equal(confirmationBridge.calls.filter(call=>call.options.method==='PUT').length,blockedPutCount+1,'loadLatest 승인 후 변경은 PUT 요청을 1건 실행해야 합니다.');
  assert.equal(shared.readConfirmedRevision(),9);

  seedLocal(fakeDatasets('035'));const corruptBefore=localStorage.getItem(shared.DATASETS.employees.storageKey);
  const corruptFetch=async(url,options={})=>{
    if(url.endsWith('/health'))return response(200,{ok:true,service:'Recruit ERP Bridge',version:shared.VERSION,bridgeToken:'test-token-with-at-least-32-characters'});
    if(url.endsWith('/storage/status'))return response(200,{ok:true,masterExists:true,revision:9,savedAt:'2026-08-13T00:00:00.000Z',schemaVersion:1,fileSize:10,datasetCounts:{}});
    if(url.endsWith('/storage/snapshot'))return response(200,{ok:true,snapshot:{format:shared.FORMAT,schemaVersion:99,revision:9,savedAt:'2026-08-13T00:00:00.000Z',datasets:fakeDatasets('036')}});
    throw new Error(`unexpected ${url} ${options.method||'GET'}`);
  };
  const corruptState=await shared.connect({fetchImpl:corruptFetch,autoApplyEmpty:true});assert.equal(corruptState.phase,'offline');assert.equal(localStorage.getItem(shared.DATASETS.employees.storageKey),corruptBefore,'깨진 master는 기존 cache를 바꾸면 안 됩니다.');

  seedLocal(fakeDatasets('038'));const offlineBefore=localStorage.getItem(shared.DATASETS.applicants.storageKey);
  const offlineState=await shared.connect({fetchImpl:async()=>{throw new Error('bridge stopped');},autoApplyEmpty:true});assert.equal(offlineState.phase,'offline');assert.equal(localStorage.getItem(shared.DATASETS.applicants.storageKey),offlineBefore,'Bridge 종료 시 기존 localStorage를 삭제하면 안 됩니다.');
  const restartedBridge=fakeBridge({masterExists:true,revision:9,datasets:fakeDatasets('038')});const restarted=await shared.connect({fetchImpl:restartedBridge.fetchImpl,autoApplyEmpty:false});assert.equal(restarted.connected,true,'Bridge 재실행 후 다시 연결할 수 있어야 합니다.');

  seedLocal(fakeDatasets('040'));
  const before=localStorage.getItem(shared.DATASETS.applicants.storageKey);localStorage.failKey=shared.DATASETS.employees.storageKey;
  assert.throws(()=>shared.applySnapshot(snapshot(fakeDatasets('041'),9),{refresh:false}),error=>error.code==='CACHE_WRITE_FAILED');
  localStorage.failKey='';assert.equal(localStorage.getItem(shared.DATASETS.applicants.storageKey),before,'cache 적용 실패 시 이미 쓴 데이터도 원상복구해야 합니다.');

  seedLocal(fakeDatasets('050'));
  const saveBridge=fakeBridge({masterExists:true,revision:10,datasets:fakeDatasets('050')});await shared.connect({fetchImpl:saveBridge.fetchImpl,autoApplyEmpty:false});await shared.loadLatest({fetchImpl:saveBridge.fetchImpl});
  assert.equal(await shared.saveNow({fetchImpl:saveBridge.fetchImpl,notify:false}),true);assert.equal(shared.publicState().revision,11);
  const putCall=saveBridge.calls.find(call=>call.options.method==='PUT');assert.equal(JSON.parse(putCall.options.body).expectedRevision,10);assert.equal(putCall.options.credentials,'omit');assert.equal(putCall.options.cache,'no-store');

  seedLocal(fakeDatasets('060'));const conflictBridge=fakeBridge({masterExists:true,revision:12,datasets:fakeDatasets('060'),conflict:true});await shared.connect({fetchImpl:conflictBridge.fetchImpl,autoApplyEmpty:false});await shared.loadLatest({fetchImpl:conflictBridge.fetchImpl});
  assert.equal(await shared.saveNow({fetchImpl:conflictBridge.fetchImpl,notify:false}),false);assert.equal(shared.publicState().phase,'conflict');assert.equal(shared.publicState().writeArmed,false);assert.match(shared.publicState().message,/다른 PC/);

  const source=fs.readFileSync(path.join(__dirname,'..','js','shared-storage.js'),'utf8');
  assert.doesNotMatch(source,/showDirectoryPicker|showOpenFilePicker|sendBeacon|FormData|type=["']file["']/i);
  assert.doesNotMatch(source,/https?:\/\/(?!127\.0\.0\.1:17840)/i,'업무 snapshot 전송 주소는 loopback Bridge만 허용해야 합니다.');
  console.log('shared-storage-client.test.js: allowlist·주민번호 차단·안전 검사·최초 확인·새 PC 복구·cache rollback·revision 충돌 확인 완료');
})().catch(error=>{console.error(error);process.exit(1);});
