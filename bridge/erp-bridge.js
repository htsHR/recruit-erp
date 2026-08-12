'use strict';

const crypto=require('node:crypto');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

const HOST='127.0.0.1';
const PORT=17840;
const SERVICE='Recruit ERP Bridge';
const VERSION='0.2-test';
const ERP_PREVIEW_ORIGIN='https://recruit-erp-git-agent-shared-folder-storage-test-htserp.vercel.app';
const TARGET_FOLDER_NAME='RecruitERP_TEST';
const TEST_SIZE_BYTES=100*1024;
const TEST_FILE_PREFIX='recruit_erp_bridge_test_';
const TEST_PAYLOAD=Buffer.alloc(TEST_SIZE_BYTES,'Recruit ERP shared folder test ');

function isSeaRuntime(){
  try{return require('node:sea').isSea();}catch{return false;}
}

function normalizeAllowedOrigin(value){
  if(typeof value!=='string'||!value.trim())throw new Error('ERP Preview Origin을 지정해야 합니다.');
  let parsed;
  try{parsed=new URL(value.trim());}catch{throw new Error('ERP Preview Origin 형식이 올바르지 않습니다.');}
  const localHttp=parsed.protocol==='http:'&&(parsed.hostname==='127.0.0.1'||parsed.hostname==='localhost');
  if(parsed.protocol!=='https:'&&!localHttp)throw new Error('ERP Preview Origin은 HTTPS 주소여야 합니다.');
  if(parsed.username||parsed.password||parsed.pathname!=='/'||parsed.search||parsed.hash)throw new Error('Origin에는 경로·인증정보·쿼리를 포함할 수 없습니다.');
  return parsed.origin;
}

function normalizeSharedFolderPath(value){
  if(typeof value!=='string'||!value.trim())throw new Error(`공용폴더 경로를 인자로 지정하세요. 예: ERP-Bridge-Test.exe "Z:\\지원팀\\${TARGET_FOLDER_NAME}"`);
  if(value.includes('\0'))throw new Error('공용폴더 경로가 올바르지 않습니다.');
  const resolved=path.resolve(value.trim());
  if(path.basename(resolved).toLowerCase()!==TARGET_FOLDER_NAME.toLowerCase())throw new Error(`${TARGET_FOLDER_NAME} 폴더만 테스트 대상으로 지정할 수 있습니다.`);
  return resolved;
}

function readSharedFolderArgument(argv=process.argv){
  const targets=argv.filter(value=>{
    if(typeof value!=='string'||!value.trim())return false;
    try{return path.basename(path.resolve(value.trim())).toLowerCase()===TARGET_FOLDER_NAME.toLowerCase();}
    catch{return false;}
  });
  if(targets.length!==1)throw new Error(`공용폴더 경로 하나만 지정하세요. 예: ERP-Bridge-Test.exe "Z:\\지원팀\\${TARGET_FOLDER_NAME}"`);
  return normalizeSharedFolderPath(targets[0]);
}

function isLoopbackHost(hostHeader,port){
  if(typeof hostHeader!=='string')return false;
  try{
    const parsed=new URL(`http://${hostHeader}`);
    return parsed.hostname===HOST&&Number(parsed.port||80)===Number(port);
  }catch{return false;}
}

function corsHeaders(origin,includePrivateNetwork=false){
  const headers={
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'GET, POST',
    'Access-Control-Allow-Headers':'Accept, Content-Type',
    'Access-Control-Max-Age':'600',
    'Cache-Control':'no-store',
    'Content-Type':'application/json; charset=utf-8',
    'Vary':'Origin',
    'X-Content-Type-Options':'nosniff'
  };
  if(includePrivateNetwork)headers['Access-Control-Allow-Private-Network']='true';
  return headers;
}

function sendJson(response,status,body,headers={}){
  const payload=JSON.stringify(body);
  response.writeHead(status,{...headers,'Content-Length':Buffer.byteLength(payload)});
  response.end(payload);
}

function hash(value){return crypto.createHash('sha256').update(value).digest('hex');}

