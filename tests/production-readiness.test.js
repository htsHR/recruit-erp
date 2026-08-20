'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const values=new Map([['recruit_erp_data_epoch','v12.0.2-reset-1']]);
globalThis.localStorage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
globalThis.safeLocalStorageSet=(key,value)=>{values.set(key,String(value));return true;};
globalThis.erpRuntimeMode='local-only';
globalThis.erpPermissions={current:()=>({role:'local_admin',source:'local',userId:''}),has:permission=>permission==='readiness.manage'};
globalThis.erpAudit={record(){}};
globalThis.erpBackupCenter={exportEncrypted(){}};
globalThis.erpEncryptedBackup={encryptEnvelope(){}};
globalThis.erpStoragePerformance={estimateStorage(){}};

const readiness=require('../js/production-readiness.js');
const source=fs.readFileSync(path.join(root,'js','production-readiness.js'),'utf8');
const version=require('../js/app-version.js');

assert.equal(readiness.VERSION,'12.0.2');
assert.equal(version.VERSION,'12.0.2');
assert.equal(readiness.MANUAL_CHECKS.length,7);
assert.equal(readiness.context().verificationSource,'local');
assert.equal(readiness.context().operationEnvironment,'local-only');
assert.equal(readiness.context().factoryResetReady,true);
(async()=>{
  assert.equal(await readiness.encryptionRoundTrip(),true);
  const automatic=await readiness.automaticChecks();
  assert.equal(automatic.length,8);
  assert.ok(automatic.every(item=>item.status==='pass'),JSON.stringify(automatic));
  let state=readiness.readState();
  assert.equal(readiness.manualStatus(state).ready,false);
  for(const check of readiness.MANUAL_CHECKS)assert.equal(readiness.setManual(check.id,true),true);
  state=readiness.readState();
  const manual=readiness.manualStatus(state);
  assert.equal(manual.ready,true);
  assert.equal(manual.completed,7);
  const summary=readiness.summarize(automatic,manual);
  assert.equal(summary.ready,true);

  const capacity=readiness.capacityCheck();
  assert.equal(capacity.passed,true);
  assert.deepEqual(capacity.counts,{applicants:5000,employees:1000,schools:500});
  const report=readiness.buildPrivacySafeReport({state:readiness.readState(),automatic,manual,summary});
  assert.equal(report.overall,'ready');
  assert.equal(report.verificationSource,'local');
  assert.equal(report.operationEnvironment,'local-only');
  assert.equal(report.localOnly,true);
  assert.equal(report.remoteDependency,false);
  assert.equal(report.factoryResetVerified,true);
  assert.match(report.limitation,/전자서명된 증명서가 아닙니다/);
  const text=JSON.stringify(report);
  for(const secret of ['010-0000-0001','000000-0000000','가상 지원자'])assert.ok(!text.includes(secret));

  assert.doesNotMatch(source,/root\.sb|fetch\(|getSession\(|createClient\(|from\(['"]/i);
  for(const retired of ['supabase_config.js','supabase_migration_v10.57.0_rbac_rls.sql','js/auth-init.js','js/cloud-sync.js','js/sync-safety.js'])assert.equal(fs.existsSync(path.join(root,retired)),false);
  console.log('production-readiness.test.js: LOCAL ONLY 자동 8개·수동 7개·가상 용량·개인정보 없는 보고서 확인 완료');
})().catch(error=>{console.error(error);process.exitCode=1;});
