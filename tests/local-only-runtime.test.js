'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('index.html');
const core=read('js/core.js');
const localInit=read('js/local-only-init.js');
const cloudSync=read('js/cloud-sync.js');
const version=require('../js/app-version.js');

assert.equal(version.VERSION,'12.0.1');
assert.equal(version.LOCAL_ONLY,true);
assert.equal(version.mode,'local-only');
assert.doesNotMatch(index,/id="(?:loginOverlay|loginEmail|loginPassword|btnLogin|btnLoginSkip|btnLogout|btnOpenLogin|authNote|topbarUser)"/);
assert.doesNotMatch(index,/autocomplete="(?:username|current-password)"|로그인 없이 계속|Supabase 로그인|클라우드 로그아웃/);
assert.doesNotMatch(index,/@supabase\/supabase-js|supabase_config\.js|js\/auth-init\.js/);
assert.match(index,/js\/local-only-init\.js\?v=12\.0\.1/);
for(const retained of ['supabase_config.js','js/auth-init.js','js/cloud-sync.js'])assert.ok(fs.existsSync(path.join(root,retained)),`${retained} 데이터 계층을 삭제하면 안 됩니다.`);
assert.match(core,/function isLocalOnlyRuntime\(\)\{ return window\.erpAppVersion\?\.LOCAL_ONLY === true; \}/);
assert.match(core,/function canUseCloud\(\)\{ return !isLocalOnlyRuntime\(\) &&/);

const calls={auth:0,query:0,read:0,write:0,sync:0,render:0,localRole:0};
const fakeQuery={
  select(){calls.read++;return this;},upsert(){calls.write++;return Promise.resolve({data:[],error:null});},insert(){calls.write++;return Promise.resolve({data:[],error:null});},delete(){calls.write++;return this;},
  order(){return this;},range(){return Promise.resolve({data:[],error:null});},limit(){return Promise.resolve({data:[],error:null});},eq(){return this;},in(){return Promise.resolve({data:[],error:null});},single(){return Promise.resolve({data:null,error:null});}
};
const fakeSb={
  auth:{getSession(){calls.auth++;return Promise.resolve({data:{session:{user:{id:'synthetic-session'}}}});},signInWithPassword(){calls.auth++;},signOut(){calls.auth++;}},
  from(){calls.query++;return fakeQuery;}
};
const initContext={
  window:{
    sb:fakeSb,
    erpAppVersion:version,
    erpPermissions:{useLocal(){calls.localRole++;}},
    erpSyncSafety:{retryUploads(){calls.sync++;},retryDeletes(){calls.sync++;}}
  },
  cloudAuthenticated:true,cloudSyncStatus:'ok',
  resetForm(){},resetCalendarEventForm(){},renderAll(){calls.render++;},updateStorageNote(){},renderSnapshotList(){},
  supabaseSyncOnLoad(){calls.sync++;},supabaseSchoolsSyncOnLoad(){calls.sync++;},supabaseEmployeesSyncOnLoad(){calls.sync++;},supabaseSnapshotDailyCheck(){calls.sync++;},
  $(){return null;},today(){return '2026-08-20';},alert(){},console,Object
};
vm.runInNewContext(localInit,initContext,{filename:'local-only-init.js'});
assert.equal(initContext.cloudAuthenticated,false);
assert.equal(initContext.cloudSyncStatus,'unknown');
assert.equal(initContext.window.erpLocalOnlyRuntime.enabled,true);
assert.equal(calls.localRole,1);
assert.equal(calls.render,1);
assert.deepEqual({auth:calls.auth,query:calls.query,read:calls.read,write:calls.write,sync:calls.sync},{auth:0,query:0,read:0,write:0,sync:0});

const guardContext={window:{sb:fakeSb,erpAppVersion:version},cloudAuthenticated:true,isCompanyLocalMode:()=>false,result:null};
vm.runInNewContext(`${core.match(/function isLocalOnlyRuntime\(\)[^\n]+/)?.[0]}\n${core.match(/function canUseCloud\(\)[^\n]+/)?.[0]}\nresult=canUseCloud();`,guardContext);
assert.equal(guardContext.result,false,'유효한 클라우드 세션이 있어도 LOCAL ONLY에서는 canUseCloud가 false여야 합니다.');

const syncContext={
  window:{
    sb:fakeSb,
    erpPermissions:{require:()=>true,has:()=>true},
    erpSyncSafety:{registerDataset(){},runUpload(){calls.sync++;},enqueueDelete:()=>({ok:true,key:'synthetic-delete'}),retryDeletes(){calls.sync++;},filterPendingDeletes:rows=>rows,readPendingDeletes:()=>[],mergeAndTrack:(_dataset,local)=>({rows:local,conflicts:[]})}
  },
  applicants:[{id:'synthetic-applicant',name:'가상 지원자'}],canUseCloud:()=>false,setCloudSyncStatus(){calls.sync++;},
  normalize:value=>value,safeLocalStorageSet:()=>true,STORAGE_KEY:'recruit_erp_applicants_stable',renderAll(){},$(){return null;},esc:value=>String(value),
  console,Promise,Date,Error,Object,Array,Math,Set,Map
};
vm.createContext(syncContext);
vm.runInContext(cloudSync,syncContext,{filename:'cloud-sync.js'});

(async()=>{
  await vm.runInContext('supabaseSyncAll(applicants)',syncContext);
  await vm.runInContext("supabaseSnapshotSave('가상 점검')",syncContext);
  vm.runInContext('supabaseSyncOnLoad();supabaseSnapshotDailyCheck();renderSnapshotList();',syncContext);
  await assert.rejects(()=>vm.runInContext("supabaseDeleteApplicantOperation({scope:'one',id:'synthetic-applicant'})",syncContext),/클라우드에 로그인/);
  assert.deepEqual({auth:calls.auth,query:calls.query,read:calls.read,write:calls.write,sync:calls.sync},{auth:0,query:0,read:0,write:0,sync:0});
  console.log('local-only-runtime.test.js: 로그인 UI 0건·기존 세션 무시·Supabase 조회/저장/동기화 0회 확인 완료');
})().catch(error=>{console.error(error);process.exitCode=1;});
