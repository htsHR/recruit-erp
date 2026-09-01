function badgeClass(status){
  if(['불합격','서류탈락','면접거절','면접불참','입사철회','철회','연락두절'].includes(status)) return 'bad';
  if(status==='서류탈락') return 'neutral';
  if(['입사예정','출근'].includes(status)) return 'good';
  if(['면접예정','다음면접','면접완료'].includes(status)) return 'info';
  if(status==='서류합격') return 'pass';
  if(['서류검토','부재중'].includes(status)) return 'missed';
  return 'hold';
}
function statusToneClass(a){ return normalizeStatus(a?.status)==='서류탈락' ? 'is-paper-rejected' : ''; }
function applicantRowToneClass(a){
  const status=normalizeStatus(a?.status);
  if(isFinished(a)) return 'is-finished';
  if(['입사예정','출근'].includes(status) || a?.finalDecision==='합격') return 'is-hire-track';
  if(['면접예정','다음면접','면접완료'].includes(status)) return 'is-interview-track';
  if(['서류검토','부재중'].includes(status)) return 'is-contact-track';
  return 'is-neutral-track';
}
function workplaceBadgeClass(value){
  const workplace=String(value||'').trim();
  if(workplace==='천안') return 'workplace-cheonan';
  if(workplace==='평택') return 'workplace-pyeongtaek';
  if(!workplace) return 'workplace-empty';
  return 'workplace-other';
}
function nextAction(a){
  if(!a.status || a.status==='서류검토') return '서류 검토·첫 연락';
  if(a.status==='서류합격') return '면접 일정 조율';
  if(a.status==='부재중') return '재연락';
  if(a.status==='면접예정') return '면접 일정 확인';
  if(a.status==='면접완료') return a.finalDecision ? a.finalDecision : '결과 입력';
  if(a.status==='다음면접') return '다음 면접 조율';
  if(a.status==='출근') return '출근 완료';
  if(a.status==='입사예정') return '입사 안내';
  
  return a.finalDecision || '-';
}
function isFinished(a){ return ['불합격','서류탈락','면접거절','면접불참','입사철회','철회','연락두절'].includes(a.status) || ['불합격','입사포기','입사철회'].includes(a.finalDecision); }
function isActive(a){ return !isFinished(a); }
// v10.49.0.1: 면접일이 남아 있다는 이유만으로 '면접 확정'으로 취급하지 않는다.
// 현재 상태가 면접 단계 이상이거나, 진행 이력상 실제 면접 단계에 진입했던 경우만 유효한 면접일로 본다.
const INTERVIEW_STAGE_STATUSES=new Set(['면접예정','면접완료','다음면접','입사예정','출근','불합격','면접불참']);
const INTERVIEW_ACTIVE_STATUSES=new Set(['면접예정','다음면접']);
function hasInterviewStageHistory(a){
  const history=Array.isArray(a?.progressHistory)?a.progressHistory:[];
  return history.some(h=>h && h.type==='status' && INTERVIEW_STAGE_STATUSES.has(normalizeStatus(h.after||'')));
}
function isInterviewScheduleActive(a){ return !!a?.interviewDate && INTERVIEW_ACTIVE_STATUSES.has(normalizeStatus(a?.status)); }
function isInterviewDateMeaningful(a){
  if(!a?.interviewDate) return false;
  const st=normalizeStatus(a?.status);
  return INTERVIEW_STAGE_STATUSES.has(st) || hasInterviewStageHistory(a);
}
function isHireDateMeaningful(a){ return !!a?.hireDate && ['입사예정','출근'].includes(normalizeStatus(a?.status)); }
function hasFinalDecision(a){ return !!String(a?.finalDecision || '').trim(); }
function isDecisionNeeded(a){ return isActive(a) && a.status === '면접완료' && !hasFinalDecision(a); }
function findApplicantPhoneEmailDuplicate(data,excludeId=''){
  const phone=normalizePhone(data?.phone),email=String(data?.email||'').trim();
  return applicants.find(a=>String(a.id)!==String(excludeId)&&((phone&&phone.length>=8&&normalizePhone(a.phone)===phone)||(email&&String(a.email||'').trim()===email)));
}

function datePlus(days){
  const d = new Date(today() + 'T00:00:00');
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function daysUntil(dateStr){
  if(!dateStr) return null;
  const base = new Date(today() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  if(Number.isNaN(target.getTime())) return null;
  return Math.round((target - base) / 86400000);
}
function daysSinceApply(a){
  const d = daysUntil(a.applyDate);
  return d===null ? null : -d;
}
function isDormPending(a){
  const d=dormLabel(a);
  return isActive(a) && (d === '미확인' || d === '확인필요');
}
function isHireSoon(a){
  // v10.49.0.1: 입사일 잔존값이 부재중/면접거절 등 다른 상태를 입사 임박으로 오인하지 않게
  // 실제 입사 대기 상태인 '입사예정'만 집계한다.
  if(normalizeStatus(a?.status)!=='입사예정') return false;
  const d = daysUntil(a.hireDate);
  return d !== null && d >= 0 && d <= 3;
}
function countText(n){ return `${n}명`; }
function setText(id, value){ const el=$(id); if(el) el.textContent=value; }

function setPage(page){
  const corePages=new Set(['home','applicants','form','today','calendar','backup']);
  if(!corePages.has(page))page='home';
  if(page!=='applicants'&&applicantQuickDetailIsOpen()&&closeApplicantQuickDetail({restoreFocus:false})===false)return false;
  document.body.dataset.activePage=page;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titleMap = {home:'오늘 업무',applicants:'지원자',form:'신규 지원자 등록',today:'오늘 처리 목록',calendar:'일정·평가표',backup:'백업'};
  const descMap = {
    home:'오늘 처리할 일과 주요 현황을 한곳에서 확인합니다.',
    applicants:'지원자 진행상태와 면접·입사 일정을 관리합니다.',
    form:'새 지원자의 기본정보와 전형정보를 등록합니다.',
    today:'오늘 우선 처리할 채용 업무를 확인합니다.',
    calendar:'면접·입사 일정과 선택 날짜의 평가표를 확인·출력합니다.',
    backup:'ERP 데이터를 암호화 백업하고 필요할 때 복원합니다.'
  };
  $('page-title').textContent = titleMap[page] || '홈';
  const breadcrumb=document.querySelector('.topbar-breadcrumb');
  if(breadcrumb) breadcrumb.textContent=descMap[page] || 'Recruit ERP 운영 대시보드';
  if(window.innerWidth<=1020) document.body.classList.remove('sidebar-mobile-open');
  if(page==='form' && !$('applyDate').value) $('applyDate').value = today();
  const topActions = document.querySelector('.top-actions:not(.form-top-actions)');
  const formTopActions = document.querySelector('.form-top-actions');
  if(topActions) topActions.style.display = ['home','applicants'].includes(page) ? 'flex' : 'none';
  if(formTopActions) formTopActions.style.display = page==='form' ? 'flex' : 'none';
  renderAll();
}
function taskGroups(){
  const t=today();
  // v10.48.1: 오늘/임박 면접은 면접일 존재로만 판정하던 기존 로직인데, 서류합격은 아직
  // 면접 확정 전 단계라 면접일이 우연히 들어있어도 이 집계엔 넣지 않는다(홈 KPI·통계 공용).
  const todayInterviews=applicants.filter(a=>isActive(a) && a.interviewDate===t && isInterviewScheduleActive(a));
  const upcomingInterviews=applicants.filter(a=>{
    if(!isActive(a)) return false;
    const st=normalizeStatus(a.status);
    if(!INTERVIEW_ACTIVE_STATUSES.has(st)) return false;
    if(a.interviewDate && a.interviewDate!==t && daysUntil(a.interviewDate) >= 0) return true;
    return !a.interviewDate;
  }).sort((a,b)=>{
    const av=a.interviewDate || '9999-12-31';
    const bv=b.interviewDate || '9999-12-31';
    return (av+' '+(a.interviewTime||'23:59')).localeCompare(bv+' '+(b.interviewTime||'23:59'));
  });
  const recalls=applicants.filter(a=>{
    if(!isActive(a)) return false;
    const next=a.nextContactDate||'';
    const statusNeeds=['부재중','서류검토'].includes(a.status);
    return next===t || (statusNeeds && (!next || next<=t));
  });
  const dorms=applicants.filter(isDormPending);
  // v10.48.1.1: D-7/D-3/당일 입사 집계도 입사일 존재 여부만 보던 것이라 동일하게 서류합격 제외
  const hireD7=applicants.filter(a=>normalizeStatus(a.status)==='입사예정' && daysUntil(a.hireDate)===7);
  const hireD3=applicants.filter(a=>normalizeStatus(a.status)==='입사예정' && daysUntil(a.hireDate)===3);
  const hireToday=applicants.filter(a=>normalizeStatus(a.status)==='입사예정' && daysUntil(a.hireDate)===0);
  const hireSoon=applicants.filter(isHireSoon);
  const decisions=applicants.filter(isDecisionNeeded);
  const weekInterviews=applicants.filter(a=>isActive(a) && isInterviewScheduleActive(a) && daysUntil(a.interviewDate)>=0 && daysUntil(a.interviewDate)<=6);
  const overdue=applicants.filter(a=>{
    if(!isActive(a)) return false;
    const contactOverdue=a.nextContactDate && daysUntil(a.nextContactDate)<0;
    const interviewOverdue=a.interviewDate && daysUntil(a.interviewDate)<0 && ['면접예정','다음면접'].includes(a.status);
    const hireOverdue=a.hireDate && daysUntil(a.hireDate)<0 && a.status==='입사예정';
    return contactOverdue || interviewOverdue || hireOverdue;
  });
  const waits=applicants.filter(a=>isActive(a) && (['입사예정'].includes(a.status)||['입사예정','보류'].includes(a.finalDecision))); 
  return {todayInterviews,upcomingInterviews,tomorrowInterviews:upcomingInterviews,recalls,dorms,hireD7,hireD3,hireToday,hireSoon,decisions,weekInterviews,overdue,waits};
}
function renderStats(){
  const total=applicants.length;
  const active=applicants.filter(isActive).length;
  const g=taskGroups();
  const data=[
    ['전체 지원자',total],
    ['진행중',active],
    ['오늘 면접',g.todayInterviews.length],
    ['기한 경과',g.overdue.length]
  ];
  $('statsGrid').innerHTML=data.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
  setText('homeTodayInterviewCount',g.todayInterviews.length);
  setText('homeTomorrowInterviewCount',g.upcomingInterviews.length);
  setText('homeContactCount',g.recalls.length);
  setText('homeDormCheckCount',g.dorms.length);
  setText('homeCheckCount',g.dorms.length);
  setText('homeHireSoonCount',g.hireSoon.length);
  setText('homeWeekInterviewCount',g.weekInterviews.length);
  setText('homeOverdueCount',g.overdue.length);
  setText('homeDecisionCount',g.decisions.length);
}
function backupNotice(){
  const last = localStorage.getItem(BACKUP_KEY);
  const msg = last ? `마지막 JSON 백업: ${last}` : '백업은 백업/내보내기 메뉴에서 필요할 때 진행할 수 있습니다.';
  setText('backupAlert', msg);
  setText('lastBackupText', last || '기록 없음');
  setText('backupApplicantCount', countText(applicants.length));
  setText('backupStorageKey', STORAGE_KEY);
}
function shortNeeds(a){ return displayCheckNeeds(a.checkNeeds).split(',').map(x=>x.trim()).filter(Boolean).slice(0,2); }
function needsHtml(a){ const needs=shortNeeds(a); return needs.length?`<div class="need-tags">${needs.map(n=>`<span class="need-tag">${esc(n)}</span>`).join('')}</div>`:'-'; }
function miniStepperHtml(a){
  // v10.48.1.3: 홈 카드에 진행 위치를 점 4개로 표시. 종료 상태는 이미 카드 자체가 흐리게
  // 처리되므로 스텝퍼는 생략(혼동 방지). 서류/서류합격/면접/입사 4단계로 단순화.
  if(isFinished(a)) return '';
  const stage =
    ['입사예정','출근'].includes(a.status) ? 3 :
    ['면접예정','다음면접','면접완료'].includes(a.status) ? 2 :
    a.status==='서류합격' ? 1 : 0;
  const dots=[0,1,2,3].map(i=>`<i class="${i<=stage?'on':''}"></i>`).join('<em></em>');
  return `<div class="mini-stepper" aria-hidden="true">${dots}</div>`;
}
function card(a){
  const dorm=dormLabel(a);
  const schedule=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ');
  const scheduleText=schedule ? `면접 ${schedule} · ` : '';
  return `<div class="person-card compact-person-card ${statusToneClass(a)}">
    <div><strong><span class="person-name ${genderClass(a)}">${esc(a.name||'이름없음')}</span>
    <span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></strong>
    <small>${esc(scheduleText)}${esc(a.workplace||'근무지 미입력')} · ${esc(dorm)}${a.school?` · ${esc(a.school)}`:''}</small>
    ${miniStepperHtml(a)}</div>
    <button class="mini" data-erp-handler="editApplicant('${a.id}')">수정</button></div>`;
}
/* =========================================================
   v10.12.5 일정 리마인더 배너
   - 홈 화면 최상단에 오늘/내일 면접·입사·중요일정 요약 배너 표시
   - "오늘은 닫기" 누르면 그날 하루는 다시 안 뜨고, 날짜 바뀌면 자동 재노출
   - calendarItemsOn()을 그대로 재사용해 캘린더 데이터와 항상 일치
   ========================================================= */
function renderScheduleReminder(){
  const el = $('scheduleReminder');
  if(!el) return;
  const todayStr = today();
  if(localStorage.getItem(REMINDER_DISMISS_KEY) === todayStr){ el.style.display='none'; el.innerHTML=''; return; }
  const tomorrowStr = datePlus(1);
  const todayItems = calendarItemsOn(todayStr);
  const tomorrowItems = calendarItemsOn(tomorrowStr);
  const countType = (items, type) => items.filter(i=>i.type===type).length;
  const todayInterview = countType(todayItems,'면접');
  const todayHire = countType(todayItems,'입사');
  const tomorrowInterview = countType(tomorrowItems,'면접');
  const tomorrowHire = countType(tomorrowItems,'입사');
  const tomorrowImportant = tomorrowItems.filter(i=>i.kind==='custom' && ['high','urgent'].includes(i.importance)).length;
  const hasToday = todayInterview || todayHire;
  const hasTomorrow = tomorrowInterview || tomorrowHire || tomorrowImportant;
  if(!hasToday && !hasTomorrow){ el.style.display='none'; el.innerHTML=''; return; }
  const segs=[];
  if(hasToday) segs.push(`오늘: ${[todayInterview&&`면접 ${todayInterview}건`, todayHire&&`입사 ${todayHire}건`].filter(Boolean).join(' · ')}`);
  if(hasTomorrow) segs.push(`내일(${tomorrowStr.slice(5).replace('-','.')}): ${[tomorrowInterview&&`면접 ${tomorrowInterview}건`, tomorrowHire&&`입사 ${tomorrowHire}건`, tomorrowImportant&&`중요일정 ${tomorrowImportant}건`].filter(Boolean).join(' · ')}`);
  el.style.display='flex';
  el.innerHTML = `<div class="reminder-text"><strong>일정 알림</strong><span>${esc(segs.join('  ·  '))}</span></div><div class="reminder-actions"><button class="mini" data-erp-handler="setPage('calendar')">캘린더 보기</button><button class="mini" data-erp-handler="dismissScheduleReminder()">오늘은 닫기</button></div>`;
}
function dismissScheduleReminder(){ localStorage.setItem(REMINDER_DISMISS_KEY, today()); renderScheduleReminder(); }
function renderHomeLists(){
  const selection=window.dailyWorkflowSelection?.();
  const priority=(selection?.rows||[]).slice(0,4);
  const recent=[...applicants].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  $('priorityList').innerHTML=priority.length?priority.map(row=>window.dailyHomeWorkflowCard?.(row)||card(row.applicant)).join(''):`<div class="empty home-daily-empty"><strong>지금 바로 처리할 업무가 없습니다.</strong><button class="ghost" type="button" data-go="applicants">지원자 목록 보기</button></div>`;
  $('recentList').innerHTML=recent.length?recent.map(card).join(''):`<div class="empty">등록된 지원자가 없습니다.</div>`;
}
function duplicatePhoneSet(){
  const counts={};
  applicants.forEach(a=>{
    const p=normalizePhone(a.phone);
    if(p.length>=8){ counts[p]=(counts[p]||0)+1; }
  });
  return new Set(Object.keys(counts).filter(p=>counts[p]>1));
}
function filtered(){
  const dupSet = currentFilter==='duplicate' ? duplicatePhoneSet() : null;
  const todayActionIds=currentFilter==='todayAction'?new Set((window.dailyWorkflowSelection?.().rows||[]).map(row=>String(row.applicant.id))):null;
  let rows = applicants.filter(a=>{
    const workplaceOk=currentWorkplace==='all'||(currentWorkplace==='기타'?!['천안','평택'].includes(a.workplace):a.workplace===currentWorkplace);
    const text=[a.name,a.phone,a.source].join(' ').toLowerCase();
    const searchOk=!currentSearch||text.includes(currentSearch.toLowerCase());
    let filterOk=true;
    if(currentFilter==='contact') filterOk=['서류검토','부재중'].includes(a.status);
    if(currentFilter==='docpass') filterOk=a.status==='서류합격';
    if(currentFilter==='interview') filterOk=['면접예정','다음면접'].includes(a.status);
    if(currentFilter==='decision') filterOk=isDecisionNeeded(a);
    if(currentFilter==='hold') filterOk=a.finalDecision==='보류';
    if(currentFilter==='active') filterOk=isActive(a);
    if(currentFilter==='hire') filterOk=['입사예정','출근'].includes(a.status) || a.finalDecision==='합격';
    if(currentFilter==='hirePlanned') filterOk=normalizeStatus(a.status)==='입사예정';
    if(currentFilter==='finished') filterOk=isFinished(a);
    if(currentFilter==='rejected') filterOk=a.status==='서류탈락';
    if(currentFilter==='duplicate') filterOk=dupSet.has(normalizePhone(a.phone));
    if(currentFilter==='todayAction') filterOk=todayActionIds.has(String(a.id));
    return workplaceOk && searchOk && filterOk;
  });
  if(hideFinished) rows = rows.filter(isActive);
  if(Array.isArray(window.__erpAdvancedFilterIds)) {
    const advancedIds = new Set(window.__erpAdvancedFilterIds);
    rows = rows.filter(a=>advancedIds.has(a.id));
  }
  rows.sort((a,b)=>{
    if(currentSort==='applyDesc') return (b.applyDate||'').localeCompare(a.applyDate||'');
    if(currentSort==='applyAsc') return (a.applyDate||'').localeCompare(b.applyDate||'');
    if(currentSort==='interviewAsc'){
      const av=(a.interviewDate||'9999-12-31')+' '+(a.interviewTime||'23:59');
      const bv=(b.interviewDate||'9999-12-31')+' '+(b.interviewTime||'23:59');
      return av.localeCompare(bv);
    }
    if(currentSort==='nameAsc') return (a.name||'').localeCompare(b.name||'', 'ko');
    return (b.createdAt||'').localeCompare(a.createdAt||'');
  });
  return rows;
}
function resetListFiltersToAll(){
  currentApplicantPage=1; lastApplicantFilterSignature='';
  currentWorkplace='all'; currentFilter='all'; currentSearch=''; currentSort='recent'; hideFinished=false;
  if($('searchInput')) $('searchInput').value='';
  if($('sortSelect')) $('sortSelect').value='recent';
  if($('hideFinished')) $('hideFinished').checked=false;
  document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.workplace==='all'));
  document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.toggle('active', x.dataset.filter==='all'));
}
function updateApplicantListFilterCounts(){
  const duplicateSet=duplicatePhoneSet();
  const filterCounts={
    all:applicants.length,
    active:applicants.filter(isActive).length,
    interview:applicants.filter(a=>['면접예정','다음면접'].includes(a.status)).length,
    hire:applicants.filter(a=>['입사예정','출근'].includes(a.status) || a.finalDecision==='합격').length,
    finished:applicants.filter(isFinished).length,
    contact:applicants.filter(a=>['서류검토','부재중'].includes(a.status)).length,
    docpass:applicants.filter(a=>a.status==='서류합격').length,
    decision:applicants.filter(isDecisionNeeded).length,
    duplicate:applicants.filter(a=>duplicateSet.has(normalizePhone(a.phone))).length
  };
  filterCounts.todayAction=window.dailyWorkflowSelection?.()?.rows?.length||0;
  document.querySelectorAll('#quickFilters [data-filter]').forEach(button=>{
    const count=filterCounts[button.dataset.filter] ?? 0;
    const target=button.querySelector('[data-filter-count]');
    if(target) target.textContent=String(count);
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });
  const auxiliary=['contact','active','docpass','hire','finished','decision','duplicate'];
  const selectedAuxiliary=auxiliary.includes(currentFilter)?1:0;
  const summary=document.getElementById('applicantAuxiliaryFilterSummary');
  if(summary)summary.textContent=selectedAuxiliary?`상태 더보기 · ${selectedAuxiliary}개 적용`:'상태 더보기';
  setText('applicantHeaderTotalCount', filterCounts.all);
  setText('applicantHeaderActiveCount', filterCounts.active);
  setText('applicantHeaderInterviewCount', filterCounts.interview);
  setText('applicantHeaderFinishedCount', filterCounts.finished);
  const workplaceCounts={
    all:applicants.length,
    '천안':applicants.filter(a=>a.workplace==='천안').length,
    '평택':applicants.filter(a=>a.workplace==='평택').length,
    '기타':applicants.filter(a=>!['천안','평택'].includes(a.workplace)).length
  };
  document.querySelectorAll('#workplaceTabs [data-workplace]').forEach(button=>{
    const target=button.querySelector('[data-workplace-count]');
    if(target) target.textContent=String(workplaceCounts[button.dataset.workplace] ?? 0);
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });
}
function applicantFilterSignature(){
  return JSON.stringify([currentWorkplace,currentFilter,currentSearch,currentSort,hideFinished]);
}
function applicantPageWindow(totalPages,current){
  if(totalPages<=7) return Array.from({length:totalPages},(_,i)=>i+1);
  const out=[1];
  const from=Math.max(2,current-2),to=Math.min(totalPages-1,current+2);
  if(from>2) out.push('…');
  for(let i=from;i<=to;i++)out.push(i);
  if(to<totalPages-1)out.push('…');
  out.push(totalPages); return out;
}
function goApplicantPage(page){
  currentApplicantPage=Math.max(1,Number(page)||1); renderTable();
  document.querySelector('#applicants .table-wrap')?.scrollTo({top:0,behavior:'smooth'});
}
function changeApplicantPageSize(value){
  const next=[30,50,100].includes(Number(value))?Number(value):30;
  applicantPageSize=next; currentApplicantPage=1; renderTable();
}
window.goApplicantPage=goApplicantPage;
window.changeApplicantPageSize=changeApplicantPageSize;

