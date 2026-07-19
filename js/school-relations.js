/* =========================================================
   v10.13.0 협력학교 관리 (1단계: 현재 채용 데이터 기반)
   - 지원자의 school 필드를 기준으로 학교별 실적을 자동 집계
   - 이번 단계는 "지원~입사" 데이터만 반영 (공급 안정성 + 입사자 품질 proxy)
   - 재직 안정성/무사고·품행 영역은 사원명부 연동 후 2단계에서 추가 예정
   - 학교명은 지원자 입력 폼에 적은 텍스트 그대로 집계되므로, 같은 학교를
     "영남이공대" / "영남이공대학교" 처럼 다르게 적으면 서로 다른 학교로
     잡힐 수 있음 (화면 하단 안내 문구로 고지)
   ========================================================= */
const SCHOOL_MIN_SAMPLE = 3;
function schoolTypeGroup(type){
  const t = normalizeSchoolType(type);
  if(t==='고등학교') return '고등학교';
  if(t==='전문대'||t==='대학교') return '대학교';
  return '';
}
/* =========================================================
   v10.26.0 학교별 재직/무사고 통계를 사원명부에서 실시간 계산
   - 이전에는 파이썬으로 한 번 계산해 넣은 고정 스냅샷(school.hrStats)만 썼음
   - 이제 employees 배열(schoolId 연결 기준)에서 매번 새로 계산해서
     재직/퇴직 인원이 추가·수정될 때마다 랭킹이 자동으로 갱신되게 함
   - 사원명부 데이터가 아직 없는 학교는 예전 스냅샷(hrStats)으로 자연스럽게 폴백
   ========================================================= */
