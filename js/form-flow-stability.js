/* =========================================================
   v10.46.8.4 FORM FLOW STABILITY
   - 최종 setPage 래퍼 이후에도 신규/수정 폼이 남지 않도록 마지막 단계에서 보호
   - 폼을 떠날 때 저장하지 않은 입력은 확인 후 폐기하고, 수정 ID까지 완전히 초기화
   ========================================================= */
(function(){
  'use strict';
  const previousSetPage=window.setPage;
  if(typeof previousSetPage!=='function' || previousSetPage.__formFlowStabilityV104684) return;

  function formIsDirty(){
    return typeof window.erpApplicantFormIsDirty==='function' && !!window.erpApplicantFormIsDirty();
  }

  function stableSetPage(page){
    const active=document.querySelector('.page.active')?.id||'';
    if(active==='form' && page!=='form'){
      if(formIsDirty() && !confirm('저장하지 않은 입력 내용이 있습니다.\n나가면 작성한 내용이 사라집니다. 계속 이동할까요?')) return false;
      if(typeof window.resetForm==='function') window.resetForm();
    }
    return previousSetPage.apply(this,arguments);
  }
  stableSetPage.__formFlowStabilityV104684=true;
  window.setPage=stableSetPage;
})();