function publicFailure(stage,error,steps){
  const permissionDenied=error?.code==='EACCES'||error?.code==='EPERM';
  const failures={
    access:{code:'FOLDER_ACCESS_FAILED',message:'공용폴더 접근 실패'},
    create:{code:permissionDenied?'FILE_CREATE_DENIED':'FILE_CREATE_FAILED',message:permissionDenied?'파일 생성 권한 없음':'파일 생성 실패'},
    write:{code:'FILE_WRITE_FAILED',message:'파일 쓰기 실패'},
    read:{code:'FILE_READ_FAILED',message:'파일 읽기 실패'},
    verify:{code:'FILE_VERIFY_FAILED',message:'파일 검증 실패'},
    delete:{code:permissionDenied?'FILE_DELETE_DENIED':'FILE_DELETE_FAILED',message:permissionDenied?'파일 삭제 권한 없음':'파일 삭제 실패'},
    deleteVerify:{code:'FILE_DELETE_VERIFY_FAILED',message:'파일 삭제 확인 실패'}
  };
  const failure=failures[stage]||{code:'SHARED_FOLDER_TEST_FAILED',message:'공용폴더 테스트 실패'};
  return {ok:false,service:SERVICE,version:VERSION,code:failure.code,message:failure.message,testSizeBytes:TEST_SIZE_BYTES,steps};
}

async function runSharedFolderTest(sharedFolderPath,{fsApi=fs.promises,now=Date.now,randomBytes=crypto.randomBytes,logger=console}={}){
  const target=normalizeSharedFolderPath(sharedFolderPath);
  const steps={access:false,create:false,write:false,read:false,verify:false,delete:false};
  const fileName=`${TEST_FILE_PREFIX}${now()}_${randomBytes(6).toString('hex')}.txt`;
  const filePath=path.join(target,fileName);
  let stage='access';
  let handle=null;
  let created=false;
  try{
    const targetStat=await fsApi.stat(target);
    if(!targetStat.isDirectory())throw Object.assign(new Error('NOT_A_DIRECTORY'),{code:'ENOTDIR'});
    steps.access=true;

    stage='create';
    handle=await fsApi.open(filePath,'wx',0o600);
    created=true;
    steps.create=true;

    stage='write';
    await handle.writeFile(TEST_PAYLOAD);
    if(typeof handle.sync==='function')await handle.sync();
    await handle.close();
    handle=null;
    steps.write=true;

    stage='read';
    const savedStat=await fsApi.stat(filePath);
    const saved=await fsApi.readFile(filePath);
    steps.read=true;

    stage='verify';
    if(savedStat.size!==TEST_SIZE_BYTES||saved.length!==TEST_SIZE_BYTES||hash(saved)!==hash(TEST_PAYLOAD))throw new Error('TEST_CONTENT_MISMATCH');
    steps.verify=true;

    stage='delete';
    await fsApi.unlink(filePath);
    steps.delete=true;

    stage='deleteVerify';
    try{await fsApi.access(filePath);throw new Error('TEST_FILE_STILL_EXISTS');}
    catch(error){if(error?.code!=='ENOENT')throw error;created=false;}

    return {ok:true,service:SERVICE,version:VERSION,testSizeBytes:TEST_SIZE_BYTES,steps};
  }catch(error){
    try{if(handle)await handle.close();}catch(closeError){logger.error('공용폴더 테스트 파일 닫기 실패:',closeError);}
    if(created){
      try{await fsApi.unlink(filePath);created=false;}
      catch(cleanupError){logger.error('공용폴더 테스트 파일 정리 실패:',cleanupError);}
    }
    logger.error(`공용폴더 테스트 실패 단계: ${stage}`,error);
    return publicFailure(stage,error,steps);
  }
}

function hasRequestBody(request){
  const length=Number(request.headers['content-length']||0);
  return length>0||Boolean(request.headers['transfer-encoding']);
}

