
/* ===== CONSOLIDATED SOURCE: complete-ux-v10.37.8.js ===== */
/* Recruit ERP v10.37.6 ENV_MODE
   UI/UX enhancement layer only. Core applicant/school/employee storage schemas remain unchanged. */
(function(){
'use strict';

const UX_VERSION=window.erpAppVersion?.VERSION||'';
const OPERATION_ENV_KEY='recruit_erp_ui_operation_environment';
const TEMPLATE_HISTORY_KEY='recruit_erp_ui_template_history';
const SCHOOL_FAVORITES_KEY='recruit_erp_ui_school_favorites';
let uxFormDirty=false;
let uxFormBaseline='';
let uxTaskShowEmpty=false;
let uxCalendarView=(window.matchMedia && window.matchMedia('(max-width: 760px)').matches)?'list':'month';
let uxCalendarType='전체';
let uxSubmitSnapshot=null;

function uxEl(id){ return document.getElementById(id); }
function uxSafeJson(raw,fallback){ try{return JSON.parse(raw)||fallback;}catch{return fallback;} }
function uxNowLabel(){ return new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}); }
function uxToast(message,type='success'){
  let host=uxEl('uxToastHost');
  if(!host){ host=document.createElement('div'); host.id='uxToastHost'; host.className='ux-toast-host'; document.body.appendChild(host); }
  const item=document.createElement('div'); item.className=`ux-toast ${type}`;
  item.innerHTML=`<span class="ux-toast-icon">${type==='error'?'!':type==='warn'?'△':'✓'}</span><div><strong>${type==='error'?'처리 실패':type==='warn'?'확인 필요':'처리 완료'}</strong><span>${String(message||'')}</span></div><small>${uxNowLabel()}</small>`;
  host.appendChild(item);
  requestAnimationFrame(()=>item.classList.add('show'));
  setTimeout(()=>{ item.classList.remove('show'); setTimeout(()=>item.remove(),250); },3000);
}
window.uxToast=uxToast;

function uxFormSerialize(){
  const form=uxEl('applicantForm');
  if(!form) return '';
  const fd=new FormData(form);
  form.querySelectorAll('input,select,textarea').forEach(el=>{ if(el.id && !el.name) fd.append(el.id,el.type==='checkbox'?String(el.checked):el.value); });
  return JSON.stringify([...fd.entries()]);
}
function uxSetFormBaseline(){ uxFormBaseline=uxFormSerialize(); uxFormDirty=false; document.body.classList.remove('form-dirty'); }
function uxUpdateFormDirty(){ uxFormDirty=!!uxFormBaseline && uxFormSerialize()!==uxFormBaseline; document.body.classList.toggle('form-dirty',uxFormDirty); }
function uxClearFormValidation(){
  const form=uxEl('applicantForm');
  if(!form)return;
  form.querySelectorAll('.field-feedback').forEach(x=>x.remove());
  form.querySelectorAll('.field-invalid,.field-valid').forEach(x=>x.classList.remove('field-invalid','field-valid'));
}
window.erpApplicantFormIsDirty=()=>uxFormDirty;
function uxFieldValue(id){ return (uxEl(id)?.value||'').trim(); }
function uxSetFieldState(id,message,type='error'){
  const el=uxEl(id); if(!el) return;
  const label=el.closest('label'); if(!label) return;
  let hint=label.querySelector('.field-feedback');
  if(!hint){ hint=document.createElement('span'); hint.className='field-feedback'; label.appendChild(hint); }
  hint.textContent=message||''; hint.className=`field-feedback ${type}`;
  label.classList.toggle('field-invalid',!!message&&type==='error');
  label.classList.toggle('field-valid',!!message&&type==='success');
  if(!message){ label.classList.remove('field-invalid','field-valid'); hint.remove(); }
}
function uxValidateForm(showAll=false){
  let ok=true;
  const name=uxFieldValue('name');
  const phone=String(uxFieldValue('phone')).replace(/\D/g,'');
  const email=uxFieldValue('email');
  if(!name){ uxSetFieldState('name','성명은 필수입니다.'); ok=false; } else uxSetFieldState('name','');
  if(phone && (phone.length<9 || phone.length>11)){ uxSetFieldState('phone','연락처 숫자를 확인해주세요.'); ok=false; }
  else if(showAll && phone) uxSetFieldState('phone','입력 형식 확인됨','success'); else uxSetFieldState('phone','');
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ uxSetFieldState('email','이메일 형식을 확인해주세요.'); ok=false; }
  else uxSetFieldState('email','');
  return ok;
}
function uxFormatPhoneInput(el){
  const d=String(el.value||'').replace(/\D/g,'').slice(0,11);
  if(d.length<=3) el.value=d;
  else if(d.length<=7) el.value=`${d.slice(0,3)}-${d.slice(3)}`;
  else el.value=`${d.slice(0,3)}-${d.slice(3,d.length-4)}-${d.slice(-4)}`;
}
function uxUpdateFormProgress(){
  const status=uxFieldValue('status')||'서류검토';
  const terminal=['불합격','서류탈락','면접거절','면접불참','입사철회','철회','연락두절','연락거절','연락 거절'].includes(status);
  const definitions=[
    {step:'1',started:['name','phone','applyDate','workplace'],required:['name','phone','applyDate','workplace']},
    {step:'2',started:['education','school','major','certs','languageEtc','career'],required:[],optional:true},
    {step:'3',started:['dormUse','interviewDate','interviewTime','hireDate','consult','memo'],required:[
      ...(['면접예정','다음면접'].includes(status)?['interviewDate']:[]),
      ...(status==='입사예정'?['hireDate']:[])
    ],forceStarted:status!=='서류검토'||terminal}
  ];
  let requiredComplete=0;
  const requiredTotal=definitions.filter(def=>def.required.length>0).length;
  definitions.forEach(def=>{
    const sec=document.querySelector(`[data-form-step="${def.step}"]`);if(!sec)return;
    const started=!!def.forceStarted||def.started.some(id=>uxFieldValue(id));
    const missing=def.required.filter(id=>!uxFieldValue(id));
    let state='not-started',label=def.optional?'선택 입력':'미작성';
    if(started&&missing.length){state='needs-review';label='확인 필요';}
    else if(started){state='complete';label='완료';}
    if(def.required.length>0&&!missing.length)requiredComplete+=1;
    sec.classList.remove('step-complete','step-needs-review','step-not-started');
    sec.classList.add(`step-${state}`);
    let badge=sec.querySelector('[data-form-step-status]');
    if(!badge){badge=document.createElement('span');badge.dataset.formStepStatus='';badge.className='form-step-status';sec.querySelector('.section-title')?.appendChild(badge);}
    if(badge){badge.className=`form-step-status is-${state}`;badge.textContent=label;badge.title=missing.length?`필수 확인: ${missing.join(', ')}`:'';}
  });
  const pct=requiredTotal?Math.round(requiredComplete/requiredTotal*100):100;
  if(uxEl('formProgressText')) uxEl('formProgressText').textContent=`필수 ${requiredComplete}/${requiredTotal} 단계 완료`;
  if(uxEl('formProgressBar')) uxEl('formProgressBar').style.width=`${pct}%`;
}

