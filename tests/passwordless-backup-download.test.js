'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const ui=read('js/encrypted-backup-ui.js');
const center=read('js/backup-center.js');
const applicants=read('js/applicants.js');
const applicantTools=read('js/applicant-tools.js');

assert.doesNotMatch(ui,/panel\.id='bcEncryptedPanel'/,'암호화 다운로드 패널을 다시 만들면 안 됩니다.');
assert.doesNotMatch(ui,/openDialog\(\{kind:'export'/,'다운로드가 비밀번호 대화상자를 열면 안 됩니다.');
assert.match(ui,/erpBackupCenter\?\.exportPlain\?\.\(type\)/,'백업 다운로드는 일반 JSON 내보내기로 바로 연결되어야 합니다.');
assert.match(center,/exportPlain:\(type='full'\)=>exportBackup\(type\)/,'전체·부분 JSON 직접 다운로드 API가 있어야 합니다.');
assert.match(applicants,/safetyBackup\('엑셀 여러 행 신규 등록·기존 지원자 변경 직전'\)/,'엑셀 일괄 등록 직전 JSON 안전백업은 유지해야 합니다.');
assert.match(applicantTools,/function jsonBackup\(\)[\s\S]*resume_management_backup_[^\n]+\.json/,'지원자 JSON 백업은 직접 JSON 파일을 내려받아야 합니다.');

const exported=[];
const context={
  window:{
    document:{readyState:'loading',addEventListener(){}},
    erpPermissions:{require:permission=>permission==='backup.manage'},
    erpBackupCenter:{exportPlain:type=>{exported.push(type);return {type};}},
    erpEncryptedBackup:{isSupported:()=>true}
  }
};
vm.createContext(context);
vm.runInContext(ui,context,{filename:'encrypted-backup-ui.js'});
const result=context.window.erpEncryptedBackupUI.openExportDialog('applicants');
assert.deepEqual(exported,['applicants']);
assert.equal(result.type,'applicants');

assert.match(ui,/openDialog\(\{kind:'decrypt',file,envelope\}\)/,'기존 암호화 백업 복원 호환은 유지해야 합니다.');
assert.match(ui,/core\.decryptEnvelope\(currentTask\.envelope,password\)/,'기존 암호화 파일은 비밀번호로 복호화해야 합니다.');

console.log('passwordless-backup-download.test.js: 엑셀 안전백업·지원자 JSON·전체/부분 백업의 무비밀번호 다운로드와 기존 암호화 복원 호환 확인 완료');
