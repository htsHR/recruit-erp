'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const worksheet=require('../js/applicant-worksheet.js');

const rows=[
  {id:'worksheet-test-1',name:'가상지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',interviewDate:'',interviewTime:'',hireDate:'',source:'가상채널',careerType:'신입',dormUse:'확인필요',memo:'기존 메모',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:''},
  {id:'worksheet-test-2',name:'가상지원자2',phone:'010-0000-0002',applyDate:'2026-08-02',workplace:'평택',status:'면접예정',interviewDate:'2026-08-10',interviewTime:'10:00',hireDate:'',source:'가상추천',careerType:'경력',dormUse:'출퇴근',memo:'',createdAt:'2026-08-02T00:00:00.000Z',updatedAt:''}
];
const options={
  workplace:new Set(['','천안','평택','기타']),status:new Set(['','서류검토','면접예정','입사예정']),
  interviewTime:new Set(['','09:00','10:00']),careerType:new Set(['','신입','경력']),dormUse:new Set(['','기숙사','출퇴근','확인필요'])
};

assert.equal(worksheet.VERSION,'11.3.1');
assert.deepEqual(worksheet.COLUMNS.map(column=>column.key),['no','name','phone','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo']);
assert.deepEqual(worksheet.EDITABLE_FIELDS,['workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo']);

const settings=worksheet.sanitizeSettings({
  viewMode:'worksheet',currentWorkplace:'평택',currentFilter:'interview',currentSort:'nameAsc',hideFinished:true,applicantPageSize:100,
  search:'가상지원자1',currentSearch:'010-0000-0001',schoolId:'school-secret',advancedFilterIds:['worksheet-test-1'],applicant:rows[0]
});
assert.deepEqual(Object.keys(settings),['viewMode','currentWorkplace','currentFilter','currentSort','hideFinished','applicantPageSize']);
assert.deepEqual(settings,{viewMode:'worksheet',currentWorkplace:'평택',currentFilter:'interview',currentSort:'nameAsc',hideFinished:true,applicantPageSize:100});
assert.deepEqual(worksheet.sanitizeSettings({viewMode:'broken',currentWorkplace:'외부',currentFilter:'x',currentSort:'x',hideFinished:'yes',applicantPageSize:999}),{viewMode:'normal',currentWorkplace:'all',currentFilter:'all',currentSort:'recent',hideFinished:false,applicantPageSize:30});

assert.deepEqual(worksheet.parseClipboard('천안\t서류검토\r\n평택\t면접예정'),[['천안','서류검토'],['평택','면접예정']]);
assert.throws(()=>worksheet.parseClipboard('천안\t서류검토\n평택'),/직사각형/);
assert.throws(()=>worksheet.preparePaste({matrix:[['가상']],startRow:0,startColumn:1,rows,optionMap:options}),/읽기 전용/);
assert.throws(()=>worksheet.preparePaste({matrix:[['천안'],['평택'],['기타']],startRow:0,startColumn:3,rows,optionMap:options}),/행 범위/);
assert.throws(()=>worksheet.preparePaste({matrix:[['면접예정']],startRow:0,startColumn:4,rows,optionMap:options}),/면접일/);
assert.throws(()=>worksheet.preparePaste({matrix:[['2026-07-31']],startRow:0,startColumn:5,rows,optionMap:options}),/지원일/);
assert.throws(()=>worksheet.preparePaste({matrix:[['알수없음']],startRow:0,startColumn:3,rows,optionMap:options}),/목록/);

const paste=worksheet.preparePaste({matrix:[['평택','면접예정','2026-08-09','09:00'],['천안','면접예정','2026-08-11','10:00']],startRow:0,startColumn:3,rows,optionMap:options});
assert.equal(paste.changes.length,8);
assert.deepEqual(paste.projected.map(row=>[row.workplace,row.status,row.interviewDate,row.interviewTime]),[['평택','면접예정','2026-08-09','09:00'],['천안','면접예정','2026-08-11','10:00']]);
assert.deepEqual(rows.map(row=>row.workplace),['천안','평택'],'붙여넣기 미리보기는 원본 행을 변경하면 안 됩니다.');

const entries=[
  {id:'worksheet-test-1',field:'workplace',before:'천안',value:'평택'},
  {id:'worksheet-test-1',field:'memo',before:'기존 메모',value:'변경 메모'},
  {id:'worksheet-test-2',field:'source',before:'가상추천',value:'가상채널2'}
];
let normalizeCalls=0;
const applied=worksheet.applyPatches(rows,entries,row=>{normalizeCalls++;return {...row,status:String(row.status||'').trim()};},'2026-08-18T00:00:00.000Z');
assert.equal(normalizeCalls,2,'변경된 지원자만 정규화해야 합니다.');
assert.equal(applied[0].workplace,'평택');assert.equal(applied[0].memo,'변경 메모');assert.equal(applied[1].source,'가상채널2');
assert.equal(applied[0].name,rows[0].name);assert.equal(applied[0].phone,rows[0].phone);assert.equal(applied[0].updatedAt,'2026-08-18T00:00:00.000Z');
assert.deepEqual(rows[0],{id:'worksheet-test-1',name:'가상지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',interviewDate:'',interviewTime:'',hireDate:'',source:'가상채널',careerType:'신입',dormUse:'확인필요',memo:'기존 메모',createdAt:'2026-08-01T00:00:00.000Z',updatedAt:''},'저장 계산 전 원본은 그대로여야 합니다.');

const source=fs.readFileSync(path.join(__dirname,'../js/applicant-worksheet.js'),'utf8');
assert.match(source,/const SETTINGS_KEY='recruit_erp_applicant_worksheet_view_v1'/);
assert.doesNotMatch(source,/shared-storage|residentNumber|Supabase|showDirectoryPicker|FormData/);
assert.match(source,/const saved=typeof root\.save==='function'\?root\.save\(\):false/);
assert.match(source,/applicants=snapshot/);
assert.match(source,/erpPermissions\.has\('applicant\.read'\)/);
assert.match(source,/erpPermissions\.has\('applicant\.write'\)/);

console.log('applicant-worksheet.test.js: 열·설정 allowlist·직사각형 붙여넣기·검증·저장 계산·권한 보호 확인 완료');
