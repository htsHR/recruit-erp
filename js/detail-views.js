/* =========================================================
   v10.30.0 학교 상세 화면 — 학교 관계관리
   - 기존 지원자 상세보기 모달과 같은 CSS(.detail-grid/.detail-row/.core-item)를
     그대로 재사용해서 통일감 있게 만듦
   - 채용성과는 applicants, 재직성과는 schoolEmployeeStats()에서 실시간 계산
   - 관리이력(최근연락일/다음연락예정일/최근채용의뢰)만 이 화면에서 직접 입력
   ========================================================= */
let schoolDetailCurrentId='';
let schoolDetailInitialHistory='';
function schoolRecruitStats(schoolId){
  const list = applicants.filter(a=>a.schoolId===schoolId);
  const total = list.length;
  const docPassStatuses=['면접예정','면접완료','다음면접','입사예정','출근'];
  const docPass = list.filter(a=>docPassStatuses.includes(normalizeStatus(a.status))).length;
  const interview = list.filter(a=>['면접완료','다음면접','입사예정','출근'].includes(normalizeStatus(a.status)) || isInterviewed(a)).length;
  const hireConfirmed = list.filter(a=>['입사예정','출근'].includes(normalizeStatus(a.status))).length;
  const started = list.filter(a=>normalizeStatus(a.status)==='출근').length;
  let latestApply='';
  list.forEach(a=>{ if(!latestApply || (a.applyDate||'')>latestApply) latestApply=a.applyDate||''; });
  return { total, docPass, interview, hireConfirmed, started, hireRate: total ? Math.round(hireConfirmed/total*1000)/10 : null, latestApply };
}
function schoolHistorySnapshot(){
  return JSON.stringify({
    lastContactDate:$('schoolDetailLastContact')?.value||'',
    nextContactDate:$('schoolDetailNextContact')?.value||'',
    lastRequestNote:$('schoolDetailRequestNote')?.value||''
  });
}
function schoolHistoryChanged(){ return !!schoolDetailCurrentId && schoolDetailInitialHistory && schoolHistorySnapshot()!==schoolDetailInitialHistory; }
function schoolNextContactStatus(date){
  if(!date) return '<span class="school-date-status neutral">예정일 미등록</span>';
  const d=daysUntil(date);
  if(d===null) return '';
  if(d<0) return `<span class="school-date-status overdue">${Math.abs(d)}일 지남</span>`;
  if(d===0) return '<span class="school-date-status today">오늘 연락 예정</span>';
  return `<span class="school-date-status upcoming">D-${d}</span>`;
}
function schoolKpiItem(label, value, action='', help=''){
  const attrs=action ? ` role="button" tabindex="0" onclick="${action}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${action}}"` : '';
  return `<div class="school-kpi-item${action?' is-clickable':''}"${attrs}><span>${esc(label)}</span><strong>${esc(String(value ?? '-'))}</strong>${help?`<small>${esc(help)}</small>`:''}${action?'<em>목록 보기 →</em>':''}</div>`;
}
function openSchoolDetail(schoolId){
  const s=schools.find(x=>x.id===schoolId);
  if(!s) return;
  schoolDetailCurrentId=schoolId;
  renderSchoolDetail();
  $('schoolDetailModal').classList.add('show');
}
function closeSchoolDetail(force=false){
  if(!force && schoolHistoryChanged() && !confirm('저장하지 않은 관리이력 변경사항이 있습니다.\n그래도 닫을까요?')) return;
  $('schoolDetailModal').classList.remove('show');
  schoolDetailCurrentId='';
  schoolDetailInitialHistory='';
}
function renderSchoolDetail(){
  const s=schools.find(x=>x.id===schoolDetailCurrentId);
  if(!s) return;
  const rec=schoolRecruitStats(s.id);
  const hr=schoolEmployeeStats(s.id);
  const activeCount=hr?.activeCount||0;
  const totalHeadcount=hr?.totalHeadcount||0;
  const retiredCount=hr?.retiredCount||0;
  const leaveCount=hr?.leaveCount||0;
  $('schoolDetailTitle').textContent=`${s.name} · 학교 상세`;
  const identitySub=[s.region,schoolTypeGroupDetail(s.type),schoolManagementStatusLabel(s.managementStatus)].filter(Boolean).join(' · ')||'학교 기본정보';
  const basicRows=[
    detailRow('학교명', s.name),
    detailRow('지역', s.region||'-'),
    detailRow('유형', schoolTypeGroupDetail(s.type)||'-'),
    detailRow('관리상태', schoolManagementStatusLabel(s.managementStatus)),
    detailRow('담당자', s.contact),
    detailRow('연락처', s.contactPhone),
    detailRow('MOU 체결일', s.mouDate),
    detailRow('비고', s.notes, 'wide-row'),
  ].join('');
  const recruitRows=[
    schoolKpiItem('총 지원자', rec.total+'명', `closeSchoolDetail(true);viewSchoolApplicants('${s.id}')`, '연결된 지원자 전체'),
    schoolKpiItem('서류합격', rec.docPass+'명', '', '면접 단계 이상'),
    schoolKpiItem('면접 실시', rec.interview+'명', '', '면접일 경과 또는 면접완료'),
    schoolKpiItem('입사 확정', rec.hireConfirmed+'명', '', `출근완료 ${rec.started}명`),
    schoolKpiItem('입사 확정률', rec.hireRate!=null ? rec.hireRate+'%' : '-', '', '총 지원자 대비'),
    schoolKpiItem('최근 지원일', rec.latestApply||'-'),
  ].join('');
  const hrRows = hr ? [
    schoolKpiItem('누적 입사자', totalHeadcount+'명', `closeSchoolDetail(true);viewSchoolEmployees('${s.id}','${escJs(s.name)}')`, `휴직 ${leaveCount}명 · 퇴직 ${retiredCount}명`),
    schoolKpiItem('현재 재직', activeCount+'명', `closeSchoolDetail(true);viewSchoolEmployees('${s.id}','${escJs(s.name)}')`, '사원명부 연결 기준'),
    schoolKpiItem('현재 휴직', leaveCount+'명', `closeSchoolDetail(true);viewSchoolEmployees('${s.id}','${escJs(s.name)}')`, '휴직 상태 연결 기준'),
    schoolKpiItem('평균근속', hr.avgTenureMonths!=null ? Math.round(hr.avgTenureMonths)+'개월' : '-', '', '재직·퇴사 전체 기준'),
    schoolKpiItem('무사고율', hr.disciplineRate!=null ? Math.round(100-hr.disciplineRate)+'%' : '-', '', '상벌 기록 기준'),
  ].join('') : '';
  $('schoolDetailBody').innerHTML=`
    <section class="school-detail-hero">
      <div><p class="eyebrow">SCHOOL OVERVIEW</p><h2>${esc(s.name)}</h2><p>${esc(identitySub)}</p></div>
      <div class="school-detail-hero-kpis">
        ${schoolKpiItem('총 지원자', rec.total+'명', `closeSchoolDetail(true);viewSchoolApplicants('${s.id}')`)}
        ${schoolKpiItem('현재 재직', activeCount+'명', `closeSchoolDetail(true);viewSchoolEmployees('${s.id}','${escJs(s.name)}')`)}
        ${schoolKpiItem('입사 확정', rec.hireConfirmed+'명')}
        ${schoolKpiItem('평균근속', hr?.avgTenureMonths!=null ? Math.round(hr.avgTenureMonths)+'개월' : '-')}
      </div>
    </section>
    <section class="summary-card school-detail-section"><div class="school-detail-section-head"><div><h4>기본정보</h4><p>학교와 담당자 정보를 확인합니다.</p></div></div><div class="detail-grid school-basic-grid">${basicRows}</div></section>
    <section class="summary-card school-detail-section"><div class="school-detail-section-head"><div><h4>채용성과</h4><p>지원부터 입사 확정까지의 흐름입니다.</p></div></div><div class="school-detail-kpi-grid">${recruitRows}</div></section>
    <section class="summary-card school-detail-section"><div class="school-detail-section-head"><div><h4>재직성과</h4><p>사원명부에 연결된 인원의 재직 결과입니다.</p></div></div>${hr ? `<div class="school-detail-kpi-grid school-detail-hr-grid">${hrRows}</div>` : '<div class="empty">사원명부에 연결된 직원이 없습니다.</div>'}</section>
    <section class="summary-card school-detail-section school-history-card">
      <div class="school-detail-section-head"><div><h4>관리이력</h4><p>최근 학교 연락과 다음 할 일을 기록합니다. 이 부분만 직접 수정됩니다.</p></div></div>
      <div class="form-grid compact school-history-grid">
        <label>최근 연락일<input type="date" id="schoolDetailLastContact" value="${esc(s.lastContactDate||'')}" /></label>
        <label>다음 연락 예정일<input type="date" id="schoolDetailNextContact" value="${esc(s.nextContactDate||'')}" /><span id="schoolDetailNextContactStatus">${schoolNextContactStatus(s.nextContactDate||'')}</span></label>
        <label class="wide">최근 채용 의뢰<input id="schoolDetailRequestNote" value="${esc(s.lastRequestNote||'')}" placeholder="예: 2026년 하반기 3명 요청" /></label>
      </div>
    </section>`;
  schoolDetailInitialHistory=schoolHistorySnapshot();
  updateSchoolDetailSaveState();
  const historyInputs=['schoolDetailLastContact','schoolDetailNextContact','schoolDetailRequestNote'];
  historyInputs.forEach(id=>$(id)?.addEventListener('input',()=>{
    if(id==='schoolDetailNextContact') $('schoolDetailNextContactStatus').innerHTML=schoolNextContactStatus($(id).value);
    updateSchoolDetailSaveState();
  }));
}
function updateSchoolDetailSaveState(){
  const el=$('schoolDetailSaveState');
  if(!el) return;
  const changed=schoolHistoryChanged();
  el.textContent=changed?'저장하지 않은 변경사항':'저장된 상태';
  el.classList.toggle('is-dirty',changed);
}
function saveSchoolDetailHistory(){
  const s=schools.find(x=>x.id===schoolDetailCurrentId);
  if(!s) return;
  s.lastContactDate=$('schoolDetailLastContact')?.value||'';
  s.nextContactDate=$('schoolDetailNextContact')?.value||'';
  s.lastRequestNote=$('schoolDetailRequestNote')?.value||'';
  s.updatedAt=new Date().toISOString();
  saveSchools();
  renderSchoolDetail();
  renderSchoolManage();
  alert('관리이력이 안전하게 저장됐습니다.');
}
/* =========================================================
   Recruit ERP v10.40.19 — 사원 상세보기 최종화
   - 기본/조직/채용/학력/기타 정보를 선택 필드로 표시
   - 기존 사원 데이터에 확장 필드가 없어도 빈값으로 안전하게 표시
   ========================================================= */
