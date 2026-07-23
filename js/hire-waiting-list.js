/* =========================================================
   v10.46.6 입사대기자 명단 · 엑셀형 한 화면 입력
   - 일정관리에서 선택한 입사일의 입사예정자 자동 조회
   - 회사 입사대기자 양식 23열 순서 유지
   - 부서배치·사번·주민번호 등은 표 안에서 직접 입력/붙여넣기
   - 추가 입력정보는 로컬 전용 저장키에 저장하고 Supabase에는 전송하지 않음
   ========================================================= */
const HIRE_WAITING_PROFILE_FIELDS=['employeeNo','pmtc','groupName','product','part','rank','residentNumber','commuteMethod','remarks'];
const HIRE_WAITING_REQUIRED_FIELDS=['employeeNo','groupName','product','part','rank','residentNumber','commuteMethod'];
const HIRE_WAITING_COLUMNS=[
  {key:'no',label:'NO',editable:false},
  {key:'employeeNo',label:'사원번호',editable:true},
  {key:'contactStatus',label:'연락상태',editable:false},
  {key:'hireDate',label:'입사날짜',editable:false},
  {key:'workplace',label:'근무지',editable:false},
  {key:'pmtc',label:'PMTC 입과 대상',editable:true},
  {key:'gender',label:'성별',editable:false},
  {key:'groupName',label:'그룹',editable:true},
  {key:'product',label:'제품',editable:true},
  {key:'part',label:'파트',editable:true},
  {key:'name',label:'성  명',editable:false},
  {key:'rank',label:'직 급',editable:true},
  {key:'residentNumber',label:'주민등록번호',editable:true,sensitive:true},
  {key:'birthDate',label:'생년월일',editable:false},
  {key:'age',label:'나이',editable:false},
  {key:'email',label:'이메일',editable:false},
  {key:'education',label:'최종학력',editable:false},
  {key:'school',label:'학교',editable:false},
  {key:'major',label:'학과',editable:false},
  {key:'phone',label:'연락처',editable:false},
  {key:'region',label:'지역(시)',editable:false},
  {key:'commuteMethod',label:'통근방법',editable:true},
  {key:'remarks',label:'비고',editable:true}
];
let hireWaitingCurrentDate='';
let hireWaitingDirty=false;

