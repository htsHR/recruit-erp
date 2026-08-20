'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const authSource=fs.readFileSync(path.join(root,'js','local-only-init.js'),'utf8');
const applicantSource=fs.readFileSync(path.join(root,'js','school-relations.js'),'utf8');
const employeeSource=fs.readFileSync(path.join(root,'js','employees.js'),'utf8');
const schoolSource=fs.readFileSync(path.join(root,'js','schools.js'),'utf8');
const bulkSource=fs.readFileSync(path.join(root,'js','bindings.js'),'utf8');
assert.doesNotMatch(authSource,/getSession|signInWithPassword|signOut|retryDeletes|supabaseSyncOnLoad/,'LOCAL ONLY 초기화가 인증·클라우드 동기화를 시작하면 안 됩니다.');
assert.match(applicantSource,/supabaseDeleteOne\([\s\S]*?\{defer:true\}[\s\S]*?if\(!save\(\)\)[\s\S]*?cancelDelete/);
assert.match(employeeSource,/supabaseDeleteEmployee\([\s\S]*?\{defer:true\}[\s\S]*?if\(!saveEmployees\(\)\)[\s\S]*?cancelDelete/);
assert.match(schoolSource,/supabaseDeleteSchool\([\s\S]*?\{defer:true\}[\s\S]*?if\(!saveSchools\(\)\)[\s\S]*?cancelDelete/);
assert.match(bulkSource,/supabaseDeleteAll\(\{defer:true\}\)[\s\S]*?cancelDelete/);

const values=new Map();
let failWrites=false;
const localStorage={
  getItem:key=>values.has(key)?values.get(key):null,
  setItem(key,value){if(failWrites)throw new Error('QuotaExceededError');values.set(key,value);}
};
const window={
  localStorage,
  erpSafety:{safeLocalStorageSet(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}},
  document:{readyState:'loading',addEventListener(){}},
  addEventListener(){},
  canUseCloud:()=>true,
  setCloudSyncStatus(){},
  setTimeout:callback=>callback()
};
const context=vm.createContext({window,console,module:undefined,document:window.document,Error,Date,JSON,Map,Set,Promise,encodeURIComponent});
vm.runInContext(fs.readFileSync(require.resolve('../js/sync-safety.js'),'utf8'),context);
const safety=window.erpSyncSafety;

const virtualRows=[{id:'test-delete-1',name:'삭제테스트지원자'},{id:'test-keep-1',name:'유지테스트지원자'}];
let queued=safety.enqueueDelete('applicants',{id:'test-delete-1',label:'삭제테스트지원자'});
assert.equal(queued.ok,true);
assert.equal(safety.pendingDeleteCount(),1);
assert.deepEqual(safety.filterPendingDeletes('applicants',virtualRows,safety.readPendingDeletes()).map(row=>row.id),['test-keep-1']);

let attempts=0;
safety.registerDataset('applicants',{
  getRows:()=>virtualRows,
  remove:async operation=>{
    attempts++;
    assert.equal(operation.id,'test-delete-1');
    if(attempts===1)throw new Error('가상 네트워크 실패');
    return {deleted:true};
  }
});

(async()=>{
  const originalWarn=console.warn;console.warn=()=>{};
  let result=await safety.retryDeletes('applicants');
  console.warn=originalWarn;
  assert.ok(result[0].error);
  assert.equal(safety.pendingDeleteCount(),1);
  assert.equal(safety.readPendingDeletes()[0].attempts,1);

  result=await safety.retryDeletes('applicants');
  assert.equal(result[0].deleted,1);
  assert.equal(safety.pendingDeleteCount(),0);

  const first=safety.enqueueDelete('employees',{id:'employee-test-1',label:'가상사원'});
  assert.equal(first.ok,true);
  assert.equal(safety.cancelDelete(first.key),true);
  assert.equal(safety.pendingDeleteCount(),0);

  safety.enqueueDelete('applicants',{id:'one',label:'가상지원자1'});
  safety.enqueueDelete('applicants',{id:'two',label:'가상지원자2'});
  const all=safety.enqueueDelete('applicants',{scope:'all',ids:virtualRows.map(row=>row.id),label:'지원자 전체 자료'});
  assert.equal(all.ok,true);
  let applicantDeletes=safety.readPendingDeletes().filter(item=>item.dataset==='applicants');
  assert.equal(applicantDeletes.length,1);
  assert.deepEqual([...applicantDeletes[0].ids].sort(),['one','test-delete-1','test-keep-1','two'].sort());
  assert.equal(safety.filterPendingDeletes('applicants',virtualRows,safety.readPendingDeletes()).length,0);
  const newAfterDelete={id:'new-after-delete',name:'전체삭제 이후 신규지원자'};
  assert.deepEqual(safety.filterPendingDeletes('applicants',[...virtualRows,newAfterDelete],safety.readPendingDeletes()).map(row=>row.id),['new-after-delete']);

  const afterAll=safety.enqueueDelete('applicants',{id:'new-after-delete',label:'전체삭제 이후 신규지원자'});
  assert.equal(afterAll.ok,true);
  applicantDeletes=safety.readPendingDeletes().filter(item=>item.dataset==='applicants');
  assert.equal(applicantDeletes.length,2);
  assert.ok(applicantDeletes.some(item=>item.scope==='one'&&item.id==='new-after-delete'));
  assert.equal(safety.filterPendingDeletes('applicants',[...virtualRows,newAfterDelete],safety.readPendingDeletes()).length,0);

  failWrites=true;
  const blocked=safety.enqueueDelete('schools',{id:'school-test-1',label:'가상학교'});
  failWrites=false;
  assert.equal(blocked.ok,false);
  assert.ok(!safety.readPendingDeletes().some(item=>item.id==='school-test-1'));

  console.log('delete-recovery.test.js: 삭제 대기·실패 재시도·취소·전체삭제 보호 확인 완료');
})().catch(error=>{console.error(error);process.exitCode=1;});
