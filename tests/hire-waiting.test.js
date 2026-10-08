'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const waiting=require('../js/hire-waiting.js');
const xlsx=require('../js/local-xlsx.js');
const security=require('../js/security.js');
const headers=waiting.COLUMNS.map(column=>column.label);
const synthetic=[
  ['1','0000123','입사대기','2099-10-12','가상근무지','','남','가상그룹','가상제품','가상파트','가상대기1','가상직급','000000-0000000','2000-01-02','25','fake@example.com','대졸','가상대학교','가상학과','01000000001','가상지역','기숙사','180cm / 75kg · 기숙사 희망 / 지원팀 확인'],
  ['2','0000124','입사대기','2099-10-12','가상근무지','','여','','','','가상대기2','가상직급','000000-0000000','2001-02-03','24','=HYPERLINK("https://example.invalid")','','','','01000000002','','출퇴근','기숙사 문의\n지원팀 확인, 2026/10/12 회신']
];
const quote=value=>/[\t\n"]/.test(value)?`"${value.replaceAll('"','""')}"`:value;
const raw=[headers,...synthetic].map(row=>row.map(quote).join('\t')).join('\r\n');
const rows=waiting.parsePaste(raw);
assert.deepEqual(rows,synthetic,'줄바꿈·따옴표·0으로 시작하는 식별자는 원문 보존');
assert.deepEqual(waiting.parsePaste([headers.map(header=>header==='성명'?'성  명':header==='직급'?'직 급':header),synthetic[0]].map(row=>row.join('\t')).join('\n')),[synthetic[0]],'원본 제목의 띄어쓰기를 허용');
assert.deepEqual(waiting.parsePaste(synthetic[0].join('\t')),[synthetic[0]],'원본 23열 데이터만 붙여넣기');
const subset=waiting.parsePaste('연락처\t성명\t비고\n01000000003\t가상부분명단\t통근');
assert.equal(subset[0][10],'가상부분명단');assert.equal(subset[0][19],'01000000003');assert.equal(subset[0][22],'통근');
assert.throws(()=>waiting.parsePaste('성명\t성  명\n가상\t가상'),/두 번/);
assert.throws(()=>waiting.parsePaste('성명\t연락처\t없는제목\n가상\t01000000000\t내용'),/없는 제목/);
assert.throws(()=>waiting.parsePaste(headers.join('\t')+'\n1\t0000001'),/성명/);
assert.throws(()=>waiting.parsePaste('가상\t01000000000'),/23열/);
assert.throws(()=>waiting.parsePaste('성명\t비고\n가상\t"닫히지 않은 셀'),/따옴표/);

const snapshot=JSON.stringify(rows);
function unzip(bytes){
  const buffer=Buffer.from(bytes),files=new Map();let offset=0;
  while(buffer.readUInt32LE(offset)===0x04034b50){
    const size=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),extraLength=buffer.readUInt16LE(offset+28),start=offset+30+nameLength+extraLength;
    assert.equal(buffer.readUInt16LE(offset+8),0);
    files.set(buffer.subarray(offset+30,offset+30+nameLength).toString(),buffer.subarray(start,start+size).toString());offset=start+size;
  }
  return files;
}
assert.equal(waiting.fileName(rows),'입사대기자명단(99.10.12).xlsx');
const filenameRows=rows.map(row=>row.slice());filenameRows.forEach(row=>row[3]='2026.10.12');
assert.equal(waiting.fileName(filenameRows),'입사대기자명단(26.10.12).xlsx');
const sourceWidths=[10.25,14.25,14.25,14.25,12.625,20.25,11,11,11,11,6.875,5.875,15,12.25,8,23.375,8.5,13.75,15.5,13.75,8,8.5,36.875];
assert.deepEqual(waiting.COLUMNS.map(column=>column.width),sourceWidths,'23개 열 너비는 제공된 양식과 동일');
for(const preset of waiting.PRESETS){
  const result=waiting.buildExport(rows,preset),keys=result.columns.map(column=>column.key);
  assert.equal(keys.includes('grade'),false,`${preset.name}: 직급 제외`);
  assert.equal(keys.includes('residentNumber'),preset.id==='health-support',`${preset.name}: 주민등록번호 규칙`);
  assert.equal(result.columns.length,preset.id==='health-support'?22:21);
  const memo=result.rows[0][keys.indexOf('memo')];
  assert.equal(memo,preset.id==='final'?'기숙사 희망 / 지원팀 확인':synthetic[0][22]);
  assert.equal(result.rows[1][keys.indexOf('memo')],synthetic[1][22],'날짜·연락 기록·줄바꿈 등 다른 비고는 그대로 보존');
  const bytes=xlsx.bytes(result.columns,result.rows);
  const files=unzip(bytes),sheet=files.get('xl/worksheets/sheet1.xml'),styles=files.get('xl/styles.xml');
  assert.match(sheet,/<row r="1" ht="27\.75" customHeight="1">/,'원본 제목행 높이');
  assert.match(sheet,/<row r="2" ht="30" customHeight="1">/,'원본 본문행 높이');
  assert.match(sheet,/<pageSetup paperSize="9" orientation="portrait"\/>/,'원본 A4 세로 설정');
  assert.match(sheet,/left="0\.7" right="0\.7" top="0\.75" bottom="0\.75"/,'원본 페이지 여백');
  assert.match(styles,/rgb="FFFFC000"/,'원본 주황색 제목');
  assert.match(styles,/rgb="FF92D050"/,'원본 초록색 연락상태');
  assert.match(styles,/style="hair"/,'원본 가는 셀 테두리');
  assert.match(styles,/<name val="맑은 고딕"\/>/,'원본 글꼴');
  assert.match(styles,/<b\/><sz val="10"\/>/,'원본 제목 글씨 크기 및 굵기');
  assert.ok(files.has('xl/theme/theme1.xml'),'원본 테마와 색조를 유지');
  assert.doesNotMatch(sheet,/<pane|state="hidden"|hidden="1"/,'원본에 없는 고정행과 숨긴 열을 추가하지 않음');
  result.columns.forEach((column,index)=>{
    assert.match(sheet,new RegExp(`<col min="${index+1}" max="${index+1}" width="${sourceWidths[column.templateIndex]}" customWidth="1"/>`),'열 제거 후에도 각 필드의 원본 너비 유지');
  });
  const nameCol=String.fromCharCode(65+keys.indexOf('name'));
  assert.match(sheet,new RegExp(`<c r="${nameCol}3" s="23"`),'원본 두 번째 명단행의 노란색 성명 강조 유지');
  assert.match(sheet,/<c r="D2" s="9"><v>/,'입사날짜는 원본 날짜 표시 서식을 사용하는 숫자 셀');
  for(const ref of sheet.matchAll(/sqref="([^"]+)"/g))for(const range of ref[1].split(' ')){
    for(const address of range.split(':')){assert.ok(address.charCodeAt(0)-64<=result.columns.length,'조건부 서식은 실제 다운로드 열 범위 안에만 적용');assert.ok(Number(address.match(/\d+/)[0])<=3,'조건부 서식의 빈 백만 행을 복사하지 않음');}
  }
  assert.equal(Buffer.from(bytes).readUInt32LE(0),0x04034b50,'다운로드는 실제 XLSX ZIP 패키지');
  assert.equal(Buffer.from(bytes).includes(Buffer.from('주민등록번호')),preset.id==='health-support','제외한 열은 패키지에 실제로 포함되지 않아야 함');
  assert.equal(Buffer.from(bytes).includes(Buffer.from('가상직급')),false);
  assert.equal(Buffer.from(bytes).includes(Buffer.from('180cm')),preset.id!=='final');
  assert.equal(Buffer.from(bytes).includes(Buffer.from('0000123')),true,'사원번호 앞자리 0 보존');
  assert.equal(Buffer.from(bytes).includes(Buffer.from('01000000001')),true,'연락처 앞자리 0 보존');
  assert.equal(Buffer.from(bytes).includes(Buffer.from('<f>')),false,'붙여넣은 수식처럼 보이는 문자열을 수식으로 실행하지 않음');
  assert.equal(Buffer.from(bytes).includes(Buffer.from('state="hidden"')),false,'숨긴 시트로 제외 정보를 남기지 않음');
}
assert.equal(JSON.stringify(rows),snapshot,'모든 다운로드 준비는 원본을 변경하지 않음');
const statusRow=rows[0].slice();statusRow[2]='대기';statusRow[6]='여자';
const appearanceContext=xlsx.formatContext([statusRow]);
assert.match(xlsx.appearance(waiting.COLUMNS[2],0,statusRow[2],appearanceContext),/background-color:#FFC000/,'연락상태 조건부 색상');
assert.match(xlsx.appearance(waiting.COLUMNS[6],0,statusRow[6],appearanceContext),/background-color:#C00000/,'성별 조건부 색상');
assert.equal(xlsx.displayText(waiting.COLUMNS[3],'2026-10-12'),'10월 12일','화면도 원본 입사날짜 표시 사용');
for(const [input,expected] of [
  ['172.5cm/62.3kg',''],['175㎝ / 80㎏ · 기숙사','기숙사'],['지원팀 확인 / 180CM / 75KG','지원팀 확인'],
  ['기숙사 (180cm / 75kg) 출퇴근','기숙사  출퇴근'],
  ['키·몸무게: 180/75, 기숙사','기숙사'],['키: 180cm 몸무게: 75kg · 출퇴근','출퇴근'],
  ['면접일 2026/10/12, 버스 180번, 짐 20kg, 사물함 90cm','면접일 2026/10/12, 버스 180번, 짐 20kg, 사물함 90cm'],
  ['  지원팀 확인 (통근)  ','  지원팀 확인 (통근)  ']
])assert.equal(waiting.removeBodyMeasurements(input),expected);
assert.equal(xlsx.dateValue('2099.10.12').iso,'2099-10-12');
assert.equal(xlsx.dateValue('2099-02-30'),null);
assert.equal(waiting.buildExport(rows,{columns:['name','phone']}).columns.length,2);
assert.throws(()=>waiting.buildExport(rows,{columns:[]}),/열/);

// Existing storage, explicit save, quota failure and direct permission guards.
const legacy={id:'legacy-waiting-profile',applicantId:'legacy-applicant',employeeNo:'0001',groupName:'보존그룹',unknownField:'원문 유지'};
const key='recruit_erp_hire_waiting_profiles',storage=new Map([[key,JSON.stringify([legacy])]]);
let writable=true,permit=true,writes=0;
const context={
  window:{document:{getElementById:()=>null},localStorage:{getItem:name=>storage.get(name)??null},erpPermissions:{require:()=>permit,has:()=>permit}},
  console,Promise,Date,Set,Map,JSON,crypto:globalThis.crypto,
  uid:()=>`synthetic-sheet-${writes+1}`,
  safeLocalStorageSet(name,value){writes++;if(!writable)return false;storage.set(name,value);return true;}
};
context.window.window=context.window;
vm.runInNewContext(`const HIRE_WAITING_PROFILES_KEY='${key}';let hireWaitingProfiles=${JSON.stringify([legacy])};\n${fs.readFileSync(require.resolve('../js/hire-waiting.js'),'utf8')}\n;globalThis.getProfiles=()=>hireWaitingProfiles;`,context);
const api=context.window.erpHireWaiting;
assert.equal(api.stagePaste(raw),true);assert.equal(writes,0,'붙여넣기·미리보기는 업무 저장소를 쓰지 않음');
assert.equal(api.isDirty(),true);
const before=storage.get(key);writable=false;
assert.equal(api.saveRoster(),false);assert.equal(storage.get(key),before);assert.equal(JSON.stringify(context.getProfiles()),before);assert.equal(api.isDirty(),true,'저장 실패 후 입력 유지');
writable=true;assert.equal(api.saveRoster(),true);assert.equal(api.isDirty(),false);
let stored=JSON.parse(storage.get(key));assert.deepEqual(stored[0],legacy);assert.deepEqual(stored[1].rows,synthetic);
security.validateBackupPayload({data:{hireWaitingProfiles:stored}},{datasetKeys:['hireWaitingProfiles']});
assert.equal(api.stagePaste(raw),true);assert.equal(api.saveRoster(),true);
stored=JSON.parse(storage.get(key));assert.equal(stored.length,3,'새 명단 저장은 기존 명단을 덮어쓰지 않음');
assert.deepEqual(stored[0],legacy);assert.deepEqual(stored[1].rows,synthetic);
permit=false;const writeCount=writes;
assert.equal(api.stagePaste(raw),false);assert.equal(api.saveRoster(),false);assert.equal(api.download('health-support'),false);assert.equal(api.openDepartment(),false);assert.equal(api.saveDepartment(),false);assert.equal(api.deleteDepartment(),false);
assert.equal(writes,writeCount,'조회 전용의 직접 함수 호출도 쓰기·내보내기 차단');
console.log('hire-waiting.test.js: Excel 원문·3개 다운로드 규칙·비고 선택 삭제·XLSX·기존 자료 및 저장 실패·권한 보호 확인 완료');
