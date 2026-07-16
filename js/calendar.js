/* =========================================================
   v10.12.2 일정관리 월간 캘린더
   - 지원자 면접일/입사예정일은 자동 일정으로 표시
   - 직접 입력 일정은 recruit_erp_calendar_events 별도 키에 저장
   - 기존 지원자 localStorage 키는 변경하지 않음
   ========================================================= */
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
function renderCalendarTimeline(){
  if(!$('calendarTimeline')) return;
  setText('calendarSelectedTitle', calendarDateLabel(selectedCalendarDate));
  const list=calendarItemsOn(selectedCalendarDate);
  if($('calendarEventDate') && !$('calendarEventId')?.value) $('calendarEventDate').value=selectedCalendarDate;
  $('calendarTimeline').innerHTML=list.length?list.map(item=>{
    const badge=`<span class="calendar-time-badge ${calendarTypeClass(item)}">${item.time||'시간미정'} · ${esc(item.type)}</span>`;
    const detail=[item.workplace,item.status,item.memo].filter(Boolean).join(' · ');
    const actions=item.kind==='custom'
      ? `<button class="mini" onclick="editCalendarEvent('${item.id}')">수정</button><button class="mini danger" onclick="deleteCalendarEvent('${item.id}')">삭제</button>`
      : `<button class="mini" onclick="viewApplicant('${item.applicantId}')">상세</button><button class="mini" onclick="editApplicant('${item.applicantId}')">지원자 수정</button>`;
    return `<div class="calendar-timeline-item ${calendarTypeClass(item)}"><div class="calendar-timeline-main">${badge}<strong>${esc(item.title)}</strong><small>${esc(detail||'추가 정보 없음')}</small></div><div class="calendar-timeline-actions">${actions}</div></div>`;
  }).join(''):`<div class="empty">선택한 날짜에 등록된 일정이 없습니다. 오른쪽에서 직접 일정을 추가할 수 있어요.</div>`;
}
function selectCalendarDate(dateStr){
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

