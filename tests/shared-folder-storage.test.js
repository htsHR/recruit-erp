'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const storage=require('../js/storage-performance.js');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js','storage-performance.js'),'utf8');

function notFound(){const error=new Error('not found');error.name='NotFoundError';return error;}
function makeDirectory({name=storage.SHARED_FOLDER_NAME,initial={},readOverride='',removeFails=false}={}){
  const files=new Map(Object.entries(initial));
  const calls=[];
  const directory={
    name,
    async getFileHandle(fileName,options={}){
      calls.push({type:'get',fileName,create:options.create===true});
      if(!files.has(fileName)&&!options.create)throw notFound();
      if(!files.has(fileName))files.set(fileName,'');
      return {
        async createWritable(){
          calls.push({type:'writable',fileName});
          let pending='';
          return {
            async write(value){pending=String(value);calls.push({type:'write',fileName,value:pending});},
            async close(){files.set(fileName,pending);calls.push({type:'close',fileName});},
            async abort(){calls.push({type:'abort',fileName});}
          };
        },
        async getFile(){
          calls.push({type:'read',fileName});
          return {text:async()=>readOverride||files.get(fileName)};
        }
      };
    },
    async removeEntry(fileName){
      calls.push({type:'remove',fileName});
      if(removeFails)throw new Error('blocked');
      files.delete(fileName);
    }
  };
  return {directory,files,calls};
}

(async()=>{
  assert.equal(storage.SHARED_FOLDER_NAME,'RecruitERP_TEST');
  assert.equal(storage.SHARED_FOLDER_TEST_FILE,'recruit_erp_test.txt');
  assert.equal(storage.SHARED_FOLDER_TEST_CONTENT,'Recruit ERP shared folder test');

  const success=makeDirectory({initial:{'existing-company-file.txt':'keep'}});
  let pickerOptions=null;
  const localStorageGuard=new Proxy({}, {get(){throw new Error('localStorage must not be used');}});
  Object.defineProperty(globalThis,'localStorage',{value:localStorageGuard,configurable:true});
  const successResult=await storage.probeSharedFolder(async options=>{pickerOptions=options;return success.directory;});
  delete globalThis.localStorage;
  assert.deepEqual(successResult,{ok:true,code:'ok'});
  assert.deepEqual(pickerOptions,{mode:'readwrite'});
  assert.equal(success.files.get('existing-company-file.txt'),'keep','기존 파일은 변경하면 안 됩니다.');
  assert.equal(success.files.has(storage.SHARED_FOLDER_TEST_FILE),false,'테스트 파일은 즉시 삭제해야 합니다.');
  assert.deepEqual(success.calls.filter(call=>call.type==='write').map(call=>call.value),[storage.SHARED_FOLDER_TEST_CONTENT]);
  assert.deepEqual(success.calls.filter(call=>call.type==='remove').map(call=>call.fileName),[storage.SHARED_FOLDER_TEST_FILE]);

  const existing=makeDirectory({initial:{[storage.SHARED_FOLDER_TEST_FILE]:'do-not-touch','other.txt':'keep'}});
  const existingResult=await storage.probeSharedFolder(async()=>existing.directory);
  assert.deepEqual(existingResult,{ok:false,code:'test-file-exists'});
  assert.equal(existing.files.get(storage.SHARED_FOLDER_TEST_FILE),'do-not-touch','기존 테스트 파일도 덮어쓰거나 삭제하면 안 됩니다.');
  assert.equal(existing.calls.some(call=>call.type==='write'||call.type==='remove'),false);

  const mismatch=makeDirectory({readOverride:'different content'});
  const mismatchResult=await storage.probeSharedFolder(async()=>mismatch.directory);
  assert.deepEqual(mismatchResult,{ok:false,code:'content-mismatch'});
  assert.equal(mismatch.files.has(storage.SHARED_FOLDER_TEST_FILE),false,'검증 실패 시에도 테스트 파일은 삭제해야 합니다.');

  const wrongFolder=makeDirectory({name:'NotRecruitERP'});
  const wrongFolderResult=await storage.probeSharedFolder(async()=>wrongFolder.directory);
  assert.deepEqual(wrongFolderResult,{ok:false,code:'wrong-folder'});
  assert.equal(wrongFolder.calls.length,0,'잘못된 폴더에는 파일 접근을 시도하면 안 됩니다.');

  const cleanupFailure=makeDirectory({removeFails:true});
  const cleanupResult=await storage.probeSharedFolder(async()=>cleanupFailure.directory);
  assert.deepEqual(cleanupResult,{ok:false,code:'cleanup-failed'});

  assert.deepEqual(await storage.probeSharedFolder(undefined),{ok:false,code:'unsupported'});
  assert.deepEqual(await storage.probeSharedFolder(async()=>{const error=new Error('cancel');error.name='AbortError';throw error;}),{ok:false,code:'cancelled'});

  assert.match(source,/공용폴더 저장 테스트/);
  assert.match(source,/✅ 공용폴더 읽기\/쓰기 사용 가능/);
  assert.match(source,/ERP_DATA 저장소로 사용할 수 있습니다\./);
  assert.match(source,/❌ 공용폴더 접근 또는 쓰기가 차단되어 있습니다\./);
  assert.match(source,/회사 보안정책\/브라우저 정책 확인이 필요합니다\./);
  assert.doesNotMatch(storage.probeSharedFolder.toString(),/localStorage|Supabase|\bsb\b|erpAudit/);
  assert.match(storage.runSharedFolderTest.toString(),/const probePromise=probeSharedFolder\(\);[\s\S]*await probePromise/,'폴더 선택은 비동기 화면 갱신 전에 시작해야 합니다.');

  console.log('shared-folder-storage.test.js: 테스트 파일 단독 생성·재읽기·즉시 삭제와 기존 파일 보호 확인 완료');
})().catch(error=>{console.error(error);process.exit(1);});
