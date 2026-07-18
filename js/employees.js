/* =========================================================
   Recruit ERP v10.40.13 — 사원명부 UI + 상세/등록/수정 최종화
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
function saveEmployees(){
  localStorage.setItem(EMPLOYEES_KEY,JSON.stringify(employees));
  supabaseSyncEmployees(employees);
  renderEmployees();
  renderSchools();
}
function supabaseSyncEmployees(list){
  if(!canUseCloud()) return;
  const useLegacy=employeeExtendedCloudUnsupported;
  const payload=list.map(e=>employeeCloudRow(e,useLegacy));
  window.sb.from('employees').upsert(payload).then(function(res){
    if(!res||!res.error) return;
    if(!useLegacy){
      employeeExtendedCloudUnsupported=true;
      console.warn('사원 확장필드용 Supabase 컬럼이 없어 기존 필드만 클라우드에 저장합니다. v10.40.13 마이그레이션 SQL 실행 후 새로고침하면 확장필드도 동기화됩니다.',res.error.message);
      return window.sb.from('employees').upsert(list.map(e=>employeeCloudRow(e,true))).then(function(fallback){
        if(fallback&&fallback.error) console.warn('직원명부 Supabase 저장 실패(로컬에는 정상 저장됨):',fallback.error.message);
      });
    }
    console.warn('직원명부 Supabase 저장 실패(로컬에는 정상 저장됨):',res.error.message);
  }).catch(function(e){console.warn('직원명부 Supabase 저장 실패(로컬에는 정상 저장됨):',e);});
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
let employeeDeptFilter='all';
let employeeRankFilter='all';
let employeeSchoolSearch='';
let employeeHireFrom='';
let employeeHireTo='';
let employeePage=1;
let employeePageSize=20;
let employeeViewMode='list';

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
function employeeDeptList(){return Array.from(new Set(employees.map(employeeOrgPrimary).filter(x=>x&&x!=='소속 미입력'))).sort();}
function employeeRankList(){return Array.from(new Set(employees.map(employeeRankDisplay).filter(x=>x&&x!=='-'))).sort();}
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
  if(employeeDeptFilter!=='all'&&employeeOrgPrimary(e)!==employeeDeptFilter)return false;
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
function applyEmployeeSearch(){
  employeeSearchName=employeeFieldValue('empSearchName');
  employeeSearchNo=employeeFieldValue('empSearchNo');
  employeeDeptFilter=$('empDeptFilter')?.value||'all';
  employeeRankFilter=$('empRankFilter')?.value||'all';
  employeeStatusFilter=$('empStatusFilter')?.value||employeeStatusFilter||'all';
  employeeSchoolSearch=employeeFieldValue('empSearchSchool');
  employeeHireFrom=$('empHireFrom')?.value||'';
  employeeHireTo=$('empHireTo')?.value||'';
  employeePage=1;renderEmployees();
}
function resetEmployeeFilters(){
  employeeStatusFilter='all';employeeSearchName='';employeeSearchNo='';employeeDeptFilter='all';employeeRankFilter='all';employeeSchoolSearch='';employeeHireFrom='';employeeHireTo='';employeePage=1;
  ['empSearchName','empSearchNo','empSearchSchool','empHireFrom','empHireTo'].forEach(id=>{if($(id))$(id).value='';});
  ['empDeptFilter','empRankFilter','empStatusFilter'].forEach(id=>{if($(id))$(id).value='all';});
  renderEmployees();
}
function setEmployeeStatusFilter(status){
  employeeStatusFilter=status||'all';employeePage=1;
  if($('empStatusFilter'))$('empStatusFilter').value=employeeStatusFilter;
  renderEmployees();
}
function populateEmployeeFilterOptions(){
  const deptSel=$('empDeptFilter');
  if(deptSel){
    const cur=deptSel.value||employeeDeptFilter;
    const values=employeeDeptList();
    deptSel.innerHTML='<option value="all">전체</option>'+values.map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
    deptSel.value=values.includes(cur)?cur:'all';
  }
  const rankSel=$('empRankFilter');
  if(rankSel){
    const cur=rankSel.value||employeeRankFilter;
    const values=employeeRankList();
    rankSel.innerHTML='<option value="all">전체</option>'+values.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
    rankSel.value=values.includes(cur)?cur:'all';
  }
  if($('empStatusFilter'))$('empStatusFilter').value=employeeStatusFilter;
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
  const activeFilterCount=[employeeStatusFilter!=='all',employeeSearchName,employeeSearchNo,employeeDeptFilter!=='all',employeeRankFilter!=='all',employeeSchoolSearch,employeeHireFrom,employeeHireTo].filter(Boolean).length;
  setText('employeeListSummary',activeFilterCount?`${all.length}명 / 전체 ${employees.length}명`:`${all.length}명 표시`);
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
