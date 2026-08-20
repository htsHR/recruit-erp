'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const {EventEmitter}=require('node:events');
const os=require('node:os');
const path=require('node:path');
const bridge=require('../bridge/erp-bridge.js');

const projectRoot=path.resolve(__dirname,'..');
const bridgeSource=fs.readFileSync(path.join(projectRoot,'bridge','erp-bridge.js'),'utf8');
const storageSource=fs.readFileSync(path.join(projectRoot,'js','storage-performance.js'),'utf8');
const vercel=JSON.parse(fs.readFileSync(path.join(projectRoot,'vercel.json'),'utf8'));
const allowedOrigin='https://preview.example.test';
const testPort=17841;
const tempRoot=fs.realpathSync(os.tmpdir());
const tempParent=fs.mkdtempSync(path.join(tempRoot,'erp-shared-storage-'));
const recruitRoot=path.join(tempParent,bridge.TARGET_FOLDER_NAME);
fs.mkdirSync(recruitRoot);
const existingFile=path.join(recruitRoot,'existing-company-file.txt');
fs.writeFileSync(existingFile,'must remain unchanged','utf8');

function fakeDatasets(seed='001'){
  return {
    applicants:[{id:`applicant-${seed}`,name:'가상 지원자',status:'서류검토'}],
    hireWaitingProfiles:[{applicantId:`applicant-${seed}`,employeeNo:`TEST-${seed}`,remarks:'가상 메모'}],
    employees:[{id:`employee-${seed}`,empNo:`TEST-${seed}`,name:'가상 사원'}],
    schools:[{id:`school-${seed}`,name:'가상대학교'}],
    calendarEvents:[{id:`event-${seed}`,title:'가상 일정',date:'2026-08-13'}],
    messageTemplates:[{id:`template-${seed}`,title:'가상 안내',body:'테스트'}],
    interviewSessions:[{id:`interview-${seed}`,applicantId:`applicant-${seed}`}],
    applicantManagerAssignments:{[`applicant-${seed}`]:'가상 담당자'},
    auditLogs:[{client_event_id:`audit-${seed}`,action:'update',entity_type:'applicant'}],
    sensitiveExportLog:[{id:`export-${seed}`,label:'가상 내보내기',at:'2026-08-13T00:00:00.000Z'}],
    savedAdvancedSearches:[{id:`search-${seed}`,name:'가상 검색'}],
    schoolWorkforceSavedViews:[{id:`view-${seed}`,name:'가상 분석'}]
  };
}
function request({method='GET',pathname='/health',origin=allowedOrigin,host=`127.0.0.1:${testPort}`,token='',body,headers={}}={}){
  return new Promise((resolve,reject)=>{
    const text=body===undefined?'':typeof body==='string'?body:JSON.stringify(body);
    const requestHeaders={Host:host,Accept:'application/json',...headers};
    if(origin!==null)requestHeaders.Origin=origin;
    if(token)requestHeaders['X-ERP-Bridge-Token']=token;
    if(body!==undefined){if(!requestHeaders['Content-Type'])requestHeaders['Content-Type']='application/json';requestHeaders['Content-Length']=Buffer.byteLength(text);}
    const req=http.request({host:'127.0.0.1',port:testPort,path:pathname,method,headers:requestHeaders},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');let json=null;try{json=JSON.parse(raw);}catch{}resolve({status:response.statusCode,headers:response.headers,text:raw,json});});
    });
    req.on('error',reject);req.end(text);
  });
}

