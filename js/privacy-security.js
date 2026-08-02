/* Recruit ERP v10.55.0 privacy and screen-safety controls */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.erpPrivacySecurity=api;
  if(root&&root.document)api.init(root,root.document);
})(typeof window!=='undefined'?window:null,function(){
  'use strict';

  const VERSION='10.55.0';
  const IDLE_MS=10*60*1000;
  const EXPORT_LOG_KEY='recruit_erp_sensitive_export_log';
  const MAX_EXPORT_LOG=50;
  const EXPORT_TARGETS={
    btnCsv:'지원자 전체 CSV',
    btnJson:'지원자 JSON 백업',
    btnCsvEmployees:'사원명부 CSV',
    bulkCsv:'선택 지원자 CSV',
    bulkPrint:'선택 지원자 인쇄',
    btnHireWaitingExport:'입사대기자 엑셀',
    btnSchoolReportCsv:'학교 보고서 CSV',
    btnSchoolReportExcel:'학교 보고서 엑셀',
    btnSchoolReportPrint:'학교 보고서 인쇄',
    btnSchoolAnalyticsExport:'학교 성과 CSV',
    btnSchoolControlExport:'학교 점검 CSV',
    btnDetailPrint:'지원자 상세 인쇄',
    btnRosterPrint:'지원자 명단 인쇄',
    btnCalendarPrintRoster:'일정 명단 인쇄',
    bcExportFull:'ERP 전체 JSON 백업'
  };

  function exportLabelForId(id){
    const value=String(id||'');
    if(EXPORT_TARGETS[value])return EXPORT_TARGETS[value];
    if(value.startsWith('bcExport-'))return 'ERP 부분 JSON 백업';
    return '';
  }
  function shouldLock(lastActivity,now=Date.now(),idleMs=IDLE_MS){
    const last=Number(lastActivity),current=Number(now),limit=Number(idleMs);
    return Number.isFinite(last)&&Number.isFinite(current)&&Number.isFinite(limit)&&limit>0&&current-last>=limit;
  }
  function trimExportLog(items,max=MAX_EXPORT_LOG){
    return (Array.isArray(items)?items:[]).filter(item=>item&&item.at&&item.label).slice(0,Math.max(0,Number(max)||0));
  }
  function makeExportRecord(id,label,at=new Date().toISOString()){
    return {id:String(id||''),label:String(label||exportLabelForId(id)||'개인정보 파일'),at:String(at),version:VERSION};
  }

  function init(win,doc){
    if(doc.getElementById('privacyShieldOverlay'))return;
    let locked=false,lastActivity=Date.now(),hiddenAt=0,idleTimer=0,lastReset=0;

    function createUi(){
      const button=doc.createElement('button');
      button.id='btnPrivacyShield';
      button.type='button';
      button.className='topbar-icon-btn privacy-shield-button';
      button.title='화면 잠금 (10분 동안 사용하지 않아도 자동 잠금)';
      button.setAttribute('aria-label','개인정보 화면 잠금');
      button.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>';
      const utilities=doc.querySelector('.topbar-utils');
      if(utilities)utilities.insertBefore(button,utilities.firstChild);

      const overlay=doc.createElement('div');
      overlay.id='privacyShieldOverlay';
      overlay.className='privacy-shield-overlay';
      overlay.hidden=true;
      overlay.setAttribute('role','dialog');
      overlay.setAttribute('aria-modal','true');
      overlay.setAttribute('aria-labelledby','privacyShieldTitle');
      overlay.innerHTML='<div class="privacy-shield-card"><div class="privacy-shield-mark" aria-hidden="true">R</div><p class="eyebrow">RECRUIT ERP · PRIVACY</p><h2 id="privacyShieldTitle">개인정보 화면이 잠겼습니다</h2><p id="privacyShieldReason">지원자와 사원 정보가 보이지 않도록 화면을 가렸습니다.</p><button class="primary" id="btnPrivacyUnlock" type="button">화면 다시 보기</button><small>10분 동안 사용하지 않으면 자동으로 다시 잠깁니다. 데이터와 로그인 상태는 바뀌지 않습니다.</small></div>';
      doc.body.appendChild(overlay);
      button.addEventListener('click',()=>lock('manual'));
      doc.getElementById('btnPrivacyUnlock').addEventListener('click',unlock);
    }
    function schedule(){
      win.clearTimeout(idleTimer);
      const remaining=Math.max(0,IDLE_MS-(Date.now()-lastActivity));
      idleTimer=win.setTimeout(()=>lock('idle'),remaining);
    }
    function lock(reason='manual'){
      if(locked)return;
      locked=true;
      const overlay=doc.getElementById('privacyShieldOverlay');
      const reasonEl=doc.getElementById('privacyShieldReason');
      if(reasonEl)reasonEl.textContent=reason==='idle'?'10분 동안 사용하지 않아 개인정보 화면을 자동으로 가렸습니다.':'지원자와 사원 정보가 보이지 않도록 화면을 가렸습니다.';
      if(overlay){overlay.hidden=false;doc.body.classList.add('privacy-shield-active');}
      win.clearTimeout(idleTimer);
      doc.getElementById('btnPrivacyUnlock')?.focus();
    }
    function unlock(){
      locked=false;
      const overlay=doc.getElementById('privacyShieldOverlay');
      if(overlay)overlay.hidden=true;
      doc.body.classList.remove('privacy-shield-active');
      lastActivity=Date.now();
      schedule();
      doc.getElementById('btnPrivacyShield')?.focus();
    }
    function noteActivity(){
      if(locked)return;
      const now=Date.now();
      if(now-lastReset<1000)return;
      lastReset=now;lastActivity=now;schedule();
    }
    function recordExport(id,label){
      try{
        const current=JSON.parse(win.localStorage.getItem(EXPORT_LOG_KEY)||'[]');
        const next=trimExportLog([makeExportRecord(id,label),...(Array.isArray(current)?current:[])],MAX_EXPORT_LOG);
        win.localStorage.setItem(EXPORT_LOG_KEY,JSON.stringify(next));
      }catch(error){console.warn('개인정보 내보내기 기록을 저장하지 못했습니다.',error);}
    }
    function guardExport(event){
      const target=event.target&&event.target.closest?event.target.closest('button,[role="button"]'):null;
      if(!target)return;
      const label=exportLabelForId(target.id);
      if(!label)return;
      const approved=win.confirm(`${label} 파일에는 개인정보 또는 업무 정보가 포함될 수 있습니다.\n\n공용 PC나 외부 공유 폴더가 아닌 안전한 위치에 저장하시겠습니까?`);
      if(!approved){event.preventDefault();event.stopImmediatePropagation();return;}
      recordExport(target.id,label);
    }

    createUi();
    ['pointerdown','keydown','touchstart','wheel'].forEach(type=>doc.addEventListener(type,noteActivity,{passive:true}));
    doc.addEventListener('visibilitychange',()=>{
      if(doc.hidden){hiddenAt=Date.now();return;}
      if(hiddenAt&&shouldLock(lastActivity,Date.now(),IDLE_MS))lock('idle');
      else noteActivity();
      hiddenAt=0;
    });
    doc.addEventListener('click',guardExport,true);
    schedule();
    api.lock=lock;
    api.unlock=unlock;
    api.isLocked=()=>locked;
  }

  const api={VERSION,IDLE_MS,EXPORT_LOG_KEY,MAX_EXPORT_LOG,exportLabelForId,shouldLock,trimExportLog,makeExportRecord,init};
  return api;
});
