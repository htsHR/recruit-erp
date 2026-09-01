/* Recruit ERP v12.5.1 — core applicant workflow bindings. */
document.querySelectorAll('.nav-btn').forEach(button=>button.addEventListener('click',()=>{
  const page=button.dataset.page;
  if(page==='form'&&typeof window.openNewApplicantForm==='function')window.openNewApplicantForm();
  else setPage(page);
}));
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>{
  const page=button.dataset.go;
  if(page==='form'&&typeof window.openNewApplicantForm==='function')window.openNewApplicantForm();
  else setPage(page);
}));

bind('applicantForm','input',()=>{updateApplicantFormDerivedFields();checkDuplicate();});
bind('applicantForm','keydown',event=>{
  if(event.key!=='Enter')return;
  const tag=event.target.tagName;
  const type=(event.target.getAttribute('type')||'').toLowerCase();
  if(tag==='TEXTAREA'||type==='submit'||type==='button')return;
  event.preventDefault();
  const controls=[...$('applicantForm').querySelectorAll('input:not([type=hidden]), select, textarea')].filter(element=>!element.disabled&&element.offsetParent!==null);
  const index=controls.indexOf(event.target);
  if(index>=0&&controls[index+1])controls[index+1].focus();
});
bind('applicantForm','submit',event=>{
  event.preventDefault();
  if(window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return;
  const form=getForm();
  if(!form.name){alert('성명을 입력해주세요.');return;}
  const duplicate=findApplicantPhoneEmailDuplicate(form,form.editId);
  if(duplicate&&!confirm(`중복 가능성이 있습니다: ${duplicate.name}\n그래도 저장할까요?`))return;
  const excelPending=String(window.__erpExcelPastePendingApplicant||'');
  const previous=applicants.slice();
  let savedId=form.editId||'';
  if(form.editId)applicants=applicants.map(applicant=>applicant.id===form.editId?normalize({...applicant,...form,id:form.editId,updatedAt:new Date().toISOString()}):applicant);
  else{savedId=uid();applicants.unshift(normalize({...form,id:savedId,createdAt:new Date().toISOString()}));}
  if(typeof window.erpMarkExcelApplicants==='function'&&((form.editId&&excelPending===String(form.editId))||(!form.editId&&excelPending==='__new__')))window.erpMarkExcelApplicants(savedId);
  window.__erpExcelPastePendingApplicant='';
  if(!save()){
    applicants=previous;
    if(typeof window.applicantProgressHistoryRefreshSnapshots==='function')window.applicantProgressHistoryRefreshSnapshots();
    return;
  }
  resetForm();
  setPage('applicants');
  if(typeof window.erpRestoreApplicantListAfterSave==='function')window.erpRestoreApplicantListAfterSave(savedId);
});
bind('btnResetForm','click',resetForm);

bind('searchInput','input',event=>{currentSearch=event.target.value;renderTable();});
document.querySelectorAll('#workplaceTabs .tab').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('#workplaceTabs .tab').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');currentWorkplace=button.dataset.workplace;renderTable();
}));
document.querySelectorAll('#quickFilters .chip').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('#quickFilters .chip').forEach(item=>item.classList.remove('active'));
  button.classList.add('active');currentFilter=button.dataset.filter;renderTable();
}));
bind('sidebarToggle','click',()=>{
  if(window.innerWidth<=1020)document.body.classList.toggle('sidebar-mobile-open');
  else document.body.classList.toggle('sidebar-collapsed');
});
bind('btnResetFilters','click',()=>{resetListFiltersToAll();renderTable();});
bind('sortSelect','change',event=>{currentSort=event.target.value;renderTable();});
bind('hideFinished','change',event=>{hideFinished=event.target.checked;renderTable();});

