/* =========================================================
   Recruit ERP v10.46.2 PRINT_SCOPE_FIX
   - 기존 지원자 데이터만 사용해 오늘 처리할 업무를 자동 구성
   - 추가 입력/별도 회차/자동 상태변경 없음
   - 한 지원자가 여러 조건에 걸리면 한 줄에 사유를 합쳐 중복 표시 방지
   ========================================================= */
const DAILY_WORKFLOW_STALE_DAYS = 14;
let dailyWorkflowFilter = 'all';
let dailyWorkflowSearch = '';

function applicantsPendingEmployeeLink(){
  return applicants.filter(a=>a.status==='출근' && !a.employeeId);
}
function linkApplicantToEmployee(applicantId){
  const a=applicants.find(x=>x.id===applicantId);
  if(!a) return;
  const newEmployee=normalizeEmployee({
    name:a.name, school:a.school, schoolId:a.schoolId,
    department:a.workplace||'', hireDate:a.hireDate||a.applyDate||'',
    status:'재직중', notes:'Recruit ERP 지원자 연결(자동)'
  });
  employees.unshift(newEmployee);
  applicants = applicants.map(x=>x.id===applicantId ? {...x, employeeId:newEmployee.id, updatedAt:new Date().toISOString()} : x);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseSyncAll(applicants);
  saveEmployees();
  renderToday();
  renderHomeLists();
  alert(`"${a.name}"님을 직원명부에 등록했어요. 부서/직무/사번은 필요하면 사원명부에서 마저 채워주세요.`);
}
function dismissApplicantEmployeeLink(applicantId){
  if(!confirm('이 지원자는 직원명부 자동 등록 대상에서 제외할까요?')) return;
  applicants = applicants.map(x=>x.id===applicantId ? {...x, employeeId:'수동처리', updatedAt:new Date().toISOString()} : x);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseSyncAll(applicants);
  renderToday();
  renderEmployeeLinkTask();
}
function renderEmployeeLinkTask(){
  const el=$('employeeLinkList');
  if(!el) return;
  const rows=applicantsPendingEmployeeLink();
  setText('employeeLinkCount', rows.length);
  el.innerHTML = rows.length ? rows.map(a=>`<div class="person-card compact-person-card daily-secondary-card">
    <div><strong>${esc(a.name||'이름없음')}</strong>
    <small>${esc(a.school||'출신학교 미입력')} · 입사일 ${esc(a.hireDate||a.applyDate||'미입력')} · ${esc(a.workplace||'근무지 미입력')}</small></div>
    <div class="row-actions">
      <button class="mini" onclick="linkApplicantToEmployee('${a.id}')">사원명부 등록</button>
      <button class="mini" onclick="dismissApplicantEmployeeLink('${a.id}')">제외</button>
    </div>
  </div>`).join('') : '<div class="empty">출근 후 사원명부 등록이 필요한 지원자가 없습니다.</div>';
}