const APPLICANT_QUICK_DETAIL_EMPTY='미입력';
const APPLICANT_QUICK_EDIT_FIELDS=Object.freeze(['name','phone','email','region','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo']);
const applicantQuickDetailState={id:'',trigger:null,context:null,mode:'view',baseline:'',feedback:''};
function applicantQuickDetailIsOpen(){return !!document.getElementById('applicantQuickDetail')?.classList.contains('is-open');}
function applicantQuickDetailCanRead(){return !window.erpPermissions||window.erpPermissions.has('applicant.read');}
function applicantQuickDetailCanWrite(){return !window.erpPermissions||window.erpPermissions.has('applicant.write');}
function applicantQuickDetailValue(value){const text=String(value??'').trim();return{text:text||APPLICANT_QUICK_DETAIL_EMPTY,empty:!text};}
function applicantQuickDetailCombined(...values){return applicantQuickDetailValue(values.map(value=>String(value??'').trim()).filter(Boolean).join(' '));}
function applicantQuickDetailField(label,value,{wide=false}={}){
  const normalized=applicantQuickDetailValue(value);
  return `<div class="applicant-quick-detail-field ${wide?'is-wide':''}"><dt>${esc(label)}</dt><dd class="${normalized.empty?'is-empty':''}">${esc(normalized.text)}</dd></div>`;
}
function applicantQuickDetailSection(title,fields){return `<section class="applicant-quick-detail-section"><h4>${esc(title)}</h4><dl class="applicant-quick-detail-grid">${fields.join('')}</dl></section>`;}
function applicantQuickDetailDayStatus(value){
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return{text:'미정',tone:'is-empty'};
  const now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),target=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]));
  const days=Math.round((target-today)/86400000);
  if(days===0)return{text:'D-Day · 오늘 확인',tone:'is-today'};
  if(days>0)return{text:`D-${days}`,tone:'is-upcoming'};
  return{text:`${Math.abs(days)}일 경과 · 확인 필요`,tone:'is-overdue'};
}
function applicantQuickDetailHistoryLabel(type){return({status:'상태·사유',manager:'과거 담당자 기록',contact:'연락',schedule:'일정',memo:'메모',reason:'사유',created:'등록'})[type]||'진행';}
function applicantQuickDetailLatestHistory(applicant){
  const rows=Array.isArray(applicant.progressHistory)?[...applicant.progressHistory]:[];
  return rows.sort((left,right)=>String(right?.createdAt||'').localeCompare(String(left?.createdAt||'')))[0]||null;
}
function applicantQuickDetailNextAction(applicant){
  const last=applicantQuickDetailValue(applicant.lastContactDate||'기록 없음'),next=applicantQuickDetailValue(applicant.nextContactDate||'미정'),day=applicantQuickDetailDayStatus(applicant.nextContactDate),history=applicantQuickDetailLatestHistory(applicant);
  const historyDate=String(history?.createdAt||'').slice(0,10)||'기록 없음',historyType=history?applicantQuickDetailHistoryLabel(history.type):'기록 없음',historySummary=history?(history.summary||history.title||history.detail||'기록 없음'):'기록 없음';
  return `<section class="applicant-quick-detail-section applicant-quick-detail-next-action" aria-label="다음 액션 요약"><h4>다음 액션</h4><div class="applicant-quick-detail-action-grid"><div><span>마지막 연락일</span><strong class="${last.empty?'is-empty':''}">${esc(last.text)}</strong></div><div><span>다음 연락 예정일</span><strong class="${next.empty?'is-empty':''}">${esc(next.text)}</strong></div><div class="${day.tone}"><span>처리 상태</span><strong>${esc(day.text)}</strong></div></div><div class="applicant-quick-detail-latest-history"><span>최근 진행 이력</span><strong>${esc(historyDate)} · ${esc(historyType)}</strong><p>${esc(historySummary)}</p></div></section>`;
}
function applicantQuickEditOption(value,label,current){return `<option value="${esc(value)}" ${String(value)===String(current||'')?'selected':''}>${esc(label)}</option>`;}
function applicantQuickEditOptions(values,current,{empty='선택'}={}){return applicantQuickEditOption('',empty,current)+values.map(value=>applicantQuickEditOption(value,value,current)).join('');}
function applicantQuickEditHtml(applicant){
  const workplaceValues=[...new Set(['천안','평택','기타',applicant.workplace].filter(Boolean))];
  return `<form class="applicant-quick-edit-form" id="applicantQuickEditForm" novalidate>
    <div class="applicant-quick-edit-grid">
      <label>성명<input data-quick-field="name" required maxlength="80" value="${esc(applicant.name||'')}"></label>
      <label>연락처<input data-quick-field="phone" inputmode="tel" maxlength="40" value="${esc(applicant.phone||'')}"></label>
      <label class="is-wide">이메일<input data-quick-field="email" type="email" maxlength="160" value="${esc(applicant.email||'')}"></label>
      <label>지역<input data-quick-field="region" maxlength="100" value="${esc(applicant.region||'')}"></label>
      <label>지원근무지<select data-quick-field="workplace">${applicantQuickEditOptions(workplaceValues,applicant.workplace)}</select></label>
      <label>현재 단계<select data-quick-field="status">${statusOptionsHtml(applicant.status)}</select></label>
      <label>면접날짜<input data-quick-field="interviewDate" type="date" value="${esc(applicant.interviewDate||'')}"></label>
      <label>면접시간<input data-quick-field="interviewTime" type="time" value="${esc(applicant.interviewTime||'')}"></label>
      <label>입사날짜<input data-quick-field="hireDate" type="date" value="${esc(applicant.hireDate||'')}"></label>
      <label>지원경로<input data-quick-field="source" maxlength="160" value="${esc(applicant.source||'')}"></label>
      <label>지원구분<select data-quick-field="careerType">${applicantQuickEditOptions(['신입','경력'],applicant.careerType)}</select></label>
      <label>출근방법<select data-quick-field="dormUse">${applicantQuickEditOptions(['기숙사','출퇴근','확인필요'],applicant.dormUse)}</select></label>
      <label class="is-wide">메모<textarea data-quick-field="memo" rows="6" maxlength="5000">${esc(applicant.memo||'')}</textarea></label>
    </div>
    <p class="applicant-quick-edit-feedback ${applicantQuickDetailState.feedback?'is-error':''}" id="applicantQuickEditFeedback" role="status" aria-live="polite">${esc(applicantQuickDetailState.feedback)}</p>
  </form>`;
}
function applicantQuickEditValues(){
  const form=document.getElementById('applicantQuickEditForm'),values={};
  APPLICANT_QUICK_EDIT_FIELDS.forEach(field=>{values[field]=String(form?.querySelector(`[data-quick-field="${field}"]`)?.value||'').trim();});
  values.phone=formatPhoneDisplay(values.phone);values.status=normalizeStatus(values.status);values.dormUse=normalizeDorm(values.dormUse);return values;
}
function applicantQuickEditSignature(values=applicantQuickEditValues()){return JSON.stringify(APPLICANT_QUICK_EDIT_FIELDS.map(field=>values[field]||''));}
function applicantQuickDetailIsDirty(){return applicantQuickDetailState.mode==='edit'&&!!applicantQuickDetailState.baseline&&applicantQuickEditSignature()!==applicantQuickDetailState.baseline;}
function applicantQuickDetailConfirmDiscard(){return !applicantQuickDetailIsDirty()||confirm('빠른 수정 중인 내용이 저장되지 않았습니다. 이동할까요?');}
function ensureApplicantQuickDetailUi(){
  if(document.getElementById('applicantQuickDetail'))return;
  const shell=document.createElement('div');shell.id='applicantQuickDetail';shell.className='applicant-quick-detail';shell.setAttribute('aria-hidden','true');
  shell.innerHTML='<div class="applicant-quick-detail-backdrop" id="applicantQuickDetailBackdrop"></div><section class="applicant-quick-detail-panel" role="dialog" aria-modal="true" aria-labelledby="applicantQuickDetailTitle" aria-describedby="applicantQuickDetailDescription"><p class="applicant-quick-detail-sr" id="applicantQuickDetailDescription">현재 검색과 정렬 결과에서 지원자 정보를 확인하고 허용된 기본 항목만 빠르게 수정합니다.</p><header class="applicant-quick-detail-header"><div class="applicant-quick-detail-heading"><div><p class="eyebrow" id="applicantQuickDetailEyebrow">핵심 정보 미리보기</p><h3 id="applicantQuickDetailTitle">지원자 빠른 보기</h3><p class="applicant-quick-detail-position" id="applicantQuickDetailPosition" aria-live="polite"></p></div><button class="applicant-quick-detail-close" id="btnApplicantQuickDetailClose" type="button" aria-label="지원자 빠른 보기 닫기">×</button></div><div class="applicant-quick-detail-navigation" aria-label="현재 검색 결과 안에서 이동"><button class="ghost" id="btnApplicantQuickDetailPrevious" type="button">← 이전</button><button class="ghost" id="btnApplicantQuickDetailNext" type="button">다음 →</button></div></header><div class="applicant-quick-detail-body" id="applicantQuickDetailBody"></div><footer class="applicant-quick-detail-footer"><button class="ghost" id="btnApplicantQuickDetailFull" type="button">전체 상세보기</button><button class="ghost" id="btnApplicantQuickDetailCancel" type="button" hidden>취소</button><button class="primary" id="btnApplicantQuickDetailEdit" type="button" data-required-permission="applicant.write">수정</button><button class="primary" id="btnApplicantQuickDetailSave" type="button" data-required-permission="applicant.write" hidden>저장</button></footer></section>';
  document.body.appendChild(shell);
  document.getElementById('applicantQuickDetailBackdrop')?.addEventListener('click',()=>closeApplicantQuickDetail());
  document.getElementById('btnApplicantQuickDetailClose')?.addEventListener('click',()=>closeApplicantQuickDetail());
  document.getElementById('btnApplicantQuickDetailPrevious')?.addEventListener('click',()=>moveApplicantQuickDetail(-1));
  document.getElementById('btnApplicantQuickDetailNext')?.addEventListener('click',()=>moveApplicantQuickDetail(1));
  document.getElementById('btnApplicantQuickDetailFull')?.addEventListener('click',openApplicantQuickDetailFull);
  document.getElementById('btnApplicantQuickDetailEdit')?.addEventListener('click',startApplicantQuickEdit);
  document.getElementById('btnApplicantQuickDetailCancel')?.addEventListener('click',cancelApplicantQuickEdit);
  document.getElementById('btnApplicantQuickDetailSave')?.addEventListener('click',saveApplicantQuickEdit);
  shell.addEventListener('submit',event=>{if(event.target?.id==='applicantQuickEditForm'){event.preventDefault();saveApplicantQuickEdit();}});
  shell.addEventListener('keydown',applicantQuickDetailKeydown);
}
function applicantQuickDetailRow(id){return [...document.querySelectorAll('#applicantTbody .applicant-row')].find(row=>String(row.dataset.applicantId)===String(id))||null;}
function applicantQuickDetailCapture(trigger){
  const wrap=document.querySelector('#applicants .table-wrap');
  return {windowX:window.scrollX||0,windowY:window.scrollY||document.documentElement.scrollTop||0,tableLeft:wrap?.scrollLeft||0,tableTop:wrap?.scrollTop||0,trigger:trigger||null};
}
function applicantQuickDetailRestoreContext(context){
  if(!context)return;
  requestAnimationFrame(()=>{const wrap=document.querySelector('#applicants .table-wrap');if(wrap){wrap.scrollLeft=context.tableLeft;wrap.scrollTop=context.tableTop;}window.scrollTo(context.windowX,context.windowY);});
}
function applicantQuickDetailMarkSelected(){
  document.querySelectorAll('#applicantTbody .applicant-row').forEach(row=>{
    const selected=applicantQuickDetailIsOpen()&&String(row.dataset.applicantId)===String(applicantQuickDetailState.id);
    row.classList.toggle('is-quick-detail-selected',selected);row.setAttribute('aria-expanded',selected?'true':'false');
    if(selected)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');
  });
}
function renderApplicantQuickDetail(){
  if(!applicantQuickDetailIsOpen())return false;
  const rows=filtered(),index=rows.findIndex(row=>String(row.id)===String(applicantQuickDetailState.id));
  const applicant=(index>=0?rows[index]:applicants.find(row=>String(row.id)===String(applicantQuickDetailState.id)));if(!applicant){closeApplicantQuickDetail({restoreFocus:false,force:true});return false;}
  const name=applicantQuickDetailValue(applicant.name),status=applicantQuickDetailValue(normalizeStatus(applicant.status)),workplace=applicantQuickDetailValue(applicant.workplace),nextSchedule=window.erpUx12?.scheduleOf?.(applicant)||{label:'일정',value:[applicant.interviewDate,applicant.interviewTime].filter(Boolean).join(' ')||applicant.hireDate||applicant.nextContactDate||'미정'};
  const body=document.getElementById('applicantQuickDetailBody'),position=document.getElementById('applicantQuickDetailPosition'),eyebrow=document.getElementById('applicantQuickDetailEyebrow'),title=document.getElementById('applicantQuickDetailTitle'),panel=document.querySelector('.applicant-quick-detail-panel');
  const editing=applicantQuickDetailState.mode==='edit';panel?.classList.toggle('is-editing',editing);if(eyebrow)eyebrow.textContent=editing?'허용 항목 빠른 수정':'핵심 정보 미리보기';if(title)title.textContent=editing?`${name.text} 빠른 수정`:'지원자 빠른 보기';
  if(position)position.textContent=index>=0?`검색 결과 ${index+1} / ${rows.length} · ${editing?'수정 중':'읽기 전용'}`:`현재 필터에서 제외됨 · ${editing?'수정 중':'읽기 전용'}`;
  const sourceLine=String(applicant.source||'').trim()?`<p>${esc(applicant.source)}</p>`:'';
  if(body&&!editing)body.innerHTML=`<div class="applicant-quick-detail-summary"><div><h4>${esc(name.text)}</h4>${sourceLine}</div><div class="applicant-quick-detail-badges"><span>${esc(status.text)}</span><span>${esc(workplace.text)}</span></div></div><section class="applicant-quick-detail-priority" aria-label="지원자 핵심 정보"><div><span>연락처</span><strong>${esc(applicant.phone||APPLICANT_QUICK_DETAIL_EMPTY)}</strong></div><div><span>학교</span><strong>${esc(applicant.school||APPLICANT_QUICK_DETAIL_EMPTY)}</strong></div><div><span>${esc(nextSchedule.label||'다음 일정')}</span><strong>${esc(nextSchedule.value||'미정')}</strong></div></section>${applicantQuickDetailNextAction(applicant)}${applicantQuickDetailSection('연락·지원',[applicantQuickDetailField('이메일',applicant.email),applicantQuickDetailField('지역',applicant.region),applicantQuickDetailField('지원일',applicant.applyDate),applicantQuickDetailField('지원경로',applicant.source),applicantQuickDetailField('지원구분',applicant.careerType)])}${applicantQuickDetailSection('일정·근무',[applicantQuickDetailField('면접일시',[applicant.interviewDate,applicant.interviewTime].filter(Boolean).join(' ')),applicantQuickDetailField('입사예정일',applicant.hireDate),applicantQuickDetailField('출근방법',applicant.dormUse||applicant.commuteMethod)])}${applicantQuickDetailSection('학력',[applicantQuickDetailField('최종학력',applicant.education||applicant.finalEducation),applicantQuickDetailField('전공',applicant.major),applicantQuickDetailField('학점',applicant.gradePoint)])}${applicantQuickDetailSection('경력·검토',[applicantQuickDetailField('경력사항',applicant.career,{wide:true}),applicantQuickDetailField('최근 회사',applicant.lastCompany),applicantQuickDetailField('담당업무',applicant.duties),applicantQuickDetailField('자격증',applicant.certs,{wide:true}),applicantQuickDetailField('상담내용',applicant.consult,{wide:true})])}${applicantQuickDetailSection('메모',[applicantQuickDetailField('지원자 메모',applicant.memo,{wide:true}),applicantQuickDetailField('결과·검토 메모',applicant.decisionReason,{wide:true})])}`;
  if(body&&editing&&!body.querySelector('#applicantQuickEditForm'))body.innerHTML=applicantQuickEditHtml(applicant);
  const previous=document.getElementById('btnApplicantQuickDetailPrevious'),next=document.getElementById('btnApplicantQuickDetailNext'),edit=document.getElementById('btnApplicantQuickDetailEdit'),saveButton=document.getElementById('btnApplicantQuickDetailSave'),cancel=document.getElementById('btnApplicantQuickDetailCancel'),full=document.getElementById('btnApplicantQuickDetailFull'),allowed=applicantQuickDetailCanWrite();
  if(previous)previous.disabled=index<=0;if(next)next.disabled=index<0||index===rows.length-1;
  if(edit){edit.hidden=editing||!allowed;edit.disabled=!allowed;edit.setAttribute('aria-disabled',allowed?'false':'true');}
  if(saveButton){saveButton.hidden=!editing||!allowed;saveButton.disabled=!allowed;saveButton.setAttribute('aria-disabled',allowed?'false':'true');}
  if(cancel)cancel.hidden=!editing;if(full)full.hidden=false;
  applicantQuickDetailMarkSelected();
  return true;
}
function openApplicantQuickDetail(id,trigger=null){
  if(!applicantQuickDetailCanRead())return false;
  ensureApplicantQuickDetailUi();
  if(applicantQuickDetailIsOpen()&&String(applicantQuickDetailState.id)!==String(id)&&!applicantQuickDetailConfirmDiscard())return false;
  const rows=filtered(),index=rows.findIndex(row=>String(row.id)===String(id));if(index<0)return false;
  const shell=document.getElementById('applicantQuickDetail'),row=trigger?.closest?.('.applicant-row')||applicantQuickDetailRow(id)||document.activeElement;
  if(!applicantQuickDetailIsOpen()){applicantQuickDetailState.trigger=row;applicantQuickDetailState.context=applicantQuickDetailCapture(row);}
  applicantQuickDetailState.id=String(id);
  applicantQuickDetailState.mode='view';applicantQuickDetailState.baseline='';applicantQuickDetailState.feedback='';
  const targetPage=Math.floor(index/applicantPageSize)+1;
  shell.classList.add('is-open');shell.setAttribute('aria-hidden','false');document.body.classList.add('applicant-quick-detail-open');
  if(targetPage!==currentApplicantPage){currentApplicantPage=targetPage;renderTable();}
  renderApplicantQuickDetail();
  requestAnimationFrame(()=>document.getElementById('btnApplicantQuickDetailClose')?.focus({preventScroll:true}));
  window.erpUx12Router?.onQuickOpen?.(id);
  return true;
}
function openApplicantQuickDetailFromWorkflow(id,trigger=null){
  if(!applicantQuickDetailCanRead()||!applicants.some(row=>String(row.id)===String(id)))return false;
  if(!filtered().some(row=>String(row.id)===String(id))){
    resetListFiltersToAll();
    if(Array.isArray(window.__erpAdvancedFilterIds))window.__erpAdvancedFilterIds=null;
  }
  setPage('applicants');
  renderTable();
  return openApplicantQuickDetail(id,trigger);
}
function closeApplicantQuickDetail(options={}){
  const shell=document.getElementById('applicantQuickDetail');if(!shell?.classList.contains('is-open'))return false;
  if(!options.force&&!applicantQuickDetailConfirmDiscard())return false;
  const restoreFocus=options.restoreFocus!==false,restoreScroll=options.restoreScroll!==false,context=applicantQuickDetailState.context,trigger=applicantQuickDetailState.trigger,currentId=applicantQuickDetailState.id;
  shell.classList.remove('is-open');shell.setAttribute('aria-hidden','true');document.body.classList.remove('applicant-quick-detail-open');applicantQuickDetailMarkSelected();
  if(restoreScroll)applicantQuickDetailRestoreContext(context);
  applicantQuickDetailState.id='';applicantQuickDetailState.trigger=null;applicantQuickDetailState.context=null;applicantQuickDetailState.mode='view';applicantQuickDetailState.baseline='';applicantQuickDetailState.feedback='';
  window.erpUx12Router?.onQuickClose?.();
  if(restoreFocus)requestAnimationFrame(()=>{const target=(trigger&&trigger.isConnected?trigger:applicantQuickDetailRow(currentId));target?.focus?.({preventScroll:true});});
  return true;
}
function moveApplicantQuickDetail(direction){
  if(!applicantQuickDetailIsOpen())return false;
  if(!applicantQuickDetailConfirmDiscard())return false;
  const rows=filtered(),index=rows.findIndex(row=>String(row.id)===String(applicantQuickDetailState.id)),nextIndex=index+Number(direction||0);if(index<0||nextIndex<0||nextIndex>=rows.length)return false;
  applicantQuickDetailState.id=String(rows[nextIndex].id);applicantQuickDetailState.mode='view';applicantQuickDetailState.baseline='';applicantQuickDetailState.feedback='';const targetPage=Math.floor(nextIndex/applicantPageSize)+1;
  if(targetPage!==currentApplicantPage){currentApplicantPage=targetPage;renderTable();}
  const rendered=renderApplicantQuickDetail();window.erpUx12Router?.onQuickChange?.(applicantQuickDetailState.id);return rendered;
}
function openApplicantQuickDetailFull(){const id=applicantQuickDetailState.id;if(!id||!applicantQuickDetailConfirmDiscard())return false;closeApplicantQuickDetail({restoreFocus:false,force:true});window.viewApplicant?.(id);return true;}
function startApplicantQuickEdit(){
  if(!applicantQuickDetailCanWrite()||!applicantQuickDetailIsOpen())return false;
  const applicant=applicants.find(row=>String(row.id)===String(applicantQuickDetailState.id));if(!applicant)return false;
  applicantQuickDetailState.mode='edit';applicantQuickDetailState.feedback='';renderApplicantQuickDetail();applicantQuickDetailState.baseline=applicantQuickEditSignature();requestAnimationFrame(()=>document.querySelector('#applicantQuickEditForm [data-quick-field="name"]')?.focus({preventScroll:true}));return true;
}
function cancelApplicantQuickEdit(){if(applicantQuickDetailState.mode!=='edit')return false;applicantQuickDetailState.mode='view';applicantQuickDetailState.baseline='';applicantQuickDetailState.feedback='';renderApplicantQuickDetail();requestAnimationFrame(()=>document.getElementById('btnApplicantQuickDetailEdit')?.focus({preventScroll:true}));return true;}
function saveApplicantQuickEdit(){
  if(!applicantQuickDetailCanWrite()||applicantQuickDetailState.mode!=='edit')return false;
  const form=document.getElementById('applicantQuickEditForm');if(!form?.reportValidity())return false;
  const values=applicantQuickEditValues();if(!values.name){document.querySelector('#applicantQuickEditForm [data-quick-field="name"]')?.focus();return false;}
  const duplicate=findApplicantPhoneEmailDuplicate(values,applicantQuickDetailState.id);if(duplicate&&!confirm(`중복 가능성이 있습니다: ${duplicate.name}\n그래도 저장할까요?`))return false;
  const index=applicants.findIndex(row=>String(row.id)===String(applicantQuickDetailState.id));if(index<0)return false;
  const before=applicants,baseline=applicantQuickDetailState.baseline,previous=before[index];
  const normalized=normalize({...previous,...Object.fromEntries(APPLICANT_QUICK_EDIT_FIELDS.map(field=>[field,values[field]]))});
  const updated={...previous};APPLICANT_QUICK_EDIT_FIELDS.forEach(field=>{updated[field]=normalized[field];});
  applicants=before.map((row,rowIndex)=>rowIndex===index?updated:row);applicantQuickDetailState.mode='view';applicantQuickDetailState.baseline='';applicantQuickDetailState.feedback='';
  if(!save()){
    applicants=before;applicantQuickDetailState.mode='edit';applicantQuickDetailState.baseline=baseline;applicantQuickDetailState.feedback='저장하지 못했습니다. 입력 내용은 유지되며 기존 지원자 정보는 변경되지 않았습니다.';
    const feedback=document.getElementById('applicantQuickEditFeedback');if(feedback){feedback.textContent=applicantQuickDetailState.feedback;feedback.classList.add('is-error');}
    return false;
  }
  renderApplicantQuickDetail();applicantQuickDetailRestoreContext(applicantQuickDetailState.context);return true;
}
function applicantQuickDetailFocusables(){const shell=document.getElementById('applicantQuickDetail');if(!shell)return[];return [...shell.querySelectorAll('button:not([disabled]):not([hidden]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length&&!element.classList.contains('erp-permission-hidden'));}
function applicantQuickDetailKeydown(event){
  if(!applicantQuickDetailIsOpen())return;
  if(event.key==='Escape'){event.preventDefault();closeApplicantQuickDetail();return;}
  if(event.key!=='Tab')return;
  const focusable=applicantQuickDetailFocusables();if(!focusable.length){event.preventDefault();return;}
  const first=focusable[0],last=focusable.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus({preventScroll:true});}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus({preventScroll:true});}
}
function bindApplicantQuickDetailRows(){
  document.querySelectorAll('#applicantTbody .applicant-row').forEach(row=>{
    row.setAttribute('aria-haspopup','dialog');row.setAttribute('aria-controls','applicantQuickDetail');row.setAttribute('aria-expanded','false');
    row.addEventListener('click',event=>{if(event.target.closest('button,select,a,input,textarea,label,summary,details,[role="button"],[contenteditable="true"]'))return;openApplicantQuickDetail(row.dataset.applicantId,row);});
    row.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key)||event.target.closest('button,select,a,input,textarea,label,summary,details,[role="button"],[contenteditable="true"]'))return;event.preventDefault();openApplicantQuickDetail(row.dataset.applicantId,row);});
  });
}
function applicantQuickDetailAfterListRender(allRows){
  bindApplicantQuickDetailRows();
  if(!applicantQuickDetailIsOpen())return;
  if(!applicants.some(row=>String(row.id)===String(applicantQuickDetailState.id)))closeApplicantQuickDetail({restoreFocus:false,force:true});else applicantQuickDetailMarkSelected();
}
window.openApplicantQuickDetail=openApplicantQuickDetail;
window.openApplicantQuickDetailFromWorkflow=openApplicantQuickDetailFromWorkflow;
window.closeApplicantQuickDetail=closeApplicantQuickDetail;
window.moveApplicantQuickDetail=moveApplicantQuickDetail;
window.erpApplicantQuickDetail={isOpen:applicantQuickDetailIsOpen,isDirty:applicantQuickDetailIsDirty,state:applicantQuickDetailState,fields:APPLICANT_QUICK_EDIT_FIELDS,render:renderApplicantQuickDetail,startEdit:startApplicantQuickEdit,cancelEdit:cancelApplicantQuickEdit,saveEdit:saveApplicantQuickEdit};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureApplicantQuickDetailUi,{once:true});else ensureApplicantQuickDetailUi();
function renderApplicantPagination(totalRows){
  const host=$('applicantPagination'); if(!host)return;
  const totalPages=Math.max(1,Math.ceil(totalRows/applicantPageSize));
  const start=totalRows?(currentApplicantPage-1)*applicantPageSize+1:0;
  const end=Math.min(totalRows,currentApplicantPage*applicantPageSize);
  const pages=applicantPageWindow(totalPages,currentApplicantPage).map(p=>p==='…'?'<span class="page-ellipsis">…</span>':`<button type="button" class="applicant-page-btn ${p===currentApplicantPage?'active':''}" data-erp-handler="goApplicantPage(${p})" ${p===currentApplicantPage?'aria-current="page"':''}>${p}</button>`).join('');
  host.innerHTML=`<div class="applicant-page-summary">${totalRows?`${start}–${end}명 표시`:'표시 인원 없음'} · 전체 ${totalRows}명</div><div class="applicant-page-controls"><button type="button" class="applicant-page-btn" data-erp-handler="goApplicantPage(${currentApplicantPage-1})" ${currentApplicantPage<=1?'disabled':''}>이전</button>${pages}<button type="button" class="applicant-page-btn" data-erp-handler="goApplicantPage(${currentApplicantPage+1})" ${currentApplicantPage>=totalPages?'disabled':''}>다음</button></div><label class="applicant-page-size">페이지당 <select data-erp-change-handler="changeApplicantPageSize(this.value)"><option value="30" ${applicantPageSize===30?'selected':''}>30명</option><option value="50" ${applicantPageSize===50?'selected':''}>50명</option><option value="100" ${applicantPageSize===100?'selected':''}>100명</option></select></label>`;
}
function renderTable(){
  const allRows=filtered();
  const signature=applicantFilterSignature();
  if(signature!==lastApplicantFilterSignature){currentApplicantPage=1;lastApplicantFilterSignature=signature;}
  const totalPages=Math.max(1,Math.ceil(allRows.length/applicantPageSize));
  currentApplicantPage=Math.min(Math.max(1,currentApplicantPage),totalPages);
  const pageStart=(currentApplicantPage-1)*applicantPageSize;
  const rows=allRows.slice(pageStart,pageStart+applicantPageSize);
  updateApplicantListFilterCounts();
  const dupChip=$('duplicateFilterChip');
  if(dupChip){
    const n=applicants.filter(a=>duplicatePhoneSet().has(normalizePhone(a.phone))).length;
    dupChip.classList.toggle('chip-alert', n>0);
  }
  const sortName=$('sortSelect')?.selectedOptions?.[0]?.textContent || '최근 등록순';
  const contactCount=allRows.filter(a=>['서류검토','부재중'].includes(a.status)).length;
  // v10.48.1.1: 면접일 존재만으로 카운트하면 서류합격에 남은 과거 면접일도 잡히므로 명시 제외
  const interviewCount=allRows.filter(a=>INTERVIEW_ACTIVE_STATUSES.has(normalizeStatus(a.status)) || isInterviewDateMeaningful(a)).length;
  const pageText=`${currentApplicantPage} / ${totalPages}페이지`;
  $('listSummary').innerHTML = `
    <div class="list-summary-main">
      <strong>${allRows.length}명</strong>
      <span>검색 결과</span>
      <span>정렬 ${esc(sortName)}</span>
      <span>연락 필요 ${contactCount}명</span>
      <span>면접/예정 ${interviewCount}명</span>
      ${hideFinished ? '<span>종료 숨김 적용</span>' : ''}
    </div>
    <div class="list-summary-side">
      <span>${pageText}</span>
      <span class="list-interaction-hint">행 클릭 → 빠른 보기</span>
    </div>`;
  const canRegister=!window.erpPermissions||window.erpPermissions.has('applicant.write');
  $('applicantTbody').innerHTML=rows.length?rows.map((a,idx)=>{
    const nextAction=window.erpUx12?.nextActionOf?.(a)||{label:'진행 확인',detail:a.status||'상태 미입력'};
    const schedule=window.erpUx12?.scheduleOf?.(a)||{label:'일정',value:[a.interviewDate,a.interviewTime].filter(Boolean).join(' ')||a.hireDate||a.nextContactDate||'미정'};
    const typeLine = String(a.school||'').trim();
    const staleDays = ['서류검토','부재중'].includes(a.status) ? daysSinceApply(a) : null;
    const staleBadge = (staleDays!==null && staleDays>=3) ? `<span class="stale-badge" title="지원일 기준 ${staleDays}일째 연락 안 됨">${staleDays}일째</span>` : '';
    return `<tr class="applicant-row compact-row clickable-data-row ${applicantRowToneClass(a)}" data-applicant-id="${esc(a.id)}" tabindex="0">
      <td class="no-cell sticky-app-col sticky-app-no" data-label="번호">${pageStart+idx+1}</td>
      <td class="applicant-name-cell sticky-app-col sticky-app-name" data-label="성명"><div class="applicant-name-line"><button class="name-button ${genderClass(a)}" data-erp-handler="viewApplicant('${a.id}')">${esc(a.name||'이름없음')}</button>${staleBadge}</div>${typeLine?`<small>${esc(typeLine)}</small>`:''}</td>
      <td class="phone-cell sticky-app-col sticky-app-phone" data-label="연락처"><strong>${esc(a.phone||'')}</strong></td>
      <td class="source-cell" data-label="지원경로"><strong>${esc(a.source||'미입력')}</strong></td>
      <td class="stage-cell status-cell" data-label="현재 단계"><span class="status-select-wrap ${badgeClass(a.status)}" title="${LEGACY_STATUS_OPTIONS.includes(normalizeStatus(a.status))?'기존 상태 · 재분류 필요':'눌러서 상태 변경'}"><select class="status-inline ${badgeClass(a.status)}" aria-label="${esc(a.name||'지원자')} 상태 변경" data-erp-change-handler="updateApplicantStatus('${a.id}', this.value)">${statusOptionsHtml(a.status)}</select></span></td>
      <td class="next-action-cell" data-label="다음 조치"><strong title="${esc([nextAction.label,nextAction.detail].filter(Boolean).join(' · '))}">${esc([nextAction.label,nextAction.detail].filter(Boolean).join(' · '))}</strong></td>
      <td class="schedule-cell" data-label="예정 일정"><strong class="${schedule.value==='미정'?'muted-schedule':''}" title="${esc([schedule.label,schedule.value].filter(Boolean).join(' · '))}">${esc([schedule.label,schedule.value].filter(Boolean).join(' · '))}</strong></td>
      <td class="apply-date-cell" data-label="지원일">${esc(a.applyDate||'-')}</td>
      <td class="row-actions applicant-actions" data-label="더보기"><details class="applicant-row-more"><summary aria-label="${esc(a.name||'지원자')} 보조 행동">•••</summary><div class="applicant-row-more-menu" role="menu"><button type="button" role="menuitem" data-erp-handler="event.stopPropagation();viewApplicant('${a.id}')">전체 상세</button><button type="button" role="menuitem" data-required-permission="applicant.write" data-erp-handler="event.stopPropagation();editApplicant('${a.id}')">수정</button><button type="button" role="menuitem" class="delete" data-required-permission="applicant.delete" data-erp-handler="event.stopPropagation();deleteApplicant('${a.id}')">삭제</button></div></details></td>
    </tr>`;
  }).join(''):`<tr><td colspan="9" class="empty list-empty-cell"><div class="applicant-list-empty-state"><strong>조건에 맞는 지원자가 없습니다.</strong><span>새 지원자를 등록하거나 현재 필터를 초기화해 다시 확인하세요.</span><div class="applicant-list-empty-actions">${canRegister?'<button class="primary applicant-empty-register" type="button" data-required-permission="applicant.write" data-erp-handler="setPage(\'form\')">지원자 등록</button>':''}<button class="ghost applicant-empty-reset" type="button" data-erp-handler="resetAndRenderList()">필터 초기화</button></div></div></td></tr>`;
  renderApplicantPagination(allRows.length);
  applicantQuickDetailAfterListRender(allRows);
}
function resetAndRenderList(){ resetListFiltersToAll(); renderTable(); }

