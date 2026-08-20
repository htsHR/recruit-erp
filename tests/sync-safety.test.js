'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const reset=require('../js/factory-reset-v12.js');

class MemoryStorage{
  constructor(entries=[]){this.map=new Map(entries);}
  get length(){return this.map.size;}
  key(index){return [...this.map.keys()][index]??null;}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}

function indexedDb({blocked=false,remaining=false}={}){
  return {
    deleteDatabase(name){
      assert.equal(name,reset.DATABASE_NAME);
      const request={};
      queueMicrotask(()=>blocked?request.onblocked?.():request.onsuccess?.());
      return request;
    },
    async databases(){return remaining?[{name:reset.DATABASE_NAME}]:[];}
  };
}

(async()=>{
  assert.equal(reset.DATA_EPOCH,'v12.0.2-reset-1');
  assert.equal(reset.APP_STORAGE_KEYS.length,41);
  assert.equal(new Set(reset.APP_STORAGE_KEYS).size,41);
  assert.equal(fs.existsSync(path.join(root,'js','sync-safety.js')),false);
  assert.equal(fs.existsSync(path.join(root,'js','cloud-sync.js')),false);

  const entries=reset.APP_STORAGE_KEYS.map((key,index)=>[key,`old-${index}`]);
  entries.push([`${reset.PROJECT_AUTH_PREFIX}auth-token`,'secret']);
  entries.push(['other_product_data','keep-me']);
  const storage=new MemoryStorage(entries);
  const result=await reset.run({storage,indexedDB:indexedDb()});
  assert.deepEqual(result,{ok:true,reset:true,epoch:reset.DATA_EPOCH,removedKeys:41});
  for(const key of reset.APP_STORAGE_KEYS)assert.equal(storage.getItem(key),null);
  assert.equal(storage.getItem(`${reset.PROJECT_AUTH_PREFIX}auth-token`),null);
  assert.equal(storage.getItem('other_product_data'),'keep-me','다른 웹앱 데이터는 지우면 안 됩니다.');
  assert.equal(storage.getItem(reset.EPOCH_KEY),reset.DATA_EPOCH);

  storage.setItem('recruit_erp','new-local-data');
  const second=await reset.run({storage,indexedDB:indexedDb()});
  assert.equal(second.reset,false);
  assert.equal(storage.getItem('recruit_erp'),'new-local-data','같은 epoch의 두 번째 실행은 새 데이터를 지우면 안 됩니다.');

  for(const scenario of [{blocked:true},{remaining:true}]){
    const failedStorage=new MemoryStorage([['recruit_erp','old'],['unrelated','safe']]);
    const failed=await reset.run({storage:failedStorage,indexedDB:indexedDb(scenario)});
    assert.equal(failed.ok,false);
    assert.equal(failedStorage.getItem(reset.EPOCH_KEY),null,'초기화 실패 시 완료 epoch를 기록하면 안 됩니다.');
    assert.equal(failedStorage.getItem('unrelated'),'safe');
  }

  console.log('sync-safety.test.js: 원격 동기화 제거·41개 표적 초기화·타 웹앱 보존·IndexedDB fail-closed 확인 완료');
})().catch(error=>{console.error(error);process.exitCode=1;});
