(function(){
'use strict';
const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
function setVersion(){
 document.title='채용관리 시스템 v10.38.9';
 const brand=q('.brand-copy p'); if(brand)brand.textContent='VERSION 2.0 · v10.38.9';
}
function fieldLabel(id){const el=document.getElementById(id);return el?el.closest('label'):null}
function makeSection(title,ids){
 const sec=document.createElement('section');sec.className='drawer-section';
 const heading=document.createElement('div');heading.className='drawer-section-title';heading.textContent=title;
 const grid=document.createElement('div');grid.className='drawer-grid';
 ids.forEach(id=>{const lab=fieldLabel(id);if(lab)grid.appendChild(lab)});
 sec.append(heading,grid);return sec;
}
function buildDrawer(){
 const page=q('#advancedSearch'), panel=q('.advanced-filter-panel',page), hero=q('.advanced-hero',page);
 if(!page||!panel||!hero)return;
 let body=q('#applicantFilterDrawerBody',panel);if(body)body.remove();
 body=document.createElement('div');body.id='applicantFilterDrawerBody';
 const saved=q('.saved-search-box',panel)||q('.saved-search-box',page);
 if(saved){const wrap=document.createElement('div');wrap.className='drawer-saved';const t=document.createElement('div');t.className='drawer-saved-title';t.textContent='저장된 검색조건';wrap.append(t,saved);body.appendChild(wrap)}
 body.appendChild(makeSection('기본 조건',['asStatus','asWorkplace','asSchool','asManager']));
 body.appendChild(makeSection('추가 조건',['asContact','asDorm','asKeyword']));
 const dates=document.createElement('section');dates.className='drawer-section';
 const details=document.createElement('details');details.className='drawer-date-details';
 const summary=document.createElement('summary');summary.textContent='기간 조건';
 const dateBody=document.createElement('div');dateBody.className='date-body';
 const dateGrid=document.createElement('div');dateGrid.className='drawer-grid';
 ['asApplyFrom','asApplyTo','asInterviewFrom','asInterviewTo','asHireFrom','asHireTo'].forEach(id=>{const lab=fieldLabel(id);if(lab)dateGrid.appendChild(lab)});
 dateBody.appendChild(dateGrid);details.append(summary,dateBody);dates.appendChild(details);body.appendChild(dates);
 panel.appendChild(body);
 const actions=q('.advanced-hero-actions',hero);if(actions){
   let reset=q('#asReset');let close=q('.advanced-close-btn',actions);
   if(!close){close=document.createElement('button');close.type='button';close.className='ghost advanced-close-btn';close.textContent='닫기';actions.appendChild(close)}
   if(reset){reset.textContent='초기화';actions.insertBefore(reset,close)}
   close.onclick=closeDrawer;
 }
 let footer=q('.filter-drawer-footer',page);if(!footer){footer=document.createElement('div');footer.className='filter-drawer-footer';page.appendChild(footer)}
 footer.innerHTML='';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='ghost';cancel.textContent='취소';cancel.onclick=closeDrawer;
 const apply=q('#asRun')||document.createElement('button');apply.id='asRun';apply.type='button';apply.className='primary';apply.textContent='조건 적용';
 apply.addEventListener('click',()=>setTimeout(closeDrawer,20));footer.append(cancel,apply);
}
function openDrawer(){const p=q('#advancedSearch');if(!p)return;p.classList.add('drawer-open','active');document.body.style.overflow='hidden';}
function closeDrawer(){const p=q('#advancedSearch');if(!p)return;p.classList.remove('drawer-open','active');const a=q('#applicants');if(a)a.classList.add('active');document.body.style.overflow='';}
function fixControls(){
 const controls=q('#applicants .compact-list-controls');if(!controls)return;
 const detail=q('.advanced-filter-inline',controls);if(detail){detail.textContent='상세조건';detail.onclick=openDrawer}
 const select=q('.applicant-select-toggle',controls);if(select){select.textContent='선택';select.title='여러 지원자 선택'}
}
function fixDrawerOverlay(){
 const page=q('#advancedSearch');if(!page)return;
 page.addEventListener('click',e=>{if(e.target===page)closeDrawer()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&page.classList.contains('drawer-open'))closeDrawer()});
}
function fixDetailModal(){
 const modal=q('#detailModal');if(!modal)return;
 const observer=new MutationObserver(()=>{if(modal.classList.contains('show')){document.body.style.overflow='hidden';const body=q('#detailBody',modal);if(body)body.scrollTop=0}else if(!q('#advancedSearch.drawer-open'))document.body.style.overflow=''});
 observer.observe(modal,{attributes:true,attributeFilter:['class']});
}
function init(){setVersion();buildDrawer();fixControls();fixDrawerOverlay();fixDetailModal();const nav=q('.nav-btn[data-page="advancedSearch"]');if(nav)nav.style.display='none';}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
