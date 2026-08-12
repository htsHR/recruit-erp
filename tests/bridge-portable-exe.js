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
const tempDir=fs.mkdtempSync(path.join(tempRoot,'erp-bridge-portable-'));
const env={SystemRoot:process.env.SystemRoot||'C:\\Windows',WINDIR:process.env.WINDIR||'C:\\Windows',PATH:path.join(process.env.SystemRoot||'C:\\Windows','System32'),ERP_BRIDGE_ALLOWED_ORIGIN:'https://untrusted.example.test'};
const child=spawn(exePath,[],{cwd:tempDir,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let stdout='';let stderr='';
child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});

function waitForReady(){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error(`portable Bridge 시작 시간 초과: ${stdout} ${stderr}`)),10000);
    const check=()=>{if(stdout.includes('대기 주소: http://127.0.0.1:17840')){clearTimeout(timeout);resolve();}};
    child.stdout.on('data',check);child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`portable Bridge 조기 종료: ${code} ${stderr}`));});check();
  });
}

function health(origin=bridge.ERP_PREVIEW_ORIGIN){
  return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:17840,path:'/health',method:'GET',headers:{Host:'127.0.0.1:17840',Origin:origin,Accept:'application/json'}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error',reject);req.end();
  });
}

(async()=>{
  try{
    await waitForReady();
    const response=await health();
    assert.equal(response.status,200);
    assert.equal(response.headers['access-control-allow-origin'],bridge.ERP_PREVIEW_ORIGIN);
    assert.deepEqual(JSON.parse(response.body),{ok:true,service:'Recruit ERP Bridge',version:'0.1-test'});
    assert.equal((await health('https://untrusted.example.test')).status,403,'portable EXE는 환경변수로 허용 Origin을 바꾸면 안 됩니다.');
    assert.deepEqual(fs.readdirSync(tempDir),[],'portable Bridge는 실행 폴더에 파일을 만들면 안 됩니다.');
    assert.ok(!stdout.includes('node.exe'),'회사 PC 실행 안내에 Node.js 경로가 노출되면 안 됩니다.');
    console.log('bridge-portable-exe.js: 단일 EXE 실행·loopback health·무파일 생성 확인 완료');
  }finally{
    child.kill();
    await new Promise(resolve=>child.once('exit',resolve));
    const resolvedTempDir=fs.realpathSync(tempDir);
    if(path.dirname(resolvedTempDir)!==tempRoot)throw new Error('임시 검사 폴더 범위가 올바르지 않습니다.');
    fs.rmSync(resolvedTempDir,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exit(1);});