let employeeDetailCurrentId='';
function openEmployeeDetail(id){
  const e=employees.find(x=>x.id===id);if(!e)return;
  employeeDetailCurrentId=id;
  renderEmployeeDetail();
  if($('employeeDetailStatus'))$('employeeDetailStatus').value=e.status||'재직중';
  $('employeeDetailModal')?.classList.add('show');
}
function closeEmployeeDetail(){
  $('employeeDetailModal')?.classList.remove('show');
  employeeDetailCurrentId='';
}
function editEmployeeFromDetail(){
  const id=employeeDetailCurrentId;
  closeEmployeeDetail();
  if(id){setPage('employees');setTimeout(()=>editEmployeePrompt(id),0);}
}
function openEmployeeLinkedApplicant(id){
  if(!id)return;
  closeEmployeeDetail();
  viewApplicant(id);
}
function employeeDetailValue(value){return String(value||'').trim()||'-';}
function employeeLinkedApplicant(e){
  if(!e.applicantId||typeof applicants==='undefined')return null;
  return applicants.find(a=>a.id===e.applicantId)||null;
}
function renderEmployeeDetail(){
  const e=employees.find(x=>x.id===employeeDetailCurrentId);if(!e)return;
  $('employeeDetailTitle').textContent=`${e.name} · 사원 상세`;
  const initials=String(e.name||'?').trim().slice(0,1)||'?';
  const statusClass=employeeStatusBadgeClass(e.status);
  const linked=employeeLinkedApplicant(e);
  const orgSummary=[e.team||e.department,e.groupName,e.product,e.part].filter(Boolean).join(' · ')||'소속 미등록';
  const basicRows=[
    detailRow('사번',employeeDetailValue(e.empNo)),
    detailRow('성명',employeeDetailValue(e.name)),
    detailRow('성별',employeeDetailValue(e.gender)),
    detailRow('재직상태',employeeDetailValue(e.status)),
    detailRow('입사일',employeeDetailValue(e.hireDate)),
    detailRow('퇴사일',employeeDetailValue(e.leaveDate)),
    detailRow('휴직일',employeeDetailValue(e.leaveStartDate)),
    detailRow('복직일',employeeDetailValue(e.returnDate)),
  ].join('');
  const organizationRows=[
    detailRow('팀',employeeDetailValue(e.team||e.department)),
    detailRow('그룹',employeeDetailValue(e.groupName)),
    detailRow('제품',employeeDetailValue(e.product)),
    detailRow('파트',employeeDetailValue(e.part)),
    detailRow('직급',employeeDetailValue(e.rank)),
    detailRow('직책',employeeDetailValue(e.position||e.role)),
    detailRow('승격일',employeeDetailValue(e.promotionDate)),
  ].join('');
  const recruitRows=[
    detailRow('입사경위',employeeDetailValue(e.recruitType)),
    detailRow('채용채널',employeeDetailValue(e.recruitChannel)),
    linked
      ? `<div class="detail-item wide-row"><span>지원자 기록</span><strong><button class="link-like" type="button" onclick="openEmployeeLinkedApplicant('${linked.id}')">${esc(linked.name)} · ${esc(linked.applyDate||'지원일 미입력')} · ${esc(linked.workplace||'근무지 미입력')}</button></strong></div>`
      : detailRow('지원자 기록','연결되지 않음','wide-row'),
  ].join('');
  const linkedSchool=e.schoolId&&typeof schools!=='undefined'?schools.find(s=>String(s.id)===String(e.schoolId)):null;
  const schoolLinkValue=linkedSchool
    ? `<button class="link-like" type="button" onclick="closeEmployeeDetail();openSchoolDetail('${linkedSchool.id}')">${esc(linkedSchool.name)} · ${esc(normalizeSchoolType(linkedSchool.type)||'구분 미확인')}</button>`
    : (e.schoolId?'존재하지 않는 학교 ID':'미연결');
  const educationRows=[
    detailRow('최종학력',employeeDetailValue(e.education)),
    detailRow('출신학교',employeeDetailValue(e.school)),
    detailRow('전공',employeeDetailValue(e.major)),
    `<div class="detail-item"><span>학교 연결 상태</span><strong>${schoolLinkValue}</strong></div>`,
  ].join('');
  const otherRows=[
    detailRow('상벌 건수',`${Number(e.disciplineCount||0)}건`),
    detailRow('최근 수정일',employeeDetailValue(formatEmployeeDateTime(e.updatedAt||e.createdAt))),
    detailRow('비고',employeeDetailValue(e.notes),'wide-row'),
  ].join('');
  $('employeeDetailBody').innerHTML=`
    <section class="employee-profile-hero">
      <div class="employee-avatar" aria-hidden="true">${esc(initials)}</div>
      <div class="employee-profile-main"><p class="eyebrow">EMPLOYEE PROFILE</p><h2>${esc(e.name||'-')}</h2><div class="employee-profile-meta"><span>${esc(e.empNo||'사번 미등록')}</span><span>${esc(orgSummary)}</span><span>${esc(employeeRankDisplay(e))}</span></div></div>
      <div class="employee-profile-status"><span class="badge ${statusClass}">${esc(e.status||'상태 미등록')}</span><small>${esc(employeeTenureText(e))} 근속</small></div>
    </section>
    <div class="employee-detail-quick-grid"><div><span>입사일</span><strong>${esc(e.hireDate||'-')}</strong></div><div><span>출신학교</span><strong>${esc(e.school||'-')}</strong></div><div><span>최근 수정</span><strong>${esc(formatEmployeeDateTime(e.updatedAt||e.createdAt)||'-')}</strong></div></div>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">01</span><div><h4>기본정보</h4><p>재직 상태와 입·퇴사·휴복직 일자를 확인합니다.</p></div></div><div class="detail-grid">${basicRows}</div></section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">02</span><div><h4>조직정보</h4><p>팀·그룹·제품·파트와 직급·직책 정보입니다.</p></div></div><div class="detail-grid">${organizationRows}</div></section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">03</span><div><h4>채용정보</h4><p>입사경위·채용채널과 지원자 기록 연결 상태입니다.</p></div></div><div class="detail-grid">${recruitRows}</div></section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">04</span><div><h4>학력정보</h4><p>최종학력·출신학교·전공과 학교 연결 상태입니다.</p></div></div><div class="detail-grid">${educationRows}</div></section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">05</span><div><h4>기타정보</h4><p>상벌과 업무상 필요한 비고만 표시합니다.</p></div></div><div class="detail-grid">${otherRows}</div></section>`;
}
window.editApplicant=editApplicant; window.deleteApplicant=deleteApplicant; window.duplicateApplicant=duplicateApplicant;
  window.viewApplicant=viewApplicant; window.updateApplicantStatus=updateApplicantStatus; window.resetAndRenderList=resetAndRenderList;

