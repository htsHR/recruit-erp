/* =========================================================
   v10.46.4 일정관리 면접 결과 일괄 처리
   - 지원자 면접일/입사예정일은 자동 일정으로 표시
   - 직접 입력 일정은 recruit_erp_calendar_events 별도 키에 저장
   - 기존 지원자 localStorage 키는 변경하지 않음
   ========================================================= */
let calendarSelectedInterviewIds=new Set();
let calendarBulkDecisionType='';
const CALENDAR_FINAL_STATUSES=new Set(['입사예정','출근','불합격','서류탈락','철회','연락두절']);
function calendarApplicantById(id){ return applicants.find(a=>String(a.id)===String(id))||null; }
function calendarInterviewSelectable(item){
  if(!item || item.kind!=='auto' || item.type!=='면접') return false;
  const a=calendarApplicantById(item.applicantId);
  return !!a && !CALENDAR_FINAL_STATUSES.has(normalizeStatus(a.status));
}
function calendarResultLabel(a){
  if(!a) return '';
  if(['입사예정','출근'].includes(a.status) || a.finalDecision==='합격') return '합격';
  if(['불합격','서류탈락'].includes(a.status) || a.finalDecision==='불합격') return '불합격';
  if(['철회','연락두절'].includes(a.status)) return a.status;
  return '';
}
function calendarCurrentActor(){
  return String(localStorage.getItem('recruit_erp_current_user_name')||localStorage.getItem('recruit_erp_user_name')||'현재 사용자').trim()||'현재 사용자';
}
function calendarClearBulkSelection(){ calendarSelectedInterviewIds.clear(); }
function normalizeCalendarEvent(e){
  return {
    id:e.id||uid(), title:String(e.title||'').trim(), date:e.date||today(), time:e.time||'', type:e.type||'중요',
    workplace:e.workplace||'전체', importance:e.importance||'normal', memo:e.memo||'',
    createdAt:e.createdAt||new Date().toISOString(), updatedAt:e.updatedAt||''
  };
}
function loadCalendarEvents(){
  try{
    const raw=localStorage.getItem(CALENDAR_EVENTS_KEY);
    const data=raw?JSON.parse(raw):[];
    return Array.isArray(data)?data.map(normalizeCalendarEvent).filter(e=>e.title&&e.date):[];
  }catch(e){ console.warn('일정관리 데이터 로드 실패:', e); return []; }
}
function saveCalendarEvents(){ localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(calendarEvents)); renderCalendar(); }
function calendarDateKey(d){ const x=new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); }
function calendarDateLabel(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  if(Number.isNaN(d.getTime())) return dateStr;
  const days=['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}(${days[d.getDay()]})`;
}
function calendarMonthLabel(){ return `${calendarCursor.getFullYear()}년 ${String(calendarCursor.getMonth()+1).padStart(2,'0')}월`; }
function monthKey(dateStr){ return String(dateStr||'').slice(0,7); }
function calendarFilterOk(item){
  if(calendarWorkplaceFilter==='전체') return true;
  const wp=item.workplace||'전체';
  if(wp==='전체') return true;
  if(calendarWorkplaceFilter==='기타') return !['천안','평택','전체'].includes(wp);
  return wp===calendarWorkplaceFilter;
}
function calendarAutoItems(){
  const items=[];
  applicants.forEach(a=>{
    if(a.interviewDate){
      items.push({kind:'auto',type:'면접',date:a.interviewDate,time:a.interviewTime||'',title:`${a.name||'이름없음'} 면접`,workplace:a.workplace||'',status:a.status||'',applicantId:a.id,memo:[a.phone,a.region,dormLabel(a)].filter(Boolean).join(' · ')});
    }
    if(a.hireDate){
      items.push({kind:'auto',type:'입사',date:a.hireDate,time:'',title:`${a.name||'이름없음'} 입사 예정`,workplace:a.workplace||'',status:a.status||'',applicantId:a.id,memo:[a.phone,a.region,dormLabel(a)].filter(Boolean).join(' · ')});
    }
  });
  return items;
}
function calendarAllItems(){
  const custom=calendarEvents.map(e=>({...e,kind:'custom'}));
  return [...calendarAutoItems(),...custom].filter(calendarFilterOk);
}
function calendarItemsOn(dateStr){
  return calendarAllItems().filter(i=>i.date===dateStr).sort((a,b)=>{
    const at=a.time||'99:99', bt=b.time||'99:99';
    if(at!==bt) return at.localeCompare(bt);
    const order={면접:1,입사:2,중요:3,회의:4,마감:5,교육:6,메모:7,기타:8};
    return (order[a.type]||9)-(order[b.type]||9);
  });
}
function calendarTypeClass(item){
  if(item.importance==='urgent') return 'calendar-type-urgent';
  if(item.type==='면접') return 'calendar-type-interview';
  if(item.type==='입사') return 'calendar-type-hire';
  return 'calendar-type-custom';
}
function renderCalendarWorkplaceOptions(){
  const sel=$('calendarWorkplaceFilter');
  if(!sel) return;
  const values=['전체','천안','평택','기타'];
  applicants.map(a=>a.workplace).filter(Boolean).forEach(v=>{ if(!values.includes(v)) values.push(v); });
  calendarEvents.map(e=>e.workplace).filter(Boolean).forEach(v=>{ if(!values.includes(v)) values.push(v); });
  const prev=sel.value||calendarWorkplaceFilter;
  sel.innerHTML=values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value=values.includes(prev)?prev:'전체';
  calendarWorkplaceFilter=sel.value;
}
function renderCalendar(){
  if(!$('calendarGrid')) return;
  renderCalendarWorkplaceOptions();
  setText('calendarMonthTitle', calendarMonthLabel());
  const y=calendarCursor.getFullYear(), m=calendarCursor.getMonth();
  const first=new Date(y,m,1);
  const start=new Date(y,m,1-first.getDay());
  const cells=[];
  const all=calendarAllItems();
  const curMonth=`${y}-${String(m+1).padStart(2,'0')}`;
  setText('calendarTodayCount', all.filter(i=>i.date===today()).length);
  setText('calendarMonthInterviewCount', all.filter(i=>i.type==='면접'&&monthKey(i.date)===curMonth).length);
  setText('calendarMonthHireCount', all.filter(i=>i.type==='입사'&&monthKey(i.date)===curMonth).length);
  setText('calendarMonthCustomCount', all.filter(i=>i.kind==='custom'&&monthKey(i.date)===curMonth).length);
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const dateStr=calendarDateKey(d);
    const inMonth=d.getMonth()===m;
    const dayItems=all.filter(item=>item.date===dateStr);
    const interviewItems=dayItems.filter(item=>item.type==='면접');
    const interviewCount=interviewItems.length;
    const hireCount=dayItems.filter(item=>item.type==='입사').length;
    const urgentCount=dayItems.filter(item=>item.importance==='urgent').length;
    const customCount=dayItems.filter(item=>item.kind==='custom').length;
    const interviewRegionMap={};
    interviewItems.forEach(item=>{
      const key=(item.workplace||'기타').trim()||'기타';
      interviewRegionMap[key]=(interviewRegionMap[key]||0)+1;
    });
    const regionOrder=['평택','천안','기타'];
    const interviewBreakdown=Object.keys(interviewRegionMap)
      .sort((a,b)=>{
        const ai=regionOrder.indexOf(a), bi=regionOrder.indexOf(b);
        if(ai===-1 && bi===-1) return a.localeCompare(b,'ko');
        if(ai===-1) return 1;
        if(bi===-1) return -1;
        return ai-bi;
      })
      .map(region=>`(${region}${interviewRegionMap[region]})`)
      .join(' ');
    const lines=[];
    if(interviewCount) lines.push(`<span class="calendar-day-line calendar-type-interview"><span class="calendar-line-main">면접 ${interviewCount}</span>${interviewBreakdown?`<span class="calendar-line-side">${interviewBreakdown}</span>`:''}</span>`);
    if(hireCount) lines.push(`<span class="calendar-day-line calendar-type-hire"><span class="calendar-line-main">입사 ${hireCount}</span></span>`);
    if(urgentCount) lines.push(`<span class="calendar-day-line calendar-type-urgent"><span class="calendar-line-main">매우중요 ${urgentCount}</span></span>`);
    else if(customCount) lines.push(`<span class="calendar-day-line calendar-type-custom"><span class="calendar-line-main">직접 ${customCount}</span></span>`);
    cells.push(`<button type="button" class="calendar-day ${inMonth?'':'other-month'} ${dateStr===today()?'today':''} ${dateStr===selectedCalendarDate?'selected':''}" onclick="selectCalendarDate('${dateStr}')">
      <span class="calendar-date-num"><span>${d.getDate()}</span>${dateStr===today()?'<span class="calendar-today-dot">오늘</span>':''}</span>
      <span class="calendar-day-lines">${lines.join('')}</span>
    </button>`);
  }
  $('calendarGrid').innerHTML=cells.join('');
  renderCalendarTimeline();
}
function renderCalendarBulkDecisionBar(list){
  const bar=$('calendarBulkDecisionBar');
  if(!bar) return;
  const interviews=list.filter(item=>item.kind==='auto'&&item.type==='면접');
  const selectable=interviews.filter(calendarInterviewSelectable);
  const validIds=new Set(selectable.map(item=>String(item.applicantId)));
  [...calendarSelectedInterviewIds].forEach(id=>{ if(!validIds.has(String(id))) calendarSelectedInterviewIds.delete(String(id)); });
  if(!interviews.length){ bar.hidden=true; bar.innerHTML=''; return; }
  const selectedCount=calendarSelectedInterviewIds.size;
  const allSelected=selectable.length>0 && selectable.every(item=>calendarSelectedInterviewIds.has(String(item.applicantId)));
  const completed=interviews.length-selectable.length;
  bar.hidden=false;
  bar.innerHTML=`<div class="calendar-bulk-left">
    <label class="calendar-bulk-select-all"><input type="checkbox" ${allSelected?'checked':''} ${selectable.length?'':'disabled'} onchange="toggleCalendarInterviewSelectAll(this.checked)"/> 면접자 전체 선택</label>
    <span class="calendar-bulk-count"><strong>${selectedCount}</strong>명 선택</span>
    ${completed?`<span class="calendar-processed-note">처리 완료 ${completed}명 제외</span>`:''}
  </div><div class="calendar-bulk-actions">
    <button class="calendar-bulk-accept" type="button" ${selectedCount?'':'disabled'} onclick="openCalendarBulkDecision('accept')">합격 처리</button>
    <button class="calendar-bulk-reject" type="button" ${selectedCount?'':'disabled'} onclick="openCalendarBulkDecision('reject')">불합격 처리</button>
  </div>`;
}
function toggleCalendarInterviewSelection(id,checked){
  const key=String(id);
  if(checked) calendarSelectedInterviewIds.add(key); else calendarSelectedInterviewIds.delete(key);
  renderCalendarTimeline();
}
function toggleCalendarInterviewSelectAll(checked){
  const items=calendarItemsOn(selectedCalendarDate).filter(calendarInterviewSelectable);
  if(checked) items.forEach(item=>calendarSelectedInterviewIds.add(String(item.applicantId)));
  else items.forEach(item=>calendarSelectedInterviewIds.delete(String(item.applicantId)));
  renderCalendarTimeline();
}
function renderCalendarTimeline(){
  if(!$('calendarTimeline')) return;
  setText('calendarSelectedTitle', calendarDateLabel(selectedCalendarDate));
  const list=calendarItemsOn(selectedCalendarDate);
  renderCalendarBulkDecisionBar(list);
  if($('calendarEventDate') && !$('calendarEventId')?.value) $('calendarEventDate').value=selectedCalendarDate;
  $('calendarTimeline').innerHTML=list.length?list.map(item=>{
    const badge=`<span class="calendar-time-badge ${calendarTypeClass(item)}">${item.time||'시간미정'} · ${esc(item.type)}</span>`;
    const detail=[item.workplace,item.status,item.memo].filter(Boolean).join(' · ');
    const a=item.kind==='auto'?calendarApplicantById(item.applicantId):null;
    const selectable=calendarInterviewSelectable(item);
    const selected=selectable&&calendarSelectedInterviewIds.has(String(item.applicantId));
    const result=calendarResultLabel(a);
    const resultClass=result==='합격'?'accept':result==='불합격'?'reject':'done';
    const resultTag=result?`<span class="calendar-result-tag ${resultClass}">${esc(result)}</span>`:'';
    const check=selectable?`<label class="calendar-item-select" title="${esc(a?.name||'지원자')} 선택"><input type="checkbox" ${selected?'checked':''} onchange="toggleCalendarInterviewSelection('${item.applicantId}',this.checked)"/></label>`:'';
    const actions=item.kind==='custom'
      ? `<button class="mini" onclick="editCalendarEvent('${item.id}')">수정</button><button class="mini danger" onclick="deleteCalendarEvent('${item.id}')">삭제</button>`
      : `<button class="mini" onclick="viewApplicant('${item.applicantId}')">상세</button><button class="mini" onclick="editApplicant('${item.applicantId}')">지원자 수정</button>`;
    return `<div class="calendar-timeline-item ${calendarTypeClass(item)} ${selected?'is-bulk-selected':''} ${result?'is-processed':''}"><div class="calendar-timeline-main-wrap">${check}<div class="calendar-timeline-main">${badge}<strong>${esc(item.title)}${resultTag}</strong><small>${esc(detail||'추가 정보 없음')}</small></div></div><div class="calendar-timeline-actions">${actions}</div></div>`;
  }).join(''):`<div class="empty">선택한 날짜에 등록된 일정이 없습니다. 오른쪽에서 직접 일정을 추가할 수 있어요.</div>`;
}
function calendarSelectedApplicants(){
  return [...calendarSelectedInterviewIds].map(calendarApplicantById).filter(Boolean).filter(a=>a.interviewDate===selectedCalendarDate&&!CALENDAR_FINAL_STATUSES.has(normalizeStatus(a.status)));
}
function openCalendarBulkDecision(type){
  const selected=calendarSelectedApplicants();
  if(!selected.length){ alert('처리할 면접 지원자를 선택해주세요.'); calendarClearBulkSelection(); renderCalendarTimeline(); return; }
  calendarBulkDecisionType=type==='reject'?'reject':'accept';
  const modal=$('calendarDecisionModal');
  if(!modal) return;
  const isAccept=calendarBulkDecisionType==='accept';
  modal.classList.toggle('is-reject',!isAccept);
  setText('calendarDecisionTitle',isAccept?'합격 일괄 처리':'불합격 일괄 처리');
  setText('calendarDecisionSubtitle',isAccept?'선택한 지원자를 입사예정으로 변경하고 입사 예정일을 함께 저장합니다.':'선택한 지원자를 불합격으로 변경합니다.');
  setText('calendarDecisionCount',`${selected.length}명`);
  $('calendarDecisionNames').innerHTML=selected.map(a=>`<span class="calendar-decision-name">${esc(a.name||'이름없음')} · ${esc(a.workplace||'근무지 미입력')}</span>`).join('');
  const dateField=$('calendarHireDateField');
  const dateInput=$('calendarBulkHireDate');
  if(dateField) dateField.hidden=!isAccept;
  if(dateInput){ dateInput.value=''; dateInput.min=selectedCalendarDate||today(); }
  setText('calendarDecisionWarning',isAccept?`입사 예정일은 면접일(${selectedCalendarDate}) 이후 날짜로 입력해야 합니다. 선택한 모든 지원자에게 같은 날짜가 적용됩니다.`:'불합격 처리 후 지원자 목록에서도 즉시 불합격 상태로 표시됩니다.');
  const apply=$('btnApplyCalendarBulkDecision');
  if(apply){ apply.textContent=isAccept?'합격 확정':'불합격 확정'; apply.className=isAccept?'primary':'danger'; }
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  if(isAccept) setTimeout(()=>dateInput?.focus(),80);
}
function closeCalendarBulkDecisionModal(){
  const modal=$('calendarDecisionModal');
  if(modal){ modal.classList.remove('show','is-reject'); modal.setAttribute('aria-hidden','true'); }
  document.body.classList.remove('modal-open');
  calendarBulkDecisionType='';
}
function applyCalendarBulkDecision(){
  const selected=calendarSelectedApplicants();
  if(!selected.length){ closeCalendarBulkDecisionModal(); calendarClearBulkSelection(); renderCalendarTimeline(); alert('선택한 지원자를 다시 확인해주세요.'); return; }
  const isAccept=calendarBulkDecisionType==='accept';
  const hireDate=$('calendarBulkHireDate')?.value||'';
  if(isAccept && !hireDate){ alert('입사 예정일을 선택해주세요.'); $('calendarBulkHireDate')?.focus(); return; }
  if(isAccept && hireDate<selectedCalendarDate){ alert('입사 예정일은 면접일보다 빠를 수 없습니다.'); $('calendarBulkHireDate')?.focus(); return; }
  const selectedIds=new Set(selected.map(a=>String(a.id)));
  const stamp=new Date().toISOString();
  const actor=calendarCurrentActor();
  applicants=applicants.map(a=>{
    if(!selectedIds.has(String(a.id))) return a;
    if(isAccept){
      return normalize({...a,status:'입사예정',hireDate,finalDecision:'합격',decisionReason:'일정관리에서 합격 일괄 처리',failureReason:'',withdrawalReason:'',lastChangedBy:actor,lastChangedAt:stamp,updatedAt:stamp});
    }
    return normalize({...a,status:'불합격',hireDate:'',finalDecision:'불합격',decisionReason:'일정관리에서 불합격 일괄 처리',failureReason:'면접 결과 불합격',withdrawalReason:'',lastChangedBy:actor,lastChangedAt:stamp,updatedAt:stamp});
  });
  calendarClearBulkSelection();
  closeCalendarBulkDecisionModal();
  save();
  if(typeof uxToast==='function') uxToast(`${selected.length}명을 ${isAccept?'합격':'불합격'} 처리했습니다.`);
  else alert(`${selected.length}명을 ${isAccept?'합격':'불합격'} 처리했습니다.`);
}