/* ---------- Status workflow ---------- */
let uxStatusModalState=null;
function uxAppendStatusMemo(currentMemo,newMemo,next,date=today()){
  const existing=String(currentMemo||'').trim(),addition=String(newMemo||'').trim();
  if(!addition)return existing;
  const entry=`[${date} · 상태 변경: ${next}]\n${addition}`;
  return existing?`${existing}\n\n${entry}`:entry;
}
window.erpAppendStatusMemo=uxAppendStatusMemo;
function uxEnsureStatusModal(){
  let modal=uxEl('applicantStatusModal');if(modal)return modal;
  modal=document.createElement('div');modal.id='applicantStatusModal';modal.className='modal applicant-status-modal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="modal-backdrop" data-status-cancel></div><section class="modal-card applicant-status-card" role="dialog" aria-modal="true" aria-labelledby="applicantStatusTitle"><div class="modal-head"><div><p class="eyebrow">STATUS WORKFLOW</p><h3 id="applicantStatusTitle">지원자 상태 변경</h3><p id="applicantStatusDescription" class="status-modal-description"></p></div><button class="ghost" type="button" data-status-cancel>닫기</button></div><form id="applicantStatusForm"><div class="status-modal-summary"><span>변경할 상태</span><strong id="applicantStatusNext"></strong></div><div class="status-modal-fields"><label data-status-field="interviewDate">면접 날짜 <em class="req">*</em><input id="statusInterviewDate" type="date"></label><label data-status-field="interviewTime">면접 시간<select id="statusInterviewTime"><option value="">시간 미정</option>${Array.from({length:25},(_,i)=>{const mins=8*60+i*30;const h=String(Math.floor(mins/60)).padStart(2,'0'),m=String(mins%60).padStart(2,'0');return `<option>${h}:${m}</option>`;}).join('')}</select></label><label data-status-field="workplace">근무지 확인<select id="statusWorkplace"><option value="">선택</option><option>천안</option><option>평택</option><option>기타</option></select></label><label data-status-field="hireDate">입사 날짜 <em class="req">*</em><input id="statusHireDate" type="date"></label><label data-status-field="commute">출근 방법<select id="statusCommute"><option value="">확인 필요</option><option>기숙사</option><option>출퇴근</option><option>확인필요</option></select></label><label data-status-field="reason" class="wide">사유<input id="statusReason" maxlength="200" placeholder="상태 변경 사유"></label><label data-status-field="memo" class="wide">메모 추가<textarea id="statusMemo" rows="3" maxlength="500" placeholder="기존 메모는 유지되며 새 내용만 뒤에 추가됩니다 (선택)"></textarea><small id="applicantStatusMemoHint" class="status-memo-hint"></small></label></div><div class="status-modal-error" id="applicantStatusError" role="alert"></div><div class="form-actions status-modal-actions"><button class="ghost" type="button" data-status-cancel>취소</button><button class="primary" id="btnSaveApplicantStatus" type="submit">상태 변경 저장</button></div></form></section>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-status-cancel]').forEach(el=>el.addEventListener('click',()=>uxCloseStatusModal(null)));
  modal.querySelector('form').addEventListener('submit',event=>{event.preventDefault();uxSubmitStatusModal();});
  modal.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();uxCloseStatusModal(null);return;}
    if(event.key==='Enter'&&event.target.tagName!=='TEXTAREA'){event.preventDefault();uxSubmitStatusModal();return;}
    if(event.key==='Tab'){
      const focusable=[...modal.querySelectorAll('button:not([disabled]),input:not([hidden]),select,textarea')].filter(el=>el.offsetParent!==null);
      if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  return modal;
}
function uxCloseStatusModal(value){
  const state=uxStatusModalState;if(!state)return;uxStatusModalState=null;
  state.modal.classList.remove('show');state.modal.setAttribute('aria-hidden','true');document.body.classList.remove('status-modal-open');
  state.resolve(value);state.trigger?.focus?.();
}
function uxSubmitStatusModal(){
  const state=uxStatusModalState;if(!state)return;const {modal,next,applicant}=state;
  const interview=['면접예정','다음면접'].includes(next),hire=next==='입사예정';
  const interviewDate=modal.querySelector('#statusInterviewDate').value,hireDate=modal.querySelector('#statusHireDate').value;
  const error=modal.querySelector('#applicantStatusError');
  if(interview&&!interviewDate){error.textContent='면접 날짜를 입력해 주세요.';modal.querySelector('#statusInterviewDate').focus();return;}
  if(hire&&!hireDate){error.textContent='입사 날짜를 입력해 주세요.';modal.querySelector('#statusHireDate').focus();return;}
  const patch={status:next,updatedAt:new Date().toISOString()};
  const values={interviewDate,interviewTime:modal.querySelector('#statusInterviewTime').value,workplace:modal.querySelector('#statusWorkplace').value,hireDate,dormUse:modal.querySelector('#statusCommute').value,decisionReason:modal.querySelector('#statusReason').value.trim()};
  Object.entries(values).forEach(([key,value])=>{if(value)patch[key]=value;});
  const newMemo=modal.querySelector('#statusMemo').value.trim();
  if(newMemo)patch.memo=uxAppendStatusMemo(applicant?.memo,newMemo,next);
  uxCloseStatusModal(patch);
}
function uxRequestStatusData(a,next){
  const modal=uxEnsureStatusModal(),interview=['면접예정','다음면접'].includes(next),hire=next==='입사예정',terminal=['불합격','서류탈락','면접거절','면접불참','입사철회','철회','연락두절','연락거절','연락 거절'].includes(next);
  modal.querySelectorAll('[data-status-field]').forEach(el=>{const key=el.dataset.statusField;el.hidden=!((interview&&['interviewDate','interviewTime','workplace','memo'].includes(key))||(hire&&['hireDate','commute','memo'].includes(key))||(terminal&&['reason','memo'].includes(key))||(!interview&&!hire&&!terminal&&key==='memo'));});
  modal.querySelector('#applicantStatusNext').textContent=next;modal.querySelector('#applicantStatusDescription').textContent=`${a.name||'지원자'}님의 상태를 변경합니다. 저장 전 필요한 정보를 확인하세요.`;
  modal.querySelector('#statusInterviewDate').value=a.interviewDate||today();modal.querySelector('#statusInterviewTime').value=a.interviewTime||'';modal.querySelector('#statusWorkplace').value=['천안','평택','기타'].includes(a.workplace)?a.workplace:'';modal.querySelector('#statusHireDate').value=a.hireDate||today();modal.querySelector('#statusCommute').value=a.dormUse||'';modal.querySelector('#statusReason').value=a.decisionReason||'';modal.querySelector('#statusMemo').value='';modal.querySelector('#applicantStatusMemoHint').textContent=a.memo?'기존 메모는 그대로 보존되고 새 내용만 날짜·변경 상태와 함께 추가됩니다.':'입력한 내용은 날짜·변경 상태와 함께 새 메모로 추가됩니다.';modal.querySelector('#applicantStatusError').textContent='';
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('status-modal-open');
  return new Promise(resolve=>{uxStatusModalState={modal,next,applicant:a,resolve,trigger:document.activeElement};requestAnimationFrame(()=>modal.querySelector('[data-status-field]:not([hidden]) input, [data-status-field]:not([hidden]) select, [data-status-field]:not([hidden]) textarea')?.focus());});
}
async function uxUpdateApplicantStatus(id,status){
  const a=applicants.find(x=>x.id===id); if(!a) return;
  const next=normalizeStatus(status);
  const patch=await uxRequestStatusData(a,next); if(!patch){ renderAll(); return; }
  const previous=applicants;
  applicants=applicants.map(x=>x.id===id?normalize({...x,...patch}):x);
  if(!save()){applicants=previous;renderAll();return;}
  uxToast(`${a.name||'지원자'} 상태를 ${next}(으)로 변경했습니다.`);
  if(detailCurrentId===id && uxEl('detailModal')?.classList.contains('show')) viewApplicant(id);
}
window.updateApplicantStatus=uxUpdateApplicantStatus;
try{ updateApplicantStatus=uxUpdateApplicantStatus; }catch(e){}