function schoolEmployeeStats(schoolId){
  if(!schoolId) return null;
  const list = employees.filter(e=>e.schoolId===schoolId);
  if(!list.length) return null;
  const activeCount = list.filter(e=>e.status==='재직중').length;
  const leaveCount = list.filter(e=>e.status==='휴직').length;
  const retiredCount = list.filter(e=>e.status==='퇴사').length;
  const upcomingCount = list.filter(e=>e.status==='입사예정').length;
  const now = new Date();
  let tenureSum=0, tenureN=0;
  list.forEach(e=>{
    if(!e.hireDate) return;
    const hire=new Date(e.hireDate);
    if(isNaN(hire)) return;
    let endDate=null;
    if(e.status==='퇴사' && e.leaveDate){ endDate=new Date(e.leaveDate); if(isNaN(endDate)) endDate=null; }
    else if(['재직중','휴직'].includes(e.status)){ endDate=now; }
    if(!endDate) return;
    const months=(endDate.getFullYear()-hire.getFullYear())*12+(endDate.getMonth()-hire.getMonth());
    if(months<0) return;
    tenureSum+=months; tenureN++;
  });
  const disciplined = list.filter(e=>e.disciplineCount>0).length;
  const totalHeadcount = activeCount + leaveCount + retiredCount;
  return {
    activeCount, leaveCount, retiredCount, upcomingCount, totalHeadcount,
    avgTenureMonths: tenureN ? Math.round(tenureSum/tenureN*10)/10 : null,
    disciplineRate: list.length ? Math.round(disciplined/list.length*1000)/10 : null,
    updatedAt: new Date().toISOString()
  };
}
function schoolAggregates(){
  const map={};
  schools.forEach(s=>{
    const liveStats=schoolEmployeeStats(s.id);
    const stats=liveStats || s.hrStats || null;
    if(!stats) return;
    map[s.id]={school:s.name, schoolId:s.id, type:s.type||'', apply:0, pass:0, docFail:0, scoreSum:0, latestApply:'', hrStats:stats};
  });
  applicants.forEach(a=>{
    const text=String(a.school||'').trim();
    if(!text) return;
    const key = a.schoolId || ('text:'+text.toLowerCase());
    if(!map[key]){
      const matched = a.schoolId ? schools.find(s=>s.id===a.schoolId) : null;
      const liveStats = matched ? schoolEmployeeStats(matched.id) : null;
      map[key]={school:matched?matched.name:text, schoolId:a.schoolId||'', type:matched?matched.type||'':'', apply:0, pass:0, docFail:0, scoreSum:0, latestApply:'', hrStats:matched?(liveStats||matched.hrStats||null):null};
    }
    const g=map[key];
    g.apply++;
    if(isPassed(a)) g.pass++;
    if(a.status==='서류탈락') g.docFail++;
    g.scoreSum += calcScore(a);
    if(!g.latestApply || (a.applyDate||'') > g.latestApply) g.latestApply = a.applyDate||'';
  });
  return Object.values(map);
}
const SCHOOL_WEIGHTS = { scale:0.30, tenureQuality:0.30, conduct:0.20, volume:0.20 };
const SCHOOL_CONTACT_MIN_HEADCOUNT = 10;
const SCHOOL_TENURE_CAP_MONTHS = 48;
function schoolScored(typeGroup){
  let rows=schoolAggregates();
  if(typeGroup && typeGroup!=='all') rows=rows.filter(g=>schoolTypeGroup(g.type)===typeGroup);
  if(!rows.length) return [];
  const maxActive=Math.max(...rows.map(g=>g.hrStats?g.hrStats.activeCount||0:0), 1);
  const maxHeadcount=Math.max(...rows.map(g=>g.hrStats?g.hrStats.totalHeadcount||0:0), 1);
  rows.forEach(g=>{
    g.hireRate = g.apply ? g.pass/g.apply : 0;
    g.avgScore = g.apply ? g.scoreSum/g.apply : 0;
    const hr=g.hrStats;
    const d={};
    d.scale = hr ? Math.min((hr.activeCount||0)/maxActive,1)*100 : null;
    d.tenureQuality = (hr && hr.avgTenureMonths!=null) ? Math.min(hr.avgTenureMonths/SCHOOL_TENURE_CAP_MONTHS,1)*100 : null;
    d.conduct = (hr && hr.disciplineRate!=null) ? Math.max(0,100-hr.disciplineRate) : null;
    d.volume = hr ? Math.min((hr.totalHeadcount||0)/maxHeadcount,1)*100 : null;
    let weightedSum=0, totalWeight=0, coverage=0;
    Object.keys(SCHOOL_WEIGHTS).forEach(k=>{
      if(d[k]!=null){ weightedSum+=d[k]*SCHOOL_WEIGHTS[k]; totalWeight+=SCHOOL_WEIGHTS[k]; coverage++; }
    });
    g.domains=d;
    g.coverage=coverage;
    g.score = totalWeight ? Math.round((weightedSum/totalWeight)*10)/10 : 0;
    g.totalHeadcount = hr ? (hr.totalHeadcount||0) : 0;
    g.contactEligible = g.totalHeadcount >= SCHOOL_CONTACT_MIN_HEADCOUNT;
  });
  rows.sort((a,b)=>b.score-a.score || b.totalHeadcount-a.totalHeadcount);
  const eligible=rows.filter(g=>g.contactEligible);
  const eN=eligible.length;
  eligible.forEach((g,i)=>{ g.eligibleRank=i+1; g.percentile=eN?Math.round((g.eligibleRank/eN)*1000)/10:100; });
  rows.filter(g=>!g.contactEligible).forEach(g=>{ g.percentile=100; });
  rows.forEach((g,i)=>{
    g.rank=i+1;
    const hrSample = g.totalHeadcount;
    g.lowSample = g.apply < SCHOOL_MIN_SAMPLE && hrSample < SCHOOL_MIN_SAMPLE;
  });
  return rows;
}
function schoolTierClass(g){
  if(!g.contactEligible) return '';
  if(g.percentile<=10) return 'school-tier-top10';
  if(g.percentile<=20) return 'school-tier-top20';
  return '';
}
function schoolTierLabel(g){
  if(!g.contactEligible) return `<span class="muted" style="font-size:11px;">배출 ${SCHOOL_CONTACT_MIN_HEADCOUNT}명 미만</span>`;
  if(g.percentile<=10) return '<span class="chip school-tier-chip school-tier-chip-top10" style="cursor:default">TOP 10%</span>';
  if(g.percentile<=20) return '<span class="chip school-tier-chip school-tier-chip-top20" style="cursor:default">TOP 20%</span>';
  return '';
}
let schoolRankTypeFilter='all';
let schoolManageTypeFilter='all';
let schoolHideLowVolume=false;
let schoolManageSort='name';
let schoolManageSortDirection='asc';
let schoolManageSearch='';
let schoolManageRegionFilter='all';
let schoolManageContactFilter='all';
let schoolManageMouFilter='all';
let schoolManageStatusFilter='all';
let schoolManageHasApplicants=false;
let schoolManageHasEmployees=false;
let schoolManageMissingHistory=false;
let schoolManageUnclassifiedFilter=false;
let schoolManagePage=1;
let schoolManagePageSize=30;
let schoolManageFiltersCollapsed=false;
window.schoolManageRecentHistory=false;
window.schoolManageBrokenLinks=false;
window.schoolManageDuplicates=false;
function renderSchools(){
  const body=$('schoolsBody');
  if(!body) return;
  const allRows=schoolScored(schoolRankTypeFilter);
  const rows = schoolHideLowVolume ? allRows.filter(g=>g.contactEligible) : allRows;
  setText('schoolsTotalCount', allRows.length);
  setText('schoolsTop10Count', allRows.filter(g=>g.contactEligible && g.percentile<=10).length);
  setText('schoolsTop20Count', allRows.filter(g=>g.contactEligible && g.percentile<=20).length);
  setText('schoolsLowSampleCount', rows.filter(g=>g.lowSample).length);
  if(!rows.length){ body.innerHTML=`<tr><td colspan="9" class="empty">${schoolRankTypeFilter==='all'?'출신학교가 입력된 지원자가 없습니다. 지원자 입력 화면에서 "출신학교" 칸을 채워주세요.':'이 구분에 해당하는 학교가 없습니다. 학교 관리에서 구분을 지정해주세요.'}</td></tr>`; return; }
  body.innerHTML = rows.map(g=>`<tr class="${schoolTierClass(g)}">
    <td class="school-rank-num">${g.rank}</td>
    <td>${g.schoolId ? `<button class="link-like" onclick="openSchoolDetail('${g.schoolId}')">${esc(g.school)}</button>` : esc(g.school)}${g.lowSample?' <small class="muted">(표본 적음)</small>':''}</td>
    <td>${esc(schoolTypeGroup(g.type))||'<span class="muted">미분류</span>'}</td>
    <td><button class="mini" onclick="viewSchoolEmployees('${g.schoolId}','${escJs(g.school)}')"><strong>${g.totalHeadcount}명</strong></button></td>
    <td>${g.hrStats?(g.hrStats.activeCount||0):0}명</td>
    <td>${g.domains.tenureQuality!=null ? Math.round(g.hrStats.avgTenureMonths)+'개월' : '<span class="muted">-</span>'}</td>
    <td>${g.domains.conduct!=null ? Math.round(g.domains.conduct)+'%' : '<span class="muted">-</span>'}</td>
    <td><strong>${g.score}</strong></td>
    <td>${schoolTierLabel(g)}</td>
  </tr>`).join('');
}


