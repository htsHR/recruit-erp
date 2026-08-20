'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('index.html');
const runtime=['core.js','local-only-init.js','state-init.js','storage-performance.js','ui-enhancements.js']
  .map(name=>read(path.join('js',name))).join('\n');
const vercel=JSON.parse(read('vercel.json'));
const csp=vercel.headers[0].headers.find(item=>item.key==='Content-Security-Policy')?.value||'';

assert.equal(fs.existsSync(path.join(root,'js','shared-storage.js')),false,'브라우저 Bridge 저장 클라이언트는 영구 제거해야 합니다.');
assert.doesNotMatch(index,/shared-storage\.js|erpSharedStorage|127\.0\.0\.1:17840|\/storage\/snapshot/i);
assert.doesNotMatch(runtime,/erpSharedStorage|127\.0\.0\.1:17840|\/storage\/(?:status|snapshot|initialize)/i);
assert.match(csp,/connect-src 'self'/);
assert.doesNotMatch(csp,/127\.0\.0\.1|localhost|supabase/i);
assert.ok(fs.existsSync(path.join(root,'bridge','erp-bridge.js')),'OWNER 수동 삭제 전까지 로컬 Bridge 배포물 소스는 보존합니다.');

console.log('shared-storage-client.test.js: Production 브라우저 Bridge·원격 저장 경로 제거와 CSP 독립성 확인 완료');
