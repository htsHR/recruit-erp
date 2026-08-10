'use strict';

const assert=require('node:assert/strict');
const sync=require('../js/sync-safety.js');

const old={id:'test-1',name:'테스트지원자',status:'서류검토',updatedAt:'2026-08-01T00:00:00.000Z'};
const base=sync.fingerprint(old);

const localOnlyChange={...old,status:'면접예정',updatedAt:'2026-08-02T01:00:00.000Z'};
let result=sync.mergeDataset([localOnlyChange],[old],{'test-1':base});
assert.equal(result.rows[0].status,'면접예정');
assert.equal(result.conflicts.length,0);

const cloudOnlyChange={...old,status:'서류합격',updatedAt:'2026-08-02T02:00:00.000Z'};
result=sync.mergeDataset([old],[cloudOnlyChange],{'test-1':base});
assert.equal(result.rows[0].status,'서류합격');
assert.equal(result.conflicts.length,0);

result=sync.mergeDataset([localOnlyChange],[cloudOnlyChange],{'test-1':base});
assert.equal(result.rows[0].status,'면접예정');
assert.equal(result.conflicts.length,1);
assert.equal(result.conflicts[0].cloud.status,'서류합격');

const sameContentDifferentTime={...localOnlyChange,updatedAt:'2026-08-02T03:00:00.000Z'};
result=sync.mergeDataset([localOnlyChange],[sameContentDifferentTime],{'test-1':base});
assert.equal(result.conflicts.length,0);
assert.equal(result.rows[0].updatedAt,'2026-08-02T03:00:00.000Z');

result=sync.mergeDataset([{id:'local',name:'로컬테스트'}],[{id:'cloud',name:'클라우드테스트'}],{});
assert.deepEqual(result.rows.map(row=>row.id),['local','cloud']);

let pending=sync.mergePendingIds({},'applicants',[{id:'test-1'},{id:'test-2'}]);
pending=sync.mergePendingIds(pending,'applicants',[{id:'test-2'},{id:'test-3'}]);
assert.deepEqual(pending.applicants,['test-1','test-2','test-3']);

assert.equal(sync.VERSION,'11.0.0');
console.log('sync-safety tests: passed');