bind('btnCsv','click',csv);
bind('btnJson','click',jsonBackup);
bind('jsonImport','change',event=>{
  if(window.erpPermissions&&!window.erpPermissions.require('backup.restore')){event.target.value='';return;}
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const {rows:data}=window.erpSecurity.parseImportJson(reader.result,{collection:'applicants',requireId:true});
      if(!Array.isArray(data)||!data.length){alert('지원자 백업 JSON 형식이 아니거나 데이터가 비어 있습니다.');return;}
      if(!confirm(`JSON 가져오기 전 확인\n\n현재 저장된 지원자: ${applicants.length}명\n가져올 지원자: ${data.length}명\n\n현재 지원자 목록을 가져온 파일 기준으로 교체할까요?`))return;
      const previous=applicants;
      applicants=data.map(normalize);
      if(!save()){applicants=previous;return;}
      alert(`가져오기 완료: ${applicants.length}명`);
    }catch{alert('JSON 파일을 확인해주세요.');}
    finally{event.target.value='';}
  };
  reader.readAsText(file);
});
bind('jsonImportMerge','change',event=>{
  if(window.erpPermissions&&!window.erpPermissions.require('backup.restore')){event.target.value='';return;}
  const file=event.target.files[0];
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const {rows:data}=window.erpSecurity.parseImportJson(reader.result,{collection:'applicants',requireId:true});
      if(!Array.isArray(data)||!data.length){alert('지원자 백업 JSON 형식이 아니거나 데이터가 비어 있습니다.');return;}
      const incoming=data.map(normalize);
      const map=Object.fromEntries(applicants.map(applicant=>[applicant.id,applicant]));
      let updatedCount=0,addedCount=0;
      incoming.forEach(candidate=>{
        const local=map[candidate.id];
        if(!local){map[candidate.id]=candidate;addedCount+=1;return;}
        if((candidate.updatedAt||candidate.createdAt||'')>(local.updatedAt||local.createdAt||'')){map[candidate.id]=candidate;updatedCount+=1;}
      });
      const beforeCount=applicants.length;
      if(!confirm(`JSON 병합 가져오기 전 확인\n\n현재 지원자: ${beforeCount}명\n파일 지원자: ${incoming.length}명\n\n기존 지원자는 지우지 않고 새 데이터와 최신 수정본만 반영할까요?`))return;
      const previous=applicants;
      applicants=Object.values(map);
      if(!save()){applicants=previous;return;}
      alert(`병합 완료: 최종 ${applicants.length}명 (신규 ${addedCount}명, 갱신 ${updatedCount}명)`);
    }catch{alert('JSON 파일을 확인해주세요.');}
    finally{event.target.value='';}
  };
  reader.readAsText(file);
});
bind('btnClearAll','click',()=>{
  if(window.erpPermissions&&!window.erpPermissions.require('applicant.delete'))return;
  if(!applicants.length){alert('삭제할 지원자가 없습니다.');return;}
  if(!confirm(`현재 브라우저의 지원자 ${applicants.length}명을 모두 삭제할까요?\n\n필요하면 먼저 암호화 백업을 내려받으세요.`))return;
  if(prompt('정말 삭제하려면 아래 문구를 그대로 입력하세요.\n\n전체삭제')!=='전체삭제'){alert('삭제가 취소되었습니다.');return;}
  const previous=applicants;
  applicants=[];
  if(!save()){applicants=previous;return;}
  alert('전체 삭제를 완료했습니다.');
});

bind('btnCloseDetail','click',closeDetail);
bind('detailBackdrop','click',closeDetail);
const openApplicantEditFromDetail=()=>{
  const id=detailCurrentId;
  window.__erpApplicantDetailEditPending=true;
  closeDetail(true);
  try{if(id)editApplicant(id);}finally{window.__erpApplicantDetailEditPending=false;}
};
bind('btnDetailEdit','click',openApplicantEditFromDetail);
bind('btnDetailEditTop','click',openApplicantEditFromDetail);
bind('btnCopySummary','click',async()=>{
  const applicant=applicants.find(item=>item.id===detailCurrentId);
  if(!applicant)return;
  try{await navigator.clipboard.writeText(applicantSummary(applicant));alert('지원자 요약이 복사됐습니다.');}
  catch{alert('복사가 막히면 상세 내용을 직접 드래그해서 복사해주세요.');}
});

