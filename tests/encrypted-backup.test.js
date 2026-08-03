'use strict';

const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const encrypted=require('../js/encrypted-backup.js');

const password='가상 백업 전용 긴 비밀번호 2026';
const fakePackage={
  format:'recruit-erp-backup',schemaVersion:2,appVersion:'10.63.0',statusSchemaVersion:2,backupType:'full',createdAt:'2026-08-02T00:00:00.000Z',
  counts:{applicants:1,schools:1,employees:1,calendarEvents:1,hireWaitingProfiles:1,messageTemplates:1},
  metadata:{excelApplicantIds:[]},integrity:{algorithm:'fnv1a32-stable-json',datasets:{applicants:'11111111',schools:'22222222',employees:'33333333',calendarEvents:'44444444',hireWaitingProfiles:'55555555',messageTemplates:'66666666'},packageDigest:'77777777'},
  data:{
    applicants:[{id:'fake-applicant-1',name:'가상지원자',phone:'010-0000-0001',address:'가상시 테스트로 1'}],
    schools:[{id:'fake-school-1',name:'가상대학교'}],employees:[{id:'fake-employee-1',name:'가상사원'}],calendarEvents:[{id:'fake-event-1',title:'가상 면접',date:'2026-08-02'}],
    hireWaitingProfiles:[{id:'fake-waiting-1',applicantId:'fake-applicant-1',residentNumber:'000000-0000000'}],messageTemplates:[{id:'fake-template-1',title:'가상 안내',body:'가상 문구'}]
  }
};
const options={crypto:webcrypto,iterations:100000};
const mutateBase64=value=>{const first=value[0]==='A'?'B':'A';return first+value.slice(1);};
async function rejectsCode(fn,code){await assert.rejects(fn,error=>error?.code===code,`예상 오류 코드: ${code}`);}

