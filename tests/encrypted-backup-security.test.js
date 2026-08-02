'use strict';

const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const encrypted=require('../js/encrypted-backup.js');
const security=require('../js/security.js');

const password='가상 보안 검사 전용 긴 비밀번호 2026';
const options={crypto:webcrypto,iterations:100000};
const datasetKeys=['applicants','schools','employees','calendarEvents','hireWaitingProfiles','messageTemplates'];

async function encryptedPayloadIsBlocked(payload,label){
  const envelope=await encrypted.encryptObject(payload,password,options);
  const parsed=await encrypted.decryptEnvelope(envelope,password,{crypto:webcrypto});
  assert.throws(()=>security.validateBackupPayload(parsed,{datasetKeys}),undefined,`${label} 암호화 백업은 차단되어야 합니다.`);
}

(async()=>{
  const currentData={applicants:[{id:'safe-app-1',name:'가상 기존 지원자'}],employees:[{id:'safe-emp-1',name:'가상 기존 사원'}],schools:[{id:'safe-school-1',name:'가상 기존 학교'}]};
  const before=JSON.stringify(currentData);

  await encryptedPayloadIsBlocked(JSON.parse('{"data":{"applicants":[{"id":"safe-app-2","__proto__":{"polluted":true}}]}}'),'__proto__');
  await encryptedPayloadIsBlocked(JSON.parse('{"data":{"applicants":[{"id":"safe-app-2","constructor":{"polluted":true}}]}}'),'constructor');
  await encryptedPayloadIsBlocked(JSON.parse('{"data":{"applicants":[{"id":"safe-app-2","prototype":{"polluted":true}}]}}'),'prototype');

  const deep={};let cursor=deep;for(let index=0;index<13;index++){cursor.next={};cursor=cursor.next;}
  await encryptedPayloadIsBlocked(deep,'13단계 이상 깊이');
  await encryptedPayloadIsBlocked({data:{applicants:Array.from({length:250001},()=>null)}},'과대 노드');
  await encryptedPayloadIsBlocked({data:{applicants:[{id:'<img-src-x-onerror-alert-1>',name:'가상 위험 ID'}]}},'위험한 ID');

  assert.equal(JSON.stringify(currentData),before,'차단된 암호화 백업은 현재 ERP 자료를 바꾸면 안 됩니다.');
  console.log('encrypted-backup-security.test.js: 위험 키·깊이·노드 수·ID 차단 및 기존 자료 불변 확인 완료');
})().catch(error=>{console.error(error);process.exitCode=1;});
