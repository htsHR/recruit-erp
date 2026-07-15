(function(){
  'use strict';
  function qs(s,r){return (r||document).querySelector(s)}
  function qsa(s,r){return Array.from((r||document).querySelectorAll(s))}
  function openAdvanced(){
    var p=qs('#advancedSearch');
    if(!p)return;
    p.classList.add('drawer-open','active');
    document.body.style.overflow='hidden';
    if(typeof window.setPage==='function'){
      try{
        var old=qs('.page.active:not(#advancedSearch)');
        if(old) old.classList.add('active');
      }catch(e){}
    }
    var run=qs('#asRun'); if(run) run.click();
  }
  function closeAdvanced(){
    var p=qs('#advancedSearch');
    if(!p)return;
    p.classList.remove('drawer-open','active');
    document.body.style.overflow='';
    var ap=qs('#applicants'); if(ap) ap.classList.add('active');
    var nav=qs('.nav-btn[data-page="applicants"]');
    qsa('.nav-btn').forEach(function(b){b.classList.toggle('active',b===nav)});
    var title=qs('#page-title'); if(title) title.textContent='지원자 관리';
  }
  function installHead(){
    var page=qs('#applicants'), card=page&&qs('.list-top-card',page);
    if(!page||!card||qs('.applicant-page-head',page))return;
    var head=document.createElement('div');
    head.className='applicant-page-head';
    head.innerHTML='<div><h3>지원자 관리</h3><p>검색과 상태 확인, 선택 작업을 한 화면에서 처리합니다.</p></div><div class="applicant-filter-actions"><button class="ghost advanced-filter-open" type="button">상세필터</button></div>';
    page.insertBefore(head,card);
    qs('.advanced-filter-open',head).onclick=openAdvanced;
  }
  function installDrawerClose(){
    var hero=qs('#advancedSearch .advanced-hero-actions');
    if(!hero||qs('.advanced-close-btn',hero))return;
    var b=document.createElement('button');
    b.type='button';b.className='ghost advanced-close-btn';b.textContent='닫기';
    hero.insertBefore(b,hero.firstChild);b.onclick=closeAdvanced;
    var p=qs('#advancedSearch');
    p.addEventListener('click',function(e){if(e.target===p)closeAdvanced()});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&p.classList.contains('drawer-open'))closeAdvanced()});
  }
  function simplifyNav(){
    var a=qs('.nav-btn[data-page="applicants"] span:last-child');if(a)a.textContent='지원자 관리';
    var h=qs('.nav-btn[data-page="dataHealth"] span:last-child');if(h)h.textContent='데이터 관리';
    var b=qs('.nav-btn[data-page="backup"] span:last-child');if(b)b.textContent='백업센터';
  }
  function installDataTabs(){
    ['dataHealth','duplicates'].forEach(function(id){
      var root=qs('#'+id+' > div');if(!root||qs('.cleanup-data-tabs',root))return;
      var tabs=document.createElement('div');tabs.className='cleanup-data-tabs';
      tabs.innerHTML='<button type="button" data-target="dataHealth">데이터 점검</button><button type="button" data-target="duplicates">중복 후보</button>';
      root.insertBefore(tabs,root.firstChild);
      qsa('button',tabs).forEach(function(btn){btn.classList.toggle('active',btn.dataset.target===id);btn.onclick=function(){var n=qs('.nav-btn[data-page="'+btn.dataset.target+'"]');if(n)n.click()}});
    });
  }
  function removeOldToolbar(){var x=qs('.cleanup-list-toolbar');if(x)x.remove()}
  function keepApplicantVisible(){
    var old=window.setPage;
    if(typeof old!=='function'||old.__applicantRedesign)return;
    function wrapped(page){
      if(page==='advancedSearch'){openAdvanced();return}
      closeAdvanced();old(page)
    }
    wrapped.__applicantRedesign=true;window.setPage=wrapped;
  }
  function init(){removeOldToolbar();simplifyNav();installHead();installDrawerClose();installDataTabs();keepApplicantVisible()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
