(function(){
'use strict';
const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
function closeDrawer(){const p=qs('#advancedSearch');if(!p)return;p.classList.remove('drawer-open','active');document.body.style.overflow='';const a=qs('#applicants');if(a)a.classList.add('active');}
function openDrawer(){const p=qs('#advancedSearch');if(!p)return;p.classList.add('drawer-open','active');document.body.style.overflow='hidden';}
function updateVersion(){document.title='채용관리 시스템 v10.38.8';const brand=qs('.brand-copy p');if(brand)brand.textContent='VERSION 2.0 · v10.38.8';}
function rebuildDrawer(){
 const page=qs('#advancedSearch'), hero=qs('.advanced-hero',page), panel=qs('.advanced-filter-panel',page), grid=qs('.advanced-form-grid',page);
 if(!page||!hero||!panel||!grid||page.dataset.refined==='1')return; page.dataset.refined='1';
 const title=qs('h3',hero); if(title)title.textContent='상세조건';
 const actions=qs('.advanced-hero-actions',hero); if(actions){
   const close=qs('.advanced-close-btn',actions)||document.createElement('button'); close.type='button';close.className='ghost advanced-close-btn';close.textContent='닫기';close.onclick=closeDrawer;
   const reset=qs('#asReset',actions); const run=qs('#asRun',actions);
   actions.innerHTML=''; actions.appendChild(close);
   if(reset){reset.textContent='초기화';actions.insertBefore(reset,close);}
   if(run)run.remove();
 }
 const labels={
   basic:['asStatus','asWorkplace','asSchool','asManager'],
   extra:['asContact','asDorm','asKeyword'],
   dates:['asApplyFrom','asApplyTo','asInterviewFrom','asInterviewTo','asHireFrom','asHireTo']
 };
 function section(titleText, ids){const sec=document.createElement('section');sec.className='filter-section';sec.innerHTML='<div class="filter-section-title">'+titleText+'</div><div class="filter-section-grid"></div>';const body=qs('.filter-section-grid',sec);ids.forEach(id=>{const el=qs('#'+id);const lab=el&&el.closest('label');if(lab)body.appendChild(lab)});return sec;}
 const saved=qs('.saved-search-box',panel); grid.innerHTML='';
 grid.appendChild(section('기본 조건',labels.basic));
 grid.appendChild(section('추가 조건',labels.extra));
 const dateSec=section('기간 조건',labels.dates); const details=document.createElement('details');details.className='date-filter-details';details.innerHTML='<summary>기간 조건</summary>';const body=qs('.filter-section-grid',dateSec);details.appendChild(body);dateSec.innerHTML='';dateSec.appendChild(details);grid.appendChild(dateSec);
 if(saved)panel.insertBefore(saved,grid);
 const footer=document.createElement('div');footer.className='filter-drawer-footer';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='ghost';cancel.textContent='취소';cancel.onclick=closeDrawer;
 const apply=qs('#asRun')||document.createElement('button');apply.id='asRun';apply.type='button';apply.className='primary';apply.textContent='조건 적용';
 apply.addEventListener('click',()=>setTimeout(closeDrawer,0));footer.append(cancel,apply);page.appendChild(footer);
 page.addEventListener('click',e=>{if(e.target===page)closeDrawer()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&page.classList.contains('drawer-open'))closeDrawer()});
 const reset=qs('#asReset');if(reset)reset.addEventListener('click',()=>{qsa('input',grid).forEach(i=>{if(i.type!=='checkbox')i.value=''});qsa('select',grid).forEach(s=>s.value='all');});
}
function rebuildApplicantControls(){
 const controls=qs('#applicants .compact-list-controls');if(!controls)return;
 qsa('.advanced-filter-inline,.applicant-select-toggle',controls).forEach(x=>x.remove());
 const detail=document.createElement('button');detail.type='button';detail.className='advanced-filter-inline';detail.textContent='상세조건';detail.onclick=openDrawer;
 const select=document.createElement('button');select.type='button';select.className='applicant-select-toggle';select.textContent='선택';
 select.onclick=()=>{const page=qs('#applicants');const active=!page.classList.contains('selection-mode');page.classList.toggle('selection-mode',active);select.classList.toggle('active',active);select.textContent=active?'선택 종료':'선택';if(!active){const clear=qs('#bulkClear');if(clear)clear.click();qsa('#applicantTbody .bulk-row-checkbox').forEach(c=>c.checked=false)}};
 controls.append(detail,select);
}
function cleanSummary(){qsa('#applicants .advanced-applied-chip').forEach(x=>x.remove());}
function refineDetailModal(){
 const modal=qs('#detailModal');if(!modal)return;
 const observer=new MutationObserver(()=>{if(modal.classList.contains('show')){document.body.style.overflow='hidden';const body=qs('#detailBody',modal);if(body)body.scrollTop=0}else if(!qs('#advancedSearch.drawer-open'))document.body.style.overflow='';});
 observer.observe(modal,{attributes:true,attributeFilter:['class']});
 const close=qs('#btnCloseDetail');if(close)close.addEventListener('click',()=>{document.body.style.overflow=''});
 const back=qs('#detailBackdrop');if(back)back.addEventListener('click',()=>{document.body.style.overflow=''});
}
function hideLegacyNav(){const n=qs('.nav-btn[data-page="advancedSearch"]');if(n)n.style.display='none';}
function init(){updateVersion();rebuildDrawer();rebuildApplicantControls();cleanSummary();refineDetailModal();hideLegacyNav();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
