'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const version=require('../js/app-version.js').VERSION;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const packageJson=JSON.parse(read('package.json'));
const index=read('index.html');
const workflow=read('.github/workflows/quality-checks.yml');
const vercel=JSON.parse(read('vercel.json'));

assert.equal(version,'12.5.0');
assert.equal(packageJson.version,version);
assert.match(index,new RegExp(`<title>채용 업무 v${version.replaceAll('.','\\.')}</title>`));
assert.match(index,/<h1>채용 업무<\/h1>/);
assert.match(index,new RegExp(`<p>v${version.replaceAll('.','\\.')} · CORE<\/p>`));
assert.doesNotMatch(index,/\bPreview\b|VERSION 2\.0/);

const localAssets=[...index.matchAll(/(?:src|href)="(?!https?:)([^"?]+)\?v=([^"]+)"/g)];
assert.ok(localAssets.length>=40,'버전이 붙은 로컬 화면 파일을 찾지 못했습니다.');
localAssets.forEach(([,file,assetVersion])=>assert.equal(assetVersion,version,`${file} 캐시 버전이 현재 릴리스와 다릅니다.`));
assert.ok(fs.existsSync(path.join(root,`CHANGELOG_v${version}.md`)),'현재 버전 변경 기록이 없습니다.');

assert.match(workflow,/npm run check/);
assert.match(workflow,/npm ci/);
assert.match(workflow,/npm run test:ui-layout/);
assert.match(workflow,/NotoSansKR%5Bwght%5D\.ttf/);
assert.match(workflow,/actions\/upload-artifact@v4/);
assert.match(workflow,new RegExp(`UI_SCREENSHOT_DIR: artifacts\\/ui-v${version.replaceAll('.','\\.')}`));
assert.match(workflow,/pull_request:/);
assert.match(workflow,/branches: \[main\]/);
assert.match(workflow,/node-version: 24/);

const headers=Object.fromEntries(vercel.headers[0].headers.map(item=>[item.key,item.value]));
assert.equal(headers['X-Content-Type-Options'],'nosniff');
assert.equal(headers['X-Frame-Options'],'DENY');
assert.equal(headers['Referrer-Policy'],'no-referrer');
assert.ok(headers['Permissions-Policy']);
assert.match(headers['Content-Security-Policy'],/script-src-attr 'none'/);
assert.match(headers['Content-Security-Policy'],/object-src 'none'/);

console.log('release.test.js: v12.5.0 버전·자산·자동검사·Vercel 보안 설정 확인 완료');
