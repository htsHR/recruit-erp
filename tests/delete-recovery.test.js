'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const runtime=read('js/local-only-init.js');
const applicant=read('js/school-relations.js');
const employee=read('js/employees.js');
const school=read('js/schools.js');
const bulk=read('js/bindings.js');
const merge=read('js/school-merge-manager.js');

assert.doesNotMatch(runtime,/getSession|signInWithPassword|signOut|retryDeletes|fetch\(/,'LOCAL ONLY 초기화가 인증·원격 동기화를 시작하면 안 됩니다.');
assert.match(applicant,/const previous=applicants;applicants=applicants\.filter[\s\S]*?if\(!save\(\)\)\{applicants=previous/,'지원자 삭제 저장 실패 시 배열을 복구해야 합니다.');
assert.match(employee,/const previous=employees;employees=employees\.filter[\s\S]*?if\(!saveEmployees\(\)\)\{employees=previous/,'사원 삭제 저장 실패 시 배열을 복구해야 합니다.');
assert.match(school,/const previous=schools;schools=schools\.filter[\s\S]*?if\(!saveSchools\(\)\)\{schools=previous/,'학교 삭제 저장 실패 시 배열을 복구해야 합니다.');
assert.match(bulk,/const previous=applicants;[\s\S]*?applicants=\[\];[\s\S]*?if\(!save\(\)\)\{applicants=previous/,'지원자 전체 삭제 저장 실패 시 배열을 복구해야 합니다.');

for(const [name,source] of Object.entries({applicant,employee,school,bulk,merge})){
  assert.doesNotMatch(source,/supabase|retryDeletes|enqueueDelete|cloud-sync/i,`${name} 삭제 경로에 폐기된 원격 삭제 대기가 남으면 안 됩니다.`);
}
assert.match(bulk,/먼저 암호화 백업/);
assert.match(merge,/schoolMergeSafetyBackup\(\)/);
console.log('delete-recovery.test.js: LOCAL ONLY 삭제 저장 실패 원상복구·원격 삭제 대기 0건 확인 완료');
