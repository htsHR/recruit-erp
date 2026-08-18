'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const security=require('../js/security.js');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
const runtimeSources=[index,...fs.readdirSync(path.join(root,'js')).filter(name=>name.endsWith('.js')).map(name=>fs.readFileSync(path.join(root,'js',name),'utf8'))].join('\n');

assert.doesNotMatch(runtimeSources,/(?:<|\s)on(?:click|change|keydown|input|submit|error|load)\s*=\s*["']/i,'HTML 인라인 이벤트 속성이 남아 있습니다.');
assert.match(runtimeSources,/data-erp-handler=/,'CSP 호환 선언형 화면 동작이 없습니다.');
assert.match(index,/js\/security\.js\?v=11\.4\.0/);
assert.match(index,/@supabase\/supabase-js@2\.111\.0\/dist\/umd\/supabase\.min\.js/);
assert.match(index,/integrity="sha384-[A-Za-z0-9+/=]+"/);

const csp=vercel.headers[0].headers.find(item=>item.key==='Content-Security-Policy')?.value||'';
assert.ok(csp,'Content-Security-Policy 헤더가 없습니다.');
const scriptPolicy=csp.split(';').map(item=>item.trim()).find(item=>item.startsWith('script-src '))||'';
assert.doesNotMatch(scriptPolicy,/'unsafe-inline'|'unsafe-eval'/);
assert.match(csp,/script-src-attr 'none'/);
assert.match(csp,/object-src 'none'/);
assert.match(csp,/frame-ancestors 'none'/);

const xss='<img src=x onerror=alert(1)>';
assert.equal(security.escapeAttribute(xss),'&lt;img src=x onerror=alert(1)&gt;');
assert.equal(security.isValidId('550e8400-e29b-41d4-a716-446655440000'),true);
assert.equal(security.isValidId("bad' onclick='alert(1)"),false);
const imported=security.parseImportJson(JSON.stringify({applicants:[{id:'test-safe-1',name:xss,memo:xss}]}),{collection:'applicants',requireId:true});
assert.equal(imported.rows[0].name,xss);
assert.throws(()=>security.parseImportJson(JSON.stringify({applicants:[{id:"bad' onclick='alert(1)",name:'가상 지원자'}]}),{collection:'applicants',requireId:true}),/ID 형식/);
assert.throws(()=>security.parseJson('{"__proto__":{"polluted":true}}'),/위험한 속성/);

const attrs=security.actionAttrs('viewApplicant',['test-safe-1']);
assert.doesNotMatch(attrs,/onclick=/i);
assert.match(attrs,/data-erp-action=/);

let viewed='';let alertCalled=false;
global.viewApplicant=id=>{viewed=id;};
global.alert=()=>{alertCalled=true;};
const legacyElement={value:'',checked:false,dataset:{},matches:()=>false,getAttribute:name=>name==='data-erp-handler'?"viewApplicant('test-safe-1');alert(1)":''};
security.invokeLegacy(legacyElement,{stopPropagation(){}},'data-erp-handler');
assert.equal(viewed,'test-safe-1');
assert.equal(alertCalled,false,'허용 목록 밖의 함수가 실행됐습니다.');

console.log('screen-security.test.js: 인라인 실행 차단·CSP·JSON/ID·XSS 표시 보호 확인 완료');
