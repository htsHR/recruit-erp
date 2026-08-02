'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const port=Number(process.env.ERP_TEST_PORT)||4173;
http.createServer((request,response)=>{
  const pathname=decodeURIComponent(request.url.split('?')[0]);
  const target=path.resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!target.startsWith(root)){response.writeHead(403);response.end('Forbidden');return;}
  fs.readFile(target,(error,data)=>{
    if(error){response.writeHead(404);response.end('Not found');return;}
    response.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});response.end(data);
  });
}).listen(port,'127.0.0.1',()=>console.log(`ERP preview http://127.0.0.1:${port}`));
