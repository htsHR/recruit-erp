'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

const bridge=require('../bridge/erp-bridge.js');
const storage=require('../js/storage-performance.js');
const root=path.resolve(__dirname,'..');
const bridgeSource=fs.readFileSync(path.join(root,'bridge','erp-bridge.js'),'utf8');
const storageSource=fs.readFileSync(path.join(root,'js','storage-performance.js'),'utf8');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const allowedOrigin='https://preview.example.test';
const testPort=17841;

function request({method='GET',pathname='/health',origin=allowedOrigin,host=`127.0.0.1:${testPort}`,headers={}}={}){
  return new Promise((resolve,reject)=>{
    const requestHeaders={Host:host,...headers};
    if(origin!==null)requestHeaders.Origin=origin;
    const req=http.request({host:'127.0.0.1',port:testPort,path:pathname,method,headers:requestHeaders},response=>{
      const chunks=[];
      response.on('data',chunk=>chunks.push(chunk));
      response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,text:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);
    req.end();
  });
}

(async()=>{
  assert.equal(bridge.HOST,'127.0.0.1');
  assert.equal(bridge.PORT,17840);
  assert.equal(bridge.SERVICE,'Recruit ERP Bridge');
  assert.equal(bridge.VERSION,'0.1-test');
  assert.equal(bridge.ERP_PREVIEW_ORIGIN,'https://recruit-erp-git-agent-shared-folder-storage-test-htserp.vercel.app');
  assert.equal(bridge.normalizeAllowedOrigin(`${allowedOrigin}/`),allowedOrigin);
  assert.throws(()=>bridge.normalizeAllowedOrigin('http://public.example.test'),/HTTPS/);
  assert.throws(()=>bridge.normalizeAllowedOrigin(`${allowedOrigin}/path`),/경로/);

  const server=bridge.createBridgeServer({allowedOrigin,port:testPort});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(testPort,bridge.HOST,resolve);});
  try{
    assert.equal(server.address().address,'127.0.0.1');
    const health=await request();
    assert.equal(health.status,200);
    assert.deepEqual(JSON.parse(health.text),{ok:true,service:'Recruit ERP Bridge',version:'0.1-test'});
    assert.equal(health.headers['access-control-allow-origin'],allowedOrigin);
    assert.notEqual(health.headers['access-control-allow-origin'],'*');
    assert.equal(health.headers['cache-control'],'no-store');

    const forbidden=await request({origin:'https://untrusted.example.test'});
    assert.equal(forbidden.status,403);
    assert.equal(forbidden.headers['access-control-allow-origin'],undefined);
    assert.equal((await request({origin:null})).status,403);
    assert.equal((await request({host:'attacker.example.test'})).status,400);
    assert.equal((await request({method:'POST'})).status,405);
    assert.equal((await request({pathname:'/files'})).status,404);

    const preflight=await request({method:'OPTIONS',headers:{'Access-Control-Request-Method':'GET','Access-Control-Request-Private-Network':'true'}});
    assert.equal(preflight.status,204);
    assert.equal(preflight.headers['access-control-allow-private-network'],'true');
    assert.equal(preflight.headers['access-control-allow-methods'],'GET');
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }

  assert.equal(storage.BRIDGE_HEALTH_URL,'http://127.0.0.1:17840/health');
  let fetchCall=null;
  const localStorageGuard=new Proxy({}, {get(){throw new Error('localStorage must not be used');}});
  Object.defineProperty(globalThis,'localStorage',{value:localStorageGuard,configurable:true});
  const result=await storage.probeLocalBridge(async(url,options)=>{
    fetchCall={url,options};
    return {ok:true,json:async()=>({ok:true,service:'Recruit ERP Bridge',version:'0.1-test'})};
  });
  delete globalThis.localStorage;
  assert.deepEqual(result,{ok:true,code:'ok'});
  assert.equal(fetchCall.url,storage.BRIDGE_HEALTH_URL);
  assert.equal(fetchCall.options.method,'GET');
  assert.equal(fetchCall.options.credentials,'omit');
  assert.equal('targetAddressSpace' in fetchCall.options,false);
  assert.deepEqual(await storage.probeLocalBridge(async()=>({ok:true,json:async()=>({ok:true,service:'Other',version:'0.1-test'})})),{ok:false,code:'invalid-response'});
  assert.deepEqual(await storage.probeLocalBridge(async()=>{throw new Error('blocked');}),{ok:false,code:'connection-failed'});

  assert.match(storageSource,/로컬 Bridge 연결 테스트/);
  assert.match(storageSource,/✅ ERP Bridge 연결 성공/);
  assert.match(storageSource,/❌ ERP Bridge 연결 실패/);
  assert.doesNotMatch(`${bridgeSource}\n${storageSource}`,/showDirectoryPicker|getFileHandle|createWritable|removeEntry/);
  assert.doesNotMatch(bridgeSource,/require\(['"]node:fs['"]\)|require\(['"]fs['"]\)|0\.0\.0\.0/);
  assert.doesNotMatch(bridgeSource,/localStorage|Supabase|service[_ -]?role|employee|applicant/i);
  const csp=vercel.headers[0].headers.find(item=>item.key==='Content-Security-Policy')?.value||'';
  assert.match(csp,/connect-src[^;]*http:\/\/127\.0\.0\.1:17840/);

  console.log('local-bridge.test.js: loopback 고정·Origin 제한·health 전용·파일/ERP 데이터 미접근 확인 완료');
})().catch(error=>{console.error(error);process.exit(1);});
