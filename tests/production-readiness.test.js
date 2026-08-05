'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const readiness=require(path.join(root,'js','production-readiness.js'));
const encrypted=require(path.join(root,'js','encrypted-backup.js'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const source=read('js/production-readiness.js');
const permissions=read('js/permissions.js');
const index=read('index.html');
const migrationName='supabase/migrations/20260803124545_production_readiness_security_hardening_v11_0_0.sql';
const verificationName='supabase/verification/verify_production_readiness_v11_0_0.sql';
const rollbackName='supabase/rollback/rollback_production_readiness_v11_0_0.sql';
const migration=read(migrationName);
const verification=read(verificationName);
const rollback=read(rollbackName);

const memory=new Map();
const alerts=[];
globalThis.localStorage={getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
globalThis.alert=message=>alerts.push(String(message));

let permissionState={role:'local_admin',source:'local',userId:'',setupRequired:false};
function roleAllowsReadiness(role){return ['admin','local_admin','legacy_admin'].includes(role);}
function installRuntime(state,{cloudUsable=false,environment='home',withSupabase=cloudUsable}={}){
  permissionState={setupRequired:false,...state};
  globalThis.erpPermissions={
    current:()=>({...permissionState}),
    has:permission=>permission==='readiness.manage'&&roleAllowsReadiness(permissionState.role),
    require:(permission,{notify=true}={})=>{const allowed=permission==='readiness.manage'&&roleAllowsReadiness(permissionState.role);if(!allowed&&notify)alerts.push('권한 없음');return allowed;}
  };
  globalThis.sb=withSupabase?{auth:{getSession:async()=>({data:{session:{user:{id:permissionState.userId}}}})}}:null;
  globalThis.canUseCloud=()=>cloudUsable;
  memory.set(readiness.OPERATION_ENV_KEY,environment);
  return readiness.runtimeContext();
}

(async()=>{
  assert.equal(readiness.VERSION,'11.0.0');
  assert.equal(readiness.STATE_KEY,'recruit_erp_production_readiness_v1100');
  assert.equal(readiness.STATE_SCHEMA_VERSION,2);
  assert.equal(readiness.MANUAL_CHECKS.length,7);
  assert.deepEqual(readiness.MANUAL_CHECKS.map(item=>item.id),['roles_rls','leaked_credential_protection','encrypted_restore','delete_recovery','export_audit','operator_guide','incident_drill']);

  const now=Date.parse('2026-08-04T12:00:00.000Z');
  assert.equal(readiness.isFresh('2026-08-04T11:00:00.000Z',now),true);
  assert.equal(readiness.isFresh('2026-06-01T00:00:00.000Z',now),false);
  assert.equal(readiness.isFresh('2026-08-05T00:00:00.000Z',now),false);

  installRuntime({role:'local_admin',source:'local',userId:''});
  assert.equal(readiness.setManual('roles_rls',true),null,'local_admin은 roles_rls를 체크하면 안 됩니다.');
  assert.equal(alerts.at(-1),readiness.CLOUD_ADMIN_MESSAGE);
  installRuntime({role:'legacy_admin',source:'legacy',userId:'legacy-user'});
  assert.equal(readiness.setManual('roles_rls',true),null,'legacy_admin은 roles_rls를 체크하면 안 됩니다.');
  assert.equal(alerts.at(-1),readiness.CLOUD_ADMIN_MESSAGE);

  const cloudContext=installRuntime({role:'admin',source:'cloud',userId:'00000000-0000-4000-8000-000000000001'},{cloudUsable:true});
  assert.equal(cloudContext.cloudAdminEligible,true);
  assert.ok(readiness.setManual('roles_rls',true),'cloud admin은 roles_rls를 체크할 수 있어야 합니다.');
  assert.ok(readiness.setManual('leaked_credential_protection',true),'cloud admin은 유출 비밀번호 보호 확인을 체크할 수 있어야 합니다.');
  const stored=readiness.readState();
  assert.equal(stored.manual.roles_rls.role,'admin');assert.equal(stored.manual.roles_rls.source,'cloud');

  installRuntime({role:'recruiter',source:'cloud',userId:'00000000-0000-4000-8000-000000000002'},{cloudUsable:true});
  assert.equal(readiness.requireReadinessPermission(false),false);assert.equal(readiness.saveCapacityResult({passed:true}),null);assert.equal(readiness.clearState(),false);
  installRuntime({role:'viewer',source:'cloud',userId:'00000000-0000-4000-8000-000000000003'},{cloudUsable:true});
  assert.equal(readiness.requireReadinessPermission(false),false);assert.equal(readiness.setManual('operator_guide',true),null);

  const synthetic=readiness.runSyntheticCapacityCheck();
  assert.deepEqual(synthetic.counts,{applicants:5000,employees:1000,schools:500});
  assert.equal(synthetic.passed,true);assert.ok(synthetic.durationMs<3000,'가상 6,500건 운영 성능 검사는 3초 안에 끝나야 합니다.');

  const passingEvidence={
    verificationSource:'cloud',operationEnvironment:'home',cloudAdminEligible:true,
    versionReady:true,securityModuleReady:true,privacyModuleReady:true,encryptedBackupModuleReady:true,encryptionRoundTripReady:true,
    permissionsModuleReady:true,permissionsReady:true,auditModuleReady:true,syncModuleReady:true,syncProbeReady:true,
    storageModuleReady:true,storageProbeReady:true,savePending:0,deletePending:0,conflicts:0,storageWarning:false,
    capacityPassed:true,capacityFresh:true,capacityDurationMs:synthetic.durationMs
  };
  const automatic=readiness.buildAutomaticChecks(passingEvidence);
  assert.equal(automatic.length,8);assert.ok(automatic.every(item=>item.status==='pass'));
  assert.ok(automatic.some(item=>item.testType==='모듈 확인'));assert.ok(automatic.some(item=>item.testType==='기능 시험'));
  for(const [missingKey,checkId] of [['privacyModuleReady','security'],['encryptedBackupModuleReady','encrypted_backup'],['permissionsModuleReady','permissions'],['auditModuleReady','audit'],['syncModuleReady','sync_queue'],['storageModuleReady','storage']]){
    const checks=readiness.buildAutomaticChecks({...passingEvidence,[missingKey]:false});
    assert.equal(checks.find(item=>item.id===checkId).status,'fail',`${missingKey} 누락은 fail-closed여야 합니다.`);
  }
  assert.equal(readiness.buildAutomaticChecks({...passingEvidence,syncProbeReady:false}).find(item=>item.id==='sync_queue').status,'fail');
  assert.equal(readiness.buildAutomaticChecks({...passingEvidence,storageProbeReady:false}).find(item=>item.id==='storage').status,'fail');
  assert.equal(readiness.buildAutomaticChecks({...passingEvidence,encryptionRoundTripReady:false}).find(item=>item.id==='encrypted_backup').status,'fail');

  for(const key of ['erpSyncSafety','erpStoragePerformance','erpEncryptedBackup','erpAudit','erpPrivacySecurity','erpSecurity'])delete globalThis[key];
  const missingEvidence=await readiness.collectRuntimeEvidence(readiness.emptyState());
  assert.equal(missingEvidence.syncModuleReady,false);assert.equal(missingEvidence.storageModuleReady,false);assert.equal(missingEvidence.encryptedBackupModuleReady,false);assert.equal(missingEvidence.auditModuleReady,false);assert.equal(missingEvidence.privacyModuleReady,false);
  const missingChecks=readiness.buildAutomaticChecks(missingEvidence);assert.equal(missingChecks.find(item=>item.id==='sync_queue').status,'fail');assert.equal(missingChecks.find(item=>item.id==='storage').status,'fail');assert.equal(missingChecks.find(item=>item.id==='encrypted_backup').status,'fail');

  globalThis.erpEncryptedBackup=encrypted;
  assert.equal(await readiness.runEncryptionRoundTrip(true),true,'가상 문자열 AES-GCM round-trip이 통과해야 합니다.');

  const completedAt='2026-08-04T11:30:00.000Z';
  const completeState={schemaVersion:2,version:'11.0.0',updatedAt:completedAt,manual:Object.fromEntries(readiness.MANUAL_CHECKS.map(item=>[item.id,{completedAt,role:'admin',source:'cloud'}])),capacity:{...synthetic,phone:'010-1234-5678',memo:'보고서에 들어가면 안 되는 값'}};
  const cloudManual=readiness.manualStatus(completeState,now,cloudContext);
  assert.equal(cloudManual.ready,true);
  const cloudSummary=readiness.summarize(automatic,cloudManual,cloudContext);
  assert.equal(cloudSummary.ready,true);assert.equal(cloudSummary.cloudVerified,true);

  const localContext=installRuntime({role:'local_admin',source:'local',userId:''});
  const localManual=readiness.manualStatus(completeState,now,localContext);
  assert.equal(localManual.ready,false,'로컬 상태에서는 cloud admin 항목이 완료로 인정되면 안 됩니다.');
  assert.equal(localManual.rows.find(item=>item.id==='roles_rls').locked,true);
  const localSummary=readiness.summarize(automatic,localManual,localContext);
  assert.equal(localSummary.ready,false,'로컬 상태만으로 READY를 만들 수 없어야 합니다.');

  const cloudReport=readiness.buildPrivacySafeReport({state:completeState,automatic,context:cloudContext,manual:cloudManual,summary:cloudSummary});
  assert.equal(cloudReport.overall,'ready');assert.equal(cloudReport.verificationSource,'cloud');assert.equal(cloudReport.operationEnvironment,'home');
  assert.equal(cloudReport.migrationVerified,true);assert.equal(cloudReport.securityAdvisorVerified,true);assert.equal(cloudReport.roleMatrixVerified,true);assert.equal(cloudReport.appVersion,'11.0.0');
  const localReport=readiness.buildPrivacySafeReport({state:completeState,automatic,context:localContext,manual:localManual,summary:localSummary});
  assert.equal(localReport.overall,'not-ready');assert.equal(localReport.verificationSource,'local');
  assert.equal(localReport.migrationVerified,false);assert.match(localReport.limitation,/전자서명된 증명서가 아닙니다/);
  const reportText=JSON.stringify(cloudReport);
  for(const forbidden of ['가상지원자홍길동','010-1234-5678','900101-1234567','residentNumber','phone','address','memo','password','ciphertext'])assert.ok(!reportText.includes(forbidden),`점검 보고서에 금지된 개인정보 필드가 포함됨: ${forbidden}`);

  assert.match(index,/css\/production-readiness\.css\?v=11\.1\.0/);assert.match(index,/js\/production-readiness\.js\?v=11\.1\.0/);assert.match(permissions,/readiness\.manage/);
  assert.match(source,/CLOUD_ADMIN_MESSAGE/);assert.match(source,/runEncryptionRoundTrip/);assert.match(source,/verificationSource/);assert.doesNotMatch(source,/localStorage[^\n]*(?:name|phone|residentNumber|address|memo)/i);

  for(const documentPath of ['docs/OPERATOR_GUIDE_v11.0.0.md','docs/INCIDENT_RECOVERY_v11.0.0.md','docs/RELEASE_READINESS_v11.0.0.md'])assert.ok(fs.existsSync(path.join(root,documentPath)),`${documentPath} 누락`);
  const releaseDocument=read('docs/RELEASE_READINESS_v11.0.0.md');assert.match(releaseDocument,/유출 비밀번호 보호/);assert.match(releaseDocument,/전자서명된 증명서/);assert.match(releaseDocument,/Rollback 제한[\s\S]*관리자 승인/);

  assert.match(migration,/create or replace function private\.erp_legacy_is_allowed_user/);assert.match(migration,/function private\.erp_set_app_settings_updated_at[\s\S]*security invoker/i);
  assert.match(migration,/function private\.erp_prepare_audit_log\(\)[\s\S]*resolved_app_role text[\s\S]*if resolved_app_role not in \('admin','recruiter'\)/i);
  assert.doesNotMatch(migration,/declare\s+current_role text/i,'v10.58 audit trigger의 PostgreSQL CURRENT_ROLE 충돌을 다시 만들면 안 됩니다.');
  assert.match(migration,/new\.actor_role := resolved_app_role/);assert.match(migration,/revoke all on function private\.erp_prepare_audit_log\(\)/i);
  assert.match(migration,/revoke all on function public\.can_write_operational_data\(uuid\) from public, anon, authenticated/i);assert.match(migration,/create index if not exists app_settings_updated_by_idx/);
  assert.doesNotMatch(migration,/read-only verification|select\s+t\.tablename|has_function_privilege/i,'실제 migration에는 검증 SELECT가 없어야 합니다.');
  assert.match(verification,/select[\s\S]*pg_policies[\s\S]*has_function_privilege/i);assert.match(verification,/erp_prepare_audit_log/);assert.match(verification,/audit_logs/);assert.doesNotMatch(verification,/\b(create|alter|drop|grant|revoke|insert|update|delete)\b/i,'검증 SQL은 읽기 전용이어야 합니다.');
  assert.match(rollback,/create policy allowed_users_select[\s\S]*is_admin_user\(auth\.uid\(\)\)/i);assert.match(rollback,/execute function public\.set_app_settings_updated_at\(\)/i);
  assert.match(rollback,/grant execute on function public\.can_write_operational_data\(uuid\) to authenticated/i);assert.match(rollback,/grant execute on function public\.set_app_settings_updated_at\(\) to public/i);
  assert.match(rollback,/audit trigger role-variable correction is intentionally retained/i);
  assert.doesNotMatch(migration,/auth\.role\(\)|user_metadata/i);

  console.log('production-readiness.test.js: cloud admin 보호·local READY 차단·fail-closed·AES-GCM 기능 시험·보고서·SQL 분리 확인 완료');
})().catch(error=>{console.error(error);process.exitCode=1;});
