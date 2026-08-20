/* =========================================================
   v12.0.1 LOCAL ONLY
   - 인증 UI와 세션 복원을 시작하지 않는다.
   - 기존 클라우드 코드와 원격 자료는 그대로 두고 런타임 호출만 차단한다.
   - 브라우저 로컬 자료와 회사 공용폴더 보조 저장 흐름은 그대로 사용한다.
   ========================================================= */
function initializeLocalOnlyRuntime(){
  cloudAuthenticated=false;
  cloudSyncStatus='unknown';
  if(window.erpPermissions&&typeof window.erpPermissions.useLocal==='function')window.erpPermissions.useLocal();
  updateStorageNote();
  renderSnapshotList();
}
function handleOperationEnvironmentChange(){ initializeLocalOnlyRuntime(); }
window.erpHandleOperationEnvironmentChange=handleOperationEnvironmentChange;
window.erpLocalOnlyRuntime=Object.freeze({enabled:true,initialize:initializeLocalOnlyRuntime});

try{
  resetForm();
  resetCalendarEventForm();
  renderAll();
  initializeLocalOnlyRuntime();
  if($('rosterDate') && !$('rosterDate').value) $('rosterDate').value=today();
}catch(e){
  console.error('Recruit ERP render error',e);
  alert('화면 표시 중 오류가 발생했습니다. app.js 교체 상태를 확인해주세요.');
}
