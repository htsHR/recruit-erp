'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');

const bridge=require('../bridge/erp-bridge.js');
const storage=require('../js/storage-performance.js');
const root=path.resolve(__dirname,'..');
const bridgeSource=fs.readFileSync(path.join(root,'bridge','erp-bridge.js'),'utf8');
const storageSource=fs.readFileSync(path.join(root,'js','storage-performance.js'),'utf8');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const allowedOrigin='https://preview.example.test';
const testPort=17841;
const tempRoot=fs.realpathSync(os.tmpdir());
const tempParent=fs.mkdtempSync(path.join(tempRoot,'erp-bridge-shared-'));
const sharedFolder=path.join(tempParent,bridge.TARGET_FOLDER_NAME);
fs.mkdirSync(sharedFolder);
const existingFile=path.join(sharedFolder,'existing-company-file.txt');
fs.writeFileSync(existingFile,'existing file must not change','utf8');

function request({method='GET',pathname='/health',origin=allowedOrigin,host=`127.0.0.1:${testPort}`,headers={},body=''}={}){
  return new Promise((resolve,reject)=>{
    const requestHeaders={Host:host,...headers};
    if(origin!==null)requestHeaders.Origin=origin;
    if(body&&!('Content-Length' in requestHeaders))requestHeaders['Content-Length']=Buffer.byteLength(body);
    const req=http.request({host:'127.0.0.1',port:testPort,path:pathname,method,headers:requestHeaders},response=>{
      const chunks=[];
      response.on('data',chunk=>chunks.push(chunk));
      response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,text:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);
    req.end(body);
  });
}

function fakeFileSystem(failStage){
  const failure=Object.assign(new Error(`fake ${failStage} failure`),{code:failStage==='create'||failStage==='delete'?'EACCES':'EIO'});
  let statCount=0;
  return {
    async stat(){
      statCount+=1;
      if(failStage==='access'&&statCount===1)throw failure;
      return statCount===1?{isDirectory:()=>true}:{size:bridge.TEST_SIZE_BYTES};
    },
    async open(){
      if(failStage==='create')throw failure;
      return {async writeFile(){if(failStage==='write')throw failure;},async sync(){},async close(){}};
    },
    async readFile(){if(failStage==='read')throw failure;return failStage==='verify'?Buffer.alloc(bridge.TEST_SIZE_BYTES,'X'):Buffer.from(bridge.TEST_PAYLOAD);},
    async unlink(){if(failStage==='delete')throw failure;},
    async access(){if(failStage==='deleteVerify')return;throw Object.assign(new Error('not found'),{code:'ENOENT'});}
  };
}

(async()=>{
  try{
    assert.equal(bridge.HOST,'127.0.0.1');
    assert.equal(bridge.PORT,17840);
    assert.equal(bridge.SERVICE,'Recruit ERP Bridge');
    assert.equal(bridge.VERSION,'0.2-test');
    assert.equal(bridge.TEST_SIZE_BYTES,102400);
    assert.equal(bridge.ERP_PREVIEW_ORIGIN,'https://recruit-erp-git-agent-shared-folder-storage-test-htserp.vercel.app');
    assert.equal(bridge.normalizeAllowedOrigin(`${allowedOrigin}/`),allowedOrigin);
    assert.throws(()=>bridge.normalizeAllowedOrigin('http://public.example.test'),/HTTPS/);
    assert.throws(()=>bridge.normalizeAllowedOrigin(`${allowedOrigin}/path`),/경로/);
    assert.equal(bridge.normalizeSharedFolderPath(sharedFolder),path.resolve(sharedFolder));
    assert.throws(()=>bridge.normalizeSharedFolderPath(tempParent),/RecruitERP_TEST/);
    assert.throws(()=>bridge.readSharedFolderArgument(['ERP-Bridge-Test.exe'],true),/경로 하나/);
    assert.equal(bridge.readSharedFolderArgument(['ERP-Bridge-Test.exe',sharedFolder],true),path.resolve(sharedFolder));

    const logs=[];
    const logger={error:(...args)=>logs.push(args)};
    const server=bridge.createBridgeServer({allowedOrigin,sharedFolderPath:sharedFolder,port:testPort,logger});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(testPort,bridge.HOST,resolve);});
    try{
      assert.equal(server.address().address,'127.0.0.1');
      const health=await request();
      assert.equal(health.status,200);
      assert.deepEqual(JSON.parse(health.text),{ok:true,service:'Recruit ERP Bridge',version:'0.2-test'});
      assert.equal(health.headers['access-control-allow-origin'],allowedOrigin);
      assert.notEqual(health.headers['access-control-allow-origin'],'*');
      assert.equal(health.headers['cache-control'],'no-store');

      const shared=await request({method:'POST',pathname:'/shared-folder-test'});
      const sharedBody=JSON.parse(shared.text);
      assert.equal(shared.status,200);
      assert.deepEqual(sharedBody,{ok:true,service:'Recruit ERP Bridge',version:'0.2-test',testSizeBytes:102400,steps:{access:true,create:true,write:true,read:true,verify:true,delete:true}});
      assert.equal(fs.readFileSync(existingFile,'utf8'),'existing file must not change','기존 공용폴더 파일이 바뀌면 안 됩니다.');
      assert.deepEqual(fs.readdirSync(sharedFolder),['existing-company-file.txt'],'테스트 파일은 즉시 삭제되어야 합니다.');
      assert.ok(!shared.text.includes(tempParent)&&!shared.text.includes(bridge.TEST_FILE_PREFIX),'HTTP 응답에 경로나 테스트 파일명을 노출하면 안 됩니다.');

      const forbidden=await request({origin:'https://untrusted.example.test'});
      assert.equal(forbidden.status,403);
      assert.equal(forbidden.headers['access-control-allow-origin'],undefined);
      assert.equal((await request({origin:null})).status,403);
      assert.equal((await request({host:'attacker.example.test'})).status,400);
      assert.equal((await request({method:'POST'})).status,405);
      assert.equal((await request({pathname:'/shared-folder-test'})).status,405);
      assert.equal((await request({method:'POST',pathname:'/shared-folder-test?path=C:%5Csecret'})).status,404);
      assert.equal((await request({method:'POST',pathname:'/shared-folder-test',body:JSON.stringify({path:'C:\\secret'})})).status,400,'브라우저 요청 본문으로 경로를 전달하면 거부해야 합니다.');
      assert.equal((await request({pathname:'/files'})).status,404);

      const healthPreflight=await request({method:'OPTIONS',headers:{'Access-Control-Request-Method':'GET','Access-Control-Request-Private-Network':'true'}});
      assert.equal(healthPreflight.status,204);
      assert.equal(healthPreflight.headers['access-control-allow-private-network'],'true');
      assert.equal(healthPreflight.headers['access-control-allow-methods'],'GET, POST');
      const sharedPreflight=await request({method:'OPTIONS',pathname:'/shared-folder-test',headers:{'Access-Control-Request-Method':'POST'}});
      assert.equal(sharedPreflight.status,204);
    }finally{
      await new Promise(resolve=>server.close(resolve));
    }

    const expectedFailures={access:'FOLDER_ACCESS_FAILED',create:'FILE_CREATE_DENIED',write:'FILE_WRITE_FAILED',read:'FILE_READ_FAILED',verify:'FILE_VERIFY_FAILED',delete:'FILE_DELETE_DENIED',deleteVerify:'FILE_DELETE_VERIFY_FAILED'};
    for(const [stage,code] of Object.entries(expectedFailures)){
      const result=await bridge.runSharedFolderTest(sharedFolder,{fsApi:fakeFileSystem(stage),now:()=>1,randomBytes:()=>Buffer.alloc(6),logger});
      assert.equal(result.ok,false,`${stage} 실패는 PASS로 처리하면 안 됩니다.`);
      assert.equal(result.code,code,`${stage} 실패 코드가 명확해야 합니다.`);
      assert.ok(!JSON.stringify(result).includes(tempParent),'실패 응답에 민감한 경로를 포함하면 안 됩니다.');
    }

    assert.equal(storage.BRIDGE_HEALTH_URL,'http://127.0.0.1:17840/health');
    assert.equal(storage.BRIDGE_SHARED_FOLDER_TEST_URL,'http://127.0.0.1:17840/shared-folder-test');
    assert.equal(storage.BRIDGE_VERSION,'0.2-test');
    let fetchCall=null;
    const localStorageGuard=new Proxy({}, {get(){throw new Error('localStorage must not be used');}});
    Object.defineProperty(globalThis,'localStorage',{value:localStorageGuard,configurable:true});
    const healthResult=await storage.probeLocalBridge(async(url,options)=>{
      fetchCall={url,options};
      return {ok:true,json:async()=>({ok:true,service:'Recruit ERP Bridge',version:'0.2-test'})};
    });
    assert.deepEqual(healthResult,{ok:true,code:'ok'});
    assert.equal(fetchCall.url,storage.BRIDGE_HEALTH_URL);
    assert.equal(fetchCall.options.method,'GET');
    assert.equal(fetchCall.options.credentials,'omit');
    assert.equal('targetAddressSpace' in fetchCall.options,false);

    const sharedResult=await storage.probeSharedFolderBridge(async(url,options)=>{
      fetchCall={url,options};
      return {ok:true,json:async()=>({ok:true,service:'Recruit ERP Bridge',version:'0.2-test',testSizeBytes:102400,steps:{access:true,create:true,write:true,read:true,verify:true,delete:true}})};
    });
    delete globalThis.localStorage;
    assert.deepEqual(sharedResult,{ok:true,code:'ok',testSizeBytes:102400,steps:{access:true,create:true,write:true,read:true,verify:true,delete:true}});
    assert.equal(fetchCall.url,storage.BRIDGE_SHARED_FOLDER_TEST_URL);
    assert.equal(fetchCall.options.method,'POST');
    assert.equal(fetchCall.options.credentials,'omit');
    assert.equal('body' in fetchCall.options,false,'브라우저는 폴더 경로나 본문을 Bridge에 전송하면 안 됩니다.');
    assert.deepEqual(await storage.probeSharedFolderBridge(async()=>({ok:true,json:async()=>({ok:false,service:'Recruit ERP Bridge',version:'0.2-test',code:'FILE_WRITE_FAILED',steps:{access:true,create:true,write:false}})})),{ok:false,code:'FILE_WRITE_FAILED',testSizeBytes:0,steps:{access:true,create:true,write:false,read:false,verify:false,delete:false}});
    assert.deepEqual(await storage.probeLocalBridge(async()=>({ok:true,json:async()=>({ok:true,service:'Other',version:'0.2-test'})})),{ok:false,code:'invalid-response'});
    assert.deepEqual(await storage.probeLocalBridge(async()=>{throw new Error('blocked');}),{ok:false,code:'connection-failed'});

    assert.match(storageSource,/공용폴더 읽기\/쓰기 테스트/);
    assert.match(storageSource,/✅ 공용폴더 읽기\/쓰기 성공/);
    assert.match(storageSource,/❌ 파일 삭제 권한 없음/);
    assert.doesNotMatch(`${bridgeSource}\n${storageSource}`,/showDirectoryPicker|getFileHandle|createWritable|removeEntry|type=["']file["']/i);
    assert.doesNotMatch(bridgeSource,/0\.0\.0\.0|localStorage|Supabase|service[_ -]?role|employee|applicant/i);
    assert.doesNotMatch(storage.probeSharedFolderBridge.toString(),/localStorage|indexedDB|showDirectoryPicker|path\s*:/i);
    const csp=vercel.headers[0].headers.find(item=>item.key==='Content-Security-Policy')?.value||'';
    assert.match(csp,/connect-src[^;]*http:\/\/127\.0\.0\.1:17840/);

    console.log('local-bridge.test.js: 고정 RecruitERP_TEST·100KB 독점 생성/읽기/해시/삭제·단계별 실패·Origin 제한·브라우저 경로 미전송 확인 완료');
  }finally{
    const resolved=fs.realpathSync(tempParent);
    if(path.dirname(resolved)!==tempRoot)throw new Error('임시 검사 폴더 범위가 올바르지 않습니다.');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exit(1);});
