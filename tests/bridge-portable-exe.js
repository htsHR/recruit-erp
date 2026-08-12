'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const bridge=require('../bridge/erp-bridge.js');

if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Windows x64 전용 검사입니다.');

const root=path.resolve(__dirname,'..');
const exePath=path.join(root,'dist','ERP-Bridge-Test.exe');
assert.ok(fs.existsSync(exePath),'ERP-Bridge-Test.exe가 없습니다. 먼저 npm run build:bridge:windows를 실행하세요.');
const exeHeader=fs.readFileSync(exePath);
const peOffset=exeHeader.readUInt32LE(0x3c);
assert.equal(exeHeader.toString('ascii',peOffset,peOffset+4),'PE\0\0','Windows PE 실행파일 형식이어야 합니다.');
assert.equal(exeHeader.readUInt16LE(peOffset+4),0x8664,'Windows x64 실행파일이어야 합니다.');

const tempRoot=fs.realpathSync(os.tmpdir());
const tempParent=fs.mkdtempSync(path.join(tempRoot,'erp-bridge-portable-'));
const runtimeDir=path.join(tempParent,'portable runtime');
const sharedFolder=path.join(tempParent,'지원팀 공용 폴더',bridge.TARGET_FOLDER_NAME);
fs.mkdirSync(runtimeDir,{recursive:true});
fs.mkdirSync(sharedFolder,{recursive:true});
const existingFile=path.join(sharedFolder,'existing-company-file.txt');
fs.writeFileSync(existingFile,'existing file must not change','utf8');
const env={SystemRoot:process.env.SystemRoot||'C:\\Windows',WINDIR:process.env.WINDIR||'C:\\Windows',PATH:path.join(process.env.SystemRoot||'C:\\Windows','System32'),ERP_BRIDGE_ALLOWED_ORIGIN:'https://untrusted.example.test'};
const child=spawn(exePath,[sharedFolder],{cwd:runtimeDir,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let stdout='';let stderr='';
child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});

function waitForReady(){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error(`portable Bridge 시작 시간 초과: ${stdout} ${stderr}`)),10000);
    const check=()=>{if(stdout.includes('대기 주소: http://127.0.0.1:17840')&&stdout.includes('RecruitERP_TEST 테스트 경로: 설정됨')){clearTimeout(timeout);resolve();}};
    child.stdout.on('data',check);child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`portable Bridge 조기 종료: ${code} ${stderr}`));});check();
  });
}

function request(pathname='/health',method='GET',origin=bridge.ERP_PREVIEW_ORIGIN){
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:17840,path:pathname,method,headers:{Host:'127.0.0.1:17840',Origin:origin,Accept:'application/json'}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);req.end();
  });
}

(async()=>{
  try{
    await waitForReady();
    const health=await request();
    assert.equal(health.status,200);
    assert.equal(health.headers['access-control-allow-origin'],bridge.ERP_PREVIEW_ORIGIN);
    assert.deepEqual(JSON.parse(health.body),{ok:true,service:'Recruit ERP Bridge',version:'0.2-test'});
    const shared=await request('/shared-folder-test','POST');
    assert.equal(shared.status,200);
    assert.deepEqual(JSON.parse(shared.body),{ok:true,service:'Recruit ERP Bridge',version:'0.2-test',testSizeBytes:102400,steps:{access:true,create:true,write:true,read:true,verify:true,delete:true}});
    assert.equal((await request('/health','GET','https://untrusted.example.test')).status,403,'portable EXE는 환경변수로 허용 Origin을 바꾸면 안 됩니다.');
    assert.deepEqual(fs.readdirSync(runtimeDir),[],'portable Bridge는 실행 폴더에 파일을 만들면 안 됩니다.');
    assert.deepEqual(fs.readdirSync(sharedFolder),['existing-company-file.txt'],'공용폴더에는 기존 파일만 남아야 합니다.');
    assert.equal(fs.readFileSync(existingFile,'utf8'),'existing file must not change','기존 공용폴더 파일을 변경하면 안 됩니다.');
    assert.ok(!health.body.includes(tempParent)&&!shared.body.includes(tempParent),'Bridge 응답에 공용폴더 경로를 노출하면 안 됩니다.');
    assert.ok(!stdout.includes(sharedFolder),'Bridge 시작 안내에 실제 공용폴더 경로를 출력하면 안 됩니다.');
    assert.ok(!stdout.includes('node.exe'),'회사 PC 실행 안내에 Node.js 경로가 노출되면 안 됩니다.');
    console.log('bridge-portable-exe.js: 단일 EXE·경로 인자·loopback·100KB 공용폴더 생성/검증/삭제·기존 파일 보호 확인 완료');
  }finally{
    if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
    const resolved=fs.realpathSync(tempParent);
    if(path.dirname(resolved)!==tempRoot)throw new Error('임시 검사 폴더 범위가 올바르지 않습니다.');
    fs.rmSync(resolved,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exit(1);});