function renderAll(){ renderStats(); backupNotice(); renderScheduleReminder(); renderHomeLists(); renderTable(); renderToday(); renderEmployeeLinkTask(); renderCalendar(); renderHireStats(); populateSchoolDatalist(); renderSchools(); renderSchoolManage(); renderEmployees(); updateScorePreview(); }

const fields=['editId','applyDate','source','status','workplace','name','phone','email',
  'gender','birthYear','age','region','commute','dormUse','education','finalEducation','school',
  'major','gradePoint','languageEtc','certs','career','lastCompany','duties','leaveReason','careerType',
  'jobFitCategory','interviewDate','interviewTime','hireDate','decisionReason','consult','memo'];
function getChecked(name){ return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value).join(', '); }
function setChecked(name, value){ const values=displayCheckNeeds(value).split(',').map(x=>x.trim()).filter(Boolean);
  document.querySelectorAll(`input[name="${name}"]`).forEach(x=>x.checked=values.includes(x.value));
  }
function getForm(){ const o=fields.reduce((obj,id)=>{ if($(id)) obj[id]=$(id).value.trim();
  return obj; },{}); o.birthYear=formatBirthDisplay(o.birthYear); o.phone=formatPhoneDisplay(o.phone); o.checkNeeds=getChecked('checkNeeds'); o.selfIntroKeywords=getChecked('selfIntroKeywords');
  return o; }
function fillForm(a){ fields.forEach(id=>{ const el=$(id); if(!el) return; const value = id==='editId' ? (a.id||a.editId||'') : (id==='status' ? normalizeStatus(a.status) : (id==='dormUse' ? normalizeDorm(a.dormUse) : (a[id]||'')));
  if(id==='interviewTime' && value && ![...el.options].some(o=>o.value===value)){ el.add(new Option(value,
  value)); } el.value = value; }); setChecked('checkNeeds', a.checkNeeds); setChecked('selfIntroKeywords',
  a.selfIntroKeywords); updateScorePreview(); checkDuplicate(); updateFormMode(); }
