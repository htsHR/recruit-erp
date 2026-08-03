'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

global.erpSecurity=require('../js/security.js');
const storage=require('../js/storage-performance.js');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js','storage-performance.js'),'utf8');
const safetySource=fs.readFileSync(path.join(root,'js','safety.js'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

assert.equal(storage.VERSION,'10.61.0');
assert.equal(storage.DB_NAME,'recruit-erp-storage-v10-61');
assert.equal(storage.MAX_SNAPSHOTS,5);
assert.equal(storage.DATASETS.length,6);
assert.match(source,/indexedDB\.open\(DB_NAME,DB_VERSION\)/);
assert.match(source,/createObjectStore\(DATASET_STORE/);
assert.match(source,/createObjectStore\(SNAPSHOT_STORE/);
assert.match(source,/createObjectStore\(SNAPSHOT_META_STORE/);
assert.match(source,/withStore\(SNAPSHOT_META_STORE,'readonly'/);
assert.doesNotMatch(source,/withStore\(SNAPSHOT_STORE,'readonly',store=>store\.getAll/);
assert.match(source,/erpSecurity\?\.assertSafeTree/);
assert.match(source,/erpSecurity\?\.validateRowIds/);
assert.match(safetySource,/erp:storage-write/);
assert.doesNotMatch(safetySource,/detail:\{[^}]*value/);
assert.match(index,/js\/storage-performance\.js\?v=10\.61\.0/);
assert.match(index,/css\/storage-performance\.css\?v=10\.61\.0/);
assert.match(source,/DATASETS\.find\(item=>item\.key===event\?\.detail\?\.key\)/);

assert.equal(storage.formatBytes(0),'0 B');
assert.equal(storage.formatBytes(1024),'1.0 KB');
assert.equal(storage.shouldWarn({localBytes:storage.LOCAL_WARNING_BYTES}),true);
assert.equal(storage.shouldWarn({usage:81,quota:100}),true);
assert.equal(storage.shouldWarn({usage:1,quota:10*1024*1024}),false);

const makeRows=(prefix,count)=>Array.from({length:count},(_,index)=>({id:`${prefix}-${String(index+1).padStart(6,'0')}`,name:`가상자료-${index+1}`,status:'테스트',memo:'실제 개인정보가 아닌 성능검사용 가상 데이터'}));
const started=Date.now();
const applicants=makeRows('applicant',5000);
const employees=makeRows('employee',1000);
const schools=makeRows('school',500);
const summaries=[storage.datasetSummary(applicants,'지원자'),storage.datasetSummary(employees,'사원'),storage.datasetSummary(schools,'학교')];
assert.deepEqual(summaries.map(item=>item.count),[5000,1000,500]);
assert.ok(summaries.every(item=>item.bytes>0));
assert.ok(Date.now()-started<3000,'가상 대용량 자료 요약은 3초 안에 끝나야 합니다.');

const parsed=storage.safeParseDataset(JSON.stringify(applicants.slice(0,3)),storage.DATASETS[0]);
assert.equal(parsed.count,3);
assert.throws(()=>storage.safeParseDataset('[{"id":"../../danger"}]',storage.DATASETS[0]));
assert.throws(()=>storage.safeParseDataset('{"not":"rows"}',storage.DATASETS[0]));

for(const forbidden of ['name','phone','residentNumber','memo'])assert.doesNotMatch(source,new RegExp(`console\\.(?:warn|error)\\([^\\n]*${forbidden}`,'i'));

console.log('storage-performance.test.js: IndexedDB 안전 복사·용량 경고·6,500건 가상 데이터 성능 확인 완료');