function normalizeHireWaitingProfile(raw){
  const p=raw&&typeof raw==='object'?raw:{};
  return {
    applicantId:String(p.applicantId||p.id||'').trim(),
    employeeNo:String(p.employeeNo||'').trim(),
    pmtc:String(p.pmtc||'').trim().toUpperCase()==='O'?'O':'',
    groupName:String(p.groupName||'').trim(),
    product:String(p.product||'').trim(),
    part:String(p.part||'').trim(),
    rank:String(p.rank||'').trim(),
    residentNumber:hireWaitingFormatResidentNumber(p.residentNumber||''),
    commuteMethod:hireWaitingNormalizeCommute(p.commuteMethod||''),
    remarks:String(p.remarks||'').trim(),
    createdAt:p.createdAt||new Date().toISOString(),
    updatedAt:p.updatedAt||''
  };
}
function loadHireWaitingProfiles(){
  try{
    const raw=localStorage.getItem(HIRE_WAITING_PROFILES_KEY);
    if(!raw) return [];
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed)) return parsed.map(normalizeHireWaitingProfile).filter(p=>p.applicantId);
    if(parsed&&typeof parsed==='object') return Object.keys(parsed).map(id=>normalizeHireWaitingProfile({...parsed[id],applicantId:id})).filter(p=>p.applicantId);
  }catch(err){ console.warn('입사대기 입력정보 로드 실패:',err); }
  return [];
}
function saveHireWaitingProfiles(){
  try{
    localStorage.setItem(HIRE_WAITING_PROFILES_KEY,JSON.stringify(hireWaitingProfiles.map(normalizeHireWaitingProfile).filter(p=>p.applicantId)));
    return true;
  }catch(err){
    console.error('입사대기 입력정보 저장 실패:',err);
    return false;
  }
}
function hireWaitingProfileFor(applicantId){
  return hireWaitingProfiles.find(p=>String(p.applicantId)===String(applicantId))||null;
}
function hireWaitingLinkedEmployee(a){
  if(!a) return null;
  if(a.employeeId){ const linked=employees.find(e=>String(e.id)===String(a.employeeId)); if(linked) return linked; }
  const phone=String(a.phone||'').replace(/\D/g,'');
  return employees.find(e=>phone&&String(e.phone||'').replace(/\D/g,'')===phone&&String(e.name||'').trim()===String(a.name||'').trim())||null;
}
function hireWaitingNormalizeCommute(v){
  const s=String(v||'').trim();
  if(['기숙사','사용','기숙사 사용'].includes(s)) return '기숙사';
  if(['출퇴근','통근','미사용','해당없음'].includes(s)) return '출퇴근';
  return s;
}
function hireWaitingDefaultCommute(a){
  const dorm=typeof normalizeDorm==='function'?normalizeDorm(a?.dormUse):String(a?.dormUse||'').trim();
  if(dorm==='기숙사') return '기숙사';
  if(dorm==='출퇴근') return '출퇴근';
  return hireWaitingNormalizeCommute(a?.commute||'');
}
function hireWaitingFormatResidentNumber(v){
  const digits=String(v||'').replace(/\D/g,'').slice(0,13);
  if(digits.length<=6) return digits;
  return `${digits.slice(0,6)}-${digits.slice(6)}`;
}
function hireWaitingResidentValid(v){ return !v||/^\d{6}-\d{7}$/.test(hireWaitingFormatResidentNumber(v)); }
function hireWaitingBirthFromResident(v){
  const digits=String(v||'').replace(/\D/g,'');
  if(digits.length!==13) return '';
  const code=Number(digits[6]);
  const century=[1,2,5,6].includes(code)?'19':[3,4,7,8].includes(code)?'20':'';
  if(!century) return '';
  const y=century+digits.slice(0,2),m=digits.slice(2,4),d=digits.slice(4,6);
  const dt=new Date(`${y}-${m}-${d}T00:00:00`);
  if(Number.isNaN(dt.getTime())||dt.getFullYear()!==Number(y)||dt.getMonth()+1!==Number(m)||dt.getDate()!==Number(d)) return '';
  return `${y}-${m}-${d}`;
}
function hireWaitingNormalizeBirth(v){
  const raw=String(v||'').trim();
  if(!raw) return '';
  const digits=raw.replace(/\D/g,'');
  if(digits.length===8) return `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)}`;
  if(digits.length===6){ const yy=Number(digits.slice(0,2)); const y=(yy>30?'19':'20')+digits.slice(0,2); return `${y}-${digits.slice(2,4)}-${digits.slice(4,6)}`; }
  const m=raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:raw;
}
function hireWaitingAgeOn(birth,dateStr=today()){
  const b=hireWaitingNormalizeBirth(birth); const d=new Date(`${b}T00:00:00`); const ref=new Date(`${dateStr||today()}T00:00:00`);
  if(Number.isNaN(d.getTime())||Number.isNaN(ref.getTime())) return '';
  let age=ref.getFullYear()-d.getFullYear();
  if(ref.getMonth()<d.getMonth()||(ref.getMonth()===d.getMonth()&&ref.getDate()<d.getDate())) age--;
  return age>=0?String(age):'';
}
function hireWaitingShortDate(v){
  const m=String(v||'').match(/^(?:\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[1]}월 ${m[2]}일`:String(v||'');
}
function hireWaitingEducation(a){
  const raw=String(a?.finalEducation||a?.education||'').trim();
  const map={'고등':'고졸','고등학교':'고졸','고졸':'고졸','전문대':'전졸','전문대학교':'전졸','전졸':'전졸','대학교':'대졸','대학':'대졸','대졸':'대졸','대학원':'대학원'};
  return map[raw]||raw;
}
function hireWaitingApplicantsForDate(dateStr){
  return applicants.filter(a=>a&&a.hireDate===dateStr&&normalizeStatus(a.status)==='입사예정');
}
function hireWaitingRowData(a,index){
  const profile=hireWaitingProfileFor(a.id)||{};
  const employee=hireWaitingLinkedEmployee(a)||{};
  const resident=profile.residentNumber||'';
  const birth=hireWaitingNormalizeBirth(a.birthYear)||hireWaitingBirthFromResident(resident);
  return {
    applicantId:String(a.id),no:index+1,employeeNo:profile.employeeNo||employee.empNo||'',contactStatus:'입사대기',hireDate:a.hireDate||hireWaitingCurrentDate,
    workplace:a.workplace||'',pmtc:profile.pmtc||'',gender:normalizeGender(a.gender)||a.gender||'',groupName:profile.groupName||employee.groupName||'',
    product:profile.product||employee.product||'',part:profile.part||employee.part||'',name:a.name||'',rank:profile.rank||employee.rank||employee.position||'',
    residentNumber:resident,birthDate:birth,age:hireWaitingAgeOn(birth,today()),email:a.email||'',education:hireWaitingEducation(a),school:a.school||'',major:a.major||'',
    phone:formatPhoneDisplay(a.phone||''),region:a.region||'',commuteMethod:profile.commuteMethod||hireWaitingDefaultCommute(a),remarks:profile.remarks||a.memo||a.extra||''
  };
}
function hireWaitingCellValue(row,key){ return row[key]==null?'':String(row[key]); }
function hireWaitingInputHtml(row,rowIndex,col,colIndex){
  const value=hireWaitingCellValue(row,col.key);
  const common=`data-hire-row="${rowIndex}" data-hire-field="${col.key}" data-hire-col="${colIndex}" autocomplete="off"`;
  if(col.key==='pmtc') return `<select ${common}><option value="" ${value?'':'selected'}>-</option><option value="O" ${value==='O'?'selected':''}>O</option></select>`;
  if(col.key==='commuteMethod') return `<select ${common}><option value="" ${value?'':'selected'}>선택</option><option value="출퇴근" ${value==='출퇴근'?'selected':''}>출퇴근</option><option value="기숙사" ${value==='기숙사'?'selected':''}>기숙사</option></select>`;
  const cls=col.sensitive?' hire-waiting-sensitive-input':'';
  const type=col.sensitive?'password':'text';
  return `<input class="${cls.trim()}" type="${type}" value="${esc(value)}" ${common} ${col.key==='employeeNo'?'spellcheck="false"':''}/>`;
}
function renderHireWaitingTable(){
  const body=$('hireWaitingBody'); if(!body) return;
  const rows=hireWaitingApplicantsForDate(hireWaitingCurrentDate).map(hireWaitingRowData);
  setText('hireWaitingDateLabel',calendarDateLabel(hireWaitingCurrentDate||today()));
  if($('hireWaitingDateInput')) $('hireWaitingDateInput').value=hireWaitingCurrentDate||today();
  setText('hireWaitingTotalCount',`${rows.length}명`);
  if(!rows.length){
    body.innerHTML=`<tr><td class="hire-waiting-empty" colspan="${HIRE_WAITING_COLUMNS.length}"><strong>${esc(calendarDateLabel(hireWaitingCurrentDate||today()))} 입사예정자가 없습니다.</strong><span>지원자의 상태가 ‘입사예정’이고 입사 예정일이 선택 날짜와 같아야 표시됩니다.</span></td></tr>`;
    updateHireWaitingSummary(); return;
  }
  body.innerHTML=rows.map((row,rowIndex)=>`<tr data-applicant-id="${esc(row.applicantId)}">${HIRE_WAITING_COLUMNS.map((col,colIndex)=>{
    const cls=[col.editable?'hire-waiting-editable':'hire-waiting-readonly',col.key==='name'?'hire-waiting-name-cell':'',col.key==='phone'?'hire-waiting-phone-cell':'',col.key==='residentNumber'?'hire-waiting-resident-cell':'',col.key==='remarks'?'hire-waiting-remarks-cell':''].filter(Boolean).join(' ');
    return `<td class="${cls}" data-col-key="${col.key}" data-col-index="${colIndex}" ${col.editable?'':'tabindex="-1"'}>${col.editable?hireWaitingInputHtml(row,rowIndex,col,colIndex):`<span>${esc(hireWaitingCellValue(row,col.key)||'-')}</span>`}</td>`;
  }).join('')}</tr>`).join('');
  hireWaitingBindSensitiveInputs();
  hireWaitingDirty=false;
  updateHireWaitingSummary();
}
function hireWaitingBindSensitiveInputs(){
  document.querySelectorAll('#hireWaitingBody .hire-waiting-sensitive-input').forEach(input=>{
    input.addEventListener('focus',()=>{input.type='text';input.select();});
    input.addEventListener('blur',()=>{input.value=hireWaitingFormatResidentNumber(input.value);input.type='password';validateHireWaitingGrid();});
  });
}
function hireWaitingGridRows(){
  return [...document.querySelectorAll('#hireWaitingBody tr[data-applicant-id]')].map((tr,rowIndex)=>{
    const a=applicants.find(x=>String(x.id)===String(tr.dataset.applicantId));
    const base=hireWaitingRowData(a||{},rowIndex);
    HIRE_WAITING_PROFILE_FIELDS.forEach(field=>{
      const input=tr.querySelector(`[data-hire-field="${field}"]`);
      if(input) base[field]=field==='residentNumber'?hireWaitingFormatResidentNumber(input.value):String(input.value||'').trim();
    });
    if(!base.birthDate&&base.residentNumber) base.birthDate=hireWaitingBirthFromResident(base.residentNumber);
    base.age=hireWaitingAgeOn(base.birthDate,today());
    return base;
  });
}
function hireWaitingEmployeeNoDuplicates(rows){
  const map=new Map(); const dup=new Set();
  rows.forEach(row=>{ const key=String(row.employeeNo||'').trim().toUpperCase(); if(!key)return; if(map.has(key)) dup.add(key); else map.set(key,row.applicantId); });
  const existing=new Map((Array.isArray(employees)?employees:[]).filter(e=>e.empNo).map(e=>[String(e.empNo).trim().toUpperCase(),String(e.id)]));
  rows.forEach(row=>{ const key=String(row.employeeNo||'').trim().toUpperCase(); if(!key)return; const linked=hireWaitingLinkedEmployee(applicants.find(a=>String(a.id)===String(row.applicantId))); if(existing.has(key)&&(!linked||String(linked.empNo).trim().toUpperCase()!==key)) dup.add(key); });
  return dup;
}
function validateHireWaitingGrid(){
  const rows=hireWaitingGridRows(); const duplicateNos=hireWaitingEmployeeNoDuplicates(rows); let invalid=0;
  document.querySelectorAll('#hireWaitingBody [data-hire-field]').forEach(el=>{el.classList.remove('is-invalid','is-missing');el.removeAttribute('title');});
  rows.forEach((row,rowIndex)=>{
    const tr=document.querySelectorAll('#hireWaitingBody tr[data-applicant-id]')[rowIndex];
    ['birthDate','age'].forEach(field=>{const span=tr?.querySelector(`td[data-col-key="${field}"] span`);if(span)span.textContent=String(row[field]||'-');});
    HIRE_WAITING_REQUIRED_FIELDS.forEach(field=>{ const el=document.querySelector(`#hireWaitingBody [data-hire-row="${rowIndex}"][data-hire-field="${field}"]`); if(el&&!String(row[field]||'').trim()){el.classList.add('is-missing');el.title='출력 전 입력 권장 항목';} });
    const resident=document.querySelector(`#hireWaitingBody [data-hire-row="${rowIndex}"][data-hire-field="residentNumber"]`);
    if(resident&&row.residentNumber&&!hireWaitingResidentValid(row.residentNumber)){resident.classList.add('is-invalid');resident.title='주민등록번호 13자리를 확인하세요.';invalid++;}
    const emp=document.querySelector(`#hireWaitingBody [data-hire-row="${rowIndex}"][data-hire-field="employeeNo"]`);
    if(emp&&row.employeeNo&&duplicateNos.has(String(row.employeeNo).trim().toUpperCase())){emp.classList.add('is-invalid');emp.title='중복 사원번호입니다.';invalid++;}
  });
  return {rows,invalid,duplicateNos};
}
function updateHireWaitingSummary(){
  const {rows,invalid}=validateHireWaitingGrid();
  const completed=rows.filter(row=>HIRE_WAITING_REQUIRED_FIELDS.every(field=>String(row[field]||'').trim())&&hireWaitingResidentValid(row.residentNumber)).length;
  const missing=rows.length-completed;
  setText('hireWaitingCompleteCount',`${completed}명`);
  setText('hireWaitingMissingCount',`${missing}명`);
  const status=$('hireWaitingStatusText');
  if(status){
    status.className=`hire-waiting-status-text ${invalid?'is-error':missing?'is-warning':'is-complete'}`;
    status.textContent=!rows.length?'선택 날짜의 입사예정자가 없습니다.':invalid?`형식 또는 중복 오류 ${invalid}건을 수정해야 저장·출력할 수 있습니다.`:missing?`${rows.length}명 중 ${completed}명 입력 완료 · 노란 칸 ${missing}명 보완 필요`:`${rows.length}명 모두 입력 완료`;
  }
  const exportBtn=$('btnHireWaitingExport'); if(exportBtn) exportBtn.disabled=!rows.length||invalid>0;
  const saveBtn=$('btnHireWaitingSave'); if(saveBtn) saveBtn.disabled=!rows.length||invalid>0;
}
function markHireWaitingDirty(){ hireWaitingDirty=true; updateHireWaitingSummary(); }
function saveHireWaitingGrid(showMessage=true){
  const checked=validateHireWaitingGrid();
  if(checked.invalid){ alert('빨간색으로 표시된 주민등록번호 또는 중복 사원번호를 먼저 수정해주세요.'); return false; }
  const stamp=new Date().toISOString(); const currentById=new Map(hireWaitingProfiles.map(p=>[String(p.applicantId),p]));
  checked.rows.forEach(row=>{
    const old=currentById.get(String(row.applicantId));
    const next=normalizeHireWaitingProfile({
      applicantId:row.applicantId,employeeNo:row.employeeNo,pmtc:row.pmtc,groupName:row.groupName,product:row.product,part:row.part,rank:row.rank,
      residentNumber:row.residentNumber,commuteMethod:row.commuteMethod,remarks:row.remarks,createdAt:old?.createdAt||stamp,updatedAt:stamp
    });
    currentById.set(String(row.applicantId),next);
  });
  const previous=hireWaitingProfiles;
  hireWaitingProfiles=[...currentById.values()];
  if(!saveHireWaitingProfiles()){hireWaitingProfiles=previous;alert('브라우저 저장공간에 입사대기 정보를 저장하지 못했습니다. 전체 JSON 백업 후 저장공간 상태를 확인해주세요.');return false;}
  hireWaitingDirty=false;
  updateHireWaitingSummary();
  if(showMessage){ if(typeof uxToast==='function')uxToast(`${checked.rows.length}명의 입사대기 입력정보를 저장했습니다.`); else alert('입사대기 입력정보를 저장했습니다.'); }
  return true;
}
function openHireWaitingList(dateStr){
  hireWaitingCurrentDate=dateStr||selectedCalendarDate||today();
  const modal=$('hireWaitingModal'); if(!modal) return;
  renderHireWaitingTable();
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false'); document.body.classList.add('modal-open');
  setTimeout(()=>document.querySelector('#hireWaitingBody [data-hire-field]')?.focus(),80);
}
function closeHireWaitingList(force=false){
  if(hireWaitingDirty&&!force&&!confirm('아직 저장하지 않은 입력 내용이 있습니다. 저장하지 않고 닫을까요?')) return;
  const modal=$('hireWaitingModal'); if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');}
  document.body.classList.remove('modal-open'); hireWaitingDirty=false;
}
function changeHireWaitingDate(dateStr){
  if(!dateStr) return;
  if(hireWaitingDirty&&!confirm('저장하지 않은 입력 내용이 있습니다. 날짜를 바꾸면 사라집니다. 계속할까요?')){if($('hireWaitingDateInput'))$('hireWaitingDateInput').value=hireWaitingCurrentDate;return;}
  hireWaitingCurrentDate=dateStr; selectedCalendarDate=dateStr;
  const d=new Date(`${dateStr}T00:00:00`); if(!Number.isNaN(d.getTime()))calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  renderCalendar(); renderHireWaitingTable();
}
function hireWaitingApplyPaste(target,text){
  const startRow=Number(target.dataset.hireRow),startCol=Number(target.dataset.hireCol);
  const rows=String(text||'').replace(/\r/g,'').split('\n').filter((line,i,arr)=>line!==''||i<arr.length-1).map(line=>line.split('\t'));
  if(!rows.length) return false;
  const targetRows=document.querySelectorAll('#hireWaitingBody tr[data-applicant-id]');
  if(startRow+rows.length>targetRows.length){ alert(`붙여넣을 행 ${rows.length}개가 남은 대상 인원 ${targetRows.length-startRow}명을 초과합니다.`); return true; }
  rows.forEach((cells,rOffset)=>cells.forEach((value,cOffset)=>{
    const colIndex=startCol+cOffset; const col=HIRE_WAITING_COLUMNS[colIndex];
    if(!col||!col.editable) return;
    const el=document.querySelector(`#hireWaitingBody [data-hire-row="${startRow+rOffset}"][data-hire-col="${colIndex}"]`);
    if(!el) return;
    let next=String(value||'').trim();
    if(col.key==='residentNumber')next=hireWaitingFormatResidentNumber(next);
    if(col.key==='pmtc')next=next.toUpperCase()==='O'?'O':'';
    if(col.key==='commuteMethod')next=hireWaitingNormalizeCommute(next);
    el.value=next;
  }));
  hireWaitingDirty=true; updateHireWaitingSummary();
  const lastRow=Math.min(startRow+rows.length-1,targetRows.length-1); const lastCol=Math.min(startCol+(rows[0]?.length||1)-1,HIRE_WAITING_COLUMNS.length-1);
  document.querySelector(`#hireWaitingBody [data-hire-row="${lastRow}"][data-hire-col="${lastCol}"]`)?.focus();
  return true;
}
function hireWaitingMoveVertical(target,delta){
  const row=Number(target.dataset.hireRow)+delta,field=target.dataset.hireField;
  document.querySelector(`#hireWaitingBody [data-hire-row="${row}"][data-hire-field="${field}"]`)?.focus();
}
function hireWaitingXmlEscape(v){
  return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function hireWaitingColumnName(index){
  let n=index+1,out='';
  while(n){ const r=(n-1)%26; out=String.fromCharCode(65+r)+out; n=Math.floor((n-1)/26); }
  return out;
}
function hireWaitingXlsxCell(rowIndex,colIndex,value,style=1,numeric=false){
  const ref=`${hireWaitingColumnName(colIndex)}${rowIndex}`;
  if(value===null||value===undefined||value==='') return `<c r="${ref}" s="${style}"/>`;
  if(numeric&&Number.isFinite(Number(value))) return `<c r="${ref}" s="${style}"><v>${Number(value)}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${hireWaitingXmlEscape(value)}</t></is></c>`;
}
function hireWaitingCrc32(bytes){
  let crc=0xffffffff;
  for(let i=0;i<bytes.length;i++){
    crc^=bytes[i];
    for(let j=0;j<8;j++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
function hireWaitingU16(n){return new Uint8Array([n&255,(n>>>8)&255]);}
function hireWaitingU32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);}
function hireWaitingConcat(parts){
  const total=parts.reduce((sum,p)=>sum+p.length,0),out=new Uint8Array(total);let offset=0;
  parts.forEach(p=>{out.set(p,offset);offset+=p.length;});return out;
}
function hireWaitingDosDateTime(date=new Date()){
  const year=Math.max(1980,date.getFullYear());
  return {
    time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),
    date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()
  };
}
function hireWaitingZip(files){
  const encoder=new TextEncoder(),locals=[],centrals=[];let offset=0;
  const dt=hireWaitingDosDateTime();
  Object.entries(files).forEach(([name,content])=>{
    const nameBytes=encoder.encode(name),data=typeof content==='string'?encoder.encode(content):content,crc=hireWaitingCrc32(data);
    const local=hireWaitingConcat([
      hireWaitingU32(0x04034b50),hireWaitingU16(20),hireWaitingU16(0x0800),hireWaitingU16(0),hireWaitingU16(dt.time),hireWaitingU16(dt.date),
      hireWaitingU32(crc),hireWaitingU32(data.length),hireWaitingU32(data.length),hireWaitingU16(nameBytes.length),hireWaitingU16(0),nameBytes,data
    ]);
    locals.push(local);
    const central=hireWaitingConcat([
      hireWaitingU32(0x02014b50),hireWaitingU16(20),hireWaitingU16(20),hireWaitingU16(0x0800),hireWaitingU16(0),hireWaitingU16(dt.time),hireWaitingU16(dt.date),
      hireWaitingU32(crc),hireWaitingU32(data.length),hireWaitingU32(data.length),hireWaitingU16(nameBytes.length),hireWaitingU16(0),hireWaitingU16(0),
      hireWaitingU16(0),hireWaitingU16(0),hireWaitingU32(0),hireWaitingU32(offset),nameBytes
    ]);
    centrals.push(central);offset+=local.length;
  });
  const centralData=hireWaitingConcat(centrals),localData=hireWaitingConcat(locals);
  const eocd=hireWaitingConcat([
    hireWaitingU32(0x06054b50),hireWaitingU16(0),hireWaitingU16(0),hireWaitingU16(centrals.length),hireWaitingU16(centrals.length),
    hireWaitingU32(centralData.length),hireWaitingU32(localData.length),hireWaitingU16(0)
  ]);
  return hireWaitingConcat([localData,centralData,eocd]);
}
function hireWaitingWorkbookFiles(rows){
  const headers=HIRE_WAITING_COLUMNS.map(c=>c.label);
  const dataRows=rows.map((row,index)=>[
    index+1,row.employeeNo,'입사대기',hireWaitingShortDate(row.hireDate),row.workplace,row.pmtc,row.gender,row.groupName,row.product,row.part,row.name,row.rank,row.residentNumber,
    row.birthDate,row.age,row.email,row.education,row.school,row.major,row.phone,row.region,row.commuteMethod,row.remarks
  ]);
  const all=[Array(23).fill(''),headers,...dataRows];
  const xmlRows=all.map((values,r)=>{
    const excelRow=r+1;
    if(r===0) return `<row r="1" ht="2" hidden="1" customHeight="1"/>`;
    const cells=values.map((value,c)=>{
      let style=1,numeric=false;
      if(r===1) style=3;
      else if(c===2) style=4;
      else if(c===4 && String(value)==='천안') style=5;
      else if(c===22) style=6;
      else if(c===0 || c===14){style=1;numeric=true;}
      else style=2;
      return hireWaitingXlsxCell(excelRow,c,value,style,numeric);
    }).join('');
    return `<row r="${excelRow}" ht="${r===1?28:25}" customHeight="1">${cells}</row>`;
  }).join('');
  const widths=[6,11,11,11,8,13,7,11,9,12,10,9,15,11,6,22,10,18,16,15,11,10,30];
  const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
  const sheetName=(hireWaitingCurrentDate||today()).slice(2).replaceAll('-','.');
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" zoomScale="85"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${cols}</cols><sheetData>${xmlRows}</sheetData><autoFilter ref="A2:W${Math.max(2,all.length)}"/><pageMargins left="0.2" right="0.2" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="맑은 고딕"/></font><font><b/><sz val="10"/><name val="맑은 고딕"/></font></fonts><fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC000"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF92D050"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="hair"><color rgb="FF000000"/></left><right style="hair"><color rgb="FF000000"/></right><top style="hair"><color rgb="FF000000"/></top><bottom style="hair"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="49" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="49" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return {
    '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews><sheets><sheet name="${hireWaitingXmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':styles,
    'xl/worksheets/sheet1.xml':sheet
  };
}
function hireWaitingExportExcel(){
  const checked=validateHireWaitingGrid(); if(!checked.rows.length){alert('출력할 입사예정자가 없습니다.');return;}
  if(checked.invalid){alert('빨간색 오류를 먼저 수정해주세요.');return;}
  const incomplete=checked.rows.filter(row=>!HIRE_WAITING_REQUIRED_FIELDS.every(field=>String(row[field]||'').trim()));
  if(incomplete.length&&!confirm(`필수 입력 권장 항목이 비어 있는 인원이 ${incomplete.length}명 있습니다.\n\n빈칸을 그대로 두고 엑셀을 출력할까요?`))return;
  if(!saveHireWaitingGrid(false))return;
  const rows=hireWaitingGridRows();
  const bytes=hireWaitingZip(hireWaitingWorkbookFiles(rows));
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`입사대기자_명단_${hireWaitingCurrentDate}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  if(typeof uxToast==='function')uxToast(`${rows.length}명의 입사대기자 XLSX 출력을 요청했습니다.`);
}
function initHireWaitingListBindings(){
  bind('btnCalendarHireWaiting','click',()=>openHireWaitingList(selectedCalendarDate));
  bind('btnHireWaitingClose','click',()=>closeHireWaitingList());
  bind('hireWaitingBackdrop','click',()=>closeHireWaitingList());
  bind('btnHireWaitingSave','click',()=>saveHireWaitingGrid(true));
  bind('btnHireWaitingExport','click',hireWaitingExportExcel);
  bind('hireWaitingDateInput','change',e=>changeHireWaitingDate(e.target.value));
  const table=$('hireWaitingTable');
  if(table){
    table.addEventListener('input',e=>{if(e.target.matches('[data-hire-field]'))markHireWaitingDirty();});
    table.addEventListener('change',e=>{if(e.target.matches('[data-hire-field]'))markHireWaitingDirty();});
    table.addEventListener('paste',e=>{const target=e.target.closest('[data-hire-field]');if(!target)return;const text=e.clipboardData?.getData('text/plain');if(hireWaitingApplyPaste(target,text)){e.preventDefault();}});
    table.addEventListener('keydown',e=>{const target=e.target.closest('[data-hire-field]');if(!target)return;if(e.key==='Enter'){e.preventDefault();hireWaitingMoveVertical(target,e.shiftKey?-1:1);}});
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('hireWaitingModal')?.classList.contains('show'))closeHireWaitingList();});
}

initHireWaitingListBindings();
