/* Recruit ERP v10.40.30 APPLICANT_QUICK_ENTRY
 * 기존 정식 입력폼·엑셀 붙여넣기·applicants 구조를 변경하지 않는 별도 빠른 등록 모드
 */
(function(){
'use strict';
const QUICK_DEFAULTS_KEY='recruit_erp_quick_entry_defaults_v10_40_30';
const ids=['quickApplyDate','quickWorkplace','quickSource','quickDormUse','quickStatus'];
function el(id){return document.getElementById(id);}
function readDefaults(){try{return JSON.parse(localStorage.getItem(QUICK_DEFAULTS_KEY)||'{}')||{};}catch{return{};}}
function writeDefaults(){
  if(!el('quickRememberDefaults')?.checked){localStorage.removeItem(QUICK_DEFAULTS_KEY);return;}
  const out={}; ids.forEach(id=>{if(el(id))out[id]=el(id).value;});
  localStorage.setItem(QUICK_DEFAULTS_KEY,JSON.stringify(out));
}
function applyDefaults(){
  const d=readDefaults();
  if(el('quickApplyDate'))el('quickApplyDate').value=d.quickApplyDate||today();
  if(el('quickWorkplace'))el('quickWorkplace').value=d.quickWorkplace||'';
  if(el('quickSource'))el('quickSource').value=d.quickSource||'';
  if(el('quickDormUse'))el('quickDormUse').value=d.quickDormUse||'';
  if(el('quickStatus'))el('quickStatus').value=d.quickStatus||'미연락';
}
function setMode(mode){
  const quick=mode==='quick';
  if(el('quickApplicantForm'))el('quickApplicantForm').hidden=!quick;
  if(el('fullApplicantFormWrap'))el('fullApplicantFormWrap').hidden=quick;
  el('btnApplicantQuickMode')?.classList.toggle('active',quick);
  el('btnApplicantFullMode')?.classList.toggle('active',!quick);
  if(el('submitBtn'))el('submitBtn').style.display=quick?'none':'';
  if(el('btnResetForm'))el('btnResetForm').style.display=quick?'none':'';
  if(quick){applyDefaults();setTimeout(()=>el('quickName')?.focus(),0);}
  else setTimeout(()=>el('name')?.focus(),0);
}
function normalizeQuickPhone(){if(el('quickPhone'))el('quickPhone').value=formatPhoneDisplay(el('quickPhone').value);}
function resetPersonFields(){
  ['quickName','quickPhone','quickSchool','quickMemo'].forEach(id=>{if(el(id))el(id).value='';});
  if(!el('quickRememberDefaults')?.checked){localStorage.removeItem(QUICK_DEFAULTS_KEY);applyDefaults();}
  setTimeout(()=>el('quickName')?.focus(),0);
}
function submitQuick(e){
  e.preventDefault();
  normalizeQuickPhone();
  const name=String(el('quickName')?.value||'').trim();
  if(!name){alert('성명을 입력해주세요.');el('quickName')?.focus();return;}
  const phone=String(el('quickPhone')?.value||'').trim();
  const phoneKey=normalizePhone(phone);
  const dup=applicants.find(a=>phoneKey&&phoneKey.length>=8&&normalizePhone(a.phone)===phoneKey);
  if(dup&&!confirm(`중복 가능성이 있습니다: ${dup.name}\n그래도 빠른 등록할까요?`))return;
  const record=normalize({
    id:uid(),createdAt:new Date().toISOString(),
    applyDate:el('quickApplyDate')?.value||today(),
    name,phone,
    workplace:el('quickWorkplace')?.value||'',
    school:el('quickSchool')?.value||'',schoolId:'',
    status:el('quickStatus')?.value||'미연락',
    source:el('quickSource')?.value||'',
    dormUse:el('quickDormUse')?.value||'',
    memo:el('quickMemo')?.value||''
  });
  applicants.unshift(record);
  writeDefaults();
  save();
  const result=el('quickEntryResult');
  if(result){result.textContent=`${record.name} 등록 완료 · 반복값을 유지했습니다.`;result.classList.add('show');setTimeout(()=>result.classList.remove('show'),2500);}
  resetPersonFields();
}
function openExcelFromQuick(){
  setMode('full');
  if(typeof openExcelRowPaste==='function')openExcelRowPaste();
}
function init(){
  el('btnApplicantQuickMode')?.addEventListener('click',()=>setMode('quick'));
  el('btnApplicantFullMode')?.addEventListener('click',()=>setMode('full'));
  el('btnOpenFullFromQuick')?.addEventListener('click',()=>setMode('full'));
  el('quickApplicantForm')?.addEventListener('submit',submitQuick);
  el('quickPhone')?.addEventListener('blur',normalizeQuickPhone);
  el('btnQuickClearDefaults')?.addEventListener('click',()=>{localStorage.removeItem(QUICK_DEFAULTS_KEY);applyDefaults();});
  el('btnOpenExcelRowPaste')?.addEventListener('click',()=>{if(!el('quickApplicantForm')?.hidden)setMode('full');});
  applyDefaults();
  window.setApplicantEntryMode=setMode;
  window.openExcelFromQuick=openExcelFromQuick;
}
init();
})();