function selectCalendarDate(dateStr){
  if(selectedCalendarDate!==dateStr) calendarClearBulkSelection();
  selectedCalendarDate=dateStr;
  const d=new Date(dateStr+'T00:00:00');
  if(!Number.isNaN(d.getTime())){ calendarCursor=new Date(d.getFullYear(),d.getMonth(),1); }
  if($('calendarEventId') && !$('calendarEventId').value && $('calendarEventDate')) $('calendarEventDate').value=dateStr;
  renderCalendar();
}
function resetCalendarEventForm(){
  if(!$('calendarEventForm')) return;
  $('calendarEventForm').reset();
  $('calendarEventId').value='';
  $('calendarEventDate').value=selectedCalendarDate||today();
  if($('calendarEventType')) $('calendarEventType').value='중요';
  if($('calendarEventWorkplace')) $('calendarEventWorkplace').value='전체';
  if($('calendarEventImportance')) $('calendarEventImportance').value='normal';
  if($('btnCalendarDelete')) $('btnCalendarDelete').style.display='none';
}
function getCalendarForm(){
  return normalizeCalendarEvent({
    id:$('calendarEventId')?.value||'', title:$('calendarEventTitle')?.value||'', date:$('calendarEventDate')?.value||selectedCalendarDate,
    time:$('calendarEventTime')?.value||'', type:$('calendarEventType')?.value||'중요', workplace:$('calendarEventWorkplace')?.value||'전체',
    importance:$('calendarEventImportance')?.value||'normal', memo:$('calendarEventMemo')?.value||''
  });
}
function saveCalendarEventFromForm(e){
  e.preventDefault();
  const item=getCalendarForm();
  if(!item.title){ alert('일정명을 입력해주세요.'); return; }
  if(!item.date){ alert('날짜를 선택해주세요.'); return; }
  const idx=calendarEvents.findIndex(x=>x.id===item.id);
  if(idx>=0){ calendarEvents[idx]=normalizeCalendarEvent({...calendarEvents[idx],...item,updatedAt:new Date().toISOString()}); }
  else { calendarEvents.unshift(normalizeCalendarEvent({...item,id:uid(),createdAt:new Date().toISOString()})); }
  selectedCalendarDate=item.date;
  const d=new Date(item.date+'T00:00:00');
  if(!Number.isNaN(d.getTime())) calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  saveCalendarEvents();
  resetCalendarEventForm();
}
function editCalendarEvent(id){
  const e=calendarEvents.find(x=>x.id===id);
  if(!e) return;
  selectedCalendarDate=e.date;
  const d=new Date(e.date+'T00:00:00');
  if(!Number.isNaN(d.getTime())) calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  $('calendarEventId').value=e.id;
  $('calendarEventTitle').value=e.title||'';
  $('calendarEventDate').value=e.date||today();
  $('calendarEventTime').value=e.time||'';
  $('calendarEventType').value=e.type||'중요';
  $('calendarEventWorkplace').value=e.workplace||'전체';
  $('calendarEventImportance').value=e.importance||'normal';
  $('calendarEventMemo').value=e.memo||'';
  if($('btnCalendarDelete')) $('btnCalendarDelete').style.display='inline-flex';
  renderCalendar();
}
function deleteCalendarEvent(id){
  const target=id || $('calendarEventId')?.value;
  if(!target) return;
  if(!confirm('이 일정을 삭제할까요?')) return;
  calendarEvents=calendarEvents.filter(e=>e.id!==target);
  saveCalendarEvents();
  resetCalendarEventForm();
}
function moveCalendarMonth(delta){ calendarCursor.setMonth(calendarCursor.getMonth()+delta); renderCalendar(); }
function goCalendarToday(){ selectedCalendarDate=today(); calendarCursor=new Date(today()+'T00:00:00'); calendarCursor.setDate(1); resetCalendarEventForm(); renderCalendar(); }

