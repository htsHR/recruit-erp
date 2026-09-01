/* =========================================================
   v10.46.8.4 면접 명단표 인쇄 기준 보정
   - 회사 양식(채용 면접 평가표) 그대로 재현
   - 선택 날짜에 면접 잡힌 지원자를 5명 단위로 페이지 구분
   - 이름/성별/생년월일(나이)만 자동 채움, 평가란은 인쇄 후 손으로 기입
   ========================================================= */
function rosterAgeOf(a){
  if(a.age) return a.age;
  const m=String(a.birthYear||'').match(/\d{4}/);
  if(!m) return '';
  return String(new Date().getFullYear()-parseInt(m[0],10));
}
function rosterGenderChar(a){
  if(a.gender==='남자') return '남';
  if(a.gender==='여자') return '여';
  return '';
}
function rosterDateLabel(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  if(Number.isNaN(d.getTime())) return dateStr;
  const days=['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}(${days[d.getDay()]})`;
}
function rosterRow(no, a){
  if(a){
    const bday=formatBirthDisplay(a.birthYear||'');
    const bdayLine=bday?`${esc(bday)}(${rosterAgeOf(a)})`:'';
    return `<tr class="roster-row-top">
      <td class="roster-no" rowspan="2">${no}</td>
      <td class="roster-name">${esc(a.name||'')} (${rosterGenderChar(a)})</td>
      <td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td>
      <td class="roster-pass" rowspan="2">Y / N</td>
      <td class="roster-opinion" rowspan="2"></td>
    </tr>
    <tr class="roster-row-bottom">
      <td class="roster-name">${bdayLine}</td>
    </tr>`;
  }
  return `<tr class="roster-row-top">
    <td class="roster-no" rowspan="2"></td>
    <td class="roster-name"></td>
    <td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td>
    <td class="roster-pass" rowspan="2">Y / N</td>
    <td class="roster-opinion" rowspan="2"></td>
  </tr>
  <tr class="roster-row-bottom">
    <td class="roster-name"></td>
  </tr>`;
}
function isRosterEligibleApplicant(a,dateStr){
  return !!a && a.interviewDate===dateStr && normalizeStatus(a.status)==='면접예정';
}
function rosterDateIsValid(value){
  const s=String(value||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime())&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===s;
}
function rosterTimeIsValid(value){return value===''||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(String(value||''));}
function rosterOrderValue(value){const n=Number(value);return value!==''&&value!==null&&value!==undefined&&Number.isInteger(n)&&n>=1?n:null;}
function rosterStableCompare(left,right){
  const a=left.applicant,b=right.applicant,createdA=String(a.createdAt||''),createdB=String(b.createdAt||'');
  if(createdA!==createdB){if(!createdA)return 1;if(!createdB)return -1;return createdA.localeCompare(createdB);}
  const idA=String(a.id||''),idB=String(b.id||'');
  if(idA!==idB){if(!idA)return 1;if(!idB)return -1;return idA.localeCompare(idB);}
  return left.index-right.index;
}
function rosterTimeCompare(left,right){
  const timeA=rosterTimeIsValid(left.time)&&left.time?left.time:'',timeB=rosterTimeIsValid(right.time)&&right.time?right.time:'';
  if(timeA!==timeB){if(!timeA)return 1;if(!timeB)return -1;return timeA.localeCompare(timeB);}
  return rosterStableCompare(left,right);
}
function rosterOrderedApplicants(dateStr,source=applicants,timeOverrides=null){
  const entries=(Array.isArray(source)?source:[]).map((applicant,index)=>({applicant,index,time:timeOverrides?.get?.(String(applicant.id))??String(applicant.interviewTime||'')})).filter(entry=>isRosterEligibleApplicant(entry.applicant,dateStr));
  const saved=entries.filter(entry=>entry.applicant.rosterOrderDate===dateStr&&rosterOrderValue(entry.applicant.rosterOrder)!==null);
  if(!saved.length)return entries.sort(rosterTimeCompare).map(entry=>entry.applicant);
  const savedSet=new Set(saved);
  saved.sort((a,b)=>rosterOrderValue(a.applicant.rosterOrder)-rosterOrderValue(b.applicant.rosterOrder)||rosterStableCompare(a,b));
  const added=entries.filter(entry=>!savedSet.has(entry)).sort(rosterStableCompare);
  return [...saved,...added].map(entry=>entry.applicant);
}
function rosterApplicantsOn(dateStr){
  return rosterOrderedApplicants(dateStr,applicants);
}
function buildRosterHtml(dateStr){
  const list=rosterApplicantsOn(dateStr);
  const numbered=list.map((a,i)=>({no:i+1,a}));
  const pages=[];
  for(let i=0;i<Math.max(numbered.length,1);i+=5){ pages.push(numbered.slice(i,i+5)); }
  const dateLabel=rosterDateLabel(dateStr);
  return pages.map((pageItems,pageIndex)=>{
    const rows=[];
    for(let i=0;i<5;i++){ rows.push(rosterRow(pageItems[i]?pageItems[i].no:'', pageItems[i]?pageItems[i].a:null)); }
    return `<div class="roster-page">
      <p class="roster-company">에이치티솔루션</p>
      <h3 class="roster-title">채용 면접 평가표</h3>
      <div class="roster-oath-box">
        <div class="roster-oath-text">본 평가에 있어 면접관 본인은 면접 응시자에 대한 주관을 배제하고 객관적으로 평가하였음을 밝힙니다.<br/>또한 평가자료, 평가 후 평가결과에 대해 외부로 그 내용을 절대 누설하지 않을 것을 서약합니다.</div>
        <div class="roster-oath-meta"><div class="roster-oath-meta-inner"><div class="roster-oath-line"><span class="roster-oath-label">면접일</span> : ${esc(dateLabel)}</div><div class="roster-oath-line"><span class="roster-oath-label">면접관</span> : ________________ (서명)</div></div></div>
      </div>
      <table class="roster-table">
        <colgroup>
          <col style="width:4.1%"/><col style="width:11.3%"/>
          <col style="width:11.25%"/><col style="width:11.25%"/><col style="width:11.25%"/><col style="width:11.3%"/>
          <col style="width:8.1%"/><col style="width:31.45%"/>
        </colgroup>
        <thead>
          <tr><th rowspan="2">NO</th><th rowspan="2" class="roster-name-head-cell"><div class="roster-name-head"><span class="roster-name-head-text">성명(성별)</span><span class="roster-name-head-divider"></span><span class="roster-name-head-text">생년월일(나이)</span></div></th><th colspan="4">평가항목</th><th rowspan="2">합격여부</th><th rowspan="2">면접의견</th></tr>
          <tr><th>지원동기/준비</th><th>지식/역량</th><th>규범/적극</th><th>태도/인성</th></tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <p class="roster-legend">- 평가 등급 : S(탁월), A(우수), B+(보통), B(미흡), C(매우 미흡)</p>
      <p class="roster-legend">- 합격 기준 : 전문대↑(이공계) - 평균 B+ 이상 / 전문대↑(比이공계), 고교 - 평균 A 이상</p>
    </div>`;
  }).join('');
}
const rosterOrderEditorState={open:false,date:'',rows:[],baseline:'',baselineIds:[],baselineTimes:{},dirty:false,draggingId:'',feedback:'',tone:'',returnFocus:null};
function rosterOrderEditorCanWrite(){return !window.erpPermissions||window.erpPermissions.has('applicant.write');}
function rosterOrderEditorClone(value){return JSON.parse(JSON.stringify(value));}
function rosterOrderEditorSignature(rows){return JSON.stringify((rows||[]).map(row=>[String(row.id),String(row.interviewTime||'')]));}
function rosterOrderEditorTargetIds(dateStr){return applicants.filter(row=>isRosterEligibleApplicant(row,dateStr)).map(row=>String(row.id)).sort();}
function rosterOrderEditorRows(dateStr){return rosterApplicantsOn(dateStr).map(row=>({id:String(row.id),interviewTime:String(row.interviewTime||'')}));}
function rosterOrderEditorSetFeedback(message='',tone=''){
  rosterOrderEditorState.feedback=message;rosterOrderEditorState.tone=tone;
  const feedback=$('rosterOrderEditorFeedback');
  if(feedback){feedback.textContent=message;feedback.className=`roster-order-editor-feedback${tone?` is-${tone}`:''}`;}
}
function rosterOrderEditorUpdateDirty(){
  rosterOrderEditorState.dirty=rosterOrderEditorSignature(rosterOrderEditorState.rows)!==rosterOrderEditorState.baseline;
  const status=$('rosterOrderEditorStatus'),saveButton=$('btnRosterOrderSave'),printButton=$('btnRosterOrderSavePrint');
  if(status)status.textContent=rosterOrderEditorState.dirty?'저장되지 않은 변경 있음':'변경 없음';
  if(saveButton)saveButton.disabled=!rosterOrderEditorState.dirty||!rosterOrderEditorState.rows.length||!rosterOrderEditorCanWrite();
  if(printButton){
    printButton.disabled=!rosterOrderEditorState.rows.length||!rosterOrderEditorCanWrite();
    printButton.textContent=rosterOrderEditorState.dirty?'저장 후 평가표 보기/인쇄':'평가표 보기/인쇄';
  }
}
function rosterOrderEditorRowHtml(row,index){
  const applicant=applicants.find(item=>String(item.id)===row.id)||{};
  return `<div class="roster-order-editor-row" data-roster-id="${esc(row.id)}" draggable="false" role="row">
    <span class="roster-order-editor-drag" draggable="true" role="button" tabindex="0" aria-label="${esc(applicant.name||'지원자')} 순서 끌어서 이동" title="끌어서 순서 이동">⋮⋮</span>
    <input aria-label="${esc(applicant.name||'지원자')} 순번" data-roster-order-number="${esc(row.id)}" inputmode="numeric" max="${rosterOrderEditorState.rows.length}" min="1" type="number" value="${index+1}" />
    <strong class="roster-order-editor-name" title="${esc(applicant.name||'')}">${esc(applicant.name||'성명 없음')}</strong>
    <input aria-label="${esc(applicant.name||'지원자')} 면접시간" data-roster-order-time="${esc(row.id)}" type="time" value="${esc(row.interviewTime)}" />
    <button aria-label="${esc(applicant.name||'지원자')} 위로 이동" class="roster-order-editor-move" data-roster-order-action="up" data-roster-id="${esc(row.id)}" ${index===0?'disabled':''} type="button">↑</button>
    <button aria-label="${esc(applicant.name||'지원자')} 아래로 이동" class="roster-order-editor-move" data-roster-order-action="down" data-roster-id="${esc(row.id)}" ${index===rosterOrderEditorState.rows.length-1?'disabled':''} type="button">↓</button>
    <button class="ghost roster-order-editor-edit" data-roster-order-action="edit" data-roster-id="${esc(row.id)}" type="button">지원자 수정</button>
  </div>`;
}
function renderRosterOrderEditor(){
  const modal=$('rosterOrderEditor'),list=$('rosterOrderEditorList');if(!modal||!list)return false;
  modal.hidden=!rosterOrderEditorState.open;modal.setAttribute('aria-hidden',rosterOrderEditorState.open?'false':'true');
  if(!rosterOrderEditorState.open)return true;
  if($('rosterOrderEditorDate'))$('rosterOrderEditorDate').textContent=rosterOrderEditorState.date;
  if($('rosterOrderEditorCount'))$('rosterOrderEditorCount').textContent=`${rosterOrderEditorState.rows.length}명`;
  list.innerHTML=rosterOrderEditorState.rows.length?`<div class="roster-order-editor-grid" role="table" aria-label="면접자 순서 편집 목록">
    <div class="roster-order-editor-row is-header" role="row"><span>이동</span><span>순번</span><span>성명</span><span>면접시간</span><span>위</span><span>아래</span><span>정보 수정</span></div>
    ${rosterOrderEditorState.rows.map(rosterOrderEditorRowHtml).join('')}
  </div>`:'<div class="roster-order-editor-empty"><div><strong>선택 날짜의 면접예정자가 없습니다.</strong><span>대상자가 등록되면 이 화면에서 순서를 편집할 수 있습니다.</span></div></div>';
  rosterOrderEditorUpdateDirty();rosterOrderEditorSetFeedback(rosterOrderEditorState.feedback,rosterOrderEditorState.tone);return true;
}
function openRosterOrderEditor(dateValue){
  if(!rosterOrderEditorCanWrite()){window.erpPermissions?.require('applicant.write');return false;}
  const dateStr=String(dateValue||$('rosterDate')?.value||'').trim();
  if(!rosterDateIsValid(dateStr)){alert('순서를 편집할 면접 날짜를 먼저 선택해주세요.');return false;}
  const rows=rosterOrderEditorRows(dateStr),hasSaved=rows.some(row=>{const applicant=applicants.find(item=>String(item.id)===row.id);return applicant?.rosterOrderDate===dateStr&&rosterOrderValue(applicant.rosterOrder)!==null;});
  Object.assign(rosterOrderEditorState,{open:true,date:dateStr,rows,baseline:rosterOrderEditorSignature(rows),baselineIds:rosterOrderEditorTargetIds(dateStr),baselineTimes:Object.fromEntries(rows.map(row=>[row.id,row.interviewTime])),dirty:false,draggingId:'',feedback:rows.length?(hasSaved?'저장된 순서를 불러왔습니다.':'면접시간 기준 순서입니다. 저장 전에는 실제 데이터가 바뀌지 않습니다.'):'선택 날짜에 편집할 대상자가 없습니다.',tone:'',returnFocus:document.activeElement});
  document.body.classList.add('roster-order-editor-open');renderRosterOrderEditor();
  const frame=window.requestAnimationFrame||((callback)=>callback());frame(()=>$('btnRosterOrderClose')?.focus());return true;
}
function openCalendarRosterOrderEditor(){
  const dateStr=String(selectedCalendarDate||'').trim();
  if($('rosterDate'))$('rosterDate').value=dateStr;
  return openRosterOrderEditor(dateStr);
}
function closeRosterOrderEditor(options={}){
  const force=options.force===true,restoreFocus=options.restoreFocus!==false;
  if(!rosterOrderEditorState.open)return true;
  if(rosterOrderEditorState.dirty&&!force&&!confirm('저장하지 않은 순서 또는 면접시간 변경이 있습니다.\n저장하지 않고 닫을까요?'))return false;
  const returnFocus=rosterOrderEditorState.returnFocus;
  rosterOrderEditorState.open=false;rosterOrderEditorState.draggingId='';document.body.classList.remove('roster-order-editor-open');renderRosterOrderEditor();
  if(restoreFocus&&returnFocus&&typeof returnFocus.focus==='function')returnFocus.focus();return true;
}
function rosterOrderEditorMove(id,targetIndex){
  if(!rosterOrderEditorCanWrite()||!rosterOrderEditorState.open)return false;
  const from=rosterOrderEditorState.rows.findIndex(row=>row.id===String(id));if(from<0)return false;
  const to=Math.max(0,Math.min(rosterOrderEditorState.rows.length-1,Number(targetIndex)));
  if(!Number.isInteger(to))return false;
  if(from!==to){const [row]=rosterOrderEditorState.rows.splice(from,1);rosterOrderEditorState.rows.splice(to,0,row);}
  rosterOrderEditorSetFeedback('','');renderRosterOrderEditor();return true;
}
function rosterOrderEditorSetPosition(id,value){
  if(!rosterOrderEditorCanWrite()||!rosterOrderEditorState.open)return false;
  const position=Number(value);
  if(!Number.isInteger(position)||position<1||position>rosterOrderEditorState.rows.length){rosterOrderEditorSetFeedback(`순번은 1부터 ${rosterOrderEditorState.rows.length} 사이의 정수로 입력해주세요.`,'error');renderRosterOrderEditor();return false;}
  return rosterOrderEditorMove(id,position-1);
}
function rosterOrderEditorSetTime(id,value){
  if(!rosterOrderEditorCanWrite()||!rosterOrderEditorState.open)return false;
  const time=String(value||'').trim();if(!rosterTimeIsValid(time)){rosterOrderEditorSetFeedback('면접시간은 올바른 시간 형식으로 입력하거나 비워주세요.','error');return false;}
  const row=rosterOrderEditorState.rows.find(item=>item.id===String(id));if(!row)return false;
  row.interviewTime=time;rosterOrderEditorSetFeedback('','');rosterOrderEditorUpdateDirty();return true;
}
function rosterOrderEditorSortByTime(){
  if(!rosterOrderEditorCanWrite()||!rosterOrderEditorState.open)return false;
  const rowById=new Map(rosterOrderEditorState.rows.map(row=>[row.id,row]));
  const entries=rosterOrderEditorState.rows.map(row=>{const index=applicants.findIndex(item=>String(item.id)===row.id);return{applicant:applicants[index]||{id:row.id},index:index<0?Number.MAX_SAFE_INTEGER:index,time:row.interviewTime};});
  entries.sort(rosterTimeCompare);rosterOrderEditorState.rows=entries.map(entry=>rowById.get(String(entry.applicant.id))).filter(Boolean);
  rosterOrderEditorSetFeedback('시간순으로 재배치했습니다. 순서 저장 전에는 실제 데이터가 바뀌지 않습니다.','');renderRosterOrderEditor();return true;
}
function rosterOrderEditorEditApplicant(id){
  if(!rosterOrderEditorCanWrite()||!rosterOrderEditorState.open)return false;
  if(rosterOrderEditorState.dirty&&!confirm('저장하지 않은 순서 또는 면접시간 변경이 있습니다.\n저장하지 않고 지원자 정보 수정으로 이동할까요?'))return false;
  closeRosterOrderEditor({force:true,restoreFocus:false});window.editApplicant?.(String(id));return true;
}
function rosterOrderEditorValidate(){
  const dateStr=rosterOrderEditorState.date;
  if(!rosterDateIsValid(dateStr)||$('rosterDate')?.value!==dateStr)return {ok:false,message:'면접 날짜가 변경되었습니다. 목록을 닫고 다시 불러와주세요.'};
  const currentIds=rosterOrderEditorTargetIds(dateStr),draftIds=rosterOrderEditorState.rows.map(row=>row.id),uniqueDraft=new Set(draftIds),uniqueCurrent=new Set(currentIds);
  if(uniqueCurrent.size!==currentIds.length||uniqueDraft.size!==draftIds.length)return {ok:false,message:'대상 ID가 중복되어 저장할 수 없습니다. 지원자 데이터를 확인해주세요.'};
  if(JSON.stringify(currentIds)!==JSON.stringify(rosterOrderEditorState.baselineIds)||JSON.stringify([...draftIds].sort())!==JSON.stringify(currentIds))return {ok:false,message:'편집 중 면접 대상자가 변경되었습니다. 목록을 닫고 다시 불러와주세요.'};
  if(rosterOrderEditorState.rows.some(row=>!rosterTimeIsValid(row.interviewTime)))return {ok:false,message:'올바르지 않은 면접시간이 있습니다. 시간 형식을 확인해주세요.'};
  const positions=rosterOrderEditorState.rows.map((row,index)=>index+1);
  if(positions.length!==uniqueDraft.size||positions.some((position,index)=>position!==index+1||position<1||position>positions.length))return {ok:false,message:'순번 범위와 연속성을 확인해주세요.'};
  return {ok:true};
}
function rosterOrderEditorRestoreStorage(raw){
  try{if(raw===null)localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,raw);return localStorage.getItem(STORAGE_KEY)===raw;}catch{return false;}
}
function saveRosterOrderEditor(){
  if(!rosterOrderEditorCanWrite()||!rosterOrderEditorState.open||!rosterOrderEditorState.dirty)return false;
  const validation=rosterOrderEditorValidate();if(!validation.ok){rosterOrderEditorSetFeedback(validation.message,'error');return false;}
  const beforeApplicants=rosterOrderEditorClone(applicants),beforeStorage=localStorage.getItem(STORAGE_KEY),draftBefore=rosterOrderEditorClone(rosterOrderEditorState.rows),dateStr=rosterOrderEditorState.date,byId=new Map(draftBefore.map((row,index)=>[row.id,{...row,order:index+1}]));
  applicants=applicants.map(applicant=>{
    const draft=byId.get(String(applicant.id));if(!draft||!isRosterEligibleApplicant(applicant,dateStr))return applicant;
    const updated={...applicant,rosterOrderDate:dateStr,rosterOrder:draft.order};
    if(String(applicant.interviewTime||'')!==draft.interviewTime)updated.interviewTime=draft.interviewTime;
    return updated;
  });
  let saved=false;try{saved=save()===true;}catch{saved=false;}
  if(!saved){
    applicants=beforeApplicants;const storageRestored=rosterOrderEditorRestoreStorage(beforeStorage);rosterOrderEditorState.rows=draftBefore;rosterOrderEditorState.dirty=true;rosterOrderEditorSetFeedback(storageRestored?'저장하지 못했습니다. 기존 데이터와 편집 중인 변경을 모두 유지했습니다.':'저장과 브라우저 데이터 복구에 실패했습니다. 추가 작업을 중단하고 백업 상태를 확인해주세요.','error');if(typeof renderAll==='function')renderAll();renderRosterOrderEditor();return false;
  }
  const savedRows=rosterOrderEditorRows(dateStr);Object.assign(rosterOrderEditorState,{rows:savedRows,baseline:rosterOrderEditorSignature(savedRows),baselineIds:rosterOrderEditorTargetIds(dateStr),baselineTimes:Object.fromEntries(savedRows.map(row=>[row.id,row.interviewTime])),dirty:false,feedback:'면접자 순서와 변경한 면접시간을 저장했습니다.',tone:'success'});renderRosterOrderEditor();return true;
}
function rosterOrderEditorFocusable(){return [...($('rosterOrderEditor')?.querySelectorAll('button:not([disabled]),input:not([disabled]),[tabindex="0"]')||[])].filter(node=>node.getClientRects().length);}
function rosterOrderEditorKeydown(event){
  if(!rosterOrderEditorState.open)return;
  if(event.key==='Escape'){event.preventDefault();closeRosterOrderEditor();return;}
  if(event.key!=='Tab')return;const focusable=rosterOrderEditorFocusable();if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
const rosterPrintState={active:false,controls:[],cleanupTimer:0};
function rosterPrintControlElements(){
  return ['btnRosterPrint','btnCalendarPrintRoster','btnRosterOrderSavePrint'].map(id=>$(id)).filter(Boolean);
}
function beginRosterPrint(){
  if(rosterPrintState.active)return false;
  rosterPrintState.active=true;
  rosterPrintState.controls=rosterPrintControlElements().map(button=>({button,disabled:!!button.disabled}));
  rosterPrintState.controls.forEach(({button})=>{button.disabled=true;button.setAttribute?.('aria-busy','true');});
  document.body.classList.add('roster-printing');
  return true;
}
function finishRosterPrint(){
  if(rosterPrintState.cleanupTimer){clearTimeout(rosterPrintState.cleanupTimer);rosterPrintState.cleanupTimer=0;}
  document.body.classList.remove('roster-printing');
  rosterPrintState.controls.forEach(({button,disabled})=>{button.disabled=disabled;button.removeAttribute?.('aria-busy');});
  rosterPrintState.controls=[];rosterPrintState.active=false;
}
function scheduleRosterPrintCleanup(delay=1200){
  if(!rosterPrintState.active)return;
  if(rosterPrintState.cleanupTimer)clearTimeout(rosterPrintState.cleanupTimer);
  const schedule=typeof setTimeout==='function'?setTimeout:typeof window.setTimeout==='function'?window.setTimeout.bind(window):null;
  if(!schedule){finishRosterPrint();return;}
  rosterPrintState.cleanupTimer=schedule(finishRosterPrint,delay);
}
function openRosterPrint(){
  if(rosterPrintState.active)return false;
  const dateStr=$('rosterDate').value;
  if(!dateStr){ alert('명단표를 뽑을 면접 날짜를 먼저 선택해주세요.'); return false; }
  const list=rosterApplicantsOn(dateStr);
  if(!list.length && !confirm('선택하신 날짜에 면접예정 상태인 지원자가 없습니다. 빈 양식으로 출력할까요?')) return false;
  const printArea=$('rosterPrintArea');
  printArea.innerHTML=buildRosterHtml(dateStr);
  if(!beginRosterPrint())return false;
  try{
    // 화면에서는 보이지 않되 display:block 상태로 먼저 배치해, 인쇄 미리보기가
    // 열리는 순간 모든 페이지를 한꺼번에 계산하며 멈추는 문제를 방지한다.
    void printArea.offsetHeight;
    window.print();
    if(rosterPrintState.active)scheduleRosterPrintCleanup();
    return true;
  }catch(error){
    finishRosterPrint();
    console.error('면접 명단표 인쇄 호출 실패',error);
    alert('인쇄 창을 열지 못했습니다. 브라우저를 새로고침한 뒤 다시 시도해주세요.');
    return false;
  }
}
function openRosterPrintFromOrderEditor(){
  if(!rosterOrderEditorState.open||!rosterOrderEditorState.rows.length||!rosterOrderEditorCanWrite())return false;
  const dateStr=rosterOrderEditorState.date;
  if(rosterOrderEditorState.dirty&&!saveRosterOrderEditor())return false;
  if($('rosterDate'))$('rosterDate').value=dateStr;
  closeRosterOrderEditor({force:true,restoreFocus:false});
  return openRosterPrint();
}
function handleRosterPrintClick(event){
  const trigger=event.target?.closest?.('#btnRosterPrint,#btnCalendarPrintRoster,#btnRosterOrderSavePrint');
  if(!trigger||trigger.disabled)return;
  event.preventDefault();
  if(trigger.id==='btnCalendarPrintRoster'){
    if(!selectedCalendarDate){alert('날짜를 먼저 선택해주세요.');return;}
    if($('rosterDate'))$('rosterDate').value=selectedCalendarDate;
    openRosterPrint();
    return;
  }
  if(trigger.id==='btnRosterOrderSavePrint'){
    openRosterPrintFromOrderEditor();
    return;
  }
  openRosterPrint();
}
window.addEventListener('afterprint',finishRosterPrint);
window.addEventListener('focus',()=>scheduleRosterPrintCleanup(250));
// 일부 화면 갱신 과정에서 버튼 노드가 교체되어도 인쇄 기능이 사라지지 않도록
// 고정된 document에서 인쇄 버튼 클릭을 위임받는다.
document.addEventListener('click',handleRosterPrintClick);
bind('btnRosterOrderEdit','click',()=>openRosterOrderEditor());
bind('btnRosterOrderClose','click',()=>closeRosterOrderEditor());
bind('btnRosterOrderCancel','click',()=>closeRosterOrderEditor());
bind('btnRosterOrderTimeSort','click',rosterOrderEditorSortByTime);
bind('btnRosterOrderSave','click',saveRosterOrderEditor);
bind('rosterDate','change',event=>{
  if(!rosterOrderEditorState.open||event.target.value===rosterOrderEditorState.date)return;
  if(!closeRosterOrderEditor()){event.target.value=rosterOrderEditorState.date;return;}
});
const rosterOrderEditorList=$('rosterOrderEditorList');
if(rosterOrderEditorList){
  rosterOrderEditorList.addEventListener('click',event=>{
    const button=event.target.closest('[data-roster-order-action]');if(!button)return;
    const id=button.dataset.rosterId,action=button.dataset.rosterOrderAction,index=rosterOrderEditorState.rows.findIndex(row=>row.id===id);
    if(action==='up')rosterOrderEditorMove(id,index-1);else if(action==='down')rosterOrderEditorMove(id,index+1);else if(action==='edit')rosterOrderEditorEditApplicant(id);
  });
  rosterOrderEditorList.addEventListener('change',event=>{
    if(event.target.matches('[data-roster-order-number]')){
      const id=event.target.dataset.rosterOrderNumber,value=event.target.value,frame=window.requestAnimationFrame||((callback)=>callback());
      frame(()=>rosterOrderEditorSetPosition(id,value));
    }
    if(event.target.matches('[data-roster-order-time]'))rosterOrderEditorSetTime(event.target.dataset.rosterOrderTime,event.target.value);
  });
  rosterOrderEditorList.addEventListener('dragstart',event=>{
    const handle=event.target.closest('.roster-order-editor-drag'),row=handle?.closest('[data-roster-id]');if(!handle||!row||!rosterOrderEditorCanWrite()){event.preventDefault();return;}
    rosterOrderEditorState.draggingId=row.dataset.rosterId;row.classList.add('is-dragging');event.dataTransfer?.setData('text/plain',row.dataset.rosterId);if(event.dataTransfer)event.dataTransfer.effectAllowed='move';
  });
  rosterOrderEditorList.addEventListener('dragover',event=>{if(rosterOrderEditorState.draggingId){event.preventDefault();if(event.dataTransfer)event.dataTransfer.dropEffect='move';}});
  rosterOrderEditorList.addEventListener('drop',event=>{const row=event.target.closest('[data-roster-id]');if(!row||!rosterOrderEditorState.draggingId)return;event.preventDefault();const target=rosterOrderEditorState.rows.findIndex(item=>item.id===row.dataset.rosterId);rosterOrderEditorMove(rosterOrderEditorState.draggingId,target);rosterOrderEditorState.draggingId='';});
  rosterOrderEditorList.addEventListener('dragend',()=>{rosterOrderEditorList.querySelector('.is-dragging')?.classList.remove('is-dragging');rosterOrderEditorState.draggingId='';});
}
document.querySelector('[data-roster-order-close]')?.addEventListener('click',()=>closeRosterOrderEditor());
document.addEventListener('keydown',rosterOrderEditorKeydown);
document.addEventListener('erp:permission-change',()=>{if(rosterOrderEditorState.open&&!rosterOrderEditorCanWrite())closeRosterOrderEditor({force:true,restoreFocus:false});});
bind('btnCalendarPrev','click',()=>moveCalendarMonth(-1));
bind('btnCalendarNext','click',()=>moveCalendarMonth(1));
bind('btnCalendarToday','click',goCalendarToday);
bind('btnCalendarAdd','click',resetCalendarEventForm);
bind('calendarWorkplaceFilter','change',e=>{ calendarWorkplaceFilter=e.target.value; renderCalendar(); });
bind('calendarEventForm','submit',saveCalendarEventFromForm);
bind('btnCalendarReset','click',resetCalendarEventForm);
bind('btnCalendarDelete','click',()=>deleteCalendarEvent());
bind('btnCalendarRosterOrderEdit','click',openCalendarRosterOrderEditor);

window.erpRosterOrderEditor={
  open:openRosterOrderEditor,openFromCalendar:openCalendarRosterOrderEditor,close:closeRosterOrderEditor,move:rosterOrderEditorMove,setPosition:rosterOrderEditorSetPosition,setTime:rosterOrderEditorSetTime,sortByTime:rosterOrderEditorSortByTime,editApplicant:rosterOrderEditorEditApplicant,save:saveRosterOrderEditor,saveAndPrint:openRosterPrintFromOrderEditor,render:renderRosterOrderEditor,state:rosterOrderEditorState,
  orderedApplicants:rosterOrderedApplicants,
  __test:{rosterDateIsValid,rosterTimeIsValid,rosterOrderValue,rosterStableCompare,rosterTimeCompare,validate:rosterOrderEditorValidate,signature:rosterOrderEditorSignature,rows:rosterOrderEditorRows,targetIds:rosterOrderEditorTargetIds,printState:rosterPrintState,finishPrint:finishRosterPrint}
};
