/* Recruit ERP v10.48.2 SCREENING WORKBENCH
   - 새 메뉴/새 페이지 없이 지원자 목록·홈에서 진입하는 모달형 연속 검토 도구
   - 기존 applicants 배열·save()·progressHistory·failureReason 체계만 사용
   - 신규 Supabase 테이블/컬럼/localStorage 키 없음
*/
(function(){
  let wbQueueIds=[];      // 워크벤치 시작 시점의 서류검토 대상 ID (고정 순서, 인덱스 흔들림 방지)
  let wbDoneIds=new Set();// 이번 세션에서 합격/탈락/이번 검토 넘기기 처리된 ID (큐에서 제외되지만 배열 자체는 불변)
  let wbIndex=-1;
  let wbListState=null;   // 진입 전 목록 검색/필터/정렬/스크롤 상태(자체 스냅샷, 종료 시 복원)
  let wbUndo=null;        // 직전 1건 취소용 스냅샷
  const FAIL_REASONS=['경력 부적합','전공·자격 부적합','근무조건 불일치','경력 내용 검토','잦은 이직','기타'];

  function wbEl(id){return document.getElementById(id);}

  // ---------- 대상 큐 계산 ----------
  // v10.48.2.1: 목록 진입은 근무지/검색/학교만 복제하던 것을 그만두고, 실제 filtered()를
  // 그대로 호출해 빠른필터·고급검색·정렬·종료숨김까지 화면에 보이는 것과 100% 일치시킨다.
  // (filtered()는 applicants.js의 전역 함수이며 module-level 상태만 참조, 부수효과 없음)
  function wbComputeListQueue(){
    if(typeof filtered!=='function') return [];
    return filtered().filter(a=>a.status==='서류검토').map(a=>a.id);
  }
  // 홈 진입은 목록 필터 상태와 무관하게 전체 서류검토자를 대상으로 한다.
  function wbComputeHomeQueue(){
    return applicants.filter(a=>a.status==='서류검토').map(a=>a.id);
  }

  // ---------- 진입 버튼 표시/개수 갱신 ----------
  function wbRefreshEntryButtons(){
    const n = wbComputeListQueue().length;
    const listBtn=wbEl('btnStartScreeningWorkbench');
    if(listBtn){
      listBtn.style.display = n>0 ? '' : 'none';
      listBtn.textContent = n>0 ? `연속 검토 (${n}명)` : '연속 검토';
    }
    const homeBtn=wbEl('btnHomeStartScreening');
    if(homeBtn){
      const homeN = applicants.filter(a=>a.status==='서류검토').length;
      homeBtn.style.display = homeN>0 ? '' : 'none';
      homeBtn.textContent = homeN>0 ? `서류검토 시작 (${homeN})` : '서류검토 시작';
    }
  }

  // ---------- 목록 상태 캡처/복원 (자체 구현, applicant-progress-history.js의 것과 별개) ----------
  function wbCaptureListState(){
    const wrap=document.querySelector('#applicants .table-wrap');
    wbListState={
      windowY: window.scrollY||document.documentElement.scrollTop||0,
      tableLeft: wrap?wrap.scrollLeft:0,
      search: currentSearch, workplace: currentWorkplace, filter: currentFilter,
      sort: currentSort, hide: hideFinished, school: currentSchoolFilterId
    };
  }
  function wbRestoreListState(){
    if(!wbListState) return;
    const s=wbListState; wbListState=null;
    currentSearch=s.search; currentWorkplace=s.workplace; currentFilter=s.filter;
    currentSort=s.sort; hideFinished=s.hide; currentSchoolFilterId=s.school;
    const search=wbEl('searchInput'); if(search) search.value=s.search;
    const sort=wbEl('sortSelect'); if(sort) sort.value=s.sort;
    const hide=wbEl('hideFinished'); if(hide) hide.checked=s.hide;
    document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.workplace===s.workplace));
    document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.toggle('active', x.dataset.filter===s.filter));
    if(typeof renderTable==='function') renderTable();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const wrap=document.querySelector('#applicants .table-wrap'); if(wrap) wrap.scrollLeft=s.tableLeft;
      window.scrollTo(0, s.windowY);
    }));
  }

  // ---------- 판정 적용 + 되돌리기 스냅샷 ----------
  function wbApplyDecision(a, changes){
    const before={
      status:a.status, failureReason:a.failureReason||'', decisionReason:a.decisionReason||'',
      updatedAt:a.updatedAt||'', lastChangedBy:a.lastChangedBy||'', lastChangedAt:a.lastChangedAt||'',
      progressHistory: JSON.parse(JSON.stringify(a.progressHistory||[]))
    };
    Object.assign(a, changes);
    try{
      save(); // applicant-progress-history.js가 감싼 save(): status/failureReason 변경을 자동으로 progressHistory에 기록
    }catch(err){
      // v10.48.2 §11: 저장 실패 시 변경분을 롤백하고, 다음 지원자로 넘어가지 않는다.
      Object.assign(a, before);
      console.error('워크벤치 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다. 지원자 정보는 처리 전 상태로 유지됩니다.');
      return false;
    }
    wbUndo={kind:'decision', id:a.id, name:a.name||'지원자', before};
    wbDoneIds.add(a.id);
    return true;
  }
  function wbApplyHold(a, reason){
    // '보류'는 공식 상태값이 아니라 면접 후 판정용 finalDecision 값이라(§8) status는 바꾸지 않는다.
    // 이미 노출된 시스템 이력 훅으로 "이번 검토 넘기기" 기록만 남기고 이번 세션 큐에서만 제외한다.
    // v10.48.2.2: addHistory()가 progressHistory 외에 updatedAt/lastChangedBy/lastChangedAt도 함께
    // 갱신하므로, 이 세 값도 판정 전 상태로 스냅샷해 undo·저장실패 롤백 시 함께 복원한다.
    const before={
      progressHistory: JSON.parse(JSON.stringify(a.progressHistory||[])),
      updatedAt:a.updatedAt||'', lastChangedBy:a.lastChangedBy||'', lastChangedAt:a.lastChangedAt||''
    };
    if(typeof window.applicantProgressHistoryAddSystem==='function'){
      window.applicantProgressHistoryAddSystem(a.id,'memo','서류검토 · 이번 검토 넘기기', reason||'사유 미입력', {});
    }
    try{
      save();
    }catch(err){
      a.progressHistory=before.progressHistory;
      a.updatedAt=before.updatedAt; a.lastChangedBy=before.lastChangedBy; a.lastChangedAt=before.lastChangedAt;
      console.error('워크벤치 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다. 지원자 정보는 처리 전 상태로 유지됩니다.');
      return false;
    }
    wbUndo={kind:'hold', id:a.id, name:a.name||'지원자', before};
    wbDoneIds.add(a.id);
    return true;
  }
  function wbUndoLast(){
    if(!wbUndo) return;
    const a=applicants.find(x=>String(x.id)===String(wbUndo.id));
    if(!a){ wbUndo=null; wbRenderUndoBanner(); return; }
    if(wbUndo.kind==='decision'){
      a.status=wbUndo.before.status; a.failureReason=wbUndo.before.failureReason;
      a.decisionReason=wbUndo.before.decisionReason; a.updatedAt=wbUndo.before.updatedAt;
      a.lastChangedBy=wbUndo.before.lastChangedBy; a.lastChangedAt=wbUndo.before.lastChangedAt;
      a.progressHistory=wbUndo.before.progressHistory;
    }else if(wbUndo.kind==='hold'){
      a.progressHistory=wbUndo.before.progressHistory;
      a.updatedAt=wbUndo.before.updatedAt; a.lastChangedBy=wbUndo.before.lastChangedBy; a.lastChangedAt=wbUndo.before.lastChangedAt;
    }
    // v10.48.2.1: 되돌린 상태를 먼저 "현재 스냅샷"으로 갱신한 뒤 save()를 호출하면,
    // save가 감싼 자동 이력 감지가 되돌리기 자체를 새 변경으로 오인해 이력을 하나 더 남기지 않는다.
    // (판정으로 생성된 이력을 진짜로 원복 — 판정과 되돌림이 이중으로 남지 않음)
    if(typeof window.applicantProgressHistoryRefreshSnapshots==='function') window.applicantProgressHistoryRefreshSnapshots();
    save();
    wbDoneIds.delete(a.id);
    const idx=wbQueueIds.indexOf(a.id);
    if(idx>=0) wbIndex=idx;
    wbUndo=null;
    wbRender();
  }

  // ---------- 큐 이동 ----------
  function wbRemainingCount(){ return wbQueueIds.filter(id=>!wbDoneIds.has(id)).length; }
  function wbFindNextIndex(from, dir){
    let i=from+dir;
    while(i>=0 && i<wbQueueIds.length){
      if(!wbDoneIds.has(wbQueueIds[i])) return i;
      i+=dir;
    }
    return -1;
  }
  function wbFindAnyUndone(){
    // v10.48.2.1: 뒤(또는 앞)쪽에 더 없어도 배열 전체에 미처리자가 남아있으면 그쪽으로 순환 이동한다.
    // "검토 완료"는 남은 인원이 정말 0명일 때만 표시(§17 요구사항 정확 반영).
    return wbQueueIds.findIndex(id=>!wbDoneIds.has(id));
  }
  function wbGoTo(idx){
    if(idx<0 || idx>=wbQueueIds.length) return;
    wbIndex=idx; wbRender();
  }
  function wbGoNext(){
    let i=wbFindNextIndex(wbIndex,1);
    if(i<0) i=wbFindAnyUndone();
    if(i>=0){ wbGoTo(i); return; }
    wbIndex=wbQueueIds.length; wbRender();
  }
  function wbGoPrev(){
    let i=wbFindNextIndex(wbIndex,-1);
    if(i<0) i=wbFindAnyUndone();
    if(i>=0) wbGoTo(i);
  }

  // ---------- 렌더 ----------
  function wbCurrentApplicant(){
    if(wbIndex<0 || wbIndex>=wbQueueIds.length) return null;
    return applicants.find(a=>String(a.id)===String(wbQueueIds[wbIndex])) || null;
  }
  function wbDuplicateInfo(a){
    const phone=normalizePhone(a.phone);
    if(!phone || phone.length<8) return '';
    const others=applicants.filter(x=>x.id!==a.id && normalizePhone(x.phone)===phone);
    if(!others.length) return '';
    const lines=others.map(x=>`${esc(x.name||'이름없음')} · ${esc(x.status||'-')} · ${esc(x.applyDate||'-')}`).join('<br/>');
    return `<div class="wb-dup-note"><strong>동일 연락처 지원 이력 ${others.length}건</strong><span>${lines}</span></div>`;
  }
  function wbCandidateListHtml(){
    return wbQueueIds.map((id,i)=>{
      const a=applicants.find(x=>String(x.id)===String(id));
      if(!a) return '';
      const done=wbDoneIds.has(id);
      const cur=i===wbIndex;
      return `<button type="button" class="wb-queue-item${cur?' is-current':''}${done?' is-done':''}" data-wb-goto="${i}" ${done?'disabled':''}>
        <span class="wb-queue-name">${esc(a.name||'이름없음')}</span>
        <span class="wb-queue-meta">${esc(a.workplace||'-')} · ${esc(a.applyDate||'-')}</span>
        ${done?'<span class="wb-queue-tag">처리됨</span>':''}
      </button>`;
    }).join('');
  }
  function wbRender(){
    const body=wbEl('screeningWorkbenchBody');
    if(!body) return;
    const total=wbQueueIds.length;
    const decided=wbDoneIds.size;
    const a=wbCurrentApplicant();
    const progressPct= total? Math.round(decided/total*100) : 0;

    if(!a){
      body.innerHTML=`
        <div class="modal-head"><div><p class="eyebrow">SCREENING WORKBENCH</p><h3 id="wbTitle">서류검토</h3></div><button class="ghost" id="btnWbClose" type="button">닫기</button></div>
        <div id="wbUndoBanner"></div>
        <div class="wb-empty"><strong>검토 완료</strong><p>대상으로 지정된 서류검토 지원자를 모두 처리했습니다.</p></div>`;
      wbEl('btnWbClose')?.addEventListener('click', wbClose);
      wbRenderUndoBanner();
      return;
    }

    const score=typeof calcScore==='function'?calcScore(a):0;
    const sc=typeof deriveScores==='function'?deriveScores(a):{major:0,career:0,cert:0,field:0};
    const dorm=typeof dormLabel==='function'?dormLabel(a):'';
    const dup=wbDuplicateInfo(a);

    const basicRows=[
      detailRow('성명', a.name),
      detailRow('생년월일 / 나이', [a.birthYear, a.age?`${a.age}세`:''].filter(Boolean).join(' / ')),
      detailRow('성별', a.gender),
      detailRow('연락처', typeof formatPhoneDisplay==='function'?formatPhoneDisplay(a.phone):a.phone),
      detailRow('지역', a.region),
      detailRow('지원근무지', a.workplace),
    ].join('');
    const eduRows=[
      detailRow('학력구분', a.education),
      detailRow('학교', a.school),
      detailRow('학과', a.major),
    ].join('');
    const careerRows=[
      detailRow('경력구분', a.careerType),
      detailRow('경력사항', a.career),
      detailRow('자격증', a.certs),
      detailRow('외국어/기타자격', a.languageEtc),
    ].join('');
    const applyRows=[
      detailRow('지원일', a.applyDate),
      detailRow('지원경로', a.source),
      detailRow('출근방법', dorm),
      detailRow('검토점수', `${score}점 (전공${sc.major}·경력${sc.career}·자격${sc.cert}·현장${sc.field})`),
      detailRow('메모', a.memo),
    ].join('');

    body.innerHTML=`
      <div class="modal-head wb-head">
        <div><p class="eyebrow">SCREENING WORKBENCH</p><h3 id="wbTitle">서류검토 · ${wbIndex+1} / ${total}</h3></div>
        <button class="ghost" id="btnWbClose" type="button">닫기</button>
      </div>
      <div class="wb-progress-track"><div class="wb-progress-bar" style="width:${progressPct}%"></div></div>
      <div id="wbUndoBanner"></div>
      <div class="wb-layout">
        <aside class="wb-queue-panel"><div class="wb-queue-head">검토 대상 ${total}명 · 남음 ${wbRemainingCount()}명</div><div class="wb-queue-list">${wbCandidateListHtml()}</div></aside>
        <section class="wb-main-panel">
          <div class="wb-candidate-head">
            <div><strong>${esc(a.name||'이름없음')}</strong><span class="badge ${badgeClass(a.status)}">${esc(a.status)}</span></div>
            <div class="wb-nav-btns"><button class="mini" id="btnWbPrev" type="button">‹ 이전</button><button class="mini" id="btnWbNext" type="button">다음 ›</button></div>
          </div>
          ${dup}
          <div class="wb-section-grid">
            <div><h5>기본정보</h5>${basicRows}</div>
            <div><h5>학력</h5>${eduRows}</div>
            <div><h5>경력·이력</h5>${careerRows}</div>
            <div><h5>채용정보</h5>${applyRows}</div>
          </div>
          <div class="wb-decision-bar">
            <label class="wb-fail-reason" id="wbFailReasonWrap" style="display:none;">탈락 사유
              <select id="wbFailReasonSelect">${FAIL_REASONS.map(r=>`<option>${esc(r)}</option>`).join('')}</select>
            </label>
            <div class="wb-decision-btns">
              <button class="primary wb-btn-pass" id="btnWbPass" type="button">서류합격</button>
              <button class="danger wb-btn-fail" id="btnWbFail" type="button">서류탈락</button>
              <button class="ghost wb-btn-fail-confirm" id="btnWbFailConfirm" type="button" style="display:none;">탈락 확정</button>
              <button class="ghost" id="btnWbHold" type="button">이번 검토 넘기기</button>
            </div>
          </div>
        </section>
      </div>`;

    wbEl('btnWbClose')?.addEventListener('click', wbClose);
    wbEl('btnWbPrev')?.addEventListener('click', wbGoPrev);
    wbEl('btnWbNext')?.addEventListener('click', wbGoNext);
    wbEl('btnWbPass')?.addEventListener('click', ()=>{ if(wbApplyDecision(a,{status:'서류합격'})){ wbGoNext(); wbRenderUndoBanner(); } });
    wbEl('btnWbHold')?.addEventListener('click', ()=>{ if(wbApplyHold(a,'')){ wbGoNext(); wbRenderUndoBanner(); } });
    wbEl('btnWbFail')?.addEventListener('click', ()=>{
      wbEl('wbFailReasonWrap').style.display='';
      wbEl('btnWbFail').style.display='none';
      wbEl('btnWbFailConfirm').style.display='';
    });
    wbEl('btnWbFailConfirm')?.addEventListener('click', ()=>{
      const reason=wbEl('wbFailReasonSelect')?.value || FAIL_REASONS[0];
      if(wbApplyDecision(a,{status:'서류탈락', failureReason:reason})){ wbGoNext(); wbRenderUndoBanner(); }
    });
    document.querySelectorAll('[data-wb-goto]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ const i=Number(btn.dataset.wbGoto); if(!Number.isNaN(i)) wbGoTo(i); });
    });
    wbRenderUndoBanner();
  }
  function wbRenderUndoBanner(){
    const el=wbEl('wbUndoBanner');
    if(!el) return;
    if(!wbUndo){ el.innerHTML=''; return; }
    el.innerHTML=`<div class="wb-undo-banner">${esc(wbUndo.name)}님을 처리했습니다. <button class="mini" id="btnWbUndo" type="button">방금 처리 취소</button></div>`;
    wbEl('btnWbUndo')?.addEventListener('click', wbUndoLast);
  }

  // ---------- 열기/닫기 ----------
  function wbOpen(source, singleId){
    wbQueueIds = singleId ? [singleId] : (source==='home' ? wbComputeHomeQueue() : wbComputeListQueue());
    wbDoneIds=new Set();
    wbUndo=null;
    wbIndex = wbQueueIds.length ? 0 : 0;
    wbCaptureListState();
    const modal=wbEl('screeningWorkbenchModal');
    if(!modal) return;
    modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    wbRender();
    document.addEventListener('keydown', wbKeyHandler, true);
  }
  function wbClose(){
    const modal=wbEl('screeningWorkbenchModal');
    if(modal){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }
    document.body.style.overflow='';
    document.removeEventListener('keydown', wbKeyHandler, true);
    wbRestoreListState();
    wbRefreshEntryButtons();
    if(typeof renderHomeLists==='function') renderHomeLists();
  }


  window.openScreeningWorkbenchForApplicant=function(id){ wbOpen('list', id); };
  window.openScreeningWorkbenchQueue=function(source){ wbOpen(source==='home'?'home':'list'); };

  // ---------- 단축키 (보조 기능, input/textarea/select/조합중에는 절대 미동작) ----------
  function wbKeyHandler(e){
    if(e.isComposing) return;
    const tag=(e.target && e.target.tagName || '').toLowerCase();
    if(tag==='input' || tag==='textarea' || tag==='select' || (e.target && e.target.isContentEditable)) return;
    if(!e.altKey) return;
    if(e.key==='1'){ e.preventDefault(); wbEl('btnWbPass')?.click(); }
    else if(e.key==='2'){ e.preventDefault(); wbEl('btnWbFail')?.click(); }
    else if(e.key==='3'){ e.preventDefault(); wbEl('btnWbHold')?.click(); }
    else if(e.key.toLowerCase()==='z'){ e.preventDefault(); wbUndoLast(); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); wbGoNext(); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); wbGoPrev(); }
  }

  // ---------- 진입 버튼 바인딩 ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    wbEl('btnStartScreeningWorkbench')?.addEventListener('click', ()=>wbOpen('list'));
    wbEl('btnHomeStartScreening')?.addEventListener('click', ()=>wbOpen('home'));
    wbEl('screeningWorkbenchBackdrop')?.addEventListener('click', wbClose);
    wbRefreshEntryButtons();
  });

  // 목록/홈이 다시 그려질 때마다 진입 버튼 개수도 함께 갱신(기존 함수를 감싸는 기존 패턴 재사용)
  const baseUpdateCounts=window.updateApplicantListFilterCounts;
  if(typeof baseUpdateCounts==='function'){
    window.updateApplicantListFilterCounts=function(){ const r=baseUpdateCounts.apply(this,arguments); wbRefreshEntryButtons(); return r; };
  }
  const baseHomeLists=window.renderHomeLists;
  if(typeof baseHomeLists==='function'){
    window.renderHomeLists=function(){ const r=baseHomeLists.apply(this,arguments); wbRefreshEntryButtons(); return r; };
  }
})();
