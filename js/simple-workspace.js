/* Personal workspace: display existing data and reuse guarded paste/print saves. */
(function(root){
  'use strict';
  const $=id=>root.document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const rows=()=>typeof applicants!=='undefined'&&Array.isArray(applicants)?applicants:[];
  let initialized=false,page=0,dateChosen=false;
  const pageSize=100;

  function openPaste(){
    if(root.erpPermissions&&!root.erpPermissions.require('applicant.write'))return false;
    resetForm();
    openExcelRowPaste();
    if($('excelPasteCandidateLabel'))$('excelPasteCandidateLabel').textContent='명단을 확인한 뒤 등록하세요.';
    if($('excelRowPasteTitle'))$('excelRowPasteTitle').textContent='엑셀 붙여넣기';
    return true;
  }
  function tableRows(host,records,columns,offset=0,empty='등록된 명단이 없습니다.'){
    if(!host)return;
    host.innerHTML=records.length?records.map((row,index)=>`<tr><td>${offset+index+1}</td>${columns.map(key=>`<td>${escape(row[key]||'—')}</td>`).join('')}</tr>`).join(''):`<tr><td class="simple-empty" colspan="${columns.length+1}">${escape(empty)}</td></tr>`;
  }
  function renderRegistered(){
    const records=rows(),pages=Math.max(1,Math.ceil(records.length/pageSize));
    page=Math.min(page,pages-1);
    if($('simpleRegisteredCount'))$('simpleRegisteredCount').textContent=`${records.length.toLocaleString('ko-KR')}명 등록`;
    if(!$('simpleRegisteredDetails')?.open)return;
    tableRows($('simpleRegisteredRows'),records.slice(page*pageSize,(page+1)*pageSize),['name','phone','workplace','interviewDate','interviewTime'],page*pageSize);
    $('simplePageCount').textContent=`${page+1} / ${pages}`;
    $('simplePrevious').disabled=page===0;
    $('simpleNext').disabled=page>=pages-1;
  }
  function renderInterview(){
    const input=$('rosterDate'),select=$('simpleInterviewDates');if(!input||!select)return;
    const counts=new Map();
    for(const row of rows()){
      if(rosterDateIsValid(row.interviewDate)&&isRosterEligibleApplicant(row,row.interviewDate))counts.set(row.interviewDate,(counts.get(row.interviewDate)||0)+1);
    }
    const dates=[...counts.keys()].sort(),current=today();
    if(!dateChosen)input.value=dates.includes(current)?current:(dates.find(date=>date>=current)||dates.at(-1)||current);
    select.innerHTML='<option value="">날짜 선택</option>'+dates.map(date=>`<option value="${escape(date)}">${escape(date)} · ${counts.get(date)}명</option>`).join('');
    select.value=counts.has(input.value)?input.value:'';
    const records=rosterDateIsValid(input.value)?rosterApplicantsOn(input.value):[];
    $('simpleInterviewCount').textContent=`${records.length}명 · ${Math.ceil(records.length/5)}장`;
    tableRows($('simpleInterviewRows'),records,['name','gender','birthYear','interviewTime','workplace'],0,'이 날짜에 면접예정자가 없습니다.');
    $('btnRosterPrint').disabled=!rosterDateIsValid(input.value);
    $('btnRosterOrderEdit').disabled=records.length===0;
  }
  function render(){
    if(!initialized)return;
    renderRegistered();renderInterview();
  }
  function init(){
    if(initialized)return;
    initialized=true;root.document.body.classList.add('simple-workspace');
    $('btnSimplePaste')?.addEventListener('click',openPaste);
    $('simpleRegisteredDetails')?.addEventListener('toggle',renderRegistered);
    $('simplePrevious')?.addEventListener('click',()=>{page=Math.max(0,page-1);renderRegistered();});
    $('simpleNext')?.addEventListener('click',()=>{page+=1;renderRegistered();});
    $('rosterDate')?.addEventListener('change',()=>{dateChosen=true;renderInterview();});
    $('simpleInterviewDates')?.addEventListener('change',()=>{
      const date=$('simpleInterviewDates').value;if(!date)return;
      $('rosterDate').value=date;
      $('rosterDate').dispatchEvent(new Event('change',{bubbles:true}));
    });
    root.document.addEventListener('erp:permission-change',render);
    render();
  }
  root.erpSimpleWorkspace={enabled:true,init,render,openPaste};
})(typeof window!=='undefined'?window:globalThis);
