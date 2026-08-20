/* Recruit ERP v12.0.2 LOCAL ONLY permissions and UI guards. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpPermissions=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const VERSION='12.0.2';
  const ROLE_LABELS={admin:'관리자',recruiter:'채용담당자',viewer:'조회 전용',local_admin:'로컬 관리자',legacy_admin:'설정 전 관리자'};
  const PERMISSIONS={
    admin:['*'],local_admin:['*'],legacy_admin:['*'],
    recruiter:['applicant.read','applicant.write','schedule.read','schedule.write','school.read','employee.read','stats.read','export.standard','message.write','audit.write'],
    viewer:['applicant.read','schedule.read','school.read','employee.read','stats.read']
  };
  let state={role:'local_admin',email:'',userId:'',ready:true,source:'local',setupRequired:false,error:''};
  let applying=false;

  function roleLabel(role){return ROLE_LABELS[role]||ROLE_LABELS.viewer;}
  function permissionsFor(role){return PERMISSIONS[role]||PERMISSIONS.viewer;}
  function has(permission,role=state.role){const list=permissionsFor(role);return list.includes('*')||list.includes(permission);}
  function denyMessage(permission){
    const labels={'applicant.write':'지원자 등록·수정','applicant.delete':'지원자 삭제','schedule.write':'면접·일정 변경','employee.write':'사원명부 수정','employee.delete':'사원 삭제','school.write':'협력학교 수정','school.delete':'협력학교 삭제','backup.manage':'백업·복원','backup.restore':'백업 복원','export.standard':'일반 내보내기','sensitive.read':'주민등록번호 조회','user.manage':'사용자 권한 설정','readiness.manage':'운영 준비 점검','message.write':'안내문 저장'};
    return `${labels[permission]||'이 기능'} 권한이 없습니다. 현재 권한: ${roleLabel(state.role)}`;
  }
  function requirePermission(permission,options={}){if(has(permission))return true;if(options.notify!==false&&typeof root.alert==='function')root.alert(denyMessage(permission));return false;}
  function current(){return {...state};}
  function setState(next){state={...state,...next};applyUi();renderPage();root.document?.dispatchEvent(new CustomEvent('erp:permission-change',{detail:current()}));return current();}
  function useLocal(email='',role='local_admin'){const safeRole=Object.hasOwn(ROLE_LABELS,role)?role:'local_admin';return setState({role:safeRole,email,userId:'',ready:true,source:'local',setupRequired:false,error:''});}
  function reset(){return useLocal();}
  async function load(){return useLocal();}
  async function loadUsers(){if(!requirePermission('user.manage'))return [];renderPage();return [];}
  async function changeRole(){if(!requirePermission('user.manage'))return false;root.alert?.('LOCAL ONLY에서는 계정별 권한 변경을 사용하지 않습니다.');return false;}
  function badgeHtml(role=state.role){const tone=role==='admin'?'is-admin':role==='recruiter'?'is-recruiter':role==='viewer'?'is-viewer':'is-warning';return `<span class="permission-role-badge ${tone}">${escapeHtml(roleLabel(role))}</span>`;}
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function requiredPermission(element){
    if(!element)return '';
    const explicit=element.closest?.('[data-required-permission]')?.dataset.requiredPermission;if(explicit)return explicit;
    const id=element.id||'',handler=element.getAttribute?.('data-erp-handler')||'',page=element.dataset?.page||element.dataset?.go||'';
    if(page==='permissions')return 'user.manage';if(page==='auditHistory')return 'audit.read';if(page==='backup')return 'backup.manage';if(page==='storagePerformance')return 'storage.manage';if(page==='productionReadiness')return 'readiness.manage';if(page==='form')return 'applicant.write';
    if(/deleteApplicant|btnDeleteAll|btnClearAll/i.test(handler+' '+id))return 'applicant.delete';if(/deleteEmployee|DeleteEditingEmployee/i.test(handler+' '+id))return 'employee.delete';if(/deleteSchool|SchoolMerge/i.test(handler+' '+id))return 'school.delete';if(/restoreSnapshot|FullRestore|MergeApply|ReplaceApply/i.test(handler+' '+id))return 'backup.restore';if(/DetailEdit|QuickStatus|submitBtn|ExcelPaste|bulkApply|Screening|PhoneInterview/i.test(id))return 'applicant.write';if(/Calendar.*(Save|Delete|Apply|Bulk)|btnSaveCalendar/i.test(id))return 'schedule.write';if(/Employee.*(Edit|Save|Import|Apply|Status|Relation)|btnOpenEmployeeEntry/i.test(id))return 'employee.write';if(/School.*(Edit|Save|Import|Apply|Merge|AutoLink)|btnAddSchool/i.test(id))return 'school.write';if(/MessageTemplate.*(Save|Delete|New)/i.test(id))return 'message.write';return '';
  }
  function guardEvent(event){const target=event.target?.closest?.('button,a,input,select,textarea,form,[role="button"]')||event.target;const permission=requiredPermission(target);if(!permission||has(permission))return;event.preventDefault();event.stopImmediatePropagation();if(event.type!=='change'||target?.tagName!=='SELECT')requirePermission(permission);}
  function mark(selector,permission,hide=true){root.document?.querySelectorAll(selector).forEach(el=>{el.dataset.requiredPermission=permission;const allowed=has(permission);el.classList.toggle('erp-permission-hidden',hide&&!allowed);el.classList.toggle('erp-permission-disabled',!hide&&!allowed);if(!hide&&'disabled'in el)el.disabled=!allowed;el.setAttribute('aria-disabled',allowed?'false':'true');});}
  function applyUi(){
    if(!root.document||applying)return;applying=true;
    try{
      mark('[data-page="form"],[data-go="form"],#btnDetailEdit,#btnDetailEditTop,#btnHomeStartScreening,#btnHomeStartPhoneInterview,#btnStartScreeningWorkbench,#btnStartPhoneInterview,#btnDailyStartFirst,[data-required-permission="applicant.write"]','applicant.write');mark('[data-page="backup"],[data-go="backup"]','backup.manage');mark('[data-page="permissions"],[data-go="permissions"]','user.manage');mark('[data-page="auditHistory"],[data-go="auditHistory"]','audit.read');mark('[data-page="storagePerformance"],[data-go="storagePerformance"],#storagePerformance','storage.manage');mark('[data-page="productionReadiness"],[data-go="productionReadiness"],#productionReadiness','readiness.manage');mark('#btnDeleteAll,#btnClearAll,[data-erp-handler*="deleteApplicant"]','applicant.delete');mark('[data-erp-handler*="deleteEmployee"],#btnDeleteEditingEmployee','employee.delete');mark('[data-erp-handler*="deleteSchool"],#btnApplySchoolMerge','school.delete');mark('#btnOpenEmployeeEntry,#btnTriggerEmployeeImport,#btnEmployeeDetailEdit,#btnOpenEmployeeStatusManager,#btnApplyEmployeeStatusManager,#btnApplyEmployeeOrgImport,#btnApplyEmployeeExcelCompare,#btnApplyEmployeeRelations','employee.write');mark('#btnAddSchool,#btnImportSchools,#btnImportSchoolHr,#btnSaveSchoolDetail,#btnOpenSchoolMergeManager,#btnOpenSchoolAutoLink,#btnApplySchoolAutoLink,[data-erp-handler*="editSchoolPrompt"]','school.write');mark('#btnNewMessageTemplate,#btnSaveMessageTemplate,#btnDeleteMessageTemplate','message.write');mark('#btnJson,#jsonImport,#jsonImportMerge','backup.manage');mark('#btnCsv,#bulkCsv,#bulkPrint,#btnSchoolReportCsv,#btnSchoolReportExcel,#btnSchoolReportPrint,#btnSchoolAnalyticsExport,#btnSchoolControlExport','export.standard');mark('#btnCsvEmployees,#btnHireWaitingExport,#btnHireWaitingSave,#btnCalendarHireWaiting','sensitive.read');mark('#detailQuickStatus','applicant.write',false);
      const roleText=root.document.getElementById('topbarUserRole');if(roleText&&roleText.textContent!==roleLabel(state.role))roleText.textContent=roleLabel(state.role);const note=root.document.getElementById('permissionCurrentBadge'),badge=badgeHtml();if(note&&note.innerHTML!==badge)note.innerHTML=badge;root.document.documentElement.dataset.erpRole=state.role;if(!has('sensitive.read'))root.document.body?.classList.add('erp-sensitive-masked');else root.document.body?.classList.remove('erp-sensitive-masked');
      const active=root.document.querySelector('.page.active');if(active&&((active.id==='form'&&!has('applicant.write'))||(active.id==='backup'&&!has('backup.manage'))||(active.id==='permissions'&&!has('user.manage'))||(active.id==='auditHistory'&&!has('audit.read'))||(active.id==='storagePerformance'&&!has('storage.manage'))||(active.id==='productionReadiness'&&!has('readiness.manage'))))root.setPage?.('home');
    }finally{applying=false;}
  }
  function matrixHtml(){const rows=[['목록·통계 조회',true,true,true],['지원자 등록·수정',true,true,false],['면접·일정 관리',true,true,false],['사원·학교 수정',true,false,false],['삭제·백업·복원',true,false,false],['사용자 권한 설정',true,false,false],['주민등록번호 조회',true,false,false]];return `<div class="permission-matrix" aria-label="역할별 기능 권한"><div class="permission-matrix-row permission-matrix-head"><div class="permission-feature">기능</div><div>관리자</div><div>채용담당자</div><div>조회 전용</div></div>${rows.map(row=>`<div class="permission-matrix-row"><div class="permission-feature">${row[0]}</div>${row.slice(1).map((ok,index)=>`<div class="permission-value ${ok?'permission-yes':'permission-no'}"><span class="permission-mobile-role">${['관리자','채용담당자','조회 전용'][index]}</span><strong>${ok?'가능':'불가'}</strong></div>`).join('')}</div>`).join('')}</div>`;}
  function ensureUi(){
    if(!root.document)return;const systemItems=root.document.querySelector('[data-navgroup="system"] .nav-group-items');if(systemItems&&!root.document.querySelector('[data-page="permissions"]')){const button=root.document.createElement('button');button.className='nav-btn nav-sub';button.type='button';button.dataset.page='permissions';button.dataset.requiredPermission='user.manage';button.innerHTML='<span class="nav-ico" aria-hidden="true">🔐</span><span>사용자 권한</span>';systemItems.appendChild(button);}
    const main=root.document.querySelector('main.main');if(main&&!root.document.getElementById('permissions')){const section=root.document.createElement('section');section.className='page permission-page';section.id='permissions';section.innerHTML='<div class="page-intro-card safety-intro-card"><div><h3>사용자 권한 안내</h3><p>LOCAL ONLY 역할별 화면 보호 범위를 확인합니다.</p></div><span id="permissionCurrentBadge"></span></div><div class="permission-page-shell" id="permissionPageBody"></div>';main.appendChild(section);}root.document.querySelector('[data-page="permissions"]')?.addEventListener('click',()=>setTimeout(renderPage,0));
  }
  function renderPage(){const host=root.document?.getElementById('permissionPageBody');if(!host)return;host.innerHTML=`<div class="permission-alert is-ok"><strong>LOCAL ONLY 권한 보호</strong><br>외부 계정 연결 없이 현재 브라우저에서 로컬 관리자 권한으로 사용합니다.</div><div class="permission-summary-grid"><div class="permission-summary-card"><strong>관리자</strong><p>삭제, 백업·복원, 사원·학교 수정을 담당합니다.</p></div><div class="permission-summary-card"><strong>채용담당자</strong><p>지원자 등록·수정과 면접·일정 관리를 사용할 수 있습니다.</p></div><div class="permission-summary-card"><strong>조회 전용</strong><p>목록과 통계를 볼 수 있지만 변경할 수 없습니다.</p></div></div>${matrixHtml()}`;}
  function init(){if(!root.document)return;ensureUi();root.document.addEventListener('click',guardEvent,true);root.document.addEventListener('submit',guardEvent,true);root.document.addEventListener('change',guardEvent,true);const observer=new MutationObserver(()=>{if(!applying)applyUi();});observer.observe(root.document.body,{subtree:true,childList:true});applyUi();renderPage();}
  const api={VERSION,ROLE_LABELS,PERMISSIONS,roleLabel,permissionsFor,has,require:requirePermission,current,useLocal,reset,load,loadUsers,changeRole,requiredPermission,applyUi,renderPage,init,escapeHtml};
  if(root.document)init();
  return api;
});