function createBridgeServer({allowedOrigin,sharedFolderPath,port=PORT,logger=console}={}){
  const origin=normalizeAllowedOrigin(allowedOrigin);
  const target=normalizeSharedFolderPath(sharedFolderPath);
  const expectedPort=Number(port);
  if(!Number.isInteger(expectedPort)||expectedPort<1||expectedPort>65535)throw new Error('Bridge 포트가 올바르지 않습니다.');
  let sharedFolderTestBusy=false;
  return http.createServer(async(request,response)=>{
    if(!isLoopbackHost(request.headers.host,expectedPort)){
      sendJson(response,400,{ok:false,error:'INVALID_HOST'});
      return;
    }
    if(request.headers.origin!==origin){
      sendJson(response,403,{ok:false,error:'ORIGIN_NOT_ALLOWED'});
      return;
    }
    const requestUrl=new URL(request.url||'/',`http://${HOST}:${expectedPort}`);
    if(requestUrl.search||!['/health','/shared-folder-test'].includes(requestUrl.pathname)){
      sendJson(response,404,{ok:false,error:'NOT_FOUND'},corsHeaders(origin));
      return;
    }
    const expectedMethod=requestUrl.pathname==='/health'?'GET':'POST';
    if(request.method==='OPTIONS'){
      if(request.headers['access-control-request-method']!==expectedMethod){
        sendJson(response,405,{ok:false,error:'METHOD_NOT_ALLOWED'},corsHeaders(origin));
        return;
      }
      response.writeHead(204,corsHeaders(origin,request.headers['access-control-request-private-network']==='true'));
      response.end();
      return;
    }
    if(request.method!==expectedMethod){
      sendJson(response,405,{ok:false,error:'METHOD_NOT_ALLOWED'},corsHeaders(origin));
      return;
    }
    if(requestUrl.pathname==='/health'){
      sendJson(response,200,{ok:true,service:SERVICE,version:VERSION},corsHeaders(origin));
      return;
    }
    if(hasRequestBody(request)){
      sendJson(response,400,{ok:false,error:'BODY_NOT_ALLOWED'},corsHeaders(origin));
      return;
    }
    if(sharedFolderTestBusy){
      sendJson(response,409,{ok:false,error:'TEST_IN_PROGRESS'},corsHeaders(origin));
      return;
    }
    sharedFolderTestBusy=true;
    try{
      const result=await runSharedFolderTest(target,{logger});
      sendJson(response,200,result,corsHeaders(origin));
    }catch(error){
      logger.error('공용폴더 테스트 처리 실패:',error);
      if(!response.headersSent)sendJson(response,500,{ok:false,service:SERVICE,version:VERSION,code:'SHARED_FOLDER_TEST_FAILED'},corsHeaders(origin));
    }finally{sharedFolderTestBusy=false;}
  });
}

function readAllowedOrigin(argv=process.argv.slice(2),env=process.env){
  if(isSeaRuntime())return ERP_PREVIEW_ORIGIN;
  const index=argv.indexOf('--origin');
  return index>=0?argv[index+1]:(env.ERP_BRIDGE_ALLOWED_ORIGIN||ERP_PREVIEW_ORIGIN);
}

function startBridge({allowedOrigin=readAllowedOrigin(),sharedFolderPath=readSharedFolderArgument(),port=PORT}={}){
  const origin=normalizeAllowedOrigin(allowedOrigin);
  const target=normalizeSharedFolderPath(sharedFolderPath);
  const server=createBridgeServer({allowedOrigin:origin,sharedFolderPath:target,port});
  server.on('error',error=>{
    console.error('ERP Bridge를 시작하지 못했습니다. 포트 사용 여부와 회사 보안정책을 확인하세요.',error);
    process.exitCode=1;
  });
  server.listen(port,HOST,()=>{
    console.log(`Recruit ERP Bridge ${VERSION}`);
    console.log(`대기 주소: http://${HOST}:${port}`);
    console.log(`허용 ERP Origin: ${origin}`);
    console.log(`${TARGET_FOLDER_NAME} 테스트 경로: 설정됨`);
    console.log('종료: Ctrl+C');
  });
  return server;
}

if(require.main===module||isSeaRuntime()){
  try{startBridge();}
  catch(error){console.error(error.message);process.exitCode=1;}
}

module.exports={HOST,PORT,SERVICE,VERSION,ERP_PREVIEW_ORIGIN,TARGET_FOLDER_NAME,TEST_SIZE_BYTES,TEST_FILE_PREFIX,TEST_PAYLOAD,isSeaRuntime,normalizeAllowedOrigin,normalizeSharedFolderPath,readSharedFolderArgument,isLoopbackHost,corsHeaders,runSharedFolderTest,createBridgeServer,readAllowedOrigin,startBridge};
