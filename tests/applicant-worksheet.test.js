'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const worksheet=require('../js/applicant-worksheet.js');

const rows=[
  {id:'worksheet-test-1',name:'가상지원자1',phone:'010-0000-0001',email:'one@example.invalid',region:'충남',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',interviewDate:'',interviewTime:'',hireDate:'',source:'가상채널',careerType:'신입',dormUse:'확인필요',memo:'기존 메모',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:''},
  {id:'worksheet-test-2',name:'가상지원자2',phone:'010-0000-0002',email:'two@example.invalid',region:'경기',applyDate:'2026-08-02',workplace:'평택',status:'면접예정',interviewDate:'2026-08-10',interviewTime:'10:00',hireDate:'',source:'가상추천',careerType:'경력',dormUse:'출퇴근',memo:'',createdAt:'2026-08-02T00:00:00.000Z',updatedAt:''},
  {id:'worksheet-test-3',name:'가상지원자3',phone:'010-0000-0003',email:'three@example.invalid',region:'서울',applyDate:'2026-08-03',workplace:'천안',status:'서류검토',interviewDate:'',interviewTime:'',hireDate:'',source:'가상채널',careerType:'신입',dormUse:'기숙사',memo:'',createdAt:'2026-08-03T00:00:00.000Z',updatedAt:''}
];
const options={
  workplace:new Set(['','천안','평택','기타']),status:new Set(['','서류검토','면접예정','입사예정']),
  interviewTime:new Set(['','09:00','10:00']),careerType:new Set(['','신입','경력']),dormUse:new Set(['','기숙사','출퇴근','확인필요'])
};

assert.equal(worksheet.VERSION,'11.4.0');
assert.deepEqual(worksheet.COLUMNS.map(column=>column.key),['no','name','phone','email','region','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo']);
assert.deepEqual(worksheet.EDITABLE_FIELDS,['name','phone','email','region','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo']);
assert.equal(worksheet.EDITABLE_FIELDS.length,13);
assert.equal(worksheet.COLUMNS.find(column=>column.key==='no').readonly,true);

const settings=worksheet.sanitizeSettings({
  viewMode:'worksheet',currentWorkplace:'평택',currentFilter:'interview',currentSort:'nameAsc',hideFinished:true,applicantPageSize:100,
  search:'가상지원자1',currentSearch:'010-0000-0001',schoolId:'school-secret',advancedFilterIds:['worksheet-test-1'],applicant:rows[0]
});
assert.deepEqual(Object.keys(settings),['viewMode','currentWorkplace','currentFilter','currentSort','hideFinished','applicantPageSize']);
assert.deepEqual(settings,{viewMode:'worksheet',currentWorkplace:'평택',currentFilter:'interview',currentSort:'nameAsc',hideFinished:true,applicantPageSize:100});
assert.deepEqual(worksheet.sanitizeSettings({viewMode:'broken',currentWorkplace:'외부',currentFilter:'x',currentSort:'x',hideFinished:'yes',applicantPageSize:999}),{viewMode:'normal',currentWorkplace:'all',currentFilter:'all',currentSort:'recent',hideFinished:false,applicantPageSize:30});

assert.equal(worksheet.normalizeValue('name','  가상지원자  '),'가상지원자');
assert.equal(worksheet.normalizeValue('phone','010 1234 5678'),'010-1234-5678');
assert.equal(worksheet.normalizeValue('email','  sample@example.invalid  '),'sample@example.invalid');
assert.equal(worksheet.normalizeValue('region','  충남 천안  '),'충남 천안');
assert.equal(worksheet.looksPhone('010-1234-5678'),true);
assert.equal(worksheet.looksPhone('010-12'),false);
assert.equal(worksheet.looksEmail('sample@example.invalid'),true);
assert.equal(worksheet.looksEmail('bad-email'),false);
assert.deepEqual(worksheet.validateRow({...rows[0],name:'',phone:'',email:'bad-email'},options),{name:'성명은 필수입니다.',phone:'연락처는 필수입니다.',email:'이메일 형식이 올바르지 않습니다.'});
assert.equal(worksheet.escapeHtml('<img src=x onerror=alert(1)>'),'&lt;img src=x onerror=alert(1)&gt;');

assert.deepEqual(worksheet.parseClipboard('가상A\t01012345678\r\n가상B\t01012345679'),[['가상A','01012345678'],['가상B','01012345679']]);
assert.throws(()=>worksheet.parseClipboard('가상A\t01012345678\n가상B'),/직사각형/);
assert.throws(()=>worksheet.preparePaste({matrix:[['1']],startRow:0,startColumn:0,rows,optionMap:options}),/읽기 전용/);
assert.throws(()=>worksheet.preparePaste({matrix:[['가상A'],['가상B'],['가상C'],['가상D']],startRow:0,startColumn:1,rows,optionMap:options}),/행 범위/);
assert.throws(()=>worksheet.preparePaste({matrix:[['면접예정']],startRow:0,startColumn:6,rows,optionMap:options}),/면접일/);
assert.throws(()=>worksheet.preparePaste({matrix:[['2026-07-31']],startRow:0,startColumn:7,rows,optionMap:options}),/지원일/);
assert.throws(()=>worksheet.preparePaste({matrix:[['알수없음']],startRow:0,startColumn:5,rows,optionMap:options}),/목록/);
assert.throws(()=>worksheet.preparePaste({matrix:[['']],startRow:0,startColumn:1,rows,optionMap:options}),/성명/);
assert.throws(()=>worksheet.preparePaste({matrix:[['bad-email']],startRow:0,startColumn:3,rows,optionMap:options}),/이메일/);

const basePaste=worksheet.preparePaste({matrix:[['가상수정','01012345678','edited@example.invalid',' 충북 ']],startRow:0,startColumn:1,rows,optionMap:options});
assert.deepEqual(basePaste.projected[0]&&[basePaste.projected[0].name,basePaste.projected[0].phone,basePaste.projected[0].email,basePaste.projected[0].region],['가상수정','010-1234-5678','edited@example.invalid','충북']);
const processPaste=worksheet.preparePaste({matrix:[['평택','면접예정','2026-08-09','09:00'],['천안','면접예정','2026-08-11','10:00']],startRow:0,startColumn:5,rows,optionMap:options});
assert.equal(processPaste.changes.length,8);
assert.deepEqual(processPaste.projected.slice(0,2).map(row=>[row.workplace,row.status,row.interviewDate,row.interviewTime]),[['평택','면접예정','2026-08-09','09:00'],['천안','면접예정','2026-08-11','10:00']]);
assert.deepEqual(rows.map(row=>row.workplace),['천안','평택','천안'],'붙여넣기 미리보기는 원본 행을 변경하면 안 됩니다.');

const history=worksheet.createHistoryState(),empty=[];
const one=[{id:'worksheet-test-1',field:'region',before:'충남',value:'충북'}];
assert.equal(worksheet.recordHistory(history,empty,one,'단일 셀'),true);
assert.deepEqual(worksheet.undoHistory(history),empty);
assert.deepEqual(worksheet.redoHistory(history),one);
const pasted=[...one,{id:'worksheet-test-1',field:'source',before:'가상채널',value:'가상추천'}];
assert.equal(worksheet.recordHistory(history,one,pasted,'직사각형 붙여넣기'),true);
assert.equal(history.undo.length,2,'직사각형 붙여넣기는 전체 범위를 한 작업으로 기록해야 합니다.');
assert.deepEqual(worksheet.undoHistory(history),one);
assert.equal(history.redo.length,1);
const newEdit=[...one,{id:'worksheet-test-2',field:'memo',before:'',value:'새 작업'}];
assert.equal(worksheet.recordHistory(history,one,newEdit,'새 편집'),true);
assert.equal(history.redo.length,0,'실행 취소 뒤 새 편집을 시작하면 redo 기록이 비워져야 합니다.');

const duplicates=worksheet.findDuplicates(rows,[
  {id:'worksheet-test-1',field:'phone',before:rows[0].phone,value:rows[1].phone},
  {id:'worksheet-test-3',field:'email',before:rows[2].email,value:rows[1].email}
]);
assert.equal(duplicates.some(item=>item.id==='worksheet-test-1'&&item.otherId==='worksheet-test-2'&&item.field==='phone'),true);
assert.equal(duplicates.some(item=>item.id==='worksheet-test-3'&&item.otherId==='worksheet-test-2'&&item.field==='email'),true);
assert.equal(worksheet.findDuplicates(rows,[{id:'worksheet-test-1',field:'phone',before:rows[0].phone,value:rows[0].phone}]).length,0,'자기 자신은 중복 후보에서 제외해야 합니다.');
assert.equal(rows.length,3,'중복 검사는 지원자를 병합하거나 삭제하면 안 됩니다.');

const entries=[
  {id:'worksheet-test-1',field:'name',before:'가상지원자1',value:'가상수정1'},
  {id:'worksheet-test-1',field:'phone',before:'010-0000-0001',value:'010-1234-5678'},
  {id:'worksheet-test-1',field:'region',before:'충남',value:'충북'},
  {id:'worksheet-test-2',field:'source',before:'가상추천',value:'가상채널2'}
];
let normalizeCalls=0;
const applied=worksheet.applyPatches(rows,entries,row=>{normalizeCalls++;return {...row,status:String(row.status||'').trim()};},'2026-08-18T00:00:00.000Z');
assert.equal(normalizeCalls,2,'변경된 지원자만 정규화해야 합니다.');
assert.equal(applied[0].name,'가상수정1');assert.equal(applied[0].phone,'010-1234-5678');assert.equal(applied[0].region,'충북');assert.equal(applied[1].source,'가상채널2');
assert.equal(applied[0].updatedAt,'2026-08-18T00:00:00.000Z');
assert.equal(rows[0].name,'가상지원자1');assert.equal(rows[0].phone,'010-0000-0001');
const blockedUnknown=worksheet.applyPatches(rows,[{id:'worksheet-test-1',field:'notAllowed',before:'',value:'금지값'}],row=>row,'2026-08-18T00:00:00.000Z');
assert.equal(blockedUnknown[0].notAllowed,undefined,'허용목록 밖 필드는 저장 계산에 반영하면 안 됩니다.');

const source=fs.readFileSync(path.join(__dirname,'../js/applicant-worksheet.js'),'utf8');
assert.match(source,/const SETTINGS_KEY='recruit_erp_applicant_worksheet_view_v1'/);
assert.doesNotMatch(source,/shared-storage|residentNumber|Supabase|showDirectoryPicker|FormData/);
assert.match(source,/const saved=typeof root\.save==='function'\?root\.save\(\):false/);
assert.match(source,/applicants=snapshot/);
assert.match(source,/erpPermissions\.has\('applicant\.read'\)/);
assert.match(source,/erpPermissions\.has\('applicant\.write'\)/);
assert.match(source,/btnWorksheetReviewConfirm/);
assert.match(source,/state\.history\.undo/);

console.log('applicant-worksheet.test.js: 13개 열·기본정보 검증·작업 단위 undo/redo·중복·저장 계산·권한 보호 확인 완료');
