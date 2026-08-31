'use strict';

const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const center=read('js/backup-center.js'),core=read('js/encrypted-backup.js'),ui=read('js/encrypted-backup-ui.js'),security=read('js/security.js'),audit=read('js/audit-history.js'),permissions=read('js/permissions.js'),index=read('index.html'),workflow=read('.github/workflows/quality-checks.yml');

assert.match(center,/const BC_FORMAT='recruit-erp-backup'/);assert.match(center,/const BC_SCHEMA=2/);assert.match(center,/const BC_STATUS_SCHEMA=2/);
for(const key of ['recruit_erp_applicants_stable','recruit_erp_schools','recruit_erp_employees','recruit_erp_calendar_events','recruit_erp_hire_waiting_profiles','recruit_erp_message_templates'])assert.ok(center.includes(key),`기존 저장키 누락: ${key}`);
assert.match(core,/const FORMAT='recruit-erp-encrypted-backup'/);assert.match(core,/const CRYPTO_SCHEMA_VERSION=1/);assert.match(core,/AES-GCM/);assert.match(core,/PBKDF2/);assert.match(core,/SHA-256/);assert.match(core,/false,\['encrypt','decrypt'\]/,'CryptoKey는 추출 불가능해야 합니다.');
assert.doesNotMatch(core,/localStorage|sessionStorage|indexedDB/i,'암호화 핵심은 브라우저 저장소를 사용하면 안 됩니다.');
assert.match(center,/backupCurrentBeforeChangeEncrypted/);assert.match(center,/recruit_erp_safety_before_.*\.erpbackup/);assert.match(center,/inspectDecryptedFile/);assert.match(center,/validateBackupPayload\(parsed/);assert.match(center,/canonicalize\(parsed\)/);assert.match(center,/clearInspection\(\)/);
assert.match(center,/백업 데이터 정규화 실패: \$\{key\}, \$\{index\+1\}번째 행/);assert.doesNotMatch(center,/Backup normalize failed/);
assert.match(security,/function validateBackupPayload/);assert.match(security,/assertSafeTree\(parsed\)/);assert.match(security,/validateRowIds\(rows/);
assert.match(ui,/erpPermissions\.require\('backup\.manage'\)/);assert.match(ui,/clearSensitive/);assert.match(ui,/endSession/);assert.match(ui,/비밀번호가 맞지 않거나 파일이 손상되었습니다/);assert.doesNotMatch(ui,/localStorage\.setItem|sessionStorage\.setItem|indexedDB/i);
assert.match(audit,/<option value="export">백업·내보내기<\/option>/);
assert.ok(!/recruiter:\[[^\]]*backup\./.test(permissions),'채용담당자에게 백업 권한을 추가하면 안 됩니다.');assert.ok(!/viewer:\[[^\]]*backup\./.test(permissions),'조회 전용에게 백업 권한을 추가하면 안 됩니다.');
assert.ok(index.indexOf('js/encrypted-backup.js')<index.indexOf('js/backup-center.js'));assert.ok(index.indexOf('js/backup-center.js')<index.indexOf('js/encrypted-backup-ui.js'));assert.match(index,/accept="\.erpbackup,\.json,application\/json"/);assert.match(index,/css\/encrypted-backup\.css\?v=12\.0\.2/);
assert.match(workflow,/UI_SCREENSHOT_DIR: artifacts\/ui-v12\.3\.1/);assert.match(workflow,/path: artifacts\/ui-v12\.3\.1/);
const retiredDir=path.join(root,'supabase');const retiredFiles=fs.existsSync(retiredDir)?fs.readdirSync(retiredDir,{recursive:true}).filter(file=>fs.statSync(path.join(retiredDir,file)).isFile()):[];assert.deepEqual(retiredFiles,[],'폐기된 원격 DB migration이 남으면 안 됩니다.');
for(const retired of ['supabase_config.js','js/auth-init.js','js/cloud-sync.js','js/sync-safety.js','js/shared-storage.js'])assert.equal(fs.existsSync(path.join(root,retired)),false,`${retired}는 LOCAL ONLY 배포에 남으면 안 됩니다.`);
assert.ok(fs.existsSync(path.join(root,'docs','ENCRYPTED_BACKUP_v10.60.0.md')));assert.ok(fs.existsSync(path.join(root,'CHANGELOG_v11.0.0.md')));

console.log('encrypted-backup-integration.test.js: 스키마·저장키·권한·복원 안전·CI 연결 확인 완료');
