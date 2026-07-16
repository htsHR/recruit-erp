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
  return `${a.dormUse||''} ${a.extra||''} ${a.education||''} ${a.finalEducation||''} ${a.school||''} ${a.major||''}
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
  if(['부재중','미연락','연락두절'].includes(status)) return 'missed';
  if(['입사예정','출근'].includes(status)) return 'good';
  if(['면접예정','다음면접'].includes(status)) return 'info';
  if(status==='서류탈락') return 'neutral';
  if(['불합격','철회'].includes(status)) return 'bad';
  return 'hold';
}
function statusToneClass(a){ return normalizeStatus(a?.status)==='서류탈락' ? 'is-paper-rejected' : ''; }
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
  const recalls=applicants.filter(a=>isActive(a) && ['부재중','미연락'].includes(a.status));
  const dorms=applicants.filter(isDormPending);
  const hireD7=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===7);
  const hireD3=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===3);
  const hireToday=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===0);
  const hireSoon=applicants.filter(isHireSoon);
  const decisions=applicants.filter(isDecisionNeeded);
  const weekInterviews=applicants.filter(a=>isActive(a) && a.interviewDate && daysUntil(a.interviewDate)>=0 && daysUntil(a.interviewDate)<=6);
  const overdue=applicants.filter(a=>{
    if(!isActive(a)) return false;
    const interviewOverdue=a.interviewDate && daysUntil(a.interviewDate)<0 && ['면접예정','다음면접'].includes(a.status);
    const hireOverdue=a.hireDate && daysUntil(a.hireDate)<0 && a.status==='입사예정';
    return interviewOverdue || hireOverdue;
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
function renderTable(){
  const rows=filtered();
  const dupChip=$('duplicateFilterChip');
  if(dupChip){ const dset=duplicatePhoneSet(); const n=applicants.filter(a=>dset.has(normalizePhone(a.phone))).length; dupChip.textContent = n ? `중복의심 ${n}명` : '중복의심'; dupChip.classList.toggle('chip-alert', n>0); }
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
    const typeLine = [a.batch, a.careerType, a.education].filter(Boolean).join(' · ') || '기본정보 미입력';
    const staleDays = ['미연락','부재중'].includes(a.status) ? daysSinceApply(a) : null;
    const staleBadge = (staleDays!==null && staleDays>=3) ? `<span class="stale-badge" title="지원일 기준 ${staleDays}일째 연락 안 됨">⏰${staleDays}일째</span>` : '';
    return `<tr class="applicant-row compact-row clickable-data-row ${statusToneClass(a)}" tabindex="0" onclick="if(!event.target.closest('button,select,a,input,label,summary,details')) viewApplicant('${a.id}')" onkeydown="listRowKeyActivate(event,()=>viewApplicant('${a.id}'))">
      <td class="no-cell sticky-app-col sticky-app-no" data-label="번호">${idx+1}</td>
      <td class="apply-date-cell sticky-app-col sticky-app-date" data-label="지원일">${esc(a.applyDate||'-')}</td>
      <td class="status-cell sticky-app-col sticky-app-status" data-label="상태"><select class="status-inline ${badgeClass(a.status)}" onchange="updateApplicantStatus('${a.id}', this.value)">${statusOptionsHtml(a.status)}</select></td>
      <td class="applicant-name-cell sticky-app-col sticky-app-name" data-label="성명"><button class="name-button ${genderClass(a)}" onclick="viewApplicant('${a.id}')">${esc(a.name||'이름없음')}</button>${staleBadge}<small>${esc(typeLine)}</small></td>
      <td class="phone-cell" data-label="연락처"><strong>${esc(a.phone||'')}</strong></td>
      <td class="email-cell" data-label="이메일">${a.email ? `<span>${esc(a.email)}</span>` : ''}</td>
      <td data-label="근무지"><span class="workplace-pill">${esc(a.workplace||'')}</span></td>
      <td class="region-cell" data-label="지역">${esc(a.region||'')}</td>
      <td class="schedule-cell" data-label="면접일정"><strong class="${interview?'':'muted-schedule'}">${esc(scheduleStrong)}</strong>${scheduleNote}</td>
      <td class="commute-cell" data-label="출근방법"><span class="dorm-pill ${dormClass(dorm)}">${esc(dorm)}</span></td>
      <td class="decision-cell" data-label="판정"><strong>${esc(decision)}</strong><small>${score}점</small></td>
      <td class="row-actions compact-actions applicant-actions" data-label="관리"><button class="view" onclick="event.stopPropagation();viewApplicant('${a.id}')">상세</button><button onclick="event.stopPropagation();editApplicant('${a.id}')">수정</button><button class="delete" onclick="event.stopPropagation();deleteApplicant('${a.id}')">삭제</button></td>
    </tr>`;
  }).join(''):`<tr><td colspan="12" class="empty list-empty-cell"><div>조건에 맞는 지원자가 없습니다.</div><button class="mini" onclick="resetAndRenderList()">필터 초기화</button></td></tr>`;
}
function resetAndRenderList(){ resetListFiltersToAll(); renderTable(); }

/* =========================================================
   v10.40.1 엑셀 지원자 한 행 붙여넣기
   - 구직 지원자 명단 A~V(22열) 한 행을 탭 구분 텍스트로 분석
   - 신규 등록: 변환 결과를 편집한 뒤 기존 입력폼에 적용
   - 수정 화면: 현재 값과 비교하고 선택한 항목만 입력폼에 적용
   - 자동 저장/자동 덮어쓰기 없음
   ========================================================= */
const EXCEL_ROW_HEADERS = ['NO','지원날짜','연락상태','면접날짜','시간','입사날짜','지원경로','지원구분','지원파트','성별','성명','이메일','최종학력','학과','연락처','연생','나이','지역(시)','세부지역(동)','경력','자격증','비고'];
const EXCEL_PASTE_FIELD_MAP = {
  applyDate:'xpApplyDate', status:'xpStatus', interviewDate:'xpInterviewDate', interviewTime:'xpInterviewTime', hireDate:'xpHireDate',
  source:'xpSource', careerType:'xpCareerType', extra:'xpExtra', workplace:'xpWorkplace', dormUse:'xpDormUse',
  name:'xpName', gender:'xpGender', birthYear:'xpBirthYear', age:'xpAge', phone:'xpPhone', email:'xpEmail', region:'xpRegion',
  education:'xpEducation', school:'xpSchool', major:'xpMajor', career:'xpCareer', certs:'xpCerts', memo:'xpMemo'
};
let excelPasteParsedData = null;
let excelPasteWarnings = [];
let excelPasteSourcePresent = {};

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
      rows[rows.length-1].push(value); value='';
      rows.push([]);
      continue;
    }
    value+=ch;
  }
  rows[rows.length-1].push(value);
  return rows.map(row=>row.map(excelPasteText)).filter(row=>row.some(Boolean));
}
function excelPasteHeaderToken(v){ return String(v||'').replace(/[\s\n\r]/g,'').replace(/[()]/g,'').toLowerCase(); }
function excelPasteIsHeaderRow(row){
  const tokens=row.map(excelPasteHeaderToken);
  return tokens.some(v=>v.includes('지원날짜')) && tokens.some(v=>v==='성명'||v.includes('성명')) && tokens.some(v=>v.includes('연락처'));
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
    if(/^\d{8}$/.test(raw)) return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
    if(/^\d{6}$/.test(raw)){
      const yy=Number(raw.slice(0,2));
      const current=Number(String(new Date().getFullYear()).slice(-2));
      const yyyy=yy>current?1900+yy:2000+yy;
      return `${yyyy}-${raw.slice(2,4)}-${raw.slice(4,6)}`;
    }
    const n=Number(raw);
    if(n>=20000) return excelPasteDateFromSerial(n);
  }
  const cleaned=raw.replace(/년|월/g,'-').replace(/일/g,'').replace(/[./]/g,'-').replace(/\s+/g,'');
  const parts=cleaned.split('-').filter(Boolean);
  if(parts.length===3){
    let y=Number(parts[0]); const m=Number(parts[1]), d=Number(parts[2]);
    if(y<100){ const current=Number(String(new Date().getFullYear()).slice(-2)); y=y>current?1900+y:2000+y; }
    if(y>=1900&&m>=1&&m<=12&&d>=1&&d<=31) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  if(parts.length===2){
    const y=new Date().getFullYear(),m=Number(parts[0]),d=Number(parts[1]);
    if(m>=1&&m<=12&&d>=1&&d<=31) return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return '';
}
function excelPasteTime(v){
  const raw=excelPasteText(v);
  if(!raw) return '';
  if(/^\d+(\.\d+)?$/.test(raw)){
    const n=Number(raw);
    const fraction=n<1?n:(n-Math.floor(n));
    if(fraction>0){
      const minutes=Math.round(fraction*1440)%1440;
      return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
    }
    return '';
  }
  const kor=raw.match(/(오전|오후)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?/);
  if(kor){
    let h=Number(kor[2]), m=Number(kor[3]||0);
    if(kor[1]==='오후'&&h<12)h+=12;
    if(kor[1]==='오전'&&h===12)h=0;
    if(h>=0&&h<24&&m>=0&&m<60) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  const compact=raw.replace(/\s/g,'');
  if(/^\d{3,4}$/.test(compact)){
    const h=Number(compact.slice(0,-2)),m=Number(compact.slice(-2));
    if(h<24&&m<60)return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  return '';
}
function excelPasteBirthYear(v){
  const raw=excelPasteText(v);
  if(!raw) return '';
  if(/^\d{4}$/.test(raw)) return raw;
  if(/^\d{2}$/.test(raw)){
    const yy=Number(raw),current=Number(String(new Date().getFullYear()).slice(-2));
    return String(yy>current?1900+yy:2000+yy);
  }
  return formatBirthDisplay(raw);
}
function excelPasteCareerType(value,career){
  const v=excelPasteText(value);
  if(v.includes('신입')) return '신입';
  if(v.includes('경력')) return '경력';
  const c=excelPasteText(career);
  if(!c||c==='-') return '';
  return /신입|졸업|졸업예정/.test(c) && !/[~～]\s*(현재|재직|\d{2})/.test(c) ? '신입' : '경력';
}
function excelPasteEducation(school){
  const s=excelPasteText(school);
  if(!s) return '';
  if(typeof findSchoolByText==='function'){
    const matched=findSchoolByText(s);
    const type=matched&&typeof normalizeSchoolType==='function'?normalizeSchoolType(matched.type):'';
    if(type==='고등학교') return '고졸';
    if(type==='전문대') return '전졸';
    if(type==='대학교') return '대졸';
  }
  if(/대학원/.test(s)) return '대학원';
  if(/고등학교|고교/.test(s)) return '고졸';
  if(/전문대|전문대학교|과학대|공업대|도립.*대|폴리텍|기능대|직업.*학교|전문학교/.test(s)) return '전졸';
  if(/대학교|대$|대\(|대학|학점은행/.test(s)) return '대졸';
  return '기타';
}
function excelPasteDorm(note){
  const s=excelPasteText(note).replace(/\s/g,'');
  if(!s) return '';
  if(/기숙사.*(출퇴근|통근)|출퇴근|통근/.test(s)) return '출퇴근';
  if(/기숙사/.test(s)) return '기숙사';
  if(/확인필요|확인요망|미확인/.test(s)) return '확인필요';
  return '';
}
function excelPasteRowToApplicant(row){
  const warnings=[];
  if(![21,22].includes(row.length)) throw new Error(`지원자 한 행은 22열(A~V)이어야 합니다. 현재 ${row.length}열이 감지됐습니다.`);
  const cells=row.length===21?['',...row]:row;
  const statusRaw=cells[2];
  const applyDate=excelPasteDate(cells[1]);
  const interviewDate=excelPasteDate(cells[3]);
  const interviewTime=excelPasteTime(cells[4]);
  const hireDate=excelPasteDate(cells[5]);
  const name=excelPasteText(cells[10]);
  const phone=formatPhoneDisplay(cells[14]);
  const school=excelPasteText(cells[12]);
  const memo=excelPasteText(cells[21]);
  const data={
    applyDate,
    status:statusRaw?normalizeStatus(statusRaw):'미연락',
    interviewDate,
    interviewTime,
    hireDate,
    source:excelPasteText(cells[6]),
    careerType:excelPasteCareerType(cells[7],cells[19]),
    extra:excelPasteText(cells[8]),
    workplace:'',
    dormUse:excelPasteDorm(memo),
    gender:normalizeGender(cells[9]),
    name,
    email:excelPasteText(cells[11]),
    school,
    major:excelPasteText(cells[13]),
    phone,
    birthYear:excelPasteBirthYear(cells[15]),
    age:excelPasteText(cells[16]),
    region:[excelPasteText(cells[17]),excelPasteText(cells[18])].filter(Boolean).join(' '),
    career:excelPasteText(cells[19]),
    certs:excelPasteText(cells[20]),
    memo,
    education:excelPasteEducation(school)
  };
  if(!name) warnings.push({field:'name',text:'성명이 비어 있습니다.'});
  if(!phone) warnings.push({field:'phone',text:'연락처가 비어 있습니다.'});
  if(!applyDate && excelPasteText(cells[1])) warnings.push({field:'applyDate',text:'지원일 형식을 확인하세요.'});
  if(!interviewDate && excelPasteText(cells[3])) warnings.push({field:'interviewDate',text:'면접일 형식을 확인하세요.'});
  if(!interviewTime && excelPasteText(cells[4])) warnings.push({field:'interviewTime',text:'면접시간 형식을 확인하세요.'});
  if(!hireDate && excelPasteText(cells[5])) warnings.push({field:'hireDate',text:'입사일 형식을 확인하세요.'});
  if(!data.workplace) warnings.push({field:'workplace',text:'엑셀에 지원근무지 열이 없어 직접 선택해야 합니다.'});
  if(statusRaw && data.status==='미연락' && !/미연락|문자발송/.test(statusRaw)) warnings.push({field:'status',text:`연락상태 “${statusRaw}”를 미연락으로 변환했습니다.`});
  const present={
    applyDate:!!excelPasteText(cells[1]), status:!!excelPasteText(cells[2]), interviewDate:!!excelPasteText(cells[3]), interviewTime:!!excelPasteText(cells[4]), hireDate:!!excelPasteText(cells[5]),
    source:!!excelPasteText(cells[6]), careerType:!!(excelPasteText(cells[7])||excelPasteText(cells[19])), extra:!!excelPasteText(cells[8]), workplace:false, dormUse:!!excelPasteText(cells[21]),
    gender:!!excelPasteText(cells[9]), name:!!excelPasteText(cells[10]), email:!!excelPasteText(cells[11]), school:!!excelPasteText(cells[12]), major:!!excelPasteText(cells[13]), phone:!!excelPasteText(cells[14]),
    birthYear:!!excelPasteText(cells[15]), age:!!excelPasteText(cells[16]), region:!!(excelPasteText(cells[17])||excelPasteText(cells[18])), career:!!excelPasteText(cells[19]), certs:!!excelPasteText(cells[20]), memo:!!excelPasteText(cells[21]), education:!!excelPasteText(cells[12])
  };
  return {data,warnings,present};
}
function excelPasteFindDuplicates(data,editId=''){
  const p=excelPastePhoneDigits(data.phone);
  const email=excelPasteText(data.email).toLowerCase();
  return applicants.filter(a=>{
    if(a.id===editId) return false;
    const samePhone=p.length>=8 && excelPastePhoneDigits(a.phone)===p;
    const sameEmail=email && excelPasteText(a.email).toLowerCase()===email;
    const sameIdentity=data.name&&a.name===data.name&&data.birthYear&&a.birthYear===data.birthYear;
    return samePhone||sameEmail||sameIdentity;
  }).slice(0,5);
}
function excelPasteCurrentApplicant(){
  const id=$('editId')?.value||'';
  return id?applicants.find(a=>a.id===id)||null:null;
}
function excelPasteSetMessage(message,type='info'){
  const el=$('excelPasteMessage');
  if(!el)return;
  el.className=`excel-paste-message ${type}`;
  el.textContent=message||'';
}
function excelPasteSetField(field,value){
  const id=EXCEL_PASTE_FIELD_MAP[field],el=$(id);
  if(!el)return;
  el.value=value??'';
}
function excelPasteGetField(field){
  const el=$(EXCEL_PASTE_FIELD_MAP[field]);
  return el?el.value.trim():'';
}
function excelPasteResetReviewClasses(){
  document.querySelectorAll('#excelPasteEditor [data-field-wrap]').forEach(el=>el.classList.remove('needs-review','has-change'));
}
function excelPasteRenderDuplicates(data){
  const box=$('excelPasteDuplicateBox');
  if(!box)return;
  const current=excelPasteCurrentApplicant();
  const rows=excelPasteFindDuplicates(data,current?.id||'');
  if(!rows.length){ box.className='excel-paste-duplicate clear'; box.innerHTML='<strong>중복 후보 없음</strong><span>연락처·이메일·성명+생년 기준으로 같은 지원자를 찾지 못했습니다.</span>'; return; }
  box.className='excel-paste-duplicate warning';
  box.innerHTML=`<strong>중복 가능성 ${rows.length}명</strong><span>${rows.map(a=>`${esc(a.name||'이름없음')} · ${esc(a.phone||'연락처 없음')} · ${esc(a.applyDate||'지원일 없음')}`).join('<br>')}</span>`;
}
function excelPastePopulateEditor(data,warnings=[],present={}){
  const current=excelPasteCurrentApplicant();
  const prepared={...data};
  if(!current){
    Object.keys(EXCEL_PASTE_FIELD_MAP).forEach(field=>{
      if(!present[field] && $(field)?.value) prepared[field]=$(field).value;
    });
    if(prepared.workplace) warnings=warnings.filter(w=>w.field!=='workplace');
  }
  excelPasteParsedData={...prepared}; excelPasteWarnings=warnings; excelPasteSourcePresent={...present};
  excelPasteResetReviewClasses();
  Object.keys(EXCEL_PASTE_FIELD_MAP).forEach(field=>excelPasteSetField(field,prepared[field]||''));
  const modalCard=document.querySelector('#excelRowPasteModal .excel-paste-modal-card');
  modalCard?.classList.toggle('is-edit-mode',!!current);
  document.querySelectorAll('.excel-paste-apply').forEach(check=>{
    const field=check.dataset.field;
    const currentValue=current?.[field]||'';
    const nextValue=prepared[field]||'';
    check.checked=!!current && !!excelPasteSourcePresent[field] && !excelPasteSameValue(field,currentValue,nextValue);
    const note=document.querySelector(`[data-current-for="${field}"]`);
    if(note) note.textContent=current?`현재: ${currentValue||'비어 있음'}`:'';
    const wrap=document.querySelector(`[data-field-wrap="${field}"]`);
    if(current && !excelPasteSameValue(field,currentValue,nextValue)) wrap?.classList.add('has-change');
  });
  warnings.forEach(w=>document.querySelector(`[data-field-wrap="${w.field}"]`)?.classList.add('needs-review'));
  const editor=$('excelPasteEditor'); if(editor)editor.hidden=false;
  const btn=$('btnApplyExcelPaste'); if(btn){btn.disabled=false;btn.textContent=current?'선택 항목을 입력폼에 적용':'입력폼에 적용';}
  const summary=$('excelPasteColumnSummary'); if(summary)summary.textContent=`22열 인식 · ${warnings.length?`확인 필요 ${warnings.length}개`:'형식 정상'}`;
  excelPasteRenderDuplicates(prepared);
  excelPasteSetMessage(warnings.length?`행을 분석했습니다. ${warnings.map(w=>w.text).join(' / ')}`:'행을 정상적으로 분석했습니다. 내용을 수정한 뒤 입력폼에 적용하세요.',warnings.length?'warn':'success');
}
function parseExcelRowPaste(){
  try{
    const raw=$('excelPasteRaw')?.value||'';
    if(!raw.trim()) throw new Error('엑셀에서 지원자 한 행을 복사한 뒤 붙여넣어 주세요.');
    let rows=excelPasteParseTsv(raw);
    if(rows.length && excelPasteIsHeaderRow(rows[0])) rows=rows.slice(1);
    rows=rows.filter(row=>row.some(Boolean));
    if(!rows.length) throw new Error('지원자 데이터 행을 찾지 못했습니다. 헤더가 아닌 지원자 행도 함께 복사해 주세요.');
    if(rows.length>1) throw new Error(`지원자 ${rows.length}개 행이 감지됐습니다. 현재는 한 행씩 붙여넣어 주세요.`);
    const parsed=excelPasteRowToApplicant(rows[0]);
    excelPastePopulateEditor(parsed.data,parsed.warnings,parsed.present);
  }catch(err){
    excelPasteParsedData=null; excelPasteWarnings=[]; excelPasteSourcePresent={};
    if($('excelPasteEditor')) $('excelPasteEditor').hidden=true;
    if($('btnApplyExcelPaste')) $('btnApplyExcelPaste').disabled=true;
    excelPasteSetMessage(err.message||'붙여넣은 행을 분석하지 못했습니다.','error');
  }
}
function resetExcelRowPaste(){
  excelPasteParsedData=null; excelPasteWarnings=[]; excelPasteSourcePresent={};
  if($('excelPasteRaw')) $('excelPasteRaw').value='';
  if($('excelPasteEditor')) $('excelPasteEditor').hidden=true;
  if($('btnApplyExcelPaste')) $('btnApplyExcelPaste').disabled=true;
  if($('excelPasteDuplicateBox')) $('excelPasteDuplicateBox').innerHTML='';
  excelPasteSetMessage('');
  excelPasteResetReviewClasses();
}
function openExcelRowPaste(){
  resetExcelRowPaste();
  const modal=$('excelRowPasteModal'), current=excelPasteCurrentApplicant();
  if(!modal)return;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  const card=modal.querySelector('.excel-paste-modal-card'); card?.classList.toggle('is-edit-mode',!!current);
  if($('excelPasteModeBadge')) $('excelPasteModeBadge').textContent=current?'기존 지원자 수정':'신규 등록';
  if($('excelPasteCandidateLabel')) $('excelPasteCandidateLabel').textContent=current?`${current.name||'현재 지원자'}의 엑셀 값과 현재 값을 비교합니다.`:'엑셀에서 지원자 한 행을 복사해 붙여넣으세요.';
  setTimeout(()=>$('excelPasteRaw')?.focus(),0);
}
function closeExcelRowPaste(){
  const modal=$('excelRowPasteModal'); if(!modal)return;
  modal.classList.remove('show'); modal.setAttribute('aria-hidden','true');
}
function applyExcelRowPasteToForm(){
  if(!excelPasteParsedData){excelPasteSetMessage('먼저 붙여넣은 행을 분석해 주세요.','error');return;}
  const current=excelPasteCurrentApplicant();
  const selectedFields=current
    ? [...document.querySelectorAll('.excel-paste-apply:checked')].map(el=>el.dataset.field)
    : Object.keys(EXCEL_PASTE_FIELD_MAP);
  if(current && !selectedFields.length){excelPasteSetMessage('현재 지원자에게 적용할 항목을 하나 이상 선택해 주세요.','warn');return;}
  selectedFields.forEach(field=>{
    const target=$(field); if(!target)return;
    const value=excelPasteGetField(field);
    if(field==='interviewTime' && value && target.tagName==='SELECT' && ![...target.options].some(o=>o.value===value)) target.add(new Option(value,value));
    target.value=value;
    target.dispatchEvent(new Event('input',{bubbles:true}));
    target.dispatchEvent(new Event('change',{bubbles:true}));
  });
  updateScorePreview(); checkDuplicate(); updateFormMode();
  closeExcelRowPaste();
  if(typeof uxToast==='function') uxToast(current?'선택한 엑셀 값을 수정 폼에 적용했습니다. 저장 버튼을 눌러 확정하세요.':'엑셀 값을 신규 지원자 폼에 적용했습니다. 내용을 확인한 뒤 등록하세요.');
  const focusTarget=$('name'); if(focusTarget) setTimeout(()=>focusTarget.focus(),0);
}
