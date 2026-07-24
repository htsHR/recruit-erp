
/* ===== CONSOLIDATED SOURCE: complete-ux-v10.37.8.js ===== */
/* Recruit ERP v10.37.6 ENV_MODE
   UI/UX enhancement layer only. Core applicant/school/employee storage schemas remain unchanged. */
(function(){
'use strict';

const UX_VERSION='10.47.1';
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
  const ids=['name','phone','applyDate','workplace','source','education','school','careerType','status','dormUse','interviewDate','hireDate','memo'];
  const filled=ids.filter(id=>uxFieldValue(id)).length;
  const pct=Math.round(filled/ids.length*100);
  if(uxEl('formProgressText')) uxEl('formProgressText').textContent=`작성 ${pct}%`;
  if(uxEl('formProgressBar')) uxEl('formProgressBar').style.width=`${pct}%`;
  document.querySelectorAll('[data-form-step]').forEach(sec=>{
    const controls=[...sec.querySelectorAll('input:not([type=hidden]),select,textarea')];
    const count=controls.filter(el=>String(el.value||'').trim()).length;
    const ratio=controls.length?count/controls.length:0;
    sec.classList.toggle('step-complete',ratio>=0.7);
  });
}

/* ---------- Status workflow ---------- */
function uxPromptStatusData(a,next){
  const patch={status:next,updatedAt:new Date().toISOString()};
  if(['면접예정','다음면접'].includes(next) && !a.interviewDate){
    const d=prompt(`${a.name||'지원자'}님의 면접 날짜를 입력하세요.\n예: 2026-07-20`,today());
    if(d===null) return null;
    if(d.trim()) patch.interviewDate=d.trim();
  }
  if(next==='입사예정' && !a.hireDate){
    const d=prompt(`${a.name||'지원자'}님의 입사 예정일을 입력하세요.\n예: 2026-07-27`,today());
    if(d===null) return null;
    if(d.trim()) patch.hireDate=d.trim();
  }
  if(['불합격','서류탈락','면접거절','면접불참','입사철회','철회','연락두절'].includes(next)){
    const reason=prompt('사유 또는 참고 메모를 입력하세요. (선택)',a.decisionReason||'');
    if(reason===null) return null;
    if(reason.trim()) patch.decisionReason=reason.trim();
  }
  return patch;
}
function uxUpdateApplicantStatus(id,status){
  const a=applicants.find(x=>x.id===id); if(!a) return;
  const next=normalizeStatus(status);
  const patch=uxPromptStatusData(a,next); if(!patch){ renderAll(); return; }
  applicants=applicants.map(x=>x.id===id?normalize({...x,...patch}):x);
  save();
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
    <button class="workflow-person-main" type="button" onclick="viewApplicant('${a.id}')">
      <span class="workflow-name-line"><strong>${esc(a.name||'이름없음')}</strong><span class="badge ${badgeClass(a.status)}">${esc(a.status)}</span></span>
      <small>${esc(a.workplace||'근무지 미입력')} · ${esc(dateText)}${needs.length?` · 확인 ${esc(needs.join('/'))}`:''}</small>
    </button>
    <div class="workflow-card-actions"><select aria-label="${esc(a.name||'지원자')} 상태 변경" onchange="updateApplicantStatus('${a.id}',this.value)">${statusOptionsHtml(a.status)}</select><button class="mini" type="button" onclick="viewApplicant('${a.id}')">상세</button></div>
  </article>`;
};
window.card=card;

/* ---------- Home ---------- */
const uxBaseRenderStats=renderStats;
renderStats=function(){
  const total=applicants.length, active=applicants.filter(isActive).length, g=taskGroups();
  if(uxEl('statsGrid')) uxEl('statsGrid').innerHTML=[['전체 지원자',total,'applicants'],['진행중',active,'active'],['오늘 면접',g.todayInterviews.length,'today'],['기한 경과',g.overdue.length,'overdue']].map(([k,v,key])=>`<button type="button" class="stat stat-button" data-dashboard-target="${key}"><span>${k}</span><strong>${v}</strong><small>목록 확인 →</small></button>`).join('');
  const map={homeTodayInterviewCount:g.todayInterviews.length,homeOverdueCount:g.overdue.length,homeContactCount:g.recalls.length,homeDecisionCount:g.decisions.length,homeHireSoonCount:g.hireSoon.length};
  Object.entries(map).forEach(([id,v])=>{ if(uxEl(id)) uxEl(id).textContent=v; });
};
window.renderStats=renderStats;

function uxOpenApplicantFilter(filter){
  resetListFiltersToAll();
  if(filter==='active') currentFilter='active';
  if(filter==='contact') currentFilter='contact';
  if(filter==='decision') currentFilter='decision';
  if(filter==='today') { currentFilter='interview'; currentSearch=today(); if(uxEl('searchInput')) uxEl('searchInput').value=today(); }
  if(filter==='overdue') { currentFilter='active'; currentSort='interviewAsc'; }
  document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.toggle('active',x.dataset.filter===currentFilter));
  setPage('applicants'); renderTable();
}
function uxFocusTaskPanel(key){
  setPage('today');
  setTimeout(()=>{
    const panel=document.querySelector(`[data-task-panel="${key}"]`);
    if(panel){ panel.classList.add('task-panel-focus'); panel.scrollIntoView({behavior:'smooth',block:'center'}); setTimeout(()=>panel.classList.remove('task-panel-focus'),1700); }
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
    const steps=['서류검토','면접예정','면접완료','입사예정','출근'];
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
  return `<button type="button" class="calendar-alt-item ${calendarTypeClass(item)}" onclick="${onclick}"><span>${esc(item.time||'시간미정')} · ${esc(item.type)}</span><strong>${esc(item.title)}</strong><small>${esc([item.workplace,item.memo].filter(Boolean).join(' · ')||'추가 정보 없음')}</small></button>`;
}
function uxRenderCalendarWeek(){
  const el=uxEl('calendarWeekGrid'); if(!el) return;
  const base=new Date((selectedCalendarDate||today())+'T00:00:00');
  const start=new Date(base); start.setDate(base.getDate()-base.getDay());
  const all=calendarAllItems();
  el.innerHTML=Array.from({length:7},(_,i)=>{
    const d=new Date(start); d.setDate(start.getDate()+i); const key=calendarDateKey(d);
    const items=all.filter(x=>x.date===key);
    return `<section class="calendar-week-day ${key===today()?'today':''}"><button type="button" class="calendar-week-date" onclick="selectCalendarDate('${key}')"><span>${['일','월','화','수','목','금','토'][d.getDay()]}</span><strong>${d.getMonth()+1}.${d.getDate()}</strong><small>${items.length}건</small></button><div>${items.length?items.map(uxCalendarItemHtml).join(''):'<span class="calendar-alt-empty">일정 없음</span>'}</div></section>`;
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
  const leadRows=scope.filter(a=>a.applyDate&&(a.hireDate||a.interviewDate)).map(a=>{
    const end=a.hireDate||a.interviewDate; const d1=new Date(a.applyDate+'T00:00:00'),d2=new Date(end+'T00:00:00'); return Math.max(0,Math.round((d2-d1)/86400000));
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
    const onclick=row.getAttribute('onclick')||''; const m=onclick.match(/openSchoolDetail\('([^']+)'\)/); if(!m) return;
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
  localStorage.setItem(OPERATION_ENV_KEY,next);
  updateStorageNote();
  if(typeof window.erpHandleOperationEnvironmentChange==='function') window.erpHandleOperationEnvironmentChange(next);
  uxToast(next==='company'?'회사 운영 모드로 전환했습니다. Supabase 연결을 중단했습니다.':'집 개발 모드로 전환했습니다. 로그인 후에만 Supabase를 사용합니다.');
}
updateStorageNote=function(){
  const el=uxEl('storageNote'); if(!el) return;
  const mode=uxGetOperationEnvironment();
  const isCompany=mode==='company';
  document.documentElement.dataset.operationEnvironment=mode;
  const cloudReady=!isCompany&&typeof canUseCloud==='function'&&canUseCloud();
  const cloudFailed=!isCompany&&typeof cloudSyncStatus!=='undefined'&&cloudSyncStatus==='error';
  const modeTitle=isCompany?'회사 · LOCAL MASTER':cloudFailed?'집 · 로컬 저장 유지':cloudReady?'집 · CLOUD SYNC':'집 · 로컬 저장';
  const modeDescription=isCompany
    ?'현재 브라우저 데이터가 업무 기준입니다. 퇴근 전 전체 JSON 백업을 확인하세요.'
    :cloudFailed
      ?'브라우저 저장은 완료됐지만 클라우드 반영에 실패했습니다. 백업센터에서 상태를 확인하세요.'
      :cloudReady
        ?'브라우저 저장 후 Supabase에도 동기화할 수 있는 상태입니다.'
        :'회사 JSON을 검사·복원한 뒤 작업하고, 로그인 전에는 브라우저에만 저장합니다.';
  el.className=`security-note operation-mode-note ${mode}${cloudFailed?' sync-warn-note':''}`;
  el.innerHTML=`
    <div class="operation-mode-copy">
      <strong>${modeTitle}</strong>
      <span>${modeDescription}</span>
    </div>
    <div class="operation-mode-switch" role="group" aria-label="운영 환경 선택">
      <button type="button" data-operation-mode="company" class="${isCompany?'active':''}" aria-pressed="${isCompany}">회사</button>
      <button type="button" data-operation-mode="home" class="${!isCompany?'active':''}" aria-pressed="${!isCompany}">집</button>
    </div>`;
  el.querySelectorAll('[data-operation-mode]').forEach(btn=>btn.addEventListener('click',()=>uxSetOperationEnvironment(btn.dataset.operationMode)));
  const badge=document.querySelector('.local-mode-badge');
  if(badge){
    badge.textContent=isCompany?'회사 · LOCAL MASTER':cloudFailed?'집 · CLOUD ERROR':cloudReady?'집 · CLOUD SYNC':'집 · LOCAL';
    badge.title=modeDescription;
    badge.classList.toggle('company',isCompany);
    badge.classList.toggle('home',!isCompany);
    badge.classList.toggle('cloud-ready',cloudReady);
    badge.classList.toggle('cloud-error',cloudFailed);
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
  updateStorageNote();
  // Suppress nonfunctional utility icons in this local-first UI build.
  document.querySelectorAll('.topbar-icon-btn').forEach(x=>x.style.display='none');
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

