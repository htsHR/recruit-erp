/* Recruit ERP v10.61.0 USER PERMISSIONS
 * UI guards are usability protection. Supabase RLS is the security boundary.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpPermissions=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const VERSION='10.61.0';
  const ROLE_LABELS={admin:'관리자',recruiter:'채용담당자',viewer:'조회 전용',local_admin:'로컬 관리자',legacy_admin:'설정 전 관리자'};
  const PERMISSIONS={
    admin:['*'],local_admin:['*'],legacy_admin:['*'],
    recruiter:['applicant.read','applicant.write','schedule.read','schedule.write','school.read','employee.read','stats.read','export.standard','message.write','audit.write'],
    viewer:['applicant.read','schedule.read','school.read','employee.read','stats.read']
  };
  let state={role:'local_admin',email:'',userId:'',ready:true,source:'local',setupRequired:false,error:''};
  let users=[];
  let applying=false;
  let resultNotice='';

  function roleLabel(role){return ROLE_LABELS[role]||ROLE_LABELS.viewer;}
  function permissionsFor(role){return PERMISSIONS[role]||PERMISSIONS.viewer;}
  function has(permission,role=state.role){const list=permissionsFor(role);return list.includes('*')||list.includes(permission);}
  function denyMessage(permission){
    const labels={
      'applicant.write':'지원자 등록·수정','applicant.delete':'지원자 삭제','schedule.write':'면접·일정 변경',
      'employee.write':'사원명부 수정','employee.delete':'사원 삭제','school.write':'협력학교 수정','school.delete':'협력학교 삭제',
      'backup.manage':'백업·복원','backup.restore':'백업 복원','export.standard':'일반 내보내기','sensitive.read':'주민등록번호 조회',
      'user.manage':'사용자 권한 설정','message.write':'안내문 저장'
    };
    return `${labels[permission]||'이 기능'} 권한이 없습니다. 현재 권한: ${roleLabel(state.role)}`;
  }
  function requirePermission(permission,options={}){
    if(has(permission))return true;
    if(options.notify!==false&&typeof root.alert==='function')root.alert(denyMessage(permission));
    return false;
  }
  function current(){return {...state};}
  function setState(next){state={...state,...next};applyUi();renderPage();root.document?.dispatchEvent(new CustomEvent('erp:permission-change',{detail:current()}));return current();}
  function useLocal(email=''){return setState({role:'local_admin',email,userId:'',ready:true,source:'local',setupRequired:false,error:''});}
  function reset(){return useLocal('');}
  function looksLikeMissingTable(error){const text=String(error?.message||error||'').toLowerCase();return text.includes('user_roles')&&(text.includes('schema cache')||text.includes('does not exist')||text.includes('not found'))||String(error?.code||'')==='PGRST205';}

  async function load(session){
    const user=session?.user||session?.data?.user||session;
    if(!user?.id||!root.sb)return useLocal(user?.email||'');
    setState({role:'viewer',email:user.email||'',userId:user.id,ready:false,source:'cloud',setupRequired:false,error:''});
    try{
      const response=await root.sb.from('user_roles').select('user_id,email,display_name,role,created_at,updated_at').eq('user_id',user.id).maybeSingle();
      if(response?.error)throw response.error;
      const row=response?.data;
      if(!row){return setState({role:'viewer',ready:true,source:'cloud',error:'이 계정의 권한 정보가 없어 조회 전용으로 시작했습니다.'});}
      return setState({role:ROLE_LABELS[row.role]?row.role:'viewer',email:row.email||user.email||'',userId:user.id,ready:true,source:'cloud',setupRequired:false,error:''});
    }catch(error){
      if(looksLikeMissingTable(error)){
        return setState({role:'legacy_admin',ready:true,source:'legacy',setupRequired:true,error:'v10.57.0 Supabase 권한 SQL을 아직 적용하지 않았습니다.'});
      }
      console.warn('사용자 권한을 불러오지 못했습니다.',error);
      return setState({role:'viewer',ready:true,source:'cloud',error:'권한 확인에 실패해 안전하게 조회 전용으로 시작했습니다.'});
    }
  }

  function badgeHtml(role=state.role){const tone=role==='admin'?'is-admin':role==='recruiter'?'is-recruiter':role==='viewer'?'is-viewer':'is-warning';return `<span class="permission-role-badge ${tone}">${escapeHtml(roleLabel(role))}</span>`;}
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function requiredPermission(element){
    if(!element)return '';
    const explicit=element.closest?.('[data-required-permission]')?.dataset.requiredPermission;
    if(explicit)return explicit;
    const id=element.id||'';
    const handler=element.getAttribute?.('data-erp-handler')||'';
    const page=element.dataset?.page||element.dataset?.go||'';
    if(page==='permissions')return 'user.manage';
    if(page==='auditHistory')return 'audit.read';
    if(page==='backup')return 'backup.manage';
    if(page==='storagePerformance')return 'storage.manage';
    if(page==='form')return 'applicant.write';
    if(/deleteApplicant|btnDeleteAll|btnClearAll/i.test(handler+' '+id))return 'applicant.delete';
    if(/deleteEmployee|DeleteEditingEmployee/i.test(handler+' '+id))return 'employee.delete';
    if(/deleteSchool|SchoolMerge/i.test(handler+' '+id))return 'school.delete';
    if(/restoreSnapshot|FullRestore|MergeApply|ReplaceApply/i.test(handler+' '+id))return 'backup.restore';
    if(/DetailEdit|QuickStatus|submitBtn|ExcelPaste|bulkApply|Screening|PhoneInterview/i.test(id))return 'applicant.write';
    if(/Calendar.*(Save|Delete|Apply|Bulk)|btnSaveCalendar/i.test(id))return 'schedule.write';
    if(/Employee.*(Edit|Save|Import|Apply|Status|Relation)|btnOpenEmployeeEntry/i.test(id))return 'employee.write';
    if(/School.*(Edit|Save|Import|Apply|Merge|AutoLink)|btnAddSchool/i.test(id))return 'school.write';
    if(/MessageTemplate.*(Save|Delete|New)/i.test(id))return 'message.write';
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
    root.document?.querySelectorAll(selector).forEach(el=>{
      el.dataset.requiredPermission=permission;
      const allowed=has(permission);
      el.classList.toggle('erp-permission-hidden',hide&&!allowed);
      el.classList.toggle('erp-permission-disabled',!hide&&!allowed);
      if(!hide&&'disabled'in el)el.disabled=!allowed;
      el.setAttribute('aria-disabled',allowed?'false':'true');
    });
  }
  function applyUi(){
    if(!root.document||applying)return;applying=true;
    try{
      mark('[data-page="form"],[data-go="form"],#btnDetailEdit,#btnDetailEditTop,#btnHomeStartScreening,#btnHomeStartPhoneInterview,#btnStartScreeningWorkbench,#btnStartPhoneInterview','applicant.write');
      mark('[data-page="backup"],[data-go="backup"]','backup.manage');
      mark('[data-page="permissions"],[data-go="permissions"]','user.manage');
      mark('[data-page="auditHistory"],[data-go="auditHistory"]','audit.read');
      mark('[data-page="storagePerformance"],[data-go="storagePerformance"],#storagePerformance','storage.manage');
      mark('#btnDeleteAll,#btnClearAll,[data-erp-handler*="deleteApplicant"]','applicant.delete');
      mark('[data-erp-handler*="deleteEmployee"],#btnDeleteEditingEmployee','employee.delete');
      mark('[data-erp-handler*="deleteSchool"],#btnApplySchoolMerge','school.delete');
      mark('#btnOpenEmployeeEntry,#btnTriggerEmployeeImport,#btnEmployeeDetailEdit,#btnOpenEmployeeStatusManager,#btnApplyEmployeeStatusManager,#btnApplyEmployeeOrgImport,#btnApplyEmployeeExcelCompare,#btnApplyEmployeeRelations','employee.write');
      mark('#btnAddSchool,#btnImportSchools,#btnImportSchoolHr,#btnSaveSchoolDetail,#btnOpenSchoolMergeManager,#btnOpenSchoolAutoLink,#btnApplySchoolAutoLink,[data-erp-handler*="editSchoolPrompt"]','school.write');
      mark('#btnNewMessageTemplate,#btnSaveMessageTemplate,#btnDeleteMessageTemplate','message.write');
      mark('#btnJson,#jsonImport,#jsonImportMerge','backup.manage');
      mark('#btnCsv,#bulkCsv,#bulkPrint,#btnSchoolReportCsv,#btnSchoolReportExcel,#btnSchoolReportPrint,#btnSchoolAnalyticsExport,#btnSchoolControlExport','export.standard');
      mark('#btnCsvEmployees,#btnHireWaitingExport,#btnHireWaitingSave,#btnCalendarHireWaiting','sensitive.read');
      mark('#detailQuickStatus','applicant.write',false);
      const roleText=root.document.getElementById('topbarUserRole');if(roleText&&roleText.textContent!==roleLabel(state.role))roleText.textContent=roleLabel(state.role);
      const note=root.document.getElementById('permissionCurrentBadge'),badge=badgeHtml();if(note&&note.innerHTML!==badge)note.innerHTML=badge;
      root.document.documentElement.dataset.erpRole=state.role;
      if(!has('sensitive.read'))root.document.body?.classList.add('erp-sensitive-masked');else root.document.body?.classList.remove('erp-sensitive-masked');
      const active=root.document.querySelector('.page.active');if(active&&((active.id==='form'&&!has('applicant.write'))||(active.id==='backup'&&!has('backup.manage'))||(active.id==='permissions'&&!has('user.manage'))||(active.id==='auditHistory'&&!has('audit.read'))||(active.id==='storagePerformance'&&!has('storage.manage'))))root.setPage?.('home');
    }finally{applying=false;}
  }

  async function loadUsers(){
    if(!requirePermission('user.manage'))return [];
    if(!root.sb||state.source!=='cloud'){users=[];renderPage();return users;}
    const response=await root.sb.from('user_roles').select('user_id,email,display_name,role,created_at,updated_at').order('created_at',{ascending:true});
    if(response?.error){state.error=response.error.message||'사용자 목록을 불러오지 못했습니다.';renderPage();throw response.error;}
    users=Array.isArray(response.data)?response.data:[];renderPage();return users;
  }
  async function changeRole(userId,role){
    if(!requirePermission('user.manage'))return false;
    if(!['admin','recruiter','viewer'].includes(role))throw new Error('지원하지 않는 권한입니다.');
    const target=users.find(user=>String(user.user_id)===String(userId));
    if(!target)throw new Error('사용자를 찾을 수 없습니다.');
    const adminCount=users.filter(user=>user.role==='admin').length;
    if(target.role==='admin'&&role!=='admin'&&adminCount<=1){resultNotice='마지막 관리자 계정은 다른 권한으로 바꿀 수 없습니다.';root.alert?.(resultNotice);renderPage();return false;}
    const response=await root.sb.from('user_roles').update({role}).eq('user_id',userId).select('user_id,email,display_name,role,created_at,updated_at').single();
    if(response?.error){root.alert?.(`권한 변경 실패: ${response.error.message||response.error}`);renderPage();return false;}
    root.erpAudit?.recordEvent({entityType:'user',entityId:userId,entityLabel:root.erpAudit.maskEmail(target.email||''),action:'role_change',fields:['role'],before:{role:target.role},after:{role},reason:'관리자 권한 변경'});
    users=users.map(user=>user.user_id===userId?response.data:user);
    resultNotice=`${target.display_name||target.email||'선택한 사용자'}의 권한을 ${roleLabel(role)}(으)로 변경했습니다.`;
    if(userId===state.userId)setState({role:response.data.role});else renderPage();
    return true;
  }
  function ensureUi(){
    if(!root.document)return;
    const systemItems=root.document.querySelector('[data-navgroup="system"] .nav-group-items');
    if(systemItems&&!root.document.querySelector('[data-page="permissions"]')){
      const button=root.document.createElement('button');button.className='nav-btn nav-sub';button.type='button';button.dataset.page='permissions';button.dataset.requiredPermission='user.manage';button.innerHTML='<span class="nav-ico" aria-hidden="true">🔐</span><span>사용자 권한</span>';systemItems.appendChild(button);
    }
    const main=root.document.querySelector('main.main');
    if(main&&!root.document.getElementById('permissions')){
      const section=root.document.createElement('section');section.className='page permission-page';section.id='permissions';section.innerHTML='<div class="page-intro-card safety-intro-card"><div><h3>사용자 권한 관리</h3><p>로그인 계정마다 조회·수정·삭제 범위를 나눕니다.</p></div><span id="permissionCurrentBadge"></span></div><div class="permission-page-shell" id="permissionPageBody"></div>';main.appendChild(section);
    }
    const topbarRole=root.document.querySelector('#topbarUser .topbar-user-copy small');if(topbarRole)topbarRole.id='topbarUserRole';
    root.document.querySelector('[data-page="permissions"]')?.addEventListener('click',()=>{setTimeout(()=>{renderPage();if(has('user.manage')&&state.source==='cloud')loadUsers().catch(()=>{});},0);});
  }
  function matrixHtml(){
    const rows=[['목록·통계 조회',true,true,true],['지원자 등록·수정',true,true,false],['면접·일정 관리',true,true,false],['사원·학교 수정',true,false,false],['삭제·백업·복원',true,false,false],['사용자 권한 설정',true,false,false],['주민등록번호 조회',true,false,false]];
    return `<div class="permission-matrix" aria-label="역할별 기능 권한"><div class="permission-matrix-row permission-matrix-head"><div class="permission-feature">기능</div><div>관리자</div><div>채용담당자</div><div>조회 전용</div></div>${rows.map(row=>`<div class="permission-matrix-row"><div class="permission-feature">${row[0]}</div>${row.slice(1).map((ok,index)=>`<div class="permission-value ${ok?'permission-yes':'permission-no'}"><span class="permission-mobile-role">${['관리자','채용담당자','조회 전용'][index]}</span><strong>${ok?'가능':'불가'}</strong></div>`).join('')}</div>`).join('')}</div>`;
  }
  function renderPage(){
    const host=root.document?.getElementById('permissionPageBody');if(!host)return;
    const status=state.setupRequired?'<div class="permission-alert"><strong>Supabase 권한 SQL 적용 필요</strong><br>supabase_migration_v10.57.0_rbac_rls.sql을 SQL Editor에서 실행하기 전에는 서버 RLS가 활성화되지 않습니다.</div>':state.source==='local'?'<div class="permission-alert"><strong>로컬 관리자 모드</strong><br>이 브라우저 안의 데이터만 관리합니다. 로그인한 클라우드 계정의 RLS 권한과는 별개입니다.</div>':state.error?`<div class="permission-alert"><strong>권한 확인 알림</strong><br>${escapeHtml(state.error)}</div>`:'<div class="permission-alert is-ok"><strong>권한 보호 사용 중</strong><br>화면 제한과 Supabase RLS가 같은 역할 기준을 사용합니다.</div>';
    const rows=users.length?users.map(user=>`<tr><td>${escapeHtml(user.display_name||'-')}</td><td>${escapeHtml(user.email||'-')} ${user.user_id===state.userId?'<span class="permission-self">내 계정</span>':''}</td><td><select data-role-user="${escapeHtml(user.user_id)}"><option value="admin" ${user.role==='admin'?'selected':''}>관리자</option><option value="recruiter" ${user.role==='recruiter'?'selected':''}>채용담당자</option><option value="viewer" ${user.role==='viewer'?'selected':''}>조회 전용</option></select></td><td>${badgeHtml(user.role)}</td></tr>`).join(''):`<tr><td colspan="4">${state.source==='cloud'?'사용자 목록을 불러오는 중입니다.':'Supabase 로그인 후 사용자 목록을 확인할 수 있습니다.'}</td></tr>`;
    const adminNotice='<div class="permission-admin-notice"><strong>관리자 보호</strong><span>첫 관리자를 지정한 뒤에는 마지막 관리자 계정을 다른 권한으로 바꿀 수 없습니다.</span></div>';
    const result=resultNotice?`<div class="permission-result-notice" role="status">${escapeHtml(resultNotice)}</div>`:'';
    host.innerHTML=`${status}${adminNotice}${result}<div class="permission-summary-grid"><div class="permission-summary-card"><strong>관리자</strong><p>삭제, 백업·복원, 사원·학교 수정과 사용자 권한 설정을 담당합니다.</p></div><div class="permission-summary-card"><strong>채용담당자</strong><p>지원자 등록·수정, 면접·일정 관리와 일반 내보내기를 사용할 수 있습니다.</p></div><div class="permission-summary-card"><strong>조회 전용</strong><p>목록과 통계를 볼 수 있지만 수정·삭제·복원과 민감정보 조회는 할 수 없습니다.</p></div></div>${matrixHtml()}<div class="panel permission-user-panel"><div class="panel-head"><div><h3>로그인 사용자</h3><small>관리자는 역할을 변경할 수 있습니다.</small></div><button class="ghost" id="btnPermissionRefresh" type="button">새로고침</button></div><div class="permission-table-wrap"><table class="permission-table"><thead><tr><th>이름</th><th>이메일</th><th>권한 변경</th><th>현재 권한</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    host.querySelector('#btnPermissionRefresh')?.addEventListener('click',()=>loadUsers().catch(()=>{}));
    host.querySelectorAll('[data-role-user]').forEach(select=>select.addEventListener('change',()=>changeRole(select.dataset.roleUser,select.value).catch(error=>root.alert?.(error.message||error))));
  }
  function init(){
    if(!root.document)return;ensureUi();
    root.document.addEventListener('click',guardEvent,true);
    root.document.addEventListener('submit',guardEvent,true);
    root.document.addEventListener('change',guardEvent,true);
    const observer=new MutationObserver(()=>{if(!applying)applyUi();});observer.observe(root.document.body,{subtree:true,childList:true});
    applyUi();renderPage();
  }
  const api={VERSION,ROLE_LABELS,PERMISSIONS,roleLabel,permissionsFor,has,require:requirePermission,current,useLocal,reset,load,loadUsers,changeRole,requiredPermission,applyUi,renderPage,init,escapeHtml};
  if(root.document)init();
  return api;
});
