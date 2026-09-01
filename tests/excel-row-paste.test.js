'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/applicants.js'),'utf8');
const context={
  console,Date,Set,Map,Object,Array,String,Number,Math,RegExp,JSON,
  applicants:[],
  STATUS_OPTIONS:['서류검토','서류합격','부재중','면접예정','면접완료','다음면접','입사예정','출근','불합격','서류탈락','면접거절','면접불참','입사철회'],
  normalizeStatus:value=>String(value||'').trim(),
  normalizeGender:value=>({남:'남자',남자:'남자',여:'여자',여자:'여자'}[String(value||'').trim()]||''),
  formatPhoneDisplay:value=>{
    const digits=String(value||'').replace(/\D/g,'');
    return digits.length===11?`${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`:digits;
  },
  calcAge:()=>0,
  document:{readyState:'loading',addEventListener:()=>{}},
  window:{}
};
context.window=context;
vm.createContext(context);
vm.runInContext(`${source}\n;globalThis.__excelPasteTest={excelPasteParseTsv,excelPasteIsHeaderRow,excelPasteRowToApplicant,excelPasteFindDuplicates,excelPasteBatchPairReasons};`,context,{filename:'applicants.js'});

const api=context.__excelPasteTest;
const modern=[
  ['NO','지원날짜','연락상태','면접날짜','시간','입사날짜','지원경로','지원구분','성별','지원파트','성명','이메일','학력구분','학교','학과','연락처','나이','생년월일','지역','경력','자격증','비고'],
  ['1','2026-09-01','서류검토','','','','사람인','경력','남','평택','가상지원자','virtual@example.com','전졸','가상전문대','반도체과','01012345678','27','1999-01-02','천안','가상회사 PM','전기기능사','기숙사']
];
const parsedRows=api.excelPasteParseTsv(modern.map(row=>row.join('\t')).join('\n'));
assert.equal(parsedRows.length,2);
assert.equal(api.excelPasteIsHeaderRow(parsedRows[0]),true);
const parsed=api.excelPasteRowToApplicant(parsedRows[1],parsedRows[0]);
assert.deepEqual(JSON.parse(JSON.stringify({
  applyDate:parsed.data.applyDate,status:parsed.data.status,workplace:parsed.data.workplace,name:parsed.data.name,
  phone:parsed.data.phone,birthYear:parsed.data.birthYear,school:parsed.data.school,major:parsed.data.major,
  career:parsed.data.career,dormUse:parsed.data.dormUse
})),{
  applyDate:'2026-09-01',status:'서류검토',workplace:'평택',name:'가상지원자',phone:'010-1234-5678',
  birthYear:'1999-01-02',school:'가상전문대',major:'반도체과',career:'가상회사 PM',dormUse:'기숙사'
});
assert.equal(parsed.issues.some(issue=>issue.level==='error'),false);

const legacy=['1','2026.09.01','서류검토','','','','사람인','경력','천안','여','가상기존형식','legacy@example.com','가상대학교','전자과','01099990001','990101','27','천안시','동남구','가상회사 장비PM','산업안전기사','출퇴근'];
const legacyParsed=api.excelPasteRowToApplicant(legacy);
assert.equal(legacyParsed.data.name,'가상기존형식');
assert.equal(legacyParsed.data.gender,'여자');
assert.equal(legacyParsed.data.workplace,'천안');
assert.equal(legacyParsed.data.birthYear,'1999-01-01');
assert.equal(legacyParsed.data.region,'천안시 동남구');
assert.equal(legacyParsed.issues.some(issue=>issue.level==='error'),false);

context.applicants=[{id:'existing',name:'가상지원자',phone:'010-1234-5678',email:'virtual@example.com',birthYear:'1999-01-02'}];
const duplicates=api.excelPasteFindDuplicates(parsed.data);
assert.equal(duplicates.length,1);
assert.deepEqual(JSON.parse(JSON.stringify(duplicates[0].reasons)),['연락처 동일','이메일 동일','성명+생년월일 동일']);
assert.deepEqual(JSON.parse(JSON.stringify(api.excelPasteBatchPairReasons(parsed.data,{...parsed.data,email:'other@example.com'}))),[
  '붙여넣은 행끼리 연락처 동일','붙여넣은 행끼리 성명+생년월일 동일'
]);

console.log('excel-row-paste.test.js: 현재·기존 엑셀 형식, 날짜·연락처 변환, 경력·출근방법, 중복 경고 확인 완료');