/* =========================================================
   v10.40.7 엑셀 다중 행·지원자 UI 안정화
   - 현재 2026 명단과 기존 22열 형식을 자동 판별
   - 원본 행 미리보기, 필수값/형식/일정 관계 검증
   - 지원근무지·출근방법 직접 확인 및 중복 후보 확인
   - 오류가 남아 있으면 입력폼 적용 차단
   - 자동 저장/자동 덮어쓰기 없음
   ========================================================= */
const EXCEL_ROW_HEADERS_LEGACY = ['NO','지원날짜','연락상태','면접날짜','시간','입사날짜','지원경로','지원구분','지원파트','성별','성명','이메일','최종학력','학과','연락처','연생','나이','지역(시)','세부지역(동)','경력','자격증','비고'];
const EXCEL_ROW_HEADERS_2026 = ['NO','지원날짜','연락상태','면접날짜','시간','입사날짜','지원경로','지원구분','성별','지원파트','성명','이메일','학력구분','학교','학과','연락처','나이','생년월일','지역','경력','자격증','비고'];
const EXCEL_LAYOUT_LEGACY = {
  applyDate:1,status:2,interviewDate:3,interviewTime:4,hireDate:5,source:6,careerType:7,workplace:8,gender:9,name:10,email:11,
  school:12,major:13,phone:14,birthYear:15,age:16,region:17,detailRegion:18,career:19,certs:20,memo:21
};
const EXCEL_LAYOUT_2026 = {
  applyDate:1,status:2,interviewDate:3,interviewTime:4,hireDate:5,source:6,careerType:7,gender:8,workplace:9,name:10,email:11,
  education:12,school:13,major:14,phone:15,age:16,birthYear:17,region:18,career:19,certs:20,memo:21
};
const EXCEL_PASTE_FIELD_MAP = {
  applyDate:'xpApplyDate', status:'xpStatus', interviewDate:'xpInterviewDate', interviewTime:'xpInterviewTime', hireDate:'xpHireDate',
  source:'xpSource', careerType:'xpCareerType', workplace:'xpWorkplace', dormUse:'xpDormUse',
  name:'xpName', gender:'xpGender', birthYear:'xpBirthYear', age:'xpAge', phone:'xpPhone', email:'xpEmail', region:'xpRegion',
  education:'xpEducation', school:'xpSchool', major:'xpMajor', career:'xpCareer', certs:'xpCerts', memo:'xpMemo'
};
const EXCEL_PASTE_FIELD_LABELS = {
  applyDate:'지원일',status:'연락상태',interviewDate:'면접일',interviewTime:'면접시간',hireDate:'입사일',source:'지원경로',careerType:'지원구분',
  workplace:'지원근무지',dormUse:'출근방법',name:'성명',gender:'성별',birthYear:'생년월일',age:'나이',phone:'연락처',email:'이메일',region:'지역',
  education:'학력구분',school:'학교',major:'학과',career:'경력',certs:'자격증',memo:'비고·메모'
};
let excelPasteParsedData = null;
let excelPasteParseIssues = [];
let excelPasteSourcePresent = {};
let excelPasteDetectedFormat = '';
let excelPasteRawInvalidFields = new Set();
let excelPasteDuplicateMatches = [];
let excelPastePreviewMeta = null;
let excelPasteTouchedFields = new Set();
let excelPasteBatchRows = [];
let excelPasteBatchRegisteredIds = [];
let excelPasteBatchUndoSnapshot = null;
let excelPasteBatchUndoSummary = null;
let excelPasteBatchHeaderRow = null;
let excelPasteBatchFilter = 'all';

