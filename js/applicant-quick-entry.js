/* Recruit ERP v11.5.0 APPLICANT QUICK ENTRY
 * 기존 applicants 스키마·정규화·권한·save() 경로만 재사용하며 별도 저장 키를 만들지 않습니다.
 */
(function(root){
'use strict';
const state={open:false,trigger:null,saving:false};
const $id=id=>document.getElementById(id);
function canWrite(){return !root.erpPermissions||root.erpPermissions.has('applicant.write');}
function optionsFrom(sourceId,fallback){
  const source=$id(sourceId);
  if(source?.options?.length)return [...source.options].map(option=>`<option value="${esc(option.value)}"${option.selected?' selected':''}>${esc(option.textContent)}</option>`).join('');
  return fallback.map(value=>`<option value="${esc(value)}">${esc(value||'선택')}</option>`).join('');
}
function ensureUi(){
  if($id('applicantQuickEntry'))return;
  const shell=document.createElement('div');
  shell.id='applicantQuickEntry';shell.className='applicant-quick-entry';shell.setAttribute('aria-hidden','true');
  shell.innerHTML=`<div class="applicant-quick-entry-backdrop" data-quick-entry-close></div><section class="applicant-quick-entry-card" role="dialog" aria-modal="true" aria-labelledby="applicantQuickEntryTitle" aria-describedby="applicantQuickEntryDescription"><header><div><p class="eyebrow">QUICK APPLICANT ENTRY</p><h3 id="applicantQuickEntryTitle">지원자 빠른 등록</h3><p id="applicantQuickEntryDescription">자주 쓰는 항목만 입력하고 기존 저장 절차로 한 번만 등록합니다.</p></div><button class="ghost" id="btnQuickEntryClose" type="button" aria-label="빠른 등록 닫기">닫기</button></header><form id="applicantQuickEntryForm" novalidate><div class="quick-entry-grid"><label>성명 <em class="req">*</em><input id="quickEntryName" autocomplete="off" required></label><label>연락처<input id="quickEntryPhone" inputmode="tel" placeholder="010-0000-0000"></label><label>근무지<select id="quickEntryWorkplace">${optionsFrom('workplace',['','천안','평택','기타'])}</select></label><label>연락 상태<select id="quickEntryStatus">${optionsFrom('status',['서류검토','서류합격','부재중','면접예정'])}</select></label><label class="wide">메모 / 다음 작업<textarea id="quickEntryMemo" rows="3" placeholder="다음 연락이나 확인할 내용을 입력하세요."></textarea></label></div><div class="quick-entry-feedback" id="quickEntryFeedback" role="status" aria-live="polite"></div><div class="quick-entry-duplicate" id="quickEntryDuplicate" hidden></div><footer><button class="ghost" data-quick-entry-close type="button">취소</button><button class="primary" id="btnQuickEntrySave" type="submit" data-required-permission="applicant.write">확인 후 등록</button></footer></form></section>`;
  document.body.appendChild(shell);
  shell.querySelectorAll('[data-quick-entry-close]').forEach(button=>button.addEventListener('click',close));
  $id('btnQuickEntryClose')?.addEventListener('click',close);
  $id('applicantQuickEntryForm')?.addEventListener('submit',submit);
  $id('quickEntryPhone')?.addEventListener('blur',event=>{event.target.value=formatPhoneDisplay(event.target.value);refreshDuplicate();});
  $id('quickEntryPhone')?.addEventListener('input',refreshDuplicate);
  shell.addEventListener('keydown',trapFocus);
}
function feedback(message,type=''){
  const target=$id('quickEntryFeedback');if(!target)return;
  target.className=`quick-entry-feedback ${type}`;target.textContent=message||'';
}
function reset(){
  $id('applicantQuickEntryForm')?.reset();
  if($id('quickEntryStatus'))$id('quickEntryStatus').value='서류검토';
  if($id('quickEntryWorkplace'))$id('quickEntryWorkplace').value='';
  feedback('');
  const duplicate=$id('quickEntryDuplicate');if(duplicate){duplicate.hidden=true;duplicate.innerHTML='';}
}
function open(trigger=null){
  ensureUi();
  if(!canWrite()){root.erpPermissions?.require('applicant.write');return false;}
  state.open=true;state.trigger=trigger||document.activeElement;reset();
  const shell=$id('applicantQuickEntry');shell.classList.add('is-open');shell.setAttribute('aria-hidden','false');
  document.body.classList.add('applicant-quick-entry-open');
  requestAnimationFrame(()=>$id('quickEntryName')?.focus({preventScroll:true}));
  return true;
}
function close(){
  if(!state.open||state.saving)return false;
  state.open=false;const trigger=state.trigger;state.trigger=null;
  const shell=$id('applicantQuickEntry');shell?.classList.remove('is-open');shell?.setAttribute('aria-hidden','true');
  document.body.classList.remove('applicant-quick-entry-open');
  requestAnimationFrame(()=>trigger?.isConnected&&trigger.focus?.({preventScroll:true}));
  return true;
}
function duplicateRows(){
  const phone=normalizePhone($id('quickEntryPhone')?.value||'');
  if(phone.length<8)return[];
  return applicants.filter(applicant=>normalizePhone(applicant.phone)===phone);
}
function refreshDuplicate(){
  const host=$id('quickEntryDuplicate');if(!host)return[];
  const rows=duplicateRows();
  if(!rows.length){host.hidden=true;host.innerHTML='';return rows;}
  host.hidden=false;
  host.innerHTML=`<strong>중복 가능성 ${rows.length}명</strong><span>같은 연락처가 있습니다. 기존 지원자를 확인한 뒤 계속하세요.</span><label><input id="quickEntryDuplicateConfirm" type="checkbox"> 중복 가능성을 확인했습니다.</label>`;
  return rows;
}
function restoreBrowserSnapshot(before){
  try{
    if(localStorage.getItem(STORAGE_KEY)===before)return true;
    if(before===null)localStorage.removeItem(STORAGE_KEY);else localStorage.setItem(STORAGE_KEY,before);
    return localStorage.getItem(STORAGE_KEY)===before;
  }catch{return false;}
}
function values(){return{
  name:String($id('quickEntryName')?.value||'').trim(),phone:String($id('quickEntryPhone')?.value||'').trim(),
  workplace:String($id('quickEntryWorkplace')?.value||'').trim(),status:String($id('quickEntryStatus')?.value||'').trim(),
  memo:String($id('quickEntryMemo')?.value||'').trim()
};}
function submit(event){
  event?.preventDefault?.();
  if(state.saving)return false;
  if(!canWrite()){root.erpPermissions?.require('applicant.write');return false;}
  const input=values();
  if(!input.name){feedback('성명을 입력해 주세요.','error');$id('quickEntryName')?.focus();return false;}
  const duplicates=refreshDuplicate();
  if(duplicates.length&&!$id('quickEntryDuplicateConfirm')?.checked){feedback('중복 가능성을 확인해야 등록할 수 있습니다.','warning');$id('quickEntryDuplicateConfirm')?.focus();return false;}
  if(!root.confirm('입력한 내용으로 지원자를 등록할까요?'))return false;
  const id=uid(),record=normalize({...input,id,createdAt:new Date().toISOString(),applyDate:today(),status:input.status||'서류검토'});
  const beforeApplicants=applicants,beforeStorage=localStorage.getItem(STORAGE_KEY);
  state.saving=true;applicants=[record,...applicants];
  let saved=false;try{saved=save()===true;}catch{saved=false;}state.saving=false;
  if(!saved){
    applicants=beforeApplicants;
    const restored=restoreBrowserSnapshot(beforeStorage);
    if(typeof root.applicantProgressHistoryRefreshSnapshots==='function')root.applicantProgressHistoryRefreshSnapshots();
    feedback(restored?'저장하지 못했습니다. 입력 내용은 그대로 남아 있습니다.':'저장과 원상복구에 실패했습니다. 브라우저 저장공간을 확인해 주세요.','error');
    return false;
  }
  state.open=false;state.trigger=null;
  const shell=$id('applicantQuickEntry');shell?.classList.remove('is-open');shell?.setAttribute('aria-hidden','true');document.body.classList.remove('applicant-quick-entry-open');
  root.openApplicantQuickDetailFromWorkflow?.(id,$id('btnQuickApplicantEntry'));
  return true;
}
function focusable(){return [...($id('applicantQuickEntry')?.querySelectorAll('button:not([disabled]):not([hidden]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')||[])].filter(element=>element.getClientRects().length&&!element.classList.contains('erp-permission-hidden'));}
function trapFocus(event){
  if(!state.open)return;if(event.key==='Escape'){event.preventDefault();close();return;}if(event.key!=='Tab')return;
  const list=focusable(),first=list[0],last=list.at(-1);if(!first)return;
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
}
function init(){ensureUi();$id('btnQuickApplicantEntry')?.addEventListener('click',event=>open(event.currentTarget));}
root.erpApplicantQuickEntry={open,close,submit,refreshDuplicate,state};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
