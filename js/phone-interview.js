/* Recruit ERP v10.49.0.1 PHONE FOLLOW-UP & CONTACT CONSISTENCY
   - 서류검토 워크벤치와 별도 파일(요청서 §5), 검증된 큐/Undo 알고리즘만 재사용
   - 새 필드 없음: 전화내용=consult, 재연락일=nextContactDate(기존 progressHistory 추적 필드),
     면접거절/지원포기=기존 공식 상태(면접거절/입사철회) 그대로 사용
   - 신규 Supabase 테이블/컬럼/localStorage 키 없음
*/
(function(){
  let piQueueIds=[];
  let piDoneIds=new Set();
  let piIndex=-1;
  let piListState=null;
  let piUndo=null;
  const TIME_OPTIONS=(()=>{ const out=[]; for(let h=8;h<=20;h++){ for(const m of ['00','30']){ if(h===20&&m==='30')continue; out.push(String(h).padStart(2,'0')+':'+m); } } return out; })();
  const REJECT_REASONS=['다른 곳 합격','조건 불일치','일정 불가','연락 두절','기타'];
  const WITHDRAW_REASONS=['타사 입사 확정','개인 사정','근무조건 불일치','연락 두절','기타'];

  function piEl(id){return document.getElementById(id);}

  // ---------- 큐 계산 ----------
  function piComputeListQueue(){
    if(typeof filtered!=='function') return [];
    return filtered().filter(a=>a.status==='서류합격').map(a=>a.id);
  }
  function piComputeHomeQueue(){
    return applicants.filter(a=>a.status==='서류합격').map(a=>a.id);
  }

  // ---------- 진입 버튼 갱신 ----------
  function piRefreshEntryButtons(){
    const n=piComputeListQueue().length;
    const listBtn=piEl('btnStartPhoneInterview');
    if(listBtn){
      listBtn.style.display = n>0 ? '' : 'none';
      listBtn.textContent = n>0 ? `전화 인터뷰 시작 (${n}명)` : '전화 인터뷰 시작';
    }
    const homeBtn=piEl('btnHomeStartPhoneInterview');
    if(homeBtn){
      const homeN=applicants.filter(a=>a.status==='서류합격').length;
      homeBtn.style.display = homeN>0 ? '' : 'none';
      homeBtn.textContent = homeN>0 ? `연락 시작 (${homeN})` : '연락 시작';
    }
  }

  // ---------- 목록 상태 캡처/복원 (워크벤치와 동일 패턴, 독립 구현) ----------
  function piCaptureListState(){
    const wrap=document.querySelector('#applicants .table-wrap');
    piListState={
      windowY: window.scrollY||document.documentElement.scrollTop||0,
      tableLeft: wrap?wrap.scrollLeft:0,
      search: currentSearch, workplace: currentWorkplace, filter: currentFilter,
      sort: currentSort, hide: hideFinished, school: currentSchoolFilterId
    };
  }
  function piRestoreListState(){
    if(!piListState) return;
    const s=piListState; piListState=null;
    currentSearch=s.search; currentWorkplace=s.workplace; currentFilter=s.filter;
    currentSort=s.sort; hideFinished=s.hide; currentSchoolFilterId=s.school;
    const search=piEl('searchInput'); if(search) search.value=s.search;
    const sort=piEl('sortSelect'); if(sort) sort.value=s.sort;
    const hide=piEl('hideFinished'); if(hide) hide.checked=s.hide;
    document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.workplace===s.workplace));
    document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.toggle('active', x.dataset.filter===s.filter));
    if(typeof renderTable==='function') renderTable();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const wrap=document.querySelector('#applicants .table-wrap'); if(wrap) wrap.scrollLeft=s.tableLeft;
      window.scrollTo(0, s.windowY);
    }));
  }

  // ---------- 판정 스냅샷/적용 ----------
  const SNAP_FIELDS=['status','interviewDate','interviewTime','dormUse','consult','lastContactDate','nextContactDate','failureReason','decisionReason','withdrawalReason','updatedAt','lastChangedBy','lastChangedAt'];
  function piSnapshot(a){
    const s={}; SNAP_FIELDS.forEach(k=>{ s[k]=a[k]||''; });
    s.progressHistory=JSON.parse(JSON.stringify(a.progressHistory||[]));
    return s;
  }
  function piRestore(a, snap){
    SNAP_FIELDS.forEach(k=>{ a[k]=snap[k]; });
    a.progressHistory=snap.progressHistory;
  }
  function piApply(a, changes){
    const before=piSnapshot(a);
    Object.assign(a, changes);
    try{ if(!save())throw new Error('로컬 저장 실패'); }
    catch(err){
      piRestore(a, before);
      console.error('전화 인터뷰 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다. 지원자 정보는 처리 전 상태로 유지됩니다.');
      return false;
    }
    piUndo={id:a.id, name:a.name||'지원자', before};
    piDoneIds.add(a.id);
    return true;
  }
  function piUndoLast(){
    if(!piUndo) return;
    const a=applicants.find(x=>String(x.id)===String(piUndo.id));
    if(!a){ piUndo=null; piRenderUndoBanner(); return; }
    piRestore(a, piUndo.before);
    // v10.48.2에서 검증된 원복 방식: 되돌린 상태로 내부 스냅샷을 먼저 맞춘 뒤 save()해
    // "되돌림" 이력이 추가로 쌓이지 않게 한다(진짜 원복, 감사기록 이중 추가 없음).
    if(typeof window.applicantProgressHistoryRefreshSnapshots==='function') window.applicantProgressHistoryRefreshSnapshots();
    save();
    piDoneIds.delete(a.id);
    const idx=piQueueIds.indexOf(a.id);
    if(idx>=0) piIndex=idx;
    piUndo=null;
    piRender();
  }

  // ---------- 큐 이동 (검토 완료 오판정 방지: 순환 탐색, 0명일 때만 완료) ----------
  function piRemainingCount(){ return piQueueIds.filter(id=>!piDoneIds.has(id)).length; }
  function piFindNextIndex(from, dir){
    let i=from+dir;
    while(i>=0 && i<piQueueIds.length){ if(!piDoneIds.has(piQueueIds[i])) return i; i+=dir; }
    return -1;
  }
  function piFindAnyUndone(){ return piQueueIds.findIndex(id=>!piDoneIds.has(id)); }
  function piGoTo(idx){ if(idx<0||idx>=piQueueIds.length) return; piIndex=idx; piRender(); }
  function piGoNext(){
    let i=piFindNextIndex(piIndex,1);
    if(i<0) i=piFindAnyUndone();
    if(i>=0){ piGoTo(i); return; }
    piIndex=piQueueIds.length; piRender();
  }
  function piGoPrev(){
    let i=piFindNextIndex(piIndex,-1);
    if(i<0) i=piFindAnyUndone();
    if(i>=0) piGoTo(i);
  }

  // ---------- 렌더 ----------
  function piCurrentApplicant(){
    if(piIndex<0||piIndex>=piQueueIds.length) return null;
    return applicants.find(a=>String(a.id)===String(piQueueIds[piIndex]))||null;
  }
  function piTimeOptionsHtml(sel){
    return '<option value="">선택</option>'+TIME_OPTIONS.map(t=>`<option ${t===sel?'selected':''}>${t}</option>`).join('');
  }
  function piQueueListHtml(){
    return piQueueIds.map((id,i)=>{
      const a=applicants.find(x=>String(x.id)===String(id));
      if(!a) return '';
      const done=piDoneIds.has(id); const cur=i===piIndex;
      return `<button type="button" class="wb-queue-item${cur?' is-current':''}${done?' is-done':''}" data-pi-goto="${i}" ${done?'disabled':''}>
        <span class="wb-queue-name">${esc(a.name||'이름없음')}</span>
        <span class="wb-queue-meta">${esc(a.workplace||'-')} · ${esc(a.applyDate||'-')}</span>
        ${done?'<span class="wb-queue-tag">처리됨</span>':''}
      </button>`;
    }).join('');
  }
  function piRender(){
    const body=piEl('phoneInterviewBody');
    if(!body) return;
    const total=piQueueIds.length, decided=piDoneIds.size;
    const a=piCurrentApplicant();
    const pct= total? Math.round(decided/total*100) : 0;

    if(!a){
      body.innerHTML=`
        <div class="modal-head wb-head"><div><p class="eyebrow">PHONE INTERVIEW</p><h3>전화 인터뷰</h3></div><button class="ghost" id="btnPiClose" type="button">닫기</button></div>
        <div id="piUndoBanner"></div>
        <div class="wb-empty"><strong>전화 인터뷰 완료</strong><p>대상으로 지정된 서류합격 지원자를 모두 처리했습니다.</p></div>`;
      piEl('btnPiClose')?.addEventListener('click', piClose);
      piRenderUndoBanner();
      return;
    }

    const dorm=typeof dormLabel==='function'?dormLabel(a):'';
    const basicRows=[
      detailRow('성명', a.name), detailRow('연락처', typeof formatPhoneDisplay==='function'?formatPhoneDisplay(a.phone):a.phone),
      detailRow('지원근무지', a.workplace), detailRow('거주지역', a.region),
      detailRow('학교', a.school), detailRow('학과', a.major),
      detailRow('지원일', a.applyDate), detailRow('현재 상태', a.status),
    ].join('');

    body.innerHTML=`
      <div class="modal-head wb-head">
        <div><p class="eyebrow">PHONE INTERVIEW</p><h3>전화 인터뷰 · ${piIndex+1} / ${total}</h3></div>
        <button class="ghost" id="btnPiClose" type="button">닫기</button>
      </div>
      <div class="wb-progress-track"><div class="wb-progress-bar" style="width:${pct}%"></div></div>
      <div id="piUndoBanner"></div>
      <div class="wb-layout">
        <aside class="wb-queue-panel"><div class="wb-queue-head">대상 ${total}명 · 남음 ${piRemainingCount()}명</div><div class="wb-queue-list">${piQueueListHtml()}</div></aside>
        <section class="wb-main-panel">
          <div class="wb-candidate-head">
            <div><strong>${esc(a.name||'이름없음')}</strong><span class="badge ${badgeClass(a.status)}">${esc(a.status)}</span></div>
            <div class="wb-nav-btns"><button class="mini" id="btnPiPrev" type="button">‹ 이전</button><button class="mini" id="btnPiNext" type="button">다음 ›</button></div>
          </div>
          <div class="wb-section-grid"><div><h5>기본정보</h5>${basicRows}</div></div>

          <div class="pi-form-grid">
            <label>면접일<input id="piInterviewDate" type="date" value="${esc(a.interviewDate||'')}"/></label>
            <label>면접시간<select id="piInterviewTime">${piTimeOptionsHtml(a.interviewTime||'')}</select></label>
            <label>출근방법<select id="piDormUse">
              <option value="" ${!a.dormUse?'selected':''}>선택</option>
              <option ${a.dormUse==='기숙사'?'selected':''}>기숙사</option>
              <option ${a.dormUse==='출퇴근'?'selected':''}>출퇴근</option>
              <option ${a.dormUse==='확인필요'?'selected':''}>확인필요</option>
            </select></label>
            <label class="wide">전화 인터뷰 내용<textarea id="piConsult" rows="3" placeholder="출근방법, 면접 가능일, 통화 내용, 특이사항">${esc(a.consult||'')}</textarea></label>
          </div>

          <div class="wb-decision-bar">
            <div class="wb-decision-btns">
              <button class="primary wb-btn-pass" id="btnPiConfirm" type="button">참석 확정</button>
              <button class="ghost" id="btnPiMissed" type="button">부재중</button>
              <button class="ghost wb-btn-fail" id="btnPiReject" type="button">면접거절</button>
              <button class="ghost wb-btn-fail" id="btnPiWithdraw" type="button">지원포기</button>
            </div>
            <div id="piSubPanel"></div>
          </div>
        </section>
      </div>`;

    piEl('btnPiClose')?.addEventListener('click', piClose);
    piEl('btnPiPrev')?.addEventListener('click', piGoPrev);
    piEl('btnPiNext')?.addEventListener('click', piGoNext);
    document.querySelectorAll('[data-pi-goto]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ const i=Number(btn.dataset.piGoto); if(!Number.isNaN(i)) piGoTo(i); });
    });

    piEl('btnPiConfirm')?.addEventListener('click', ()=>{
      const iDate=piEl('piInterviewDate')?.value||'';
      if(!iDate){ alert('면접일이 입력되지 않았습니다.\n면접 일정을 입력한 후 참석 확정해주세요.'); return; }
      const changes={
        status:'면접예정',
        interviewDate:iDate,
        interviewTime:piEl('piInterviewTime')?.value||'',
        dormUse:piEl('piDormUse')?.value||'',
        consult:piEl('piConsult')?.value||'',
        lastContactDate:today(),
        nextContactDate:'',
        decisionReason:'전화 인터뷰 참석 확정'
      };
      if(piApply(a, changes)){ piGoNext(); piRenderUndoBanner(); }
    });
    piEl('btnPiMissed')?.addEventListener('click', ()=>{
      piEl('piSubPanel').innerHTML=`<div class="pi-sub-row"><label>다음 연락 예정일(선택)<input id="piNextContact" type="date"/></label><button class="primary" id="btnPiMissedConfirm" type="button">부재중 처리</button></div>`;
      piEl('btnPiMissedConfirm')?.addEventListener('click', ()=>{
        const next=piEl('piNextContact')?.value||'';
        const changes={
          status:'부재중',
          consult:piEl('piConsult')?.value||a.consult||'',
          lastContactDate:today(),
          nextContactDate:next
        };
        if(piApply(a, changes)){ piGoNext(); piRenderUndoBanner(); }
      });
    });
    piEl('btnPiReject')?.addEventListener('click', ()=>{
      piEl('piSubPanel').innerHTML=`<div class="pi-sub-row"><label>면접거절 사유<select id="piRejectReason">${REJECT_REASONS.map(r=>`<option>${esc(r)}</option>`).join('')}</select></label><button class="ghost wb-btn-fail" id="btnPiRejectConfirm" type="button">면접거절 확정</button></div>`;
      piEl('btnPiRejectConfirm')?.addEventListener('click', ()=>{
        const reason=piEl('piRejectReason')?.value||REJECT_REASONS[0];
        if(piApply(a, {status:'면접거절', failureReason:reason, consult:piEl('piConsult')?.value||a.consult||'', lastContactDate:today(), nextContactDate:''})){ piGoNext(); piRenderUndoBanner(); }
      });
    });
    piEl('btnPiWithdraw')?.addEventListener('click', ()=>{
      piEl('piSubPanel').innerHTML=`<div class="pi-sub-row"><label>지원포기 사유<select id="piWithdrawReason">${WITHDRAW_REASONS.map(r=>`<option>${esc(r)}</option>`).join('')}</select></label><button class="ghost wb-btn-fail" id="btnPiWithdrawConfirm" type="button">지원포기 확정</button></div>`;
      piEl('btnPiWithdrawConfirm')?.addEventListener('click', ()=>{
        const reason=piEl('piWithdrawReason')?.value||WITHDRAW_REASONS[0];
        // v10.49.0: '지원포기'는 공식 상태가 아니며, 기존 core.js 별칭표가 이미 '입사포기'를
        // '입사철회'로 매핑해 사용 중이므로(§12 기존 상태 재사용) 동일하게 입사철회를 사용한다.
        if(piApply(a, {status:'입사철회', withdrawalReason:reason, consult:piEl('piConsult')?.value||a.consult||'', lastContactDate:today(), nextContactDate:''})){ piGoNext(); piRenderUndoBanner(); }
      });
    });
    piRenderUndoBanner();
  }
  function piRenderUndoBanner(){
    const el=piEl('piUndoBanner');
    if(!el) return;
    if(!piUndo){ el.innerHTML=''; return; }
    el.innerHTML=`<div class="wb-undo-banner">${esc(piUndo.name)}님을 처리했습니다. <button class="mini" id="btnPiUndo" type="button">방금 처리 취소</button></div>`;
    piEl('btnPiUndo')?.addEventListener('click', piUndoLast);
  }

  // ---------- 열기/닫기 ----------
  function piOpen(source, singleId){
    if(singleId){ piQueueIds=[singleId]; }
    else piQueueIds = source==='home' ? piComputeHomeQueue() : piComputeListQueue();
    piDoneIds=new Set(); piUndo=null; piIndex=0;
    piCaptureListState();
    const modal=piEl('phoneInterviewModal');
    if(!modal) return;
    modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    piRender();
    document.addEventListener('keydown', piKeyHandler, true);
  }
  function piClose(){
    const modal=piEl('phoneInterviewModal');
    if(modal){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }
    document.body.style.overflow='';
    document.removeEventListener('keydown', piKeyHandler, true);
    piRestoreListState();
    piRefreshEntryButtons();
    if(typeof renderHomeLists==='function') renderHomeLists();
  }


  window.openPhoneInterviewForApplicant=function(id){ piOpen('list', id); };
  window.openPhoneInterviewQueue=function(source){ piOpen(source==='home'?'home':'list'); };

  // ---------- 단축키(보조, 입력 중 절대 무동작) ----------
  function piKeyHandler(e){
    if(e.isComposing) return;
    const tag=(e.target && e.target.tagName || '').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select'||(e.target && e.target.isContentEditable)) return;
    if(!e.altKey) return;
    if(e.key==='1'){ e.preventDefault(); piEl('btnPiConfirm')?.click(); }
    else if(e.key==='z'||e.key==='Z'){ e.preventDefault(); piUndoLast(); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); piGoNext(); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); piGoPrev(); }
  }

  // ---------- 진입 지점 ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    piEl('btnStartPhoneInterview')?.addEventListener('click', ()=>piOpen('list'));
    piEl('btnHomeStartPhoneInterview')?.addEventListener('click', ()=>piOpen('home'));
    piEl('phoneInterviewBackdrop')?.addEventListener('click', piClose);
    piRefreshEntryButtons();
  });

  // 상세 모달에 '전화 인터뷰' 버튼: 최초 연락(서류합격)과 재연락(부재중)에서 모두 진입 가능
  const baseView=window.viewApplicant;
  if(typeof baseView==='function'){
    window.viewApplicant=function(id){
      const result=baseView.apply(this, arguments);
      const btn=piEl('btnDetailPhoneInterview');
      if(btn){
        const a=applicants.find(x=>String(x.id)===String(id));
        btn.style.display = (a && ['서류합격','부재중'].includes(normalizeStatus(a.status))) ? '' : 'none';
        btn.onclick=()=>{ if(typeof closeDetail==='function') closeDetail(); piOpen('list', id); };
      }
      return result;
    };
  }

  const baseUpdateCounts=window.updateApplicantListFilterCounts;
  if(typeof baseUpdateCounts==='function'){
    window.updateApplicantListFilterCounts=function(){ const r=baseUpdateCounts.apply(this,arguments); piRefreshEntryButtons(); return r; };
  }
  const baseHomeLists=window.renderHomeLists;
  if(typeof baseHomeLists==='function'){
    window.renderHomeLists=function(){ const r=baseHomeLists.apply(this,arguments); piRefreshEntryButtons(); return r; };
  }
})();
