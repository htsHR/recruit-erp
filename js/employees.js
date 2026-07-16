/* =========================================================
   v10.22.0 직원명부 (인재풀·HR)
   - 지원자 파이프라인(applicants)과 완전히 분리된 별도 저장소
   - 필드: 사번/성명/학교/입사일/퇴사일/재직상태/상벌여부만 취급
   - 주민번호·계좌·주소·연락처·이메일 등 민감정보는 절대 다루지 않음
   - 학교 필드는 기존 schools/schoolId 매칭 시스템을 그대로 재사용
   ========================================================= */
function normalizeEmployee(e){
  const school=e.school||'';
  return {
    id: e.id || uid(),
    empNo: e.empNo||'',
    name: e.name||'',
    department: e.department||'',
    role: e.role||'',
    school, schoolId: (e.schoolId!==undefined && e.schoolId!==null) ? e.schoolId : resolveSchoolId(school),
    hireDate: e.hireDate||'',
    leaveDate: e.leaveDate||'',
    status: e.status || (e.leaveDate ? '퇴사' : '재직중'),
    disciplineCount: Number.isFinite(e.disciplineCount) ? e.disciplineCount : (parseInt(e.disciplineCount,10)||0),
    notes: e.notes||'',
    createdAt: e.createdAt || new Date().toISOString(), updatedAt: e.updatedAt||''
  };
}
function loadEmployees(){
  try{
    const raw=localStorage.getItem(EMPLOYEES_KEY);
    const data=raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.map(normalizeEmployee) : [];
  }catch(e){ console.error('직원명부 load error', e); return []; }
}
function saveEmployees(){
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  supabaseSyncEmployees(employees);
  renderEmployees();
  renderSchools();
}
function supabaseSyncEmployees(list){
  if(!canUseCloud()) return;
  window.sb.from('employees').upsert(list).then(function(res){
    if(res && res.error) console.warn('직원명부 Supabase 저장 실패(로컬엔 정상 저장됨):', res.error.message);
  }).catch(function(e){ console.warn('직원명부 Supabase 저장 실패(로컬엔 정상 저장됨):', e); });
}
function supabaseDeleteEmployee(id){
  if(!canUseCloud()) return;
  window.sb.from('employees').delete().eq('id', id).then(function(res){
    if(res && res.error) console.warn('직원명부 삭제 실패(로컬엔 정상 삭제됨):', res.error.message);
  }).catch(function(e){ console.warn('직원명부 삭제 실패(로컬엔 정상 삭제됨):', e); });
}
function supabaseEmployeesSyncOnLoad(){
  if(!canUseCloud()) return;
  const PAGE_SIZE = 500;
  function loadPage(from, collected){
    return window.sb.from('employees').select('*').order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1)
      .then(function(res){
        if(res && res.error){ throw new Error(res.error.message); }
        const rows = (res && res.data) ? res.data : [];
        const merged = collected.concat(rows);
        if(rows.length < PAGE_SIZE){
          return merged; // 마지막 페이지(요청 크기보다 적게 옴)
        }
        return loadPage(from + PAGE_SIZE, merged);
      });
  }
  loadPage(0, []).then(function(cloudRaw){
    // v10.35.2: 전체 페이지 조회가 전부 성공한 뒤에만 병합/반영. 1,000행 조회 한도로
    // 일부만 가져와 조용히 누락되던 문제(직원 1,381명 중 381명 유실 위험)를 제거함.
    const cloud = cloudRaw.map(normalizeEmployee);
    const local = employees;
    const map = {};
    local.forEach(function(e){ map[e.id] = e; });
    cloud.forEach(function(c){
      const l = map[c.id];
      if(!l){ map[c.id] = c; return; }
      const lt = l.updatedAt || l.createdAt || '';
      const ct = c.updatedAt || c.createdAt || '';
      map[c.id] = (ct > lt) ? c : l;
    });
    employees = Object.keys(map).map(function(k){ return map[k]; });
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
    renderEmployees();
    console.info('직원명부 Supabase 페이지 조회 완료: 클라우드 ' + cloud.length + '명 -> 병합 후 ' + employees.length + '명');
  }).catch(function(e){
    console.warn('직원명부 페이지 조회 중 실패 — 불완전한 데이터를 반영하지 않고 기존 로컬 데이터 유지:', e);
  });
}
let employeeStatusFilter='all';
let employeeSearchName='';
let employeeSearchNo='';
let employeeDeptFilter='all';
let employeeRoleFilter='all';
let employeeSchoolSearch='';
let employeePage=1;
let employeePageSize=10;
let employeeViewMode='list';
function getEmployeeForm(){
  return {
    empNo: ($('empNo')?.value||'').trim(),
    name: ($('empName')?.value||'').trim(),
    department: ($('empDept')?.value||'').trim(),
    role: ($('empRole')?.value||'').trim(),
    school: ($('empSchool')?.value||'').trim(),
    hireDate: $('empHireDate')?.value||'',
    leaveDate: $('empLeaveDate')?.value||'',
    status: $('empStatus')?.value||'재직중',
    disciplineCount: parseInt($('empDisciplineCount')?.value||'0',10)||0,
    notes: ($('empNotes')?.value||'').trim()
  };
}
function resetEmployeeForm(){
  editingEmployeeId='';
  ['empNo','empName','empDept','empRole','empSchool','empHireDate','empLeaveDate','empDisciplineCount','empNotes'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('empStatus')) $('empStatus').value='재직중';
  if($('btnAddEmployee')) $('btnAddEmployee').textContent='직원 추가';
}
function fillEmployeeForm(e){
  editingEmployeeId=e.id;
  if($('empNo')) $('empNo').value=e.empNo;
  if($('empName')) $('empName').value=e.name;
  if($('empDept')) $('empDept').value=e.department;
  if($('empRole')) $('empRole').value=e.role;
  if($('empSchool')) $('empSchool').value=e.school;
  if($('empHireDate')) $('empHireDate').value=e.hireDate;
  if($('empLeaveDate')) $('empLeaveDate').value=e.leaveDate;
  if($('empStatus')) $('empStatus').value=e.status;
  if($('empDisciplineCount')) $('empDisciplineCount').value=e.disciplineCount||0;
  if($('empNotes')) $('empNotes').value=e.notes;
  if($('btnAddEmployee')) $('btnAddEmployee').textContent='수정 저장';
}
function submitEmployeeForm(){
  const f=getEmployeeForm();
  if(!f.name){ alert('성명을 입력해주세요.'); return; }
  if(editingEmployeeId){
    employees=employees.map(e=>e.id===editingEmployeeId ? normalizeEmployee({...e, ...f, id:editingEmployeeId, updatedAt:new Date().toISOString()}) : e);
  } else {
    employees.unshift(normalizeEmployee({...f, id:uid(), createdAt:new Date().toISOString()}));
  }
  resetEmployeeForm();
  saveEmployees();
}
function editEmployeePrompt(id){ const e=employees.find(x=>x.id===id); if(e){ fillEmployeeForm(e); } }
function deleteEmployee(id){
  const e=employees.find(x=>x.id===id);
  if(!e) return;
  if(!confirm(`"${e.name}" 직원 기록을 삭제할까요?`)) return;
  employees=employees.filter(x=>x.id!==id);
  supabaseDeleteEmployee(id);
  saveEmployees();
}
function employeeDeptList(){ return Array.from(new Set(employees.map(e=>e.department).filter(Boolean))).sort(); }
function employeeRoleList(){ return Array.from(new Set(employees.map(e=>e.role).filter(Boolean))).sort(); }
function employeeStatusBadgeClass(status){
  if(status==='재직중') return 'good';
  if(status==='휴직') return 'missed';
  if(status==='입사예정') return 'info';
  return 'bad';
}
function employeeMatchesFilter(e){
  if(employeeStatusFilter!=='all' && e.status!==employeeStatusFilter) return false;
  if(employeeSearchName && !e.name.toLowerCase().includes(employeeSearchName.toLowerCase())) return false;
  if(employeeSearchNo && !e.empNo.toLowerCase().includes(employeeSearchNo.toLowerCase())) return false;
  if(employeeDeptFilter!=='all' && e.department!==employeeDeptFilter) return false;
  if(employeeRoleFilter!=='all' && e.role!==employeeRoleFilter) return false;
  if(employeeSchoolSearch){
    const term=employeeSchoolSearch.toLowerCase();
    const textMatch=(e.school||'').toLowerCase().includes(term);
    const matchedSchool=findSchoolByText(employeeSchoolSearch);
    const aliasMatch=matchedSchool && e.schoolId===matchedSchool.id;
    if(!textMatch && !aliasMatch) return false;
  }
  return true;
}
function applyEmployeeSearch(){
  employeeSearchName=($('empSearchName')?.value||'').trim();
  employeeSearchNo=($('empSearchNo')?.value||'').trim();
  employeeDeptFilter=$('empDeptFilter')?.value||'all';
  employeeRoleFilter=$('empRoleFilter')?.value||'all';
  employeeSchoolSearch=($('empSearchSchool')?.value||'').trim();
  employeePage=1;
  renderEmployees();
}
function resetEmployeeFilters(){
  employeeSearchName=''; employeeSearchNo=''; employeeDeptFilter='all'; employeeRoleFilter='all'; employeeSchoolSearch=''; employeePage=1;
  if($('empSearchName')) $('empSearchName').value='';
  if($('empSearchNo')) $('empSearchNo').value='';
  if($('empSearchSchool')) $('empSearchSchool').value='';
  if($('empDeptFilter')) $('empDeptFilter').value='all';
  if($('empRoleFilter')) $('empRoleFilter').value='all';
  renderEmployees();
}
function populateEmployeeFilterOptions(){
  const deptSel=$('empDeptFilter');
  if(deptSel){
    const cur=deptSel.value;
    deptSel.innerHTML='<option value="all">전체</option>'+employeeDeptList().map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
    deptSel.value=employeeDeptList().includes(cur)?cur:'all';
  }
  const roleSel=$('empRoleFilter');
  if(roleSel){
    const cur=roleSel.value;
    roleSel.innerHTML='<option value="all">전체</option>'+employeeRoleList().map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
    roleSel.value=employeeRoleList().includes(cur)?cur:'all';
  }
}
function goEmployeePage(p){ employeePage=p; renderEmployees(); }
function renderEmployeePagination(totalPages, totalCount){
  const el=$('employeePagination');
  if(!el) return;
  setText('employeePaginationCount', totalCount);
  if(totalPages<=1){ el.innerHTML=''; return; }
  const start=Math.max(1, employeePage-2), end=Math.min(totalPages, start+4);
  let html=`<button class="mini" ${employeePage===1?'disabled':''} onclick="goEmployeePage(1)">«</button>`;
  html+=`<button class="mini" ${employeePage===1?'disabled':''} onclick="goEmployeePage(${employeePage-1})">‹</button>`;
  for(let p=start;p<=end;p++) html+=`<button class="mini ${p===employeePage?'active':''}" onclick="goEmployeePage(${p})">${p}</button>`;
  html+=`<button class="mini" ${employeePage===totalPages?'disabled':''} onclick="goEmployeePage(${employeePage+1})">›</button>`;
  html+=`<button class="mini" ${employeePage===totalPages?'disabled':''} onclick="goEmployeePage(${totalPages})">»</button>`;
  el.innerHTML=html;
}
function csvEmployees(){
  const headers=['사번','성명','부서','직무','학교','입사일','퇴사일','상태','상벌건수','비고'];
  const lines=[headers,...employees.map(e=>[e.empNo,e.name,e.department,e.role,e.school,e.hireDate,e.leaveDate,e.status,e.disciplineCount,e.notes])]
    .map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`직원명부_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function employeeDeptAggregates(){
  const map={};
  employees.forEach(e=>{
    const dept=e.department||'미분류';
    if(!map[dept]) map[dept]={dept, total:0, active:0, left:0, upcoming:0};
    map[dept].total++;
    if(e.status==='재직중') map[dept].active++;
    if(e.status==='퇴사') map[dept].left++;
    if(e.status==='입사예정') map[dept].upcoming++;
  });
  return Object.values(map).sort((a,b)=>b.total-a.total);
}
function renderEmployeeDeptView(){
  const body=$('employeeDeptBody');
  if(!body) return;
  const rows=employeeDeptAggregates();
  if(!rows.length){ body.innerHTML=`<tr><td colspan="5" class="empty">등록된 직원이 없습니다.</td></tr>`; return; }
  body.innerHTML=rows.map(d=>`<tr><td>${esc(d.dept)}</td><td>${d.total}명</td><td>${d.active}명</td><td>${d.left}명</td><td>${d.upcoming}명</td></tr>`).join('');
}
function toggleRowMore(event, button){
  event.preventDefault();
  event.stopPropagation();
  const menu=button.closest('.row-more-menu');
  if(!menu) return;
  const panel=menu.querySelector('.row-more-menu-panel');
  const willOpen=!menu.classList.contains('open');
  closeAllRowMoreMenus();
  if(!willOpen || !panel) return;
  menu.classList.add('open');
  const rect=button.getBoundingClientRect();
  const panelWidth=120;
  const estimatedHeight=122;
  let left=Math.min(window.innerWidth-panelWidth-12,Math.max(12,rect.right-panelWidth));
  let top=rect.bottom+6;
  if(top+estimatedHeight>window.innerHeight-12) top=Math.max(12,rect.top-estimatedHeight-6);
  panel.style.left=`${left}px`;
  panel.style.top=`${top}px`;
  panel.style.right='auto';
}
function closeAllRowMoreMenus(){
  document.querySelectorAll('.row-more-menu.open').forEach(x=>{
    x.classList.remove('open');
    const panel=x.querySelector('.row-more-menu-panel');
    if(panel){panel.style.left='';panel.style.top='';panel.style.right='';}
  });
}
function listRowKeyActivate(event, action){
  if(event.key!=='Enter' && event.key!==' ') return;
  if(event.target.closest('button,select,a,input,label,summary,details')) return;
  event.preventDefault();
  action();
}
function updateEmployeeStatusTabCounts(){
  const labels={all:'전체',재직중:'재직자',퇴사:'퇴직자',입사예정:'입사예정자',휴직:'휴직'};
  document.querySelectorAll('#employeeStatusTabs [data-empstatus]').forEach(btn=>{
    const key=btn.dataset.empstatus;
    const count=key==='all' ? employees.length : employees.filter(e=>e.status===key).length;
    btn.innerHTML=`<span>${labels[key]||key}</span><small class="tab-count">${count}</small>`;
  });
}
function renderEmployees(){
  const body=$('employeesBody');
  if(!body) return;
  populateEmployeeFilterOptions();
  updateEmployeeStatusTabCounts();
  const all=employees.filter(employeeMatchesFilter).sort((a,b)=>(b.hireDate||'').localeCompare(a.hireDate||''));
  setText('employeesTotalCount', employees.length);
  setText('employeesActiveCount', employees.filter(e=>e.status==='재직중').length);
  setText('employeesLeftCount', employees.filter(e=>e.status==='퇴사').length);
  setText('employeesUpcomingCount', employees.filter(e=>e.status==='입사예정').length);
  const activeFilterCount=[employeeStatusFilter!=='all',employeeSearchName,employeeSearchNo,employeeDeptFilter!=='all',employeeRoleFilter!=='all',employeeSchoolSearch].filter(Boolean).length;
  const resultText=activeFilterCount ? `${all.length}명 / 전체 ${employees.length}명` : `${all.length}명 표시`;
  setText('employeeListSummary', resultText);
  const totalPages=Math.max(1, Math.ceil(all.length/employeePageSize));
  if(employeePage>totalPages) employeePage=totalPages;
  const start=(employeePage-1)*employeePageSize;
  const rows=all.slice(start, start+employeePageSize);
  renderEmployeePagination(totalPages, all.length);
  renderEmployeeDeptView();
  if(!all.length){ body.innerHTML=`<tr><td colspan="10" class="empty employee-empty-state"><strong>조건에 맞는 직원이 없습니다.</strong><span>검색어 또는 필터를 바꿔주세요.</span><button class="ghost" onclick="resetEmployeeFilters()">검색조건 초기화</button></td></tr>`; return; }
  body.innerHTML=rows.map(e=>`<tr class="employee-list-row clickable-data-row" tabindex="0" onclick="if(!event.target.closest('button,select,a,input,label,summary,details')) openEmployeeDetail('${e.id}')" onkeydown="listRowKeyActivate(event,()=>openEmployeeDetail('${e.id}'))">
    <td class="employee-no-cell" data-label="사번">${esc(e.empNo)||'-'}</td>
    <td class="employee-name-cell" data-label="이름"><button class="link-like employee-name-link" onclick="openEmployeeDetail('${e.id}')">${esc(e.name)}</button><small>${esc(e.department)||'부서 미입력'} · ${esc(e.role)||'직무 미입력'}</small></td>
    <td class="employee-dept-cell" data-label="부서">${esc(e.department)||'-'}</td>
    <td class="employee-role-cell" data-label="직무">${esc(e.role)||'-'}</td>
    <td class="employee-hire-cell" data-label="입사일">${esc(e.hireDate)||'-'}</td>
    <td class="employee-status-cell" data-label="상태"><span class="badge ${employeeStatusBadgeClass(e.status)}">${esc(e.status)}</span></td>
    <td class="employee-school-cell" data-label="출신학교">${esc(e.school)||'<span class="muted">미입력</span>'}</td>
    <td class="employee-notes-cell" data-label="비고">${esc(e.notes)||'-'}</td>
    <td class="employee-discipline-cell" data-label="상벌">${e.disciplineCount>0 ? `<span class="badge bad">${e.disciplineCount}건</span>` : '<span class="muted">없음</span>'}</td>
    <td class="row-actions employee-row-actions" data-label="관리"><button class="view" onclick="openEmployeeDetail('${e.id}')">상세</button><button onclick="editEmployeePrompt('${e.id}')">수정</button><div class="row-more-menu"><button type="button" class="row-more-toggle" onclick="toggleRowMore(event,this)">더보기</button><div class="row-more-menu-panel"><button class="delete" onclick="deleteEmployee('${e.id}')">삭제</button></div></div></td>
  </tr>`).join('');
}
function importEmployeesJson(list){
  if(!Array.isArray(list) || !list.length){ alert('직원명부 JSON 형식이 아니거나 비어 있습니다.'); return; }
  const byEmpNo={};
  employees.forEach(e=>{ if(e.empNo) byEmpNo[e.empNo]=e; });
  let added=0, updated=0, skipped=0;
  list.forEach(raw=>{
    const incoming=normalizeEmployee(raw);
    if(!incoming.name){ skipped++; return; }
    const existing=incoming.empNo ? byEmpNo[incoming.empNo] : null;
    if(existing){
      employees=employees.map(e=>e.id===existing.id ? normalizeEmployee({...e, ...incoming, id:existing.id, updatedAt:new Date().toISOString()}) : e);
      updated++;
    } else {
      const created=normalizeEmployee({...incoming, id:uid(), createdAt:new Date().toISOString()});
      employees.push(created);
      if(created.empNo) byEmpNo[created.empNo]=created;
      added++;
    }
  });
  saveEmployees();
  alert(`직원명부 가져오기 완료: 신규 ${added}명, 갱신 ${updated}명, 건너뜀 ${skipped}명.`);
}
function calcAge(v){
  const n = String(v||'').replace(/\D/g,'');
  if(!n) return '';
  let y = '';
  if(n.length >= 4) y = n.slice(0,4);
  if(n.length === 6){ const yy = Number(n.slice(0,2)); y = yy > 30 ? '19'+n.slice(0,2) : '20'+n.slice(0,2); }
  const year = Number(y);
  if(!year || year < 1950 || year > new Date().getFullYear()) return '';
  return String(new Date().getFullYear() - year);
}
function formatBirthDisplay(v){
  const raw = String(v || '').trim();
  if(!raw) return '';
  const digits = raw.replace(/\D/g,'');
  if(digits.length === 8) return `${digits.slice(0,4)}.${digits.slice(4,6)}.${digits.slice(6,8)}`;
  if(digits.length === 6) return `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}`;
  const ymd = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if(ymd) return `${ymd[1]}.${ymd[2].padStart(2,'0')}.${ymd[3].padStart(2,'0')}`;
  const shortYmd = raw.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);
  if(shortYmd) return `${shortYmd[1]}.${shortYmd[2].padStart(2,'0')}.${shortYmd[3].padStart(2,'0')}`;
  return raw.replaceAll('-', '.').replaceAll('/', '.');
}