function excelPasteText(v){ return String(v ?? '').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim(); }
function excelPastePhoneDigits(v){ return String(v||'').replace(/\D/g,''); }
function excelPasteSameValue(field,a,b){
  if(field==='phone') return excelPastePhoneDigits(a)===excelPastePhoneDigits(b);
  if(field==='birthYear'){
    const left=excelPasteBirthValue(a),right=excelPasteBirthValue(b);
    if(left&&right)return left===right;
    return excelPasteText(a).replace(/\D/g,'')===excelPasteText(b).replace(/\D/g,'');
  }
  return excelPasteText(a)===excelPasteText(b);
}
function excelPasteParseTsv(text){
  const rows=[[]];
  let value='';
  let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted && text[i+1]==='"'){ value+='"'; i++; }
      else quoted=!quoted;
      continue;
    }
    if(ch==='\t' && !quoted){ rows[rows.length-1].push(value); value=''; continue; }
    if((ch==='\n'||ch==='\r') && !quoted){
      if(ch==='\r' && text[i+1]==='\n') i++;
      rows[rows.length-1].push(value); value=''; rows.push([]); continue;
    }
    value+=ch;
  }
  rows[rows.length-1].push(value);
  return rows.map(row=>row.map(excelPasteText)).filter(row=>row.some(Boolean));
}
function excelPasteHeaderToken(v){ return String(v||'').replace(/[\s\n\r]/g,'').replace(/[()·._\-/]/g,'').toLowerCase(); }
function excelPasteIsHeaderRow(row){
  const tokens=row.map(excelPasteHeaderToken);
  return tokens.some(v=>v.includes('지원날짜')||v==='지원일') && tokens.some(v=>v==='성명'||v==='이름') && tokens.some(v=>v.includes('연락처')||v.includes('휴대폰'));
}
function excelPasteLooksGender(v){ return /^(남|여|남자|여자)$/.test(excelPasteText(v).replace(/\s/g,'')); }
function excelPasteLooksPhone(v){ const d=excelPastePhoneDigits(v); return /^01[016789]\d{7,8}$/.test(d); }
function excelPasteLooksEmail(v){ const s=excelPasteText(v); return !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function excelPasteLooksEducation(v){ return /^(고졸|고등학교|전졸|전문대|전문대졸|초대졸|대졸|대학교|4년제|대학원|대학원졸|기타)$/.test(excelPasteText(v).replace(/\s/g,'')); }
function excelPasteLooksAge(v){ const n=Number(excelPasteText(v)); return Number.isFinite(n)&&n>=15&&n<=80; }
function excelPasteValidDateParts(y,m,d){
  const dt=new Date(Date.UTC(y,m-1,d));
  return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d;
}
function excelPasteDateFromSerial(serial){
  const n=Number(serial);
  if(!Number.isFinite(n) || n<1 || n>60000) return '';
  const ms=Date.UTC(1899,11,30)+Math.floor(n)*86400000;
  const d=new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function excelPasteDate(v){
  const raw=excelPasteText(v);
  if(!raw) return '';
  if(/^\d+(\.\d+)?$/.test(raw)){
    if(/^\d{8}$/.test(raw)){
      const y=Number(raw.slice(0,4)),m=Number(raw.slice(4,6)),d=Number(raw.slice(6,8));
      return excelPasteValidDateParts(y,m,d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
    }
    if(/^\d{6}$/.test(raw)){
      const yy=Number(raw.slice(0,2)),current=Number(String(new Date().getFullYear()).slice(-2));
      const y=yy>current?1900+yy:2000+yy,m=Number(raw.slice(2,4)),d=Number(raw.slice(4,6));
      return excelPasteValidDateParts(y,m,d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
    }
    const n=Number(raw);
    if(n>=20000) return excelPasteDateFromSerial(n);
  }
  const cleaned=raw.replace(/년|월/g,'-').replace(/일/g,'').replace(/[./]/g,'-').replace(/\s+/g,'');
  const parts=cleaned.split('-').filter(Boolean);
  if(parts.length===3){
    let y=Number(parts[0]); const m=Number(parts[1]),d=Number(parts[2]);
    if(y<100){ const current=Number(String(new Date().getFullYear()).slice(-2)); y=y>current?1900+y:2000+y; }
    return y>=1900&&excelPasteValidDateParts(y,m,d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
  }
  if(parts.length===2){
    const y=new Date().getFullYear(),m=Number(parts[0]),d=Number(parts[1]);
    return excelPasteValidDateParts(y,m,d)?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:'';
  }
  return '';
}
function excelPasteTime(v){
  const raw=excelPasteText(v);
  if(!raw) return '';
  if(/^\d+(\.\d+)?$/.test(raw)){
    const n=Number(raw),fraction=n<1?n:(n-Math.floor(n));
    if(fraction>0){
      const minutes=Math.round(fraction*1440)%1440;
      return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
    }
    return '';
  }
  const kor=raw.match(/(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
  if(kor){
    let h=Number(kor[2]),m=Number(kor[3]||0);
    if(kor[1]==='오후'&&h<12)h+=12;
    if(kor[1]==='오전'&&h===12)h=0;
    if(h>=0&&h<24&&m>=0&&m<60)return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const compact=raw.replace(/\s/g,'');
  if(/^\d{3,4}$/.test(compact)){
    const h=Number(compact.slice(0,-2)),m=Number(compact.slice(-2));
    if(h<24&&m<60)return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  return '';
}
function excelPasteBirthValue(v){
  const raw=excelPasteText(v);
  if(!raw) return '';
  if(/^\d{2}$/.test(raw)){
    const yy=Number(raw),current=Number(String(new Date().getFullYear()).slice(-2));
    return String(yy>current?1900+yy:2000+yy);
  }
  if(/^\d{4}$/.test(raw) && Number(raw)>=1900 && Number(raw)<=new Date().getFullYear()) return raw;
  const parsed=excelPasteDate(raw);
  if(!parsed)return '';
  const year=Number(parsed.slice(0,4));
  if(year<1900||year>new Date().getFullYear())return '';
  return parsed;
}
function excelPasteLooksBirth(v){ return !!excelPasteBirthValue(v); }
function excelPasteHasNoColumn(row,headerRow=null){
  if(headerRow){ const first=excelPasteHeaderToken(headerRow[0]); return first==='no'||first==='번호'||first==='순번'; }
  const first=excelPasteText(row[0]),second=excelPasteText(row[1]);
  if(!first)return true;
  return /^\d{1,5}$/.test(first) && (!!excelPasteDate(second)||/^\d{5}(\.\d+)?$/.test(second));
}
function excelPasteNormalizeRows(row,headerRow=null){
  let data=[...row],header=headerRow?[...headerRow]:null;
  const hasNo=excelPasteHasNoColumn(data,header);
  if(!hasNo){ data=['',...data]; if(header)header=['',...header]; }
  while(data.length<22)data.push('');
  if(header)while(header.length<data.length)header.push('');
  return {cells:data,headers:header};
}
function excelPasteHeaderIndex(headers,aliases){
  if(!headers)return -1;
  const tokens=headers.map(excelPasteHeaderToken);
  return tokens.findIndex(token=>aliases.includes(token));
}
function excelPasteBuildHeaderLayout(headers){
  if(!headers)return null;
  const layout={};
  const set=(field,aliases)=>{ const i=excelPasteHeaderIndex(headers,aliases); if(i>=0)layout[field]=i; };
  set('applyDate',['지원날짜','지원일']); set('status',['연락상태']); set('interviewDate',['면접날짜','면접일']); set('interviewTime',['면접시간','시간']);
  set('hireDate',['입사날짜','입사일']); set('source',['지원경로']); set('careerType',['지원구분','경력구분']); set('workplace',['지원파트','지원근무지','근무지','사업장']);
  set('gender',['성별']); set('name',['성명','이름']); set('email',['이메일']); set('major',['학과','전공']); set('phone',['연락처','휴대폰']);
  set('birthYear',['생년월일','생년','연생']); set('age',['나이','연령']); set('detailRegion',['세부지역동','세부지역']); set('career',['경력사항','경력']);
  set('certs',['자격증','면허']); set('memo',['비고','메모']);
  const finalEducation=excelPasteHeaderIndex(headers,['최종학력']);
  const explicitEducation=excelPasteHeaderIndex(headers,['학력구분','최종학력구분']);
  const school=excelPasteHeaderIndex(headers,['학교명','출신학교','학교']);
  if(explicitEducation>=0)layout.education=explicitEducation;
  if(school>=0){ layout.school=school; if(finalEducation>=0&&layout.education===undefined)layout.education=finalEducation; }
  else if(finalEducation>=0)layout.school=finalEducation;
  const city=excelPasteHeaderIndex(headers,['지역시','거주지역','지역']);
  if(city>=0)layout.region=city;
  return layout;
}
function excelPasteDetectLayout(cells,headers=null){
  const headerLayout=excelPasteBuildHeaderLayout(headers);
  if(headerLayout && headerLayout.name!==undefined && headerLayout.phone!==undefined){
    const is2026=headerLayout.education!==undefined&&headerLayout.school!==undefined;
    return {layout:{...(is2026?EXCEL_LAYOUT_2026:EXCEL_LAYOUT_LEGACY),...headerLayout},format:is2026?'2026 형식(헤더 기준)':'기존 형식(헤더 기준)',confidence:100};
  }
  let legacy=0,modern=0;
  if(excelPasteLooksGender(cells[9]))legacy+=5;
  if(excelPasteLooksGender(cells[8]))modern+=5;
  if(excelPasteLooksPhone(cells[14]))legacy+=6;
  if(excelPasteLooksPhone(cells[15]))modern+=6;
  if(excelPasteLooksEducation(cells[12]))modern+=4; else if(excelPasteText(cells[12]))legacy+=1;
  if(excelPasteLooksAge(cells[16])){legacy+=1;modern+=1;}
  if(excelPasteLooksBirth(cells[15]))legacy+=2;
  if(excelPasteLooksBirth(cells[17]))modern+=2;
  if(excelPasteLooksEmail(cells[11])){legacy+=1;modern+=1;}
  if(modern>legacy)return {layout:{...EXCEL_LAYOUT_2026},format:'2026 형식',confidence:modern-legacy};
  return {layout:{...EXCEL_LAYOUT_LEGACY},format:'기존 형식',confidence:legacy-modern};
}
function excelPasteNormalizeEducation(value){
  const v=excelPasteText(value).replace(/\s/g,'');
  if(!v)return '';
  if(/고졸|고등학교|고교/.test(v))return '고졸';
  if(/전졸|전문대|전문대졸|초대졸|폴리텍|직업학교|전문학교/.test(v))return '전졸';
  if(/대학원/.test(v))return '대학원';
  if(/대졸|대학교|4년제/.test(v))return '대졸';
  if(v==='기타')return '기타';
  return '';
}
function excelPasteCareerType(value){
  const v=excelPasteText(value);
  if(v.includes('신입'))return '신입';
  if(v.includes('경력'))return '경력';
  return '';
}
function excelPasteEducation(school){
  const s=excelPasteText(school);
  if(!s)return '';
  if(typeof findSchoolByText==='function'){
    const matched=findSchoolByText(s);
    const type=matched&&typeof normalizeSchoolType==='function'?normalizeSchoolType(matched.type):'';
    if(type==='고등학교')return '고졸';
    if(type==='전문대')return '전졸';
    if(type==='대학교')return '대졸';
  }
  if(/대학원/.test(s))return '대학원';
  if(/고등학교|고교|하이텍/.test(s))return '고졸';
  if(/전문대|전문대학교|이공대|과학대|공업대|도립.*대|폴리텍|기능대|직업.*학교|전문학교/.test(s))return '전졸';
  if(/대학교|대$|대\(|대학|학점은행/.test(s))return '대졸';
  return '기타';
}
function excelPasteDorm(note){
  const s=excelPasteText(note).replace(/\s/g,'');
  if(!s)return '';
  if(/기숙사.*(출퇴근|통근)|출퇴근|통근/.test(s))return '출퇴근';
  if(/기숙사/.test(s))return '기숙사';
  if(/확인필요|확인요망|미확인/.test(s))return '확인필요';
  return '';
}
function excelPasteWorkplace(value){
  const raw=excelPasteText(value);
  if(!raw)return '';
  if(/천안/.test(raw))return '천안';
  if(/평택/.test(raw))return '평택';
  if(/^기타$/.test(raw))return '기타';
  return raw;
}
function excelPasteKnownWorkplace(value){ return ['천안','평택','기타'].includes(excelPasteText(value)); }
function excelPasteValue(cells,layout,field){ const index=layout[field]; return index===undefined||index<0?'':excelPasteText(cells[index]); }
function excelPasteIssue(field,text,level='warning',code=''){ return {field,text,level,code}; }
function excelPasteRecognizedStatus(raw){
  const s=excelPasteText(raw);
  if(!s)return true;
  const known=['미연락','문자발송','연락완료','보류','부적합','전형마감','취소','입사포기','철회','연락두절'];
  return STATUS_OPTIONS.includes(s)||known.includes(s);
}
function excelPasteRowToApplicant(row,headerRow=null){
  const issues=[];
  if(row.length<20||row.length>23)throw new Error(`지원자 한 행은 약 21~22열이어야 합니다. 현재 ${row.length}열이 감지됐습니다.`);
  const normalized=excelPasteNormalizeRows(row,headerRow),cells=normalized.cells;
  const detected=excelPasteDetectLayout(cells,normalized.headers),layout=detected.layout,get=field=>excelPasteValue(cells,layout,field);
  const statusRaw=get('status'),applyRaw=get('applyDate'),interviewRaw=get('interviewDate'),timeRaw=get('interviewTime'),hireRaw=get('hireDate');
  const birthRaw=get('birthYear'),phoneRaw=get('phone'),genderRaw=get('gender'),emailRaw=get('email');
  const applyDate=excelPasteDate(applyRaw),interviewDate=excelPasteDate(interviewRaw),interviewTime=excelPasteTime(timeRaw),hireDate=excelPasteDate(hireRaw);
  const school=get('school'),memo=get('memo'),birthValue=excelPasteBirthValue(birthRaw),explicitEducation=excelPasteNormalizeEducation(get('education'));
  const region=[get('region'),get('detailRegion')].filter(Boolean).join(' ');
  const data={
    applyDate,status:statusRaw?normalizeStatus(statusRaw):'서류검토',interviewDate,interviewTime,hireDate,source:get('source'),
    careerType:excelPasteCareerType(get('careerType')),workplace:excelPasteWorkplace(get('workplace')),dormUse:excelPasteDorm(memo)||'확인필요',
    gender:normalizeGender(genderRaw),name:get('name'),email:emailRaw,school,major:get('major'),phone:formatPhoneDisplay(phoneRaw),birthYear:birthValue,
    age:get('age')||(birthValue&&typeof calcAge==='function'?String(calcAge(birthValue)||''):''),region,career:get('career'),certs:get('certs'),memo,
    education:explicitEducation||excelPasteEducation(school)
  };
  if(!data.name)issues.push(excelPasteIssue('name','성명이 비어 있습니다.','error','required-name'));
  if(!applyRaw)issues.push(excelPasteIssue('applyDate','지원일이 비어 있습니다.','error','required-applyDate'));
  else if(!applyDate)issues.push(excelPasteIssue('applyDate',`지원일 “${applyRaw}” 형식을 해석하지 못했습니다.`,'error','raw-applyDate'));
  if(!phoneRaw)issues.push(excelPasteIssue('phone','연락처가 비어 있습니다.','error','required-phone'));
  else if(!excelPasteLooksPhone(phoneRaw))issues.push(excelPasteIssue('phone',`연락처 “${phoneRaw}” 형식을 확인하세요.`,'error','raw-phone'));
  if(emailRaw&&!excelPasteLooksEmail(emailRaw))issues.push(excelPasteIssue('email',`이메일 “${emailRaw}” 형식을 확인하세요.`,'error','raw-email'));
  if(genderRaw&&!data.gender)issues.push(excelPasteIssue('gender',`성별 “${genderRaw}” 값을 확인하세요.`,'error','raw-gender'));
  if(birthRaw&&!birthValue)issues.push(excelPasteIssue('birthYear',`생년월일 “${birthRaw}” 형식을 확인하세요.`,'error','raw-birthYear'));
  if(interviewRaw&&!interviewDate)issues.push(excelPasteIssue('interviewDate',`면접일 “${interviewRaw}” 형식을 확인하세요.`,'error','raw-interviewDate'));
  if(timeRaw&&!interviewTime)issues.push(excelPasteIssue('interviewTime',`면접시간 “${timeRaw}” 형식을 확인하세요.`,'error','raw-interviewTime'));
  if(hireRaw&&!hireDate)issues.push(excelPasteIssue('hireDate',`입사일 “${hireRaw}” 형식을 확인하세요.`,'error','raw-hireDate'));
  if(statusRaw&&!excelPasteRecognizedStatus(statusRaw))issues.push(excelPasteIssue('status',`연락상태 “${statusRaw}”를 자동 판단할 수 없습니다. 직접 선택하세요.`,'error','raw-status'));
  if(detected.confidence<2&&!normalized.headers)issues.push(excelPasteIssue('workplace','엑셀 열 형식 판단이 애매합니다. 성별·지원근무지·학교·연락처를 확인하세요.','error','layout-confidence'));
  const workplaceRaw=get('workplace');
  if(workplaceRaw&&!excelPasteKnownWorkplace(data.workplace))issues.push(excelPasteIssue('workplace',`엑셀 지원파트 값 “${workplaceRaw}”은 지원근무지로 사용할 수 없습니다. 천안·평택·기타 중 하나로 수정하세요.`,'error','raw-workplace'));
  if(!explicitEducation&&school)issues.push(excelPasteIssue('education',`학력구분을 학교명 “${school}”에서 ${data.education||'기타'}(으)로 추정했습니다.`,'warning','education-inferred'));
  const present={};
  Object.keys(EXCEL_PASTE_FIELD_MAP).forEach(field=>{present[field]=!!get(field);});
  present.education=!!get('education')||!!school; present.dormUse=!!memo; present.careerType=!!get('careerType'); present.region=!!region;
  return {data,issues,present,format:detected.format,confidence:detected.confidence,preview:{cells,headers:normalized.headers,layout}};
}
function excelPasteFindDuplicates(data,editId=''){
  const p=excelPastePhoneDigits(data.phone),email=excelPasteText(data.email).toLowerCase(),birth=excelPasteText(data.birthYear);
  return applicants.map(a=>{
    if(a.id===editId)return null;
    const reasons=[];
    if(p.length>=8&&excelPastePhoneDigits(a.phone)===p)reasons.push('연락처 동일');
    if(email&&excelPasteText(a.email).toLowerCase()===email)reasons.push('이메일 동일');
    if(data.name&&a.name===data.name&&birth&&excelPasteSameValue('birthYear',a.birthYear,birth))reasons.push('성명+생년월일 동일');
    return reasons.length?{applicant:a,reasons}:null;
  }).filter(Boolean).slice(0,5);
}

function excelPasteIssueResolved(issue,data){
  const field=issue?.field;
  if(!field)return false;
  if(field==='phone')return excelPasteLooksPhone(data.phone);
  if(field==='email')return !data.email||excelPasteLooksEmail(data.email);
  if(field==='gender')return !data.gender||excelPasteLooksGender(data.gender);
  if(field==='birthYear')return !data.birthYear||excelPasteLooksBirth(data.birthYear);
  if(field==='applyDate'||field==='interviewDate'||field==='hireDate')return !!data[field];
  if(field==='interviewTime')return !data.interviewTime||/^\d{2}:\d{2}$/.test(data.interviewTime);
  if(field==='status')return STATUS_OPTIONS.includes(data.status);
  if(field==='workplace')return excelPasteKnownWorkplace(data.workplace);
  return !!excelPasteText(data[field]);
}
function excelPasteBatchPairReasons(a,b){
  const reasons=[];
  const ap=excelPastePhoneDigits(a.phone),bp=excelPastePhoneDigits(b.phone);
  const ae=excelPasteText(a.email).toLowerCase(),be=excelPasteText(b.email).toLowerCase();
  const ab=excelPasteText(a.birthYear),bb=excelPasteText(b.birthYear);
  if(ap.length>=8&&ap===bp)reasons.push('붙여넣은 행끼리 연락처 동일');
  if(ae&&ae===be)reasons.push('붙여넣은 행끼리 이메일 동일');
  if(a.name&&a.name===b.name&&ab&&bb&&excelPasteSameValue('birthYear',ab,bb))reasons.push('붙여넣은 행끼리 성명+생년월일 동일');
  return reasons;
}
function excelPasteBatchInternalDuplicateReason(item){
  if(!item.internalDuplicates?.length)return '';
  const first=item.internalDuplicates[0];
  return `${first.row}행과 동일 지원자 식별값이 겹칩니다: ${first.reasons.join(', ')}`;
}
function excelPasteBatchExactMatches(data){
  const phone=excelPastePhoneDigits(data.phone),email=excelPasteText(data.email).toLowerCase(),birth=excelPasteText(data.birthYear),name=excelPasteText(data.name);
  const phoneMatches=phone.length>=8?applicants.filter(a=>excelPastePhoneDigits(a.phone)===phone):[];
  const emailMatches=email?applicants.filter(a=>excelPasteText(a.email).toLowerCase()===email):[];
  const nameBirthMatches=name&&birth?applicants.filter(a=>excelPasteText(a.name)===name&&excelPasteSameValue('birthYear',a.birthYear,birth)):[];
  return {phoneMatches,emailMatches,nameBirthMatches};
}
function excelPasteBatchApplyFields(item){
  const present=item.present||item.parsed?.present||{};
  return Object.keys(EXCEL_PASTE_FIELD_MAP).filter(field=>present[field]&&excelPasteText(item.data[field])!=='');
}
function excelPasteBatchChanges(item,target){
  if(!target)return [];
  return excelPasteBatchApplyFields(item).filter(field=>!excelPasteSameValue(field,target[field]||'',item.data[field]||'')).map(field=>({
    field,label:EXCEL_PASTE_FIELD_LABELS[field]||field,before:target[field]||'',after:item.data[field]||''
  }));
}
function excelPasteBatchClassify(item){
  item.matchedApplicant=null;item.matchReasons=[];item.changes=[];
  if(item.errors.length){item.state='error';item.selected=false;return;}
  const internalReason=excelPasteBatchInternalDuplicateReason(item);
  if(internalReason){item.state='review';item.matchReasons=[internalReason];item.selected=false;return;}
  const {phoneMatches,emailMatches,nameBirthMatches}=excelPasteBatchExactMatches(item.data);
  if(phoneMatches.length>1){item.state='review';item.matchReasons=[`현재 ERP에 같은 연락처가 ${phoneMatches.length}명 있습니다.`];item.selected=false;return;}
  if(phoneMatches.length===1){
    const target=phoneMatches[0],incomingName=excelPasteText(item.data.name),targetName=excelPasteText(target.name);
    const incomingBirth=excelPasteText(item.data.birthYear),targetBirth=excelPasteText(target.birthYear);
    if(incomingName&&targetName&&incomingName!==targetName){item.state='review';item.matchReasons=[`연락처는 ${targetName}님과 같지만 성명이 다릅니다.`];item.selected=false;return;}
    if(incomingBirth&&targetBirth&&!excelPasteSameValue('birthYear',incomingBirth,targetBirth)){item.state='review';item.matchReasons=[`연락처는 ${targetName||'기존 지원자'}님과 같지만 생년월일이 다릅니다.`];item.selected=false;return;}
    item.matchedApplicant=target;item.matchReasons=['연락처 정확 일치'];item.changes=excelPasteBatchChanges(item,target);
    item.state=item.changes.length?'update':'same';
    if(item.state==='same')item.selected=false;
    return;
  }
  if(emailMatches.length||nameBirthMatches.length){
    const candidates=[...new Map([...emailMatches,...nameBirthMatches].map(a=>[String(a.id),a])).values()];
    item.state='review';
    if(candidates.length===1){
      const a=candidates[0];
      item.matchReasons=[emailMatches.includes(a)?`이메일이 기존 ${a.name||'지원자'}님과 같습니다.`:`성명+생년월일이 기존 ${a.name||'지원자'}님과 같습니다.`];
    }else item.matchReasons=[`이메일 또는 성명+생년월일 일치 후보가 ${candidates.length}명 있습니다.`];
    item.selected=false;return;
  }
  item.state='new';
}
function excelPasteBatchRecalculate(){
  excelPasteBatchRows.forEach(item=>{item.internalDuplicates=[];});
  for(let i=0;i<excelPasteBatchRows.length;i++){
    for(let j=i+1;j<excelPasteBatchRows.length;j++){
      const reasons=excelPasteBatchPairReasons(excelPasteBatchRows[i].data,excelPasteBatchRows[j].data);
      if(reasons.length){
        excelPasteBatchRows[i].internalDuplicates.push({row:j+1,reasons});
        excelPasteBatchRows[j].internalDuplicates.push({row:i+1,reasons});
      }
    }
  }
  excelPasteBatchRows.forEach(item=>{
    const matches=excelPasteBatchExactMatches(item.data);
    let safeTarget=null;
    if(matches.phoneMatches.length===1){
      const candidate=matches.phoneMatches[0],incomingName=excelPasteText(item.data.name),targetName=excelPasteText(candidate.name);
      const incomingBirth=excelPasteText(item.data.birthYear),targetBirth=excelPasteText(candidate.birthYear);
      const nameOkay=!incomingName||!targetName||incomingName===targetName;
      const birthOkay=!incomingBirth||!targetBirth||excelPasteSameValue('birthYear',incomingBirth,targetBirth);
      if(nameOkay&&birthOkay)safeTarget=candidate;
    }
    const validationData=safeTarget?{...safeTarget}:item.data;
    if(safeTarget)excelPasteBatchApplyFields(item).forEach(field=>{validationData[field]=item.data[field];});
    const live=excelPasteValidateLive(validationData);
    if(safeTarget)live.errors=live.errors.filter(x=>!['required-workplace','required-dormUse'].includes(x.code));
    const staticErrors=(item.issues||[]).filter(x=>x.level==='error'&&!excelPasteIssueResolved(x,item.data));
    const staticWarnings=(item.issues||[]).filter(x=>x.level!=='error');
    item.errors=[...staticErrors,...live.errors].filter((x,i,a)=>a.findIndex(y=>y.field===x.field&&y.code===x.code)===i);
    item.warnings=[...staticWarnings,...live.warnings].filter((x,i,a)=>a.findIndex(y=>y.field===x.field&&y.code===x.code)===i);
    excelPasteBatchClassify(item);
  });
}
function excelPasteBatchStatusLabel(item){
  if(item.state==='error')return ['오류',`${item.errors.length}개 수정 필요`];
  if(item.state==='review')return ['확인 필요','자동 변경 차단'];
  if(item.state==='update')return ['변경',`${item.changes.length}개 변경`];
  if(item.state==='same')return ['동일','변경 없음'];
  return ['신규','신규 등록'];
}
function excelPasteBatchIssueText(item){
  const rows=[];
  item.errors.slice(0,2).forEach(x=>rows.push(x.text));
  item.matchReasons?.slice(0,1).forEach(x=>rows.push(x));
  if(item.state==='update')item.changes.slice(0,3).forEach(x=>rows.push(`${x.label}: ${x.before||'비어 있음'} → ${x.after||'비어 있음'}`));
  if(item.state==='same')rows.push(`기존 ${item.matchedApplicant?.name||'지원자'} 정보와 동일합니다.`);
  if(item.state==='new')rows.push('일치하는 기존 지원자가 없어 신규 등록됩니다.');
  item.warnings.slice(0,1).forEach(x=>rows.push(`주의: ${x.text}`));
  return rows.join(' / ')||'검사 완료';
}
function excelPasteBatchChangeHtml(item){
  if(item.state==='update'){
    const shown=item.changes.slice(0,4).map(x=>`<li><b>${esc(x.label)}</b><span>${esc(x.before||'비어 있음')}</span><i>→</i><strong>${esc(x.after||'비어 있음')}</strong></li>`).join('');
    const more=item.changes.length>4?`<small>외 ${item.changes.length-4}개 항목</small>`:'';
    return `<ul class="excel-batch-change-preview">${shown}</ul>${more}`;
  }
  if(item.state==='review')return `<strong>${esc(item.matchReasons?.[0]||'지원자 식별 확인이 필요합니다.')}</strong><small>이 행은 자동 적용되지 않습니다.</small>`;
  if(item.state==='same')return `<strong>${esc(item.matchedApplicant?.name||item.data.name||'기존 지원자')} · 변경 없음</strong><small>자동으로 건너뜁니다.</small>`;
  if(item.state==='new')return `<strong>신규 지원자로 등록</strong><small>기존 ERP에서 정확히 일치하는 연락처를 찾지 못했습니다.</small>`;
  return `<strong>${esc(item.errors?.[0]?.text||'수정이 필요합니다.')}</strong><small>${esc(item.errors?.[1]?.text||'')}</small>`;
}
function excelPasteBatchVisibleRows(){
  return excelPasteBatchRows.map((item,index)=>({item,index})).filter(({item})=>excelPasteBatchFilter==='all'||item.state===excelPasteBatchFilter);
}
function excelPasteBatchSetFilter(filter){
  excelPasteBatchFilter=['all','new','update','same','review','error'].includes(filter)?filter:'all';
  document.querySelectorAll('[data-excel-batch-filter]').forEach(btn=>btn.classList.toggle('active',btn.dataset.excelBatchFilter===excelPasteBatchFilter));
  excelPasteBatchRender();
}
function excelPasteBatchRender(){
  const section=$('excelPasteBatch'),body=$('excelBatchBody');
  if(!section||!body)return;
  excelPasteBatchRecalculate();
  section.hidden=false;
  const counts={new:0,update:0,same:0,review:0,error:0};
  excelPasteBatchRows.forEach(x=>counts[x.state]++);
  const countBox=$('excelBatchCounts');
  if(countBox)countBox.innerHTML=`<span class="is-new">신규 ${counts.new}</span><span class="is-update">변경 ${counts.update}</span><span class="is-same">동일 ${counts.same}</span><span class="is-review">확인 필요 ${counts.review}</span><span class="is-error">오류 ${counts.error}</span>`;
  const visible=excelPasteBatchVisibleRows();
  body.innerHTML=visible.length?visible.map(({item,index})=>{
    const [label,note]=excelPasteBatchStatusLabel(item);
    const excelNo=item.preview?.cells?.[0]||String(index+1);
    const invalidWork=item.data.workplace&&!excelPasteKnownWorkplace(item.data.workplace);
    const disabled=['error','review','same'].includes(item.state);
    return `<tr class="excel-batch-row is-${item.state}" data-batch-row="${index}">
      <td><input class="excel-batch-select" type="checkbox" data-batch-index="${index}" ${item.selected?'checked':''} ${disabled?'disabled':''} aria-label="${esc(item.data.name||`${index+1}행`)} 선택"></td>
      <td><strong>${esc(excelNo)}</strong><small>${index+1}번째 데이터</small></td>
      <td><input class="excel-batch-inline-input" data-batch-index="${index}" data-batch-field="name" value="${esc(item.data.name||'')}" placeholder="성명 입력"><small>${esc(item.data.applyDate||'지원일 없음')} · ${esc(item.data.status||'서류검토')}</small></td>
      <td><input class="excel-batch-inline-input" data-batch-index="${index}" data-batch-field="phone" value="${esc(item.data.phone||'')}" placeholder="연락처 입력"><small>${esc(item.data.email||'이메일 없음')}</small></td>
      <td><select data-batch-index="${index}" data-batch-field="workplace"><option value="">선택</option>${invalidWork?`<option value="${esc(item.data.workplace)}" selected>${esc(item.data.workplace)} (확인 필요)</option>`:''}<option ${item.data.workplace==='천안'?'selected':''}>천안</option><option ${item.data.workplace==='평택'?'selected':''}>평택</option><option ${item.data.workplace==='기타'?'selected':''}>기타</option></select></td>
      <td><select data-batch-index="${index}" data-batch-field="dormUse"><option value="">선택</option><option ${item.data.dormUse==='기숙사'?'selected':''}>기숙사</option><option ${item.data.dormUse==='출퇴근'?'selected':''}>출퇴근</option><option ${item.data.dormUse==='확인필요'?'selected':''}>확인필요</option></select></td>
      <td><span class="excel-batch-state is-${item.state}">${label}</span><strong>${esc(note)}</strong><div title="${esc(excelPasteBatchIssueText(item))}">${excelPasteBatchChangeHtml(item)}</div></td>
    </tr>`;
  }).join(''):`<tr><td colspan="7" class="excel-batch-empty">현재 필터에 해당하는 행이 없습니다.</td></tr>`;
  const shown=$('excelBatchShownSummary');if(shown)shown.textContent=`표시 ${visible.length}건 · 전체 ${excelPasteBatchRows.length}건`;
  excelPasteBatchUpdateSelectionState();
}
function excelPasteBatchSelected(){return excelPasteBatchRows.filter(x=>x.selected&&['new','update'].includes(x.state));}
function excelPasteBatchUpdateSelectionState(){
  const selected=excelPasteBatchSelected(),newRows=selected.filter(x=>x.state==='new'),updates=selected.filter(x=>x.state==='update');
  const hasWarning=selected.some(x=>x.warnings?.length);
  const warningWrap=$('excelBatchWarningConfirmWrap'),updateWrap=$('excelBatchDuplicateConfirmWrap');
  if(warningWrap)warningWrap.hidden=!hasWarning;
  if(updateWrap)updateWrap.hidden=!updates.length;
  const warningOk=!hasWarning||!!$('xpBatchWarningConfirm')?.checked;
  const updateOk=!updates.length||!!$('xpBatchDuplicateConfirm')?.checked;
  const summary=$('excelBatchSelectionSummary');if(summary)summary.textContent=`선택 ${selected.length}명 · 신규 ${newRows.length} · 변경 ${updates.length}`;
  const button=$('btnRegisterExcelBatch');
  if(button){button.hidden=false;button.disabled=!selected.length||!warningOk||!updateOk;button.textContent=`신규 ${newRows.length}명 등록 · 기존 ${updates.length}명 변경 적용`;}
  const ready=$('excelPasteReadyState');
  if(ready){
    if(!selected.length){ready.className='excel-paste-ready is-blocked';ready.textContent='신규 또는 변경 행을 선택하세요';}
    else if(!warningOk){ready.className='excel-paste-ready is-waiting';ready.textContent='주의 항목 확인 필요';}
    else if(!updateOk){ready.className='excel-paste-ready is-waiting';ready.textContent='기존 지원자 변경 내역 확인 필요';}
    else{ready.className='excel-paste-ready is-ready';ready.textContent=`신규 ${newRows.length} · 변경 ${updates.length} 적용 가능`;}
  }
}
function excelPastePrepareBatch(rows,headerRow=null){
  excelPasteBatchFilter='all';
  excelPasteBatchUndoSnapshot=null;excelPasteBatchUndoSummary=null;excelPasteBatchRegisteredIds=[];
  excelPasteBatchRows=rows.map((row,index)=>{
    try{
      const parsed=excelPasteRowToApplicant(row,headerRow);
      return {index,row,parsed,data:{...parsed.data},present:{...parsed.present},issues:[...parsed.issues],preview:parsed.preview,selected:false,errors:[],warnings:[],internalDuplicates:[],matchedApplicant:null,matchReasons:[],changes:[],state:'error'};
    }catch(err){
      return {index,row,parsed:null,data:{name:row[10]||'',phone:'',workplace:'',dormUse:''},present:{},issues:[excelPasteIssue('',err.message||'행 분석 실패','error','row-parse')],preview:{cells:row,headers:headerRow},selected:false,errors:[],warnings:[],internalDuplicates:[],matchedApplicant:null,matchReasons:[],changes:[],state:'error'};
    }
  });
  excelPasteBatchRecalculate();
  excelPasteBatchRows.forEach(item=>{item.selected=['new','update'].includes(item.state);});
  if($('excelPasteEditor'))$('excelPasteEditor').hidden=true;
  if($('excelPasteOriginalBlock'))$('excelPasteOriginalBlock').hidden=true;
  if($('btnApplyExcelPaste'))$('btnApplyExcelPaste').hidden=true;
  if($('btnRegisterExcelBatch'))$('btnRegisterExcelBatch').hidden=false;
  if($('btnUndoExcelBatch'))$('btnUndoExcelBatch').hidden=true;
  if($('excelBatchResult')){$('excelBatchResult').hidden=true;$('excelBatchResult').innerHTML='';}
  if($('excelPasteColumnSummary'))$('excelPasteColumnSummary').textContent='';
  const warning=$('xpBatchWarningConfirm');if(warning)warning.checked=false;
  const update=$('xpBatchDuplicateConfirm');if(update)update.checked=false;
  excelPasteBatchRender();
  const counts=excelPasteBatchRows.reduce((m,x)=>(m[x.state]=(m[x.state]||0)+1,m),{});
  excelPasteSetMessage(`여러 행 ${rows.length}건 분석 · 신규 ${counts.new||0} · 변경 ${counts.update||0} · 동일 ${counts.same||0} · 확인 필요 ${counts.review||0} · 오류 ${counts.error||0}`,(counts.review||counts.error)?'warning':'success');
}
function excelPasteBatchSelectReady(){excelPasteBatchRows.forEach(x=>x.selected=['new','update'].includes(x.state));excelPasteBatchRender();}
function excelPasteBatchClearSelection(){excelPasteBatchRows.forEach(x=>x.selected=false);excelPasteBatchRender();}
function excelPasteBatchHandleChange(target){
  const index=Number(target?.dataset?.batchIndex);if(!Number.isInteger(index)||!excelPasteBatchRows[index])return;
  const item=excelPasteBatchRows[index];
  if(target.classList.contains('excel-batch-select'))item.selected=target.checked;
  const field=target.dataset.batchField;if(field){item.data[field]=target.value;item.present=item.present||{};item.present[field]=!!excelPasteText(target.value);}
  excelPasteBatchRender();
}
function excelPasteBatchSafetyBackup(){
  try{if(window.erpBackupCenter&&typeof window.erpBackupCenter.safetyBackup==='function')return window.erpBackupCenter.safetyBackup('엑셀 여러 행 신규 등록·기존 지원자 변경 직전');}catch(err){console.warn('엑셀 일괄 변경 안전백업 생성 실패',err);}
  return null;
}
function excelPasteBatchPersistWithoutHistory(){
  if(!safeLocalStorageSet(STORAGE_KEY,JSON.stringify(applicants)))return false;
  if(typeof renderAll==='function')renderAll();
  if(typeof window.applicantProgressHistoryRefreshSnapshots==='function')window.applicantProgressHistoryRefreshSnapshots();
  return true;
}
function registerExcelPasteBatch(){
  excelPasteBatchRecalculate();
  const selected=excelPasteBatchSelected();
  excelPasteBatchUpdateSelectionState();
  const button=$('btnRegisterExcelBatch');if(!selected.length||button?.disabled)return;
  const newRows=selected.filter(x=>x.state==='new'),updates=selected.filter(x=>x.state==='update');
  const changedFields=updates.reduce((n,x)=>n+x.changes.length,0);
  const updateNames=updates.slice(0,8).map(x=>x.matchedApplicant?.name||x.data.name).join(', ');
  const message=[`엑셀 붙여넣기 내용을 적용할까요?`,`신규 등록 ${newRows.length}명`,`기존 지원자 변경 ${updates.length}명 · 변경 항목 ${changedFields}개`,updates.length?`변경 대상: ${updateNames}${updates.length>8?` 외 ${updates.length-8}명`:''}`:'',`빈 셀은 기존 값을 지우지 않습니다.`,`적용 직전 전체 ERP 안전백업 파일을 생성합니다.`].filter(Boolean).join('\n\n');
  if(!confirm(message))return;
  excelPasteBatchUndoSnapshot=JSON.parse(JSON.stringify(applicants));
  excelPasteBatchUndoSummary={newCount:newRows.length,updateCount:updates.length};
  excelPasteBatchSafetyBackup();
  const now=new Date().toISOString(),base=Date.now(),updatedById=new Map();
  updates.forEach(item=>{
    const current=applicants.find(a=>String(a.id)===String(item.matchedApplicant?.id));if(!current)return;
    const patch={...current};item.changes.forEach(change=>{patch[change.field]=item.data[change.field];});
    patch.updatedAt=now;updatedById.set(String(current.id),normalize(patch));
  });
  const updatedApplicants=applicants.map(a=>updatedById.get(String(a.id))||a);
  const created=newRows.map((item,index)=>normalize({...item.data,id:uid(),createdAt:new Date(base-index).toISOString(),updatedAt:''}));
  excelPasteBatchRegisteredIds=created.map(x=>x.id);
  applicants=[...created,...updatedApplicants];
  if(typeof window.erpMarkExcelApplicants==='function'&&excelPasteBatchRegisteredIds.length)window.erpMarkExcelApplicants(excelPasteBatchRegisteredIds);
  if(!save()){applicants=excelPasteBatchUndoSnapshot;excelPasteBatchRegisteredIds=[];if(typeof window.applicantProgressHistoryRefreshSnapshots==='function')window.applicantProgressHistoryRefreshSnapshots();return;}
  excelPasteBatchRows.forEach(item=>{if(item.selected)item.applied=true;item.selected=false;});
  const result=$('excelBatchResult');
  if(result){result.hidden=false;result.innerHTML=`<strong>신규 ${created.length}명 등록 · 기존 ${updatedById.size}명 변경 완료</strong><span>지원자 목록과 면접·입사 일정에 반영했습니다. 잘못 적용했다면 아래 실행 취소를 누르세요.</span>`;}
  if($('btnUndoExcelBatch')){$('btnUndoExcelBatch').hidden=false;$('btnUndoExcelBatch').textContent='이번 적용 실행 취소';}
  if(button){button.disabled=true;button.textContent='적용 완료';}
  const ready=$('excelPasteReadyState');if(ready){ready.className='excel-paste-ready is-ready';ready.textContent=`신규 ${created.length} · 변경 ${updatedById.size} 완료`;}
  excelPasteSetMessage(`신규 지원자 ${created.length}명 등록, 기존 지원자 ${updatedById.size}명 변경을 완료했습니다.`,'success');
  if(typeof uxToast==='function')uxToast(`엑셀 붙여넣기: 신규 ${created.length}명 · 변경 ${updatedById.size}명 적용 완료`);
}
function undoExcelPasteBatch(){
  if(!excelPasteBatchUndoSnapshot)return;
  const summary=excelPasteBatchUndoSummary||{newCount:excelPasteBatchRegisteredIds.length,updateCount:0};
  if(!confirm(`방금 적용한 작업을 모두 취소할까요?\n\n신규 ${summary.newCount}명 등록과 기존 ${summary.updateCount}명 변경을 적용 전 상태로 되돌립니다.`))return;
  const createdIds=[...excelPasteBatchRegisteredIds];
  const beforeUndo=applicants;
  applicants=JSON.parse(JSON.stringify(excelPasteBatchUndoSnapshot));
  if(typeof window.erpUnmarkExcelApplicants==='function'&&createdIds.length)window.erpUnmarkExcelApplicants(createdIds);
  if(!excelPasteBatchPersistWithoutHistory()){applicants=beforeUndo;return;}
  excelPasteBatchUndoSnapshot=null;excelPasteBatchUndoSummary=null;excelPasteBatchRegisteredIds=[];
  excelPasteBatchRows.forEach(item=>{item.applied=false;item.selected=['new','update'].includes(item.state);});
  if($('btnUndoExcelBatch'))$('btnUndoExcelBatch').hidden=true;
  if($('excelBatchResult')){$('excelBatchResult').hidden=false;$('excelBatchResult').innerHTML=`<strong>적용 취소 완료</strong><span>신규 등록과 기존 지원자 변경을 모두 적용 전 상태로 되돌렸습니다.</span>`;}
  excelPasteBatchRender();
  if(typeof uxToast==='function')uxToast('엑셀 일괄 적용을 취소했습니다.','warn');
}

function excelPasteCurrentApplicant(){ const id=$('editId')?.value||''; return id?applicants.find(a=>a.id===id)||null:null; }
function excelPasteSetMessage(message,type='info'){
  const el=$('excelPasteMessage'); if(!el)return;
  el.className=`excel-paste-message ${type}`; el.textContent=message||'';
}
function excelPasteSetField(field,value){ const el=$(EXCEL_PASTE_FIELD_MAP[field]); if(!el)return; const next=value??''; if(field==='workplace'&&next&&el.tagName==='SELECT'&&![...el.options].some(o=>o.value===next))el.add(new Option(`${next} (확인 필요)`,next)); el.value=next; }
function excelPasteGetField(field){ const el=$(EXCEL_PASTE_FIELD_MAP[field]); return el?el.value.trim():''; }
function excelPasteLiveData(){ const data={}; Object.keys(EXCEL_PASTE_FIELD_MAP).forEach(field=>data[field]=excelPasteGetField(field)); return data; }
function excelPasteResetReviewClasses(){
  document.querySelectorAll('#excelPasteEditor [data-field-wrap]').forEach(el=>el.classList.remove('needs-review','has-change','has-error'));
}
function excelPasteAgeFromBirth(v){ return typeof calcAge==='function'?Number(calcAge(v)||0):0; }
function excelPasteValidateLive(data){
  const errors=[],warnings=[];
  if(!data.name)errors.push(excelPasteIssue('name','성명은 필수입니다.','error','required-name'));
  if(!data.applyDate)errors.push(excelPasteIssue('applyDate','지원일은 필수입니다.','error','required-applyDate'));
  if(!data.phone)errors.push(excelPasteIssue('phone','연락처는 필수입니다.','error','required-phone'));
  else if(!excelPasteLooksPhone(data.phone))errors.push(excelPasteIssue('phone','연락처 형식이 올바르지 않습니다.','error','phone-format'));
  if(!data.workplace)errors.push(excelPasteIssue('workplace','지원근무지를 선택하세요.','error','required-workplace'));
  else if(!excelPasteKnownWorkplace(data.workplace))errors.push(excelPasteIssue('workplace','지원근무지는 천안·평택·기타 중 하나로 선택하세요.','error','workplace-format'));
  if(!data.dormUse)errors.push(excelPasteIssue('dormUse','출근방법을 직접 선택하세요.','error','required-dormUse'));
  if(data.email&&!excelPasteLooksEmail(data.email))errors.push(excelPasteIssue('email','이메일 형식이 올바르지 않습니다.','error','email-format'));
  if(data.gender&&!excelPasteLooksGender(data.gender))errors.push(excelPasteIssue('gender','성별 값을 확인하세요.','error','gender-format'));
  if(data.birthYear&&!excelPasteLooksBirth(data.birthYear))errors.push(excelPasteIssue('birthYear','생년월일 형식이 올바르지 않습니다.','error','birth-format'));
  excelPasteRawInvalidFields.forEach(field=>{ if(!data[field]&&!excelPasteTouchedFields.has(field))errors.push(excelPasteIssue(field,`${EXCEL_PASTE_FIELD_LABELS[field]||field} 원본 값이 해석되지 않았습니다. 올바른 값으로 수정하거나 비워 둘 것인지 확인하세요.`,'error',`raw-unresolved-${field}`)); });
  if(data.interviewTime&&!data.interviewDate)errors.push(excelPasteIssue('interviewDate','면접시간이 있으면 면접일도 입력해야 합니다.','error','schedule-interview'));
  if(['면접예정','면접완료','다음면접'].includes(data.status)&&!data.interviewDate)errors.push(excelPasteIssue('interviewDate',`${data.status} 상태에는 면접일이 필요합니다.`,'error','status-interview'));
  if(['입사예정','출근'].includes(data.status)&&!data.hireDate)errors.push(excelPasteIssue('hireDate',`${data.status} 상태에는 입사일이 필요합니다.`,'error','status-hire'));
  if(data.applyDate&&data.interviewDate&&data.interviewDate<data.applyDate)warnings.push(excelPasteIssue('interviewDate','면접일이 지원일보다 빠릅니다. 날짜를 확인하세요.','warning','date-order-interview'));
  if(data.applyDate&&data.hireDate&&data.hireDate<data.applyDate)errors.push(excelPasteIssue('hireDate','입사일이 지원일보다 빠릅니다.','error','date-order-hire'));
  if(data.interviewDate&&data.hireDate&&data.hireDate<data.interviewDate)errors.push(excelPasteIssue('hireDate','입사일이 면접일보다 빠릅니다.','error','date-order-interview-hire'));
  const expectedAge=data.birthYear?excelPasteAgeFromBirth(data.birthYear):0,enteredAge=Number(data.age||0);
  if(expectedAge&&enteredAge&&Math.abs(expectedAge-enteredAge)>1)warnings.push(excelPasteIssue('age',`생년월일 기준 나이(${expectedAge})와 입력 나이(${enteredAge})가 다릅니다.`,'warning','age-mismatch'));
  if(!data.school)warnings.push(excelPasteIssue('school','학교가 비어 있습니다.','warning','missing-school'));
  if(!data.education)warnings.push(excelPasteIssue('education','학력구분이 비어 있습니다.','warning','missing-education'));
  return {errors,warnings};
}
function excelPasteRenderOriginalPreview(preview,format){
  const block=$('excelPasteOriginalBlock'),target=$('excelPasteOriginalPreview'),note=$('excelPasteOriginalMeta');
  if(!block||!target||!preview)return;
  const headers=preview.headers&&preview.headers.some(Boolean)?preview.headers:(format.includes('2026')?EXCEL_ROW_HEADERS_2026:EXCEL_ROW_HEADERS_LEGACY);
  const cells=preview.cells||[];
  target.innerHTML=`<div class="excel-paste-original-table-wrap"><table class="excel-paste-original-table"><thead><tr>${headers.slice(0,cells.length).map(h=>`<th>${esc(h||'-')}</th>`).join('')}</tr></thead><tbody><tr>${cells.map(v=>`<td title="${esc(v)}">${esc(v||'-')}</td>`).join('')}</tr></tbody></table></div>`;
  if(note)note.textContent=`${format} · ${cells.length}열 감지`;
  block.hidden=false;
}
function excelPasteRenderValidation(errors,warnings){
  const box=$('excelPasteValidationBox'); if(!box)return;
  if(!errors.length&&!warnings.length){ box.className='excel-paste-validation is-clear'; box.innerHTML='<strong>검사 완료</strong><span>입력값 형식과 필수 항목에 문제가 없습니다.</span>'; return; }
  box.className=`excel-paste-validation ${errors.length?'has-errors':'has-warnings'}`;
  const rows=[...errors.map(i=>`<li class="is-error"><b>수정 필요</b>${esc(i.text)}</li>`),...warnings.map(i=>`<li class="is-warning"><b>확인</b>${esc(i.text)}</li>`)];
  box.innerHTML=`<div><strong>${errors.length?`수정 필요 ${errors.length}개`:'오류 없음'}${warnings.length?` · 확인 ${warnings.length}개`:''}</strong><span>${errors.length?'빨간 항목을 수정해야 입력폼에 적용할 수 있습니다.':'노란 항목을 확인한 뒤 계속할 수 있습니다.'}</span></div><ul>${rows.join('')}</ul>`;
}
function excelPasteMemoMode(){ return document.querySelector('input[name="xpMemoMode"]:checked')?.value||'append'; }
function excelPasteSelectedFields(){
  const current=excelPasteCurrentApplicant();
  return current?[...document.querySelectorAll('.excel-paste-apply:checked')].map(el=>el.dataset.field):Object.keys(EXCEL_PASTE_FIELD_MAP);
}
function excelPasteUpdateCompareVisibility(data,errors=[],warnings=[]){
  const current=excelPasteCurrentApplicant();
  const issueFields=new Set([...errors,...warnings].map(i=>i.field));
  document.querySelectorAll('#excelPasteEditor [data-field-wrap]').forEach(wrap=>{
    if(!current){wrap.hidden=false;return;}
    const field=wrap.dataset.fieldWrap;
    const next=data[field]||'',before=current[field]||'';
    const changed=!!excelPasteSourcePresent[field]&&!!excelPasteText(next)&&!excelPasteSameValue(field,before,next);
    wrap.hidden=!(changed||issueFields.has(field));
  });
  document.querySelectorAll('#excelPasteEditor .excel-paste-field-group').forEach(group=>{
    if(!current){group.hidden=false;return;}
    group.hidden=![...group.querySelectorAll('[data-field-wrap]')].some(w=>!w.hidden);
  });
  const memoModeWrap=$('excelPasteMemoModeWrap');
  if(memoModeWrap)memoModeWrap.hidden=!current||document.querySelector('[data-field-wrap="memo"]')?.hidden!==false;
}
function excelPasteRenderFinalSummary(data){
  const box=$('excelPasteFinalSummary'); if(!box)return;
  const current=excelPasteCurrentApplicant();
  if(current){
    const fields=excelPasteSelectedFields().filter(field=>excelPasteText(data[field]));
    if(!fields.length){ box.innerHTML='<div class="excel-paste-summary-head"><strong>적용할 변경 없음</strong><span>달라진 항목의 체크박스를 선택하세요.</span></div>'; return; }
    const rows=fields.map(field=>{
      const before=current[field]||''; let after=data[field]||'';
      let note='';
      if(field==='memo'&&excelPasteMemoMode()==='append'){ note='기존 메모 뒤에 추가'; after=before?`${before} + ${after}`:after; }
      return `<div class="excel-paste-change-row"><span>${esc(EXCEL_PASTE_FIELD_LABELS[field]||field)}</span><strong>${esc(before||'비어 있음')}</strong><b>→</b><em>${esc(after||'비어 있음')}</em>${note?`<small>${esc(note)}</small>`:''}</div>`;
    }).join('');
    box.innerHTML=`<div class="excel-paste-summary-head"><strong>적용 전 변경 내역 ${fields.length}개</strong><span>선택한 항목만 기존 지원자 입력폼에 반영됩니다.</span></div><div class="excel-paste-change-list">${rows}</div>`;
    return;
  }
  const schedule=data.interviewDate?`${data.interviewDate}${data.interviewTime?` ${data.interviewTime}`:''}`:'면접 미정';
  const items=[['성명',data.name||'미입력'],['연락처',data.phone||'미입력'],['지원',`${data.applyDate||'미입력'} · ${data.status||'서류검토'}`],['근무',`${data.workplace||'미선택'} · ${data.dormUse||'미선택'}`],['학력',`${data.education||'미선택'} · ${data.school||'학교 미입력'}`],['일정',schedule]];
  box.innerHTML=`<div class="excel-paste-summary-head"><strong>적용 전 최종 요약</strong><span>아래 내용이 기존 지원자 입력폼으로 전달됩니다.</span></div><div class="excel-paste-summary-grid">${items.map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('')}</div>`;
}
function excelPasteRenderDuplicates(data){
  const box=$('excelPasteDuplicateBox'); if(!box)return [];
  const previousSignature=excelPasteDuplicateMatches.map(x=>`${x.applicant.id}:${x.reasons.join(',')}`).join('|');
  const previousConfirmed=!!$('xpDuplicateConfirm')?.checked;
  const current=excelPasteCurrentApplicant(),rows=excelPasteFindDuplicates(data,current?.id||'');
  const nextSignature=rows.map(x=>`${x.applicant.id}:${x.reasons.join(',')}`).join('|');
  excelPasteDuplicateMatches=rows;
  if(!rows.length){ box.className='excel-paste-duplicate clear'; box.innerHTML='<div><strong>중복 후보 없음</strong><span>연락처·이메일·성명+생년월일 기준으로 같은 지원자를 찾지 못했습니다.</span></div>'; return rows; }
  box.className='excel-paste-duplicate warning';
  box.innerHTML=`<div><strong>중복 가능성 ${rows.length}명</strong><span>기존 지원자를 확인하고 신규 등록 또는 수정 적용 여부를 판단하세요.</span></div><div class="excel-paste-duplicate-list">${rows.map(({applicant:a,reasons})=>`<div class="excel-paste-duplicate-row"><span><b>${esc(a.name||'이름없음')}</b> · ${esc(a.phone||'연락처 없음')} · ${esc(a.applyDate||'지원일 없음')}<small>${reasons.map(esc).join(' · ')}</small></span><button class="mini" data-excel-duplicate-id="${esc(a.id)}" type="button">기존 지원자 보기</button></div>`).join('')}</div><label class="excel-paste-confirm-line"><input id="xpDuplicateConfirm" type="checkbox"/> 중복 후보를 확인했으며 계속 진행합니다.</label>`;
  if(previousConfirmed&&previousSignature===nextSignature&&$('xpDuplicateConfirm'))$('xpDuplicateConfirm').checked=true;
  return rows;
}
function excelPasteUpdateApplyState(){
  if(!excelPasteParsedData)return;
  const data=excelPasteLiveData(),validation=excelPasteValidateLive(data);
  const staticErrors=excelPasteParseIssues.filter(i=>i.level==='error').filter(i=>{
    if(i.code==='layout-confidence')return true;
    if(String(i.code).startsWith('raw-'))return !excelPasteIssueResolved(i,data)&&!excelPasteTouchedFields.has(i.field);
    return false;
  });
  const staticWarnings=excelPasteParseIssues.filter(i=>i.level!=='error'&&!validation.warnings.some(w=>w.code===i.code));
  const errors=[...staticErrors,...validation.errors].filter((issue,index,arr)=>arr.findIndex(x=>x.field===issue.field&&x.code===issue.code)===index);
  const warnings=[...staticWarnings,...validation.warnings];
  excelPasteResetReviewClasses();
  errors.forEach(i=>document.querySelector(`[data-field-wrap="${i.field}"]`)?.classList.add('has-error'));
  warnings.forEach(i=>document.querySelector(`[data-field-wrap="${i.field}"]`)?.classList.add('needs-review'));
  const current=excelPasteCurrentApplicant();
  if(current){
    document.querySelectorAll('.excel-paste-apply').forEach(check=>{
      const field=check.dataset.field,currentValue=current?.[field]||'',nextValue=data[field]||'';
      const wrap=document.querySelector(`[data-field-wrap="${field}"]`);
      wrap?.classList.toggle('has-change',!excelPasteSameValue(field,currentValue,nextValue));
    });
  }
  excelPasteRenderValidation(errors,warnings);
  excelPasteUpdateCompareVisibility(data,errors,warnings);
  excelPasteRenderFinalSummary(data);
  const duplicates=excelPasteRenderDuplicates(data);
  const selectedFields=excelPasteSelectedFields();
  const manualRequired=!current||selectedFields.some(field=>['workplace','dormUse'].includes(field));
  const manualBox=document.querySelector('.excel-paste-manual-check'); if(manualBox)manualBox.hidden=!manualRequired;
  const manualConfirmed=!manualRequired||!!$('xpManualConfirm')?.checked;
  const duplicateConfirmed=!duplicates.length||!!$('xpDuplicateConfirm')?.checked;
  const selectionOkay=!current||selectedFields.length>0;
  const button=$('btnApplyExcelPaste');
  if(button){
    button.disabled=!!errors.length||!manualConfirmed||!duplicateConfirmed||!selectionOkay;
    button.textContent=current?'선택 항목을 입력폼에 적용':'입력폼에 적용';
    button.title=errors.length?'수정 필요 항목을 먼저 해결하세요.':!manualConfirmed?'지원근무지와 출근방법 확인 체크가 필요합니다.':!duplicateConfirmed?'중복 후보 확인 체크가 필요합니다.':!selectionOkay?'적용 항목을 선택하세요.':'';
  }
  const status=$('excelPasteReadyState');
  if(status){
    if(errors.length){status.className='excel-paste-ready is-blocked';status.textContent=`적용 불가 · 수정 필요 ${errors.length}개`;}
    else if(!manualConfirmed){status.className='excel-paste-ready is-waiting';status.textContent='지원근무지·출근방법 확인 필요';}
    else if(!duplicateConfirmed){status.className='excel-paste-ready is-waiting';status.textContent='중복 후보 확인 필요';}
    else{status.className='excel-paste-ready is-ready';status.textContent='입력폼 적용 가능';}
  }
}
function excelPastePopulateEditor(data,issues=[],present={},meta={}){
  const current=excelPasteCurrentApplicant(),prepared=current?{...current}:{...data};
  if(current){
    Object.keys(EXCEL_PASTE_FIELD_MAP).forEach(field=>{
      const incoming=excelPasteText(data[field]);
      if(present[field]&&incoming)prepared[field]=data[field];
    });
  }else{
    Object.keys(EXCEL_PASTE_FIELD_MAP).forEach(field=>{ if(!present[field]&&$(field)?.value)prepared[field]=$(field).value; });
  }
  excelPasteParsedData={...prepared}; excelPasteParseIssues=issues; excelPasteSourcePresent={...present}; excelPasteDetectedFormat=meta.format||'';
  excelPasteTouchedFields=new Set();
  excelPasteRawInvalidFields=new Set(issues.filter(i=>i.level==='error'&&String(i.code).startsWith('raw-')).map(i=>i.field));
  Object.keys(EXCEL_PASTE_FIELD_MAP).forEach(field=>excelPasteSetField(field,prepared[field]||''));
  const card=document.querySelector('#excelRowPasteModal .excel-paste-modal-card'); card?.classList.toggle('is-edit-mode',!!current);
  document.querySelectorAll('.excel-paste-apply').forEach(check=>{
    const field=check.dataset.field,currentValue=current?.[field]||'',nextValue=prepared[field]||'';
    check.checked=!!current&&!!excelPasteSourcePresent[field]&&!!excelPasteText(nextValue)&&!excelPasteSameValue(field,currentValue,nextValue);
    const note=document.querySelector(`[data-current-for="${field}"]`); if(note)note.textContent=current?`현재: ${currentValue||'비어 있음'}`:'';
  });
  if($('xpManualConfirm'))$('xpManualConfirm').checked=false;
  const appendMemo=document.querySelector('input[name="xpMemoMode"][value="append"]'); if(appendMemo)appendMemo.checked=true;
  const editor=$('excelPasteEditor'); if(editor)editor.hidden=false;
  const summary=$('excelPasteColumnSummary'); if(summary)summary.textContent=`${excelPasteDetectedFormat||'행 형식 감지'} · ${meta.confidence===100?'헤더 매핑':`자동 판별 점수 ${meta.confidence}`}`;
  excelPasteRenderOriginalPreview(meta.preview,excelPasteDetectedFormat);
  excelPasteUpdateApplyState();
  const errorCount=issues.filter(i=>i.level==='error').length;
  excelPasteSetMessage(errorCount?`행 분석은 완료됐지만 수정이 필요한 값이 ${errorCount}개 있습니다.`:'행을 정상적으로 분석했습니다. 최종 내용을 확인하세요.',errorCount?'error':'success');
}
function parseExcelRowPaste(){
  try{
    const raw=$('excelPasteRaw')?.value||'';
    if(!raw.trim())throw new Error('엑셀에서 지원자 한 행 또는 여러 행을 복사한 뒤 붙여넣어 주세요.');
    let rows=excelPasteParseTsv(raw),headerRow=null;
    if(rows.length&&excelPasteIsHeaderRow(rows[0]))headerRow=rows.shift();
    rows=rows.filter(row=>row.some(Boolean));
    if(!rows.length)throw new Error('지원자 데이터 행을 찾지 못했습니다. 헤더가 아닌 지원자 행도 함께 복사해 주세요.');
    if(rows.length>1){
      if(excelPasteCurrentApplicant())throw new Error('기존 지원자 수정 중에는 한 행만 붙여넣을 수 있습니다. 여러 행 등록은 신규 등록 화면에서 진행하세요.');
      excelPasteBatchHeaderRow=headerRow;
      excelPastePrepareBatch(rows,headerRow);
      return;
    }
    if($('excelPasteBatch'))$('excelPasteBatch').hidden=true;
    if($('btnRegisterExcelBatch'))$('btnRegisterExcelBatch').hidden=true;
    if($('btnUndoExcelBatch'))$('btnUndoExcelBatch').hidden=true;
    if($('btnApplyExcelPaste'))$('btnApplyExcelPaste').hidden=false;
    const parsed=excelPasteRowToApplicant(rows[0],headerRow);
    let autoLinked=null;
    if(!excelPasteCurrentApplicant()){
      const digits=excelPastePhoneDigits(parsed.data.phone);
      const matches=digits.length>=8?applicants.filter(a=>excelPastePhoneDigits(a.phone)===digits):[];
      if(matches.length===1){
        autoLinked=matches[0];
        fillForm(autoLinked);
        const card=document.querySelector('#excelRowPasteModal .excel-paste-modal-card'); card?.classList.add('is-edit-mode');
        if($('excelPasteModeBadge'))$('excelPasteModeBadge').textContent='기존 지원자 자동 연결';
        if($('excelPasteCandidateLabel'))$('excelPasteCandidateLabel').textContent=`연락처가 같은 ${autoLinked.name||'기존 지원자'}의 현재 값과 비교합니다.`;
      }
    }
    excelPastePreviewMeta=parsed.preview;
    excelPastePopulateEditor(parsed.data,parsed.issues,parsed.present,{format:parsed.format,confidence:parsed.confidence,preview:parsed.preview});
    if(autoLinked)excelPasteSetMessage(`연락처가 같은 기존 지원자 “${autoLinked.name||'이름없음'}”에 자동 연결했습니다. 달라진 항목만 선택해 적용하세요.`,'success');
  }catch(err){
    excelPasteParsedData=null; excelPasteParseIssues=[]; excelPasteSourcePresent={}; excelPasteDetectedFormat=''; excelPasteRawInvalidFields=new Set();
    excelPasteBatchRows=[];
    if($('excelPasteEditor'))$('excelPasteEditor').hidden=true;
    if($('excelPasteBatch'))$('excelPasteBatch').hidden=true;
    if($('excelPasteOriginalBlock'))$('excelPasteOriginalBlock').hidden=true;
    if($('btnApplyExcelPaste')){$('btnApplyExcelPaste').disabled=true;$('btnApplyExcelPaste').hidden=false;}
    if($('btnRegisterExcelBatch'))$('btnRegisterExcelBatch').hidden=true;
    if($('btnUndoExcelBatch'))$('btnUndoExcelBatch').hidden=true;
    excelPasteSetMessage(err.message||'붙여넣은 행을 분석하지 못했습니다.','error');
  }
}
function resetExcelRowPaste(){
  excelPasteParsedData=null; excelPasteParseIssues=[]; excelPasteSourcePresent={}; excelPasteDetectedFormat=''; excelPasteRawInvalidFields=new Set(); excelPasteDuplicateMatches=[]; excelPastePreviewMeta=null; excelPasteTouchedFields=new Set(); excelPasteBatchRows=[]; excelPasteBatchRegisteredIds=[]; excelPasteBatchUndoSnapshot=null; excelPasteBatchUndoSummary=null; excelPasteBatchHeaderRow=null;
  if($('excelPasteRaw'))$('excelPasteRaw').value='';
  if($('excelPasteEditor'))$('excelPasteEditor').hidden=true;
  if($('excelPasteBatch'))$('excelPasteBatch').hidden=true;
  if($('btnApplyExcelPaste'))$('btnApplyExcelPaste').hidden=false;
  if($('btnRegisterExcelBatch'))$('btnRegisterExcelBatch').hidden=true;
  if($('btnUndoExcelBatch'))$('btnUndoExcelBatch').hidden=true;
  if($('excelBatchResult')){$('excelBatchResult').hidden=true;$('excelBatchResult').innerHTML='';}
  if($('xpBatchWarningConfirm'))$('xpBatchWarningConfirm').checked=false;
  if($('xpBatchDuplicateConfirm'))$('xpBatchDuplicateConfirm').checked=false;
  if($('excelPasteOriginalBlock'))$('excelPasteOriginalBlock').hidden=true;
  if($('btnApplyExcelPaste'))$('btnApplyExcelPaste').disabled=true;
  if($('excelPasteDuplicateBox'))$('excelPasteDuplicateBox').innerHTML='';
  if($('excelPasteValidationBox'))$('excelPasteValidationBox').innerHTML='';
  if($('excelPasteFinalSummary'))$('excelPasteFinalSummary').innerHTML='';
  excelPasteSetMessage(''); excelPasteResetReviewClasses();
}
function openExcelRowPaste(){
  resetExcelRowPaste();
  const modal=$('excelRowPasteModal'),current=excelPasteCurrentApplicant(); if(!modal)return;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  const card=modal.querySelector('.excel-paste-modal-card'); card?.classList.toggle('is-edit-mode',!!current);
  if($('excelPasteModeBadge'))$('excelPasteModeBadge').textContent=current?'기존 지원자 수정':'신규 등록';
  if($('excelPasteCandidateLabel'))$('excelPasteCandidateLabel').textContent=current?`${current.name||'현재 지원자'}의 엑셀 값과 현재 값을 비교합니다.`:'엑셀에서 지원자 한 행을 복사해 붙여넣으세요.';
  setTimeout(()=>$('excelPasteRaw')?.focus(),0);
}
function closeExcelRowPaste(){ const modal=$('excelRowPasteModal'); if(!modal)return; modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }
function applyExcelRowPasteToForm(){
  if(!excelPasteParsedData){excelPasteSetMessage('먼저 붙여넣은 행을 분석해 주세요.','error');return;}
  excelPasteUpdateApplyState();
  const button=$('btnApplyExcelPaste'); if(button?.disabled){excelPasteSetMessage('수정 필요 항목과 확인 체크를 모두 완료해야 적용할 수 있습니다.','error');return;}
  const current=excelPasteCurrentApplicant();
  const selectedFields=excelPasteSelectedFields();
  selectedFields.forEach(field=>{
    const target=$(field); if(!target)return;
    let value=excelPasteGetField(field);
    if(current&&!excelPasteText(value))return; // 빈 엑셀 칸은 기존 값을 지우지 않음
    if(field==='memo'&&current&&excelPasteMemoMode()==='append'&&value){
      const existing=target.value.trim();
      value=existing&&existing!==value?`${existing}
${value}`:value;
    }
    if(field==='interviewTime'&&value&&target.tagName==='SELECT'&&![...target.options].some(o=>o.value===value))target.add(new Option(value,value));
    if(field==='workplace'&&value&&target.tagName==='SELECT'&&![...target.options].some(o=>o.value===value))target.add(new Option(value,value));
    target.value=value; target.dispatchEvent(new Event('input',{bubbles:true})); target.dispatchEvent(new Event('change',{bubbles:true}));
  });
  window.__erpExcelPastePendingApplicant=current?String(current.id):'__new__';
  updateApplicantFormDerivedFields(); checkDuplicate(); updateFormMode(); closeExcelRowPaste();
  if(typeof uxToast==='function')uxToast(current?'선택한 엑셀 값을 수정 폼에 적용했습니다. 저장 버튼을 눌러 확정하세요.':'검증된 엑셀 값을 신규 지원자 폼에 적용했습니다. 내용을 확인한 뒤 등록하세요.');
  setTimeout(()=>$('name')?.focus(),0);
}
