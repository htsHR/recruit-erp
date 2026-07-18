document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.go)));
bind('applicantForm','input',()=>{ updateScorePreview(); checkDuplicate(); });
bind('applicantForm','keydown', e=>{
  if(e.key !== 'Enter') return;
  const tag = e.target.tagName;
  const type = (e.target.getAttribute('type') || '').toLowerCase();
  if(tag === 'TEXTAREA' || type === 'submit' || type === 'button') return;
  e.preventDefault();
  const form = $('applicantForm');
  const controls = [...form.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(el=>!el.disabled && el.offsetParent !== null);
  const idx = controls.indexOf(e.target);
  if(idx >= 0 && controls[idx+1]) controls[idx+1].focus();
});
bind('applicantForm','submit',e=>{
  e.preventDefault();
  const f=getForm();
  if(!f.name){ alert('성명을 입력해주세요.'); return; }
  const fPhone=normalizePhone(f.phone);
  const dup=applicants.find(a=>a.id!==f.editId&&((fPhone&&fPhone.length>=8&&normalizePhone(a.phone)===fPhone)||(f.email&&a.email===f.email)));
  if(dup&&!confirm(`중복 가능성이 있습니다: ${dup.name}\n그래도 저장할까요?`)) return;
  const excelPending=String(window.__erpExcelPastePendingApplicant||'');
  let savedId=f.editId||'';
  if(f.editId){ applicants=applicants.map(a=>a.id===f.editId?normalize({...a,...f,id:f.editId,updatedAt:new Date().toISOString()}):a); }
  else { savedId=uid(); applicants.unshift(normalize({...f,id:savedId,createdAt:new Date().toISOString()})); }
  if(typeof window.erpMarkExcelApplicants==='function'&&((f.editId&&excelPending===String(f.editId))||(!f.editId&&excelPending==='__new__')))window.erpMarkExcelApplicants(savedId);
  window.__erpExcelPastePendingApplicant='';
  resetForm(); save(); setPage('applicants');
});
bind('btnResetForm','click', resetForm);
bind('searchInput','input',e=>{ currentSearch=e.target.value; renderTable(); });
document.querySelectorAll('#workplaceTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); currentWorkplace=b.dataset.workplace; renderTable(); }));
document.querySelectorAll('#quickFilters .chip').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); currentFilter=b.dataset.filter; renderTable(); }));
/* v10.21.0: 사이드바 그룹 접기/펴기 상태 저장 */
function loadNavCollapsed(){
  try{ const raw=localStorage.getItem(NAV_COLLAPSE_KEY); return raw ? JSON.parse(raw) : {}; }catch{ return {}; }
}
function saveNavCollapsed(state){ localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(state)); }
(function initNavGroups(){
  const collapsed = loadNavCollapsed();
  document.querySelectorAll('.nav-group').forEach(g=>{
    const key = g.dataset.navgroup;
    if(collapsed[key]) g.classList.add('collapsed');
  });
  document.querySelectorAll('[data-navtoggle]').forEach(b=>b.addEventListener('click',()=>{
    const group = b.closest('.nav-group');
    if(!group) return;
    group.classList.toggle('collapsed');
    const state = loadNavCollapsed();
    state[group.dataset.navgroup] = group.classList.contains('collapsed');
    saveNavCollapsed(state);
  }));
})();
document.querySelectorAll('#schoolSubTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#schoolSubTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  const isManage = b.dataset.schooltab==='manage';
  if($('schoolRankView')) $('schoolRankView').style.display = isManage ? 'none' : '';
  if($('schoolManageView')) $('schoolManageView').style.display = isManage ? '' : 'none';
}));
document.querySelectorAll('#schoolRankTypeTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#schoolRankTypeTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); schoolRankTypeFilter=b.dataset.schoolranktype; renderSchools();
}));
document.querySelectorAll('#schoolManageTypeTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#schoolManageTypeTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); schoolManageTypeFilter=b.dataset.schoolmanagetype; schoolManagePage=1; renderSchoolManage();
}));
bind('schoolHideLowVolume','change',e=>{ schoolHideLowVolume=e.target.checked; renderSchools(); });
bind('schoolManageSort','change',e=>{ schoolManageSort=e.target.value; schoolManageSortDirection=(schoolManageSort==='applicant'||schoolManageSort==='employee')?'desc':'asc'; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageSearch','input',e=>{ schoolManageSearch=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageRegion','change',e=>{ schoolManageRegionFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageContact','change',e=>{ schoolManageContactFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageMou','change',e=>{ schoolManageMouFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageStatus','change',e=>{ schoolManageStatusFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageHasApplicants','change',e=>{ schoolManageHasApplicants=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageHasEmployees','change',e=>{ schoolManageHasEmployees=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageMissingHistory','change',e=>{ schoolManageMissingHistory=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageUnclassified','change',e=>{ schoolManageUnclassifiedFilter=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('btnResetSchoolManageFilters','click',resetSchoolManageFilters);
bind('btnApplySchoolFilters','click',()=>{ schoolManagePage=1; renderSchoolManage(); });
bind('sidebarToggle','click',()=>{
  if(window.innerWidth<=1020){
    document.body.classList.toggle('sidebar-mobile-open');
  }else{
    document.body.classList.toggle('sidebar-collapsed');
  }
});
bind('btnToggleSchoolEditPanel','click',()=>toggleSchoolRegisterForm(false));
bind('btnOpenSchoolRegister','click',()=>{
  toggleSchoolRegisterForm(true);
  const panel=$('schoolEditPanel');
  if(panel && panel.scrollIntoView) panel.scrollIntoView({behavior:'smooth', block:'start'});
});
document.querySelectorAll('#schoolManageKpiGrid .school-kpi-card').forEach(b=>b.addEventListener('click',()=>applySchoolKpiFilter(b.dataset.kpi)));
bind('btnToggleSchoolFilters','click',toggleSchoolManageFilters);
bind('schoolManagePageSize','change',e=>{ schoolManagePageSize=Number(e.target.value)||30; schoolManagePage=1; renderSchoolManage(); });
bind('btnAddSchool','click', submitSchoolForm);
bind('schoolJsonImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.schools) ? parsed.schools : []);
      if(!confirm(`학교 ${data.length}개를 가져올까요? 기존 학교는 지워지지 않고, 이름이 같으면 별칭/구분 정보만 보강됩니다.`)) return;
      importSchoolsJson(data);
    }catch{ alert('학교 JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('schoolHrStatsImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.stats) ? parsed.stats : []);
      if(!confirm(`학교 HR 통계 ${data.length}건을 반영할까요? 개인정보는 담겨있지 않은 학교 단위 집계 수치입니다.`)) return;
      importSchoolHrStats(data);
    }catch{ alert('HR 통계 JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('school','input', renderSchoolSimilarHint);
bind('btnAddEmployee','click', submitEmployeeForm);
bind('empSchool','input', ()=>renderSchoolSimilarHintFor('empSchool','empSchoolSimilarHint'));
bind('employeeJsonImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.employees) ? parsed.employees : []);
      if(!confirm(`직원 ${data.length}명을 가져올까요? 사번이 같으면 정보가 갱신되고, 새 사번이면 추가됩니다.`)) return;
      importEmployeesJson(data);
    }catch{ alert('직원명부 JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
document.addEventListener('click',e=>{ if(!e.target.closest('.row-more-menu')) closeAllRowMoreMenus(); });
window.addEventListener('scroll',closeAllRowMoreMenus,true);
window.addEventListener('resize',closeAllRowMoreMenus);
document.querySelectorAll('#employeeStatusTabs [data-empstatus]').forEach(b=>b.addEventListener('click',()=>setEmployeeStatusFilter(b.dataset.empstatus)));
document.querySelectorAll('[data-employee-summary-status]').forEach(b=>b.addEventListener('click',()=>setEmployeeStatusFilter(b.dataset.employeeSummaryStatus)));
document.querySelectorAll('#employeeViewTabs [data-empview]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#employeeViewTabs [data-empview]').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');employeeViewMode=b.dataset.empview;
  if($('employeeListView'))$('employeeListView').style.display=employeeViewMode==='list'?'':'none';
  if($('employeeDeptView'))$('employeeDeptView').style.display=employeeViewMode==='dept'?'':'none';
}));
bind('btnEmployeeSearch','click',applyEmployeeSearch);
['empSearchName','empSearchNo','empSearchSchool'].forEach(id=>bind(id,'keydown',e=>{if(e.key==='Enter')applyEmployeeSearch();}));
bind('btnEmployeeResetFilters','click',resetEmployeeFilters);
bind('btnCsvEmployees','click',csvEmployees);
bind('btnEmployeeAddFromList','click',()=>{resetEmployeeForm();const d=$('employeeEntryDetails');if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'});}setTimeout(()=>$('empName')?.focus(),250);});
bind('btnCancelEmployeeEdit','click',resetEmployeeForm);
bind('btnDeleteEmployeeRecord','click',deleteEditingEmployee);
bind('btnEmployeeDetailEdit','click',editEmployeeFromDetail);
bind('btnGoSchools','click',()=>setPage('schools'));
bind('btnResetFilters','click',()=>{ resetListFiltersToAll(); renderTable(); });
bind('sortSelect','change',e=>{ currentSort=e.target.value; renderTable(); });
bind('statsYearSelect','change', renderStatsMonth);
bind('statsWorkplaceFilter','change', e=>{ statsWorkplaceFilter = e.target.value; renderHireStats(); });
bind('hideFinished','change',e=>{ hideFinished=e.target.checked; renderTable(); });
bind('btnMakeTemplate','click', makeTemplate);
bind('btnCopyTemplate','click', async()=>{ try{ await navigator.clipboard.writeText($('templateOutput').value); alert('복사됐습니다.'); }catch{ alert('복사가 막히면 직접 드래그해서 복사해주세요.'); } });
bind('btnCsv','click', csv);
bind('btnJson','click', jsonBackup);
bind('jsonImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.applicants) ? parsed.applicants : []);
      if(!Array.isArray(data) || !data.length){ alert('지원자 백업 JSON 형식이 아니거나 데이터가 비어 있습니다.'); return; }
      const ok=confirm(`JSON 가져오기 전 확인\n\n현재 저장된 지원자: ${applicants.length}명\n가져올 지원자: ${data.length}명\n\n가져오면 현재 브라우저의 지원자 목록이 가져온 파일 기준으로 교체됩니다. 진행할까요?`);
      if(!ok) return;
      supabaseSnapshotSave('가져오기 직전 자동 백업').then(()=>{
        applicants=data.map(normalize);
        save();
        renderSnapshotList();
        alert(`가져오기 완료: ${applicants.length}명`);
      });
    }catch{ alert('JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('jsonImportMerge','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.applicants) ? parsed.applicants : []);
      if(!Array.isArray(data) || !data.length){ alert('지원자 백업 JSON 형식이 아니거나 데이터가 비어 있습니다.'); return; }
      const incoming=data.map(normalize);
      const map={};
      applicants.forEach(a=>{ map[a.id]=a; });
      let updatedCount=0, addedCount=0;
      incoming.forEach(c=>{
        const l=map[c.id];
        if(!l){ map[c.id]=c; addedCount++; return; }
        const lt=l.updatedAt||l.createdAt||'';
        const ct=c.updatedAt||c.createdAt||'';
        if(ct>lt){ map[c.id]=c; updatedCount++; }
      });
      const beforeCount=applicants.length;
      const ok=confirm(`JSON 병합 가져오기 전 확인\n\n현재 저장된 지원자: ${beforeCount}명\n가져올 파일 지원자: ${incoming.length}명\n\n기존 지원자는 지워지지 않습니다. id가 같으면 더 최근에 수정된 쪽을 채택하고, 새 id는 그대로 추가됩니다. 진행할까요?`);
      if(!ok) return;
      supabaseSnapshotSave('병합 가져오기 직전 자동 백업').then(()=>{
        applicants=Object.keys(map).map(k=>map[k]);
        save();
        renderSnapshotList();
        alert(`병합 완료: 기존 ${beforeCount}명 + 가져온 파일 ${incoming.length}명 -> 최종 ${applicants.length}명 (신규 ${addedCount}명, 갱신 ${updatedCount}명, 데이터 손실 없음)`);
      });
    }catch{ alert('JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('btnClearAll','click',()=>{
  if(!confirm(`현재 브라우저의 지원자 ${applicants.length}명을 모두 삭제할까요?\n\n삭제 직전 자동으로 클라우드에 백업을 남겨둡니다.`)) return;
  const phrase=prompt('정말 삭제하려면 아래 문구를 그대로 입력하세요.\n\n전체삭제');
  if(phrase !== '전체삭제'){ alert('삭제가 취소되었습니다.'); return; }
  supabaseSnapshotSave('전체삭제 직전 자동 백업').then(()=>{
    applicants=[];
    supabaseDeleteAll();
    save();
    renderSnapshotList();
    alert('전체 삭제 완료 (삭제 전 상태는 백업/내보내기 화면에서 복원 가능합니다)');
  });
});
bind('btnCloseDetail','click', closeDetail);
bind('detailBackdrop','click', closeDetail);
bind('btnDetailEdit','click',()=>{ const id=detailCurrentId; closeDetail(); if(id) editApplicant(id); });
bind('btnCloseSchoolDetail','click', closeSchoolDetail);
bind('schoolDetailBackdrop','click', closeSchoolDetail);
bind('btnSaveSchoolDetail','click', saveSchoolDetailHistory);
bind('btnCloseEmployeeDetail','click', closeEmployeeDetail);
bind('employeeDetailBackdrop','click', closeEmployeeDetail);
bind('btnCancelSchoolEdit','click', resetSchoolForm);
bind('btnCopySummary','click',async()=>{ const a=applicants.find(x=>x.id===detailCurrentId);
  if(!a) return; try{ await navigator.clipboard.writeText(applicantSummary(a)); alert('지원자 요약이 복사됐습니다.');
  }catch{ alert('복사가 막히면 상세 내용을 직접 드래그해서 복사해주세요.'); } });


/* v10.40.7 엑셀 한 행·여러 행 붙여넣기 이벤트 */
bind('btnOpenExcelRowPaste','click',openExcelRowPaste);
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
bind('excelPasteRaw','paste',()=>setTimeout(()=>{
  const raw=$('excelPasteRaw')?.value||'';
  if(raw.includes('\t'))parseExcelRowPaste();
},0));
const excelPasteBatchEl=$('excelPasteBatch');
if(excelPasteBatchEl){
  excelPasteBatchEl.addEventListener('change',e=>{if(e.target.matches('.excel-batch-select,[data-batch-field]'))excelPasteBatchHandleChange(e.target);});
}
const excelPasteEditorEl=$('excelPasteEditor');
if(excelPasteEditorEl){
  const refreshExcelPaste=source=>{
    if(!excelPasteParsedData)return;
    const sourceWrap=source?.closest?.('[data-field-wrap]');
    if(sourceWrap&&!source.classList.contains('excel-paste-apply'))excelPasteTouchedFields.add(sourceWrap.dataset.fieldWrap);
    const current=excelPasteCurrentApplicant();
    if(current&&source&&!source.classList.contains('excel-paste-apply')){
      const wrap=source.closest('[data-field-wrap]');
      if(wrap){
        const field=wrap.dataset.fieldWrap,check=wrap.querySelector('.excel-paste-apply');
        const changed=!excelPasteSameValue(field,current?.[field]||'',excelPasteGetField(field));
        if(check)check.checked=changed&&!!excelPasteSourcePresent[field]&&!!excelPasteText(excelPasteGetField(field));
      }
    }
    excelPasteUpdateApplyState();
  };
  excelPasteEditorEl.addEventListener('input',e=>refreshExcelPaste(e.target));
  excelPasteEditorEl.addEventListener('change',e=>{
    if(e.target.id==='xpDuplicateConfirm')return;
    refreshExcelPaste(e.target);
  });
  excelPasteEditorEl.addEventListener('click',e=>{
    const button=e.target.closest('[data-excel-duplicate-id]');
    if(!button)return;
    e.preventDefault(); e.stopPropagation();
    const id=button.dataset.excelDuplicateId;
    closeExcelRowPaste();
    if(id)viewApplicant(id);
  });
  excelPasteEditorEl.addEventListener('change',e=>{
    if(e.target.id==='xpDuplicateConfirm')excelPasteUpdateApplyState();
  });
}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&$('excelRowPasteModal')?.classList.contains('show'))closeExcelRowPaste();
});
