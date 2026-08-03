'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const readiness=require(path.join(root,'js','production-readiness.js'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const source=read('js/production-readiness.js');
const permissions=read('js/permissions.js');
const index=read('index.html');
const migrationName='supabase/migrations/20260803124545_production_readiness_security_hardening_v11_0_0.sql';
const migration=read(migrationName);

assert.equal(readiness.VERSION,'11.0.0');
assert.equal(readiness.STATE_KEY,'recruit_erp_production_readiness_v1100');
assert.equal(readiness.STATE_SCHEMA_VERSION,1);
assert.equal(readiness.MANUAL_CHECKS.length,6);
assert.deepEqual(readiness.MANUAL_CHECKS.map(item=>item.id),['roles_rls','encrypted_restore','delete_recovery','export_audit','operator_guide','incident_drill']);

const now=Date.parse('2026-08-03T12:00:00.000Z');
assert.equal(readiness.isFresh('2026-08-03T11:00:00.000Z',now),true);
assert.equal(readiness.isFresh('2026-06-01T00:00:00.000Z',now),false);
assert.equal(readiness.isFresh('2026-08-04T00:00:00.000Z',now),false);

const synthetic=readiness.runSyntheticCapacityCheck();
assert.deepEqual(synthetic.counts,{applicants:5000,employees:1000,schools:500});
assert.equal(synthetic.passed,true);
assert.ok(synthetic.durationMs<3000,'가상 6,500건 운영 성능 검사는 3초 안에 끝나야 합니다.');

const automatic=readiness.buildAutomaticChecks({
  versionReady:true,securityReady:true,encryptedBackupReady:true,permissionsReady:true,auditReady:true,
  savePending:0,deletePending:0,conflicts:0,storageWarning:false,capacityPassed:true,capacityFresh:true,capacityDurationMs:synthetic.durationMs
});
assert.equal(automatic.length,8);
assert.ok(automatic.every(item=>item.status==='pass'));
assert.equal(readiness.buildAutomaticChecks({...Object.fromEntries(['versionReady','securityReady','encryptedBackupReady','permissionsReady','auditReady'].map(key=>[key,true])),deletePending:1,capacityPassed:true,capacityFresh:true}).find(item=>item.id==='sync_queue').status,'fail');

const completedAt='2026-08-03T11:30:00.000Z';
const state={schemaVersion:1,version:'11.0.0',updatedAt:completedAt,manual:Object.fromEntries(readiness.MANUAL_CHECKS.map(item=>[item.id,{completedAt,role:'admin'}])),capacity:{...synthetic,phone:'010-1234-5678',memo:'보고서에 들어가면 안 되는 값'}};
const manual=readiness.manualStatus(state,now);
assert.equal(manual.ready,true);
assert.deepEqual(readiness.summarize(automatic,manual),{ready:true,failed:0,warnings:0,automaticPassed:8,automaticTotal:8,manualCompleted:6,manualTotal:6});

const report=readiness.buildPrivacySafeReport({state,automatic,manual,summary:readiness.summarize(automatic,manual)});
assert.equal(report.format,'recruit-erp-production-readiness');
assert.equal(report.overall,'ready');
const reportText=JSON.stringify(report);
for(const forbidden of ['가상지원자홍길동','010-1234-5678','900101-1234567','residentNumber','phone','address','memo','password','ciphertext'])assert.ok(!reportText.includes(forbidden),`점검 보고서에 금지된 개인정보 필드가 포함됨: ${forbidden}`);

assert.match(index,/css\/production-readiness\.css\?v=11\.0\.0/);
assert.match(index,/js\/production-readiness\.js\?v=11\.0\.0/);
assert.match(permissions,/readiness\.manage/);
assert.match(source,/개인정보 원문/);
assert.doesNotMatch(source,/localStorage[^\n]*(?:name|phone|residentNumber|address|memo)/i);

for(const documentPath of ['docs/OPERATOR_GUIDE_v11.0.0.md','docs/INCIDENT_RECOVERY_v11.0.0.md','docs/RELEASE_READINESS_v11.0.0.md'])assert.ok(fs.existsSync(path.join(root,documentPath)),`${documentPath} 누락`);
assert.match(read('docs/OPERATOR_GUIDE_v11.0.0.md'),/업무 시작[\s\S]*업무 종료[\s\S]*정기 점검/);
assert.match(read('docs/INCIDENT_RECOVERY_v11.0.0.md'),/저장 실패[\s\S]*삭제한 자료가 다시 나타남[\s\S]*배포 장애/);
assert.match(read('docs/RELEASE_READINESS_v11.0.0.md'),/유출 비밀번호 보호[\s\S]*병합·배포 중단 조건/);

assert.match(migration,/create or replace function private\.erp_legacy_is_allowed_user/);
assert.match(migration,/create or replace function private\.erp_legacy_is_admin/);
assert.match(migration,/function private\.erp_set_app_settings_updated_at[\s\S]*security invoker/i);
assert.match(migration,/revoke all on function public\.can_write_operational_data\(uuid\) from public, anon, authenticated/i);
assert.match(migration,/revoke all on function public\.set_app_settings_updated_at\(\) from public, anon, authenticated/i);
assert.match(migration,/using \(\(select private\.erp_legacy_is_allowed_user\(\(select auth\.uid\(\)\)\)\)\)/);
assert.match(migration,/with check \(\(select private\.erp_legacy_is_admin\(\(select auth\.uid\(\)\)\)\)\)/);
assert.match(migration,/create index if not exists app_settings_updated_by_idx/);
assert.doesNotMatch(migration,/auth\.role\(\)|user_metadata/i);

console.log('production-readiness.test.js: 운영 점검·가상 6,500건·개인정보 없는 보고서·Supabase 보안 migration·운영 문서 확인 완료');
