/* Recruit ERP v12.0.2 — one-time, fail-closed browser factory reset. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpFactoryReset=api;
  if(root.document){
    root.erpFactoryResetReady=api.run().then(result=>{
      if(!result.ok)api.showFailure();
      return result;
    });
  }
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const DATA_EPOCH='v12.0.2-reset-1';
  const EPOCH_KEY='recruit_erp_data_epoch';
  const DATABASE_NAME='recruit-erp-storage-v10-61';
  const PROJECT_AUTH_PREFIX='sb-yqijxkdmcpmvifkbamnr-';
  const APP_STORAGE_KEYS=Object.freeze([
    'recruit_erp',
    'recruit_erp_applicant_manager_assignments',
    'recruit_erp_applicant_worksheet_view_v1',
    'recruit_erp_applicants_stable',
    'recruit_erp_audit_logs_v1',
    'recruit_erp_backup_center_history',
    'recruit_erp_backup_pending_cloud_sync',
    'recruit_erp_calendar_events',
    'recruit_erp_cloud_delete_queue_v1055',
    'recruit_erp_cloud_last_success_at',
    'recruit_erp_cloud_sync_bases_v1053',
    'recruit_erp_cloud_sync_conflicts_v1053',
    'recruit_erp_cloud_sync_pending_v1053',
    'recruit_erp_current_user_name',
    'recruit_erp_duplicate_review_v10_38_2',
    'recruit_erp_employee_excel_compare_undo_v1',
    'recruit_erp_employee_org_import_last',
    'recruit_erp_employee_saved_filters_v1',
    'recruit_erp_employees',
    'recruit_erp_excel_paste_applicant_ids_v10_40_9',
    'recruit_erp_hire_waiting_profiles',
    'recruit_erp_interview_sessions_v1',
    'recruit_erp_last_backup_date',
    'recruit_erp_last_full_backup_at',
    'recruit_erp_last_full_backup_snapshot_v2',
    'recruit_erp_message_templates',
    'recruit_erp_nav_collapsed',
    'recruit_erp_production_readiness_v1100',
    'recruit_erp_reminder_dismissed_date',
    'recruit_erp_saved_advanced_searches',
    'recruit_erp_school_workforce_saved_views_v1',
    'recruit_erp_schools',
    'recruit_erp_sensitive_export_log',
    'recruit_erp_shared_storage_revision_meta_v1',
    'recruit_erp_ui_operation_environment',
    'recruit_erp_ui_school_favorites',
    'recruit_erp_ui_template_history',
    'recruit_erp_user_name',
    'recruit_erp_vercel_v1_applicants',
    'recruit_erp_vercel_v2_applicants',
    'resume_excel_like_v9_rows'
  ]);

  function storageKeys(storage){
    const keys=[];
    for(let index=0;index<Number(storage?.length||0);index++){
      const key=storage.key(index);
      if(typeof key==='string')keys.push(key);
    }
    return keys;
  }

  function clearTargetedStorage(storage=root.localStorage){
    if(!storage)throw new Error('STORAGE_UNAVAILABLE');
    storage.removeItem(EPOCH_KEY);
    for(const key of APP_STORAGE_KEYS)storage.removeItem(key);
    for(const key of storageKeys(storage)){
      if(key.startsWith(PROJECT_AUTH_PREFIX))storage.removeItem(key);
    }
  }

  function deleteDatabase(indexedDb=root.indexedDB){
    if(!indexedDb||typeof indexedDb.deleteDatabase!=='function')return Promise.resolve({supported:false,deleted:true});
    return new Promise((resolve,reject)=>{
      let settled=false;
      const request=indexedDb.deleteDatabase(DATABASE_NAME);
      request.onsuccess=()=>{if(!settled){settled=true;resolve({supported:true,deleted:true});}};
      request.onerror=()=>{if(!settled){settled=true;reject(new Error('INDEXEDDB_DELETE_FAILED'));}};
      request.onblocked=()=>{if(!settled){settled=true;reject(new Error('INDEXEDDB_DELETE_BLOCKED'));}};
    });
  }

  async function verifyDatabaseRemoved(indexedDb=root.indexedDB){
    if(!indexedDb||typeof indexedDb.databases!=='function')return true;
    const databases=await indexedDb.databases();
    return !databases.some(item=>item&&item.name===DATABASE_NAME);
  }

  async function run(options={}){
    const storage=options.storage||root.localStorage;
    const indexedDb=options.indexedDB||root.indexedDB;
    try{
      if(storage?.getItem(EPOCH_KEY)===DATA_EPOCH)return {ok:true,reset:false,epoch:DATA_EPOCH};
      clearTargetedStorage(storage);
      await deleteDatabase(indexedDb);
      if(!await verifyDatabaseRemoved(indexedDb))throw new Error('INDEXEDDB_DELETE_NOT_VERIFIED');
      storage.setItem(EPOCH_KEY,DATA_EPOCH);
      return {ok:true,reset:true,epoch:DATA_EPOCH,removedKeys:APP_STORAGE_KEYS.length};
    }catch{
      try{storage?.removeItem?.(EPOCH_KEY);}catch{}
      return {ok:false,reset:false,code:'FACTORY_RESET_FAILED'};
    }
  }

  function showFailure(){
    const render=()=>{
      if(!root.document?.body)return;
      root.document.body.innerHTML='<main class="factory-reset-failure" role="alert"><h1>브라우저 초기화를 완료하지 못했습니다.</h1><p>다른 Recruit ERP 창을 모두 닫은 뒤 이 페이지를 다시 열어주세요.</p></main>';
      root.document.documentElement.classList.remove('ux12-booting');
    };
    if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',render,{once:true});else render();
  }

  return Object.freeze({DATA_EPOCH,EPOCH_KEY,DATABASE_NAME,PROJECT_AUTH_PREFIX,APP_STORAGE_KEYS,storageKeys,clearTargetedStorage,deleteDatabase,verifyDatabaseRemoved,run,showFailure});
});
