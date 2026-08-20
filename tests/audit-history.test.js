'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const audit=require(path.join(root,'js','audit-history.js'));
const source=fs.readFileSync(path.join(root,'js','audit-history.js'),'utf8');

assert.equal(audit.VERSION,'12.0.2');
assert.equal(audit.scrubText('010-1234-5678 test@example.com 900101-1234567'),'[전화번호 숨김] [이메일 숨김] [주민등록번호 숨김]');
assert.equal(audit.valueSummary('residentNumber','900101-1234567'),'개인정보/내용 변경됨');
assert.equal(audit.valueSummary('memo','비밀 메모'),'개인정보/내용 변경됨');
assert.equal(audit.valueSummary('status','면접완료'),'면접완료');

const records=audit.buildDatasetRecords('applicant',[{id:'a1',name:'가상지원자',phone:'010-1111-2222',status:'서류검토'}],[{id:'a1',name:'가상지원자',phone:'010-9999-8888',status:'면접완료'}]);
assert.equal(records.length,1);
assert.equal(records[0].action,'update');
assert(records[0].changed_fields.includes('phone'));
assert.equal(records[0].before_values.phone,'개인정보/내용 변경됨');
assert.equal(records[0].after_values.phone,'개인정보/내용 변경됨');
assert.equal(records[0].before_values.status,'서류검토');
assert.equal(records[0].after_values.status,'면접완료');
assert(!JSON.stringify(records).includes('010-1111-2222'));

const deletion=audit.buildDatasetRecords('employee',[{id:'e1',name:'가상사원'}],[],{reason:'중복 가상 자료 정리'});
assert.equal(deletion[0].action,'delete');
assert.equal(deletion[0].reason,'중복 가상 자료 정리');
assert.doesNotMatch(source,/root\.sb|window\.sb|fetch\(|\.upsert\(|\.delete\(\)\.in\(/);
const retiredDir=path.join(root,'supabase');
const retiredFiles=fs.existsSync(retiredDir)?fs.readdirSync(retiredDir,{recursive:true}).filter(file=>fs.statSync(path.join(retiredDir,file)).isFile()):[];
assert.deepEqual(retiredFiles,[],'원격 DB migration 파일이 남으면 안 됩니다.');
console.log('audit-history.test.js: 로컬 변경/삭제 기록·민감정보 마스킹·원격 전송 0건 확인 완료');
