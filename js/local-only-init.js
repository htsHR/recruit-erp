/* =========================================================
   v12.0.2 LOCAL ONLY
   - 인증 UI와 세션 복원을 시작하지 않는다.
   - 외부 인증·동기화·공용폴더 연결 없이 브라우저 저장만 사용한다.
   ========================================================= */
function initializeLocalOnlyRuntime(){
  if(window.erpPermissions&&typeof window.erpPermissions.useLocal==='function')window.erpPermissions.useLocal();
  updateStorageNote();
}
function handleOperationEnvironmentChange(){ initializeLocalOnlyRuntime(); }
window.erpHandleOperationEnvironmentChange=handleOperationEnvironmentChange;
window.erpRuntimeMode='local-only';
window.erpLocalOnlyRuntime=Object.freeze({enabled:true,initialize:initializeLocalOnlyRuntime});

window.erpRuntimeReady=Promise.resolve(window.erpStateReady).then(state=>{
  if(!state?.ok)return {ok:false};
  try{
    resetForm();
    resetCalendarEventForm();
    renderAll();
    initializeLocalOnlyRuntime();
    if($('rosterDate')&&!$('rosterDate').value)$('rosterDate').value=today();
    return {ok:true};
  }catch{
    alert('화면 표시 중 오류가 발생했습니다. 페이지를 다시 열어주세요.');
    return {ok:false};
  }
});