bind('btnOpenExcelRowPaste','click',openExcelRowPaste);
const openNewApplicantExcelPaste=()=>{
  if(window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return;
  const opened=typeof window.openNewApplicantForm==='function'
    ? window.openNewApplicantForm()
    : (resetForm(),setPage('form'),true);
  if(opened===false)return;
  requestAnimationFrame(()=>openExcelRowPaste());
};
document.querySelectorAll('[data-excel-paste-shortcut]').forEach(button=>button.addEventListener('click',openNewApplicantExcelPaste));
bind('btnCloseExcelRowPaste','click',closeExcelRowPaste);
bind('btnCancelExcelPaste','click',closeExcelRowPaste);
bind('excelRowPasteBackdrop','click',closeExcelRowPaste);
bind('btnParseExcelRow','click',parseExcelRowPaste);
bind('btnClearExcelPaste','click',()=>{resetExcelRowPaste();$('excelPasteRaw')?.focus();});
bind('btnApplyExcelPaste','click',applyExcelRowPasteToForm);
bind('btnRegisterExcelBatch','click',registerExcelPasteBatch);
bind('btnUndoExcelBatch','click',undoExcelPasteBatch);
bind('btnBatchSelectReady','click',excelPasteBatchSelectReady);
bind('btnBatchClearSelection','click',excelPasteBatchClearSelection);
bind('xpBatchWarningConfirm','change',excelPasteBatchUpdateSelectionState);
bind('xpBatchDuplicateConfirm','change',excelPasteBatchUpdateSelectionState);
bind('xpManualConfirm','change',excelPasteUpdateApplyState);
bind('excelPasteRaw','paste',()=>setTimeout(()=>{if(($('excelPasteRaw')?.value||'').includes('\t'))parseExcelRowPaste();},0));
const excelPasteBatch=$('excelPasteBatch');
if(excelPasteBatch){
  excelPasteBatch.addEventListener('change',event=>{if(event.target.matches('.excel-batch-select,[data-batch-field]'))excelPasteBatchHandleChange(event.target);});
  excelPasteBatch.addEventListener('click',event=>{const button=event.target.closest('[data-excel-batch-filter]');if(button)excelPasteBatchSetFilter(button.dataset.excelBatchFilter);});
}
const excelPasteEditor=$('excelPasteEditor');
if(excelPasteEditor){
  const refresh=source=>{
    if(!excelPasteParsedData)return;
    const sourceWrap=source?.closest?.('[data-field-wrap]');
    if(sourceWrap&&!source.classList.contains('excel-paste-apply'))excelPasteTouchedFields.add(sourceWrap.dataset.fieldWrap);
    const current=excelPasteCurrentApplicant();
    if(current&&source&&!source.classList.contains('excel-paste-apply')){
      const wrap=source.closest('[data-field-wrap]');
      if(wrap){
        const field=wrap.dataset.fieldWrap;
        const checkbox=wrap.querySelector('.excel-paste-apply');
        const changed=!excelPasteSameValue(field,current?.[field]||'',excelPasteGetField(field));
        if(checkbox)checkbox.checked=changed&&!!excelPasteSourcePresent[field]&&!!excelPasteText(excelPasteGetField(field));
      }
    }
    excelPasteUpdateApplyState();
  };
  excelPasteEditor.addEventListener('input',event=>refresh(event.target));
  excelPasteEditor.addEventListener('change',event=>{if(event.target.id==='xpDuplicateConfirm')excelPasteUpdateApplyState();else refresh(event.target);});
  excelPasteEditor.addEventListener('click',event=>{
    const button=event.target.closest('[data-excel-duplicate-id]');
    if(!button)return;
    event.preventDefault();event.stopPropagation();
    const id=button.dataset.excelDuplicateId;
    closeExcelRowPaste();
    if(id)viewApplicant(id);
  });
}
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if($('excelRowPasteModal')?.classList.contains('show'))closeExcelRowPaste();
  else if($('detailModal')?.classList.contains('show'))closeDetail();
});
