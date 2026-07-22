/* =========================================================
   v10.12.4 연락처 자동 하이픈 포맷
   - 010 1234 5678 / 010.1234.5678 / 01012345678 등 어떻게 입력해도
     저장 시점(normalize)에 010-1234-5678 형태로 통일
   - 서울 지역번호(02), 그 외 지역번호(0XX), 알 수 없는 형식은
     원래 숫자만 남긴 값으로 안전하게 폴백(잘못된 자리로 하이픈을
     끼워넣지 않음)
   ========================================================= */
function formatPhoneDisplay(v){
  const raw = String(v || '').trim();
  if(!raw) return '';
  const digits = raw.replace(/\D/g,'');
  if(!digits) return raw;
  if(digits.startsWith('02')){
    if(digits.length === 9) return `${digits.slice(0,2)}-${digits.slice(2,5)}-${digits.slice(5,9)}`;
    if(digits.length === 10) return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,10)}`;
    return digits;
  }
  if(digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
  if(digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
  return digits;
}
function textOf(a){
  return `${a.dormUse||''} ${a.education||''} ${a.finalEducation||''} ${a.school||''} ${a.major||''}
    ${a.gradePoint||''} ${a.languageEtc||''} ${a.certs||''} ${a.career||''} ${a.lastCompany||''} ${a.duties||''}
    ${a.leaveReason||''} ${a.careerType||''} ${a.jobFitCategory||''} ${a.consult||''} ${a.memo||''}
    ${a.decisionReason||''} ${a.selfIntroKeywords||''}`.toLowerCase();
  }
function deriveScores(a){
  const text=textOf(a);
  let major=0, career=0, cert=0, field=0;
  if(/반도체|전기|전자|기계|자동화|메카|설비|정비|금형|항공정비|컴퓨터소프트웨어|융합소프트웨어|건축공학/.test(text)) major += 15;
  if(/반도체장비|전기에너지|전기전자|전기공학|기계자동차|반도체과학|전기전공|반도체장비설계|항공정비전공/.test(text)) major += 10;
  if(/pm|예방정비|설비|장비|maintenance|field|fe|셋업|set.?up|반도체|fab|클린룸|방진복|plc|drive|analyzer|bhs|정비|유지보수|기술지원|설비이상대응|전기정비|시설운영|출입제어/.test(text)) career += 25;
  if(/pm경력|pm 직접|반도체 장비|장비 셋업|전기정비|시설운영|포스코|에스원|에이치앤에스테크|현장|경력|재직중/.test(text)) career += 10;
  if(/전기기능사|전기산업기사|전기기사|산업안전|기계|설비보전|반도체설비보전|항공기정비|지게차|굴착기|기능사|산업기사|기사|운전면허|소방안전|컴활|adsp|1종보통/.test(text)) cert += 15;
  if(/지게차|굴착기|운전면허|1종|기능사|기사|산업기사/.test(text)) cert += 5;
  if(/교대|군|정비병|차량정비|안전|책임|성실|소통|인수인계|점검|현장|방진복|체력|보안|규정|매뉴얼|문제해결|트러블|개선|군입대|병력필/.test(text)) field += 15;
  if(a.name && a.phone && a.workplace && a.applyDate) field += 5;
  major=Math.min(major,25); career=Math.min(career,35); cert=Math.min(cert,20); field=Math.min(field,20);
  return {major, career, cert, field, total:major+career+cert+field};
}
function calcScore(a){ return deriveScores(a).total; }
function grade(score){ if(score>=80) return '우선검토'; if(score>=65) return '검토가능'; if(score>=45) return '추가확인'; return '조건미흡 가능성'; }
function displayCategory(a){
  if(a.jobFitCategory) return a.jobFitCategory;
  const text=textOf(a);
  if(/pm|예방정비/.test(text) && /반도체|설비|장비/.test(text)) return 'PM 직접경력자';
  if(/반도체.*(장비|셋업|fe|field)|장비.*셋업|fe|field/.test(text)) return '반도체 장비/FE 경험자';
  if(/전기정비|plc|drive|설비.*정비|유지보수|기술지원/.test(text)) return '전기·설비 정비 경험자';
  if(/기계|금형|차량정비|항공정비|선반|밀링/.test(text)) return '기계·금형·차량정비 경험자';
  if(/시설운영|설비이상대응|출입제어/.test(text)) return '시설운영/설비이상대응 경험자';
  if(/전기|전자|기계|반도체|자동화|소프트웨어/.test(text)) return '관련전공 신입';
  if(/교대|현장|군|보안|정비병|안전/.test(text)) return '현장근무 적응형';
  return '확인필요';
}
function badgeClass(status){
  if(['불합격','철회','연락두절'].includes(status)) return 'bad';
  if(status==='서류탈락') return 'neutral';
  if(['입사예정','출근'].includes(status)) return 'good';
  if(['면접예정','다음면접','면접완료'].includes(status)) return 'info';
  if(['부재중','미연락'].includes(status)) return 'missed';
  return 'hold';
}
function statusToneClass(a){ return normalizeStatus(a?.status)==='서류탈락' ? 'is-paper-rejected' : ''; }
function applicantRowToneClass(a){
  const status=normalizeStatus(a?.status);
  if(isFinished(a)) return 'is-finished';
  if(['입사예정','출근'].includes(status) || a?.finalDecision==='합격') return 'is-hire-track';
  if(['면접예정','다음면접','면접완료'].includes(status)) return 'is-interview-track';
  if(['미연락','부재중'].includes(status)) return 'is-contact-track';
  return 'is-neutral-track';
}
function workplaceBadgeClass(value){
  const workplace=String(value||'').trim();
  if(workplace==='천안') return 'workplace-cheonan';
  if(workplace==='평택') return 'workplace-pyeongtaek';
  if(!workplace) return 'workplace-empty';
  return 'workplace-other';
}
function decisionToneClass(a){
  const decision=String(a?.finalDecision||'').trim();
  if(decision==='합격') return 'decision-good';
  if(['불합격','입사포기','철회'].includes(decision) || isFinished(a)) return 'decision-finished';
  return 'decision-neutral';
}
function nextAction(a){
  if(!a.status || a.status==='미연락') return '첫 연락 필요';
  if(a.status==='부재중') return '재연락';
  if(a.status==='면접예정') return '면접 일정 확인';
  if(a.status==='면접완료') return a.finalDecision ? a.finalDecision : '판정 입력';
  if(a.status==='다음면접') return '다음 면접 조율';
  if(a.status==='출근') return '출근 완료';
  if(a.status==='입사예정') return '입사 안내';
  
  return a.finalDecision || '-';
}
function isFinished(a){ return ['불합격','서류탈락','철회','연락두절'].includes(a.status) || ['불합격','입사포기'].includes(a.finalDecision); }
function isActive(a){ return !isFinished(a); }
function hasFinalDecision(a){ return !!String(a?.finalDecision || '').trim(); }
function isDecisionNeeded(a){ return isActive(a) && a.status === '면접완료' && !hasFinalDecision(a); }
function finalDecisionOf(a){ return a.finalDecision || grade(calcScore(a)); }

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
  const d = daysUntil(a.hireDate);
  return d !== null && d >= 0 && d <= 7 && isActive(a);
}
function countText(n){ return `${n}명`; }
function setText(id, value){ const el=$(id); if(el) el.textContent=value; }

function setPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titleMap = {home:'홈',applicants:'지원자 목록',form:'신규 지원자 등록',today:'오늘 할 일',calendar:'일정관리',stats:'채용 통계',schools:'협력학교 관리',employees:'사원명부',templates:'안내문 템플릿',advancedSearch:'고급검색',dataHealth:'데이터 점검센터',duplicates:'중복 지원자 관리',backup:'백업/내보내기'};
  const descMap = {
    home:'오늘의 채용 업무와 주요 현황을 확인합니다.',
    applicants:'지원자 진행상태와 면접·입사 일정을 관리합니다.',
    form:'새 지원자의 기본정보와 전형정보를 등록합니다.',
    today:'오늘 우선 처리할 채용 업무를 확인합니다.',
    calendar:'면접·입사·관리 일정을 한눈에 확인합니다.',
    stats:'채용 흐름과 주요 성과지표를 분석합니다.',
    schools:'협력학교 현황과 지원자·직원 배출 정보를 관리합니다.',
    employees:'재직·휴직·퇴사 현황과 출신학교 정보를 확인합니다.',
    templates:'지원자 안내문을 빠르게 작성하고 복사합니다.',
    advancedSearch:'여러 검색조건을 조합하고 자주 쓰는 조건을 저장합니다.',
    dataHealth:'데이터 누락과 상태 불일치를 읽기 전용으로 점검합니다.',
    duplicates:'중복 후보와 재지원 기록을 사용자 확인 방식으로 검토합니다.',
    backup:'ERP 데이터를 안전하게 백업하고 복원합니다.'
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
  const todayInterviews=applicants.filter(a=>isActive(a) && a.interviewDate===t);
  const upcomingInterviews=applicants.filter(a=>{
    if(!isActive(a)) return false;
    if(a.interviewDate && a.interviewDate!==t && daysUntil(a.interviewDate) >= 0) return true;
    return ['면접예정','다음면접'].includes(a.status) && !a.interviewDate;
  }).sort((a,b)=>{
    const av=a.interviewDate || '9999-12-31';
    const bv=b.interviewDate || '9999-12-31';
    return (av+' '+(a.interviewTime||'23:59')).localeCompare(bv+' '+(b.interviewTime||'23:59'));
  });
  const recalls=applicants.filter(a=>{
    if(!isActive(a)) return false;
    const next=a.nextContactDate||'';
    const statusNeeds=['부재중','미연락'].includes(a.status);
    return next===t || (statusNeeds && (!next || next<=t));
  });
  const dorms=applicants.filter(isDormPending);
  const hireD7=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===7);
  const hireD3=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===3);
  const hireToday=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===0);
  const hireSoon=applicants.filter(isHireSoon);
  const decisions=applicants.filter(isDecisionNeeded);
  const weekInterviews=applicants.filter(a=>isActive(a) && a.interviewDate && daysUntil(a.interviewDate)>=0 && daysUntil(a.interviewDate)<=6);
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
function card(a){
  const score=calcScore(a), decision=finalDecisionOf(a), dorm=dormLabel(a);
  const schedule=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ');
  const scheduleText=schedule ? `면접 ${schedule} · ` : '';
  return `<div class="person-card compact-person-card ${statusToneClass(a)}">
    <div><strong><span class="person-name ${genderClass(a)}">${esc(a.name||'이름없음')}</span>
    <span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></strong>
    <small>${esc(scheduleText)}${esc(a.workplace||'근무지 미입력')} · ${esc(dorm)} · ${esc(displayCategory(a))} · ${score}점/${esc(decision)}</small></div>
    <button class="mini" onclick="editApplicant('${a.id}')">수정</button></div>`;
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
  el.innerHTML = `<div class="reminder-text"><strong>일정 알림</strong><span>${esc(segs.join('  ·  '))}</span></div><div class="reminder-actions"><button class="mini" onclick="setPage('calendar')">캘린더 보기</button><button class="mini" onclick="dismissScheduleReminder()">오늘은 닫기</button></div>`;
}
function dismissScheduleReminder(){ localStorage.setItem(REMINDER_DISMISS_KEY, today()); renderScheduleReminder(); }
function renderHomeLists(){
  const todayStr=today();
  const priority = applicants.filter(a=>
    (a.interviewDate===todayStr) ||
    ['미연락','부재중'].includes(a.status) ||
    isDormPending(a) ||
    isHireSoon(a) ||
    (a.interviewDate && daysUntil(a.interviewDate)<0 && ['면접예정','다음면접'].includes(a.status)) ||
    (a.hireDate && daysUntil(a.hireDate)<0 && a.status==='입사예정') ||
    (a.status==='면접완료' && !a.finalDecision)
  ).sort((a,b)=>{
    const ap = a.interviewDate===todayStr ? 0 : isHireSoon(a) ? 1 : ['미연락','부재중'].includes(a.status) ? 2 : isDormPending(a) ? 3 : 4;
    const bp = b.interviewDate===todayStr ? 0 : isHireSoon(b) ? 1 : ['미연락','부재중'].includes(b.status) ? 2 : isDormPending(b) ? 3 : 4;
    return ap-bp;
  }).slice(0,6);
  const recent=[...applicants].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  $('priorityList').innerHTML=priority.length?priority.map(card).join(''):`<div class="empty">오늘 우선 처리할 지원자가 없습니다.</div>`;
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
  let rows = applicants.filter(a=>{
    const workplaceOk=currentWorkplace==='all'||(currentWorkplace==='기타'?!['천안','평택'].includes(a.workplace):a.workplace===currentWorkplace);
    const text=Object.values(a).join(' ').toLowerCase();
    const searchOk=!currentSearch||text.includes(currentSearch.toLowerCase());
    const schoolOk=!currentSchoolFilterId||a.schoolId===currentSchoolFilterId;
    let filterOk=true;
    if(currentFilter==='priority') filterOk=finalDecisionOf(a)==='우선검토';
    if(currentFilter==='contact') filterOk=['미연락','부재중'].includes(a.status);
    if(currentFilter==='interview') filterOk=['면접예정','다음면접'].includes(a.status);
    if(currentFilter==='decision') filterOk=isDecisionNeeded(a);
    if(currentFilter==='hold') filterOk=a.finalDecision==='보류';
    if(currentFilter==='active') filterOk=isActive(a);
    if(currentFilter==='hire') filterOk=['입사예정','출근'].includes(a.status) || a.finalDecision==='합격';
    if(currentFilter==='finished') filterOk=isFinished(a);
    if(currentFilter==='rejected') filterOk=a.status==='서류탈락';
    if(currentFilter==='duplicate') filterOk=dupSet.has(normalizePhone(a.phone));
    return workplaceOk && searchOk && schoolOk && filterOk;
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
    if(currentSort==='scoreDesc') return calcScore(b)-calcScore(a);
    if(currentSort==='nameAsc') return (a.name||'').localeCompare(b.name||'', 'ko');
    return (b.createdAt||'').localeCompare(a.createdAt||'');
  });
  return rows;
}
function resetListFiltersToAll(){
  currentWorkplace='all'; currentFilter='all'; currentSearch=''; currentSort='recent'; hideFinished=false; currentSchoolFilterId='';
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
    contact:applicants.filter(a=>['미연락','부재중'].includes(a.status)).length,
    decision:applicants.filter(isDecisionNeeded).length,
    duplicate:applicants.filter(a=>duplicateSet.has(normalizePhone(a.phone))).length
  };
  document.querySelectorAll('#quickFilters [data-filter]').forEach(button=>{
    const count=filterCounts[button.dataset.filter] ?? 0;
    const target=button.querySelector('[data-filter-count]');
    if(target) target.textContent=String(count);
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });
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
function renderTable(){
  const rows=filtered();
  updateApplicantListFilterCounts();
  const dupChip=$('duplicateFilterChip');
  if(dupChip){
    const n=applicants.filter(a=>duplicatePhoneSet().has(normalizePhone(a.phone))).length;
    dupChip.classList.toggle('chip-alert', n>0);
  }
  const sortName=$('sortSelect')?.selectedOptions?.[0]?.textContent || '최근 등록순';
  const contactCount=rows.filter(a=>['미연락','부재중'].includes(a.status)).length;
  const interviewCount=rows.filter(a=>['면접예정','다음면접'].includes(a.status) || a.interviewDate).length;
  const dormCount=rows.filter(a=>dormLabel(a)==='기숙사').length;
  const commuteCount=rows.filter(a=>dormLabel(a)==='출퇴근').length;
  const dormPendingCount=rows.filter(isDormPending).length;
  const schoolFilterName = currentSchoolFilterId ? (schools.find(s=>s.id===currentSchoolFilterId)?.name || '선택한 학교') : '';
  $('listSummary').innerHTML = `<span class="summary-strong">${rows.length}명</span> 표시 <span>정렬 ${esc(sortName)}</span><span>연락필요 ${contactCount}명</span><span>면접/예정 ${interviewCount}명</span><span class="summary-commute">출근방법: 기숙사 ${dormCount}명 · 출퇴근 ${commuteCount}명 · 확인 ${dormPendingCount}명</span>${hideFinished ? '<span>종료숨김 적용</span>' : ''}${schoolFilterName ? `<span class="workplace-pill school-filter-pill">학교 필터: ${esc(schoolFilterName)}<button onclick="currentSchoolFilterId='';renderTable();" aria-label="학교 필터 해제">×</button></span>` : ''}<span class="list-interaction-hint">행 클릭 → 상세보기</span>`;
  $('applicantTbody').innerHTML=rows.length?rows.map((a,idx)=>{
    const score=calcScore(a), decision=finalDecisionOf(a);
    const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ');
    const scheduleStrong = interview || '일정 미정';
    const scheduleNote = interview ? '' : (['면접예정','다음면접'].includes(a.status) ? '<small>일정 확인</small>' : '');
    const dorm = dormLabel(a);
    const typeLine = [a.careerType, a.education].filter(Boolean).join(' · ') || '기본정보 미입력';
    const staleDays = ['미연락','부재중'].includes(a.status) ? daysSinceApply(a) : null;
    const staleBadge = (staleDays!==null && staleDays>=3) ? `<span class="stale-badge" title="지원일 기준 ${staleDays}일째 연락 안 됨">${staleDays}일째</span>` : '';
    return `<tr class="applicant-row compact-row clickable-data-row ${applicantRowToneClass(a)}" data-applicant-id="${a.id}" tabindex="0" onclick="if(!event.target.closest('button,select,a,input,label,summary,details')) viewApplicant('${a.id}')" onkeydown="listRowKeyActivate(event,()=>viewApplicant('${a.id}'))">
      <td class="no-cell sticky-app-col sticky-app-no" data-label="번호">${idx+1}</td>
      <td class="applicant-name-cell sticky-app-col sticky-app-name" data-label="성명"><button class="name-button ${genderClass(a)}" onclick="viewApplicant('${a.id}')">${esc(a.name||'이름없음')}</button>${staleBadge}<small>${esc(typeLine)}</small></td>
      <td class="workplace-cell sticky-app-col sticky-app-workplace" data-label="근무지"><span class="workplace-pill ${workplaceBadgeClass(a.workplace)}">${esc(a.workplace||'미지정')}</span></td>
      <td class="status-cell sticky-app-col sticky-app-status" data-label="상태"><select class="status-inline ${badgeClass(a.status)}" onchange="updateApplicantStatus('${a.id}', this.value)">${statusOptionsHtml(a.status)}</select></td>
      <td class="apply-date-cell" data-label="지원일">${esc(a.applyDate||'-')}</td>
      <td class="schedule-cell" data-label="면접일정"><strong class="${interview?'':'muted-schedule'}">${esc(scheduleStrong)}</strong>${scheduleNote}</td>
      <td class="hire-date-cell" data-label="입사예정일"><strong>${esc(a.hireDate||'-')}</strong></td>
      <td class="phone-cell" data-label="연락처"><strong>${esc(a.phone||'')}</strong></td>
      <td class="email-cell" data-label="이메일">${a.email ? `<span>${esc(a.email)}</span>` : ''}</td>
      <td class="region-cell" data-label="지역">${esc(a.region||'')}</td>
      <td class="commute-cell" data-label="출근방법"><span class="dorm-pill ${dormClass(dorm)}">${esc(dorm)}</span></td>
      <td class="decision-cell" data-label="판정"><span class="decision-pill ${decisionToneClass(a)}">${esc(decision)}</span><small>${score}점</small></td>
      <td class="row-actions compact-actions applicant-actions sticky-app-actions" data-label="관리"><button class="view" onclick="event.stopPropagation();viewApplicant('${a.id}')">상세</button><button onclick="event.stopPropagation();editApplicant('${a.id}')">수정</button><button class="delete" onclick="event.stopPropagation();deleteApplicant('${a.id}')">삭제</button></td>
    </tr>`;
  }).join(''):`<tr><td colspan="13" class="empty list-empty-cell"><div>조건에 맞는 지원자가 없습니다.</div><button class="mini" onclick="resetAndRenderList()">필터 초기화</button></td></tr>`;
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
  applyDate:'지원일',status:'연락상태',interviewDate:'면접일',interviewTime:'면접시간',hireDate:'입사일',source:'지원경로',careerType:'경력구분',
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
function excelPasteCareerType(value,career){
  const v=excelPasteText(value);
  if(v.includes('신입'))return '신입';
  if(v.includes('경력'))return '경력';
  const c=excelPasteText(career);
  if(!c||c==='-')return '';
  return /신입|졸업|졸업예정/.test(c)&&!/[~～]\s*(현재|재직|\d{2})/.test(c)?'신입':'경력';
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
  const known=['문자발송','연락완료','보류','부적합','전형마감','취소','입사포기'];
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
    applyDate,status:statusRaw?normalizeStatus(statusRaw):'미연락',interviewDate,interviewTime,hireDate,source:get('source'),
    careerType:excelPasteCareerType(get('careerType'),get('career')),workplace:excelPasteWorkplace(get('workplace')),dormUse:excelPasteDorm(memo),
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
  present.education=!!get('education')||!!school; present.dormUse=!!memo; present.careerType=!!get('careerType')||!!get('career'); present.region=!!region;
  return {data,issues,present,format:detected.format,confidence:detected.confidence,preview:{cells,headers:normalized.headers,layout}};
}
function excelPasteFindDuplicates(data,editId=''){
  const p=excelPastePhoneDigits(data.phone),email=excelPasteText(data.email).toLowerCase(),birth=excelPasteText(data.birthYear);
  return applicants.map(a=>{
    if(a.id===editId)return null;
    const reasons=[];
    if(p.length>=8&&excelPastePhoneDigits(a.phone)===p)reasons.push('연락처 동일');
    if(email&&excelPasteText(a.email).toLowerCase()===email)reasons.push('이메일 동일');
    if(data.name&&a.name===data.name&&birth&&excelPasteText(a.birthYear)===birth)reasons.push('성명+생년월일 동일');
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
  if(a.name&&a.name===b.name&&ab&&ab===bb)reasons.push('붙여넣은 행끼리 성명+생년월일 동일');
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
      <td><input class="excel-batch-inline-input" data-batch-index="${index}" data-batch-field="name" value="${esc(item.data.name||'')}" placeholder="성명 입력"><small>${esc(item.data.applyDate||'지원일 없음')} · ${esc(item.data.status||'미연락')}</small></td>
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
  localStorage.setItem(STORAGE_KEY,JSON.stringify(applicants));
  try{if(typeof canUseCloud==='function'&&canUseCloud()&&typeof supabaseSyncAll==='function')supabaseSyncAll(applicants);}catch(err){console.warn('엑셀 일괄작업 실행 취소 클라우드 동기화 실패',err);}
  if(typeof renderAll==='function')renderAll();
  if(typeof window.applicantProgressHistoryRefreshSnapshots==='function')window.applicantProgressHistoryRefreshSnapshots();
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
  save();
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
  applicants=JSON.parse(JSON.stringify(excelPasteBatchUndoSnapshot));
  if(typeof window.erpUnmarkExcelApplicants==='function'&&createdIds.length)window.erpUnmarkExcelApplicants(createdIds);
  excelPasteBatchPersistWithoutHistory();
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
  const items=[['성명',data.name||'미입력'],['연락처',data.phone||'미입력'],['지원',`${data.applyDate||'미입력'} · ${data.status||'미연락'}`],['근무',`${data.workplace||'미선택'} · ${data.dormUse||'미선택'}`],['학력',`${data.education||'미선택'} · ${data.school||'학교 미입력'}`],['일정',schedule]];
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
    if(String(i.code).startsWith('raw-'))return !excelPasteTouchedFields.has(i.field);
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
  updateScorePreview(); checkDuplicate(); updateFormMode(); closeExcelRowPaste();
  if(typeof uxToast==='function')uxToast(current?'선택한 엑셀 값을 수정 폼에 적용했습니다. 저장 버튼을 눌러 확정하세요.':'검증된 엑셀 값을 신규 지원자 폼에 적용했습니다. 내용을 확인한 뒤 등록하세요.');
  setTimeout(()=>$('name')?.focus(),0);
}

