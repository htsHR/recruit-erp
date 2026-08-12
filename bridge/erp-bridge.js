'use strict';

const http=require('node:http');

const HOST='127.0.0.1';
const PORT=17840;
const SERVICE='Recruit ERP Bridge';
const VERSION='0.1-test';
const ERP_PREVIEW_ORIGIN='https://recruit-erp-git-agent-shared-folder-storage-test-htserp.vercel.app';

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
    'Access-Control-Allow-Methods':'GET',
    'Access-Control-Allow-Headers':'Accept',
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

function createBridgeServer({allowedOrigin,port=PORT}={}){
  const origin=normalizeAllowedOrigin(allowedOrigin);
  const expectedPort=Number(port);
  if(!Number.isInteger(expectedPort)||expectedPort<1||expectedPort>65535)throw new Error('Bridge 포트가 올바르지 않습니다.');
  return http.createServer((request,response)=>{
    if(!isLoopbackHost(request.headers.host,expectedPort)){
      sendJson(response,400,{ok:false,error:'INVALID_HOST'});
      return;
    }
    if(request.headers.origin!==origin){
      sendJson(response,403,{ok:false,error:'ORIGIN_NOT_ALLOWED'});
      return;
    }
    const requestUrl=new URL(request.url||'/',`http://${HOST}:${expectedPort}`);
    if(requestUrl.pathname!=='/health'||requestUrl.search){
      sendJson(response,404,{ok:false,error:'NOT_FOUND'},corsHeaders(origin));
      return;
    }
    if(request.method==='OPTIONS'){
      if(request.headers['access-control-request-method']!=='GET'){
        sendJson(response,405,{ok:false,error:'METHOD_NOT_ALLOWED'},corsHeaders(origin));
        return;
      }
      response.writeHead(204,corsHeaders(origin,request.headers['access-control-request-private-network']==='true'));
      response.end();
      return;
    }
    if(request.method!=='GET'){
      sendJson(response,405,{ok:false,error:'METHOD_NOT_ALLOWED'},corsHeaders(origin));
      return;
    }
    sendJson(response,200,{ok:true,service:SERVICE,version:VERSION},corsHeaders(origin));
  });
}

function readAllowedOrigin(argv=process.argv.slice(2),env=process.env){
  if(isSeaRuntime())return ERP_PREVIEW_ORIGIN;
  const index=argv.indexOf('--origin');
  return index>=0?argv[index+1]:(env.ERP_BRIDGE_ALLOWED_ORIGIN||ERP_PREVIEW_ORIGIN);
}

function startBridge({allowedOrigin=readAllowedOrigin(),port=PORT}={}){
  const origin=normalizeAllowedOrigin(allowedOrigin);
  const server=createBridgeServer({allowedOrigin:origin,port});
  server.on('error',()=>{
    console.error('ERP Bridge를 시작하지 못했습니다. 포트 사용 여부와 회사 보안정책을 확인하세요.');
    process.exitCode=1;
  });
  server.listen(port,HOST,()=>{
    console.log(`Recruit ERP Bridge ${VERSION}`);
    console.log(`대기 주소: http://${HOST}:${port}`);
    console.log(`허용 ERP Origin: ${origin}`);
    console.log('종료: Ctrl+C');
  });
  return server;
}

if(require.main===module||isSeaRuntime()){
  try{startBridge();}
  catch(error){console.error(error.message);process.exitCode=1;}
}

module.exports={HOST,PORT,SERVICE,VERSION,ERP_PREVIEW_ORIGIN,isSeaRuntime,normalizeAllowedOrigin,isLoopbackHost,createBridgeServer,startBridge};