/* ---------- Shared task cards ---------- */
const uxBaseCard=card;
card=function(a){
  const schedule=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ');
  const dateText=schedule?`면접 ${schedule}`:(a.hireDate?`입사 ${a.hireDate}`:'일정 미정');
  const needs=[];
  if(['서류검토','부재중'].includes(a.status)) needs.push('연락');
  if(isDormPending(a)) needs.push('출근방법');
  if(isDecisionNeeded(a)) needs.push('판정');
  return `<article class="person-card workflow-person-card ${statusToneClass(a)}">
    <button class="workflow-person-main" type="button" data-erp-handler="viewApplicant('${a.id}')">
      <span class="workflow-name-line"><strong>${esc(a.name||'이름없음')}</strong><span class="badge ${badgeClass(a.status)}">${esc(a.status)}</span></span>
      <small>${esc(a.workplace||'근무지 미입력')} · ${esc(dateText)}${needs.length?` · 확인 ${esc(needs.join('/'))}`:''}</small>
    </button>
    <div class="workflow-card-actions"><select aria-label="${esc(a.name||'지원자')} 상태 변경" data-erp-change-handler="updateApplicantStatus('${a.id}',this.value)">${statusOptionsHtml(a.status)}</select><button class="mini" type="button" data-erp-handler="viewApplicant('${a.id}')">상세</button></div>
  </article>`;
};
window.card=card;

/* ---------- Sidebar status density ---------- */
function uxConsolidateSidebarStatus(){
  const storage=uxEl('storageNote');
  if(!storage)return null;
  let area=document.querySelector('.sidebar-status-area');
  if(!area){
    area=document.createElement('div');
    area.className='sidebar-status-area';
    area.dataset.sidebarStatusArea='';
    area.setAttribute('aria-label','저장 상태');
    storage.parentNode.insertBefore(area,storage);
  }
  let details=area.querySelector('.sidebar-status-details');
  if(!details){
    const toggle=document.createElement('button');
    toggle.className='sidebar-status-toggle';
    toggle.type='button';
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-controls','sidebarStatusDetails');
    toggle.innerHTML='<span id="sidebarStatusSummaryText">저장 상태</span><span aria-hidden="true">⌃</span>';
    details=document.createElement('div');
    details.className='sidebar-status-details';
    details.id='sidebarStatusDetails';
    details.append(storage);
    area.append(toggle,details);
    toggle.addEventListener('click',()=>{
      const expanded=toggle.getAttribute('aria-expanded')==='true';
      toggle.setAttribute('aria-expanded',String(!expanded));
      area.classList.toggle('is-details-open',!expanded);
    });
  }
  return area;
}

/* ---------- Home ---------- */
const uxBaseRenderStats=renderStats;
renderStats=function(){
  const total=applicants.length, active=applicants.filter(isActive).length, g=taskGroups();
  const currentMonth=today().slice(0,7);
  const monthApplications=applicants.filter(applicant=>String(applicant.applyDate||'').slice(0,7)===currentMonth).length;
  const plannedHires=applicants.filter(applicant=>normalizeStatus(applicant.status)==='입사예정').length;
  const kpis=[
    ['전체 지원자',total,'applicants','전체 목록'],
    ['진행중',active,'active','진행 목록'],
    ['이번 달 지원',monthApplications,'monthApplications','지원일 기준'],
    ['입사예정',plannedHires,'hirePlanned','대상 목록']
  ];
  if(uxEl('statsGrid')) uxEl('statsGrid').innerHTML=kpis.map(([label,value,key,caption])=>`<button type="button" class="stat stat-button" data-kpi-key="${key}" data-dashboard-target="${key}"><span>${label}</span><strong>${value}</strong><small>${caption} →</small></button>`).join('');
  const dg=typeof dailyWorkflowGroups==='function'?dailyWorkflowGroups():null;
  const map={
    homeTodayInterviewCount:dg?dg.interviewToday.length:g.todayInterviews.length,
    homeOverdueCount:dg?dg.overdue.length:g.overdue.length,
    homeContactCount:dg?dg.contact.length:g.recalls.length,
    homeDecisionCount:dg?dg.resultPending.length:g.decisions.length,
    homeHireSoonCount:dg?dg.hireUpcoming.length:g.hireSoon.length
  };
  Object.entries(map).forEach(([id,v])=>{ if(uxEl(id)) uxEl(id).textContent=v; });
};
window.renderStats=renderStats;

