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

assert.equal(packageJson.version,version);
assert.match(index,new RegExp(`<title>채용관리 시스템 v${version.replaceAll('.','\\.')}</title>`));
assert.match(index,/<h1>Recruit ERP<\/h1>/);
assert.match(index,new RegExp(`<p>v${version.replaceAll('.','\\.')}<\/p>`));
assert.doesNotMatch(index,/\bPreview\b/);
assert.doesNotMatch(index,/VERSION 2\.0/);

const localAssets=[...index.matchAll(/(?:src|href)="(?!https?:)([^"?]+)\?v=([^"]+)"/g)];
assert.ok(localAssets.length>=40,'버전이 붙은 로컬 화면 파일을 찾지 못했습니다.');
const assetVersions=new Map(localAssets.map(([,file,assetVersion])=>[file,assetVersion]));
const changedAssets=['css/recruiter-daily-usability.css','js/app-version.js','js/core.js','js/production-readiness.js','js/reports.js'];
changedAssets.forEach(file=>assert.equal(assetVersions.get(file),version,`${file}의 v12.2.0 캐시 버전이 일치하지 않습니다.`));
assert.deepEqual(
  localAssets.filter(([,file,assetVersion])=>assetVersion===version).map(([,file])=>file).sort(),
  [...changedAssets].sort(),
  'v12.2.0에서 수정된 JS/CSS만 새 캐시 버전을 사용해야 합니다.'
);
localAssets.filter(([,file])=>!changedAssets.includes(file)).forEach(([,file,assetVersion])=>assert.ok(['12.0.2','12.0.3','12.1.0'].includes(assetVersion),`${file}의 변경 없는 캐시 버전을 불필요하게 올리면 안 됩니다.`));

assert.ok(fs.existsSync(path.join(root,`CHANGELOG_v${version}.md`)),'현재 버전 변경 기록이 없습니다.');
assert.match(workflow,/npm run check/);
assert.match(workflow,/npm ci/);
assert.match(workflow,/npm run test:ui-layout/);
assert.match(workflow,/NotoSansKR%5Bwght%5D\.ttf/);
assert.match(workflow,/curl --fail --location --retry 3 --connect-timeout 15 --max-time 120/);
assert.match(workflow,/fc-cache -f/);
assert.match(workflow,/fc-match "Noto Sans KR"/);
assert.match(workflow,/timeout-minutes: 10/);
assert.match(workflow,/actions\/upload-artifact@v4/);
assert.match(workflow,new RegExp(`UI_SCREENSHOT_DIR: artifacts\\/ui-v${version.replaceAll('.','\\.')}`));
assert.match(workflow,/if: always\(\)/);
assert.match(workflow,/pull_request:/);
assert.match(workflow,/branches: \[main\]/);
assert.match(workflow,/actions\/checkout@v6/);
assert.match(workflow,/actions\/setup-node@v6/);
assert.match(workflow,/node-version: 24/);
assert.match(workflow,/package-manager-cache: false/);

const headers=Object.fromEntries(vercel.headers[0].headers.map(item=>[item.key,item.value]));
assert.equal(headers['X-Content-Type-Options'],'nosniff');
assert.equal(headers['X-Frame-Options'],'DENY');
assert.equal(headers['Referrer-Policy'],'no-referrer');
assert.ok(headers['Permissions-Policy']);
assert.match(headers['Content-Security-Policy'],/script-src-attr 'none'/);
assert.match(headers['Content-Security-Policy'],/object-src 'none'/);

console.log('release.test.js: 버전·자동 검사·Vercel 보안 설정 확인 완료');
