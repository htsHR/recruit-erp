/* Recruit ERP v11.5.0 RECRUITER DAILY USABILITY
 * 화면 밀도와 접기 상태만 메모리에서 다루며 업무 데이터와 저장 키를 추가하지 않습니다.
 */
(function(root){
'use strict';
function sectionTitle(section){return section.querySelector('.section-title');}
function setSectionExpanded(section,expanded,focus=false){
  const body=section.querySelector('.form-grid'),button=section.querySelector('.form-section-toggle');
  section.classList.toggle('is-collapsed',!expanded);
  if(body){body.hidden=!expanded;body.setAttribute('aria-hidden',expanded?'false':'true');}
  if(button){button.setAttribute('aria-expanded',expanded?'true':'false');button.textContent=expanded?'접기':'펼치기';if(focus)button.focus();}
}
function initFormSections(){
  document.querySelectorAll('#applicantForm [data-form-step="2"],#applicantForm [data-form-step="3"]').forEach((section,index)=>{
    const title=sectionTitle(section),body=section.querySelector('.form-grid');if(!title||!body||section.querySelector('.form-section-toggle'))return;
    if(!body.id)body.id=`formStepBody${section.dataset.formStep}`;
    const button=document.createElement('button');button.type='button';button.className='form-section-toggle';button.setAttribute('aria-controls',body.id);
    button.addEventListener('click',()=>setSectionExpanded(section,section.classList.contains('is-collapsed')));
    title.appendChild(button);setSectionExpanded(section,index!==0);
  });
  const form=document.getElementById('applicantForm');
  form?.addEventListener('invalid',event=>{const section=event.target.closest('.resume-section-card.is-collapsed');if(section)setSectionExpanded(section,true);},true);
}
function initAuxiliaryFilter(){
  const details=document.querySelector('.applicant-auxiliary-filters');
  details?.addEventListener('toggle',()=>details.querySelector('summary')?.setAttribute('aria-expanded',details.open?'true':'false'));
}
function activateWorkflowRows(){
  document.addEventListener('click',event=>{
    const row=event.target.closest('.home-daily-work-item[data-home-applicant-id]');
    if(row&&!event.target.closest('button,a,input,select,textarea'))root.openDailyApplicantDetail?.(row.dataset.homeApplicantId,row);
  });
  document.addEventListener('keydown',event=>{
    const row=event.target.closest?.('.home-daily-work-item[data-home-applicant-id]');
    if(row&&['Enter',' '].includes(event.key)&&!event.target.closest('button,a,input,select,textarea')){event.preventDefault();root.openDailyApplicantDetail?.(row.dataset.homeApplicantId,row);}
  });
}
function init(){initFormSections();initAuxiliaryFilter();activateWorkflowRows();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
