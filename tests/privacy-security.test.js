'use strict';

const assert=require('node:assert/strict');
const privacy=require('../js/privacy-security.js');

assert.equal(privacy.VERSION,'10.58.0');
assert.equal(privacy.exportLabelForId('btnCsv'),'지원자 전체 CSV');
assert.equal(privacy.exportLabelForId('bcExport-employees'),'ERP 부분 JSON 백업');
assert.equal(privacy.exportLabelForId('btnLogin'),'');

assert.equal(privacy.shouldLock(1_000,601_000,600_000),true);
assert.equal(privacy.shouldLock(1_000,600_999,600_000),false);
assert.equal(privacy.shouldLock('invalid',601_000,600_000),false);

const record=privacy.makeExportRecord('btnCsv','테스트 지원자 CSV','2026-08-02T00:00:00.000Z');
assert.deepEqual(record,{id:'btnCsv',label:'테스트 지원자 CSV',at:'2026-08-02T00:00:00.000Z',version:'10.58.0'});

const log=privacy.trimExportLog([
  record,
  null,
  {id:'btnJson',label:'테스트 JSON',at:'2026-08-02T00:01:00.000Z'},
  {id:'bad',label:'',at:'2026-08-02T00:02:00.000Z'}
],1);
assert.equal(log.length,1);
assert.equal(log[0].id,'btnCsv');

console.log('privacy-security tests: passed');
