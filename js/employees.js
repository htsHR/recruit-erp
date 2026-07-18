/* =========================================================
   Recruit ERP v10.40.16 — 사원명부 UI + 상세/등록/수정 최종화
   - 기존 employees/localStorage 구조와 레거시 필드를 그대로 호환
   - 신규 인사 필드는 모두 선택값이며, 기존 데이터에 없어도 정상 동작
   - 주민번호·주소·개인 연락처·개인 이메일은 저장/표시하지 않음
   ========================================================= */
const EMPLOYEE_EXTENDED_FIELDS=[
  'gender','team','groupName','product','part','rank','position','promotionDate',
  'recruitType','recruitChannel','education','major','leaveStartDate','returnDate','applicantId'
];
const EMPLOYEE_CLOUD_FIELDS=[
  'id','empNo','name','department','role','school','schoolId','hireDate','leaveDate','status',
  'disciplineCount','notes','createdAt','updatedAt',...EMPLOYEE_EXTENDED_FIELDS
];
const EMPLOYEE_LEGACY_CLOUD_FIELDS=[
  'id','empNo','name','department','role','school','schoolId','hireDate','leaveDate','status',
  'disciplineCount','notes','createdAt','updatedAt'
];
let employeeExtendedCloudUnsupported=false;

function normalizeEmployeeStatus(value, leaveDate=''){
  const raw=String(value||'').trim();
  if(['재직','재직자','재직중'].includes(raw)) return '재직중';
  if(['휴직','휴직자'].includes(raw)) return '휴직';
  if(['퇴직','퇴직자','퇴사'].includes(raw)) return '퇴사';
  if(['입사예정','입사예정자'].includes(raw)) return '입사예정';
  return leaveDate ? '퇴사' : '재직중';
}
function normalizeEmployee(e={}){
  const school=String(e.school||'').trim();
  const team=String(e.team||e.department||'').trim();
  const position=String(e.position||e.role||'').trim();
  const groupName=String(e.groupName||e.group||'').trim();
  const status=normalizeEmployeeStatus(e.status,e.leaveDate);
  return {
    ...e,
    id:e.id||uid(),
    empNo:String(e.empNo||'').trim(),
    name:String(e.name||'').trim(),
    gender:String(e.gender||'').trim(),
    department:String(e.department||team||'').trim(),
    role:String(e.role||position||'').trim(),
    team,
    groupName,
    product:String(e.product||'').trim(),
    part:String(e.part||'').trim(),
    rank:String(e.rank||'').trim(),
    position,
    school,
    schoolId:(e.schoolId!==undefined&&e.schoolId!==null&&e.schoolId!=='')?e.schoolId:resolveSchoolId(school),
    education:String(e.education||'').trim(),
    major:String(e.major||'').trim(),
    hireDate:String(e.hireDate||'').trim(),
    leaveDate:String(e.leaveDate||'').trim(),
    leaveStartDate:String(e.leaveStartDate||'').trim(),
    returnDate:String(e.returnDate||'').trim(),
    promotionDate:String(e.promotionDate||'').trim(),
    status,
    recruitType:String(e.recruitType||'').trim(),
    recruitChannel:String(e.recruitChannel||'').trim(),
    applicantId:String(e.applicantId||'').trim(),
    disciplineCount:Number.isFinite(e.disciplineCount)?e.disciplineCount:(parseInt(e.disciplineCount,10)||0),
    notes:String(e.notes||'').trim(),
    createdAt:e.createdAt||new Date().toISOString(),
    updatedAt:e.updatedAt||''
  };
}
function loadEmployees(){
  try{
    const raw=localStorage.getItem(EMPLOYEES_KEY);
    const data=raw?JSON.parse(raw):[];
    return Array.isArray(data)?data.map(normalizeEmployee):[];
  }catch(e){console.error('직원명부 load error',e);return[];}
}
function employeeCloudRow(employee,legacy=false){
  const normalized=normalizeEmployee(employee);
  const fields=legacy?EMPLOYEE_LEGACY_CLOUD_FIELDS:EMPLOYEE_CLOUD_FIELDS;
  return fields.reduce((row,key)=>{row[key]=normalized[key]??'';return row;},{});
}
function saveEmployees(syncList){
  localStorage.setItem(EMPLOYEES_KEY,JSON.stringify(employees));
  supabaseSyncEmployees(Array.isArray(syncList)?syncList:employees);
  renderEmployees();
  renderSchools();
}
function supabaseSyncEmployees(list){
  if(!canUseCloud()) return Promise.resolve({skipped:true,count:0});
  const targets=Array.isArray(list)?list.filter(Boolean):[];
  if(!targets.length) return Promise.resolve({skipped:true,count:0});
  const CHUNK_SIZE=250;
  return (async function(){
    let useLegacy=employeeExtendedCloudUnsupported,saved=0;
    for(let start=0;start<targets.length;start+=CHUNK_SIZE){
      const chunk=targets.slice(start,start+CHUNK_SIZE);
      let res=await window.sb.from('employees').upsert(chunk.map(e=>employeeCloudRow(e,useLegacy)));
      if(res&&res.error&&!useLegacy){
        employeeExtendedCloudUnsupported=true;useLegacy=true;
        console.warn('사원 확장필드용 Supabase 컬럼이 없어 기존 필드만 클라우드에 저장합니다. v10.40.13 마이그레이션 SQL 실행 후 새로고침하면 확장필드도 동기화됩니다.',res.error.message);
        res=await window.sb.from('employees').upsert(chunk.map(e=>employeeCloudRow(e,true)));
      }
      if(res&&res.error) throw new Error(res.error.message||'사원명부 Supabase 저장 실패');
      saved+=chunk.length;
    }
    return {saved,count:targets.length,legacy:useLegacy};
  })().catch(function(e){console.warn('직원명부 Supabase 저장 실패(로컬에는 정상 저장됨):',e);return {error:e,count:targets.length};});
}
function supabaseDeleteEmployee(id){
  if(!canUseCloud()) return;
  window.sb.from('employees').delete().eq('id',id).then(function(res){
    if(res&&res.error) console.warn('직원명부 삭제 실패(로컬에는 정상 삭제됨):',res.error.message);
  }).catch(function(e){console.warn('직원명부 삭제 실패(로컬에는 정상 삭제됨):',e);});
}
function supabaseEmployeesSyncOnLoad(){
  if(!canUseCloud()) return;
  const PAGE_SIZE=500;
  function loadPage(from,collected){
    return window.sb.from('employees').select('*').order('id',{ascending:true}).range(from,from+PAGE_SIZE-1).then(function(res){
      if(res&&res.error) throw new Error(res.error.message);
      const rows=(res&&res.data)?res.data:[];
      const merged=collected.concat(rows);
      return rows.length<PAGE_SIZE?merged:loadPage(from+PAGE_SIZE,merged);
    });
  }
  loadPage(0,[]).then(function(cloudRaw){
    const cloud=cloudRaw.map(normalizeEmployee),map={};
    employees.forEach(e=>{map[e.id]=e;});
    cloud.forEach(c=>{
      const l=map[c.id];
      if(!l){map[c.id]=c;return;}
      const lt=l.updatedAt||l.createdAt||'',ct=c.updatedAt||c.createdAt||'';
      map[c.id]=(ct>lt)?c:l;
    });
    employees=Object.keys(map).map(k=>normalizeEmployee(map[k]));
    localStorage.setItem(EMPLOYEES_KEY,JSON.stringify(employees));
    renderEmployees();
    console.info('직원명부 Supabase 페이지 조회 완료: 클라우드 '+cloud.length+'명 -> 병합 후 '+employees.length+'명');
  }).catch(function(e){console.warn('직원명부 페이지 조회 중 실패 — 기존 로컬 데이터 유지:',e);});
}

