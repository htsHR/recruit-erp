/* Recruit ERP v12.5.0 — applicant list selection and bulk updates. */
(()=>{
  'use strict';
  const selected=new Set();
  let bulkMode=false;
  const el=id=>document.getElementById(id);
  const all=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const safe=value=>String(value??'').replace(/[&<>\"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[character]));
  const unique=values=>[...new Set(values.filter(Boolean).map(value=>String(value).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  const rows=()=>applicants.filter(applicant=>selected.has(applicant.id));

  function download(name,text,type='text/plain;charset=utf-8'){
    const blob=new Blob(['\ufeff'+text],{type});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;anchor.download=name;anchor.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function decorateRows(){
    all('#applicantTbody tr.applicant-row').forEach(row=>{
      const handler=row.getAttribute('data-erp-handler')||'';
      const match=handler.match(/viewApplicant\('([^']+)'\)/);
      if(!match)return;
      const id=match[1];
      const cell=row.querySelector('td.no-cell')||row.firstElementChild;
      if(!cell)return;
      if(bulkMode){
        if(!cell.dataset.originalHtml)cell.dataset.originalHtml=cell.innerHTML;
        cell.classList.add('bulk-select-cell');
        cell.innerHTML=`<input class="bulk-row-checkbox" type="checkbox" data-bulk-id="${id}" ${selected.has(id)?'checked':''} aria-label="${safe(row.querySelector('.name-button')?.textContent||'지원자')} 선택">`;
      }else if(cell.classList.contains('bulk-select-cell')){
        cell.innerHTML=cell.dataset.originalHtml||'';
        delete cell.dataset.originalHtml;
        cell.classList.remove('bulk-select-cell');
      }
      row.classList.toggle('bulk-selection-mode',bulkMode);
    });
    const firstHeader=document.querySelector('#applicants table thead tr')?.firstElementChild;
    if(firstHeader){
      if(bulkMode){
        if(!firstHeader.dataset.originalText)firstHeader.dataset.originalText=firstHeader.textContent;
        firstHeader.classList.add('bulk-head-cell');firstHeader.textContent='선택';
      }else if(firstHeader.classList.contains('bulk-head-cell')){
        firstHeader.textContent=firstHeader.dataset.originalText||'NO';
        delete firstHeader.dataset.originalText;firstHeader.classList.remove('bulk-head-cell');
      }
    }
    const button=el('bulkModeButton');
    if(button){button.classList.toggle('active',bulkMode);button.textContent=bulkMode?'선택 종료':'선택';}
  }
  function updateDock(){
    const chosen=rows();
    const dock=el('bulkDock');
    if(!dock)return;
    el('bulkSelectedCount').textContent=chosen.length;
    el('bulkSelectedNames').textContent=chosen.slice(0,5).map(applicant=>applicant.name||'이름없음').join(', ')+(chosen.length>5?` 외 ${chosen.length-5}명`:'');
    dock.classList.toggle('show',chosen.length>0);
    dock.setAttribute('aria-hidden',chosen.length?'false':'true');
    decorateRows();
  }
  function toggleMode(){
    bulkMode=!bulkMode;
    if(!bulkMode){selected.clear();updateDock();}
    decorateRows();
  }
  function syncValue(){
    const field=el('bulkField')?.value;
    const select=el('bulkValueSelect');
    if(!select)return;
    let values=[];
    if(field==='status')values=typeof STATUS_OPTIONS!=='undefined'?STATUS_OPTIONS:unique(applicants.map(applicant=>applicant.status));
    if(field==='workplace')values=unique(applicants.map(applicant=>applicant.workplace));
    select.innerHTML=values.map(value=>`<option value="${safe(value)}">${safe(value)}</option>`).join('');
    preview();
  }
  function preview(){
    const field=el('bulkField')?.value;
    const value=el('bulkValueSelect')?.value||'';
    const target=el('bulkPreview');
    if(target)target.innerHTML=`<strong>${rows().length}명 대상</strong><p>${field==='status'?'상태':'근무지'}를 <b>${safe(value||'값 미입력')}</b>(으)로 변경합니다.</p><small>실행 전 대상 인원과 변경 내용을 다시 확인하세요.</small>`;
  }
  function openModal(){
    const chosen=rows();
    if(!chosen.length){alert('지원자를 먼저 선택해주세요.');return;}
    el('bulkTargetSummary').innerHTML=`<strong>처리 대상 ${chosen.length}명</strong><br>${safe(chosen.map(applicant=>applicant.name||'이름없음').join(', '))}`;
    el('bulkModal').classList.add('open');
    el('bulkModal').setAttribute('aria-hidden','false');
    syncValue();preview();
  }
  function closeModal(){
    el('bulkModal')?.classList.remove('open');
    el('bulkModal')?.setAttribute('aria-hidden','true');
    if(el('bulkConfirmCheck'))el('bulkConfirmCheck').checked=false;
    if(el('bulkApply'))el('bulkApply').disabled=true;
  }
  function apply(){
    if(window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return;
    const chosen=rows();
    const field=el('bulkField')?.value;
    const value=el('bulkValueSelect')?.value;
    if(!chosen.length||!value){alert('대상과 변경 값을 확인해주세요.');return;}
    if(!el('bulkConfirmCheck')?.checked)return;
    if(!confirm(`${chosen.length}명의 ${field==='status'?'상태':'근무지'}를 "${value}"(으)로 변경할까요?`))return;
    const previous=applicants;
    applicants=applicants.map(applicant=>selected.has(applicant.id)?{...applicant,[field]:value,updatedAt:new Date().toISOString()}:applicant);
    if(!save()){applicants=previous;return;}
    closeModal();renderTable();
    alert(`${chosen.length}명 일괄 변경을 완료했습니다.`);
  }
  function exportCsv(){
    const chosen=rows();
    const columns=['성명','연락처','상태','근무지','학교','지원경로','지원일','면접일','입사일'];
    const lines=[columns.map(value=>window.erpSafety.csvCell(value,true)).join(','),...chosen.map(applicant=>[applicant.name,applicant.phone,applicant.status,applicant.workplace,applicant.school,applicant.source,applicant.applyDate,applicant.interviewDate,applicant.hireDate].map(value=>window.erpSafety.csvCell(value,true)).join(','))];
    download(`지원자_선택_${chosen.length}명_${new Date().toISOString().slice(0,10)}.csv`,lines.join('\n'),'text/csv;charset=utf-8');
  }
  function print(){
    const chosen=rows();
    const popup=open('','_blank');
    popup.document.write(`<html><head><title>선택 지원자</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #777;padding:7px;font-size:12px}h2{margin:0 0 16px}</style></head><body><h2>선택 지원자 ${chosen.length}명</h2><table><thead><tr><th>성명</th><th>상태</th><th>연락처</th><th>근무지</th><th>학교</th><th>지원경로</th><th>면접일</th></tr></thead><tbody>${chosen.map(applicant=>`<tr><td>${safe(applicant.name)}</td><td>${safe(applicant.status)}</td><td>${safe(applicant.phone)}</td><td>${safe(applicant.workplace)}</td><td>${safe(applicant.school)}</td><td>${safe(applicant.source)}</td><td>${safe(applicant.interviewDate)}</td></tr>`).join('')}</tbody></table></body></html>`);
    popup.document.close();popup.print();
  }
  function bind(){
    el('bulkModeButton')?.addEventListener('click',toggleMode);
    document.addEventListener('change',event=>{
      const checkbox=event.target.closest('[data-bulk-id]');
      if(!checkbox)return;
      checkbox.checked?selected.add(checkbox.dataset.bulkId):selected.delete(checkbox.dataset.bulkId);
      updateDock();
    });
    el('bulkClear')?.addEventListener('click',()=>{selected.clear();updateDock();});
    el('bulkOpen')?.addEventListener('click',openModal);
    el('bulkClose')?.addEventListener('click',closeModal);
    el('bulkBackdrop')?.addEventListener('click',closeModal);
    all('[data-bulk-tab]').forEach(button=>button.addEventListener('click',()=>{
      all('[data-bulk-tab]').forEach(item=>item.classList.toggle('active',item===button));
      all('[data-bulk-pane]').forEach(pane=>pane.classList.toggle('active',pane.dataset.bulkPane===button.dataset.bulkTab));
    }));
    el('bulkField')?.addEventListener('change',syncValue);
    el('bulkValueSelect')?.addEventListener('change',preview);
    el('bulkConfirmCheck')?.addEventListener('change',event=>{if(el('bulkApply'))el('bulkApply').disabled=!event.target.checked;});
    el('bulkApply')?.addEventListener('click',apply);
    el('bulkCsv')?.addEventListener('click',exportCsv);
    el('bulkPrint')?.addEventListener('click',print);
    const baseRender=window.renderTable;
    window.renderTable=function(){baseRender.apply(this,arguments);setTimeout(decorateRows);};
    const baseRenderAll=window.renderAll;
    if(baseRenderAll)window.renderAll=function(){baseRenderAll.apply(this,arguments);setTimeout(decorateRows);};
    setTimeout(decorateRows,100);
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind):bind();
})();
