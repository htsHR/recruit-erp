'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const permissions=require(path.join(root,'js','permissions.js'));
const core=fs.readFileSync(path.join(root,'js','core.js'),'utf8');
const bindings=fs.readFileSync(path.join(root,'js','app-bindings.js'),'utf8');
const source=fs.readFileSync(path.join(root,'js','permissions.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

assert.equal(permissions.VERSION,'12.5.1');
for(const role of ['admin','local_admin','legacy_admin'])assert(permissions.has('applicant.delete',role));
assert(permissions.has('applicant.write','recruiter'));
assert(permissions.has('schedule.write','recruiter'));
assert(permissions.has('audit.write','recruiter'));
assert(!permissions.has('applicant.delete','recruiter'));
assert(!permissions.has('backup.restore','recruiter'));
assert(permissions.has('applicant.read','viewer'));
assert(!permissions.has('applicant.write','viewer'));
assert(!permissions.has('backup.restore','viewer'));
assert.match(core,/erpPermissions\.require\('applicant\.write'\)/);
assert.match(bindings,/erpPermissions\.require\('backup\.restore'\)/);
assert.match(index,/js\/permissions\.js\?v=12\.5\.1/);
assert.match(index,/js\/audit-history\.js\?v=12\.5\.1/);
assert.doesNotMatch(index,/css\/permissions\.css|css\/audit-history\.css|id="permissions"|id="auditHistory"/);
assert.equal(permissions.requiredPermission({dataset:{page:'backup'}}),'backup.manage');
assert.equal(permissions.requiredPermission({dataset:{page:'form'}}),'applicant.write');
assert.equal(permissions.useLocal('', 'viewer').role,'viewer');
assert.equal(permissions.current().source,'local');
permissions.useLocal();
assert.equal(permissions.current().role,'local_admin');
assert.doesNotMatch(source,/permission-matrix|permissionPageBody|auditPageBody|supabase|root\.sb|fetch\(|getSession|signIn|signOut/i);

console.log('permissions.test.js: 내부 권한 보호 유지·권한 관리 화면 제거·LOCAL ONLY 확인 완료');
