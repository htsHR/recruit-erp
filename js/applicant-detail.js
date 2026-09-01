/* Recruit ERP v12.5.2 — core applicant detail and form workflow. */
function renderAll(){
  renderStats();
  backupNotice();
  renderScheduleReminder();
  renderHomeLists();
  renderTable();
  renderToday();
  renderCalendar();
  updateApplicantFormDerivedFields();
}

const fields=['editId','applyDate','source','status','workplace','name','phone','email',
  'gender','birthYear','age','region','commute','dormUse','education','finalEducation','school',
  'major','gradePoint','languageEtc','certs','career','lastCompany','duties','leaveReason','careerType',
  'jobFitCategory','interviewDate','interviewTime','hireDate','decisionReason','consult','memo'];
function getChecked(name){ return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value).join(', '); }
function setChecked(name, value){ const values=displayCheckNeeds(value).split(',').map(x=>x.trim()).filter(Boolean);
  document.querySelectorAll(`input[name="${name}"]`).forEach(x=>x.checked=values.includes(x.value));
  }
function getForm(){ const o=fields.reduce((obj,id)=>{ if($(id)) obj[id]=$(id).value.trim();
  return obj; },{}); o.birthYear=formatBirthDisplay(o.birthYear); o.phone=formatPhoneDisplay(o.phone); o.checkNeeds=getChecked('checkNeeds'); o.selfIntroKeywords=getChecked('selfIntroKeywords');
  return o; }
function fillForm(a){ fields.forEach(id=>{ const el=$(id); if(!el) return; const value = id==='editId' ? (a.id||a.editId||'') : (id==='status' ? normalizeStatus(a.status) : (id==='dormUse' ? normalizeDorm(a.dormUse) : (a[id]||'')));
  if(id==='interviewTime' && value && ![...el.options].some(o=>o.value===value)){ el.add(new Option(value,
  value)); }
  // v10.48.0: 상태 셀렉트에 없는 값(이 버전이 모르는 미래 상태)이면 임시 옵션을 만들어
  // 값이 사라지지 않게 하고, 사용자가 직접 다른 상태를 고르기 전까지 유지되게 한다.
  if(id==='status' && value && ![...el.options].some(o=>o.value===value)){
    el.add(new Option(value+' — 현재 버전에서 정의되지 않은 상태', value, true, true));
  }
  el.value = value; }); setChecked('checkNeeds', a.checkNeeds); setChecked('selfIntroKeywords',
  a.selfIntroKeywords); updateApplicantFormDerivedFields(); checkDuplicate(); updateFormMode(); }
