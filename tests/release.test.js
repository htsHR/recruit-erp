'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const version='10.54.0';
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const packageJson=JSON.parse(read('package.json'));
const index=read('index.html');
const workflow=read('.github/workflows/quality-checks.yml');
const vercel=JSON.parse(read('vercel.json'));

assert.equal(packageJson.version,version);
assert.match(index,new RegExp(`<title>채용관리 시스템 v${version.replaceAll('.','\\.')}</title>`));
assert.match(index,new RegExp(`VERSION 2\\.0 · v${version.replaceAll('.','\\.')}`));

const localAssets=[...index.matchAll(/(?:src|href)="(?!https?:)([^"?]+)\?v=([^"]+)"/g)];
assert.ok(localAssets.length>=40,'버전이 붙은 로컬 화면 파일을 찾지 못했습니다.');
localAssets.forEach(([,file,assetVersion])=>assert.equal(assetVersion,version,`${file} 버전 불일치`));

assert.ok(fs.existsSync(path.join(root,`CHANGELOG_v${version}.md`)),'현재 버전 변경 기록이 없습니다.');
assert.match(workflow,/npm run check/);
assert.match(workflow,/pull_request:/);
assert.match(workflow,/branches: \[main\]/);

const headers=Object.fromEntries(vercel.headers[0].headers.map(item=>[item.key,item.value]));
assert.equal(headers['X-Content-Type-Options'],'nosniff');
assert.equal(headers['X-Frame-Options'],'DENY');
assert.equal(headers['Referrer-Policy'],'no-referrer');
assert.ok(headers['Permissions-Policy']);

console.log('release.test.js: 버전·자동 검사·Vercel 보안 설정 확인 완료');
