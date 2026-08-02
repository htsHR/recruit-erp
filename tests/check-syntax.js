'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const targets=[
  ...fs.readdirSync(path.join(root,'js')).filter(file=>file.endsWith('.js')).map(file=>path.join(root,'js',file)),
  ...fs.readdirSync(__dirname).filter(file=>file.endsWith('.js')).map(file=>path.join(__dirname,file)),
  path.join(root,'supabase_config.js')
].sort();

for(const file of targets){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0){
    console.error(`문법 검사 실패: ${path.relative(root,file)}`);
    console.error(result.stderr||result.stdout);
    process.exit(result.status||1);
  }
}

console.log(`JavaScript 파일 ${targets.length}개의 문법 검사가 통과했습니다.`);