function uxOpenApplicantFilter(filter){
  resetListFiltersToAll();
  if(filter==='active') currentFilter='active';
  if(filter==='contact') currentFilter='contact';
  if(filter==='decision') currentFilter='decision';
  if(filter==='hirePlanned') currentFilter='hirePlanned';
  if(filter==='monthApplications') { currentSearch=today().slice(0,7); if(uxEl('searchInput')) uxEl('searchInput').value=currentSearch; }
  if(filter==='today') { currentFilter='interview'; currentSearch=today(); if(uxEl('searchInput')) uxEl('searchInput').value=today(); }
  if(filter==='overdue') { currentFilter='active'; currentSort='interviewAsc'; }
  document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.toggle('active',x.dataset.filter===currentFilter));
  setPage('applicants'); renderTable();
}
function uxFocusTaskPanel(key){
  const map={today:'interviewToday',overdue:'overdue',contact:'contact',decision:'resultPending',hire:'hireUpcoming'};
  setPage('today');
  if(typeof setDailyWorkflowFilter==='function') setDailyWorkflowFilter(map[key]||'all');
  setTimeout(()=>{
    const panel=document.querySelector('.daily-workflow-panel');
    if(panel) panel.scrollIntoView({behavior:'smooth',block:'start'});
  },20);
}

/* ---------- Today workflow ---------- */
const uxBaseRenderToday=renderToday;
renderToday=function(){
  uxBaseRenderToday();
  const g=taskGroups();
  if(uxEl('todayOverdueCount')) uxEl('todayOverdueCount').textContent=g.overdue.length;
  if(uxEl('overdueList')) uxEl('overdueList').innerHTML=g.overdue.length?g.overdue.map(card).join(''):'<div class="empty">기한이 지난 미처리 업무가 없습니다.</div>';
  const counts={today:g.todayInterviews.length,overdue:g.overdue.length,interview:g.upcomingInterviews.length,contact:g.recalls.length,dorm:g.dorms.length,hire:[...g.hireToday,...g.hireD3,...g.hireD7].filter((a,i,arr)=>arr.findIndex(x=>x.id===a.id)===i).length,decision:[...g.decisions,...g.waits].filter((a,i,arr)=>arr.findIndex(x=>x.id===a.id)===i).length,employee:applicantsPendingEmployeeLink().length};
  document.querySelectorAll('[data-task-panel]').forEach(p=>{
    const count=counts[p.dataset.taskPanel]||0;
    p.classList.toggle('task-panel-empty',count===0);
    p.style.display=(!uxTaskShowEmpty&&count===0)?'none':'';
  });
  const btn=uxEl('btnShowAllTaskGroups'); if(btn) btn.textContent=uxTaskShowEmpty?'빈 그룹 숨기기':'빈 그룹도 보기';
};
window.renderToday=renderToday;

/* ---------- Form mode, validation, unsaved warning ---------- */
const uxBaseUpdateFormMode=updateFormMode;
updateFormMode=function(){
  uxBaseUpdateFormMode();
  const editing=!!uxEl('editId')?.value;
  if(uxEl('formModePill')) uxEl('formModePill').textContent=editing?'EDIT':'NEW';
  if(uxEl('formModeTitle')) uxEl('formModeTitle').textContent=editing?`${uxFieldValue('name')||'지원자'} 정보 수정`:'신규 지원자 등록';
  if(uxEl('formModeDescription')) uxEl('formModeDescription').textContent=editing?'변경할 항목을 확인한 뒤 수정 저장하세요.':'기본정보부터 진행관리까지 순서대로 입력하세요.';
  document.body.classList.toggle('form-editing',editing);
  uxUpdateFormProgress();
};
window.updateFormMode=updateFormMode;
const uxBaseFillForm=fillForm;
fillForm=function(a){ uxBaseFillForm(a); setTimeout(()=>{uxSetFormBaseline();uxUpdateFormProgress();},0); };
window.fillForm=fillForm;
const uxBaseResetForm=resetForm;
resetForm=function(){
  uxBaseResetForm();
  uxClearFormValidation();
  uxSetFormBaseline();
  uxUpdateFormProgress();
};
window.resetForm=resetForm;

const uxBaseSetPage=setPage;
setPage=function(page){
  const active=document.querySelector('.page.active')?.id;
  if(active==='form' && page!=='form'){
    if(uxFormDirty && !confirm('저장하지 않은 입력 내용이 있습니다.\n나가면 작성한 내용이 사라집니다. 계속 이동할까요?')) return;
    resetForm();
  }
  uxBaseSetPage(page);
  if(page==='form') setTimeout(()=>{ if(!uxFormBaseline) uxSetFormBaseline(); uxUpdateFormProgress(); },0);
};
window.setPage=setPage;

/* ---------- Detail view action layer ---------- */
const uxBaseViewApplicant=viewApplicant;
viewApplicant=function(id){
  uxBaseViewApplicant(id);
  const a=applicants.find(x=>x.id===id); if(!a) return;
  const sel=uxEl('detailQuickStatus');
  if(sel){ sel.innerHTML=statusOptionsHtml(a.status); sel.value=normalizeStatus(a.status); sel.onchange=()=>uxUpdateApplicantStatus(id,sel.value); }
  const template=uxEl('btnDetailTemplate'); if(template) template.onclick=()=>uxOpenTemplateForApplicant(id);
  const print=uxEl('btnDetailPrint'); if(print) print.onclick=()=>window.print();
  const body=uxEl('detailBody');
  if(body && !body.querySelector('.detail-progress-strip')){
    const steps=['서류검토','서류합격','면접예정','면접완료','입사예정','출근'];
    const cur=steps.indexOf(normalizeStatus(a.status));
    const strip=document.createElement('div'); strip.className='detail-progress-strip';
    strip.innerHTML=steps.map((x,i)=>`<span class="${i<=cur?'done':''} ${i===cur?'current':''}">${x}</span>`).join('');
    body.insertBefore(strip,body.firstChild);
  }
};
window.viewApplicant=viewApplicant;