let employeeStatusFilter='all';
let employeeSearchName='';
let employeeSearchNo='';
let employeeTeamFilter='all';
let employeeGroupFilter='all';
let employeeProductFilter='all';
let employeePartFilter='all';
let employeeRankFilter='all';
let employeeSchoolSearch='';
let employeeHireFrom='';
let employeeHireTo='';
let employeePage=1;
let employeePageSize=20;
let employeeViewMode='list';
const EMPLOYEE_SAVED_FILTERS_KEY='recruit_erp_employee_saved_filters_v1';

function employeeFieldValue(id){return ($(id)?.value||'').trim();}
function getEmployeeForm(){
  const team=employeeFieldValue('empTeam');
  const position=employeeFieldValue('empPosition');
  return {
    empNo:employeeFieldValue('empNo'),
    name:employeeFieldValue('empName'),
    gender:employeeFieldValue('empGender'),
    status:employeeFieldValue('empStatus')||'재직중',
    hireDate:$('empHireDate')?.value||'',
    leaveDate:$('empLeaveDate')?.value||'',
    leaveStartDate:$('empLeaveStartDate')?.value||'',
    returnDate:$('empReturnDate')?.value||'',
    team,
    department:team,
    groupName:employeeFieldValue('empGroup'),
    product:employeeFieldValue('empProduct'),
    part:employeeFieldValue('empPart'),
    rank:employeeFieldValue('empRank'),
    position,
    role:position,
    promotionDate:$('empPromotionDate')?.value||'',
    recruitType:employeeFieldValue('empRecruitType'),
    recruitChannel:employeeFieldValue('empRecruitChannel'),
    applicantId:$('empApplicantId')?.value||'',
    education:employeeFieldValue('empEducation'),
    school:employeeFieldValue('empSchool'),
    major:employeeFieldValue('empMajor'),
    disciplineCount:parseInt($('empDisciplineCount')?.value||'0',10)||0,
    notes:employeeFieldValue('empNotes')
  };
}
function employeeFormIds(){
  return ['empNo','empName','empGender','empHireDate','empLeaveDate','empLeaveStartDate','empReturnDate','empTeam','empGroup','empProduct','empPart','empRank','empPosition','empPromotionDate','empRecruitType','empRecruitChannel','empEducation','empSchool','empMajor','empDisciplineCount','empNotes'];
}
function populateEmployeeApplicantOptions(selected=''){
  const sel=$('empApplicantId');
  if(!sel) return;
  const list=(typeof applicants!=='undefined'&&Array.isArray(applicants))?applicants.slice():[];
  list.sort((a,b)=>(b.applyDate||'').localeCompare(a.applyDate||''));
  sel.innerHTML='<option value="">연결 안 함</option>'+list.map(a=>{
    const label=[a.name,a.phone,a.workplace,a.applyDate].filter(Boolean).join(' · ');
    return `<option value="${esc(a.id)}">${esc(label)}</option>`;
  }).join('');
  sel.value=selected&&list.some(a=>a.id===selected)?selected:'';
}
function updateEmployeeFormMode(){
  const editing=!!editingEmployeeId;
  if($('btnAddEmployee')) $('btnAddEmployee').textContent=editing?'수정 저장':'사원 저장';
  if($('btnCancelEmployeeEdit')) $('btnCancelEmployeeEdit').hidden=!editing;
  if($('employeeDangerZone')) $('employeeDangerZone').hidden=!editing;
  if($('employeeFormModeLabel')) $('employeeFormModeLabel').textContent=editing?'기존 사원 수정':'신규 사원 등록';
}
function resetEmployeeForm(){
  editingEmployeeId='';
  employeeFormIds().forEach(id=>{if($(id))$(id).value='';});
  if($('empStatus')) $('empStatus').value='재직중';
  if($('empApplicantId')) populateEmployeeApplicantOptions('');
  if($('employeeUpdatedAtLabel')) $('employeeUpdatedAtLabel').textContent='신규 등록 시 기록됩니다.';
  updateEmployeeFormMode();
}
function fillEmployeeForm(e){
  editingEmployeeId=e.id;
  const values={
    empNo:e.empNo,empName:e.name,empGender:e.gender,empHireDate:e.hireDate,empLeaveDate:e.leaveDate,
    empLeaveStartDate:e.leaveStartDate,empReturnDate:e.returnDate,empTeam:e.team||e.department,
    empGroup:e.groupName,empProduct:e.product,empPart:e.part,empRank:e.rank,empPosition:e.position||e.role,
    empPromotionDate:e.promotionDate,empRecruitType:e.recruitType,empRecruitChannel:e.recruitChannel,
    empEducation:e.education,empSchool:e.school,empMajor:e.major,empDisciplineCount:e.disciplineCount||0,empNotes:e.notes
  };
  Object.keys(values).forEach(id=>{if($(id))$(id).value=values[id]??'';});
  if($('empStatus')) $('empStatus').value=e.status||'재직중';
  populateEmployeeApplicantOptions(e.applicantId||'');
  if($('employeeUpdatedAtLabel')) $('employeeUpdatedAtLabel').textContent=formatEmployeeDateTime(e.updatedAt||e.createdAt)||'-';
  updateEmployeeFormMode();
}
function validateEmployeeForm(f){
  if(!f.name){alert('성명을 입력해주세요.');return false;}
  if(f.empNo&&employees.some(e=>e.empNo===f.empNo&&e.id!==editingEmployeeId)){alert('이미 등록된 사번입니다. 기존 사원을 확인해주세요.');return false;}
  if(f.hireDate&&f.leaveDate&&f.leaveDate<f.hireDate){alert('퇴사일은 입사일보다 빠를 수 없습니다.');return false;}
  if(f.leaveStartDate&&f.returnDate&&f.returnDate<f.leaveStartDate){alert('복직일은 휴직일보다 빠를 수 없습니다.');return false;}
  if(f.status==='퇴사'&&!f.leaveDate){alert('퇴직 상태는 퇴사일을 입력해야 합니다.');return false;}
  if(f.status==='휴직'&&!f.leaveStartDate){alert('휴직 상태는 휴직일을 입력해야 합니다.');return false;}
  return true;
}
function submitEmployeeForm(){
  const f=getEmployeeForm();
  if(!validateEmployeeForm(f)) return;
  const now=new Date().toISOString();
  if(editingEmployeeId){
    employees=employees.map(e=>e.id===editingEmployeeId?normalizeEmployee({...e,...f,id:editingEmployeeId,updatedAt:now}):e);
  }else{
    employees.unshift(normalizeEmployee({...f,id:uid(),createdAt:now,updatedAt:now}));
  }
  resetEmployeeForm();
  const detail=$('employeeEntryDetails');if(detail)detail.open=false;
  saveEmployees();
}
function editEmployeePrompt(id){
  const e=employees.find(x=>x.id===id);if(!e)return;
  fillEmployeeForm(e);
  const detail=$('employeeEntryDetails');
  if(detail){detail.open=true;detail.scrollIntoView({behavior:'smooth',block:'start'});}
  setTimeout(()=>$('empName')?.focus(),250);
}
function deleteEmployee(id){
  const e=employees.find(x=>x.id===id);if(!e)return;
  if(!confirm(`"${e.name}" 사원 기록을 삭제할까요?\n\n목록에서는 삭제할 수 없으며, 현재 수정 중인 사원만 삭제됩니다.`))return;
  const phrase=prompt('삭제하려면 사원명을 그대로 입력하세요.',e.name);
  if(phrase!==e.name){alert('삭제가 취소됐습니다.');return;}
  employees=employees.filter(x=>x.id!==id);
  supabaseDeleteEmployee(id);
  resetEmployeeForm();
  saveEmployees();
}
function deleteEditingEmployee(){if(editingEmployeeId)deleteEmployee(editingEmployeeId);}

