/* =========================================================
   v10.29.0 지원자 → 직원명부 자동 연결
   - 지원자 status가 "출근"인데 아직 사원명부에 안 넘어간 사람을 찾아서
     "오늘 할 일"에 보여주고, 버튼 한 번으로 이름/학교/입사일을 그대로
     복사해 직원명부에 새로 등록함(다시 타이핑 안 해도 됨)
   - 한 번 등록하면 applicant.employeeId가 채워져서 다시 안 뜸
   ========================================================= */
function applicantsPendingEmployeeLink(){
  return applicants.filter(a=>a.status==='출근' && !a.employeeId);
}
function linkApplicantToEmployee(applicantId){
  const a=applicants.find(x=>x.id===applicantId);
  if(!a) return;
  const newEmployee=normalizeEmployee({
    name:a.name, school:a.school, schoolId:a.schoolId,
    department:a.workplace||'', hireDate:a.hireDate||a.applyDate||'',
    status:'재직중', notes:`Recruit ERP 지원자 연결(자동)`
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
  if(!confirm('이 지원자는 직원명부에 자동으로 안 넣고 목록에서만 빼둘까요? (이미 따로 등록하셨거나, 이번엔 등록 안 하고 싶을 때 사용하세요)')) return;
  applicants = applicants.map(x=>x.id===applicantId ? {...x, employeeId:'수동처리', updatedAt:new Date().toISOString()} : x);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseSyncAll(applicants);
  renderToday();
}
function renderEmployeeLinkTask(){
  const el=$('employeeLinkList');
  if(!el) return;
  const rows=applicantsPendingEmployeeLink();
  setText('employeeLinkCount', rows.length);
  el.innerHTML = rows.length ? rows.map(a=>`<div class="person-card compact-person-card">
    <div><strong>${esc(a.name||'이름없음')}</strong>
    <small>${esc(a.school||'출신학교 미입력')} · 입사일 ${esc(a.hireDate||a.applyDate||'미입력')} · ${esc(a.workplace||'근무지 미입력')}</small></div>
    <div class="row-actions">
      <button class="mini" onclick="linkApplicantToEmployee('${a.id}')">직원명부에 추가</button>
      <button class="mini" onclick="dismissApplicantEmployeeLink('${a.id}')">건너뛰기</button>
    </div>
  </div>`).join('') : `<div class="empty">직원명부에 아직 안 넘어간 출근자가 없습니다.</div>`;
}
function renderToday(){
  const g=taskGroups();
  const hireSchedule=[...g.hireToday,...g.hireD3,...g.hireD7]
    .filter((a,idx,arr)=>arr.findIndex(x=>x.id===a.id)===idx)
    .sort((a,b)=>daysUntil(a.hireDate)-daysUntil(b.hireDate));
  const decisionWait=[...g.decisions,...g.waits]
    .filter((a,idx,arr)=>arr.findIndex(x=>x.id===a.id)===idx);
  const checkCount=g.dorms.length;
  const nearestInterview=g.upcomingInterviews.find(a=>a.interviewDate);
  const noDateInterviewCount=g.upcomingInterviews.filter(a=>!a.interviewDate).length;
  const nearestText=nearestInterview
    ? `가장 가까운: ${[nearestInterview.interviewDate, nearestInterview.interviewTime].filter(Boolean).join(' ')}${nearestInterview.name ? ' · '+nearestInterview.name : ''}`
    : (noDateInterviewCount ? `일정 미정 ${noDateInterviewCount}명` : '예정 없음');

  setText('todayInterviewCount',g.todayInterviews.length);
  setText('tomorrowInterviewCount',g.upcomingInterviews.length);
  setText('nearestInterviewText',nearestText);
  setText('recallCount',g.recalls.length);
  setText('todayCheckCount',checkCount);
  setText('hireScheduleCount',hireSchedule.length);
  setText('dormCheckCount',g.dorms.length);
  setText('decisionCount',g.decisions.length);
  setText('waitingCount',g.waits.length);

  $('todayInterview').innerHTML=g.todayInterviews.length?g.todayInterviews.map(card).join(''):`<div class="empty">오늘 면접자가 없습니다.</div>`;
  if($('tomorrowInterview')) $('tomorrowInterview').innerHTML=g.upcomingInterviews.length?g.upcomingInterviews.map(card).join(''):`<div class="empty">오늘 이후 면접 예정자 또는 일정 확인 대상이 없습니다.</div>`;
  $('recallList').innerHTML=g.recalls.length?g.recalls.map(card).join(''):`<div class="empty">연락 대상이 없습니다.</div>`;
  if($('dormCheckList')) $('dormCheckList').innerHTML=g.dorms.length?g.dorms.map(card).join(''):`<div class="empty">출근방법 확인 대상이 없습니다.</div>`;
  if($('hireScheduleList')) $('hireScheduleList').innerHTML=hireSchedule.length?hireSchedule.map(card).join(''):`<div class="empty">입사 일정 대상이 없습니다.</div>`;
  if($('decisionWaitList')) $('decisionWaitList').innerHTML=decisionWait.length?decisionWait.map(card).join(''):`<div class="empty">판정/대기 대상이 없습니다.</div>`;
}