(async()=>{
  assert.equal(encrypted.VERSION,'10.63.0');assert.equal(encrypted.FORMAT,'recruit-erp-encrypted-backup');assert.equal(encrypted.CRYPTO_SCHEMA_VERSION,1);assert.equal(encrypted.DEFAULT_ITERATIONS,310000);
  assert.equal(encrypted.passwordAssessment('짧은값').valid,false);assert.equal(encrypted.passwordAssessment('가상 백업 전용 긴 비밀번호','다른 확인값').valid,false);assert.equal(encrypted.passwordAssessment(password,password).valid,true);

  const envelope=await encrypted.encryptObject(fakePackage,password,options);
  assert.deepEqual(Object.keys(envelope).sort(),['appVersion','cipher','cryptoSchemaVersion','format','kdf','payload'].sort());
  assert.equal(envelope.kdf.iterations,100000);assert.equal(encrypted.base64ToBytes(envelope.kdf.salt).length,16);assert.equal(encrypted.base64ToBytes(envelope.cipher.iv).length,12);
  const serialized=JSON.stringify(envelope);for(const secret of ['가상지원자','010-0000-0001','000000-0000000','가상시 테스트로 1'])assert.ok(!serialized.includes(secret),`암호화 봉투에 평문이 노출됨: ${secret}`);
  assert.deepEqual(await encrypted.decryptEnvelope(envelope,password,{crypto:webcrypto}),fakePackage,'암호화 round-trip은 원본 전체와 같아야 합니다.');

  const second=await encrypted.encryptObject(fakePackage,password,options);assert.notEqual(second.kdf.salt,envelope.kdf.salt);assert.notEqual(second.cipher.iv,envelope.cipher.iv);assert.notEqual(second.payload,envelope.payload);
  await rejectsCode(()=>encrypted.decryptEnvelope(envelope,'틀린 가상 비밀번호 1234',{crypto:webcrypto}),'DECRYPT_FAILED');
  for(const [field,tampered] of [
    ['payload',{...envelope,payload:mutateBase64(envelope.payload)}],
    ['salt',{...envelope,kdf:{...envelope.kdf,salt:mutateBase64(envelope.kdf.salt)}}],
    ['iv',{...envelope,cipher:{...envelope.cipher,iv:mutateBase64(envelope.cipher.iv)}}]
  ])await rejectsCode(()=>encrypted.decryptEnvelope(tampered,password,{crypto:webcrypto}),field==='payload'?'DECRYPT_FAILED':'DECRYPT_FAILED');

  assert.throws(()=>encrypted.validateEnvelope({...envelope,cryptoSchemaVersion:2}),error=>error.code==='UNSUPPORTED_SCHEMA');
  assert.throws(()=>encrypted.validateEnvelope({...envelope,unexpected:true}),error=>error.code==='INVALID_ENVELOPE');
  assert.throws(()=>encrypted.validateEnvelope({...envelope,kdf:{...envelope.kdf,unexpected:true}}),error=>error.code==='INVALID_ENVELOPE');
  assert.throws(()=>encrypted.validateEnvelope({...envelope,cipher:{...envelope.cipher,unexpected:true}}),error=>error.code==='INVALID_ENVELOPE');
  assert.throws(()=>encrypted.validateEnvelope({...envelope,payload:'%%%='}),error=>error.code==='INVALID_ENVELOPE');
  assert.throws(()=>encrypted.parseEnvelope(''),error=>error.code==='INVALID_ENVELOPE');
  assert.throws(()=>encrypted.parseEnvelope('x'.repeat(1025),{maxBytes:1024}),error=>error.code==='FILE_TOO_LARGE');
  await rejectsCode(()=>encrypted.encryptObject({text:'x'.repeat(900)},password,{crypto:webcrypto,iterations:100000,maxBytes:1024}),'FILE_TOO_LARGE');
  await rejectsCode(()=>encrypted.encryptObject(fakePackage,password,{crypto:{}}),'UNSUPPORTED');

  const storageWrites=[];const previousLocal=globalThis.localStorage,previousSession=globalThis.sessionStorage;
  globalThis.localStorage={setItem:(...args)=>storageWrites.push(['local',...args]),getItem:()=>null};globalThis.sessionStorage={setItem:(...args)=>storageWrites.push(['session',...args]),getItem:()=>null};
  await encrypted.encryptObject(fakePackage,password,options);assert.deepEqual(storageWrites,[],'비밀번호·키 자료는 브라우저 저장소에 쓰면 안 됩니다.');
  globalThis.localStorage=previousLocal;globalThis.sessionStorage=previousSession;

  const performancePackage={...fakePackage,counts:{applicants:5000,employees:1500,schools:500,calendarEvents:400,hireWaitingProfiles:250,messageTemplates:80},data:{
    applicants:Array.from({length:5000},(_,i)=>({id:`fake-app-${i}`,name:`가상지원자${i}`,phone:`010-0000-${String(i).padStart(4,'0')}`,memo:'가상 성능 시험 자료 '.repeat(3)})),
    employees:Array.from({length:1500},(_,i)=>({id:`fake-emp-${i}`,empNo:`T${String(i).padStart(5,'0')}`,name:`가상사원${i}`,department:'테스트팀'})),
    schools:Array.from({length:500},(_,i)=>({id:`fake-school-${i}`,name:`가상학교${i}`,address:'가상 주소'})),
    calendarEvents:Array.from({length:400},(_,i)=>({id:`fake-event-${i}`,title:`가상 일정 ${i}`,date:'2026-08-02'})),
    hireWaitingProfiles:Array.from({length:250},(_,i)=>({id:`fake-wait-${i}`,applicantId:`fake-app-${i}`,residentNumber:'000000-0000000'})),
    messageTemplates:Array.from({length:80},(_,i)=>({id:`fake-message-${i}`,title:`가상 안내 ${i}`,body:'가상 안내문 '.repeat(10)}))
  }};
  const rawBytes=Buffer.byteLength(JSON.stringify(performancePackage));const start=performance.now();const largeEnvelope=await encrypted.encryptObject(performancePackage,password,{crypto:webcrypto});const encryptedMs=Math.round(performance.now()-start);const decryptStart=performance.now();const largeRoundTrip=await encrypted.decryptEnvelope(largeEnvelope,password,{crypto:webcrypto});const decryptedMs=Math.round(performance.now()-decryptStart);
  assert.equal(largeRoundTrip.data.applicants.length,5000);assert.equal(largeRoundTrip.data.employees.length,1500);assert.equal(largeRoundTrip.data.schools.length,500);assert.ok(rawBytes<encrypted.MAX_FILE_BYTES);assert.ok(encryptedMs<30000&&decryptedMs<30000,'가상 대용량 암호화/복호화가 각각 30초 안에 끝나야 합니다.');
  console.log(`encrypted-backup.test.js: 암호화·변조·저장소·호환성 통과 (가상 데이터 ${(rawBytes/1048576).toFixed(2)}MB, 암호화 ${encryptedMs}ms, 복호화 ${decryptedMs}ms)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
