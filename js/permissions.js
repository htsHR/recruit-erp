/* Recruit ERP v12.5.0 LOCAL ONLY permission guards (no management UI). */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpPermissions=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const VERSION='12.5.0';
  const ROLE_LABELS={admin:'관리자',recruiter:'채용담당자',viewer:'조회 전용',local_admin:'로컬 관리자',legacy_admin:'설정 전 관리자'};
  const PERMISSIONS={
    admin:['*'],local_admin:['*'],legacy_admin:['*'],
    recruiter:['applicant.read','applicant.write','schedule.read','schedule.write','export.standard','audit.write'],
    viewer:['applicant.read','schedule.read']
  };
  let state={role:'local_admin',email:'',userId:'',ready:true,source:'local',setupRequired:false,error:''};
  let applying=false;
  function roleLabel(role){return ROLE_LABELS[role]||ROLE_LABELS.viewer;}
  function permissionsFor(role){return PERMISSIONS[role]||PERMISSIONS.viewer;}
  function has(permission,role=state.role){const list=permissionsFor(role);return list.includes('*')||list.includes(permission);}
  function denyMessage(permission){
    const labels={'applicant.write':'지원자 등록·수정','applicant.delete':'지원자 삭제','schedule.write':'면접·일정 변경','backup.manage':'백업·복원','backup.restore':'백업 복원','export.standard':'일반 내보내기'};
    return `${labels[permission]||'이 기능'} 권한이 없습니다. 현재 권한: ${roleLabel(state.role)}`;
  }
  function requirePermission(permission,options={}){if(has(permission))return true;if(options.notify!==false&&typeof root.alert==='function')root.alert(denyMessage(permission));return false;}
  function current(){return {...state};}
  function setState(next){state={...state,...next};applyUi();root.document?.dispatchEvent(new CustomEvent('erp:permission-change',{detail:current()}));return current();}
  function useLocal(email='',role='local_admin'){const safeRole=Object.hasOwn(ROLE_LABELS,role)?role:'local_admin';return setState({role:safeRole,email,userId:'',ready:true,source:'local',setupRequired:false,error:''});}
  function reset(){return useLocal();}
  async function load(){return useLocal();}
  async function loadUsers(){return [];}
  async function changeRole(){root.alert?.('LOCAL ONLY에서는 계정별 권한 변경을 사용하지 않습니다.');return false;}
  function requiredPermission(element){
    if(!element)return '';
    const explicit=element.closest?.('[data-required-permission]')?.dataset.requiredPermission;
    if(explicit)return explicit;
    const id=element.id||'',handler=element.getAttribute?.('data-erp-handler')||'',page=element.dataset?.page||element.dataset?.go||'';
    if(page==='backup')return 'backup.manage';
    if(page==='form')return 'applicant.write';
    if(/deleteApplicant|btnDeleteAll|btnClearAll/i.test(handler+' '+id))return 'applicant.delete';
    if(/restoreSnapshot|FullRestore|MergeApply|ReplaceApply/i.test(handler+' '+id))return 'backup.restore';
    if(/DetailEdit|QuickStatus|submitBtn|ExcelPaste|bulkApply|Screening|PhoneInterview/i.test(id))return 'applicant.write';
    if(/Calendar.*(Save|Delete|Apply|Bulk)|btnSaveCalendar/i.test(id))return 'schedule.write';
    return '';
  }
  function guardEvent(event){
    const target=event.target?.closest?.('button,a,input,select,textarea,form,[role="button"]')||event.target;
    const permission=requiredPermission(target);
    if(!permission||has(permission))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.type!=='change'||target?.tagName!=='SELECT')requirePermission(permission);
  }
  function mark(selector,permission,hide=true){
    root.document?.querySelectorAll(selector).forEach(element=>{
      element.dataset.requiredPermission=permission;
      const allowed=has(permission);
      element.classList.toggle('erp-permission-hidden',hide&&!allowed);
      element.classList.toggle('erp-permission-disabled',!hide&&!allowed);
      if(!hide&&'disabled'in element)element.disabled=!allowed;
      element.setAttribute('aria-disabled',allowed?'false':'true');
    });
  }
  function applyUi(){
    if(!root.document||applying)return;
    applying=true;
    try{
      mark('[data-page="form"],[data-go="form"],#btnDetailEdit,#btnDetailEditTop,#btnHomeStartScreening,#btnHomeStartPhoneInterview,#btnStartScreeningWorkbench,#btnStartPhoneInterview,#btnDailyStartFirst,[data-required-permission="applicant.write"]','applicant.write');
      mark('[data-page="backup"],[data-go="backup"]','backup.manage');
      mark('#btnDeleteAll,#btnClearAll,[data-erp-handler*="deleteApplicant"]','applicant.delete');
      mark('#btnJson,#jsonImport,#jsonImportMerge','backup.manage');
      mark('#btnCsv,#bulkCsv,#bulkPrint','export.standard');
      mark('#detailQuickStatus','applicant.write',false);
      const roleText=root.document.getElementById('topbarUserRole');
      if(roleText)roleText.textContent=roleLabel(state.role);
      root.document.documentElement.dataset.erpRole=state.role;
      const active=root.document.querySelector('.page.active');
      if(active&&((active.id==='form'&&!has('applicant.write'))||(active.id==='backup'&&!has('backup.manage'))))root.setPage?.('home');
    }finally{applying=false;}
  }
  function renderPage(){return null;}
  function init(){
    if(!root.document)return;
    root.document.addEventListener('click',guardEvent,true);
    root.document.addEventListener('submit',guardEvent,true);
    root.document.addEventListener('change',guardEvent,true);
    const observer=new MutationObserver(()=>{if(!applying)applyUi();});
    observer.observe(root.document.body,{subtree:true,childList:true});
    applyUi();
  }
  const api={VERSION,ROLE_LABELS,PERMISSIONS,roleLabel,permissionsFor,has,require:requirePermission,current,useLocal,reset,load,loadUsers,changeRole,requiredPermission,applyUi,renderPage,init};
  if(root.document)init();
  return api;
});
