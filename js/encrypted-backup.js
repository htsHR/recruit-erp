/* Recruit ERP v10.63.0 encrypted backup primitives.
 * The encrypted envelope contains no business data outside the AES-GCM payload.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpEncryptedBackup=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const VERSION='10.63.0';
  const FORMAT='recruit-erp-encrypted-backup';
  const CRYPTO_SCHEMA_VERSION=1;
  const DEFAULT_ITERATIONS=310000;
  const MIN_ITERATIONS=100000;
  const MAX_ITERATIONS=2000000;
  const SALT_BYTES=16;
  const IV_BYTES=12;
  const MAX_FILE_BYTES=50*1024*1024;
  const ENVELOPE_KEYS=new Set(['format','cryptoSchemaVersion','appVersion','kdf','cipher','payload']);
  const KDF_KEYS=new Set(['name','hash','iterations','salt']);
  const CIPHER_KEYS=new Set(['name','iv']);
  const encoder=new TextEncoder();
  const decoder=new TextDecoder('utf-8',{fatal:true});

  class EncryptedBackupError extends Error{
    constructor(code,message){super(message);this.name='EncryptedBackupError';this.code=code;}
  }
  const fail=(code,message)=>{throw new EncryptedBackupError(code,message);};
  function cryptoApi(override){return override||root.crypto;}
  function isSupported(override){const api=cryptoApi(override);return !!(api&&api.subtle&&typeof api.getRandomValues==='function');}
  function requireCrypto(override){const api=cryptoApi(override);if(!isSupported(api))fail('UNSUPPORTED','이 브라우저는 안전한 암호화 백업을 지원하지 않습니다. 최신 브라우저에서 다시 시도하세요.');return api;}
  function byteLength(text){return encoder.encode(String(text==null?'':text)).byteLength;}
  function assertWithinLimit(size,maxBytes=MAX_FILE_BYTES){if(!Number.isFinite(size)||size<0)fail('INVALID_SIZE','파일 크기를 확인할 수 없습니다.');if(size>maxBytes)fail('FILE_TOO_LARGE','백업 파일이 50MB를 초과합니다.');}

  function bytesToBase64(bytes){
    const view=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);let binary='';
    for(let offset=0;offset<view.length;offset+=0x8000)binary+=String.fromCharCode(...view.subarray(offset,offset+0x8000));
    if(typeof root.btoa==='function')return root.btoa(binary);
    if(typeof Buffer!=='undefined')return Buffer.from(view).toString('base64');
    fail('UNSUPPORTED','base64 변환을 지원하지 않는 환경입니다.');
  }
  function base64ToBytes(value,label='값'){
    const text=String(value||'');
    if(!text||text.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))fail('INVALID_ENVELOPE',`${label}의 인코딩이 올바르지 않습니다.`);
    try{
      let binary;
      if(typeof root.atob==='function')binary=root.atob(text);
      else if(typeof Buffer!=='undefined')binary=Buffer.from(text,'base64').toString('binary');
      else fail('UNSUPPORTED','base64 변환을 지원하지 않는 환경입니다.');
      const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;
    }catch(error){if(error instanceof EncryptedBackupError)throw error;fail('INVALID_ENVELOPE',`${label}의 인코딩이 올바르지 않습니다.`);}
  }
  function passwordAssessment(password,confirmation){
    const value=String(password==null?'':password);const errors=[];const warnings=[];
    if(value.trim()==='')errors.push('비밀번호를 입력하세요.');
    else if(value.length<12)errors.push('비밀번호는 12자 이상이어야 합니다.');
    if(confirmation!==undefined&&value!==String(confirmation==null?'':confirmation))errors.push('비밀번호 확인이 일치하지 않습니다.');
    if(value.length>=12&&(new Set(value).size<=3||/^(.)\1+$/.test(value)||/^(password|qwerty|1234|abcd)/i.test(value)))warnings.push('추측하기 쉬운 비밀번호입니다. 더 긴 문장형 비밀번호를 권장합니다.');
    return {valid:errors.length===0,errors,warnings,length:value.length};
  }
  function validateIterations(value){const n=Number(value);if(!Number.isInteger(n)||n<MIN_ITERATIONS||n>MAX_ITERATIONS)fail('UNSUPPORTED_SCHEMA','지원하지 않는 암호화 반복 횟수입니다.');return n;}
  function assertAllowedKeys(value,allowed){
    if(!value||Object.prototype.toString.call(value)!=='[object Object]')fail('INVALID_ENVELOPE','암호화 백업 파일 구조가 올바르지 않습니다.');
    const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)fail('INVALID_ENVELOPE','암호화 백업 파일 구조가 올바르지 않습니다.');
    if(Object.keys(value).some(key=>!allowed.has(key)))fail('INVALID_ENVELOPE','암호화 백업 파일에 허용되지 않은 항목이 있습니다.');
  }
  async function deriveKey(password,salt,iterations,override){
    const api=requireCrypto(override);const material=await api.subtle.importKey('raw',encoder.encode(String(password)),'PBKDF2',false,['deriveKey']);
    return api.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  function validateEnvelope(value,maxBytes=MAX_FILE_BYTES){
    assertAllowedKeys(value,ENVELOPE_KEYS);
    assertAllowedKeys(value.kdf,KDF_KEYS);
    assertAllowedKeys(value.cipher,CIPHER_KEYS);
    if(value.format!==FORMAT)fail('INVALID_ENVELOPE','Recruit ERP 암호화 백업 파일이 아닙니다.');
    if(Number(value.cryptoSchemaVersion)!==CRYPTO_SCHEMA_VERSION)fail('UNSUPPORTED_SCHEMA','현재 버전에서 지원하지 않는 암호화 파일 버전입니다.');
    if(value.kdf?.name!=='PBKDF2'||value.kdf?.hash!=='SHA-256'||value.cipher?.name!=='AES-GCM')fail('UNSUPPORTED_SCHEMA','지원하지 않는 암호화 방식입니다.');
    const iterations=validateIterations(value.kdf.iterations);
    const salt=base64ToBytes(value.kdf.salt,'salt');const iv=base64ToBytes(value.cipher.iv,'IV');const payload=base64ToBytes(value.payload,'payload');
    if(salt.byteLength!==SALT_BYTES||iv.byteLength!==IV_BYTES||payload.byteLength<17)fail('INVALID_ENVELOPE','암호화 백업 파일 구조가 올바르지 않습니다.');
    assertWithinLimit(payload.byteLength,maxBytes);
    return {iterations,salt,iv,payload};
  }
  function parseEnvelope(text,options={}){
    assertWithinLimit(byteLength(text),options.maxBytes||MAX_FILE_BYTES);
    let parsed;try{parsed=JSON.parse(String(text));}catch{fail('INVALID_ENVELOPE','암호화 백업 파일 형식이 올바르지 않습니다.');}
    validateEnvelope(parsed,options.maxBytes||MAX_FILE_BYTES);return parsed;
  }
  function isEncryptedEnvelope(value){return !!(value&&typeof value==='object'&&value.format===FORMAT);}
  async function encryptObject(value,password,options={}){
    const assessment=passwordAssessment(password,options.confirmation);if(!assessment.valid)fail('INVALID_PASSWORD',assessment.errors[0]);
    const api=requireCrypto(options.crypto);const iterations=validateIterations(options.iterations||DEFAULT_ITERATIONS);
    let plaintext;try{plaintext=encoder.encode(JSON.stringify(value));}catch{fail('INVALID_DATA','백업 데이터를 직렬화할 수 없습니다.');}
    assertWithinLimit(plaintext.byteLength,options.maxBytes||MAX_FILE_BYTES);
    const salt=api.getRandomValues(new Uint8Array(SALT_BYTES));const iv=api.getRandomValues(new Uint8Array(IV_BYTES));
    const key=await deriveKey(password,salt,iterations,api);const ciphertext=await api.subtle.encrypt({name:'AES-GCM',iv},key,plaintext);
    const envelope={format:FORMAT,cryptoSchemaVersion:CRYPTO_SCHEMA_VERSION,appVersion:options.appVersion||VERSION,kdf:{name:'PBKDF2',hash:'SHA-256',iterations,salt:bytesToBase64(salt)},cipher:{name:'AES-GCM',iv:bytesToBase64(iv)},payload:bytesToBase64(ciphertext)};
    assertWithinLimit(byteLength(JSON.stringify(envelope)),options.maxBytes||MAX_FILE_BYTES);return envelope;
  }
  async function decryptEnvelope(envelope,password,options={}){
    const api=requireCrypto(options.crypto);const parts=validateEnvelope(envelope,options.maxBytes||MAX_FILE_BYTES);
    if(String(password||'').length===0)fail('DECRYPT_FAILED','비밀번호가 맞지 않거나 파일이 손상되었습니다.');
    try{
      const key=await deriveKey(password,parts.salt,parts.iterations,api);
      const plaintext=await api.subtle.decrypt({name:'AES-GCM',iv:parts.iv},key,parts.payload);
      assertWithinLimit(plaintext.byteLength,options.maxBytes||MAX_FILE_BYTES);
      return JSON.parse(decoder.decode(plaintext));
    }catch(error){
      if(error instanceof EncryptedBackupError&&error.code!=='INVALID_DATA')throw error;
      fail('DECRYPT_FAILED','비밀번호가 맞지 않거나 파일이 손상되었습니다.');
    }
  }

  return {VERSION,FORMAT,CRYPTO_SCHEMA_VERSION,DEFAULT_ITERATIONS,MIN_ITERATIONS,MAX_ITERATIONS,SALT_BYTES,IV_BYTES,MAX_FILE_BYTES,EncryptedBackupError,isSupported,passwordAssessment,bytesToBase64,base64ToBytes,byteLength,validateEnvelope,parseEnvelope,isEncryptedEnvelope,deriveKey,encryptObject,decryptEnvelope};
});
