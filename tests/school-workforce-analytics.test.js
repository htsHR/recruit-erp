'use strict';

const assert=require('node:assert/strict');
const analytics=require('../js/school-workforce-analytics.js');

for(const [raw,family,step] of [
  ['E1','E1',null],['E1-1','E1',1],['E2-2','E2',2],['SE1-1','SE1',1],['SE1-2','SE1',2],['PE2-5','PE2',5]
]){
  assert.deepEqual(analytics.parseRank(raw),{raw,family,step,parsed:true});
}
assert.deepEqual(analytics.parseRank('사원'),{raw:'사원',family:'기타',step:null,parsed:false});
assert.deepEqual(analytics.parseRank(''),{raw:'',family:'미입력',step:null,parsed:false});

assert.equal(analytics.parseWorkbookDate(46023).valid,true);
assert.deepEqual(analytics.parseWorkbookDate('26.02.19'),{value:'2026-02-19',valid:true,blank:false,source:'text'});
assert.equal(analytics.parseWorkbookDate('26.02.19~26.08.31',{periodStart:true}).value,'2026-02-19');
assert.equal(analytics.parseWorkbookDate('2026-02-30').valid,false);

const schools=[
  {id:'school-1',name:'가상대학교',aliases:['가상대']},
  {id:'school-2',name:'샘플전문대',aliases:['샘플대']}
];
assert.equal(analytics.resolveSchoolMatch({incomingSchool:'가상대',schools}).schoolId,'school-1');
assert.equal(analytics.resolveSchoolMatch({currentSchoolId:'school-1',incomingSchool:'샘플전문대',schools}).status,'conflict');

const employees=[
  {id:'employee-1',empNo:'V-001',name:'가상사원1',school:'가상대학교',schoolId:'school-1',hireDate:'2024-01-10',status:'재직중',rank:'E1-1',position:'리더',role:'검사',team:'가상팀',groupName:'가상그룹',product:'가상제품',part:'A',recruitType:'공채',recruitChannel:'학교',education:'대학교',major:'가상학과',gender:'여자',applicantId:'applicant-converted'},
  {id:'employee-2',empNo:'V-002',name:'가상사원2',school:'가상대학교',schoolId:'school-1',hireDate:'2025-02-01',promotionDate:'2026-04-01',status:'휴직',leaveStartDate:'2026-02-01',rank:'SE1-2',position:'담당',role:'설비',team:'가상팀',groupName:'가상그룹',product:'가상제품',part:'B',recruitType:'추천',recruitChannel:'온라인',education:'전문대',major:'샘플학과',gender:'남자'},
  {id:'employee-3',empNo:'V-003',name:'가상사원3',school:'샘플전문대',schoolId:'school-2',hireDate:'2023-03-15',leaveDate:'2025-03-15',status:'퇴사',rank:'PE2-5',position:'매니저',role:'품질',team:'샘플팀',groupName:'샘플그룹',product:'샘플제품',part:'C',recruitType:'경력',recruitChannel:'지인',education:'대학교',major:'품질학과',gender:'여자'}
];
const applicants=[
  {id:'applicant-upcoming',name:'가상예정자',school:'가상대학교',schoolId:'school-1',hireDate:'2026-09-01',status:'입사예정',education:'대학교',major:'가상학과',gender:'여자',source:'학교'},
  {id:'applicant-converted',name:'가상전환자',school:'가상대학교',schoolId:'school-1',hireDate:'2026-09-02',status:'입사예정'},
  {id:'applicant-past',name:'가상지난예정자',school:'가상대학교',schoolId:'school-1',hireDate:'2026-01-01',status:'입사예정'}
];
const profiles=[{applicantId:'applicant-upcoming',employeeNo:'WAIT-001',groupName:'예정그룹',product:'예정제품',part:'예정파트',rank:'E2-2'}];
const built=analytics.buildSchoolWorkforce({employees,applicants,profiles,schools,asOf:'2026-08-05'});
assert.equal(built.employeeRows.filter(row=>row.actualHire).length,3);
assert.equal(built.upcomingRows.length,1);
assert.equal(built.upcomingRows[0].id,'applicant-upcoming');

const schoolOne=analytics.filterSchoolWorkforce(built.rows,{schoolId:'school-1'});
assert.equal(schoolOne.length,3);
assert.deepEqual(analytics.buildSchoolSummary(schoolOne),{total:3,actualHires:2,upcoming:1,active:1,leave:1,retired:0});
assert.equal(analytics.filterSchoolWorkforce(built.rows,{rankFamilies:['E1']}).length,1);
assert.equal(analytics.filterSchoolWorkforce(built.rows,{roles:['검사']}).length,1);
assert.equal(analytics.filterSchoolWorkforce(built.rows,{hireYearFrom:'2025',hireYearTo:'2026'}).length,2);
assert.equal(analytics.filterSchoolWorkforce(built.rows,{leaveDateFrom:'2025-01-01',leaveDateTo:'2025-12-31'}).length,1);
assert.equal(analytics.filterSchoolWorkforce(built.rows,{leaveYearFrom:'2025',leaveYearTo:'2025'}).length,1);
assert.equal(analytics.filterSchoolWorkforce(built.rows,{promotionDateFrom:'2026-01-01',promotionDateTo:'2026-12-31'}).length,1);
assert.equal(analytics.filterSchoolWorkforce(built.rows,{promotionYearFrom:'2026',promotionYearTo:'2026'}).length,1);

const grouped=analytics.groupWorkforceRows(built.rows,'status');
assert.equal(grouped.reduce((sum,row)=>sum+row.count,0),4);
const cross=analytics.buildCrossTab(built.rows,'status','rankFamily');
assert.equal(cross.grandTotal,4);
assert.equal(cross.totalsMatch,true);
assert.equal(cross.rowTotals.reduce((a,b)=>a+b,0),4);
assert.equal(cross.columnTotals.reduce((a,b)=>a+b,0),4);

assert.equal(analytics.safeSpreadsheetText('=1+1'),"'=1+1");
assert.equal(analytics.safeSpreadsheetText('+테스트'),"'+테스트");
assert.equal(analytics.safeSpreadsheetText('일반'),'일반');

console.log('school-workforce-analytics.test.js: all checks passed');
