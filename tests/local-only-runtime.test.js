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
const permissions=read('js/permissions.js');
const storage=read('js/storage-performance.js');
const version=require('../js/app-version.js');

assert.equal(version.VERSION,'12.2.1');
assert.equal(version.LOCAL_ONLY,true);
assert.equal(version.mode,'local-only');
assert.doesNotMatch(index,/id="(?:loginOverlay|loginEmail|loginPassword|btnLogin|btnLoginSkip|btnLogout|btnOpenLogin|authNote|topbarUser)"/);
assert.doesNotMatch(index,/autocomplete="(?:username|current-password)"|원격 로그인|클라우드 로그아웃/);
assert.doesNotMatch(index,/@supabase\/supabase-js|supabase_config\.js|js\/(?:auth-init|cloud-sync|sync-safety|shared-storage)\.js/);
assert.match(index,/js\/factory-reset-v12\.js\?v=12\.0\.2/);
assert.ok(index.indexOf('js/factory-reset-v12.js')<index.indexOf('js/safety.js'),'공장 초기화 게이트가 업무 런타임보다 먼저 로드되어야 합니다.');
assert.match(index,/js\/local-only-init\.js\?v=12\.0\.2/);

for(const retired of ['supabase_config.js','js/auth-init.js','js/cloud-sync.js','js/sync-safety.js','js/shared-storage.js'])assert.equal(fs.existsSync(path.join(root,retired)),false,`${retired}는 영구 LOCAL ONLY 배포에 남으면 안 됩니다.`);
for(const [name,source] of Object.entries({core,localInit,permissions,storage}))assert.doesNotMatch(source,/supabase|127\.0\.0\.1:17840|\/storage\/snapshot|erpSharedStorage/i,`${name} 런타임에 폐기된 원격 연결이 남으면 안 됩니다.`);
assert.doesNotMatch(core,/function canUseCloud|window\.sb|fetch\(/);
assert.match(core,/function isLocalOnlyRuntime\(\)\{ return window\.erpAppVersion\?\.LOCAL_ONLY === true; \}/);

const calls={render:0,localRole:0,fetch:0};
const context={
  window:{
    erpAppVersion:version,
    erpStateReady:Promise.resolve({ok:true}),
    erpPermissions:{useLocal(){calls.localRole++;}},
  },
  resetForm(){},resetCalendarEventForm(){},renderAll(){calls.render++;},updateStorageNote(){},
  $(){return null;},today(){return '2026-08-20';},alert(){},console,Object,Promise,
  fetch(){calls.fetch++;throw new Error('NETWORK_FORBIDDEN');}
};
context.window.window=context.window;
vm.runInNewContext(localInit,context,{filename:'local-only-init.js'});

(async()=>{
  const ready=await context.window.erpRuntimeReady;
  assert.equal(ready.ok,true);
  assert.equal(context.window.erpRuntimeMode,'local-only');
  assert.equal(context.window.erpLocalOnlyRuntime.enabled,true);
  assert.equal(calls.localRole,1);
  assert.equal(calls.render,1);
  assert.equal(calls.fetch,0);
  console.log('local-only-runtime.test.js: 로그인 UI 0건·폐기 파일 제거·원격 요청 0건·LOCAL ONLY 렌더 확인 완료');
})().catch(error=>{console.error(error);process.exitCode=1;});
