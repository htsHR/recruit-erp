const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const safety=require('../js/safety.js');

let nextId=0;
const context=vm.createContext({
  console,
  window:{erpSafety:safety},
  uid:()=>`test-${++nextId}`,
  EMPLOYEES_KEY:'test_employees',
  localStorage:{getItem:()=>null,setItem:()=>{}},
  safeLocalStorageSet:()=>true,
  canUseCloud:()=>false,
  alert:()=>{},
  confirm:()=>true,
  document:{getElementById:()=>null,querySelectorAll:()=>[]},
  setTimeout:()=>{},
  clearTimeout:()=>{},
  Blob:function(){},
  URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}},
  TextDecoder,
  DecompressionStream:undefined
});
vm.runInContext(fs.readFileSync(require.resolve('../js/employees.js'),'utf8'),context);
vm.runInContext(`employees=[normalizeEmployee({
  id:'employee-1',empNo:'TEST-001',name:'가상사원',team:'기존팀',department:'기존팀',
  notes:'기존 메모',status:'재직중',disciplineCount:2,createdAt:'2026-01-01T00:00:00.000Z'
})]`,context);

const result=JSON.parse(vm.runInContext(`JSON.stringify(employeeJsonImportPlan([{
  empNo:'TEST-001',name:'   ',team:'안전팀',notes:null,status:undefined,disciplineCount:0
}]))`,context));

assert.equal(result.added,0);
assert.equal(result.updated,1);
assert.equal(result.next[0].name,'가상사원');
assert.equal(result.next[0].notes,'기존 메모');
assert.equal(result.next[0].status,'재직중');
assert.equal(result.next[0].team,'안전팀');
assert.equal(result.next[0].disciplineCount,0);
assert.ok(result.changes.some(change=>change.field==='team'));
assert.ok(result.changes.some(change=>change.field==='disciplineCount'));
assert.ok(!result.changes.some(change=>['name','notes','status'].includes(change.field)));

const preview=vm.runInContext('employeeJsonImportPreview(employeeJsonImportPlan([{empNo:"TEST-001",team:"미리보기팀"}]))',context);
assert.match(preview,/사원 JSON 변경 미리보기/);
assert.match(preview,/기존팀 → 미리보기팀/);

console.log('employee-import.test.js: all checks passed');
