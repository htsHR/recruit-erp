'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const bridge=require('../bridge/erp-bridge.js');

if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Windows x64 전용 검사입니다.');
const projectRoot=path.resolve(__dirname,'..');
const exePath=path.join(projectRoot,'dist','ERP-Bridge.exe');
assert.ok(fs.existsSync(exePath),'ERP-Bridge.exe가 없습니다. 먼저 npm run build:bridge:windows를 실행하세요.');
const exeHeader=fs.readFileSync(exePath);const peOffset=exeHeader.readUInt32LE(0x3c);
assert.equal(exeHeader.toString('ascii',peOffset,peOffset+4),'PE\0\0');assert.equal(exeHeader.readUInt16LE(peOffset+4),0x8664);

const tempRoot=fs.realpathSync(os.tmpdir());const tempParent=fs.mkdtempSync(path.join(tempRoot,'erp-bridge-portable-'));
const runtimeDir=path.join(tempParent,'portable runtime');const recruitRoot=path.join(tempParent,'지원팀 공용 폴더',bridge.TARGET_FOLDER_NAME);
fs.mkdirSync(runtimeDir,{recursive:true});fs.mkdirSync(recruitRoot,{recursive:true});
const existingFile=path.join(recruitRoot,'existing-company-file.txt');fs.writeFileSync(existingFile,'must remain unchanged','utf8');
const env={SystemRoot:process.env.SystemRoot||'C:\\Windows',WINDIR:process.env.WINDIR||'C:\\Windows',PATH:path.join(process.env.SystemRoot||'C:\\Windows','System32'),ERP_BRIDGE_ALLOWED_ORIGIN:'https://untrusted.example.test'};
const child=spawn(exePath,[recruitRoot],{cwd:runtimeDir,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});

function waitForReady(){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error(`portable Bridge 시작 시간 초과: ${stdout} ${stderr}`)),15000);const check=()=>{if(stdout.includes('http://127.0.0.1:17840')){clearTimeout(timeout);resolve();}};child.stdout.on('data',check);child.once('exit',code=>{clearTimeout(timeout);reject(new Error(`portable Bridge 조기 종료: ${code} ${stderr}`));});check();});}
function request(pathname='/health',{method='GET',origin=bridge.ERP_PREVIEW_ORIGIN,token='',body}={}){
  return new Promise((resolve,reject)=>{const text=body===undefined?'':JSON.stringify(body);const headers={Host:'127.0.0.1:17840',Origin:origin,Accept:'application/json'};if(token)headers['X-ERP-Bridge-Token']=token;if(body!==undefined){headers['Content-Type']='application/json';headers['Content-Length']=Buffer.byteLength(text);}const req=http.request({host:'127.0.0.1',port:17840,path:pathname,method,headers},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');resolve({status:response.statusCode,headers:response.headers,body:raw,json:JSON.parse(raw)});});});req.on('error',reject);req.end(text);});
}
function fakeDatasets(){return {applicants:Array.from({length:30},(_,index)=>({id:`fake-applicant-${index}`,name:`가상-${index}`,memo:'가'.repeat(180000)})),hireWaitingProfiles:[{applicantId:'fake-applicant-0',employeeNo:'TEST-001'}],employees:[{id:'fake-employee-001',empNo:'TEST-001',name:'가상 사원'}],schools:[{id:'fake-school-001',name:'가상대학교'}],calendarEvents:[{id:'fake-event-001',title:'가상 일정',date:'2026-08-13'}],messageTemplates:[{id:'fake-template-001',title:'가상 안내'}],interviewSessions:[{id:'fake-interview-001'}],applicantManagerAssignments:{'fake-applicant-0':'가상 담당자'},auditLogs:[{client_event_id:'fake-audit-001',action:'update'}],sensitiveExportLog:[{id:'fake-export-001',label:'가상 내보내기',at:'2026-08-13T00:00:00.000Z'}],savedAdvancedSearches:[],schoolWorkforceSavedViews:[]};}

(async()=>{
  try{
    await waitForReady();const health=await request();assert.equal(health.status,200);assert.equal(health.json.version,'1.0-preview');assert.ok(health.json.bridgeToken.length>=32);const token=health.json.bridgeToken;
    assert.equal((await request('/storage/status')).status,401);assert.equal((await request('/health',{origin:'https://untrusted.example.test'})).status,403,'portable EXE는 환경변수로 허용 Origin을 바꾸면 안 됩니다.');
    const datasets=fakeDatasets();const initialized=await request('/storage/initialize',{method:'POST',token,body:{datasets}});assert.equal(initialized.status,201);assert.equal(initialized.json.snapshot.revision,1);assert.ok(initialized.json.fileSize>5*1024*1024);
    const fetched=await request('/storage/snapshot',{token});assert.equal(fetched.status,200);assert.equal(fetched.json.snapshot.datasets.applicants.length,30);
    const masterPath=path.join(recruitRoot,'ERP_DATA','erp-data.json');const master=fs.readFileSync(masterPath);assert.equal(crypto.createHash('sha256').update(master).digest('hex'),crypto.createHash('sha256').update(Buffer.from(fetched.body.includes('snapshot')?JSON.stringify(fetched.json.snapshot):'')).digest('hex'));
    assert.equal(fs.readFileSync(existingFile,'utf8'),'must remain unchanged');assert.deepEqual(fs.readdirSync(runtimeDir),[]);
    assert.ok(!health.body.includes(recruitRoot)&&!fetched.body.includes(recruitRoot));assert.ok(!stdout.includes(recruitRoot)&&!stdout.includes('node.exe'));
    console.log('bridge-portable-exe.js: 단일 Windows EXE·loopback·세션 토큰·약 5MB 가상 snapshot 저장/재읽기 확인 완료');
  }finally{
    if(child.exitCode===null){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
    const resolved=fs.realpathSync(tempParent);if(path.dirname(resolved)!==tempRoot)throw new Error('임시 검사 폴더 범위가 올바르지 않습니다.');fs.rmSync(resolved,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exit(1);});
