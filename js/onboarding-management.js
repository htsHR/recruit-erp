/* Recruit ERP v11.0.0 ONBOARDING MANAGEMENT
 * 기존 입사대기 프로필을 재사용하며 주민등록번호는 이 화면에 표시하지 않는다.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpOnboarding=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const VERSION='11.0.0';
  const REQUIRED_DOCUMENTS=['신분증 사본','통장 사본','졸업증명서'];
  const STAGES=[
    {key:'final_pass',label:'최종합격'},
    {key:'documents_requested',label:'입사서류 요청'},
    {key:'documents_complete',label:'서류 제출 완료'},
    {key:'employee_number',label:'사번 발급'},
    {key:'department',label:'부서 배치'},
    {key:'commute',label:'기숙사 확인'},
    {key:'training',label:'교육 일정'},
    {key:'attendance',label:'출근 확인'},
    {key:'employee_link',label:'사원명부 전환'}
  ];
  let filter='active';
  let search='';
  let selectedId='';

  function text(value){return String(value==null?'':value).trim();}
  function employeeNoKey(value){return text(value).toUpperCase();}
  function statusOf(applicant){return text(applicant?.status);}
  function isCancelled(applicant,profile={}){
    return ['입사철회','철회'].includes(statusOf(applicant))||['입사포기','입사철회'].includes(text(applicant?.finalDecision))||!!profile.cancelledAt;
  }
  function isCandidate(applicant,profile={}){
    if(!applicant)return false;
    return ['입사예정','출근','입사철회','철회'].includes(statusOf(applicant))||['합격','입사포기','입사철회'].includes(text(applicant.finalDecision))||!!profile.applicantId;
  }
  function employeeLinkState(applicant,employees=[]){
    if(!applicant)return{employee:null,conflict:''};
    const applicantId=text(applicant.id),reverse=employees.filter(employee=>text(employee?.applicantId)===applicantId);
    const directId=text(applicant.employeeId),direct=directId&&directId!=='수동처리'?employees.find(employee=>text(employee?.id)===directId)||null:null;
    if(reverse.length>1)return{employee:null,conflict:'여러 사원이 같은 지원자에 연결되어 있습니다.'};
    if(directId&&directId!=='수동처리'&&!direct)return{employee:null,conflict:'지원자가 존재하지 않는 사원을 가리키고 있습니다.'};
    if(direct&&text(direct.applicantId)&&text(direct.applicantId)!==applicantId)return{employee:null,conflict:'지원자와 사원의 연결 대상이 서로 다릅니다.'};
    if(direct&&reverse.length&&text(reverse[0].id)!==text(direct.id))return{employee:null,conflict:'지원자와 사원의 양방향 연결이 서로 다릅니다.'};
    return{employee:reverse[0]||direct||null,conflict:''};
  }
  function linkedEmployee(applicant,employees=[]){
    const state=employeeLinkState(applicant,employees);
    return state.conflict?null:state.employee;
  }
  function normalizeSubmittedDocuments(value){
    const allowed=new Set(REQUIRED_DOCUMENTS);
    return [...new Set((Array.isArray(value)?value:[]).map(text).filter(item=>allowed.has(item)))];
  }
  function missingDocuments(profile={}){
    const submitted=new Set(normalizeSubmittedDocuments(profile.submittedDocuments));
    return REQUIRED_DOCUMENTS.filter(documentName=>!submitted.has(documentName));
  }
  function departmentReady(profile={}){return !!text(profile.groupName);}
  function stageChecks(applicant,profile={},employees=[]){
    const cancelled=isCancelled(applicant,profile);
    const submitted=normalizeSubmittedDocuments(profile.submittedDocuments);
    const linked=linkedEmployee(applicant,employees);
    return {
      final_pass:!cancelled&&(['입사예정','출근'].includes(statusOf(applicant))||text(applicant?.finalDecision)==='합격'),
      documents_requested:!cancelled&&!!(profile.documentsRequestedAt||submitted.length),
      documents_complete:!cancelled&&missingDocuments(profile).length===0,
      employee_number:!cancelled&&!!(text(profile.employeeNo)||text(linked?.empNo)),
      department:!cancelled&&departmentReady(profile),
      commute:!cancelled&&!!text(profile.commuteMethod),
      training:!cancelled&&!!text(profile.trainingDate),
      attendance:!cancelled&&(statusOf(applicant)==='출근'||!!profile.attendanceConfirmedAt),
      employee_link:!cancelled&&!!linked
    };
  }
  function progress(applicant,profile={},employees=[]){
    if(isCancelled(applicant,profile))return{cancelled:true,done:0,total:STAGES.length,percent:0,next:'입사 취소'};
    const checks=stageChecks(applicant,profile,employees);
    const done=STAGES.filter(stage=>checks[stage.key]).length;
    const next=STAGES.find(stage=>!checks[stage.key]);
    return{cancelled:false,done,total:STAGES.length,percent:Math.round(done/STAGES.length*100),next:next?.label||'완료',checks};
  }
  function validateEmployeeNumber(value,applicantId,employees=[],profiles=[]){
    const key=employeeNoKey(value);
    if(!key)return{ok:false,code:'EMPLOYEE_NUMBER_REQUIRED',message:'사번을 먼저 입력해주세요.'};
    const employee=employees.find(row=>employeeNoKey(row?.empNo)===key);
    if(employee&&text(employee.applicantId)!==text(applicantId))return{ok:false,code:'DUPLICATE_EMPLOYEE_NUMBER',message:'이미 사용 중인 사번입니다.'};
    const profile=profiles.find(row=>text(row?.applicantId)!==text(applicantId)&&employeeNoKey(row?.employeeNo)===key);
    if(profile)return{ok:false,code:'DUPLICATE_EMPLOYEE_NUMBER',message:'다른 입사대기자가 이미 사용 중인 사번입니다.'};
    return{ok:true,key,employee:employee||null};
  }
  function planConversion({applicant,profile={},employees=[],profiles=[],idFactory,now}={}){
    if(!applicant)return{ok:false,code:'APPLICANT_NOT_FOUND',message:'지원자를 찾을 수 없습니다.'};
    const linkState=employeeLinkState(applicant,employees);
    if(linkState.conflict)return{ok:false,code:'LINK_CONFLICT',message:`사원 연결 충돌: ${linkState.conflict}`};
    const existing=linkState.employee;
    if(existing)return{ok:true,created:false,employee:existing,applicant:{...applicant,employeeId:existing.id},message:'이미 사원명부에 연결되어 있습니다.'};
    if(isCancelled(applicant,profile))return{ok:false,code:'CANCELLED',message:'입사가 취소된 지원자는 사원으로 전환할 수 없습니다.'};
    if(statusOf(applicant)!=='출근')return{ok:false,code:'ATTENDANCE_REQUIRED',message:'출근 확인 후 사원명부로 전환할 수 있습니다.'};
    const numberCheck=validateEmployeeNumber(profile.employeeNo,applicant.id,employees,profiles);
    if(!numberCheck.ok)return numberCheck;
    const stamp=now||new Date().toISOString();
    const newId=typeof idFactory==='function'?idFactory():`employee_${Date.now().toString(36)}`;
    const employee={
      id:newId,empNo:text(profile.employeeNo),name:text(applicant.name),gender:text(applicant.gender),department:text(profile.groupName)||text(applicant.workplace),
      team:text(profile.groupName)||text(applicant.workplace),groupName:text(profile.groupName),product:text(profile.product),part:text(profile.part),rank:text(profile.rank),
      position:text(profile.rank),school:text(applicant.school),schoolId:text(applicant.schoolId),education:text(applicant.education||applicant.finalEducation),major:text(applicant.major),
      hireDate:text(applicant.hireDate||applicant.applyDate),status:'재직중',applicantId:text(applicant.id),notes:'Recruit ERP 온보딩에서 사원명부 전환',createdAt:stamp,updatedAt:stamp
    };
    return{ok:true,created:true,employee,applicant:{...applicant,employeeId:newId,updatedAt:stamp},message:'사원명부 전환 준비가 완료되었습니다.'};
  }
  function buildRows(applicants=[],profiles=[],employees=[]){
    const byId=new Map(profiles.map(profile=>[text(profile?.applicantId),profile]));
    return applicants.filter(applicant=>isCandidate(applicant,byId.get(text(applicant?.id))||{})).map(applicant=>{
      const profile=byId.get(text(applicant.id))||{applicantId:text(applicant.id)};
      const linked=linkedEmployee(applicant,employees);
      return{applicant,profile,linked,progress:progress(applicant,profile,employees),missing:missingDocuments(profile)};
    });
  }
  function escapeHtml(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function currentApplicants(){return typeof applicants!=='undefined'&&Array.isArray(applicants)?applicants:[];}
  function currentEmployees(){return typeof employees!=='undefined'&&Array.isArray(employees)?employees:[];}
  function currentProfiles(){return typeof hireWaitingProfiles!=='undefined'&&Array.isArray(hireWaitingProfiles)?hireWaitingProfiles:[];}
  function profileFor(applicantId){return currentProfiles().find(profile=>text(profile?.applicantId)===text(applicantId))||{applicantId:text(applicantId)};}
  function upsertProfile(list,profile){
    const normalized=typeof normalizeHireWaitingProfile==='function'?normalizeHireWaitingProfile(profile):{...profile,applicantId:text(profile.applicantId)};
    const found=list.some(row=>text(row?.applicantId)===text(normalized.applicantId));
    return found?list.map(row=>text(row?.applicantId)===text(normalized.applicantId)?normalized:row):[...list,normalized];
  }
  function summary(rows){
    return{
      total:rows.filter(row=>!row.progress.cancelled&&!row.linked).length,
      missingDocs:rows.filter(row=>!row.progress.cancelled&&row.missing.length>0).length,
      missingNo:rows.filter(row=>!row.progress.cancelled&&!text(row.profile.employeeNo)&&!text(row.linked?.empNo)).length,
      attendance:rows.filter(row=>!row.progress.cancelled&&!row.progress.checks?.attendance).length,
      complete:rows.filter(row=>!!row.linked).length
    };
  }
  function hasPermission(permission){return !root.erpPermissions||root.erpPermissions.has?.(permission);}
  function requirePermission(permission){return !root.erpPermissions||root.erpPermissions.require?.(permission);}
  function ensureUi(){
    if(!root.document)return;
    const hrItems=root.document.querySelector('[data-navgroup="hr"] .nav-group-items');
    if(hrItems&&!root.document.querySelector('[data-page="onboarding"]')){
      const button=root.document.createElement('button');button.className='nav-btn';button.type='button';button.dataset.page='onboarding';
      button.innerHTML='<span class="nav-ico" aria-hidden="true">✓</span><span>입사·온보딩</span>';hrItems.appendChild(button);
      button.addEventListener('click',()=>root.setPage?.('onboarding'));
    }
    const main=root.document.querySelector('main.main');
    if(main&&!root.document.getElementById('onboarding')){
      const section=root.document.createElement('section');section.className='page onboarding-page';section.id='onboarding';
      section.innerHTML='<div class="page-intro-card safety-intro-card"><div><h3>입사·온보딩 관리</h3><p>최종합격부터 서류·사번·부서·교육·출근과 사원명부 전환까지 한 번씩 확인합니다.</p></div><span class="page-intro-badge">입사·온보딩 관리</span></div><div id="onboardingBody"></div>';
      main.appendChild(section);
    }
    if(!root.document.getElementById('onboardingModal')){
      const modal=root.document.createElement('div');modal.className='modal';modal.id='onboardingModal';modal.setAttribute('aria-hidden','true');
      modal.innerHTML='<div class="modal-backdrop" data-onboarding-close></div><section class="modal-card onboarding-modal-card" role="dialog" aria-modal="true" aria-labelledby="onboardingModalTitle"><div class="modal-head"><div><p class="eyebrow">ONBOARDING</p><h3 id="onboardingModalTitle">입사 준비 관리</h3><p id="onboardingModalSubtitle" class="muted"></p></div><button class="ghost" type="button" data-onboarding-close>닫기</button></div><div class="onboarding-modal-body"><label class="check-inline"><input id="onboardingDocumentsRequested" type="checkbox"> 입사서류 요청 완료</label><fieldset class="onboarding-documents"><legend>제출 서류</legend><label><input type="checkbox" data-onboarding-document="신분증 사본"> 신분증 사본</label><label><input type="checkbox" data-onboarding-document="통장 사본"> 통장 사본</label><label><input type="checkbox" data-onboarding-document="졸업증명서"> 졸업증명서</label></fieldset><div class="onboarding-form-grid"><label>사번<input id="onboardingEmployeeNo" autocomplete="off" placeholder="중복되지 않는 사번"></label><label>그룹·부서<input id="onboardingGroupName" placeholder="배치 부서"></label><label>제품<input id="onboardingProduct" placeholder="제품"></label><label>파트<input id="onboardingPart" placeholder="파트"></label><label>직급<input id="onboardingRank" placeholder="직급"></label><label>기숙사·출근방법<select id="onboardingCommute"><option value="">확인 필요</option><option>출퇴근</option><option>기숙사</option></select></label><label>교육 일정<input id="onboardingTrainingDate" type="date"></label><label class="wide">입사 취소 사유<input id="onboardingCancellationReason" maxlength="200" placeholder="취소할 때만 입력"></label></div><div id="onboardingModalNotice" class="onboarding-modal-notice" role="status"></div></div><div class="form-actions onboarding-modal-actions"><button class="danger-outline" id="btnOnboardingCancelHire" type="button" data-required-permission="applicant.write">입사 취소</button><button class="ghost" id="btnOnboardingSave" type="button" data-required-permission="applicant.write">준비 정보 저장</button><button class="primary" id="btnOnboardingAttendance" type="button" data-required-permission="applicant.write">출근 확인 저장</button><button class="primary" id="btnOnboardingConvert" type="button" data-required-permission="employee.write">사원명부 전환</button></div></section>';
      root.document.body.appendChild(modal);
      modal.addEventListener('click',event=>{if(event.target.closest('[data-onboarding-close]'))closeModal();});
      modal.querySelector('#btnOnboardingSave')?.addEventListener('click',()=>saveModal('save'));
      modal.querySelector('#btnOnboardingAttendance')?.addEventListener('click',()=>saveModal('attendance'));
      modal.querySelector('#btnOnboardingConvert')?.addEventListener('click',()=>saveModal('convert'));
      modal.querySelector('#btnOnboardingCancelHire')?.addEventListener('click',()=>saveModal('cancel'));
    }
  }
  function visibleRows(){
    const rows=buildRows(currentApplicants(),currentProfiles(),currentEmployees());
    return rows.filter(row=>{
      const stateOk=filter==='all'||(filter==='active'&&!row.progress.cancelled&&!row.linked)||(filter==='complete'&&!!row.linked)||(filter==='cancelled'&&row.progress.cancelled);
      const term=search.toLowerCase();
      return stateOk&&(!term||[row.applicant.name,row.applicant.workplace,row.profile.employeeNo,row.profile.groupName].some(value=>text(value).toLowerCase().includes(term)));
    });
  }
  function render(){
    const host=root.document?.getElementById('onboardingBody');if(!host)return;
    const allRows=buildRows(currentApplicants(),currentProfiles(),currentEmployees()),counts=summary(allRows),rows=visibleRows();
    const emptyText=allRows.length?'현재 조건에 맞는 대상이 없습니다. 필터를 바꾸거나 지원자 목록을 확인하세요.':'최종합격 처리된 지원자가 여기에 표시됩니다.';
    const emptyState=`<div class="empty onboarding-empty-state"><strong>${emptyText}</strong><button class="ghost" type="button" data-onboarding-go-applicants>지원자 목록으로 이동</button></div>`;
    host.innerHTML=`<div class="onboarding-summary"><article><span>입사대기</span><strong>${counts.total}</strong></article><article><span>서류 미완료</span><strong>${counts.missingDocs}</strong></article><article><span>사번 미발급</span><strong>${counts.missingNo}</strong></article><article><span>출근 확인 필요</span><strong>${counts.attendance}</strong></article><article><span>전환 완료</span><strong>${counts.complete}</strong></article></div><div class="onboarding-controls"><div class="quick-filters"><button class="chip ${filter==='active'?'active':''}" type="button" data-onboarding-filter="active">진행 중</button><button class="chip ${filter==='complete'?'active':''}" type="button" data-onboarding-filter="complete">전환 완료</button><button class="chip ${filter==='cancelled'?'active':''}" type="button" data-onboarding-filter="cancelled">입사 취소</button><button class="chip ${filter==='all'?'active':''}" type="button" data-onboarding-filter="all">전체</button></div><input id="onboardingSearch" class="search" placeholder="이름·근무지·사번·부서 검색" value="${escapeHtml(search)}"></div><div class="onboarding-list">${rows.length?rows.map(row=>rowHtml(row)).join(''):emptyState}</div>`;
    host.querySelectorAll('[data-onboarding-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.onboardingFilter;render();}));
    host.querySelector('#onboardingSearch')?.addEventListener('input',event=>{search=event.target.value;render();});
    host.querySelectorAll('[data-onboarding-open]').forEach(button=>button.addEventListener('click',()=>openModal(button.dataset.onboardingOpen)));
    host.querySelector('[data-onboarding-go-applicants]')?.addEventListener('click',()=>root.setPage?.('applicants'));
    root.erpPermissions?.applyUi?.();
  }
  function rowHtml(row){
    const p=row.progress,checks=p.checks||{},status=p.cancelled?'입사 취소':row.linked?'전환 완료':p.next;
    const stages=STAGES.map(stage=>`<span class="onboarding-stage ${checks[stage.key]?'is-done':''}">${checks[stage.key]?'✓':'○'} ${escapeHtml(stage.label)}</span>`).join('');
    const missing=row.missing.length?`미제출: ${row.missing.map(escapeHtml).join(', ')}`:'필수 서류 제출 완료';
    return `<article class="onboarding-card ${p.cancelled?'is-cancelled':row.linked?'is-complete':''}"><div class="onboarding-card-head"><div><strong>${escapeHtml(row.applicant.name||'이름 없음')}</strong><small>${escapeHtml(row.applicant.workplace||'근무지 미입력')} · 입사일 ${escapeHtml(row.applicant.hireDate||'미입력')} · ${escapeHtml(status)}</small></div><button class="mini" type="button" data-onboarding-open="${escapeHtml(row.applicant.id)}">${hasPermission('applicant.write')?'관리':'보기'}</button></div><div class="onboarding-progress"><span style="width:${p.percent}%"></span></div><div class="onboarding-stage-list">${stages}</div><div class="onboarding-card-foot"><span>${escapeHtml(missing)}</span><strong>${p.done}/${p.total}</strong></div></article>`;
  }
  function setInput(id,value){const element=root.document.getElementById(id);if(element)element.value=value||'';}
  function openModal(applicantId){
    const applicant=currentApplicants().find(row=>text(row.id)===text(applicantId));if(!applicant)return;
    selectedId=text(applicantId);const profile=profileFor(applicantId),submitted=new Set(normalizeSubmittedDocuments(profile.submittedDocuments)),linked=linkedEmployee(applicant,currentEmployees());
    root.document.querySelectorAll('[data-onboarding-document]').forEach(input=>{input.checked=submitted.has(input.dataset.onboardingDocument);input.disabled=!hasPermission('applicant.write');});
    const requested=root.document.getElementById('onboardingDocumentsRequested');if(requested){requested.checked=!!profile.documentsRequestedAt;requested.disabled=!hasPermission('applicant.write');}
    setInput('onboardingEmployeeNo',profile.employeeNo||linked?.empNo);setInput('onboardingGroupName',profile.groupName);setInput('onboardingProduct',profile.product);setInput('onboardingPart',profile.part);setInput('onboardingRank',profile.rank);setInput('onboardingCommute',profile.commuteMethod);setInput('onboardingTrainingDate',profile.trainingDate);setInput('onboardingCancellationReason',profile.cancellationReason);
    root.document.querySelectorAll('#onboardingModal input:not([type="checkbox"]),#onboardingModal select').forEach(input=>{input.disabled=!hasPermission('applicant.write');});
    const p=progress(applicant,profile,currentEmployees());
    root.document.getElementById('onboardingModalTitle').textContent=`${applicant.name||'지원자'} 입사 준비`;
    root.document.getElementById('onboardingModalSubtitle').textContent=`현재 단계: ${p.next} · 주민등록번호는 이 화면에 표시하지 않습니다.`;
    root.document.getElementById('onboardingModalNotice').textContent=linked?`사원명부 ${linked.empNo||'사번 미입력'}에 이미 연결되어 있습니다.`:p.cancelled?'입사가 취소된 지원자입니다.':'필수 서류와 배치 정보를 확인한 뒤 출근을 처리하세요.';
    ['btnOnboardingSave','btnOnboardingAttendance','btnOnboardingCancelHire'].forEach(id=>{const button=root.document.getElementById(id);if(button)button.hidden=!hasPermission('applicant.write');});
    const convert=root.document.getElementById('btnOnboardingConvert');if(convert){convert.hidden=!hasPermission('employee.write')||!!linked||p.cancelled;convert.disabled=statusOf(applicant)!=='출근';}
    const modal=root.document.getElementById('onboardingModal');modal?.classList.add('show');modal?.setAttribute('aria-hidden','false');root.document.body.classList.add('modal-open');
    root.setTimeout?.(()=>root.document.querySelector('[data-onboarding-close]')?.focus(),30);
  }
  function closeModal(){const modal=root.document?.getElementById('onboardingModal');modal?.classList.remove('show');modal?.setAttribute('aria-hidden','true');root.document?.body.classList.remove('modal-open');selectedId='';}
  function modalProfile(profile){
    const submitted=[...root.document.querySelectorAll('[data-onboarding-document]:checked')].map(input=>input.dataset.onboardingDocument);
    const requested=root.document.getElementById('onboardingDocumentsRequested')?.checked;
    const now=new Date().toISOString();
    return{
      ...profile,applicantId:selectedId,employeeNo:root.document.getElementById('onboardingEmployeeNo')?.value||'',groupName:root.document.getElementById('onboardingGroupName')?.value||'',
      product:root.document.getElementById('onboardingProduct')?.value||'',part:root.document.getElementById('onboardingPart')?.value||'',rank:root.document.getElementById('onboardingRank')?.value||'',commuteMethod:root.document.getElementById('onboardingCommute')?.value||'',
      trainingDate:root.document.getElementById('onboardingTrainingDate')?.value||'',documentsRequestedAt:requested?(profile.documentsRequestedAt||now):'',submittedDocuments:submitted,onboardingUpdatedAt:now
    };
  }
  function rollbackWrites(snapshot,writtenKeys){
    writtenKeys.reverse().forEach(key=>{try{root.localStorage.setItem(key,snapshot[key]);}catch{}});
  }
  async function persist({nextProfiles,nextApplicants=null,nextEmployees=null,changedEmployee=null,reason=''}){
    const profileKey=typeof HIRE_WAITING_PROFILES_KEY!=='undefined'?HIRE_WAITING_PROFILES_KEY:'recruit_erp_hire_waiting_profiles';
    const applicantKey=typeof STORAGE_KEY!=='undefined'?STORAGE_KEY:'recruit_erp_applicants_stable';
    const employeeKey=typeof EMPLOYEES_KEY!=='undefined'?EMPLOYEES_KEY:'recruit_erp_employees';
    const snapshot={
      [profileKey]:root.localStorage.getItem(profileKey)||JSON.stringify(currentProfiles()),
      [applicantKey]:root.localStorage.getItem(applicantKey)||JSON.stringify(currentApplicants()),
      [employeeKey]:root.localStorage.getItem(employeeKey)||JSON.stringify(currentEmployees())
    };
    const written=[];const write=(key,value)=>{if(!safeLocalStorageSet(key,JSON.stringify(value)))return false;written.push(key);return true;};
    const applicantAudit=nextApplicants?root.erpAudit?.capture?.('applicant'):null,employeeAudit=nextEmployees?root.erpAudit?.capture?.('employee'):null;
    if(!write(profileKey,nextProfiles)||(nextEmployees&&!write(employeeKey,nextEmployees))||(nextApplicants&&!write(applicantKey,nextApplicants))){rollbackWrites(snapshot,written);root.alert?.('입사·온보딩 정보를 저장하지 못했습니다. 기존 지원자와 사원 자료는 그대로 유지됩니다.');return false;}
    hireWaitingProfiles=nextProfiles;
    if(nextEmployees)employees=nextEmployees;
    if(nextApplicants)applicants=nextApplicants;
    if(nextEmployees)root.erpAudit?.commitSave?.('employee',employeeAudit,nextEmployees);
    if(nextApplicants){root.erpAudit?.setNextContext?.('applicant',{reason});root.erpAudit?.commitSave?.('applicant',applicantAudit,nextApplicants);}
    if(changedEmployee&&typeof supabaseSyncEmployees==='function')supabaseSyncEmployees([changedEmployee]);
    if(nextApplicants&&typeof canUseCloud==='function'&&canUseCloud()&&typeof supabaseSyncAll==='function')supabaseSyncAll(nextApplicants);
    if(typeof renderAll==='function')renderAll();render();return true;
  }
  function readinessErrors(profile){
    const errors=[];
    if(missingDocuments(profile).length)errors.push(`미제출 서류: ${missingDocuments(profile).join(', ')}`);
    if(!text(profile.employeeNo))errors.push('사번 미입력');
    if(!departmentReady(profile))errors.push('부서 미배치');
    if(!text(profile.commuteMethod))errors.push('기숙사·출근방법 미확인');
    if(!text(profile.trainingDate))errors.push('교육 일정 미입력');
    return errors;
  }
  async function saveModal(action){
    const applicant=currentApplicants().find(row=>text(row.id)===selectedId);if(!applicant)return;
    if(action==='convert'){if(!requirePermission('employee.write'))return;}else if(!requirePermission('applicant.write'))return;
    const oldProfile=profileFor(selectedId),profile=modalProfile(oldProfile),number=profile.employeeNo?validateEmployeeNumber(profile.employeeNo,selectedId,currentEmployees(),currentProfiles()):{ok:true};
    if(!number.ok){root.document.getElementById('onboardingModalNotice').textContent=number.message;return;}
    let nextProfiles=upsertProfile(currentProfiles(),profile),nextApplicants=null,nextEmployees=null,changedEmployee=null,reason='입사·온보딩 정보 수정';
    if(action==='save'){
      if(await persist({nextProfiles,reason})){root.uxToast?.('입사 준비 정보를 저장했습니다.');closeModal();}
      return;
    }
    if(action==='cancel'){
      if(linkedEmployee(applicant,currentEmployees())){root.document.getElementById('onboardingModalNotice').textContent='이미 사원명부에 전환된 지원자는 사원 상태를 먼저 확인해주세요.';return;}
      const cancellationReason=text(root.document.getElementById('onboardingCancellationReason')?.value);
      if(!cancellationReason){root.document.getElementById('onboardingModalNotice').textContent='입사 취소 사유를 입력해주세요.';return;}
      if(!root.confirm?.(`${applicant.name||'선택 지원자'}의 입사를 취소할까요?`))return;
      const stamp=new Date().toISOString(),cancelledProfile={...profile,cancelledAt:stamp,cancellationReason,onboardingUpdatedAt:stamp};nextProfiles=upsertProfile(currentProfiles(),cancelledProfile);
      nextApplicants=currentApplicants().map(row=>text(row.id)===selectedId?normalize({...row,status:'입사철회',finalDecision:'입사철회',withdrawalReason:cancellationReason,updatedAt:stamp}):row);reason='입사 취소';
      if(await persist({nextProfiles,nextApplicants,reason})){root.uxToast?.('입사 취소를 저장했습니다.');closeModal();}return;
    }
    if(action==='attendance'){
      const errors=readinessErrors(profile);if(errors.length){root.document.getElementById('onboardingModalNotice').textContent=`출근 확인 전 보완: ${errors.join(' · ')}`;return;}
      const stamp=new Date().toISOString(),attendedProfile={...profile,attendanceConfirmedAt:profile.attendanceConfirmedAt||stamp,onboardingUpdatedAt:stamp};nextProfiles=upsertProfile(currentProfiles(),attendedProfile);
      const attended=normalize({...applicant,status:'출근',finalDecision:'합격',updatedAt:stamp});nextApplicants=currentApplicants().map(row=>text(row.id)===selectedId?attended:row);reason='온보딩 출근 확인';
      if(hasPermission('employee.write')){
        const plan=planConversion({applicant:attended,profile:attendedProfile,employees:currentEmployees(),profiles:nextProfiles,idFactory:()=>typeof uid==='function'?uid():root.crypto?.randomUUID?.(),now:stamp});
        if(!plan.ok){root.document.getElementById('onboardingModalNotice').textContent=plan.message;return;}
        if(plan.created){changedEmployee=typeof normalizeEmployee==='function'?normalizeEmployee(plan.employee):plan.employee;nextEmployees=[changedEmployee,...currentEmployees()];nextApplicants=nextApplicants.map(row=>text(row.id)===selectedId?normalize(plan.applicant):row);}
      }
      if(await persist({nextProfiles,nextApplicants,nextEmployees,changedEmployee,reason})){root.uxToast?.(changedEmployee?'출근 확인과 사원명부 전환을 완료했습니다.':'출근 확인을 저장했습니다. 관리자 전환을 기다립니다.');closeModal();}return;
    }
    if(action==='convert'){
      const plan=planConversion({applicant,profile,employees:currentEmployees(),profiles:currentProfiles(),idFactory:()=>typeof uid==='function'?uid():root.crypto?.randomUUID?.()});
      if(!plan.ok){root.document.getElementById('onboardingModalNotice').textContent=plan.message;return;}
      if(!plan.created){root.document.getElementById('onboardingModalNotice').textContent=plan.message;render();return;}
      changedEmployee=typeof normalizeEmployee==='function'?normalizeEmployee(plan.employee):plan.employee;nextEmployees=[changedEmployee,...currentEmployees()];nextApplicants=currentApplicants().map(row=>text(row.id)===selectedId?normalize(plan.applicant):row);reason='온보딩 사원명부 전환';
      if(await persist({nextProfiles,nextApplicants,nextEmployees,changedEmployee,reason})){root.uxToast?.('사원명부 전환을 완료했습니다.');closeModal();}
    }
  }
  function init(){
    if(!root.document)return;ensureUi();
    const baseSetPage=root.setPage;if(typeof baseSetPage==='function')root.setPage=function(page){const result=baseSetPage(page);if(result===false)return false;if(page==='onboarding'){const title=root.document.getElementById('page-title');if(title)title.textContent='입사·온보딩';const breadcrumb=root.document.querySelector('.topbar-breadcrumb');if(breadcrumb)breadcrumb.textContent='최종합격부터 출근과 사원명부 전환까지 확인합니다.';render();}return result;};
    root.document.addEventListener('erp:permission-change',()=>render());
    root.document.addEventListener('erp:storage-write',event=>{if(['recruit_erp_applicants_stable','recruit_erp_employees','recruit_erp_hire_waiting_profiles'].includes(event.detail?.key)&&root.document.body.dataset.activePage==='onboarding')render();});
    root.document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.document.getElementById('onboardingModal')?.classList.contains('show'))closeModal();});
    root.setTimeout?.(()=>render(),0);
  }
  const api={VERSION,REQUIRED_DOCUMENTS,STAGES,isCancelled,isCandidate,employeeLinkState,linkedEmployee,normalizeSubmittedDocuments,missingDocuments,stageChecks,progress,validateEmployeeNumber,planConversion,buildRows,summary,upsertProfile,readinessErrors,ensureUi,render,openModal,closeModal,init};
  if(root.document)init();
  return api;
});
