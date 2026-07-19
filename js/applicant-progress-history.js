/* Recruit ERP v10.46.3 APPLICANT_DETAIL_WORKFLOW */
(function(){
  const MANAGER_KEY='recruit_erp_applicant_manager_assignments';
  const tracked=[
    ['status','상태'],['interviewDate','면접일'],['interviewTime','면접시간'],['hireDate','입사일'],
    ['failureReason','불합격 사유'],['withdrawalReason','입사포기 사유'],['lastContactDate','마지막 연락일'],['nextContactDate','다음 연락 예정일']
  ];
  let snapshots=new Map();
  let internalSave=false;
  let listReturnState=null;
  const safe=v=>typeof esc==='function'?esc(v):String(v||'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const now=()=>new Date().toISOString();
  const uid2=()=>typeof uid==='function'?uid():('aph_'+Date.now()+'_'+Math.random().toString(36).slice(2));
  const activePage=()=>document.querySelector('.page.active')?.id||'';
  function managerMap(){try{return JSON.parse(localStorage.getItem(MANAGER_KEY)||'{}')||{};}catch{return {};}}
  function currentActor(a){
    const auth=localStorage.getItem('recruit_erp_current_user_name')||localStorage.getItem('recruit_erp_user_name')||'';
    return String(auth||a?.lastChangedBy||'현재 사용자').trim()||'현재 사용자';
  }
  function normalizeHistory(a){a.progressHistory=Array.isArray(a.progressHistory)?a.progressHistory:[];return a.progressHistory;}
  function addHistory(a,type,title,detail,meta={}){
    normalizeHistory(a).unshift({
      id:uid2(),type,title,detail:detail||'',before:meta.before||'',after:meta.after||'',channel:meta.channel||'',reason:meta.reason||'',
      changedBy:meta.changedBy||currentActor(a),createdAt:meta.createdAt||now()
    });
    a.lastChangedBy=meta.changedBy||currentActor(a);
    a.lastChangedAt=meta.createdAt||now();
    a.updatedAt=now();
  }
  function takeSnapshots(){snapshots=new Map((applicants||[]).map(a=>[String(a.id),JSON.parse(JSON.stringify(a))]));}
  function reasonForStatus(a,status){
    if(['서류탈락','불합격'].includes(status))return a.failureReason||a.decisionReason||'';
    if(['입사포기','포기'].includes(status))return a.withdrawalReason||a.decisionReason||'';
    if(['면접완료','입사예정','출근'].includes(status))return a.decisionReason||'';
    return '';
  }
  function typeForField(key){
    if(key==='status')return 'status';
    if(['failureReason','withdrawalReason'].includes(key))return 'reason';
    if(['lastContactDate','nextContactDate'].includes(key))return 'contact';
    return 'schedule';
  }
  function detectChanges(){
    const ms=managerMap();
    (applicants||[]).forEach(a=>{
      const old=snapshots.get(String(a.id));
      normalizeHistory(a);
      if(!old){
        if(!a.progressHistory.length)addHistory(a,'created','지원자 등록','지원자 정보가 새로 등록되었습니다.');
        return;
      }
      tracked.forEach(([key,label])=>{
        const before=String(old[key]||''),after=String(a[key]||'');
        if(before===after)return;
        const type=typeForField(key);
        const reason=key==='status'?reasonForStatus(a,after):(type==='reason'?after:'');
        addHistory(a,type,`${label} 변경`,`${before||'미등록'} → ${after||'미등록'}`,{before,after,reason});
      });
      const oldManager=String(old.__manager||''),newManager=String(ms[a.id]||'');
      if(oldManager!==newManager)addHistory(a,'manager','담당자 변경',`${oldManager||'미지정'} → ${newManager||'미지정'}`,{before:oldManager,after:newManager});
    });
  }
  function seedManagerSnapshots(){const ms=managerMap();(applicants||[]).forEach(a=>{const s=snapshots.get(String(a.id));if(s)s.__manager=ms[a.id]||'';});}
  function refreshSnapshots(){takeSnapshots();seedManagerSnapshots();}
  const baseSave=window.save;
  if(typeof baseSave==='function'){
    window.save=function(){
      if(!internalSave)detectChanges();
      const result=baseSave.apply(this,arguments);
      refreshSnapshots();
      return result;
    };
  }
  function formatDateTime(v){
    if(!v)return '-';
    const d=new Date(v);
    return Number.isFinite(d.getTime())?d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):String(v);
  }
  function typeLabel(t){return ({status:'상태·사유',manager:'담당자',contact:'연락',schedule:'일정',memo:'메모',reason:'사유',created:'등록'})[t]||'기록';}
  function isOverdue(date){return !!date&&date<new Date().toISOString().slice(0,10);}
  function historyItem(h){
    const change=(h.before||h.after)?`<div class="history-change-pair"><span>${safe(h.before||'미등록')}</span><b>→</b><span>${safe(h.after||'미등록')}</span></div>`:'';
    const reason=h.reason?`<div class="history-reason-line"><strong>변경 사유</strong><span>${safe(h.reason)}</span></div>`:'';
    return `<article class="applicant-history-item history-${safe(h.type||'memo')}">
      <div class="history-dot ${safe(h.type||'memo')}"></div>
      <div class="history-copy">
        <div class="history-copy-head"><span class="history-type">${safe(typeLabel(h.type))}</span><strong>${safe(h.title||'진행 기록')}</strong><time>${safe(formatDateTime(h.createdAt))}</time></div>
        ${change||`<p>${safe(h.detail||'-')}</p>`}
        ${change&&h.detail&&!String(h.detail).includes('→')?`<p>${safe(h.detail)}</p>`:''}
        ${reason}
        <small>${safe(h.changedBy||'현재 사용자')}${h.channel?` · ${safe(h.channel)}`:''}</small>
      </div>
    </article>`;
  }
  function renderHistoryPanel(a){
    const history=[...normalizeHistory(a)].sort((x,y)=>String(y.createdAt||'').localeCompare(String(x.createdAt||'')));
    const manager=managerMap()[a.id]||'미지정';
    const nextClass=isOverdue(a.nextContactDate)?'is-overdue':(a.nextContactDate?'is-scheduled':'is-empty');
    const reasonCards=[
      a.failureReason?`<div><span>불합격 사유</span><strong>${safe(a.failureReason)}</strong></div>`:'',
      a.withdrawalReason?`<div><span>입사포기 사유</span><strong>${safe(a.withdrawalReason)}</strong></div>`:''
    ].filter(Boolean).join('');
    return `<section class="applicant-history-card applicant-history-v10463">
      <div class="applicant-history-head">
        <div><p class="eyebrow">PROGRESS HISTORY</p><h4>진행 이력</h4><span>전화·문자·메모와 주요 변경사항을 최신순으로 확인합니다.</span></div>
        <div class="applicant-history-meta"><span>담당자 <strong>${safe(manager)}</strong></span><span>마지막 변경 <strong>${safe(formatDateTime(a.lastChangedAt||a.updatedAt))}</strong></span></div>
      </div>
      <div class="applicant-contact-focus">
        <div class="contact-focus-card ${a.lastContactDate?'is-done':'is-empty'}"><span>마지막 연락일</span><strong>${safe(a.lastContactDate||'기록 없음')}</strong><small>${a.lastContactDate?'최근 연락 기준':'연락 기록을 추가해 주세요'}</small></div>
        <div class="contact-focus-card ${nextClass}"><span>다음 연락 예정일</span><strong>${safe(a.nextContactDate||'미정')}</strong><small>${isOverdue(a.nextContactDate)?'연락 예정일이 지났습니다':(a.nextContactDate?'예정일 기준으로 오늘 할 일에 표시':'필요하면 기록 시 함께 지정')}</small></div>
        <div class="applicant-quick-log-actions">
          <span>빠른 기록</span>
          <div><button type="button" class="quick-log phone" onclick="openApplicantQuickLog('${a.id}','phone')">전화 기록</button><button type="button" class="quick-log sms" onclick="openApplicantQuickLog('${a.id}','sms')">문자 기록</button><button type="button" class="quick-log memo" onclick="openApplicantQuickLog('${a.id}','memo')">메모 추가</button></div>
        </div>
      </div>
      <div class="applicant-quick-log-composer" id="aphQuickComposer" hidden>
        <div class="quick-log-composer-head"><div><strong id="aphQuickTitle">진행 기록 추가</strong><span id="aphQuickHelp">처리 결과와 다음 액션을 간단히 남겨주세요.</span></div><button type="button" class="mini" onclick="closeApplicantQuickLog()">닫기</button></div>
        <input id="aphType" type="hidden" value="memo">
        <div class="quick-log-grid">
          <label>처리일<input id="aphDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
          <label>다음 연락 예정일<input id="aphNextDate" type="date" value="${safe(a.nextContactDate||'')}"></label>
          <label>변경 담당자<input id="aphActor" value="${safe(currentActor(a))}" placeholder="담당자명"></label>
          <label class="wide">처리 내용<textarea id="aphNote" rows="3" placeholder="처리 결과와 다음 액션을 입력"></textarea></label>
        </div>
        <div class="quick-log-footer"><button type="button" class="primary" onclick="saveApplicantQuickLog('${a.id}')">기록 저장</button></div>
      </div>
      ${reasonCards?`<div class="applicant-reason-summary">${reasonCards}</div>`:''}
      <div class="applicant-history-timeline">${history.length?history.map(historyItem).join(''):'<div class="empty">아직 등록된 진행 이력이 없습니다.</div>'}</div>
    </section>`;
  }
  const quickConfig={
    phone:{title:'전화 기록',help:'통화 결과와 다음 처리 내용을 남깁니다.',placeholder:'통화 여부, 안내 내용, 답변과 다음 액션을 입력'},
    sms:{title:'문자 기록',help:'발송한 문자와 회신 여부를 남깁니다.',placeholder:'발송 내용 요약, 회신 여부와 다음 액션을 입력'},
    memo:{title:'메모 추가',help:'지원자 진행과 관련된 내부 메모를 남깁니다.',placeholder:'확인 내용과 다음 액션을 입력'}
  };
  window.openApplicantQuickLog=function(id,type){
    const a=(applicants||[]).find(x=>String(x.id)===String(id));if(!a)return;
    const composer=document.getElementById('aphQuickComposer');if(!composer)return;
    const cfg=quickConfig[type]||quickConfig.memo;
    document.getElementById('aphType').value=type;
    document.getElementById('aphQuickTitle').textContent=cfg.title;
    document.getElementById('aphQuickHelp').textContent=cfg.help;
    const note=document.getElementById('aphNote');note.placeholder=cfg.placeholder;note.value='';
    composer.hidden=false;
    composer.scrollIntoView({behavior:'smooth',block:'nearest'});
    setTimeout(()=>note.focus(),120);
  };
  window.closeApplicantQuickLog=function(){const composer=document.getElementById('aphQuickComposer');if(composer)composer.hidden=true;};
  window.saveApplicantQuickLog=function(id){
    const a=(applicants||[]).find(x=>String(x.id)===String(id));if(!a)return;
    const type=document.getElementById('aphType')?.value||'memo';
    const date=document.getElementById('aphDate')?.value||new Date().toISOString().slice(0,10);
    const next=document.getElementById('aphNextDate')?.value||'';
    const actor=document.getElementById('aphActor')?.value.trim()||currentActor(a);
    const note=document.getElementById('aphNote')?.value.trim()||'';
    if(!note){alert('처리 내용을 입력해주세요.');document.getElementById('aphNote')?.focus();return;}
    const channel=type==='phone'?'전화':type==='sms'?'문자':'';
    const title=channel?`${channel} 기록`:'메모 추가';
    addHistory(a,channel?'contact':'memo',title,note,{channel,changedBy:actor,createdAt:`${date}T${new Date().toTimeString().slice(0,8)}`});
    if(channel)a.lastContactDate=date;
    a.nextContactDate=next;
    internalSave=true;try{baseSave();}finally{internalSave=false;refreshSnapshots();}
    if(typeof viewApplicant==='function')viewApplicant(id);
  };
  window.addApplicantProgressEntry=function(id){window.saveApplicantQuickLog(id);};

  function captureListReturnState(){
    const wrap=document.querySelector('#applicants .table-wrap');
    listReturnState={
      sourcePage:'applicants',windowY:window.scrollY||document.documentElement.scrollTop||0,tableLeft:wrap?.scrollLeft||0,
      search:typeof currentSearch!=='undefined'?currentSearch:'',workplace:typeof currentWorkplace!=='undefined'?currentWorkplace:'all',
      filter:typeof currentFilter!=='undefined'?currentFilter:'all',sort:typeof currentSort!=='undefined'?currentSort:'recent',
      hide:typeof hideFinished!=='undefined'?hideFinished:false,school:typeof currentSchoolFilterId!=='undefined'?currentSchoolFilterId:''
    };
  }
  window.erpRestoreApplicantListAfterSave=function(savedId){
    if(!listReturnState)return;
    const state=listReturnState;listReturnState=null;
    try{
      currentSearch=state.search;currentWorkplace=state.workplace;currentFilter=state.filter;currentSort=state.sort;hideFinished=state.hide;currentSchoolFilterId=state.school;
      const search=document.getElementById('searchInput');if(search)search.value=state.search;
      const sort=document.getElementById('sortSelect');if(sort)sort.value=state.sort;
      const hide=document.getElementById('hideFinished');if(hide)hide.checked=state.hide;
      document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.toggle('active',x.dataset.workplace===state.workplace));
      document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.toggle('active',x.dataset.filter===state.filter));
      if(typeof renderTable==='function')renderTable();
    }catch(e){console.warn('지원자 목록 상태 복원 중 일부 항목을 복원하지 못했습니다.',e);}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const wrap=document.querySelector('#applicants .table-wrap');if(wrap)wrap.scrollLeft=state.tableLeft;
      window.scrollTo(0,state.windowY);
      const row=document.querySelector(`[data-applicant-id="${CSS.escape(String(savedId||''))}"]`);
      if(row){row.classList.add('recently-updated-row');setTimeout(()=>row.classList.remove('recently-updated-row'),1800);}
    }));
  };

  const baseEdit=window.editApplicant;
  if(typeof baseEdit==='function'){
    window.editApplicant=function(id){
      const source=activePage()==='applicants'?'applicants':(window.__erpApplicantDetailEditPending?window.__erpApplicantDetailSourcePage:'');
      if(source==='applicants')captureListReturnState();
      const result=baseEdit.apply(this,arguments);
      if(window.__erpApplicantDetailEditPending)window.__erpApplicantDetailSourcePage='';
      return result;
    };
  }
  const baseView=window.viewApplicant;
  if(typeof baseView==='function'){
    window.viewApplicant=function(id){
      if(!document.getElementById('detailModal')?.classList.contains('show'))window.__erpApplicantDetailSourcePage=activePage();
      baseView.apply(this,arguments);
      const a=(applicants||[]).find(x=>String(x.id)===String(id));
      const body=document.getElementById('detailBody');
      if(!a||!body)return;
      body.querySelector('.detail-progress-strip')?.remove();
      if(!body.querySelector('.applicant-history-card')){
        const summary=body.querySelector('.applicant-detail-summary-section');
        if(summary)summary.insertAdjacentHTML('afterend',renderHistoryPanel(a));
        else body.insertAdjacentHTML('afterbegin',renderHistoryPanel(a));
      }
    };
  }
  window.applicantProgressHistoryAddSystem=function(id,type,title,detail,meta={}){const a=(applicants||[]).find(x=>String(x.id)===String(id));if(!a)return;addHistory(a,type,title,detail,meta);};
  refreshSnapshots();
})();
