(function(){
'use strict';
const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>Array.from(r.querySelectorAll(s));
function closeDrawer(){const p=qs('#advancedSearch');if(!p)return;p.classList.remove('drawer-open','active');document.body.style.overflow='';const ap=qs('#applicants');if(ap)ap.classList.add('active');}
function moveFilterButton(){
 const controls=qs('#applicants .compact-list-controls');if(!controls)return;
 qsa('.advanced-filter-open,.advanced-filter-inline').forEach(b=>b.remove());
 const b=document.createElement('button');b.type='button';b.className='advanced-filter-inline';b.textContent='상세조건';
 b.onclick=()=>{const p=qs('#advancedSearch');if(!p)return;p.classList.add('drawer-open','active');document.body.style.overflow='hidden';};
 controls.appendChild(b);
}
function buildDateDetails(){
 const grid=qs('#advancedSearch .advanced-form-grid');if(!grid||qs('.date-filter-details',grid))return;
 const ids=['asApplyFrom','asApplyTo','asInterviewFrom','asInterviewTo','asHireFrom','asHireTo'];
 const labels=ids.map(id=>qs('#'+id)?.closest('label')).filter(Boolean);
 const details=document.createElement('details');details.className='date-filter-details';
 details.innerHTML='<summary>기간 조건</summary><div class="date-filter-grid"></div>';
 grid.insertBefore(details,grid.firstChild);const inner=qs('.date-filter-grid',details);labels.forEach(l=>inner.appendChild(l));
}
function moveSavedSearch(){
 const panel=qs('#advancedSearch .advanced-filter-panel'), box=qs('#advancedSearch .saved-search-box'), grid=qs('#advancedSearch .advanced-form-grid');
 if(panel&&box&&grid)panel.insertBefore(box,grid);
}
function simplifyHero(){
 const hero=qs('#advancedSearch .advanced-hero');if(!hero)return;
 const h=qs('h3',hero);if(h)h.textContent='상세조건';
 const close=qs('.advanced-close-btn',hero);if(close)close.textContent='닫기';
 const reset=qs('#asReset');if(reset)reset.textContent='초기화';
 const run=qs('#asRun');if(run){run.textContent='조건 적용';run.addEventListener('click',()=>{setTimeout(()=>{closeDrawer();const note=qs('#applicants .advanced-applied-chip');if(note)note.remove();const summary=qs('#applicants .list-summary');if(summary&&Array.isArray(window.__erpAdvancedFilterIds)){const chip=document.createElement('span');chip.className='advanced-applied-chip';chip.textContent='상세조건 적용 '+window.__erpAdvancedFilterIds.length+'명';summary.appendChild(chip)}},0)});}
}
function resetBehavior(){const reset=qs('#asReset');if(reset)reset.addEventListener('click',()=>{const chip=qs('#applicants .advanced-applied-chip');if(chip)chip.remove()});}
function updateVersion(){document.title='채용관리 시스템 v10.38.7';const brand=qs('.brand-copy p');if(brand)brand.textContent='VERSION 2.0 · v10.38.7';}
function init(){moveFilterButton();buildDateDetails();moveSavedSearch();simplifyHero();resetBehavior();updateVersion();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