(async()=>{
  let server;
  try{
    assert.equal(bridge.HOST,'127.0.0.1');assert.equal(bridge.PORT,17840);assert.equal(bridge.VERSION,'1.0-preview');
    assert.equal(bridge.ERP_PRODUCTION_ORIGIN,'https://recruit-erp.vercel.app');assert.equal(bridge.ERP_PREVIEW_ORIGIN,'https://recruit-erp-git-agent-shared-folder-storage-test-htserp.vercel.app');
    assert.equal(bridge.TARGET_FOLDER_NAME,'RecruitERP');assert.equal(bridge.SCHEMA_VERSION,1);assert.equal(bridge.MAX_BACKUPS,20);
    assert.equal(bridge.MAX_REQUEST_BYTES,50*1024*1024);assert.equal(bridge.DELETE_RETRY_DELAY_MS,300);assert.equal(bridge.MAX_DELETE_RETRIES,5);
    assert.equal(bridge.normalizeRootPath(recruitRoot),path.resolve(recruitRoot));
    assert.throws(()=>bridge.normalizeRootPath(tempParent),error=>error.code==='INVALID_ROOT_NAME');
    assert.throws(()=>bridge.readRootArgument(['ERP-Bridge.exe']),error=>error.code==='ROOT_PATH_REQUIRED');
    assert.equal(bridge.readRootArgument(['ERP-Bridge.exe',recruitRoot]),path.resolve(recruitRoot));
    assert.deepEqual(bridge.parseBridgeConfigText(JSON.stringify({rootPath:recruitRoot,autoStart:true})),{rootPath:path.resolve(recruitRoot),autoStart:true});
    assert.throws(()=>bridge.parseBridgeConfigText(JSON.stringify({rootPath:recruitRoot,token:'do-not-store'})),error=>error.code==='INVALID_CONFIG');
    const bridgeConfigPath=path.join(tempParent,'bridge-config.json');fs.writeFileSync(bridgeConfigPath,JSON.stringify({rootPath:recruitRoot,autoStart:false}));
    assert.equal(bridge.resolveStartupSettings({argv:['ERP-Bridge.exe'],configPath:bridgeConfigPath}).rootPath,path.resolve(recruitRoot));
    assert.equal(bridge.readAllowedOrigin([],{},true),bridge.ERP_PREVIEW_ORIGIN);
    assert.equal(bridge.normalizeAllowedOrigin(`${allowedOrigin}/`),allowedOrigin);
    assert.throws(()=>bridge.normalizeAllowedOrigin('http://public.example.test'));
    const monitor=bridge.createStorageReconnectMonitor(recruitRoot,{logger:{log(){},warn(){}}});assert.equal((await monitor.check()).available,true);monitor.stop();
    const delayedRoot=path.join(tempParent,'delayed',bridge.TARGET_FOLDER_NAME);const delayedMonitor=bridge.createStorageReconnectMonitor(delayedRoot,{logger:{log(){},warn(){}}});assert.equal((await delayedMonitor.check()).available,false);fs.mkdirSync(delayedRoot,{recursive:true});assert.equal((await delayedMonitor.check()).available,true);delayedMonitor.stop();

    const logs=[];const logger={warn:value=>logs.push(String(value)),error:value=>logs.push(String(value))};
    server=bridge.createBridgeServer({allowedOrigin,rootPath:recruitRoot,port:testPort,logger,token:'fixed-test-token-with-at-least-32-characters'});
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(testPort,bridge.HOST,resolve);});
    assert.equal(server.address().address,'127.0.0.1');

    const health=await request();
    assert.equal(health.status,200);assert.equal(health.json.ok,true);assert.equal(health.json.version,'1.0-preview');assert.ok(health.json.bridgeToken.length>=32);
    assert.equal(health.headers['cache-control'],'no-store');assert.equal(health.headers['access-control-allow-origin'],allowedOrigin);assert.notEqual(health.headers['access-control-allow-origin'],'*');
    const token=health.json.bridgeToken;
    assert.equal((await request({pathname:'/storage/status'})).status,401,'storage API는 토큰 없이 접근할 수 없어야 합니다.');
    assert.equal((await request({origin:'https://untrusted.example.test'})).status,403);assert.equal((await request({origin:null})).status,403);
    assert.equal((await request({host:'attacker.example.test'})).status,400);
    assert.equal((await request({pathname:'/storage/status?path=C:%5Csecret',token})).status,404);

    const initialStatus=await request({pathname:'/storage/status',token});
    assert.equal(initialStatus.status,200);assert.equal(initialStatus.json.masterExists,false);assert.equal(initialStatus.json.revision,0);
    assert.ok(!initialStatus.text.includes(tempParent),'실제 Windows 경로를 응답에 노출하면 안 됩니다.');
    const invalidContent=await request({method:'POST',pathname:'/storage/initialize',token,headers:{'Content-Type':'text/plain'},body:'{}'});
    assert.equal(invalidContent.status,415);
    const oversizedRequest=new EventEmitter();oversizedRequest.headers={'content-type':'application/json','content-length':String(bridge.MAX_REQUEST_BYTES+1)};oversizedRequest.setTimeout=()=>{};oversizedRequest.resume=()=>{};
    await assert.rejects(()=>bridge.readJsonBody(oversizedRequest),error=>error.code==='PAYLOAD_TOO_LARGE');
    const pathInjection=await request({method:'POST',pathname:'/storage/initialize',token,body:{path:'C:\\secret',datasets:fakeDatasets()}});
    assert.equal(pathInjection.status,400);

    const initialized=await request({method:'POST',pathname:'/storage/initialize',token,body:{datasets:fakeDatasets('001')}});
    assert.equal(initialized.status,201);assert.equal(initialized.json.snapshot.revision,1);assert.equal(initialized.json.snapshot.format,bridge.SNAPSHOT_FORMAT);
    const masterPath=path.join(recruitRoot,'ERP_DATA','erp-data.json');assert.ok(fs.existsSync(masterPath));
    assert.equal(fs.readFileSync(existingFile,'utf8'),'must remain unchanged');
    const fetched=await request({pathname:'/storage/snapshot',token});assert.equal(fetched.status,200);bridge.validateSnapshot(fetched.json.snapshot);
    assert.ok(!fetched.text.includes(recruitRoot));

    const updated=await request({method:'PUT',pathname:'/storage/snapshot',token,body:{expectedRevision:1,datasets:fakeDatasets('002')}});
    assert.equal(updated.status,200);assert.equal(updated.json.snapshot.revision,2);
    const stale=await request({method:'PUT',pathname:'/storage/snapshot',token,body:{expectedRevision:1,datasets:fakeDatasets('003')}});
    assert.equal(stale.status,409);assert.equal(stale.json.code,'REVISION_CONFLICT');assert.equal(stale.json.currentRevision,2);
    assert.equal(JSON.parse(fs.readFileSync(masterPath,'utf8')).revision,2,'stale 저장은 master를 덮어쓰면 안 됩니다.');

    let revision=2;
    for(let index=0;index<21;index+=1){const result=await bridge.updateStorage(recruitRoot,revision,fakeDatasets(String(index+10).padStart(3,'0')),{logger});revision=result.snapshot.revision;}
    const backups=fs.readdirSync(path.join(recruitRoot,'ERP_DATA','backup')).filter(name=>name.endsWith('.json'));
    assert.equal(backups.length,20,'자동 백업은 최근 20개만 유지해야 합니다.');

    const layout=await bridge.ensureStorageLayout(recruitRoot);fs.writeFileSync(layout.lockPath,JSON.stringify({createdAt:new Date().toISOString()}));
    await assert.rejects(()=>bridge.updateStorage(recruitRoot,revision,fakeDatasets('090'),{logger}),error=>error.code==='STORAGE_LOCKED');
    fs.utimesSync(layout.lockPath,new Date(Date.now()-bridge.LOCK_STALE_MS-5000),new Date(Date.now()-bridge.LOCK_STALE_MS-5000));
    const recovered=await bridge.updateStorage(recruitRoot,revision,fakeDatasets('091'),{logger});revision=recovered.snapshot.revision;assert.equal(recovered.lockRecovered,true);

    const unsafe=JSON.parse('{"format":"recruit-erp-shared-storage","schemaVersion":1,"revision":1,"savedAt":"2026-08-13T00:00:00.000Z","datasets":{"__proto__":{}}}');
    assert.throws(()=>bridge.validateSnapshot(unsafe));
    const duplicate=fakeDatasets('100');duplicate.applicants.push({...duplicate.applicants[0]});assert.throws(()=>bridge.validateDatasets(duplicate),error=>error.code==='DUPLICATE_ROW_ID');
    const rrn=fakeDatasets('101');rrn.hireWaitingProfiles[0].remarks='900101-1000001';assert.throws(()=>bridge.validateDatasets(rrn) && bridge.validateSnapshot({format:bridge.SNAPSHOT_FORMAT,schemaVersion:1,revision:1,savedAt:new Date().toISOString(),datasets:rrn}),error=>error.code==='RESIDENT_NUMBER_BLOCKED');
    const excluded=fakeDatasets('103');excluded.applicants[0].password='must-not-store';assert.throws(()=>bridge.assertSafeTree(excluded),error=>error.code==='EXCLUDED_SNAPSHOT_FIELD');
    const deep={};let cursor=deep;for(let i=0;i<14;i+=1){cursor.next={};cursor=cursor.next;}assert.throws(()=>bridge.assertSafeTree(deep),error=>error.code==='SNAPSHOT_TOO_DEEP');
    assert.throws(()=>bridge.validateDatasets({...fakeDatasets('102'),unknown:[]}),error=>error.code==='UNKNOWN_DATASET');

    const bigRoot=path.join(tempParent,'big',bridge.TARGET_FOLDER_NAME);fs.mkdirSync(bigRoot,{recursive:true});
    const big=fakeDatasets('200');big.applicants=Array.from({length:30},(_,index)=>({id:`big-${index}`,name:`가상-${index}`,memo:'가'.repeat(180000)}));
    const bigResult=await bridge.initializeStorage(bigRoot,big,{logger});assert.ok(bigResult.fileSize>5*1024*1024,'약 5MB 가상 snapshot이어야 합니다.');
    const bigRead=await bridge.readMaster(await bridge.ensureStorageLayout(bigRoot));assert.equal(crypto.createHash('sha256').update(bigRead.raw).digest('hex'),bridge.hash(bigRead.raw));assert.equal(bigRead.snapshot.datasets.applicants.length,30);

    let exists=true,calls=0;const delays=[];
    const deleteResult=await bridge.deleteFileWithRetry('fake',{fsApi:{async unlink(){calls+=1;if(calls===1)throw Object.assign(new Error('busy'),{code:'EBUSY'});exists=false;},async access(){if(exists)return;throw Object.assign(new Error('missing'),{code:'ENOENT'});}},waitFn:async value=>delays.push(value),logger});
    assert.deepEqual(deleteResult,{deleted:true,attempts:2,retries:1});assert.deepEqual(delays,[300]);

    assert.equal(fs.existsSync(path.join(projectRoot,'js','shared-storage.js')),false,'Production 브라우저 Bridge 클라이언트는 제거되어야 합니다.');
    assert.doesNotMatch(storageSource,/127\.0\.0\.1|Bridge|\/storage\/snapshot|fetch\(/,'Production 저장소 화면은 Bridge에 연결하면 안 됩니다.');
    assert.doesNotMatch(bridgeSource,/0\.0\.0\.0|showDirectoryPicker|showOpenFilePicker|sendBeacon|FormData|type=["']file["']/i);
    assert.doesNotMatch(bridgeSource,/bridgeToken:\s*token[^}]*console|console\.[a-z]+\([^)]*token/i);
    const csp=vercel.headers[0].headers.find(item=>item.key==='Content-Security-Policy')?.value||'';assert.match(csp,/connect-src 'self';/);assert.doesNotMatch(csp,/127\.0\.0\.1|supabase/i);
    assert.ok(logs.every(line=>!line.includes('가상 지원자')&&!line.includes('900101')),'로그에 업무 데이터나 주민번호를 출력하면 안 됩니다.');
    console.log('local-bridge.test.js: 토큰·Origin·50MB 제한·안전 snapshot·원자 저장·revision 충돌·잠금·20개 백업·5MB 가상 왕복 확인 완료');
  }finally{
    if(server?.listening)await new Promise(resolve=>server.close(resolve));
    const resolved=fs.realpathSync(tempParent);if(path.dirname(resolved)!==tempRoot)throw new Error('임시 검사 폴더 범위가 올바르지 않습니다.');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exit(1);});
