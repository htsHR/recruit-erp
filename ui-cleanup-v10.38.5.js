(function(){
  'use strict';
  function clickPage(page){
    var btn=document.querySelector('.nav-btn[data-page="'+page+'"]');
    if(btn){ btn.click(); return true; }
    return false;
  }
  function updateDataTab(active){
    document.querySelectorAll('.cleanup-data-tabs button').forEach(function(b){
      b.classList.toggle('active',b.dataset.target===active);
    });
  }
  function installApplicantToolbar(){
    var page=document.getElementById('applicants');
    var card=page&&page.querySelector('.list-top-card');
    if(!card||page.querySelector('.cleanup-list-toolbar')) return;
    var bar=document.createElement('div');
    bar.className='cleanup-list-toolbar';
    bar.innerHTML='<div class="cleanup-toolbar-left"><strong>지원자 검색·관리</strong><span class="muted">기본 필터로 빠르게 찾고, 필요한 경우 상세조건을 사용하세요.</span></div><button class="ghost cleanup-advanced-btn" type="button">상세필터 열기</button>';
    card.parentNode.insertBefore(bar,card);
    bar.querySelector('button').addEventListener('click',function(){clickPage('advancedSearch');});
  }
  function installDataTabs(){
    ['dataHealth','duplicates'].forEach(function(id){
      var page=document.getElementById(id);
      var root=page&&page.firstElementChild;
      if(!root||root.querySelector('.cleanup-data-tabs')) return;
      var tabs=document.createElement('div');
      tabs.className='cleanup-data-tabs';
      tabs.innerHTML='<button type="button" data-target="dataHealth">데이터 점검</button><button type="button" data-target="duplicates">중복 후보</button>';
      root.insertBefore(tabs,root.firstChild);
      tabs.addEventListener('click',function(e){
        var b=e.target.closest('button[data-target]');
        if(!b) return;
        clickPage(b.dataset.target);
        updateDataTab(b.dataset.target);
      });
      updateDataTab(id);
    });
  }
  function renameNavigation(){
    var health=document.querySelector('.nav-btn[data-page="dataHealth"] span:last-child');
    if(health) health.textContent='데이터 관리';
    var backup=document.querySelector('.nav-btn[data-page="backup"] span:last-child');
    if(backup) backup.textContent='백업센터';
    var applicants=document.querySelector('.nav-btn[data-page="applicants"] span:last-child');
    if(applicants) applicants.textContent='지원자 관리';
  }
  function simplifyCopy(){
    var crumb=document.querySelector('.topbar-breadcrumb');
    if(crumb) crumb.textContent='채용·인사 통합 관리';
    document.querySelectorAll('.advanced-hero p,.health-hero p,.backup-center-hero p').forEach(function(p){
      p.textContent=p.textContent.replace(/\s+/g,' ').trim();
    });
  }
  function observePages(){
    document.addEventListener('click',function(e){
      var b=e.target.closest('[data-page]');
      if(!b) return;
      setTimeout(function(){
        var active=document.querySelector('.page.active');
        if(active&&(active.id==='dataHealth'||active.id==='duplicates')) updateDataTab(active.id);
      },0);
    });
  }
  function init(){renameNavigation();installApplicantToolbar();installDataTabs();simplifyCopy();observePages();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
