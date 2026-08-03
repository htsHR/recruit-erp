/* =========================================================
   Recruit ERP v10.62.0 TODAY WORK OPERATIONS
   - 오늘 할 일을 서류검토 → 전화 → 재연락 → 면접 → 결과 → 입사 순으로 분리
   - 각 지원자 행에서 기존 워크벤치/전화 인터뷰/일정/수정 화면으로 바로 이동
   - 새 데이터 필드·새 저장 구조 없이 기존 applicants 상태/일정/이력만 사용
   ========================================================= */
const DAILY_WORKFLOW_STALE_DAYS = window.erpTodayAutomation?.STALE_DAYS||14;
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
      <button class="mini" data-erp-handler="linkApplicantToEmployee('${a.id}')">사원명부 등록</button>
      <button class="mini" data-erp-handler="dismissApplicantEmployeeLink('${a.id}')">제외</button>
    </div>
  </div>`).join('') : '<div class="empty">출근 후 사원명부 등록이 필요한 지원자가 없습니다.</div>';
}

function dailyDateOnly(value){
  if(window.erpTodayAutomation)return window.erpTodayAutomation.dateOnly(value);
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
  if(window.erpTodayAutomation)return window.erpTodayAutomation.latestActivity(a);
  const history=Array.isArray(a.progressHistory)?a.progressHistory:[];
  const historyDate=history.map(h=>h&&h.createdAt).filter(Boolean).sort().pop()||'';
  return historyDate||a.lastChangedAt||a.updatedAt||a.createdAt||a.lastContactDate||a.applyDate||'';
}
function dailyUnique(rows){
  if(window.erpTodayAutomation)return window.erpTodayAutomation.unique(rows);
  const seen=new Set();
  return rows.filter(a=>{
    const id=String(a.id||'');
    if(!id||seen.has(id)) return false;
    seen.add(id);return true;
  });
}
function dailyWorkflowGroups(){
  if(window.erpTodayAutomation){
    return window.erpTodayAutomation.buildGroups(applicants,{
      today:today(),isActive,normalizeStatus,isInterviewScheduleActive,hasFinalDecision
    });
  }
  const t=today();
  const active=applicants.filter(isActive);
  const screening=active.filter(a=>normalizeStatus(a.status)==='서류검토');
  const phone=active.filter(a=>normalizeStatus(a.status)==='서류합격');
  const recall=active.filter(a=>{
    if(normalizeStatus(a.status)!=='부재중') return false;
    const next=a.nextContactDate||'';
    return !next || next<=t;
  });
  const contact=dailyUnique([...phone,...recall]);
  const contactOverdue=active.filter(a=>{
    const st=normalizeStatus(a.status);
    return ['서류합격','부재중'].includes(st) && a.nextContactDate && a.nextContactDate<t;
  });
  const interviewToday=active.filter(a=>a.interviewDate===t && typeof isInterviewScheduleActive==='function' && isInterviewScheduleActive(a));
  const resultPending=active.filter(a=>{
    const past=a.interviewDate && a.interviewDate<t;
    const statusPending=['면접예정','다음면접','면접완료'].includes(normalizeStatus(a.status));
    return past && statusPending && !hasFinalDecision(a);
  });
  const hireUpcoming=active.filter(a=>{
    const d=daysUntil(a.hireDate);
    return d!==null && d>=0 && d<=3 && normalizeStatus(a.status)==='입사예정';
  });
  const attendancePending=active.filter(a=>a.hireDate && a.hireDate<t && normalizeStatus(a.status)==='입사예정');
  const stagnant=active.filter(a=>{
    const days=dailyDaysSince(dailyLatestActivity(a));
    return days!==null && days>=DAILY_WORKFLOW_STALE_DAYS;
  });
  const overdue=dailyUnique([...contactOverdue,...resultPending,...attendancePending]);
  return {
    screening:dailyUnique(screening),
    phone:dailyUnique(phone),
    recall:dailyUnique(recall),
    contact,
    contactOverdue:dailyUnique(contactOverdue),
    overdue,
    interviewToday:dailyUnique(interviewToday),
    resultPending:dailyUnique(resultPending),
    hireUpcoming:dailyUnique(hireUpcoming),
    attendancePending:dailyUnique(attendancePending),
    stagnant:dailyUnique(stagnant)
  };
}

const DAILY_REASON_META={
  screening:{label:'서류검토 필요',tone:'info',priority:2},
  phone:{label:'전화 인터뷰 필요',tone:'contact',priority:2},
  recall:{label:'재연락 필요',tone:'danger',priority:1},
  interviewToday:{label:'오늘 면접',tone:'primary',priority:1},
  resultPending:{label:'면접 결과 미입력',tone:'danger',priority:1},
  hireUpcoming:{label:'3일 내 입사',tone:'good',priority:3},
  attendancePending:{label:'출근 확인 지연',tone:'danger',priority:1},
  stagnant:{label:`${DAILY_WORKFLOW_STALE_DAYS}일 이상 미처리`,tone:'muted',priority:4}
};

function dailyWorkflowRows(groups){
  const map=new Map();
  Object.entries(groups).forEach(([key,rows])=>{
    const meta=DAILY_REASON_META[key];
    if(!meta) return;
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
const DAILY_ACTION_RANK={recall:1,interviewToday:2,resultPending:3,screening:4,phone:5,attendancePending:6,hireUpcoming:7,stagnant:8};
function dailyPrimaryReason(row){
  return [...row.reasons].sort((a,b)=>a.priority-b.priority || (DAILY_ACTION_RANK[a.key]||99)-(DAILY_ACTION_RANK[b.key]||99))[0]||null;
}
function dailyActionDescriptor(row){
  const r=dailyPrimaryReason(row);
  if(!r) return {kind:'detail',label:'상세 확인'};
  const map={
    screening:{kind:'screening',label:'서류검토'},
    phone:{kind:'phone',label:'전화 시작'},
    recall:{kind:'recall',label:'재연락'},
    interviewToday:{kind:'calendar',label:'일정 보기'},
    resultPending:{kind:'decision',label:'결과 입력'},
    hireUpcoming:{kind:'hire',label:'입사 확인'},
    attendancePending:{kind:'attendance',label:'출근 확인'},
    stagnant:{kind:'detail',label:'상세 확인'}
  };
  return map[r.key]||{kind:'detail',label:'상세 확인'};
}
function dailyRunApplicantAction(kind,applicantId){
  const a=applicants.find(x=>String(x.id)===String(applicantId));
  if(!a) return;
  const needsWrite=['screening','phone','recall','decision','attendance'].includes(kind);
  if(needsWrite&&window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return;
  if(kind==='screening' && typeof window.openScreeningWorkbenchForApplicant==='function'){
    window.openScreeningWorkbenchForApplicant(a.id); return;
  }
  if((kind==='phone'||kind==='recall') && typeof window.openPhoneInterviewForApplicant==='function'){
    window.openPhoneInterviewForApplicant(a.id); return;
  }
  if(kind==='calendar'){
    setPage('calendar');
    if(a.interviewDate && typeof selectCalendarDate==='function') selectCalendarDate(a.interviewDate);
    return;
  }
  if(kind==='attendance'&&typeof window.updateApplicantStatus==='function'){
    window.updateApplicantStatus(a.id,'출근');return;
  }
  if(kind==='decision'){
    viewApplicant(a.id);
    setTimeout(()=>{
      const select=$('detailQuickStatus');
      if(select){select.focus();if(typeof uxToast==='function')uxToast('상태에서 입사예정·불합격·다음면접을 선택해 결과를 기록하세요.');}
    },0);
    return;
  }
  if(kind==='hire'){
    viewApplicant(a.id);return;
  }
  viewApplicant(a.id);
}
window.dailyRunApplicantAction=dailyRunApplicantAction;
function dailyStartFirstWork(){
  const groups=dailyWorkflowGroups();
  const allRows=dailyWorkflowRows(groups);
  const visible=dailyFilterRows(allRows,groups);
  const row=visible[0];
  if(!row){ if(typeof uxToast==='function') uxToast('현재 조건에서 처리할 업무가 없습니다.'); else alert('현재 조건에서 처리할 업무가 없습니다.'); return; }
  const action=dailyActionDescriptor(row);
  dailyRunApplicantAction(action.kind,row.applicant.id);
}
window.dailyStartFirstWork=dailyStartFirstWork;
function dailyWorkflowCard(row){
  const a=row.applicant;
  const reasonHtml=row.reasons
    .sort((x,y)=>x.priority-y.priority)
    .map(r=>`<span class="daily-reason-chip ${r.tone}">${esc(r.label)}</span>`).join('');
  const action=dailyActionDescriptor(row);
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
      <button class="mini" type="button" data-erp-handler="viewApplicant('${a.id}')">상세</button>
      <button class="primary mini" type="button" ${['screening','phone','recall','decision','attendance'].includes(action.kind)?'data-required-permission="applicant.write" ':''}data-erp-handler="dailyRunApplicantAction('${action.kind}','${a.id}')">${esc(action.label)}</button>
    </div>
  </article>`;
}
function updateDailyFilterChips(groups,allRows){
  const counts={all:allRows.length};
  Object.keys(groups).forEach(key=>{counts[key]=(groups[key]||[]).length;});
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
  const summary=window.erpTodayAutomation?.summary(groups)||{dueToday:0,overdue:groups.overdue.length,changedToday:0,urgent:groups.overdue.length+groups.interviewToday.length};
  const metricMap={
    dailyScreeningCount:groups.screening.length,
    dailyPhoneCount:groups.phone.length,
    dailyRecallCount:groups.recall.length,
    dailyInterviewTodayCount:groups.interviewToday.length,
    dailyResultPendingCount:groups.resultPending.length,
    dailyHireUpcomingCount:groups.hireUpcoming.length,
    dailyAttendancePendingCount:groups.attendancePending.length,
    dailyStagnantCount:groups.stagnant.length
  };
  Object.entries(metricMap).forEach(([id,value])=>setText(id,value));
  setText('dailySummaryUrgent',summary.urgent);
  setText('dailySummaryDueToday',summary.dueToday);
  setText('dailySummaryOverdue',summary.overdue);
  setText('dailySummaryChangedToday',summary.changedToday);
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
    if(e.target.closest('#btnDailyStartFirst')){dailyStartFirstWork();return;}
    if(e.target.closest('#btnDailyWorkflowRefresh')){renderToday();renderEmployeeLinkTask();}
  });
  const search=$('dailyWorkflowSearch');
  if(search) search.addEventListener('input',e=>{dailyWorkflowSearch=e.target.value||'';renderToday();});
})();