function resetForm(){
  window.__erpExcelPastePendingApplicant='';
  const form=$('applicantForm');
  if(form) form.reset();
  setChecked('checkNeeds','');
  setChecked('selfIntroKeywords','');
  if($('editId')) $('editId').value='';
  if($('applyDate')) $('applyDate').value=today();
  if($('status')) $('status').value='서류검토';
  if($('dormUse')) $('dormUse').value='확인필요';
  if($('duplicateBox')){
    $('duplicateBox').textContent='';
    $('duplicateBox').className='wide duplicate-box';
  }
  updateApplicantFormDerivedFields();
  updateFormMode();
}
function openNewApplicantForm(){
  const active=document.querySelector('.page.active')?.id||'';
  const editing=!!($('editId')?.value);
  const dirty=typeof window.erpApplicantFormIsDirty==='function' ? !!window.erpApplicantFormIsDirty() : false;
  if(active==='form' && (dirty || editing)){
    const message=editing
      ? '현재 지원자 수정 화면이 열려 있습니다. 저장하지 않은 내용은 사라집니다.\n신규 지원자 등록 화면으로 초기화할까요?'
      : '작성 중인 신규 지원자 정보가 있습니다. 저장하지 않은 내용은 사라집니다.\n새 등록 화면으로 초기화할까요?';
    if(!confirm(message)) return false;
  }
  resetForm();
  setPage('form');
  requestAnimationFrame(()=>$('name')?.focus());
  return true;
}
window.openNewApplicantForm=openNewApplicantForm;
function editApplicant(id){ if(window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return;const a=applicants.find(x=>x.id===id); if(a){ fillForm(a); setPage('form'); } }
function updateApplicantStatus(id, status){ if(window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return;const next=normalizeStatus(status); applicants=applicants.map(a=>a.id===id?normalize({...a,status:next,updatedAt:new Date().toISOString()}):a); save(); }
function duplicateApplicant(id){ if(window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return;const a=applicants.find(x=>x.id===id); if(a){ const copy={...a,id:'',name:a.name+' 복사',phone:'',email:'',createdAt:''}; fillForm(copy); setPage('form'); } }
function deleteApplicant(id){
  if(window.erpPermissions&&!window.erpPermissions.require('applicant.delete'))return;
  const applicant=applicants.find(a=>a.id===id);if(!applicant||!confirm(`"${applicant.name||'지원자'}" 지원자를 삭제할까요?`))return;
  const auditReason=auditDeletionReason();if(!auditReason)return;
  const previous=applicants;applicants=applicants.filter(a=>a.id!==id);
  window.erpAudit?.setNextContext('applicant',{action:'delete',reason:auditReason});
  if(!save()){applicants=previous;window.erpAudit?.clearNextContext('applicant');renderAll();return;}
}
function detailRow(label, value, cls=''){
  const v = String(value ?? '').trim();
  if(!v) return '';
  return `<div class="detail-row ${cls}"><span>${label}</span><strong>${esc(v)}</strong></div>`;
}
function coreItem(label, value){
  const v = String(value ?? '').trim() || '-';
  return `<div class="core-item"><span>${label}</span><strong>${esc(v)}</strong></div>`;
}
function memoBlock(title, value){
  const v = String(value ?? '').trim();
  if(!v) return '';
  return `<div class="detail-memo"><h4>${title}</h4><p>${esc(v)}</p></div>`;
}
function applicantSummary(a){ return `${a.name||'지원자'} / ${a.workplace||'근무지 미입력'} / ${a.phone||'연락처 없음'}
상태: ${a.status||'-'} / 출근방법: ${dormLabel(a)} / 면접결과: ${a.finalDecision||'미입력'}
지원구분: ${a.careerType||'-'} / 지원경로: ${a.source||'-'}
학력구분: ${a.education||'-'} / 학교·전공: ${[a.school,a.major].filter(Boolean).join(' / ')||'-'} / 외국어·기타자격: ${a.languageEtc||'-'}
확인필요: ${displayCheckNeeds(a.checkNeeds)||'-'}
자격증: ${a.certs||'-'}
메모/결과·검토메모: ${[a.memo,a.decisionReason].filter(Boolean).join(' / ')||'-'}`; }
function viewApplicant(id){
  const a=applicants.find(x=>x.id===id); if(!a) return;
  detailCurrentId=id;
  const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ') || '일정 미정';
  const dorm=dormLabel(a);
  const decision=a.finalDecision||'면접 결과 미입력';
  const action=nextAction(a);
  const status=normalizeStatus(a.status);
  const profileSub=[a.careerType,a.education,a.school,a.major].filter(Boolean).join(' · ') || '지원자 기본정보';
  const detailSection=(title, rows, cls='')=>rows ? `<section class="detail-section-card detail-section-v108 applicant-detail-section ${cls}"><div class="detail-section-title"><h4>${title}</h4></div><div class="detail-grid detail-grid-v108">${rows}</div></section>` : '';
  const longBlock=(title, value, cls='')=>{
    const v=String(value ?? '').trim();
    if(!v) return '';
    return `<section class="detail-section-card detail-section-v108 detail-long-section applicant-detail-long ${cls}"><div class="detail-section-title"><h4>${title}</h4></div><p>${esc(v)}</p></section>`;
  };
  const summaryItem=(label,value,cls='')=>`<div class="applicant-detail-summary-item ${cls}"><span>${label}</span><strong>${esc(String(value||'-'))}</strong></div>`;

  const profile=`<section class="applicant-detail-identity ${statusToneClass(a)}">
    <div class="applicant-detail-profile-main">
      <div class="applicant-detail-avatar" aria-hidden="true">${esc(String(a.name||'?').trim().slice(0,1)||'?')}</div>
      <div class="applicant-detail-profile-copy">
        <p class="eyebrow">APPLICANT PROFILE</p>
        <h2 class="detail-name ${genderClass(a)}">${esc(a.name||'이름없음')}</h2>
        <p>${esc(profileSub)}</p>
      </div>
    </div>
    <div class="applicant-detail-contact-line">
      <span><small>연락처</small><b>${esc(a.phone||'미등록')}</b></span>
      <span><small>이메일</small><b>${esc(a.email||'미등록')}</b></span>
    </div>
  </section>`;

  const summary=`<section class="applicant-detail-summary-section">
    <div class="applicant-detail-summary-grid">
      ${summaryItem('현재 상태',status||'미입력','status')}
      ${summaryItem('지원근무지',a.workplace||'미입력','workplace')}
      ${summaryItem('면접 일정',interview,'interview')}
      ${summaryItem('입사 예정일',a.hireDate||'미정','hire')}
    </div>
  </section>`;

  const basicRows=[
    detailRow('연락처',a.phone),detailRow('이메일',a.email),detailRow('지원일',a.applyDate),detailRow('지원경로',a.source),
    detailRow('출근방법',dorm),detailRow('거주지역',a.region),detailRow('성별',a.gender),detailRow('생년월일/연령',[a.birthYear,a.age&&a.age+'세'].filter(Boolean).join(' / '))
  ].join('');
  const educationRows=[
    detailRow('학력구분',a.education),detailRow('학교/전공',[a.school,a.major].filter(Boolean).join(' / ')),
    detailRow('자격증',a.certs,'wide-row'),detailRow('외국어/기타자격',a.languageEtc,'wide-row')
  ].join('');
  const reviewRows=[
    detailRow('지원구분',a.careerType),detailRow('확인필요사항',displayCheckNeeds(a.checkNeeds),'wide-row'),
    detailRow('자소서/태도 키워드',a.selfIntroKeywords,'wide-row')
  ].join('');
  const memoBlocks=[
    longBlock('상담내용',a.consult,'memo-primary'),
    longBlock('메모·다음 액션',a.memo),
    longBlock('결과·검토 메모',a.decisionReason)
  ].filter(Boolean).join('');
  const careerBlock=longBlock('경력사항',a.career,'career-long');

  $('detailTitle').textContent=`${a.name||'이름없음'} · 지원자 상세`;
  $('detailBody').innerHTML=`
    ${profile}
    ${summary}
    <div class="applicant-detail-content-grid">
      <div class="applicant-detail-content-main">
        ${detailSection('기본정보',basicRows)}
        ${memoBlocks?`<div class="applicant-detail-memo-stack">${memoBlocks}</div>`:''}
        ${careerBlock}
      </div>
      <aside class="applicant-detail-content-side">
        ${detailSection('학력·자격',educationRows)}
        ${detailSection('검토 참고정보',reviewRows)}
        <section class="applicant-detail-decision-card">
          <div><span>면접 결과</span><strong>${esc(decision)}</strong></div>
          <div><span>다음 액션</span><strong>${esc(action)}</strong></div>
        </section>
      </aside>
    </div>`;
  $('detailModal').classList.add('show');
  $('detailModal')?.setAttribute('aria-hidden','false');
  setTimeout(()=>$('btnCloseDetail')?.focus({preventScroll:true}),0);
}
function closeDetail(force=false){
  const composer=$('aphQuickComposer');
  const note=$('aphNote');
  if(!force && composer && !composer.hidden && String(note?.value||'').trim()){
    if(!confirm('작성 중인 진행 기록이 저장되지 않았습니다. 닫을까요?')) return false;
  }
  $('detailModal').classList.remove('show');
  $('detailModal')?.setAttribute('aria-hidden','true');
  detailCurrentId='';
  return true;
}