function resetForm(){ window.__erpExcelPastePendingApplicant=''; $('applicantForm').reset(); setChecked('checkNeeds',''); setChecked('selfIntroKeywords',
  ''); $('editId').value=''; $('applyDate').value=today(); if($('status')) $('status').value='미연락';
  $('duplicateBox').textContent=''; $('duplicateBox').className='wide duplicate-box'; updateScorePreview();
  dismissSchoolHint();
  updateFormMode(); }
function editApplicant(id){ const a=applicants.find(x=>x.id===id); if(a){ fillForm(a); setPage('form'); } }
function updateApplicantStatus(id, status){ const next=normalizeStatus(status); applicants=applicants.map(a=>a.id===id?normalize({...a,status:next,updatedAt:new Date().toISOString()}):a); save(); }
function duplicateApplicant(id){ const a=applicants.find(x=>x.id===id); if(a){ const copy={...a,id:'',name:a.name+' 복사',phone:'',email:'',createdAt:''}; fillForm(copy); setPage('form'); } }
function deleteApplicant(id){ if(confirm('삭제할까요?')){ applicants=applicants.filter(a=>a.id!==id); supabaseDeleteOne(id); save(); } }
function detailRow(label, value, cls=''){
  const v = String(value ?? '').trim();
  if(!v) return '';
  return `<div class="detail-row ${cls}"><span>${label}</span><strong>${esc(v)}</strong></div>`;
}
function coreItem(label, value){
  const v = String(value ?? '').trim() || '-';
  return `<div class="core-item"><span>${label}</span><strong>${esc(v)}</strong></div>`;
}
function memoBlock(title, value){
  const v = String(value ?? '').trim();
  if(!v) return '';
  return `<div class="detail-memo"><h4>${title}</h4><p>${esc(v)}</p></div>`;
}
function applicantSummary(a){ const score=calcScore(a); const sc=deriveScores(a); return `${a.name||'지원자'} / ${a.workplace||'근무지 미입력'} / ${a.phone||'연락처 없음'}
상태: ${a.status||'-'} / 출근방법: ${dormLabel(a)} / 판정: ${finalDecisionOf(a)} / 검토점수: ${score}점
직무적합: ${displayCategory(a)} / 경력구분: ${a.careerType||'-'}
학력구분: ${a.education||'-'} / 학교·전공: ${[a.school,a.major].filter(Boolean).join(' / ')||'-'} / 외국어·기타자격: ${a.languageEtc||'-'}
세부점수: 전공 ${sc.major}/25, 경력 ${sc.career}/35, 자격 ${sc.cert}/20, 현장 ${sc.field}/20
확인필요: ${displayCheckNeeds(a.checkNeeds)||'-'}
자격증: ${a.certs||'-'}
판정/메모: ${[a.memo,a.decisionReason].filter(Boolean).join(' / ')||'-'}`; }
function viewApplicant(id){
  const a=applicants.find(x=>x.id===id); if(!a) return;
  detailCurrentId=id;
  const score=calcScore(a), sc=deriveScores(a);
  const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ') || '일정 미정';
  const dorm=dormLabel(a);
  const decision=finalDecisionOf(a);
  const action=nextAction(a);
  const status=normalizeStatus(a.status);
  const profileSub=[a.careerType,a.education,a.school,a.major].filter(Boolean).join(' · ') || '지원자 기본정보';
  let manager='미지정';
  try{ manager=(JSON.parse(localStorage.getItem('recruit_erp_applicant_manager_assignments')||'{}')||{})[a.id]||'미지정'; }catch{}
  const detailSection=(title, rows, cls='')=>rows ? `<section class="detail-section-card detail-section-v108 applicant-detail-section ${cls}"><div class="detail-section-title"><h4>${title}</h4></div><div class="detail-grid detail-grid-v108">${rows}</div></section>` : '';
  const longBlock=(title, value, cls='')=>{
    const v=String(value ?? '').trim();
    if(!v) return '';
    return `<section class="detail-section-card detail-section-v108 detail-long-section applicant-detail-long ${cls}"><div class="detail-section-title"><h4>${title}</h4></div><p>${esc(v)}</p></section>`;
  };
  const summaryItem=(label,value,cls='')=>`<div class="applicant-detail-summary-item ${cls}"><span>${label}</span><strong>${esc(String(value||'-'))}</strong></div>`;

  const profile=`<section class="applicant-detail-identity ${statusToneClass(a)}">
    <div class="applicant-detail-profile-main">
      <div class="applicant-detail-avatar" aria-hidden="true">${esc(String(a.name||'?').trim().slice(0,1)||'?')}</div>
      <div class="applicant-detail-profile-copy">
        <p class="eyebrow">APPLICANT PROFILE</p>
        <h2 class="detail-name ${genderClass(a)}">${esc(a.name||'이름없음')}</h2>
        <p>${esc(profileSub)}</p>
      </div>
    </div>
    <div class="applicant-detail-contact-line">
      <span><small>연락처</small><b>${esc(a.phone||'미등록')}</b></span>
      <span><small>이메일</small><b>${esc(a.email||'미등록')}</b></span>
    </div>
  </section>`;

  const summary=`<section class="applicant-detail-summary-section">
    <div class="applicant-detail-summary-grid">
      ${summaryItem('현재 상태',status||'미입력','status')}
      ${summaryItem('담당자',manager,'manager')}
      ${summaryItem('지원근무지',a.workplace||'미입력','workplace')}
      ${summaryItem('면접 일정',interview,'interview')}
      ${summaryItem('입사 예정일',a.hireDate||'미정','hire')}
    </div>
  </section>`;

  const basicRows=[
    detailRow('연락처',a.phone),detailRow('이메일',a.email),detailRow('지원일',a.applyDate),detailRow('지원경로',a.source),
    detailRow('출근방법',dorm),detailRow('거주지역',a.region),detailRow('성별',a.gender),detailRow('생년월일/연령',[a.birthYear,a.age&&a.age+'세'].filter(Boolean).join(' / '))
  ].join('');
  const educationRows=[
    detailRow('학력구분',a.education),detailRow('학교/전공',[a.school,a.major].filter(Boolean).join(' / ')),
    detailRow('자격증',a.certs,'wide-row'),detailRow('외국어/기타자격',a.languageEtc,'wide-row')
  ].join('');
  const reviewRows=[
    detailRow('직무적합',displayCategory(a)),detailRow('경력구분',a.careerType),detailRow('확인필요사항',displayCheckNeeds(a.checkNeeds),'wide-row'),
    detailRow('자소서/태도 키워드',a.selfIntroKeywords,'wide-row')
  ].join('');
  const memoBlocks=[
    longBlock('상담내용',a.consult,'memo-primary'),
    longBlock('메모·다음 액션',a.memo),
    longBlock('판정사유·참고',a.decisionReason)
  ].filter(Boolean).join('');
  const careerBlock=longBlock('경력사항',a.career,'career-long');

  $('detailTitle').textContent=`${a.name||'이름없음'} · 지원자 상세`;
  $('detailBody').innerHTML=`
    ${profile}
    ${summary}
    <div class="applicant-detail-content-grid">
      <div class="applicant-detail-content-main">
        ${detailSection('기본정보',basicRows)}
        ${memoBlocks?`<div class="applicant-detail-memo-stack">${memoBlocks}</div>`:''}
        ${careerBlock}
      </div>
      <aside class="applicant-detail-content-side">
        ${detailSection('학력·자격',educationRows)}
        ${detailSection('검토 참고정보',reviewRows)}
        <section class="applicant-detail-decision-card">
          <div><span>현재 판정</span><strong>${esc(decision)}</strong></div>
          <div><span>다음 액션</span><strong>${esc(action)}</strong></div>
        </section>
        <details class="applicant-detail-score-details">
          <summary><span>검토점수 참고보기</span><strong>${score}점</strong></summary>
          <div class="detail-score-grid"><div><span>전공적합</span><strong>${sc.major}/25</strong></div><div><span>경력적합</span><strong>${sc.career}/35</strong></div><div><span>자격적합</span><strong>${sc.cert}/20</strong></div><div><span>현장적응</span><strong>${sc.field}/20</strong></div></div>
        </details>
      </aside>
    </div>`;
  $('detailModal').classList.add('show');
  $('detailModal')?.setAttribute('aria-hidden','false');
  setTimeout(()=>$('btnCloseDetail')?.focus({preventScroll:true}),0);
}
function closeDetail(force=false){
  const composer=$('aphQuickComposer');
  const note=$('aphNote');
  if(!force && composer && !composer.hidden && String(note?.value||'').trim()){
    if(!confirm('작성 중인 진행 기록이 저장되지 않았습니다. 닫을까요?')) return false;
  }
  $('detailModal').classList.remove('show');
  $('detailModal')?.setAttribute('aria-hidden','true');
  detailCurrentId='';
  return true;
}