/* ---------- Calendar month/week/list ---------- */
const uxBaseCalendarAllItems=calendarAllItems;
calendarAllItems=function(){
  const rows=uxBaseCalendarAllItems();
  if(uxCalendarType==='전체') return rows;
  if(uxCalendarType==='직접') return rows.filter(x=>x.kind==='custom');
  if(uxCalendarType==='긴급') return rows.filter(x=>x.importance==='urgent');
  return rows.filter(x=>x.type===uxCalendarType);
};
window.calendarAllItems=calendarAllItems;
function uxCalendarItemHtml(item){
  const onclick=item.kind==='auto'?`viewApplicant('${item.applicantId}')`:(item.id?`editCalendarEvent('${item.id}')`:'');
  return `<button type="button" class="calendar-alt-item ${calendarTypeClass(item)}" data-erp-handler="${onclick}"><span>${esc(item.time||'시간미정')} · ${esc(item.type)}</span><strong>${esc(item.title)}</strong><small>${esc([item.workplace,item.memo].filter(Boolean).join(' · ')||'추가 정보 없음')}</small></button>`;
}
function uxRenderCalendarWeek(){
  const el=uxEl('calendarWeekGrid'); if(!el) return;
  const base=new Date((selectedCalendarDate||today())+'T00:00:00');
  const start=new Date(base); start.setDate(base.getDate()-base.getDay());
  const all=calendarAllItems();
  el.innerHTML=Array.from({length:7},(_,i)=>{
    const d=new Date(start); d.setDate(start.getDate()+i); const key=calendarDateKey(d);
    const items=all.filter(x=>x.date===key);
    return `<section class="calendar-week-day ${key===today()?'today':''}"><button type="button" class="calendar-week-date" data-erp-handler="selectCalendarDate('${key}')"><span>${['일','월','화','수','목','금','토'][d.getDay()]}</span><strong>${d.getMonth()+1}.${d.getDate()}</strong><small>${items.length}건</small></button><div>${items.length?items.map(uxCalendarItemHtml).join(''):'<span class="calendar-alt-empty">일정 없음</span>'}</div></section>`;
  }).join('');
}
function uxRenderCalendarList(){
  const el=uxEl('calendarListView'); if(!el) return;
  const month=`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,'0')}`;
  const rows=calendarAllItems().filter(x=>String(x.date).startsWith(month)).sort((a,b)=>(a.date+' '+(a.time||'99:99')).localeCompare(b.date+' '+(b.time||'99:99')));
  if(!rows.length){ el.innerHTML='<div class="empty">선택한 달에 일정이 없습니다.</div>'; return; }
  const groups={}; rows.forEach(x=>(groups[x.date]||(groups[x.date]=[])).push(x));
  el.innerHTML=Object.entries(groups).map(([date,items])=>`<section class="calendar-list-group"><div class="calendar-list-date"><strong>${calendarDateLabel(date)}</strong><span>${items.length}건</span></div><div>${items.map(uxCalendarItemHtml).join('')}</div></section>`).join('');
}
function uxApplyCalendarView(){
  document.querySelectorAll('[data-calendar-panel]').forEach(p=>p.style.display=p.dataset.calendarPanel===uxCalendarView?'':'none');
  document.querySelectorAll('[data-calendar-view]').forEach(b=>b.classList.toggle('active',b.dataset.calendarView===uxCalendarView));
  if(uxCalendarView==='week') uxRenderCalendarWeek();
  if(uxCalendarView==='list') uxRenderCalendarList();
}
const uxBaseRenderCalendar=renderCalendar;
renderCalendar=function(){ uxBaseRenderCalendar(); uxApplyCalendarView(); };
window.renderCalendar=renderCalendar;

/* ---------- Stats ---------- */
renderStatsSummary=function(){
  const el=uxEl('statsSummaryGrid'); if(!el) return;
  const scope=statsScope(); const now=today().slice(0,7);
  const monthApply=scope.filter(a=>String(a.applyDate||'').startsWith(now));
  const interviewed=monthApply.filter(isInterviewed);
  const passed=monthApply.filter(isPassed);
  const hired=monthApply.filter(a=>a.status==='출근');
  const rate=monthApply.length?Math.round(passed.length/monthApply.length*100):0;
  const leadRows=scope.filter(a=>{
    if(!a.applyDate) return false;
    return (typeof isHireDateMeaningful==='function'&&isHireDateMeaningful(a)) || (typeof isInterviewDateMeaningful==='function'&&isInterviewDateMeaningful(a));
  }).map(a=>{
    const useHire=typeof isHireDateMeaningful==='function'&&isHireDateMeaningful(a);
    const end=useHire?a.hireDate:a.interviewDate; const d1=new Date(a.applyDate+'T00:00:00'),d2=new Date(end+'T00:00:00'); return Math.max(0,Math.round((d2-d1)/86400000));
  }).filter(Number.isFinite);
  const avg=leadRows.length?Math.round(leadRows.reduce((x,y)=>x+y,0)/leadRows.length):0;
  const data=[['이번 달 지원',monthApply.length,'지원일 기준'],['이번 달 면접',interviewed.length,'면접일 경과'],['이번 달 합격',passed.length,'입사예정+출근'],['이번 달 출근',hired.length,'입사 완료'],['합격률',rate+'%','이번 달 지원 대비'],['평균 진행일',avg+'일','지원→면접/입사']];
  el.innerHTML=data.map(([k,v,s])=>`<div class="stat stats-kpi-card"><span>${k}</span><strong>${v}</strong><small>${s}</small></div>`).join('');
};
window.renderStatsSummary=renderStatsSummary;