function dailyDateOnly(value){
  if(!value) return '';
  const raw=String(value);
  const m=raw.match(/^\d{4}-\d{2}-\d{2}/);
  if(m) return m[0];
  const d=new Date(raw);
  if(Number.isNaN(d.getTime())) return '';
  d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function dailyDaysSince(value){
  const date=dailyDateOnly(value);
  if(!date) return null;
  const diff=daysUntil(date);
  return diff===null?null:-diff;
}
function dailyLatestActivity(a){
  const history=Array.isArray(a.progressHistory)?a.progressHistory:[];
  const historyDate=history.map(h=>h&&h.createdAt).filter(Boolean).sort().pop()||'';
  return historyDate||a.lastChangedAt||a.updatedAt||a.createdAt||a.lastContactDate||a.applyDate||'';
}
function dailyUnique(rows){
  const seen=new Set();
  return rows.filter(a=>{
    const id=String(a.id||'');
    if(!id||seen.has(id)) return false;
    seen.add(id);return true;
  });
}
function dailyWorkflowGroups(){
  const t=today();
  const tomorrow=datePlus(1);
  const active=applicants.filter(isActive);
  const contact=active.filter(a=>{
    const next=a.nextContactDate||'';
    const statusNeeds=['미연락','부재중'].includes(a.status);
    return next===t || (statusNeeds && (!next || next<=t));
  });
  const contactOverdue=active.filter(a=>a.nextContactDate && a.nextContactDate<t);
  const interviewToday=active.filter(a=>a.interviewDate===t);
  const interviewTomorrow=active.filter(a=>a.interviewDate===tomorrow);
  const resultPending=active.filter(a=>{
    const past=a.interviewDate && a.interviewDate<t;
    const statusPending=['면접예정','다음면접','면접완료'].includes(a.status);
    return past && statusPending && !hasFinalDecision(a);
  });
  const hireUpcoming=active.filter(a=>{
    const d=daysUntil(a.hireDate);
    return d!==null && d>=0 && d<=7 && a.status==='입사예정';
  });
  const attendancePending=active.filter(a=>a.hireDate && a.hireDate<t && a.status==='입사예정');
  const stagnant=active.filter(a=>{
    const days=dailyDaysSince(dailyLatestActivity(a));
    return days!==null && days>=DAILY_WORKFLOW_STALE_DAYS;
  });
  return {
    contact:dailyUnique(contact),
    contactOverdue:dailyUnique(contactOverdue),
    interviewToday:dailyUnique(interviewToday),
    interviewTomorrow:dailyUnique(interviewTomorrow),
    resultPending:dailyUnique(resultPending),
    hireUpcoming:dailyUnique(hireUpcoming),
    attendancePending:dailyUnique(attendancePending),
    stagnant:dailyUnique(stagnant)
  };
}

const DAILY_REASON_META={
  contact:{label:'연락 필요',tone:'contact',priority:2},
  contactOverdue:{label:'연락기한 경과',tone:'danger',priority:1},
  interviewToday:{label:'오늘 면접',tone:'primary',priority:1},
  interviewTomorrow:{label:'내일 면접',tone:'info',priority:3},
  resultPending:{label:'면접 결과 미입력',tone:'danger',priority:1},
  hireUpcoming:{label:'입사 예정',tone:'good',priority:3},
  attendancePending:{label:'출근 확인 지연',tone:'danger',priority:1},
  stagnant:{label:`${DAILY_WORKFLOW_STALE_DAYS}일 이상 미처리`,tone:'muted',priority:4}
};

function dailyWorkflowRows(groups){
  const map=new Map();
  Object.entries(groups).forEach(([key,rows])=>{
    const meta=DAILY_REASON_META[key];
    rows.forEach(a=>{
      const id=String(a.id);
      if(!map.has(id)) map.set(id,{applicant:a,reasons:[],priority:99});
      const row=map.get(id);
      row.reasons.push({key,...meta});
      row.priority=Math.min(row.priority,meta.priority);
    });
  });
  return [...map.values()].sort((x,y)=>{
    if(x.priority!==y.priority) return x.priority-y.priority;
    const ax=x.applicant.nextContactDate||x.applicant.interviewDate||x.applicant.hireDate||'9999-12-31';
    const ay=y.applicant.nextContactDate||y.applicant.interviewDate||y.applicant.hireDate||'9999-12-31';
    return ax.localeCompare(ay)||String(x.applicant.name||'').localeCompare(String(y.applicant.name||''),'ko');
  });
}
function dailyFilterRows(allRows,groups){
  let rows=allRows;
  if(dailyWorkflowFilter!=='all'){
    const ids=new Set((groups[dailyWorkflowFilter]||[]).map(a=>String(a.id)));
    rows=rows.filter(r=>ids.has(String(r.applicant.id)));
  }
  const q=dailyWorkflowSearch.trim().toLowerCase();
  if(q) rows=rows.filter(({applicant:a})=>[
    a.name,a.phone,a.workplace,a.status,a.school,a.region,a.memo,a.consult
  ].join(' ').toLowerCase().includes(q));
  return rows;
}
function dailyFormatShortDate(v){
  const d=dailyDateOnly(v);
  return d?d.replaceAll('-','.'):'-';
}
function dailyApplicantMeta(a){
  const parts=[];
  if(a.nextContactDate) parts.push(`다음 연락 ${dailyFormatShortDate(a.nextContactDate)}`);
  if(a.interviewDate) parts.push(`면접 ${dailyFormatShortDate(a.interviewDate)}${a.interviewTime?` ${a.interviewTime}`:''}`);
  if(a.hireDate) parts.push(`입사 ${dailyFormatShortDate(a.hireDate)}`);
  const last=dailyLatestActivity(a);
  const elapsed=dailyDaysSince(last);
  if(elapsed!==null) parts.push(`마지막 변경 ${elapsed===0?'오늘':`${elapsed}일 전`}`);
  return parts.join(' · ')||'등록된 일정 없음';
}
function dailyWorkflowCard(row){
  const a=row.applicant;
  const reasonHtml=row.reasons
    .sort((x,y)=>x.priority-y.priority)
    .map(r=>`<span class="daily-reason-chip ${r.tone}">${esc(r.label)}</span>`).join('');
  return `<article class="daily-work-item" data-applicant-id="${esc(a.id)}">
    <div class="daily-work-main">
      <div class="daily-work-reasons">${reasonHtml}</div>
      <div class="daily-work-person">
        <strong><span class="person-name ${genderClass(a)}">${esc(a.name||'이름없음')}</span><span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></strong>
        <span>${esc(a.workplace||'근무지 미입력')} · ${esc(formatPhoneDisplay(a.phone)||'연락처 미입력')} · ${esc(a.school||'학교 미입력')}</span>
      </div>
      <div class="daily-work-meta">${esc(dailyApplicantMeta(a))}</div>
    </div>
    <div class="daily-work-actions">
      <button class="mini" type="button" onclick="viewApplicant('${a.id}')">상세</button>
      <button class="primary mini" type="button" onclick="editApplicant('${a.id}')">수정</button>
    </div>
  </article>`;
}
function updateDailyFilterChips(groups,allRows){
  const counts={all:allRows.length};
  Object.keys(DAILY_REASON_META).forEach(key=>{counts[key]=(groups[key]||[]).length;});
  document.querySelectorAll('[data-daily-filter]').forEach(btn=>{
    const key=btn.dataset.dailyFilter;
    btn.classList.toggle('active',key===dailyWorkflowFilter);
    const count=btn.querySelector('[data-daily-count]');
    if(count) count.textContent=counts[key]||0;
  });
}
function renderToday(){
  const groups=dailyWorkflowGroups();
  const allRows=dailyWorkflowRows(groups);
  const visible=dailyFilterRows(allRows,groups);
  const metricMap={
    dailyContactCount:groups.contact.length,
    dailyContactOverdueCount:groups.contactOverdue.length,
    dailyInterviewTodayCount:groups.interviewToday.length,
    dailyInterviewTomorrowCount:groups.interviewTomorrow.length,
    dailyResultPendingCount:groups.resultPending.length,
    dailyHireUpcomingCount:groups.hireUpcoming.length,
    dailyAttendancePendingCount:groups.attendancePending.length,
    dailyStagnantCount:groups.stagnant.length
  };
  Object.entries(metricMap).forEach(([id,value])=>setText(id,value));
  setText('dailyWorkflowVisibleCount',`${visible.length}명`);
  setText('dailyWorkflowTotalCount',`전체 ${allRows.length}명`);
  const list=$('dailyWorkflowList');
  if(list) list.innerHTML=visible.length?visible.map(dailyWorkflowCard).join(''):'<div class="empty daily-work-empty">현재 조건에서 처리할 지원자가 없습니다.</div>';
  updateDailyFilterChips(groups,allRows);
}

function setDailyWorkflowFilter(filter){
  dailyWorkflowFilter=filter||'all';
  renderToday();
}
window.setDailyWorkflowFilter=setDailyWorkflowFilter;

(function bindDailyWorkflow(){
  document.addEventListener('click',e=>{
    const filterButton=e.target.closest('[data-daily-filter]');
    if(filterButton){setDailyWorkflowFilter(filterButton.dataset.dailyFilter);return;}
    if(e.target.closest('#btnDailyWorkflowRefresh')){renderToday();renderEmployeeLinkTask();}
  });
  const search=$('dailyWorkflowSearch');
  if(search) search.addEventListener('input',e=>{dailyWorkflowSearch=e.target.value||'';renderToday();});
})();
