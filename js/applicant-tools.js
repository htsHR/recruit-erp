/* Recruit ERP v12.5.0 — applicant form helpers and exports. */
window.editApplicant=editApplicant; window.deleteApplicant=deleteApplicant; window.duplicateApplicant=duplicateApplicant;
  window.viewApplicant=viewApplicant; window.updateApplicantStatus=updateApplicantStatus; window.resetAndRenderList=resetAndRenderList;

function updateFormMode(){
  const editing = !!($('editId') && $('editId').value);
  if($('submitBtn')) $('submitBtn').textContent = editing ? '수정 저장' : '지원자 등록';
}

function updateApplicantFormDerivedFields(){
  if(!$('age').value && $('birthYear').value) $('age').value=calcAge($('birthYear').value);
}
function normalizePhone(v){ return String(v||'').replace(/\D/g,''); }
function checkDuplicate(){
  if(!$('duplicateBox')) return;
  const f=getForm();
  const fPhone=normalizePhone(f.phone);
  const dups=applicants.filter(a=>a.id!==f.editId && ((fPhone && fPhone.length>=8 && normalizePhone(a.phone)===fPhone)||(f.email&&a.email===f.email)||(f.name&&a.name===f.name&&f.birthYear&&a.birthYear===f.birthYear)));
  if(dups.length){ $('duplicateBox').className='wide duplicate-box warn'; $('duplicateBox').textContent=`중복 가능성: ${dups.map(d=>d.name+'('+d.phone+')').join(', ')}`; }
  else { $('duplicateBox').textContent=''; $('duplicateBox').className='wide duplicate-box'; }
}
function download(name, content, type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function csv(){
  const headers=['지원날짜','지원경로','연락상태','지원근무지','성명','연락처','이메일','성별','생년월일','연령','거주지역',
    '출근방법','학력구분','최종학교','전공/학과','외국어/기타자격','지원구분','확인필요사항','자소서키워드','자격증','경력사항','면접날짜',
    '면접시간','입사예정일','상담내용','메모','면접결과','결과·검토메모','다음액션'];
  const lines=[headers,...applicants.map(a=>[a.applyDate,
    a.source,a.status,a.workplace,a.name,a.phone,a.email,a.gender,a.birthYear,a.age,a.region,
    dormLabel(a),a.education,a.school,a.major,a.languageEtc,a.careerType,displayCheckNeeds(a.checkNeeds),
    a.selfIntroKeywords,a.certs,a.career,a.interviewDate,a.interviewTime,a.hireDate,a.consult,a.memo,
    a.finalDecision,a.decisionReason,nextAction(a)])].map(row=>row.map(v=>window.erpSafety.csvCell(v,true)).join(','));
  download(`지원자명단_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function jsonBackup(){ localStorage.setItem(BACKUP_KEY, today()); download(`resume_management_backup_${today()}.json`,JSON.stringify(applicants,null,2),'application/json'); renderAll(); }