/* ---------- Template builder ---------- */
function uxTemplateApplicants(){
  const sel=uxEl('templateApplicant'); if(!sel) return;
  const prev=sel.value;
  const rows=[...applicants].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  sel.innerHTML='<option value="">지원자 없이 작성</option>'+rows.map(a=>`<option value="${a.id}">${esc(a.name||'이름없음')} · ${esc(a.status||'')} · ${esc(a.workplace||'')}</option>`).join('');
  if(rows.some(x=>x.id===prev)) sel.value=prev;
}
function uxTemplateData(){
  const a=applicants.find(x=>x.id===uxEl('templateApplicant')?.value)||{};
  return {a,name:a.name||'지원자',wp:uxFieldValue('templateWorkplace')||a.workplace||'지원근무지',date:uxFieldValue('templateDate')||a.interviewDate||a.hireDate||'',time:uxFieldValue('templateTime')||a.interviewTime||'',manager:uxFieldValue('templateManager')||'채용 담당자'};
}
function uxTemplateText(){
  const d=uxTemplateData(); const type=uxEl('templateType')?.value||'면접 안내';
  const dt=[d.date,d.time].filter(Boolean).join(' ')||'협의된 일정';
  const map={
    '면접 안내':`안녕하세요, ${d.name}님.\n에이치티솔루션 ${d.manager}입니다.\n지원해주신 이력서 검토 후 면접 일정을 안내드립니다.\n\n- 지원근무지: ${d.wp}\n- 면접일정: ${dt}\n\n확인 후 가능 여부를 회신 부탁드립니다. 감사합니다.`,
    '면접 일정 변경':`안녕하세요, ${d.name}님.\n기존에 안내드린 ${dt} 면접 일정 조율이 필요해 연락드립니다.\n가능하신 시간대를 회신해주시면 확인 후 다시 안내드리겠습니다.`,
    '면접 취소/전형 안내':`안녕하세요, ${d.name}님.\n채용 일정 관련하여 안내드립니다.\n내부 채용 진행 상황이 변경되어 예정된 면접 진행이 어렵게 되었습니다.\n지원해주셔서 감사합니다.`,
    '천안 → 평택 문의':`안녕하세요, ${d.name}님.\n지원해주신 이력서를 확인하고 연락드립니다.\n현재 천안사업장은 내부 검토 중인 지원자가 있어, 평택사업장 근무도 검토 가능하실지 문의드립니다.`,
    '평택 → 천안 문의':`안녕하세요, ${d.name}님.\n지원해주신 이력서를 확인하고 연락드립니다.\n평택 외 천안사업장 근무도 검토 가능하실지 문의드립니다.`,
    '부재중 재연락':`안녕하세요, ${d.name}님.\n에이치티솔루션 채용 관련하여 연락드렸으나 부재중이셔서 문자 남깁니다.\n통화 가능하실 때 회신 부탁드립니다.`,
    '서류 확인 요청':`안녕하세요, ${d.name}님.\n지원서류 확인 중 추가 확인이 필요한 사항이 있어 연락드립니다.\n확인 가능하실 때 회신 부탁드립니다.`,
    '보류/검토 안내':`안녕하세요, ${d.name}님.\n지원해주신 서류는 현재 내부 검토 중입니다.\n검토 결과에 따라 추가 안내드리겠습니다. 감사합니다.`,
    '입사 안내':`안녕하세요, ${d.name}님.\n${d.wp} 입사 관련하여 안내드립니다.\n- 입사 예정일: ${d.date||'별도 협의'}\n준비사항과 세부 일정은 별도로 안내드리겠습니다. 감사합니다.`
  };
  return map[type]||'';
}
function uxUpdateTemplateCount(){ const out=uxEl('templateOutput'); if(uxEl('templateCharCount')) uxEl('templateCharCount').textContent=`${out?.value.length||0}자`; }
function uxSaveTemplateHistory(text){
  if(!text.trim()) return;
  let rows=uxSafeJson(localStorage.getItem(TEMPLATE_HISTORY_KEY),[]);
  rows=[{id:Date.now(),type:uxEl('templateType')?.value||'',text,createdAt:new Date().toISOString()},...rows.filter(x=>x.text!==text)].slice(0,8);
  localStorage.setItem(TEMPLATE_HISTORY_KEY,JSON.stringify(rows)); uxRenderTemplateHistory();
}
function uxRenderTemplateHistory(){
  const el=uxEl('templateRecentList'); if(!el) return;
  const rows=uxSafeJson(localStorage.getItem(TEMPLATE_HISTORY_KEY),[]);
  el.innerHTML=rows.length?rows.map(x=>`<button type="button" class="template-recent-item" data-template-history-id="${x.id}"><span>${esc(x.type||'문구')}</span><strong>${esc(String(x.text||'').split('\n')[0])}</strong><small>${new Date(x.createdAt).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></button>`).join(''):'<div class="empty">최근 생성한 문구가 없습니다.</div>';
  el.querySelectorAll('[data-template-history-id]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(x=>String(x.id)===btn.dataset.templateHistoryId); if(row&&uxEl('templateOutput')){uxEl('templateOutput').value=row.text;uxUpdateTemplateCount();} });
}
function uxGenerateTemplate(saveHistory=true){
  const text=uxTemplateText(); if(uxEl('templateOutput')) uxEl('templateOutput').value=text; uxUpdateTemplateCount(); if(saveHistory) uxSaveTemplateHistory(text);
}
function uxSyncTemplateApplicant(){
  const a=applicants.find(x=>x.id===uxEl('templateApplicant')?.value); if(!a) return;
  if(uxEl('templateWorkplace')) uxEl('templateWorkplace').value=a.workplace||'';
  if(uxEl('templateDate')) uxEl('templateDate').value=a.interviewDate||a.hireDate||'';
  if(uxEl('templateTime')) uxEl('templateTime').value=a.interviewTime||'';
  uxGenerateTemplate(false);
}
function uxOpenTemplateForApplicant(id){
  if(closeDetail()===false)return; setPage('templates');
  setTimeout(()=>{ uxTemplateApplicants(); if(uxEl('templateApplicant')) uxEl('templateApplicant').value=id; uxSyncTemplateApplicant(); },20);
}
window.uxOpenTemplateForApplicant=uxOpenTemplateForApplicant;

/* ---------- School attention + favorites ---------- */
function uxSchoolFavorites(){ return new Set(uxSafeJson(localStorage.getItem(SCHOOL_FAVORITES_KEY),[])); }
function uxToggleSchoolFavorite(id){
  const set=uxSchoolFavorites(); set.has(id)?set.delete(id):set.add(id); localStorage.setItem(SCHOOL_FAVORITES_KEY,JSON.stringify([...set])); renderSchoolManage(); uxToast(set.has(id)?'중요 학교로 표시했습니다.':'중요 학교 표시를 해제했습니다.');
}
window.uxToggleSchoolFavorite=uxToggleSchoolFavorite;
function uxSchoolIssues(s){
  const rows=[];
  if(!String(s.contact||'').trim()) rows.push('담당자 없음');
  if(!String(s.contactPhone||'').trim()) rows.push('연락처 없음');
  if(schoolManagementStatusLabel(s.managementStatus)==='미지정') rows.push('상태 미지정');
  if(!schoolHasManagementHistory(s)) rows.push('이력 없음');
  if(s.nextContactDate && daysUntil(s.nextContactDate)<0) rows.push('연락일 경과');
  if(!normalizeSchoolType(s.type)) rows.push('구분 미확인');
  return rows;
}
const uxBaseRenderSchoolManage=renderSchoolManage;
renderSchoolManage=function(){
  uxBaseRenderSchoolManage();
  const fav=uxSchoolFavorites();
  document.querySelectorAll('#schoolManageBody tr.school-manage-row').forEach(row=>{
    const onclick=row.getAttribute('data-erp-handler')||''; const m=onclick.match(/openSchoolDetail\('([^']+)'\)/); if(!m) return;
    const id=m[1], s=schools.find(x=>x.id===id); if(!s) return;
    row.classList.toggle('school-favorite-row',fav.has(id));
    const nameCell=row.querySelector('.school-name-cell'); if(!nameCell) return;
    const nameBtn=nameCell.querySelector('.school-name-link');
    if(nameBtn && !nameCell.querySelector('.school-favorite-btn')){
      const star=document.createElement('button'); star.type='button'; star.className='school-favorite-btn'; star.setAttribute('aria-label','중요 학교 표시'); star.textContent=fav.has(id)?'★':'☆'; star.onclick=e=>{e.stopPropagation();uxToggleSchoolFavorite(id);}; nameBtn.before(star);
    }
  });
};
window.renderSchoolManage=renderSchoolManage;

/* ---------- Employee action/detail ---------- */
function uxOpenEmployeeEntry(){ resetEmployeeForm(); const d=uxEl('employeeEntryDetails'); if(d){ d.open=true; d.scrollIntoView({behavior:'smooth',block:'start'}); setTimeout(()=>uxEl('empName')?.focus(),350); } }
function uxSaveEmployeeDetailStatus(){
  const e=employees.find(x=>x.id===employeeDetailCurrentId); if(!e) return;
  const next=uxEl('employeeDetailStatus')?.value||e.status;
  const patch={status:next,updatedAt:new Date().toISOString()};
  if(next==='퇴사'&&!e.leaveDate){const d=prompt('퇴사일을 입력하세요.',today());if(d===null)return;patch.leaveDate=d.trim();if(!patch.leaveDate){uxToast('퇴사일이 필요합니다.','warn');return;}}
  if(next==='휴직'&&!e.leaveStartDate){const d=prompt('휴직 시작일을 입력하세요.',today());if(d===null)return;patch.leaveStartDate=d.trim();if(!patch.leaveStartDate){uxToast('휴직일이 필요합니다.','warn');return;}}
  if(next==='재직중'&&e.status==='휴직'&&!e.returnDate){const d=prompt('복직일을 입력하세요.',today());if(d===null)return;patch.returnDate=d.trim();if(!patch.returnDate){uxToast('복직일이 필요합니다.','warn');return;}}
  employees=employees.map(x=>x.id===e.id?normalizeEmployee({...x,...patch}):x);
  saveEmployees();renderEmployeeDetail();uxToast(`${e.name}님의 재직상태를 ${next}(으)로 변경했습니다.`);
}
const uxBaseOpenEmployeeDetail=openEmployeeDetail;
openEmployeeDetail=function(id){ uxBaseOpenEmployeeDetail(id); const e=employees.find(x=>x.id===id); if(e&&uxEl('employeeDetailStatus')) uxEl('employeeDetailStatus').value=e.status||'재직중'; };
window.openEmployeeDetail=openEmployeeDetail;

/* ---------- Operation environment message ---------- */
function uxGetOperationEnvironment(){
  return localStorage.getItem(OPERATION_ENV_KEY)==='company'?'company':'home';
}
function uxSetOperationEnvironment(mode){
  const next=mode==='company'?'company':'home';
  if(!safeLocalStorageSet(OPERATION_ENV_KEY,next))return;
  document.dispatchEvent(new CustomEvent('erp:operation-environment-change',{detail:{mode:next}}));
  updateStorageNote();
  if(typeof window.erpHandleOperationEnvironmentChange==='function') window.erpHandleOperationEnvironmentChange(next);
  uxToast(next==='company'?'회사 운영 모드로 전환했습니다.':'이 브라우저 저장 모드로 전환했습니다.');
}
updateStorageNote=function(){
  const el=uxEl('storageNote'); if(!el) return;
  const mode=uxGetOperationEnvironment();
  const isCompany=mode==='company';
  document.documentElement.dataset.operationEnvironment=mode;
  const modeTitle='LOCAL ONLY';
  const modeDescription=isCompany?'회사 모드에서도 이 브라우저 저장만 사용합니다.':'이 브라우저 저장을 기본으로 사용합니다.';
  const statusClass='sync-local-note';
  const displayTitle=modeTitle;
  const displayDescription=modeDescription;
  const displayStatusClass=statusClass;
  el.className=`security-note operation-mode-note ${mode} ${displayStatusClass}`;
  el.setAttribute('aria-live','polite');
  el.innerHTML=`
    <div class="operation-mode-copy">
      <strong>${displayTitle}</strong>
      <span>${displayDescription}</span>
    </div>
    <div class="operation-mode-switch" role="group" aria-label="운영 환경 선택">
      <button type="button" data-operation-mode="company" class="${isCompany?'active':''}" aria-pressed="${isCompany}">회사</button>
      <button type="button" data-operation-mode="home" class="${!isCompany?'active':''}" aria-pressed="${!isCompany}">집</button>
    </div>`;
  el.querySelectorAll('[data-operation-mode]').forEach(btn=>btn.addEventListener('click',()=>uxSetOperationEnvironment(btn.dataset.operationMode)));
  const sidebarSummary=document.getElementById('sidebarStatusSummaryText');
  if(sidebarSummary)sidebarSummary.textContent=displayTitle;
  const badge=document.querySelector('.local-mode-badge');
  if(badge){
    badge.textContent='LOCAL ONLY';
    badge.title=isCompany?'회사 환경 · 로컬 전용':'이 브라우저 저장 · 로컬 전용';
    badge.classList.toggle('company',isCompany);
    badge.classList.toggle('home',!isCompany);
    badge.classList.remove('remote-ready','remote-error');
  }
};
window.updateStorageNote=updateStorageNote;
window.uxSetOperationEnvironment=uxSetOperationEnvironment;

/* ---------- Initial binding ---------- */
function uxReplaceButton(id,handler){
  const old=uxEl(id); if(!old) return null;
  const clone=old.cloneNode(true); old.replaceWith(clone); clone.addEventListener('click',handler); return clone;
}
function uxInit(){
  document.documentElement.dataset.erpVersion=UX_VERSION;
  uxConsolidateSidebarStatus();
  updateStorageNote();
  // 안전·위험 작업 화면만 명시적으로 공통 인트로 카드로 표시합니다.
  ['#dataHealth .health-hero','#duplicates .duplicate-hero','#backup .backup-center-hero','#employeeOrgImportModal .employee-org-import-notice','#hireWaitingModal .hire-waiting-guide'].forEach(selector=>document.querySelector(selector)?.classList.add('page-intro-card','safety-intro-card'));
  // Dashboard interactions
  document.addEventListener('click',e=>{
    const q=e.target.closest('[data-task-target]'); if(q) uxFocusTaskPanel(q.dataset.taskTarget);
    const d=e.target.closest('[data-dashboard-target]'); if(d){ const key=d.dataset.dashboardTarget; if(key==='applicants') setPage('applicants'); else uxOpenApplicantFilter(key); }
  });
  uxEl('btnShowAllTaskGroups')?.addEventListener('click',()=>{uxTaskShowEmpty=!uxTaskShowEmpty;renderToday();});
  // Calendar
  document.querySelectorAll('[data-calendar-view]').forEach(b=>b.addEventListener('click',()=>{uxCalendarView=b.dataset.calendarView;uxApplyCalendarView();}));
  uxEl('calendarTypeFilter')?.addEventListener('change',e=>{uxCalendarType=e.target.value;renderCalendar();});
  // Form
  const form=uxEl('applicantForm');
  if(form){
    uxSetFormBaseline(); uxUpdateFormProgress();
    form.addEventListener('input',e=>{ if(e.target.id==='phone') uxFormatPhoneInput(e.target); uxUpdateFormDirty();uxUpdateFormProgress(); if(['name','phone','email'].includes(e.target.id)) uxValidateForm(false); });
    form.addEventListener('submit',e=>{ uxSubmitSnapshot={count:applicants.length,editId:uxFieldValue('editId'),before:JSON.stringify(applicants)}; if(!uxValidateForm(true)){e.preventDefault();e.stopImmediatePropagation();uxToast('필수 입력값과 형식을 확인해주세요.','warn');} },true);
    form.addEventListener('submit',()=>setTimeout(()=>{ if(!uxSubmitSnapshot)return; if(JSON.stringify(applicants)!==uxSubmitSnapshot.before){uxToast(uxSubmitSnapshot.editId?'지원자 정보를 수정했습니다.':'새 지원자를 등록했습니다.');uxSetFormBaseline();} uxSubmitSnapshot=null; },0));
  }
  uxEl('btnResetForm')?.addEventListener('click',e=>{ if(uxFormDirty&&!confirm('입력한 내용을 모두 초기화할까요?')){e.preventDefault();e.stopImmediatePropagation();} },true);
  window.addEventListener('beforeunload',e=>{ if(uxFormDirty){e.preventDefault();e.returnValue='';} });
  // Detail actions
  uxEl('btnSaveEmployeeDetailStatus')?.addEventListener('click',uxSaveEmployeeDetailStatus);
  // Templates: replace buttons to remove old app.js listeners captured before enhancement.
  uxReplaceButton('btnMakeTemplate',()=>uxGenerateTemplate(true));
  uxReplaceButton('btnCopyTemplate',async()=>{ const text=uxEl('templateOutput')?.value||''; try{await navigator.clipboard.writeText(text);uxToast('안내문을 클립보드에 복사했습니다.');}catch{uxToast('브라우저에서 복사가 차단되었습니다.','warn');} });
  uxEl('btnClearTemplate')?.addEventListener('click',()=>{ ['templateApplicant','templateWorkplace','templateDate','templateTime','templateManager'].forEach(id=>{if(uxEl(id))uxEl(id).value='';});if(uxEl('templateOutput'))uxEl('templateOutput').value='';uxUpdateTemplateCount();});
  uxEl('btnClearTemplateHistory')?.addEventListener('click',()=>{if(confirm('최근 생성 문구 기록을 비울까요?')){localStorage.removeItem(TEMPLATE_HISTORY_KEY);uxRenderTemplateHistory();}});
  ['templateApplicant','templateType','templateWorkplace','templateDate','templateTime','templateManager'].forEach(id=>uxEl(id)?.addEventListener('change',()=>id==='templateApplicant'?uxSyncTemplateApplicant():uxGenerateTemplate(false)));
  uxEl('templateOutput')?.addEventListener('input',uxUpdateTemplateCount);
  // Employee toolbar
  uxEl('btnOpenEmployeeEntry')?.addEventListener('click',uxOpenEmployeeEntry);
  uxEl('btnTriggerEmployeeImport')?.addEventListener('click',()=>uxEl('employeeJsonImport')?.click());
  uxEl('btnEmployeeExportTop')?.addEventListener('click',()=>uxEl('btnCsvEmployees')?.click());
  // Re-render all enhanced views
  uxTemplateApplicants(); uxRenderTemplateHistory(); uxUpdateTemplateCount();
  renderStats(); renderHomeLists(); renderToday(); renderCalendar(); renderHireStats(); renderSchoolManage(); renderEmployees(); updateFormMode();
}

try{ uxInit(); }catch(err){ console.error('Recruit ERP ENV_MODE init error',err); }
})();

;