function employeeOrgPrimary(e){return e.team||e.department||'소속 미입력';}
function employeeOrgSecondary(e){return [e.groupName,e.product,e.part].filter(Boolean).join(' · ');}
function employeeRankDisplay(e){return e.rank||e.position||e.role||'-';}
function employeeUniqueValues(rows,getter){
  return Array.from(new Set((Array.isArray(rows)?rows:[]).map(getter).map(v=>String(v||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ko'));
}
function employeeRankList(){return employeeUniqueValues(employees,employeeRankDisplay).filter(x=>x!=='-');}
function employeeStatusBadgeClass(status){
  if(status==='재직중')return'good';
  if(status==='휴직')return'missed';
  if(status==='입사예정')return'info';
  return'bad';
}
function employeeMatchesFilter(e){
  if(employeeStatusFilter!=='all'&&e.status!==employeeStatusFilter)return false;
  if(employeeSearchName&&!e.name.toLowerCase().includes(employeeSearchName.toLowerCase()))return false;
  if(employeeSearchNo&&!e.empNo.toLowerCase().includes(employeeSearchNo.toLowerCase()))return false;
  if(employeeTeamFilter!=='all'&&employeeOrgPrimary(e)!==employeeTeamFilter)return false;
  if(employeeGroupFilter!=='all'&&e.groupName!==employeeGroupFilter)return false;
  if(employeeProductFilter!=='all'&&e.product!==employeeProductFilter)return false;
  if(employeePartFilter!=='all'&&e.part!==employeePartFilter)return false;
  if(employeeRankFilter!=='all'&&employeeRankDisplay(e)!==employeeRankFilter)return false;
  if(employeeHireFrom&&(!e.hireDate||e.hireDate<employeeHireFrom))return false;
  if(employeeHireTo&&(!e.hireDate||e.hireDate>employeeHireTo))return false;
  if(employeeSchoolSearch){
    const term=employeeSchoolSearch.toLowerCase();
    const textMatch=(e.school||'').toLowerCase().includes(term);
    const matchedSchool=findSchoolByText(employeeSchoolSearch);
    const aliasMatch=matchedSchool&&e.schoolId===matchedSchool.id;
    if(!textMatch&&!aliasMatch)return false;
  }
  return true;
}
function employeeSetSelectOptions(id,values,desired){
  const sel=$(id);if(!sel)return'all';
  const clean=employeeUniqueValues(values,v=>v);
  const target=desired&&clean.includes(desired)?desired:'all';
  sel.innerHTML='<option value="all">전체</option>'+clean.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value=target;
  return target;
}
function employeeFilterDomValue(id,fallback='all'){
  const el=$(id);return el?(el.value||'all'):(fallback||'all');
}
function populateEmployeeSavedFilterOptions(){
  const sel=$('empSavedFilterSelect');if(!sel)return;
  const current=sel.value;
  const items=readEmployeeSavedFilters();
  sel.innerHTML='<option value="">저장된 조건 선택</option>'+items.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
  if(items.some(item=>item.id===current))sel.value=current;
}
function populateEmployeeFilterOptions(){
  let team=employeeFilterDomValue('empTeamFilter',employeeTeamFilter);
  let groupName=employeeFilterDomValue('empGroupFilter',employeeGroupFilter);
  let product=employeeFilterDomValue('empProductFilter',employeeProductFilter);
  let part=employeeFilterDomValue('empPartFilter',employeePartFilter);

  team=employeeSetSelectOptions('empTeamFilter',employeeUniqueValues(employees,employeeOrgPrimary).filter(x=>x!=='소속 미입력'),team);
  const groupRows=employees.filter(e=>team==='all'||employeeOrgPrimary(e)===team);
  groupName=employeeSetSelectOptions('empGroupFilter',employeeUniqueValues(groupRows,e=>e.groupName),groupName);
  const productRows=groupRows.filter(e=>groupName==='all'||e.groupName===groupName);
  product=employeeSetSelectOptions('empProductFilter',employeeUniqueValues(productRows,e=>e.product),product);
  const partRows=productRows.filter(e=>product==='all'||e.product===product);
  part=employeeSetSelectOptions('empPartFilter',employeeUniqueValues(partRows,e=>e.part),part);

  const rankSel=$('empRankFilter');
  if(rankSel){
    const desired=rankSel.value||employeeRankFilter;
    employeeSetSelectOptions('empRankFilter',employeeRankList(),desired);
  }
  if($('empStatusFilter'))$('empStatusFilter').value=employeeStatusFilter;
  populateEmployeeSavedFilterOptions();
}
function handleEmployeeOrgFilterChange(level){
  if(level==='team'){
    if($('empGroupFilter'))$('empGroupFilter').value='all';
    if($('empProductFilter'))$('empProductFilter').value='all';
    if($('empPartFilter'))$('empPartFilter').value='all';
  }else if(level==='group'){
    if($('empProductFilter'))$('empProductFilter').value='all';
    if($('empPartFilter'))$('empPartFilter').value='all';
  }else if(level==='product'){
    if($('empPartFilter'))$('empPartFilter').value='all';
  }
  populateEmployeeFilterOptions();
  renderEmployeeOrgFilterPreview();
}
function employeeFilterFormValues(){
  return {
    searchName:employeeFieldValue('empSearchName'),
    searchNo:employeeFieldValue('empSearchNo'),
    team:$('empTeamFilter')?.value||'all',
    groupName:$('empGroupFilter')?.value||'all',
    product:$('empProductFilter')?.value||'all',
    part:$('empPartFilter')?.value||'all',
    rank:$('empRankFilter')?.value||'all',
    status:$('empStatusFilter')?.value||'all',
    school:employeeFieldValue('empSearchSchool'),
    hireFrom:$('empHireFrom')?.value||'',
    hireTo:$('empHireTo')?.value||''
  };
}
function applyEmployeeSearch(){
  const values=employeeFilterFormValues();
  employeeSearchName=values.searchName;
  employeeSearchNo=values.searchNo;
  employeeTeamFilter=values.team;
  employeeGroupFilter=values.groupName;
  employeeProductFilter=values.product;
  employeePartFilter=values.part;
  employeeRankFilter=values.rank;
  employeeStatusFilter=values.status||employeeStatusFilter||'all';
  employeeSchoolSearch=values.school;
  employeeHireFrom=values.hireFrom;
  employeeHireTo=values.hireTo;
  employeePage=1;renderEmployees();
}
function resetEmployeeFilters(){
  employeeStatusFilter='all';employeeSearchName='';employeeSearchNo='';employeeTeamFilter='all';employeeGroupFilter='all';employeeProductFilter='all';employeePartFilter='all';employeeRankFilter='all';employeeSchoolSearch='';employeeHireFrom='';employeeHireTo='';employeePage=1;
  ['empSearchName','empSearchNo','empSearchSchool','empHireFrom','empHireTo'].forEach(id=>{if($(id))$(id).value='';});
  ['empTeamFilter','empGroupFilter','empProductFilter','empPartFilter','empRankFilter','empStatusFilter'].forEach(id=>{if($(id))$(id).value='all';});
  renderEmployees();
}
function setEmployeeStatusFilter(status){
  employeeStatusFilter=status||'all';employeePage=1;
  if($('empStatusFilter'))$('empStatusFilter').value=employeeStatusFilter;
  renderEmployees();
}
function readEmployeeSavedFilters(){
  try{
    const data=JSON.parse(localStorage.getItem(EMPLOYEE_SAVED_FILTERS_KEY)||'[]');
    return Array.isArray(data)?data.filter(x=>x&&x.id&&x.name&&x.filters):[];
  }catch{return[];}
}
function writeEmployeeSavedFilters(items){
  localStorage.setItem(EMPLOYEE_SAVED_FILTERS_KEY,JSON.stringify((Array.isArray(items)?items:[]).slice(0,12)));
  populateEmployeeSavedFilterOptions();
}
function saveEmployeeCurrentFilter(){
  const filters=employeeFilterFormValues();
  const meaningful=Object.entries(filters).some(([key,value])=>!['team','groupName','product','part','rank','status'].includes(key)?!!value:value!=='all');
  if(!meaningful){alert('저장할 검색 또는 필터 조건이 없습니다.');return;}
  const raw=prompt('저장할 조건 이름을 입력하세요.','자주 쓰는 조직 조건');
  const name=String(raw||'').trim();if(!name)return;
  const items=readEmployeeSavedFilters();
  const existing=items.find(x=>x.name===name);
  const item={id:existing?existing.id:`emp-filter-${Date.now()}`,name,filters,updatedAt:new Date().toISOString()};
  const next=[item,...items.filter(x=>x.id!==item.id)];
  writeEmployeeSavedFilters(next);
  if($('empSavedFilterSelect'))$('empSavedFilterSelect').value=item.id;
  if(typeof uxToast==='function')uxToast(`사원명부 조건 "${name}"을 저장했습니다.`);
}
function applyEmployeeSavedFilter(){
  const id=$('empSavedFilterSelect')?.value||'';
  const item=readEmployeeSavedFilters().find(x=>x.id===id);
  if(!item){alert('불러올 저장 조건을 선택해주세요.');return;}
  const f=item.filters||{};
  if($('empSearchName'))$('empSearchName').value=f.searchName||'';
  if($('empSearchNo'))$('empSearchNo').value=f.searchNo||'';
  if($('empSearchSchool'))$('empSearchSchool').value=f.school||'';
  if($('empHireFrom'))$('empHireFrom').value=f.hireFrom||'';
  if($('empHireTo'))$('empHireTo').value=f.hireTo||'';
  if($('empStatusFilter'))$('empStatusFilter').value=f.status||'all';
  if($('empRankFilter'))$('empRankFilter').value=f.rank||'all';

  populateEmployeeFilterOptions();
  if($('empTeamFilter'))$('empTeamFilter').value=f.team||'all';
  populateEmployeeFilterOptions();
  if($('empGroupFilter'))$('empGroupFilter').value=f.groupName||'all';
  populateEmployeeFilterOptions();
  if($('empProductFilter'))$('empProductFilter').value=f.product||'all';
  populateEmployeeFilterOptions();
  if($('empPartFilter'))$('empPartFilter').value=f.part||'all';
  applyEmployeeSearch();
}
function deleteEmployeeSavedFilter(){
  const id=$('empSavedFilterSelect')?.value||'';
  const items=readEmployeeSavedFilters();
  const item=items.find(x=>x.id===id);
  if(!item){alert('삭제할 저장 조건을 선택해주세요.');return;}
  if(!confirm(`저장된 조건 "${item.name}"을 삭제할까요?`))return;
  writeEmployeeSavedFilters(items.filter(x=>x.id!==id));
}
function renderEmployeeOrgFilterPreview(filteredRows){
  const el=$('employeeOrgFilterSummary');if(!el)return;
  const rows=Array.isArray(filteredRows)?filteredRows:employees.filter(e=>{
    const team=$('empTeamFilter')?.value||'all';
    const groupName=$('empGroupFilter')?.value||'all';
    const product=$('empProductFilter')?.value||'all';
    const part=$('empPartFilter')?.value||'all';
    return (team==='all'||employeeOrgPrimary(e)===team)
      &&(groupName==='all'||e.groupName===groupName)
      &&(product==='all'||e.product===product)
      &&(part==='all'||e.part===part);
  });
  const count=(getter)=>employeeUniqueValues(rows,getter).length;
  el.innerHTML=`<span class="is-result">현재 결과 <strong>${rows.length}명</strong></span><span>팀 <strong>${count(employeeOrgPrimary)}</strong></span><span>그룹 <strong>${count(e=>e.groupName)}</strong></span><span>제품 <strong>${count(e=>e.product)}</strong></span><span>파트 <strong>${count(e=>e.part)}</strong></span>`;
}
function goEmployeePage(p){employeePage=p;renderEmployees();}
function renderEmployeePagination(totalPages,totalCount){
  const el=$('employeePagination');if(!el)return;
  setText('employeePaginationCount',totalCount);
  if(totalPages<=1){el.innerHTML='';return;}
  let start=Math.max(1,employeePage-2),end=Math.min(totalPages,start+4);start=Math.max(1,end-4);
  let html=`<button class="mini" ${employeePage===1?'disabled':''} onclick="goEmployeePage(1)">«</button>`;
  html+=`<button class="mini" ${employeePage===1?'disabled':''} onclick="goEmployeePage(${employeePage-1})">‹</button>`;
  for(let p=start;p<=end;p++)html+=`<button class="mini ${p===employeePage?'active':''}" onclick="goEmployeePage(${p})">${p}</button>`;
  html+=`<button class="mini" ${employeePage===totalPages?'disabled':''} onclick="goEmployeePage(${employeePage+1})">›</button>`;
  html+=`<button class="mini" ${employeePage===totalPages?'disabled':''} onclick="goEmployeePage(${totalPages})">»</button>`;
  el.innerHTML=html;
}
function parseEmployeeDate(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));return Number.isNaN(d.getTime())?null:d;
}
function employeeTenureText(e){
  const start=parseEmployeeDate(e.hireDate);if(!start)return'-';
  const end=parseEmployeeDate(e.leaveDate)||new Date();
  let months=(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth());
  if(end.getDate()<start.getDate())months--;
  if(months<0)return'-';
  const years=Math.floor(months/12),rest=months%12;
  if(years&&rest)return`${years}년 ${rest}개월`;
  if(years)return`${years}년`;
  return`${rest}개월`;
}
function formatEmployeeDateTime(value){
  if(!value)return'';
  const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function csvEmployees(){
  const headers=['사번','성명','성별','재직상태','팀','그룹','제품','파트','직급','직책','입사일','퇴사일','휴직일','복직일','승격일','입사경위','채용채널','최종학력','출신학교','전공','상벌건수','비고','최근수정일'];
  const lines=[headers,...employees.map(e=>[e.empNo,e.name,e.gender,e.status,e.team||e.department,e.groupName,e.product,e.part,e.rank,e.position||e.role,e.hireDate,e.leaveDate,e.leaveStartDate,e.returnDate,e.promotionDate,e.recruitType,e.recruitChannel,e.education,e.school,e.major,e.disciplineCount,e.notes,e.updatedAt])]
    .map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`사원명부_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function employeeDeptAggregates(){
  const map={};
  employees.forEach(e=>{
    const dept=employeeOrgPrimary(e);
    if(!map[dept])map[dept]={dept,total:0,active:0,leave:0,left:0,upcoming:0};
    map[dept].total++;
    if(e.status==='재직중')map[dept].active++;
    if(e.status==='휴직')map[dept].leave++;
    if(e.status==='퇴사')map[dept].left++;
    if(e.status==='입사예정')map[dept].upcoming++;
  });
  return Object.values(map).sort((a,b)=>b.total-a.total||a.dept.localeCompare(b.dept));
}
function renderEmployeeDeptView(){
  const body=$('employeeDeptBody');if(!body)return;
  const rows=employeeDeptAggregates();
  if(!rows.length){body.innerHTML='<tr><td colspan="6" class="empty">등록된 사원이 없습니다.</td></tr>';return;}
  body.innerHTML=rows.map(d=>`<tr><td>${esc(d.dept)}</td><td>${d.total}명</td><td>${d.active}명</td><td>${d.leave}명</td><td>${d.left}명</td><td>${d.upcoming}명</td></tr>`).join('');
}
function toggleRowMore(event,button){
  event.preventDefault();event.stopPropagation();
  const menu=button.closest('.row-more-menu');if(!menu)return;
  const panel=menu.querySelector('.row-more-menu-panel'),willOpen=!menu.classList.contains('open');
  closeAllRowMoreMenus();if(!willOpen||!panel)return;
  menu.classList.add('open');
  const rect=button.getBoundingClientRect(),panelWidth=120,estimatedHeight=122;
  let left=Math.min(window.innerWidth-panelWidth-12,Math.max(12,rect.right-panelWidth)),top=rect.bottom+6;
  if(top+estimatedHeight>window.innerHeight-12)top=Math.max(12,rect.top-estimatedHeight-6);
  panel.style.left=`${left}px`;panel.style.top=`${top}px`;panel.style.right='auto';
}
function closeAllRowMoreMenus(){
  document.querySelectorAll('.row-more-menu.open').forEach(x=>{x.classList.remove('open');const panel=x.querySelector('.row-more-menu-panel');if(panel){panel.style.left='';panel.style.top='';panel.style.right='';}});
}
function listRowKeyActivate(event,action){
  if(event.key!=='Enter'&&event.key!==' ')return;
  if(event.target.closest('button,select,a,input,label,summary,details'))return;
  event.preventDefault();action();
}
function updateEmployeeStatusTabCounts(){
  const labels={all:'전체',재직중:'재직자',휴직:'휴직',퇴사:'퇴직자',입사예정:'입사예정자'};
  document.querySelectorAll('#employeeStatusTabs [data-empstatus]').forEach(btn=>{
    const key=btn.dataset.empstatus,count=key==='all'?employees.length:employees.filter(e=>e.status===key).length;
    btn.innerHTML=`<span>${labels[key]||key}</span><small class="tab-count">${count}</small>`;
    btn.classList.toggle('active',key===employeeStatusFilter);
  });
  document.querySelectorAll('[data-employee-summary-status]').forEach(card=>card.classList.toggle('active',card.dataset.employeeSummaryStatus===employeeStatusFilter));
}
function renderEmployees(){
  const body=$('employeesBody');if(!body)return;
  populateEmployeeFilterOptions();updateEmployeeStatusTabCounts();populateEmployeeApplicantOptions($('empApplicantId')?.value||'');
  const all=employees.filter(employeeMatchesFilter).sort((a,b)=>(b.hireDate||'').localeCompare(a.hireDate||'')||(a.empNo||'').localeCompare(b.empNo||''));
  setText('employeesTotalCount',employees.length);
  setText('employeesActiveCount',employees.filter(e=>e.status==='재직중').length);
  setText('employeesLeaveCount',employees.filter(e=>e.status==='휴직').length);
  setText('employeesLeftCount',employees.filter(e=>e.status==='퇴사').length);
  setText('employeesUpcomingCount',employees.filter(e=>e.status==='입사예정').length);
  const activeFilterCount=[employeeStatusFilter!=='all',employeeSearchName,employeeSearchNo,employeeTeamFilter!=='all',employeeGroupFilter!=='all',employeeProductFilter!=='all',employeePartFilter!=='all',employeeRankFilter!=='all',employeeSchoolSearch,employeeHireFrom,employeeHireTo].filter(Boolean).length;
  setText('employeeListSummary',activeFilterCount?`${all.length}명 / 전체 ${employees.length}명`:`${all.length}명 표시`);
  renderEmployeeOrgFilterPreview(all);
  const totalPages=Math.max(1,Math.ceil(all.length/employeePageSize));if(employeePage>totalPages)employeePage=totalPages;
  const rows=all.slice((employeePage-1)*employeePageSize,employeePage*employeePageSize);
  renderEmployeePagination(totalPages,all.length);renderEmployeeDeptView();
  if(!all.length){body.innerHTML='<tr><td colspan="9" class="empty employee-empty-state"><strong>조건에 맞는 사원이 없습니다.</strong><span>검색어 또는 필터를 바꿔주세요.</span><button class="ghost" onclick="resetEmployeeFilters()">검색조건 초기화</button></td></tr>';return;}
  body.innerHTML=rows.map(e=>{
    const secondary=employeeOrgSecondary(e);
    const rankSub=e.position&&e.position!==e.rank?e.position:(e.role&&e.role!==e.rank?e.role:'');
    return `<tr class="employee-list-row clickable-data-row" tabindex="0" onclick="if(!event.target.closest('button,select,a,input,label,summary,details')) openEmployeeDetail('${e.id}')" onkeydown="listRowKeyActivate(event,()=>openEmployeeDetail('${e.id}'))">
      <td class="employee-no-cell" data-label="사번">${esc(e.empNo)||'-'}</td>
      <td class="employee-name-cell" data-label="성명"><button class="link-like employee-name-link" onclick="openEmployeeDetail('${e.id}')">${esc(e.name)}</button><small>${esc(e.gender||'성별 미입력')}</small></td>
      <td class="employee-org-cell" data-label="소속"><strong>${esc(employeeOrgPrimary(e))}</strong>${secondary?`<small>${esc(secondary)}</small>`:''}</td>
      <td class="employee-rank-cell" data-label="직급"><strong>${esc(employeeRankDisplay(e))}</strong>${rankSub?`<small>${esc(rankSub)}</small>`:''}</td>
      <td class="employee-hire-cell" data-label="입사일">${esc(e.hireDate)||'-'}</td>
      <td class="employee-tenure-cell" data-label="근속기간">${esc(employeeTenureText(e))}</td>
      <td class="employee-school-cell" data-label="출신학교">${esc(e.school)||'<span class="muted">미입력</span>'}</td>
      <td class="employee-status-cell" data-label="재직상태"><span class="badge ${employeeStatusBadgeClass(e.status)}">${esc(e.status)}</span></td>
      <td class="row-actions employee-row-actions" data-label="관리"><button class="view" onclick="openEmployeeDetail('${e.id}')">상세</button><button onclick="editEmployeePrompt('${e.id}')">수정</button></td>
    </tr>`;
  }).join('');
}
function importEmployeesJson(list){
  if(!Array.isArray(list)||!list.length){alert('직원명부 JSON 형식이 아니거나 비어 있습니다.');return;}
  const byEmpNo={};employees.forEach(e=>{if(e.empNo)byEmpNo[e.empNo]=e;});
  let added=0,updated=0,skipped=0;
  list.forEach(raw=>{
    const incoming=normalizeEmployee(raw);if(!incoming.name){skipped++;return;}
    const existing=incoming.empNo?byEmpNo[incoming.empNo]:null;
    if(existing){employees=employees.map(e=>e.id===existing.id?normalizeEmployee({...e,...incoming,id:existing.id,updatedAt:new Date().toISOString()}):e);updated++;}
    else{const created=normalizeEmployee({...incoming,id:uid(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});employees.push(created);if(created.empNo)byEmpNo[created.empNo]=created;added++;}
  });
  saveEmployees();alert(`직원명부 가져오기 완료: 신규 ${added}명, 갱신 ${updated}명, 건너뜀 ${skipped}명.`);
}
function calcAge(v){
  const n=String(v||'').replace(/\D/g,'');if(!n)return'';
  let y='';if(n.length>=4)y=n.slice(0,4);if(n.length===6){const yy=Number(n.slice(0,2));y=yy>30?'19'+n.slice(0,2):'20'+n.slice(0,2);}
  const year=Number(y);if(!year||year<1950||year>new Date().getFullYear())return'';
  return String(new Date().getFullYear()-year);
}
function formatBirthDisplay(v){
  const raw=String(v||'').trim();if(!raw)return'';
  const digits=raw.replace(/\D/g,'');
  if(digits.length===8)return`${digits.slice(0,4)}.${digits.slice(4,6)}.${digits.slice(6,8)}`;
  if(digits.length===6)return`${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}`;
  const ymd=raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);if(ymd)return`${ymd[1]}.${ymd[2].padStart(2,'0')}.${ymd[3].padStart(2,'0')}`;
  const shortYmd=raw.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);if(shortYmd)return`${shortYmd[1]}.${shortYmd[2].padStart(2,'0')}.${shortYmd[3].padStart(2,'0')}`;
  return raw.replaceAll('-','.').replaceAll('/','.');
}

/* =========================================================
   Recruit ERP v10.40.16 — 기존 사원 조직정보 일괄 보강
   - 엑셀 원본에서 별도 생성한 조직정보 전용 JSON만 사용
   - 사번 기준 연결 + 이름 교차검증
   - 팀/그룹/제품/파트만 선택 반영
   - 빈칸과 '-'는 기존 값을 지우지 않음
   ========================================================= */
const EMPLOYEE_ORG_IMPORT_FORMAT='recruit-erp-employee-org-import';
const EMPLOYEE_ORG_IMPORT_SCHEMA=1;
const EMPLOYEE_ORG_IMPORT_FIELDS=[
  {key:'team',label:'팀'},
  {key:'groupName',label:'그룹'},
  {key:'product',label:'제품'},
  {key:'part',label:'파트'}
];
const EMPLOYEE_ORG_IMPORT_HISTORY_KEY='recruit_erp_employee_org_import_last';
let employeeOrgImportState={fileName:'',meta:null,rows:[],filter:'changed',page:1,pageSize:50,selected:new Set()};

function normalizeEmployeeOrgImportValue(value){
  const text=String(value??'').normalize('NFKC').trim();
  return ['-','–','—'].includes(text)?'':text;
}
function normalizeEmployeeOrgImportName(value){
  return String(value??'').normalize('NFKC').replace(/\s+/g,'').trim().toLowerCase();
}
function normalizeEmployeeOrgImportNo(value){
  return String(value??'').normalize('NFKC').replace(/\s+/g,'').trim().toUpperCase();
}
function employeeOrgImportStatusLabel(status){
  return {changed:'변경 가능',same:'동일',mismatch:'이름 불일치',missing:'사번 없음',error:'오류'}[status]||status;
}
function employeeOrgImportStatusClass(status){
  return {changed:'is-changed',same:'is-same',mismatch:'is-mismatch',missing:'is-missing',error:'is-error'}[status]||'';
}
function employeeOrgImportOrgText(org={}){
  const values=EMPLOYEE_ORG_IMPORT_FIELDS.map(f=>normalizeEmployeeOrgImportValue(org[f.key])).filter(Boolean);
  return values.length?values.join(' › '):'미입력';
}
function employeeOrgImportCurrentMap(){
  const map=new Map();
  (Array.isArray(employees)?employees:[]).forEach(e=>{
    const no=normalizeEmployeeOrgImportNo(e.empNo);
    if(!no)return;
    if(!map.has(no))map.set(no,[]);
    map.get(no).push(e);
  });
  return map;
}
function buildEmployeeOrgImportRows(records){
  const currentMap=employeeOrgImportCurrentMap();
  const sourceNoCount=new Map();
  records.forEach(raw=>{
    const no=normalizeEmployeeOrgImportNo(raw&&raw.empNo);
    if(no)sourceNoCount.set(no,(sourceNoCount.get(no)||0)+1);
  });
  return records.map((raw,index)=>{
    const record={
      empNo:normalizeEmployeeOrgImportNo(raw&&raw.empNo),
      name:normalizeEmployeeOrgImportValue(raw&&raw.name),
      source:normalizeEmployeeOrgImportValue(raw&&raw.source)||'원본',
      team:normalizeEmployeeOrgImportValue(raw&&raw.team),
      groupName:normalizeEmployeeOrgImportValue(raw&&raw.groupName),
      product:normalizeEmployeeOrgImportValue(raw&&raw.product),
      part:normalizeEmployeeOrgImportValue(raw&&raw.part)
    };
    const result={key:`org-${index}`,index,record,status:'error',reason:'',employee:null,changes:[]};
    if(!record.empNo){result.reason='사번이 비어 있습니다.';return result;}
    if(!record.name){result.reason='성명이 비어 있습니다.';return result;}
    if((sourceNoCount.get(record.empNo)||0)>1){result.reason='원본 파일에 같은 사번이 중복되어 있습니다.';return result;}
    const matches=currentMap.get(record.empNo)||[];
    if(!matches.length){result.status='missing';result.reason='현재 ERP 사원명부에서 사번을 찾지 못했습니다.';return result;}
    if(matches.length>1){result.reason='현재 ERP 사원명부에 같은 사번이 중복되어 있습니다.';return result;}
    const employee=matches[0];result.employee=employee;
    if(normalizeEmployeeOrgImportName(employee.name)!==normalizeEmployeeOrgImportName(record.name)){
      result.status='mismatch';result.reason=`ERP 성명: ${employee.name||'-'} / 원본 성명: ${record.name||'-'}`;return result;
    }
    EMPLOYEE_ORG_IMPORT_FIELDS.forEach(field=>{
      const incoming=record[field.key];
      if(!incoming)return;
      const current=normalizeEmployeeOrgImportValue(employee[field.key]||(field.key==='team'?employee.department:''));
      if(current!==incoming)result.changes.push({field:field.key,label:field.label,from:current,to:incoming});
    });
    result.status=result.changes.length?'changed':'same';
    result.reason=result.changes.length?`${result.changes.length}개 항목 변경`:'반영할 차이가 없습니다.';
    return result;
  });
}
function employeeOrgImportCounts(){
  const counts={total:employeeOrgImportState.rows.length,changed:0,same:0,mismatch:0,missing:0,error:0};
  employeeOrgImportState.rows.forEach(r=>{if(Object.prototype.hasOwnProperty.call(counts,r.status))counts[r.status]++;});
  return counts;
}
function employeeOrgImportFilteredRows(){
  const filter=employeeOrgImportState.filter;
  return employeeOrgImportState.rows.filter(r=>filter==='all'||r.status===filter);
}
function employeeOrgImportSetText(id,value){const el=$(id);if(el)el.textContent=String(value);}
function employeeOrgImportUpdateApplyState(){
  const count=employeeOrgImportState.selected.size;
  employeeOrgImportSetText('employeeOrgImportSelectedCount',`${count}명 선택`);
  const btn=$('btnApplyEmployeeOrgImport');
  const confirmed=!!$('employeeOrgImportConfirm')?.checked;
  if(btn){btn.disabled=!count||!confirmed;btn.textContent=count?`선택 ${count}명 조직정보 반영`:'선택 조직정보 반영';}
}
function employeeOrgImportCloudMessage(){
  const box=$('employeeOrgImportCloudState');if(!box)return;
  if(typeof isCompanyLocalMode==='function'&&isCompanyLocalMode()){
    box.className='employee-org-import-cloud is-blocked';
    box.innerHTML='<strong>회사 모드 적용 차단</strong><span>회사에서는 파일 업로드와 일괄 반영을 실행하지 않습니다. 집 모드에서 회사 JSON을 복원한 뒤 진행하세요.</span>';return;
  }
  if(typeof canUseCloud==='function'&&canUseCloud()){
    if(employeeExtendedCloudUnsupported){
      box.className='employee-org-import-cloud is-warning';
      box.innerHTML='<strong>Supabase 확장 컬럼 확인 필요</strong><span>v10.40.13 사원 확장필드 SQL을 먼저 실행해야 조직정보가 클라우드에도 저장됩니다. 로컬 반영은 가능합니다.</span>';
    }else{
      box.className='employee-org-import-cloud is-ready';
      box.innerHTML='<strong>로컬 + Supabase 저장 시도</strong><span>반영 후 로컬 저장을 완료하고, 현재 로그인된 Supabase에도 자동 저장을 시도합니다.</span>';
    }
  }else{
    box.className='employee-org-import-cloud is-local';
    box.innerHTML='<strong>로컬 저장 모드</strong><span>현재 Supabase 로그인이 확인되지 않아 브라우저 로컬에만 반영됩니다. 저장 후 전체 JSON 백업을 보관하세요.</span>';
  }
}
function renderEmployeeOrgImport(){
  const counts=employeeOrgImportCounts();
  employeeOrgImportSetText('employeeOrgImportTotal',counts.total);
  employeeOrgImportSetText('employeeOrgImportChanged',counts.changed);
  employeeOrgImportSetText('employeeOrgImportSame',counts.same);
  employeeOrgImportSetText('employeeOrgImportMismatch',counts.mismatch);
  employeeOrgImportSetText('employeeOrgImportMissing',counts.missing);
  const meta=employeeOrgImportState.meta||{};
  employeeOrgImportSetText('employeeOrgImportFileName',employeeOrgImportState.fileName||'파일을 선택해 주세요.');
  const sourceCounts=meta.counts&&typeof meta.counts==='object'?Object.entries(meta.counts).map(([k,v])=>`${k} ${v}명`).join(' · '):'';
  employeeOrgImportSetText('employeeOrgImportFileMeta',employeeOrgImportState.fileName?`${meta.sourceFile||'엑셀 원본'} · ${sourceCounts||counts.total+'명'} · 생성 ${meta.generatedAt?formatEmployeeDateTime(meta.generatedAt):'일시 미상'}`:'집 모드에서 전용 JSON 파일을 불러오세요.');
  document.querySelectorAll('#employeeOrgImportTabs [data-org-import-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.orgImportFilter===employeeOrgImportState.filter));
  const filtered=employeeOrgImportFilteredRows();
  const totalPages=Math.max(1,Math.ceil(filtered.length/employeeOrgImportState.pageSize));
  if(employeeOrgImportState.page>totalPages)employeeOrgImportState.page=totalPages;
  const start=(employeeOrgImportState.page-1)*employeeOrgImportState.pageSize;
  const visible=filtered.slice(start,start+employeeOrgImportState.pageSize);
  const body=$('employeeOrgImportBody');
  if(body){
    if(!employeeOrgImportState.rows.length)body.innerHTML='<tr><td class="empty" colspan="7">조직정보 전용 파일을 선택해 주세요.</td></tr>';
    else if(!visible.length)body.innerHTML='<tr><td class="empty" colspan="7">선택한 분류에 해당하는 행이 없습니다.</td></tr>';
    else body.innerHTML=visible.map(row=>{
      const selectable=row.status==='changed';
      const checked=employeeOrgImportState.selected.has(row.key);
      const current=row.employee?employeeOrgImportOrgText(row.employee):'-';
      const incoming=employeeOrgImportOrgText(row.record);
      const changes=row.changes.length?row.changes.map(c=>`<span><b>${esc(c.label)}</b> ${esc(c.from||'미입력')} → ${esc(c.to)}</span>`).join(''):`<span class="muted">${esc(row.reason)}</span>`;
      return `<tr class="employee-org-import-row ${employeeOrgImportStatusClass(row.status)}">
        <td data-label="선택"><input aria-label="${esc(row.record.name)} 선택" data-org-import-select="${esc(row.key)}" type="checkbox" ${checked?'checked':''} ${selectable?'':'disabled'}/></td>
        <td data-label="상태"><span class="employee-org-import-status ${employeeOrgImportStatusClass(row.status)}">${esc(employeeOrgImportStatusLabel(row.status))}</span></td>
        <td data-label="원본">${esc(row.record.source)}</td>
        <td data-label="사번·성명"><strong>${esc(row.record.empNo||'-')}</strong><small>${esc(row.record.name||'-')}</small></td>
        <td data-label="현재 조직">${esc(current)}</td>
        <td data-label="엑셀 조직">${esc(incoming)}</td>
        <td data-label="변경 항목"><div class="employee-org-import-changes">${changes}</div></td>
      </tr>`;
    }).join('');
  }
  employeeOrgImportSetText('employeeOrgImportSummary',employeeOrgImportState.rows.length?`변경 가능 ${counts.changed}명 · 동일 ${counts.same}명 · 이름 불일치 ${counts.mismatch}명 · 사번 없음 ${counts.missing}명 · 오류 ${counts.error}명`:'파일을 불러오면 비교 결과가 표시됩니다.');
  employeeOrgImportSetText('employeeOrgImportPageInfo',filtered.length?`${start+1}-${Math.min(start+visible.length,filtered.length)} / ${filtered.length}건`:'0건');
  const pager=$('employeeOrgImportPager');
  if(pager){
    if(totalPages<=1)pager.innerHTML='';
    else pager.innerHTML=`<button class="mini" data-org-import-page="${Math.max(1,employeeOrgImportState.page-1)}" ${employeeOrgImportState.page===1?'disabled':''}>이전</button><span>${employeeOrgImportState.page} / ${totalPages}</span><button class="mini" data-org-import-page="${Math.min(totalPages,employeeOrgImportState.page+1)}" ${employeeOrgImportState.page===totalPages?'disabled':''}>다음</button>`;
  }
  employeeOrgImportCloudMessage();
  employeeOrgImportUpdateApplyState();
}
function openEmployeeOrgImport(){
  if(typeof isCompanyLocalMode==='function'&&isCompanyLocalMode()){
    alert('회사 모드에서는 조직정보 파일을 업로드하거나 일괄 반영할 수 없습니다. 집 모드로 전환한 뒤 진행하세요.');return false;
  }
  const modal=$('employeeOrgImportModal');if(!modal)return false;
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');
  employeeOrgImportCloudMessage();
  return true;
}
function closeEmployeeOrgImport(){
  const modal=$('employeeOrgImportModal');if(!modal)return;
  modal.classList.remove('show');modal.setAttribute('aria-hidden','true');
  if($('employeeOrgImportConfirm'))$('employeeOrgImportConfirm').checked=false;
  employeeOrgImportUpdateApplyState();
}
function employeeOrgImportPickFile(){
  if(!openEmployeeOrgImport())return;
  const input=$('employeeOrgImportFile');if(input){input.value='';input.click();}
}
function validateEmployeeOrgImportPayload(parsed){
  if(!parsed||typeof parsed!=='object')throw new Error('JSON 객체 형식이 아닙니다.');
  if(parsed.format!==EMPLOYEE_ORG_IMPORT_FORMAT){
    if(parsed.format==='recruit-erp-backup')throw new Error('이 파일은 ERP 백업 JSON입니다. 시스템 → 백업/내보내기 → 회사 JSON 검사 및 적용 메뉴에서 사용해주세요.');
    if(Array.isArray(parsed.applicants)||(Array.isArray(parsed)&&parsed.some(row=>row&&('applyDate'in row||'phone'in row))))throw new Error('이 파일은 지원자 전용 JSON입니다. 사원 조직정보 반영 메뉴에서는 사용할 수 없습니다.');
    if(Array.isArray(parsed.employees))throw new Error('이 파일은 사원명부 데이터 JSON입니다. 사원명부의 JSON 가져오기 메뉴에서 사용해주세요.');
    throw new Error('Recruit ERP 사원 조직정보 전용 파일이 아닙니다.');
  }
  if(Number(parsed.schemaVersion)!==EMPLOYEE_ORG_IMPORT_SCHEMA)throw new Error(`지원하지 않는 파일 스키마입니다. 현재 지원: ${EMPLOYEE_ORG_IMPORT_SCHEMA}`);
  if(!Array.isArray(parsed.rows)||!parsed.rows.length)throw new Error('조직정보 행이 없거나 비어 있습니다.');
  if(parsed.rows.length>5000)throw new Error('행이 5,000건을 초과해 안전상 적용할 수 없습니다.');
  if(parsed.counts&&Number(parsed.counts['전체']||parsed.counts.total||0)&&Number(parsed.counts['전체']||parsed.counts.total)!==parsed.rows.length)throw new Error('파일의 전체 건수와 실제 행 수가 일치하지 않습니다.');
  const forbidden=/resident|rrn|phone|mobile|email|address|주민|연락처|이메일|주소/i;
  const allowedKeys=new Set(['empNo','name','source','team','groupName','product','part']);
  for(const row of parsed.rows){
    if(!row||typeof row!=='object')throw new Error('행 데이터 형식이 올바르지 않습니다.');
    const keys=Object.keys(row);
    const badKey=keys.find(k=>forbidden.test(k));
    if(badKey)throw new Error(`민감정보 항목(${badKey})이 포함되어 있어 파일을 거부했습니다.`);
    const unknownKey=keys.find(k=>!allowedKeys.has(k));
    if(unknownKey)throw new Error(`허용되지 않은 항목(${unknownKey})이 포함되어 있습니다. 조직정보 전용 파일을 사용해주세요.`);
  }
  return parsed;
}
function employeeOrgImportReadFile(file){
  if(!file)return;
  if(typeof isCompanyLocalMode==='function'&&isCompanyLocalMode()){
    alert('회사 모드에서는 파일을 불러올 수 없습니다.');return;
  }
  if(file.size>5*1024*1024){alert('조직정보 파일은 5MB 이하만 사용할 수 있습니다.');return;}
  const reader=new FileReader();
  reader.onerror=()=>alert('파일을 읽지 못했습니다. 다시 선택해주세요.');
  reader.onload=()=>{
    try{
      const parsed=validateEmployeeOrgImportPayload(JSON.parse(String(reader.result||'')));
      const rows=buildEmployeeOrgImportRows(parsed.rows);
      const selected=new Set(rows.filter(r=>r.status==='changed').map(r=>r.key));
      employeeOrgImportState={fileName:file.name,meta:parsed,rows,filter:'changed',page:1,pageSize:50,selected};
      if($('employeeOrgImportConfirm'))$('employeeOrgImportConfirm').checked=false;
      openEmployeeOrgImport();renderEmployeeOrgImport();
    }catch(err){
      employeeOrgImportState={fileName:'',meta:null,rows:[],filter:'changed',page:1,pageSize:50,selected:new Set()};
      renderEmployeeOrgImport();alert(`조직정보 파일 검사 실패\n\n${err.message||err}`);
    }
  };
  reader.readAsText(file,'utf-8');
}
function employeeOrgImportSelectAll(){
  employeeOrgImportState.rows.filter(r=>r.status==='changed').forEach(r=>employeeOrgImportState.selected.add(r.key));
  renderEmployeeOrgImport();
}
function employeeOrgImportClearSelection(){employeeOrgImportState.selected.clear();renderEmployeeOrgImport();}
function employeeOrgImportModalClick(event){
  const filterBtn=event.target.closest('[data-org-import-filter]');
  if(filterBtn){employeeOrgImportState.filter=filterBtn.dataset.orgImportFilter||'changed';employeeOrgImportState.page=1;renderEmployeeOrgImport();return;}
  const pageBtn=event.target.closest('[data-org-import-page]');
  if(pageBtn&&!pageBtn.disabled){employeeOrgImportState.page=Math.max(1,Number(pageBtn.dataset.orgImportPage)||1);renderEmployeeOrgImport();}
}
function employeeOrgImportModalChange(event){
  const box=event.target.closest('[data-org-import-select]');
  if(box){const key=box.dataset.orgImportSelect;if(box.checked)employeeOrgImportState.selected.add(key);else employeeOrgImportState.selected.delete(key);employeeOrgImportUpdateApplyState();return;}
  if(event.target.id==='employeeOrgImportConfirm')employeeOrgImportUpdateApplyState();
}
function employeeOrgImportSafetyBackup(){
  if(window.erpBackupCenter&&typeof window.erpBackupCenter.exportFull==='function'){
    window.erpBackupCenter.exportFull();return;
  }
  const payload={format:'recruit-erp-employees-safety-backup',appVersion:'10.40.16',createdAt:new Date().toISOString(),employees};
  download(`사원조직정보_반영전_안전백업_${today()}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
}
function applyEmployeeOrgImport(){
  if(typeof isCompanyLocalMode==='function'&&isCompanyLocalMode()){
    alert('회사 모드에서는 조직정보를 일괄 반영할 수 없습니다.');return;
  }
  const selectedRows=employeeOrgImportState.rows.filter(r=>r.status==='changed'&&employeeOrgImportState.selected.has(r.key));
  if(!selectedRows.length){alert('반영할 사원을 선택해주세요.');return;}
  if(!$('employeeOrgImportConfirm')?.checked){alert('선택 인원과 변경 내용을 확인했다는 항목에 체크해주세요.');return;}
  const fieldCounts={};
  selectedRows.forEach(r=>r.changes.forEach(c=>{fieldCounts[c.label]=(fieldCounts[c.label]||0)+1;}));
  const detail=Object.entries(fieldCounts).map(([k,v])=>`${k} ${v}건`).join(' · ');
  if(!confirm(`선택한 ${selectedRows.length}명의 조직정보를 반영할까요?\n\n${detail}\n\n반영 전에 ERP 전체 JSON 안전 백업이 자동 다운로드됩니다.`))return;
  employeeOrgImportSafetyBackup();
  const byId=new Map(selectedRows.map(r=>[r.employee.id,r]));
  const now=new Date().toISOString();
  employees=employees.map(employee=>{
    const row=byId.get(employee.id);if(!row)return employee;
    const patch={updatedAt:now};
    row.changes.forEach(change=>{patch[change.field]=change.to;if(change.field==='team')patch.department=change.to;});
    return normalizeEmployee({...employee,...patch,id:employee.id});
  });
  localStorage.setItem(EMPLOYEE_ORG_IMPORT_HISTORY_KEY,JSON.stringify({at:now,fileName:employeeOrgImportState.fileName,sourceFile:employeeOrgImportState.meta&&employeeOrgImportState.meta.sourceFile||'',applied:selectedRows.length,fieldCounts}));
  saveEmployees(employees.filter(employee=>byId.has(employee.id)));
  const records=(employeeOrgImportState.meta&&Array.isArray(employeeOrgImportState.meta.rows))?employeeOrgImportState.meta.rows:[];
  const rows=buildEmployeeOrgImportRows(records);
  employeeOrgImportState={...employeeOrgImportState,rows,selected:new Set(),filter:'changed',page:1};
  if($('employeeOrgImportConfirm'))$('employeeOrgImportConfirm').checked=false;
  renderEmployeeOrgImport();
  alert(`조직정보 반영 완료\n\n대상 ${selectedRows.length}명\n${detail}\n\n로컬 저장을 완료했고, 로그인 상태이면 Supabase 저장도 자동 시도했습니다.`);
}
