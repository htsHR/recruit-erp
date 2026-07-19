/* Recruit ERP v10.46.0 APPLICANT_PROGRESS_HISTORY_PACK */
(function(){
  const MANAGER_KEY='recruit_erp_applicant_manager_assignments';
  const tracked=[
    ['status','상태'],['interviewDate','면접일'],['interviewTime','면접시간'],['hireDate','입사일'],
    ['failureReason','불합격 사유'],['withdrawalReason','입사포기 사유'],['lastContactDate','마지막 연락일'],['nextContactDate','다음 연락 예정일']
  ];
  let snapshots=new Map();
  let internalSave=false;
  const safe=v=>typeof esc==='function'?esc(v):String(v||'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const now=()=>new Date().toISOString();
  const uid2=()=>typeof uid==='function'?uid():('aph_'+Date.now()+'_'+Math.random().toString(36).slice(2));
  function managerMap(){try{return JSON.parse(localStorage.getItem(MANAGER_KEY)||'{}')||{};}catch{return {};}}
  function currentActor(a){
    const auth=localStorage.getItem('recruit_erp_current_user_name')||localStorage.getItem('recruit_erp_user_name')||'';
    return String(a?.lastChangedBy||auth||'현재 사용자').trim()||'현재 사용자';
  }
  function normalizeHistory(a){a.progressHistory=Array.isArray(a.progressHistory)?a.progressHistory:[];return a.progressHistory;}
  function addHistory(a,type,title,detail,meta={}){
    normalizeHistory(a).unshift({id:uid2(),type,title,detail:detail||'',before:meta.before||'',after:meta.after||'',channel:meta.channel||'',reason:meta.reason||'',changedBy:meta.changedBy||currentActor(a),createdAt:meta.createdAt||now()});
    a.lastChangedBy=meta.changedBy||currentActor(a);a.lastChangedAt=meta.createdAt||now();a.updatedAt=now();
  }
  function takeSnapshots(){ snapshots=new Map((applicants||[]).map(a=>[String(a.id),JSON.parse(JSON.stringify(a))])); }
  function detectChanges(){
    const ms=managerMap();
    (applicants||[]).forEach(a=>{
      const old=snapshots.get(String(a.id));
      normalizeHistory(a);
      if(!old){
        if(!a.progressHistory.length) addHistory(a,'created','지원자 등록','지원자 정보가 새로 등록되었습니다.');
        return;
      }
      tracked.forEach(([key,label])=>{
        const before=String(old[key]||''), after=String(a[key]||'');
        if(before!==after) addHistory(a,key==='status'?'status':'schedule',`${label} 변경`,`${before||'미등록'} → ${after||'미등록'}`,{before,after});
      });
      const oldManager=String((old.__manager||'')||''), newManager=String(ms[a.id]||'');
      if(oldManager!==newManager) addHistory(a,'manager','담당자 변경',`${oldManager||'미지정'} → ${newManager||'미지정'}`,{before:oldManager,after:newManager});
    });
  }
  function seedManagerSnapshots(){const ms=managerMap();(applicants||[]).forEach(a=>{const s=snapshots.get(String(a.id));if(s)s.__manager=ms[a.id]||'';});}
  function refreshSnapshots(){takeSnapshots();seedManagerSnapshots();}
  const baseSave=window.save;
  if(typeof baseSave==='function'){
    window.save=function(){
      if(!internalSave){detectChanges();}
      const result=baseSave.apply(this,arguments);
      refreshSnapshots();
      return result;
    };
  }
  function formatDateTime(v){if(!v)return '-';const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):String(v);}
  function typeLabel(t){return ({status:'상태',manager:'담당자',contact:'연락',schedule:'일정',memo:'메모',reason:'사유',created:'등록'})[t]||'기록';}
  function renderHistoryPanel(a){
    const history=[...normalizeHistory(a)].sort((x,y)=>String(y.createdAt||'').localeCompare(String(x.createdAt||'')));
    const ms=managerMap();
    return `<section class="applicant-history-card">
      <div class="applicant-history-head"><div><p class="eyebrow">APPLICANT PROGRESS HISTORY</p><h4>지원자 진행 이력</h4><span>현재 상태가 아니라 여기까지의 처리 과정을 누적 기록합니다.</span></div><div class="applicant-history-meta"><span>담당자 <strong>${safe(ms[a.id]||'미지정')}</strong></span><span>마지막 변경 <strong>${safe(formatDateTime(a.lastChangedAt||a.updatedAt))}</strong></span></div></div>
      <div class="applicant-history-summary">
        <div><span>마지막 연락일</span><strong>${safe(a.lastContactDate||'-')}</strong></div>
        <div><span>다음 연락 예정일</span><strong>${safe(a.nextContactDate||'-')}</strong></div>
        <div><span>불합격 사유</span><strong>${safe(a.failureReason||'-')}</strong></div>
        <div><span>입사포기 사유</span><strong>${safe(a.withdrawalReason||'-')}</strong></div>
      </div>
      <div class="applicant-history-entry">
        <div class="history-entry-grid">
          <label>기록 유형<select id="aphType"><option value="contact">전화</option><option value="contact_sms">문자</option><option value="contact_interview">면접 안내</option><option value="memo">메모</option><option value="reason">사유</option></select></label>
          <label>처리일<input id="aphDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label>
          <label>다음 연락 예정일<input id="aphNextDate" type="date" value="${safe(a.nextContactDate||'')}"></label>
          <label>변경 담당자<input id="aphActor" value="${safe(currentActor(a))}" placeholder="담당자명"></label>
          <label class="wide">처리 내용<input id="aphNote" placeholder="통화 내용, 안내 결과, 다음 액션을 입력"></label>
          <label>불합격 사유<input id="aphFailure" value="${safe(a.failureReason||'')}" placeholder="해당 시 입력"></label>
          <label>입사포기 사유<input id="aphWithdrawal" value="${safe(a.withdrawalReason||'')}" placeholder="해당 시 입력"></label>
        </div>
        <button type="button" class="primary" onclick="addApplicantProgressEntry('${a.id}')">진행 이력 추가</button>
      </div>
      <div class="applicant-history-timeline">${history.length?history.map(h=>`<article><div class="history-dot ${safe(h.type)}"></div><div class="history-copy"><div><span class="history-type">${safe(typeLabel(h.type))}</span><strong>${safe(h.title||'진행 기록')}</strong><time>${safe(formatDateTime(h.createdAt))}</time></div><p>${safe(h.detail||'-')}</p><small>${safe(h.changedBy||'현재 사용자')}${h.channel?` · ${safe(h.channel)}`:''}</small></div></article>`).join(''):'<div class="empty">아직 등록된 진행 이력이 없습니다.</div>'}</div>
    </section>`;
  }
  window.addApplicantProgressEntry=function(id){
    const a=(applicants||[]).find(x=>String(x.id)===String(id));if(!a)return;
    const type=document.getElementById('aphType')?.value||'memo';
    const date=document.getElementById('aphDate')?.value||new Date().toISOString().slice(0,10);
    const next=document.getElementById('aphNextDate')?.value||'';
    const actor=document.getElementById('aphActor')?.value.trim()||currentActor(a);
    const note=document.getElementById('aphNote')?.value.trim()||'';
    const failure=document.getElementById('aphFailure')?.value.trim()||'';
    const withdrawal=document.getElementById('aphWithdrawal')?.value.trim()||'';
    if(!note&&!failure&&!withdrawal){alert('처리 내용 또는 사유를 입력해주세요.');return;}
    const channel=type==='contact'?'전화':type==='contact_sms'?'문자':type==='contact_interview'?'면접 안내':'';
    const title=channel?`${channel} 기록`:type==='reason'?'사유 기록':'메모 추가';
    addHistory(a,type.startsWith('contact')?'contact':type,title,note||failure||withdrawal,{channel,changedBy:actor,createdAt:`${date}T${new Date().toTimeString().slice(0,8)}`});
    if(type.startsWith('contact')) a.lastContactDate=date;
    if(next)a.nextContactDate=next;
    if(failure)a.failureReason=failure;
    if(withdrawal)a.withdrawalReason=withdrawal;
    internalSave=true;try{baseSave();}finally{internalSave=false;refreshSnapshots();}
    if(typeof viewApplicant==='function')viewApplicant(id);
  };
  const baseView=window.viewApplicant;
  if(typeof baseView==='function'){
    window.viewApplicant=function(id){
      baseView.apply(this,arguments);
      const a=(applicants||[]).find(x=>String(x.id)===String(id));
      const body=document.getElementById('detailBody');
      if(a&&body&&!body.querySelector('.applicant-history-card'))body.insertAdjacentHTML('beforeend',renderHistoryPanel(a));
    };
  }
  window.applicantProgressHistoryAddSystem=function(id,type,title,detail,meta={}){const a=(applicants||[]).find(x=>String(x.id)===String(id));if(!a)return;addHistory(a,type,title,detail,meta);};
  refreshSnapshots();
})();
