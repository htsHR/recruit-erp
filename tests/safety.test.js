const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const alerts=[];
global.alert=message=>alerts.push(message);
global.localStorage={setItem(){}};
const safety=require('../js/safety.js');

assert.equal(safety.safeLocalStorageSet('test','ok'),true);
global.localStorage={setItem(){throw new Error('QuotaExceededError');}};
const originalConsoleError=console.error;
console.error=()=>{};
assert.equal(safety.safeLocalStorageSet('test','fail'),false);
console.error=originalConsoleError;
assert.equal(alerts.length,1);
assert.match(alerts[0],/입력한 내용은 화면에 그대로 남아/);

const existing={name:'테스트사원',team:'기존팀',notes:'기존 메모',disciplineCount:3};
const merged=safety.sparseMerge(existing,{name:'  ',team:null,notes:undefined,disciplineCount:0});
assert.equal(merged.name,'테스트사원');
assert.equal(merged.team,'기존팀');
assert.equal(merged.notes,'기존 메모');
assert.equal(merged.disciplineCount,0);
assert.equal(safety.sparseMerge(existing,{team:'안전팀'}).team,'안전팀');

['=1+1','+SUM(A1:A2)','-2+3','@cmd','  =HYPERLINK("x")'].forEach(value=>{
  assert.ok(safety.csvSafeValue(value).startsWith("'"),value);
  assert.ok(safety.csvCell(value,true).includes("'"),value);
});
assert.equal(safety.csvSafeValue('테스트 값'),'테스트 값');
assert.equal(safety.csvCell('쉼표,포함',false),'"쉼표,포함"');

const root=path.resolve(__dirname,'..');
const csvFiles=['applicant-bulk.js','applicant-tools.js'];
csvFiles.forEach(file=>{
  const source=fs.readFileSync(path.join(root,'js',file),'utf8');
  assert.match(source,/erpSafety\.csvCell/,`${file} must use the shared CSV defense`);
});

const bindings=fs.readFileSync(path.join(root,'js','app-bindings.js'),'utf8');
assert.match(bindings,/const previous=applicants\.slice\(\);[\s\S]*?if\(!save\(\)\)\{[\s\S]*?applicants=previous;[\s\S]*?return;[\s\S]*?resetForm\(\);[\s\S]*?setPage\('applicants'\)/);

console.log('safety.test.js: all checks passed');
