/* ===== CONSOLIDATED SOURCE: applicant-ui-v10.39.0.js ===== */
(function(){'use strict';
const q=(s,r=document)=>r.querySelector(s);
function open(){const p=q('#advancedSearch');if(!p)return;p.classList.add('drawer-open','active');document.body.style.overflow='hidden';}
function close(){const p=q('#advancedSearch');if(!p)return;p.classList.remove('drawer-open','active');document.body.style.overflow='';if(!document.querySelector('.page.active')){const a=q('#applicants');if(a)a.classList.add('active');}}
function init(){
 const openBtn=q('#btnOpenApplicantFilter'), closeBtn=q('#btnCloseApplicantFilter'), cancel=q('#btnCancelApplicantFilter'), back=q('#applicantFilterBackdrop'), run=q('#asRun');
 if(openBtn)openBtn.onclick=open;if(closeBtn)closeBtn.onclick=close;if(cancel)cancel.onclick=close;if(back)back.onclick=close;if(run)run.addEventListener('click',()=>setTimeout(close,0));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
 const nav=q('.nav-btn[data-page="advancedSearch"]');if(nav)nav.style.display='none';
 const old=window.setPage;if(typeof old==='function'&&!old.__v10390){window.setPage=function(page){if(page==='advancedSearch'){open();return}close();return old(page)};window.setPage.__v10390=true;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();})();
;