function updateFormMode(){
  const editing = !!($('editId') && $('editId').value);
  if($('submitBtn')) $('submitBtn').textContent = editing ? '수정 저장' : '지원자 등록';
}

function updateScorePreview(){
  if(!$('scorePreview')) return;
  if(!$('age').value && $('birthYear').value) $('age').value=calcAge($('birthYear').value);
  const data=getForm(), sc=deriveScores(data);
  $('scorePreview').innerHTML=`검토점수 미리보기: <b>${sc.total}점 · ${grade(sc.total)}</b><div class="score-line"><span class="score-pill">전공 ${sc.major}/25</span><span class="score-pill">경력 ${sc.career}/35</span><span class="score-pill">자격 ${sc.cert}/20</span><span class="score-pill">현장 ${sc.field}/20</span></div>`;
}
function normalizePhone(v){ return String(v||'').replace(/\D/g,''); }
function checkDuplicate(){
  if(!$('duplicateBox')) return;
  const f=getForm();
  const fPhone=normalizePhone(f.phone);
  const dups=applicants.filter(a=>a.id!==f.editId && ((fPhone && fPhone.length>=8 && normalizePhone(a.phone)===fPhone)||(f.email&&a.email===f.email)||(f.name&&a.name===f.name&&f.birthYear&&a.birthYear===f.birthYear)));
  if(dups.length){ $('duplicateBox').className='wide duplicate-box warn'; $('duplicateBox').textContent=`중복 가능성: ${dups.map(d=>d.name+'('+d.phone+')').join(', ')}`; }
  else { $('duplicateBox').textContent=''; $('duplicateBox').className='wide duplicate-box'; }
}
function makeTemplate(){
  const a={};
  const name=a.name||'지원자'; const wp=a.workplace||'지원근무지'; const dt=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ')||'협의된 일정'; const type=$('templateType').value;
  const map={
    '면접 안내':`안녕하세요, ${name}님.\n에이치티솔루션 채용 담당자입니다.\n지원해주신 이력서 검토 후 면접 일정 안내드립니다.\n\n- 지원근무지: ${wp}\n- 면접일정: ${dt}\n\n확인 후 가능 여부 회신 부탁드립니다. 감사합니다.`,
    '면접 일정 변경':`안녕하세요, ${name}님.\n기존에 안내드린 면접 일정 관련하여 일정 조율이 필요해 연락드립니다.\n가능하신 시간대를 회신해주시면 확인 후 다시 안내드리겠습니다.`,
    '면접 취소/전형 안내':`안녕하세요, ${name}님.\n채용 일정 관련하여 안내드립니다.\n내부 검토 결과 현재 채용 진행 상황이 변동되어 예정된 면접 진행이 어려울 수 있어 안내드립니다.\n지원해주셔서 감사합니다.`,
    '천안 → 평택 문의':`안녕하세요, ${name}님.\n지원해주신 이력서 확인 후 연락드립니다.\n현재 천안사업장은 내부 검토 중인 지원자가 있어, 혹시 평택사업장 근무도 검토 가능하실지 조심스럽게 문의드립니다.`,
    '평택 → 천안 문의':`안녕하세요, ${name}님.\n지원해주신 이력서 확인 후 연락드립니다.\n혹시 평택 외 천안사업장 근무도 검토 가능하실지 확인차 문의드립니다.`,
    '부재중 재연락':`안녕하세요, ${name}님.\n에이치티솔루션 채용 관련하여 연락드렸으나 부재중이셔서 문자 남깁니다.\n통화 가능하실 때 회신 부탁드립니다.`,
    '서류 확인 요청':`안녕하세요, ${name}님.\n지원서류 확인 중 추가 확인이 필요한 사항이 있어 연락드립니다.\n확인 가능하실 때 회신 부탁드립니다.`,
    '보류/검토 안내':`안녕하세요, ${name}님.\n지원해주신 서류는 현재 내부 검토 중입니다.\n검토 결과에 따라 추가 안내드리겠습니다. 감사합니다.`,
    '입사 안내':`안녕하세요, ${name}님.\n입사 관련 안내드립니다.\n준비사항 및 세부 일정은 별도 안내드릴 예정입니다. 감사합니다.`
  };
  $('templateOutput').value=map[type]||'';
}
function download(name, content, type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function csv(){
  const headers=['지원날짜','지원경로','연락상태','지원근무지','성명','연락처','이메일','성별','생년월일','연령','거주지역',
    '출근방법','학력구분','최종학교','전공/학과','외국어/기타자격','경력구분','직무적합분류','확인필요사항','자소서키워드','자격증','경력키워드','면접날짜',
    '면접시간','입사예정일','상담내용','판정/메모/다음액션','전공적합도','경력적합도','자격적합도','현장적응도','총점','추천등급','다음액션'];
  const lines=[headers,...applicants.map(a=>{ const sc=deriveScores(a); return [a.applyDate,
    a.source,a.status,a.workplace,a.name,a.phone,a.email,a.gender,a.birthYear,a.age,a.region,
    dormLabel(a),a.education,a.school,a.major,a.languageEtc,a.careerType,displayCategory(a),displayCheckNeeds(a.checkNeeds),
    a.selfIntroKeywords,a.certs,a.career,a.interviewDate,a.interviewTime,a.hireDate,a.consult,[a.memo,
    a.decisionReason].filter(Boolean).join(' / '),sc.major,sc.career,sc.cert,sc.field,sc.total,
    grade(sc.total),nextAction(a)]; })].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`지원자명단_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function jsonBackup(){ localStorage.setItem(BACKUP_KEY, today()); download(`resume_management_backup_${today()}.json`,JSON.stringify(applicants,null,2),'application/json'); renderAll(); }

