
/* ===== CONSOLIDATED SOURCE: complete-ux-v10.37.8.js ===== */
/* Recruit ERP v10.37.6 ENV_MODE
   UI/UX enhancement layer only. Core applicant/school/employee storage schemas remain unchanged. */
(function(){
'use strict';

const UX_VERSION='10.37.5';
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
  if(['불합격','서류탈락','철회','연락두절'].includes(next)){
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
  if(['미연락','부재중'].includes(a.status)) needs.push('연락');
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
resetForm=function(){ uxBaseResetForm(); setTimeout(()=>{uxSetFormBaseline();uxUpdateFormProgress();},0); };
window.resetForm=resetForm;

const uxBaseSetPage=setPage;
setPage=function(page){
  const active=document.querySelector('.page.active')?.id;
  if(active==='form' && page!=='form' && uxFormDirty){
    if(!confirm('저장하지 않은 입력 내용이 있습니다.\n페이지를 이동할까요?')) return;
    uxFormDirty=false;
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
    const steps=['미연락','면접예정','면접완료','입사예정','출근'];
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
  closeDetail(); setPage('templates');
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
    const issues=uxSchoolIssues(s);
    let issueWrap=nameCell.querySelector('.school-issue-tags');
    if(!issueWrap){ issueWrap=document.createElement('div'); issueWrap.className='school-issue-tags'; nameCell.appendChild(issueWrap); }
    issueWrap.innerHTML=issues.slice(0,3).map(x=>`<span>${esc(x)}</span>`).join('');
    if(issues.length>3) issueWrap.innerHTML+=`<span>+${issues.length-3}</span>`;
  });
};
window.renderSchoolManage=renderSchoolManage;

/* ---------- Employee action/detail ---------- */
function uxOpenEmployeeEntry(){ const d=uxEl('employeeEntryDetails'); if(d){ d.open=true; d.scrollIntoView({behavior:'smooth',block:'start'}); setTimeout(()=>uxEl('empName')?.focus(),350); } }
function uxSaveEmployeeDetailStatus(){
  const e=employees.find(x=>x.id===employeeDetailCurrentId); if(!e) return;
  const next=uxEl('employeeDetailStatus')?.value||e.status; const patch={status:next,updatedAt:new Date().toISOString()};
  if(next==='퇴사'&&!e.leaveDate){ const d=prompt('퇴사일을 입력하세요.',today()); if(d===null)return; patch.leaveDate=d.trim(); }
  employees=employees.map(x=>x.id===e.id?normalizeEmployee({...x,...patch}):x); saveEmployees(); renderEmployeeDetail(); uxToast(`${e.name}님의 재직상태를 ${next}(으)로 변경했습니다.`);
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
  el.className=`security-note operation-mode-note ${mode}`;
  el.innerHTML=`
    <div class="operation-mode-copy">
      <strong>${isCompany?'회사 로컬 운영 모드':'집 개발·복원 모드'}</strong>
      <span>${isCompany?'현재 브라우저의 데이터가 업무 기준입니다. 퇴근 전 JSON 백업을 확인하세요.':'회사 JSON을 불러온 뒤 개발하고, 작업 완료본을 JSON으로 백업하세요.'}</span>
    </div>
    <div class="operation-mode-switch" role="group" aria-label="운영 환경 선택">
      <button type="button" data-operation-mode="company" class="${isCompany?'active':''}" aria-pressed="${isCompany}">회사</button>
      <button type="button" data-operation-mode="home" class="${!isCompany?'active':''}" aria-pressed="${!isCompany}">집</button>
    </div>`;
  el.querySelectorAll('[data-operation-mode]').forEach(btn=>btn.addEventListener('click',()=>uxSetOperationEnvironment(btn.dataset.operationMode)));
  const badge=document.querySelector('.local-mode-badge');
  if(badge){
    badge.textContent=isCompany?'COMPANY MASTER':'HOME DEV';
    badge.title=isCompany?'회사 브라우저의 로컬 데이터를 업무 기준으로 사용합니다.':'집에서 회사 JSON을 복원하고 개발하는 환경입니다.';
    badge.classList.toggle('company',isCompany);
    badge.classList.toggle('home',!isCompany);
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

/* ===== CONSOLIDATED SOURCE: backup-center-v10.38.0.js ===== */
/* Recruit ERP v10.38.0 BACKUP_CENTER
 * localStorage Master 환경용 전체/부분 백업, 검사, 비교, 병합, 전체교체, 전체복원
 * 기존 핵심 저장키와 데이터 필드 구조는 변경하지 않습니다.
 */
(function(){
  'use strict';
  const BC_VERSION='10.38.0';
  const BC_FORMAT='recruit-erp-backup';
  const BC_SCHEMA=1;
  const BC_LAST_FULL_KEY='recruit_erp_last_full_backup_at';
  const BC_HISTORY_KEY='recruit_erp_backup_center_history';
  const BC_MAX_FILE_BYTES=50*1024*1024;
  const DATASETS=[
    {key:'applicants',label:'지원자',storage:'recruit_erp_applicants_stable'},
    {key:'schools',label:'협력학교',storage:'recruit_erp_schools'},
    {key:'employees',label:'사원명부',storage:'recruit_erp_employees'},
    {key:'calendarEvents',label:'수동 일정',storage:'recruit_erp_calendar_events'}
  ];
  let inspected=null;
  const bcEl=id=>document.getElementById(id);
  const safeText=v=>String(v==null?'':v);
  const escHtml=v=>safeText(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const localIso=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().replace('T','_').replace(/:/g,'-').slice(0,19);};
  const formatDate=v=>{if(!v)return '기록 없음';const d=new Date(v);return Number.isNaN(d.getTime())?safeText(v):d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
  const formatBytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  function environment(){
    try{return typeof uxGetOperationEnvironment==='function'?uxGetOperationEnvironment():(localStorage.getItem('recruit_erp_ui_operation_environment')==='company'?'company':'home');}
    catch{return 'home';}
  }
  function environmentLabel(mode){return mode==='company'?'회사 로컬 운영':'집 개발·복원';}
  function isHomeMode(){return environment()!=='company';}
  function assertHomeImport(){if(isHomeMode())return true;alert('회사 모드에서는 JSON 업로드·병합·전체교체·복원을 사용할 수 없습니다. 집 모드에서 진행하세요.');return false;}
  function currentData(){return {applicants:Array.isArray(applicants)?applicants:[],schools:Array.isArray(schools)?schools:[],employees:Array.isArray(employees)?employees:[],calendarEvents:Array.isArray(calendarEvents)?calendarEvents:[]};}
  function countsOf(data){const out={};DATASETS.forEach(d=>out[d.key]=Array.isArray(data[d.key])?data[d.key].length:0);return out;}
  function deepClone(v){return JSON.parse(JSON.stringify(v));}
  function downloadFile(name,content,mime='application/json'){
    const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function packageFor(keys,reason='manual'){
    const all=currentData();const data={};keys.forEach(k=>data[k]=deepClone(all[k]||[]));
    return {format:BC_FORMAT,schemaVersion:BC_SCHEMA,appVersion:BC_VERSION,backupType:keys.length===DATASETS.length?'full':keys[0],createdAt:new Date().toISOString(),environment:environment(),environmentLabel:environmentLabel(environment()),reason,counts:countsOf(data),data};
  }
  function fileName(type,prefix='recruit_erp'){
    const names={full:'full_backup',applicants:'applicants',schools:'schools',employees:'employees',calendarEvents:'manual_calendar'};
    return `${prefix}_${names[type]||type}_${localIso()}.json`;
  }
  function recordHistory(action,detail){
    let list=[];try{list=JSON.parse(localStorage.getItem(BC_HISTORY_KEY)||'[]');if(!Array.isArray(list))list=[];}catch{list=[];}
    list.unshift({at:new Date().toISOString(),action,detail});localStorage.setItem(BC_HISTORY_KEY,JSON.stringify(list.slice(0,12)));renderHistory();
  }
  function exportBackup(type,reason='manual'){
    const keys=type==='full'?DATASETS.map(d=>d.key):[type];
    const pack=packageFor(keys,reason);downloadFile(fileName(type),JSON.stringify(pack,null,2));
    if(type==='full'){
      localStorage.setItem(BC_LAST_FULL_KEY,pack.createdAt);
      localStorage.setItem('recruit_erp_last_backup_date',pack.createdAt.slice(0,10));
    }
    recordHistory(type==='full'?'ERP 전체 백업':`${DATASETS.find(d=>d.key===type)?.label||type} 백업`,`${keys.map(k=>`${DATASETS.find(d=>d.key===k).label} ${pack.counts[k]}건`).join(' · ')} · ${environmentLabel(pack.environment)}`);
    refreshCounts();
    if(typeof uxToast==='function')uxToast(type==='full'?'ERP 전체 백업을 다운로드했습니다.':'선택 데이터를 백업했습니다.');
  }
  function backupCurrentBeforeChange(reason){
    const pack=packageFor(DATASETS.map(d=>d.key),reason);downloadFile(`recruit_erp_safety_before_${localIso()}.json`,JSON.stringify(pack,null,2));
    recordHistory('안전 백업 자동 생성',reason);
  }
  function detectLegacyArray(arr){
    const sample=arr.find(x=>x&&typeof x==='object')||{};
    if('empNo'in sample||'department'in sample||'leaveDate'in sample)return 'employees';
    if('title'in sample&&'date'in sample&&('importance'in sample||'type'in sample))return 'calendarEvents';
    if('aliases'in sample||'managementStatus'in sample||'mouDate'in sample||'contactPhone'in sample)return 'schools';
    return 'applicants';
  }
  function canonicalize(parsed){
    const warnings=[];let data={};let meta={};let included=[];let legacy=false;
    if(Array.isArray(parsed)){
      legacy=true;const key=detectLegacyArray(parsed);data[key]=parsed;included=[key];warnings.push(`구형 배열 JSON으로 감지했습니다. ${DATASETS.find(d=>d.key===key).label} 데이터로 검사합니다.`);
      meta={format:'legacy-array',schemaVersion:0,appVersion:'확인 불가',backupType:key,createdAt:'',environment:'unknown'};
    }else if(parsed&&typeof parsed==='object'){
      if(parsed.format===BC_FORMAT&&parsed.data&&typeof parsed.data==='object'){
        meta={format:parsed.format,schemaVersion:parsed.schemaVersion||0,appVersion:parsed.appVersion||'확인 불가',backupType:parsed.backupType||'unknown',createdAt:parsed.createdAt||'',environment:parsed.environment||'unknown'};
        DATASETS.forEach(d=>{if(Object.prototype.hasOwnProperty.call(parsed.data,d.key)){data[d.key]=parsed.data[d.key];included.push(d.key);}});
      }else{
        legacy=true;meta={format:'legacy-object',schemaVersion:0,appVersion:parsed.appVersion||parsed.version||'확인 불가',backupType:'legacy',createdAt:parsed.createdAt||parsed.exportedAt||parsed.backupDate||'',environment:parsed.environment||'unknown'};
        DATASETS.forEach(d=>{if(Object.prototype.hasOwnProperty.call(parsed,d.key)){data[d.key]=parsed[d.key];included.push(d.key);}});
        if(!included.length&&Array.isArray(parsed.rows)){data.applicants=parsed.rows;included=['applicants'];}
        warnings.push('구형 객체 JSON으로 감지했습니다. 포함된 데이터만 가져올 수 있습니다.');
      }
    }else throw new Error('JSON 최상위 형식이 올바르지 않습니다.');
    if(!included.length)throw new Error('지원자·협력학교·사원명부·수동 일정 데이터를 찾지 못했습니다.');
    included.forEach(k=>{if(!Array.isArray(data[k]))throw new Error(`${DATASETS.find(d=>d.key===k).label} 데이터가 배열 형식이 아닙니다.`);});
    const invalid={};included.forEach(k=>{invalid[k]=data[k].filter(x=>!x||typeof x!=='object'||Array.isArray(x)).length;if(invalid[k])warnings.push(`${DATASETS.find(d=>d.key===k).label}에 객체가 아닌 항목 ${invalid[k]}건이 있습니다.`);});
    const full=DATASETS.every(d=>included.includes(d.key));
    if(meta.schemaVersion>BC_SCHEMA)warnings.push('현재 프로그램보다 새로운 백업 스키마입니다. 적용 전 내용을 확인하세요.');
    return {meta,data,included,warnings,invalid,full,legacy,counts:countsOf(data)};
  }
  function comparisonRows(canon){
    const cur=countsOf(currentData());
    return DATASETS.map(d=>{const has=canon.included.includes(d.key);const next=has?canon.counts[d.key]:null;const delta=has?next-cur[d.key]:null;return {key:d.key,label:d.label,current:cur[d.key],next,delta,has};});
  }
  function deltaText(row){if(!row.has)return '<span class="backup-not-included">파일에 없음</span>';if(row.delta===0)return '변동 없음';return `<span class="backup-delta ${row.delta>0?'up':'down'}">${row.delta>0?'+':''}${row.delta}건</span>`;}
  function renderInspection(){
    const box=bcEl('bcInspection');if(!box)return;
    if(!inspected){box.classList.remove('visible');box.innerHTML='';return;}
    const c=inspected.canonical;const invalidTotal=Object.values(c.invalid).reduce((a,b)=>a+b,0);const valid=!invalidTotal;
    const warnings=c.warnings.length?c.warnings.join(' '):'백업 파일의 기본 구조와 배열 형식을 확인했습니다.';
    const rows=comparisonRows(c);
    box.innerHTML=`
      <div class="backup-file-summary">
        <div class="backup-file-meta"><span>파일명</span><strong>${escHtml(inspected.file.name)}</strong></div>
        <div class="backup-file-meta"><span>파일 크기</span><strong>${formatBytes(inspected.file.size)}</strong></div>
        <div class="backup-file-meta"><span>백업 버전</span><strong>${escHtml(c.meta.appVersion)}</strong></div>
        <div class="backup-file-meta"><span>백업 일시</span><strong>${escHtml(formatDate(c.meta.createdAt))}</strong></div>
        <div class="backup-file-meta"><span>생성 환경</span><strong>${escHtml(c.meta.environment==='company'?'회사':c.meta.environment==='home'?'집':'확인 불가')}</strong></div>
      </div>
      <div class="backup-validation-banner ${valid?(c.warnings.length?'warn':'ok'):'error'}"><strong>${valid?'파일 검사 완료':'파일 검사 경고'}</strong><br>${escHtml(warnings)}</div>
      <div class="backup-compare-wrap"><table class="backup-compare-table"><thead><tr><th>데이터</th><th>현재 브라우저</th><th>백업 파일</th><th>차이</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r.label}</strong></td><td>${r.current}건</td><td>${r.has?`${r.next}건`:'—'}</td><td>${deltaText(r)}</td></tr>`).join('')}</tbody></table></div>
      <div class="backup-action-bar">
        <button class="primary" id="bcMergeApply" type="button" ${valid?'':'disabled'}>데이터 병합 가져오기</button>
        <button class="ghost" id="bcReplaceApply" type="button" ${valid?'':'disabled'}>포함 데이터 전체교체</button>
        <button class="danger" id="bcFullRestore" type="button" ${valid&&c.full?'':'disabled'}>전체 ERP 복원</button>
        <button class="mini" id="bcClearInspection" type="button">파일 선택 취소</button>
      </div>
      <p class="backup-danger-note">병합은 기존 데이터를 보존하면서 같은 ID의 최근 수정본을 반영합니다. 전체교체는 파일에 포함된 항목을 현재 브라우저 데이터와 바꿉니다. 전체 ERP 복원은 네 종류의 데이터가 모두 포함된 파일에서만 사용할 수 있습니다.</p>`;
    box.classList.add('visible');
    bcEl('bcMergeApply')?.addEventListener('click',()=>applyImport('merge'));
    bcEl('bcReplaceApply')?.addEventListener('click',()=>applyImport('replace'));
    bcEl('bcFullRestore')?.addEventListener('click',()=>applyImport('restore'));
    bcEl('bcClearInspection')?.addEventListener('click',clearInspection);
  }
  function mergeObjects(existing,incoming){
    const out={...existing};Object.keys(incoming||{}).forEach(k=>{const v=incoming[k];if(v!==''&&v!==null&&v!==undefined)out[k]=v;});return out;
  }
  function newer(existing,incoming){const a=safeText(existing.updatedAt||existing.createdAt);const b=safeText(incoming.updatedAt||incoming.createdAt);return b&&(!a||b>=a);}
  function mergeDataset(key,current,incoming){
    const result=current.map(x=>deepClone(x));const index=new Map();
    result.forEach((row,i)=>{let id=safeText(row.id);if(key==='schools'&&!id)id=`name:${safeText(row.name).trim().toLowerCase()}`;if(key==='employees'&&!id)id=`emp:${safeText(row.empNo).trim()}`;if(id)index.set(id,i);});
    let added=0,updated=0,kept=0;
    incoming.forEach(raw=>{
      let row=deepClone(raw);let id=safeText(row.id);if(key==='schools'&&!id)id=`name:${safeText(row.name).trim().toLowerCase()}`;if(key==='employees'&&!id)id=`emp:${safeText(row.empNo).trim()}`;
      const idx=id?index.get(id):undefined;
      if(idx===undefined){result.push(row);if(id)index.set(id,result.length-1);added++;return;}
      const old=result[idx];
      if(key==='schools'){
        const merged=mergeObjects(old,row);merged.aliases=Array.from(new Set([...(Array.isArray(old.aliases)?old.aliases:[]),...(Array.isArray(row.aliases)?row.aliases:[])]));result[idx]=merged;updated++;
      }else if(newer(old,row)){result[idx]=mergeObjects(old,row);updated++;}else kept++;
    });
    return {rows:result,added,updated,kept};
  }
  function normalizeRows(key,rows){
    const valid=rows.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
    if(key==='applicants')return valid.map(normalize);
    if(key==='schools')return valid.map(normalizeSchool).filter(x=>x.name);
    if(key==='employees')return valid.map(normalizeEmployee).filter(x=>x.name||x.empNo);
    if(key==='calendarEvents')return valid.map(normalizeCalendarEvent).filter(x=>x.title&&x.date);
    return valid;
  }
  function writeDatasets(next){
    if(Object.prototype.hasOwnProperty.call(next,'applicants')){applicants=normalizeRows('applicants',next.applicants);localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(applicants));}
    if(Object.prototype.hasOwnProperty.call(next,'schools')){schools=normalizeRows('schools',next.schools);localStorage.setItem('recruit_erp_schools',JSON.stringify(schools));}
    if(Object.prototype.hasOwnProperty.call(next,'employees')){employees=normalizeRows('employees',next.employees);localStorage.setItem('recruit_erp_employees',JSON.stringify(employees));}
    if(Object.prototype.hasOwnProperty.call(next,'calendarEvents')){calendarEvents=normalizeRows('calendarEvents',next.calendarEvents);localStorage.setItem('recruit_erp_calendar_events',JSON.stringify(calendarEvents));}
    if(typeof renderAll==='function')renderAll();
    if(typeof updateStorageNote==='function')updateStorageNote();
    refreshCounts();
  }
  function applyImport(mode){
    if(!assertHomeImport())return;
    if(!inspected)return;const c=inspected.canonical;
    if(mode==='restore'&&!c.full){alert('전체 ERP 복원은 지원자·협력학교·사원명부·수동 일정이 모두 포함된 백업만 가능합니다.');return;}
    const current=countsOf(currentData());const incoming=c.counts;
    if(mode==='merge'){
      const summary=c.included.map(k=>`${DATASETS.find(d=>d.key===k).label}: 현재 ${current[k]}건 + 파일 ${incoming[k]}건`).join('\n');
      if(!confirm(`데이터 병합 가져오기 전 확인\n\n${summary}\n\n기존 데이터는 지우지 않고 같은 ID는 최근 수정본을 반영합니다. 진행할까요?`))return;
      backupCurrentBeforeChange('병합 가져오기 직전');
      const next={};const results=[];const now=currentData();
      c.included.forEach(k=>{const merged=mergeDataset(k,now[k]||[],normalizeRows(k,c.data[k]));next[k]=merged.rows;results.push(`${DATASETS.find(d=>d.key===k).label}: 신규 ${merged.added} · 갱신 ${merged.updated} · 유지 ${merged.kept}`);});
      writeDatasets(next);recordHistory('데이터 병합 가져오기',results.join(' / '));alert(`병합 완료\n\n${results.join('\n')}`);
    }else{
      const isRestore=mode==='restore';const title=isRestore?'전체 ERP 복원':'포함 데이터 전체교체';const phrase=isRestore?'전체복원':'전체교체';
      const targets=(isRestore?DATASETS.map(d=>d.key):c.included).map(k=>`${DATASETS.find(d=>d.key===k).label}: ${current[k]}건 → ${incoming[k]}건`).join('\n');
      if(!confirm(`${title} 전 확인\n\n${targets}\n\n작업 직전에 현재 ERP 전체 안전 백업이 자동 다운로드됩니다.`))return;
      const typed=prompt(`정말 진행하려면 아래 문구를 그대로 입력하세요.\n\n${phrase}`);if(typed!==phrase){alert('작업이 취소되었습니다.');return;}
      backupCurrentBeforeChange(`${title} 직전`);
      const next={};(isRestore?DATASETS.map(d=>d.key):c.included).forEach(k=>next[k]=c.data[k]||[]);
      writeDatasets(next);recordHistory(title,targets.replace(/\n/g,' / '));alert(`${title}이 완료되었습니다.`);
    }
    renderInspection();
  }
  async function inspectFile(file){
    if(!assertHomeImport()){const input=bcEl('bcFileInput');if(input)input.value='';return;}
    clearInspection(false);
    if(!file)return;if(file.size>BC_MAX_FILE_BYTES){alert('백업 파일이 50MB를 초과합니다. 파일을 다시 확인해주세요.');return;}
    try{const text=await file.text();const parsed=JSON.parse(text);const canonical=canonicalize(parsed);inspected={file,parsed,canonical};renderInspection();recordHistory('백업 파일 검사',`${file.name} · ${canonical.included.map(k=>DATASETS.find(d=>d.key===k).label).join(', ')}`);}
    catch(err){inspected=null;renderInspection();alert(`백업 파일 검사 실패\n\n${err.message||err}`);}
  }
  function clearInspection(resetInput=true){inspected=null;renderInspection();if(resetInput&&bcEl('bcFileInput'))bcEl('bcFileInput').value='';}
  function applyEnvironmentUi(){
    const home=isHomeMode();
    const importSection=bcEl('bcHomeImportSection');
    const companySection=bcEl('bcCompanySection');
    const notice=bcEl('bcModeNotice');
    if(importSection){importSection.hidden=!home;importSection.setAttribute('aria-hidden',String(!home));}
    if(companySection)companySection.classList.toggle('backup-company-active',!home);
    if(notice){
      notice.className=`backup-mode-notice ${home?'home':'company'}`;
      notice.innerHTML=home
        ? '<strong>집 개발·복원 모드</strong><span>회사에서 내려받은 JSON을 검사한 뒤 병합 또는 전체교체하고, 완료 후 Supabase 저장 상태를 확인하세요.</span>'
        : '<strong>회사 로컬 운영 모드</strong><span>퇴근 전 ERP 전체 JSON을 다운로드하세요. 회사에서는 JSON 업로드·복원 기능이 숨겨집니다.</span>';
    }
    if(!home)clearInspection();
  }
  function refreshCounts(){
    applyEnvironmentUi();
    const c=countsOf(currentData());const map={applicants:'bcCurrentApplicants',schools:'bcCurrentSchools',employees:'bcCurrentEmployees',calendarEvents:'bcCurrentEvents'};
    Object.keys(map).forEach(k=>{const el=bcEl(map[k]);if(el)el.textContent=`${c[k].toLocaleString()}건`;});
    const env=bcEl('bcCurrentEnvironment');if(env)env.textContent=environment()==='company'?'회사 모드':'집 모드';
    const last=bcEl('bcLastFullBackup');if(last)last.textContent=formatDate(localStorage.getItem(BC_LAST_FULL_KEY));
  }
  function renderHistory(){
    const el=bcEl('bcHistoryList');if(!el)return;let list=[];try{list=JSON.parse(localStorage.getItem(BC_HISTORY_KEY)||'[]');}catch{}
    if(!Array.isArray(list)||!list.length){el.innerHTML='<div class="backup-empty">이 브라우저의 백업센터 작업 기록이 아직 없습니다.</div>';return;}
    el.innerHTML=list.slice(0,8).map(x=>`<div class="backup-history-row"><time>${escHtml(formatDate(x.at))}</time><strong>${escHtml(x.action)}</strong><span>${escHtml(x.detail||'')}</span></div>`).join('');
  }
  function bind(){
    bcEl('bcExportFull')?.addEventListener('click',()=>exportBackup('full'));
    DATASETS.forEach(d=>bcEl(`bcExport-${d.key}`)?.addEventListener('click',()=>exportBackup(d.key)));
    bcEl('bcFileInput')?.addEventListener('change',e=>inspectFile(e.target.files&&e.target.files[0]));
    const zone=bcEl('bcDropZone');if(zone){['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('dragover');}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('dragover');}));zone.addEventListener('drop',e=>inspectFile(e.dataTransfer.files&&e.dataTransfer.files[0]));}
    document.addEventListener('click',e=>{if(e.target.closest('[data-page="backup"], [data-go="backup"], [data-operation-mode]'))setTimeout(()=>{refreshCounts();renderHistory();},0);});
    window.addEventListener('storage',()=>{refreshCounts();renderHistory();});
  }
  function init(){document.documentElement.dataset.erpVersion=BC_VERSION;refreshCounts();renderHistory();bind();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.erpBackupCenter={exportFull:()=>exportBackup('full'),inspectFile,version:BC_VERSION};
})();

;

/* ===== CONSOLIDATED SOURCE: data-health-v10.38.2.js ===== */
(function(){
'use strict';
const REVIEW_KEY='recruit_erp_duplicate_review_v10_38_2';
let healthIssues=[];
let duplicateGroups=[];
let healthSeverity='all';
let duplicateType='all';

function byId(id){ return document.getElementById(id); }
function safe(v){ return String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function compact(v){ return String(v||'').trim().toLowerCase().replace(/[\s\-_.·(),]/g,''); }
function digits(v){ return String(v||'').replace(/\D/g,''); }
function personName(v){ return compact(v).replace(/님$/,''); }
function dateValue(v){ const d=new Date(String(v||'')+'T00:00:00'); return Number.isNaN(d.getTime())?null:d; }
function daysFromToday(v){ const d=dateValue(v); if(!d)return null; const now=dateValue(new Date().toISOString().slice(0,10)); return Math.round((now-d)/86400000); }
function appLabel(a){ return (a.name||'이름 없음')+(a.workplace?' · '+a.workplace:''); }
function getReviews(){ try{return JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}')||{};}catch{return{};} }
function saveReviews(v){ localStorage.setItem(REVIEW_KEY,JSON.stringify(v)); }
function schoolById(id){ return (schools||[]).find(s=>String(s.id)===String(id)); }
function findSchoolByText(text){ const t=compact(text); if(!t)return null; return (schools||[]).find(s=>compact(s.name)===t||(s.aliases||[]).some(a=>compact(a)===t)); }
function addIssue(severity,type,title,detail,entity,entityType,extra){ healthIssues.push({id:type+'-'+(entity?.id||Math.random()),severity,type,title,detail,entity,entityType,extra:extra||{}}); }

function buildHealthIssues(){
  healthIssues=[];
  const staleDays=parseInt(byId('healthStaleDays')?.value||'30',10);
  const interviewStatuses=['면접예정','면접완료','다음면접'];
  const hireStatuses=['입사예정','출근'];
  const pendingStatuses=['미연락','부재중','면접예정','면접완료','다음면접'];
  const dupMembership=new Map();
  buildDuplicateGroups().forEach(g=>g.members.forEach(a=>dupMembership.set(a.id,true)));

  (applicants||[]).forEach(a=>{
    if(!String(a.phone||'').trim()) addIssue('error','missing-phone','연락처 누락',`${appLabel(a)}의 연락처가 비어 있습니다.`,a,'applicant');
    if(interviewStatuses.includes(a.status)&&!a.interviewDate) addIssue('error','missing-interview-date','면접일 누락',`${a.status} 상태이지만 면접일이 없습니다.`,a,'applicant');
    if(hireStatuses.includes(a.status)&&!a.hireDate) addIssue('error','missing-hire-date','입사일 누락',`${a.status} 상태이지만 입사일이 없습니다.`,a,'applicant');
    const ad=dateValue(a.applyDate), id=dateValue(a.interviewDate), hd=dateValue(a.hireDate);
    if(ad&&id&&id<ad) addIssue('error','date-order','상태·날짜 불일치','면접일이 지원일보다 빠릅니다.',a,'applicant');
    if(ad&&hd&&hd<ad) addIssue('error','date-order','상태·날짜 불일치','입사일이 지원일보다 빠릅니다.',a,'applicant');
    if(id&&hd&&hd<id) addIssue('error','date-order','상태·날짜 불일치','입사일이 면접일보다 빠릅니다.',a,'applicant');
    if(['미연락','부재중','서류탈락','불합격','철회','연락두절'].includes(a.status)&&(a.interviewDate||a.hireDate)) addIssue('warning','status-date','상태·날짜 불일치',`${a.status} 상태인데 면접일 또는 입사일이 입력돼 있습니다.`,a,'applicant');
    if(a.school){
      const linked=schoolById(a.schoolId), matched=findSchoolByText(a.school);
      if(a.schoolId&&!linked) addIssue('warning','school-link','학교명 표기 불일치',`연결된 schoolId가 학교 명부에 없습니다: ${a.school}`,a,'applicant');
      else if(linked&&compact(linked.name)!==compact(a.school)&&!(linked.aliases||[]).some(x=>compact(x)===compact(a.school))) addIssue('warning','school-name','학교명 표기 불일치',`지원자 표기 “${a.school}”와 연결 학교 “${linked.name}”가 다릅니다.`,a,'applicant');
      else if(!linked&&!matched) addIssue('review','school-unmatched','학교명 표기 불일치',`“${a.school}”이 협력학교 명부와 연결되지 않았습니다.`,a,'applicant');
    }
    if(dupMembership.has(a.id)) addIssue('review','duplicate','중복 지원자 후보','중복 지원자 관리에서 비교가 필요합니다.',a,'applicant');
    const age=daysFromToday(a.applyDate||a.createdAt?.slice(0,10));
    if(pendingStatuses.includes(a.status)&&age!==null&&age>=staleDays) addIssue('warning','stale','오래된 미처리 지원자',`지원 후 ${age}일이 지났지만 상태가 ${a.status}입니다.`,a,'applicant',{age});
  });

  const employeesById=new Map((employees||[]).map(e=>[String(e.id),e]));
  const activeHireApps=(applicants||[]).filter(a=>a.status==='출근'||(a.hireDate&&['입사예정','출근'].includes(a.status)));
  activeHireApps.forEach(a=>{
    const linked=a.employeeId?employeesById.get(String(a.employeeId)):null;
    const same=(employees||[]).find(e=>personName(e.name)===personName(a.name)&&(!a.hireDate||!e.hireDate||a.hireDate===e.hireDate));
    if(!linked&&!same) addIssue('warning','employee-missing','사원명부와 입사자 불일치','입사 또는 출근 처리됐지만 사원명부에서 일치하는 직원을 찾지 못했습니다.',a,'applicant');
  });
  (employees||[]).filter(e=>e.status!=='퇴사').forEach(e=>{
    const linked=(applicants||[]).find(a=>String(a.employeeId||'')===String(e.id)||personName(a.name)===personName(e.name));
    if(!linked) addIssue('review','applicant-missing','사원명부와 입사자 불일치','재직·입사예정 직원이지만 지원자 기록을 찾지 못했습니다.',e,'employee');
  });
  return healthIssues;
}

function pairScore(a,b){
  const sameName=personName(a.name)&&personName(a.name)===personName(b.name);
  const pa=digits(a.phone), pb=digits(b.phone), samePhone=pa&&pb&&pa===pb;
  const sameBirth=compact(a.birthYear)&&compact(a.birthYear)===compact(b.birthYear);
  let score=0,reasons=[],type='reapply';
  if(sameName&&samePhone){score+=100;reasons.push('이름+연락처 동일');type='exact';}
  else if(samePhone){score+=80;reasons.push('연락처 동일');type='phone';}
  if(sameName&&sameBirth){score+=70;reasons.push('이름+생년 동일');if(type==='reapply')type='birth';}
  if(sameName&&a.workplace&&b.workplace&&a.workplace!==b.workplace){score+=25;reasons.push('다른 근무지 재지원');if(score<70)type='reapply';}
  if(sameName&&a.applyDate&&b.applyDate&&a.applyDate!==b.applyDate){score+=15;reasons.push('지원일이 다른 재지원');}
  const former=(employees||[]).some(e=>e.status==='퇴사'&&personName(e.name)===personName(a.name));
  if(sameName&&former){score+=30;reasons.push('퇴사자 재지원 가능성');type='former';}
  return {score,reasons:[...new Set(reasons)],type};
}
function buildDuplicateGroups(){
  const list=applicants||[], pairs=[];
  for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){
    const p=pairScore(list[i],list[j]);
    if(p.score>=40) pairs.push({a:list[i],b:list[j],...p});
  }
  const parent=new Map();
  function find(x){if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,find(parent.get(x)));return parent.get(x);}
  function union(a,b){const x=find(a),y=find(b);if(x!==y)parent.set(y,x);}
  pairs.forEach(p=>union(p.a.id,p.b.id));
  const groups=new Map();
  pairs.forEach(p=>{const root=find(p.a.id);if(!groups.has(root))groups.set(root,{members:new Map(),reasons:new Set(),score:0,types:new Set()});const g=groups.get(root);g.members.set(p.a.id,p.a);g.members.set(p.b.id,p.b);p.reasons.forEach(r=>g.reasons.add(r));g.score=Math.max(g.score,p.score);g.types.add(p.type);});
  duplicateGroups=[...groups.values()].map((g,idx)=>({id:[...g.members.keys()].sort().join('|'),members:[...g.members.values()].sort((a,b)=>String(b.applyDate||b.createdAt).localeCompare(String(a.applyDate||a.createdAt))),reasons:[...g.reasons],score:g.score,type:g.types.has('exact')?'exact':g.types.has('phone')?'phone':g.types.has('birth')?'birth':g.types.has('former')?'former':'reapply'})).sort((a,b)=>b.score-a.score);
  return duplicateGroups;
}

function severityLabel(v){return v==='error'?'오류':v==='warning'?'주의':'확인 필요';}
function renderHealth(){
  buildHealthIssues();
  const counts={error:0,warning:0,review:0};healthIssues.forEach(x=>counts[x.severity]++);
  const unique=new Set(healthIssues.map(x=>x.entityType+':'+x.entity?.id)).size;
  byId('healthKpiGrid').innerHTML=`<article><span>전체 문제</span><strong>${healthIssues.length}</strong></article><article class="error"><span>오류</span><strong>${counts.error}</strong></article><article class="warning"><span>주의</span><strong>${counts.warning}</strong></article><article class="review"><span>확인 필요</span><strong>${counts.review}</strong></article><article><span>영향 데이터</span><strong>${unique}</strong></article>`;
  const q=compact(byId('healthSearch')?.value); const filtered=healthIssues.filter(x=>(healthSeverity==='all'||x.severity===healthSeverity)&&(!q||compact(x.title+x.detail+x.entity?.name+x.entity?.school).includes(q)));
  byId('healthSummary').textContent=`총 ${healthIssues.length}건 중 ${filtered.length}건 표시 · 자동 수정 없음`;
  byId('healthIssueList').innerHTML=filtered.length?filtered.map(x=>`<article class="health-issue ${x.severity}"><div class="issue-severity">${severityLabel(x.severity)}</div><div class="issue-copy"><h4>${safe(x.title)}</h4><p>${safe(x.detail)}</p><small>${safe(x.entityType==='employee'?'사원':'지원자')} · ${safe(x.entity?.name||'이름 없음')}${x.entity?.phone?' · '+safe(x.entity.phone):''}</small></div><button class="ghost health-open" data-entity-type="${x.entityType}" data-entity-id="${safe(x.entity?.id)}">열기</button></article>`).join(''):'<div class="health-empty"><strong>표시할 문제가 없습니다.</strong><span>현재 선택한 조건에서는 점검 항목이 발견되지 않았습니다.</span></div>';
}
function reviewStatus(id){return getReviews()[id]?.status||'pending';}
function renderDuplicates(){
  buildDuplicateGroups(); const reviews=getReviews();
  const filter=byId('duplicateReviewFilter')?.value||'pending', q=compact(byId('duplicateSearch')?.value);
  let list=duplicateGroups.filter(g=>(duplicateType==='all'||g.type===duplicateType)&&(!q||g.members.some(a=>compact(a.name+a.phone).includes(q)))&&(filter==='all'||reviewStatus(g.id)===filter));
  const candidatePeople=new Set(duplicateGroups.flatMap(g=>g.members.map(a=>a.id))).size;
  const pending=duplicateGroups.filter(g=>reviewStatus(g.id)==='pending').length;
  byId('duplicateKpiGrid').innerHTML=`<article><span>후보 그룹</span><strong>${duplicateGroups.length}</strong></article><article class="error"><span>강한 중복</span><strong>${duplicateGroups.filter(g=>g.type==='exact'||g.type==='phone').length}</strong></article><article class="warning"><span>재지원 후보</span><strong>${duplicateGroups.filter(g=>['reapply','former'].includes(g.type)).length}</strong></article><article class="review"><span>미검토</span><strong>${pending}</strong></article><article><span>관련 지원자</span><strong>${candidatePeople}</strong></article>`;
  byId('duplicateSummary').textContent=`후보 ${duplicateGroups.length}그룹 중 ${list.length}그룹 표시 · 자동 병합 금지`;
  byId('duplicateList').innerHTML=list.length?list.map(g=>{const st=reviewStatus(g.id);return `<article class="duplicate-card"><header><div><span class="duplicate-score">유사도 ${Math.min(100,g.score)}점</span><h4>${safe(g.reasons.join(' · '))}</h4></div><span class="review-state ${st}">${st==='pending'?'미검토':st==='reapply'?'정상 재지원':'중복 아님'}</span></header><div class="duplicate-members">${g.members.map(a=>`<div class="duplicate-member"><div><strong>${safe(a.name||'이름 없음')}</strong><span>${safe(a.status||'')} · ${safe(a.workplace||'근무지 없음')}</span></div><dl><div><dt>연락처</dt><dd>${safe(a.phone||'없음')}</dd></div><div><dt>생년</dt><dd>${safe(a.birthYear||'없음')}</dd></div><div><dt>지원일</dt><dd>${safe(a.applyDate||'없음')}</dd></div><div><dt>학교</dt><dd>${safe(a.school||'없음')}</dd></div></dl><button class="ghost duplicate-open" data-applicant-id="${safe(a.id)}">지원자 열기</button></div>`).join('')}</div><footer><span>자동 병합하지 않습니다. 비교 후 분류만 저장됩니다.</span><div><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="pending">미검토</button><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="reapply">정상 재지원</button><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="exclude">중복 아님</button></div></footer></article>`}).join(''):'<div class="health-empty"><strong>표시할 중복 후보가 없습니다.</strong><span>검색 조건 또는 검토 상태를 변경해보세요.</span></div>';
}
function openEntity(type,id){
  if(type==='employee'){ if(typeof openEmployeeDetail==='function')openEmployeeDetail(id); else {setPage('employees');} }
  else { if(typeof openDetail==='function')openDetail(id); else if(typeof viewApplicant==='function')viewApplicant(id); else {setPage('applicants');} }
}
function bind(){
  byId('btnRunHealthCheck')?.addEventListener('click',renderHealth);byId('healthStaleDays')?.addEventListener('change',renderHealth);byId('healthSearch')?.addEventListener('input',renderHealth);
  byId('healthSeverityTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-health-severity]');if(!b)return;healthSeverity=b.dataset.healthSeverity;document.querySelectorAll('[data-health-severity]').forEach(x=>x.classList.toggle('active',x===b));renderHealth();});
  byId('healthIssueList')?.addEventListener('click',e=>{const b=e.target.closest('.health-open');if(b)openEntity(b.dataset.entityType,b.dataset.entityId);});
  byId('btnRunDuplicateCheck')?.addEventListener('click',renderDuplicates);byId('duplicateReviewFilter')?.addEventListener('change',renderDuplicates);byId('duplicateSearch')?.addEventListener('input',renderDuplicates);
  byId('duplicateTypeTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-duplicate-type]');if(!b)return;duplicateType=b.dataset.duplicateType;document.querySelectorAll('[data-duplicate-type]').forEach(x=>x.classList.toggle('active',x===b));renderDuplicates();});
  byId('duplicateList')?.addEventListener('click',e=>{const open=e.target.closest('.duplicate-open');if(open){openEntity('applicant',open.dataset.applicantId);return;}const b=e.target.closest('.duplicate-review');if(!b)return;const reviews=getReviews();reviews[b.dataset.groupId]={status:b.dataset.review,reviewedAt:new Date().toISOString()};saveReviews(reviews);renderDuplicates();renderHealth();});
  document.querySelectorAll('.nav-btn[data-page="dataHealth"],.nav-btn[data-page="duplicates"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>b.dataset.page==='dataHealth'?renderHealth():renderDuplicates(),0)));
}
const originalRenderAll=window.renderAll;
if(typeof originalRenderAll==='function') window.renderAll=function(){ originalRenderAll(); if(document.getElementById('dataHealth')?.classList.contains('active'))renderHealth(); if(document.getElementById('duplicates')?.classList.contains('active'))renderDuplicates(); };
window.erpRenderDataHealth=renderHealth;window.erpRenderDuplicates=renderDuplicates;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();renderHealth();renderDuplicates();});else{bind();renderHealth();renderDuplicates();}
})();

;

/* ===== CONSOLIDATED SOURCE: advanced-bulk-v10.38.4.js ===== */
(()=>{
'use strict';
const SAVED_KEY='recruit_erp_saved_advanced_searches';
const MANAGER_KEY='recruit_erp_applicant_manager_assignments';
const selected=new Set(); let advancedResults=[]; let bulkMode=false;
const el=id=>document.getElementById(id); const q=(s,r=document)=>r.querySelector(s); const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const managers=()=>{try{return JSON.parse(localStorage.getItem(MANAGER_KEY)||'{}')}catch{return {}}};
const saveManagers=x=>localStorage.setItem(MANAGER_KEY,JSON.stringify(x));
const uniq=a=>[...new Set(a.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
function dl(name,text,type='text/plain;charset=utf-8'){const b=new Blob(['\ufeff'+text],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function dateOK(v,from,to){if(from&&(!v||v<from))return false;if(to&&(!v||v>to))return false;return true}
function hydrateOptions(){
 const fill=(id,vals)=>{const s=el(id);if(!s)return;const cur=s.value;s.innerHTML='<option value="all">전체</option>'+vals.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if([...s.options].some(o=>o.value===cur))s.value=cur};
 fill('asStatus',typeof STATUS_OPTIONS!=='undefined'?STATUS_OPTIONS:uniq(applicants.map(a=>a.status))); fill('asWorkplace',uniq(applicants.map(a=>a.workplace))); fill('asSchool',uniq(applicants.map(a=>a.school))); fill('asManager',uniq(Object.values(managers())));
}
const fields=['ApplyFrom','ApplyTo','InterviewFrom','InterviewTo','HireFrom','HireTo','Status','Workplace','School','Manager','Contact','Dorm','Keyword'];
function criteria(){const o={};fields.forEach(k=>o[k]=el('as'+k)?.value||'');return o}
function setCriteria(o={}){fields.forEach(k=>{const x=el('as'+k);if(x)x.value=o[k]??(x.tagName==='SELECT'?'all':'')});updateConditionCount()}
function updateConditionCount(){const c=criteria();const n=Object.entries(c).filter(([k,v])=>v&&v!=='all').length; if(el('asConditionCount'))el('asConditionCount').textContent=`${n}개 조건`}
function runSearch(){
 const c=criteria(), ms=managers(), kw=c.Keyword.toLowerCase();
 advancedResults=applicants.filter(a=>dateOK(a.applyDate,c.ApplyFrom,c.ApplyTo)&&dateOK(a.interviewDate,c.InterviewFrom,c.InterviewTo)&&dateOK(a.hireDate,c.HireFrom,c.HireTo))
 .filter(a=>c.Status==='all'||a.status===c.Status).filter(a=>c.Workplace==='all'||a.workplace===c.Workplace).filter(a=>c.School==='all'||a.school===c.School).filter(a=>c.Manager==='all'||ms[a.id]===c.Manager)
 .filter(a=>c.Contact==='all'||(c.Contact==='needed'&&['미연락','부재중'].includes(a.status))||(c.Contact==='done'&&!['미연락','부재중'].includes(a.status))||(c.Contact==='missing'&&!String(a.phone||'').trim()))
 .filter(a=>c.Dorm==='all'||(c.Dorm==='pending'&&['미확인','확인필요'].includes(typeof dormLabel==='function'?dormLabel(a):a.dormUse))||(c.Dorm!=='pending'&&(typeof dormLabel==='function'?dormLabel(a):a.dormUse)===c.Dorm))
 .filter(a=>!kw||[a.name,a.phone,a.school,a.workplace,a.status,ms[a.id]].join(' ').toLowerCase().includes(kw)); window.__erpAdvancedFilterIds=advancedResults.map(a=>a.id); renderAdvanced(); if(typeof renderTable==='function')renderTable();
}
function renderAdvanced(){const ms=managers();el('asSummary').textContent=`총 ${advancedResults.length}명 · 선택 ${[...selected].filter(id=>advancedResults.some(a=>a.id===id)).length}명`;el('asResultList').innerHTML=advancedResults.length?advancedResults.map(a=>`<label class="advanced-result-item ${selected.has(a.id)?'selected':''}"><input type="checkbox" data-advanced-id="${a.id}" ${selected.has(a.id)?'checked':''}><span class="advanced-result-copy"><strong>${safe(a.name||'이름없음')} · ${safe(a.status||'')}</strong><small>${safe(a.phone||'연락처 없음')} · ${safe(a.school||'학교 미입력')} · ${safe(a.workplace||'근무지 미입력')}</small></span><span class="advanced-result-meta">지원 ${safe(a.applyDate||'-')}<br>면접 ${safe(a.interviewDate||'-')}<br>${ms[a.id]?`담당 ${safe(ms[a.id])}`:'담당자 미지정'}</span></label>`).join(''):'<div class="empty">조건에 맞는 지원자가 없습니다.</div>';updateBulkDock()}
function saved(){try{return JSON.parse(localStorage.getItem(SAVED_KEY)||'[]')}catch{return []}}
function renderSaved(){el('asSavedList').innerHTML=saved().map((x,i)=>`<span class="saved-search-chip"><button data-load-search="${i}">${safe(x.name)}</button><button title="삭제" data-delete-search="${i}">×</button></span>`).join('')||'<span class="muted">저장된 검색조건이 없습니다.</span>'}
function saveCurrent(){const name=el('asSavedName').value.trim();if(!name)return alert('검색조건 이름을 입력해주세요.');const arr=saved();arr.unshift({name,criteria:criteria(),createdAt:new Date().toISOString()});localStorage.setItem(SAVED_KEY,JSON.stringify(arr.slice(0,20)));el('asSavedName').value='';renderSaved()}
function selectedApplicants(){return applicants.filter(a=>selected.has(a.id))}
function updateBulkDock(){const rows=selectedApplicants(),dock=el('bulkDock');el('bulkSelectedCount').textContent=rows.length;el('bulkSelectedNames').textContent=rows.slice(0,5).map(a=>a.name||'이름없음').join(', ')+(rows.length>5?` 외 ${rows.length-5}명`:'');dock.classList.toggle('show',rows.length>0);dock.setAttribute('aria-hidden',rows.length?'false':'true');decorateRows()}
function decorateRows(){
 qa('#applicantTbody tr.applicant-row').forEach(tr=>{
  const onclick=tr.getAttribute('onclick')||'';
  const m=onclick.match(/viewApplicant\('([^']+)'\)/);
  if(!m)return;
  const id=m[1];
  const td=tr.querySelector('td.no-cell')||tr.firstElementChild;
  if(!td)return;
  if(bulkMode){
   if(!td.dataset.originalHtml)td.dataset.originalHtml=td.innerHTML;
   td.classList.add('bulk-select-cell');
   td.innerHTML=`<input class="bulk-row-checkbox" type="checkbox" data-bulk-id="${id}" ${selected.has(id)?'checked':''} aria-label="${safe(tr.querySelector('.name-button')?.textContent||'지원자')} 선택">`;
  }else if(td.classList.contains('bulk-select-cell')){
   td.innerHTML=td.dataset.originalHtml||'';
   delete td.dataset.originalHtml;
   td.classList.remove('bulk-select-cell');
  }
  tr.classList.toggle('bulk-selection-mode',bulkMode);
 });
 const th=q('#applicants table thead tr');
 if(th){
  const first=th.firstElementChild;
  if(first){
   if(bulkMode){
    if(!first.dataset.originalText)first.dataset.originalText=first.textContent;
    first.classList.add('bulk-head-cell');
    first.textContent='선택';
   }else if(first.classList.contains('bulk-head-cell')){
    first.textContent=first.dataset.originalText||'NO';
    delete first.dataset.originalText;
    first.classList.remove('bulk-head-cell');
   }
  }
 }
 const btn=el('bulkModeButton');
 if(btn){btn.classList.toggle('active',bulkMode);btn.textContent=bulkMode?'선택 종료':'선택'}
}
function ensureBulkToggle(){ decorateRows(); }
function toggleBulkMode(){bulkMode=!bulkMode;if(!bulkMode){selected.clear();updateBulkDock()}decorateRows()}
function openBulk(){const rows=selectedApplicants();if(!rows.length)return alert('지원자를 먼저 선택해주세요.');el('bulkTargetSummary').innerHTML=`<strong>처리 대상 ${rows.length}명</strong><br>${safe(rows.map(a=>a.name||'이름없음').join(', '))}`;el('bulkModal').classList.add('open');el('bulkModal').setAttribute('aria-hidden','false');syncBulkValue();previewBulk()}
function closeBulk(){el('bulkModal').classList.remove('open');el('bulkModal').setAttribute('aria-hidden','true');el('bulkConfirmCheck').checked=false;el('bulkApply').disabled=true}
function syncBulkValue(){const f=el('bulkField').value,sel=el('bulkValueSelect'),inp=el('bulkValueInput');let vals=[];if(f==='status')vals=typeof STATUS_OPTIONS!=='undefined'?STATUS_OPTIONS:uniq(applicants.map(a=>a.status));if(f==='workplace')vals=uniq(applicants.map(a=>a.workplace));sel.style.display=f==='manager'?'none':'';inp.style.display=f==='manager'?'':'none';if(f!=='manager')sel.innerHTML=vals.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');previewBulk()}
function bulkValue(){return el('bulkField').value==='manager'?el('bulkValueInput').value.trim():el('bulkValueSelect').value}
function previewBulk(){const f=el('bulkField').value,v=bulkValue(),labels={status:'상태',manager:'담당자',workplace:'근무지'};el('bulkPreview').innerHTML=`<strong>${selected.size}명 대상</strong><p>${labels[f]}를 <b>${safe(v||'값 미입력')}</b>(으)로 변경합니다.</p><small>실행 전 대상 인원과 변경 내용을 다시 확인하세요.</small>`}
function applyBulk(){const rows=selectedApplicants(),f=el('bulkField').value,v=bulkValue();if(!rows.length||!v)return alert('대상과 변경 값을 확인해주세요.');if(!el('bulkConfirmCheck').checked)return;if(!confirm(`${rows.length}명의 ${f==='status'?'상태':f==='manager'?'담당자':'근무지'}를 "${v}"(으)로 변경할까요?`))return;if(f==='manager'){const ms=managers();rows.forEach(a=>ms[a.id]=v);saveManagers(ms)}else{applicants=applicants.map(a=>selected.has(a.id)?{...a,[f]:v,updatedAt:new Date().toISOString()}:a);save()}closeBulk();hydrateOptions();runSearch();alert(`${rows.length}명 일괄 변경을 완료했습니다.`)}
function csv(){const rows=selectedApplicants(),ms=managers();const cols=['성명','연락처','상태','근무지','학교','지원일','면접일','입사일','담당자'];const lines=[cols.join(','),...rows.map(a=>[a.name,a.phone,a.status,a.workplace,a.school,a.applyDate,a.interviewDate,a.hireDate,ms[a.id]||''].map(v=>'"'+String(v||'').replaceAll('"','""')+'"').join(','))];dl(`지원자_선택_${rows.length}명_${new Date().toISOString().slice(0,10)}.csv`,lines.join('\n'),'text/csv;charset=utf-8')}
function printRows(){const rows=selectedApplicants(),ms=managers();const w=open('','_blank');w.document.write(`<html><head><title>선택 지원자</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px;font-size:12px}h2{margin:0 0 16px}</style></head><body><h2>선택 지원자 ${rows.length}명</h2><table><thead><tr><th>성명</th><th>상태</th><th>연락처</th><th>근무지</th><th>학교</th><th>면접일</th><th>담당자</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${safe(a.name)}</td><td>${safe(a.status)}</td><td>${safe(a.phone)}</td><td>${safe(a.workplace)}</td><td>${safe(a.school)}</td><td>${safe(a.interviewDate)}</td><td>${safe(ms[a.id]||'')}</td></tr>`).join('')}</tbody></table></body></html>`);w.document.close();w.print()}
function messages(){const rows=selectedApplicants();const text=rows.map(a=>{let body='';if(['면접예정','다음면접'].includes(a.status))body=`안녕하세요, ${a.name}님. 에이치티솔루션 채용 담당자입니다. ${a.workplace||'지원 근무지'} 면접 일정은 ${[a.interviewDate,a.interviewTime].filter(Boolean).join(' ')||'협의 예정'}입니다. 확인 후 회신 부탁드립니다.`;else if(a.status==='입사예정')body=`안녕하세요, ${a.name}님. ${a.workplace||'지원 근무지'} 입사 예정일은 ${a.hireDate||'협의된 날짜'}입니다. 출근 관련 안내를 확인해 주세요.`;else body=`안녕하세요, ${a.name}님. 에이치티솔루션 채용 담당자입니다. 지원해주신 내용과 관련하여 연락드립니다. 확인 후 회신 부탁드립니다.`;return `[${a.name} · ${a.phone||'연락처 없음'}]\n${body}`}).join('\n\n------------------------------\n\n');dl(`지원자_안내문_${rows.length}명_${new Date().toISOString().slice(0,10)}.txt`,text)}
function bind(){
 hydrateOptions();renderSaved();ensureBulkToggle();updateConditionCount(); el('bulkModeButton')?.addEventListener('click',toggleBulkMode);
 qa('#advancedSearch input,#advancedSearch select').forEach(x=>x.addEventListener('change',updateConditionCount)); el('asRun').onclick=runSearch;el('asReset').onclick=()=>{setCriteria({});advancedResults=[];window.__erpAdvancedFilterIds=null;renderAdvanced();if(typeof renderTable==='function')renderTable()};el('asSave').onclick=saveCurrent;
 el('asSavedList').onclick=e=>{const l=e.target.closest('[data-load-search]'),d=e.target.closest('[data-delete-search]');const arr=saved();if(l){setCriteria(arr[+l.dataset.loadSearch].criteria);runSearch()}if(d){arr.splice(+d.dataset.deleteSearch,1);localStorage.setItem(SAVED_KEY,JSON.stringify(arr));renderSaved()}};
 el('asResultList').onchange=e=>{const c=e.target.closest('[data-advanced-id]');if(!c)return;c.checked?selected.add(c.dataset.advancedId):selected.delete(c.dataset.advancedId);renderAdvanced()};el('asSelectAll').onclick=()=>{advancedResults.forEach(a=>selected.add(a.id));renderAdvanced()};el('asGoBulk').onclick=openBulk;
 document.addEventListener('change',e=>{const c=e.target.closest('[data-bulk-id]');if(!c)return;c.checked?selected.add(c.dataset.bulkId):selected.delete(c.dataset.bulkId);updateBulkDock()});el('bulkClear').onclick=()=>{selected.clear();renderAdvanced();updateBulkDock()};el('bulkOpen').onclick=openBulk;el('bulkClose').onclick=el('bulkBackdrop').onclick=closeBulk;
 qa('[data-bulk-tab]').forEach(b=>b.onclick=()=>{qa('[data-bulk-tab]').forEach(x=>x.classList.toggle('active',x===b));qa('[data-bulk-pane]').forEach(p=>p.classList.toggle('active',p.dataset.bulkPane===b.dataset.bulkTab))});
 el('bulkField').onchange=syncBulkValue;el('bulkValueSelect').onchange=previewBulk;el('bulkValueInput').oninput=previewBulk;el('bulkConfirmCheck').onchange=()=>el('bulkApply').disabled=!el('bulkConfirmCheck').checked;el('bulkApply').onclick=applyBulk;el('bulkCsv').onclick=csv;el('bulkPrint').onclick=printRows;el('bulkMessages').onclick=messages;
 const oldRender=window.renderTable;window.renderTable=function(){oldRender.apply(this,arguments);setTimeout(decorateRows)};const oldAll=window.renderAll;if(oldAll)window.renderAll=function(){oldAll.apply(this,arguments);setTimeout(()=>{hydrateOptions();decorateRows()})};
 const oldSet=window.setPage;window.setPage=function(page){oldSet(page);if(page==='advancedSearch'){hydrateOptions();renderSaved();runSearch()}};
 setTimeout(()=>{ensureBulkToggle();decorateRows()},100);
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind):bind();
})();

;

/* ===== CONSOLIDATED SOURCE: applicant-ui-v10.39.0.js ===== */
(function(){'use strict';
const q=(s,r=document)=>r.querySelector(s);
function open(){const p=q('#advancedSearch');if(!p)return;p.classList.add('drawer-open','active');document.body.style.overflow='hidden';}
function close(){const p=q('#advancedSearch');if(!p)return;p.classList.remove('drawer-open','active');const a=q('#applicants');if(a)a.classList.add('active');document.body.style.overflow='';}
function init(){
 const openBtn=q('#btnOpenApplicantFilter'), closeBtn=q('#btnCloseApplicantFilter'), cancel=q('#btnCancelApplicantFilter'), back=q('#applicantFilterBackdrop'), run=q('#asRun');
 if(openBtn)openBtn.onclick=open;if(closeBtn)closeBtn.onclick=close;if(cancel)cancel.onclick=close;if(back)back.onclick=close;if(run)run.addEventListener('click',()=>setTimeout(close,0));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 const nav=q('.nav-btn[data-page="advancedSearch"]');if(nav)nav.style.display='none';
 const old=window.setPage;if(typeof old==='function'&&!old.__v10390){window.setPage=function(page){if(page==='advancedSearch'){open();return}close();return old(page)};window.setPage.__v10390=true;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();
;
