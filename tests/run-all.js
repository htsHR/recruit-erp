'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const tests=fs.readdirSync(__dirname)
  .filter(file=>file.endsWith('.test.js'))
  .sort();

if(!tests.length){
  console.error('실행할 자동 테스트가 없습니다.');
  process.exit(1);
}

for(const file of tests){
  console.log(`\n[자동 검사] ${file}`);
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
  if(result.error){
    console.error(`${file} 실행 실패:`,result.error.message);
    process.exit(1);
  }
  if(result.status!==0)process.exit(result.status||1);
}

console.log(`\n자동 테스트 ${tests.length}개 파일이 모두 통과했습니다.`);
