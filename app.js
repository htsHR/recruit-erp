// 이력서 관리 시스템 v10.0 Recruit ERP 2.0 디자인 베이스
const STORAGE_KEY = 'recruit_erp_applicants_stable';
const LEGACY_KEYS = ['resume_excel_like_v9_rows','recruit_erp_vercel_v2_applicants','recruit_erp_vercel_v1_applicants'];
const BACKUP_KEY = 'recruit_erp_last_backup_date';
let applicants = load();
let currentWorkplace = 'all';
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'recent';
let hideFinished = false;
let currentJobFit = 'all';
let currentCareerType = 'all';
let currentNeeds = 'all';
let detailCurrentId = '';
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function esc(s){ return String(s ?? '').replace(/[&<>\"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function normalizeGender(v){ const s=String(v||'').trim(); if(s==='남') return '남자'; if(s==='여') return '여자'; if(s==='남자'||s==='여자') return s; return ''; }
function normalize(a){ return {
  id:a.id||uid(), createdAt:a.createdAt||new Date().toISOString(), updatedAt:a.updatedAt||'',
  applyDate:a.applyDate||'', source:a.source||'', extra:a.extra||a.etc||'', status:a.status||'미연락', workplace:a.workplace||'',
  name:a.name||'', phone:a.phone||'', email:a.email||'', gender:normalizeGender(a.gender), birthYear:a.birthYear||'', age:a.age||'', region:a.region||'', commute:a.commute||'', dormUse:a.dormUse||'',
  education:a.education||'', finalEducation:a.finalEducation||'', school:a.school||'', major:a.major||'', gradePoint:a.gradePoint||'', languageEtc:a.languageEtc||'',
  certs:a.certs||'', career:a.career||'', lastCompany:a.lastCompany||'', duties:a.duties||'', leaveReason:a.leaveReason||'',
  careerType:a.careerType||'', jobFitCategory:a.jobFitCategory||'', checkNeeds:a.checkNeeds||'', selfIntroKeywords:a.selfIntroKeywords||'',
  interviewDate:a.interviewDate||'', interviewTime:a.interviewTime||'', hireDate:a.hireDate||'', finalDecision:a.finalDecision||'', decisionReason:a.decisionReason||'', consult:a.consult||'', memo:a.memo||''
}; }
function load(){
  try{
    let data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if(!data.length){
      for(const key of LEGACY_KEYS){
        const legacy = JSON.parse(localStorage.getItem(key) || '[]');
        if(Array.isArray(legacy) && legacy.length){
          data = legacy.map(normalize);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          break;
        }
      }
    }
    return Array.isArray(data) ? data.map(normalize) : [];
  }catch{ return []; }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants)); renderAll(); }
function calcAge(v){
  const n = String(v||'').replace(/\D/g,'');
  if(!n) return '';
  let y = '';
  if(n.length >= 4) y = n.slice(0,4);
  if(n.length === 6){ const yy = Number(n.slice(0,2)); y = yy > 30 ? '19'+n.slice(0,2) : '20'+n.slice(0,2); }
  const year = Number(y);
  if(!year || year < 1950 || year > new Date().getFullYear()) return '';
  return String(new Date().getFullYear() - year);
}
function textOf(a){ return `${a.dormUse||''} ${a.extra||''} ${a.education||''} ${a.finalEducation||''} ${a.school||''} ${a.major||''} ${a.gradePoint||''} ${a.languageEtc||''} ${a.certs||''} ${a.career||''} ${a.lastCompany||''} ${a.duties||''} ${a.leaveReason||''} ${a.careerType||''} ${a.jobFitCategory||''} ${a.consult||''} ${a.memo||''} ${a.decisionReason||''} ${a.selfIntroKeywords||''}`.toLowerCase(); }
function deriveScores(a){
  const text=textOf(a);
  let major=0, career=0, cert=0, field=0;
  if(/반도체|전기|전자|기계|자동화|메카|설비|정비|금형|항공정비|컴퓨터소프트웨어|융합소프트웨어|건축공학/.test(text)) major += 15;
  if(/반도체장비|전기에너지|전기전자|전기공학|기계자동차|반도체과학|전기전공|반도체장비설계|항공정비전공/.test(text)) major += 10;
  if(/pm|예방정비|설비|장비|maintenance|field|fe|셋업|set.?up|반도체|fab|클린룸|방진복|plc|drive|analyzer|bhs|정비|유지보수|기술지원|설비이상대응|전기정비|시설운영|출입제어/.test(text)) career += 25;
  if(/pm경력|pm 직접|반도체 장비|장비 셋업|전기정비|시설운영|포스코|에스원|에이치앤에스테크|현장|경력|재직중/.test(text)) career += 10;
  if(/전기기능사|전기산업기사|전기기사|산업안전|기계|설비보전|반도체설비보전|항공기정비|지게차|굴착기|기능사|산업기사|기사|운전면허|소방안전|컴활|adsp|1종보통/.test(text)) cert += 15;
  if(/지게차|굴착기|운전면허|1종|기능사|기사|산업기사/.test(text)) cert += 5;
  if(/교대|군|정비병|차량정비|안전|책임|성실|소통|인수인계|점검|현장|방진복|체력|보안|규정|매뉴얼|문제해결|트러블|개선|군입대|병력필/.test(text)) field += 15;
  if(a.name && a.phone && a.workplace && a.applyDate) field += 5;
  major=Math.min(major,25); career=Math.min(career,35); cert=Math.min(cert,20); field=Math.min(field,20);
  return {major, career, cert, field, total:major+career+cert+field};
}
function calcScore(a){ return deriveScores(a).total; }
function grade(score){ if(score>=80) return '우선검토'; if(score>=65) return '검토가능'; if(score>=45) return '추가확인'; return '조건미흡 가능성'; }
function displayCategory(a){
  if(a.jobFitCategory) return a.jobFitCategory;
  const text=textOf(a);
  if(/pm|예방정비/.test(text) && /반도체|설비|장비/.test(text)) return 'PM 직접경력자';
  if(/반도체.*(장비|셋업|fe|field)|장비.*셋업|fe|field/.test(text)) return '반도체 장비/FE 경험자';
  if(/전기정비|plc|drive|설비.*정비|유지보수|기술지원/.test(text)) return '전기·설비 정비 경험자';
  if(/기계|금형|차량정비|항공정비|선반|밀링/.test(text)) return '기계·금형·차량정비 경험자';
  if(/시설운영|설비이상대응|출입제어/.test(text)) return '시설운영/설비이상대응 경험자';
  if(/전기|전자|기계|반도체|자동화|소프트웨어/.test(text)) return '관련전공 신입';
  if(/교대|현장|군|보안|정비병|안전/.test(text)) return '현장근무 적응형';
  return '확인필요';
}
function badgeClass(status){
  if(['부재중','미연락','연락두절'].includes(status)) return 'missed';
  if(['입사예정','출근','면접완료','연락완료'].includes(status)) return 'good';
  if(['면접예정','문자발송'].includes(status)) return 'info';
  if(['불합격','부적합','철회','취소','전형마감'].includes(status)) return 'bad';
  return 'hold';
}
function nextAction(a){
  if(!a.status || a.status==='미연락') return '첫 연락 필요';
  if(a.status==='부재중') return '재연락';
  if(a.status==='문자발송') return '답변 확인';
  if(a.status==='면접예정') return '면접 준비';
  if(a.status==='면접완료' && !a.finalDecision) return '판정 입력';
  if(a.status==='출근') return '출근 완료';
  if(a.status==='입사예정') return '입사 안내';
  if(a.status==='보류') return '재검토일 확인';
  return a.finalDecision || '-';
}
function isFinished(a){ return ['불합격','부적합','철회','취소','전형마감','연락두절','입사포기'].includes(a.status) || ['불합격','입사포기'].includes(a.finalDecision); }
function isActive(a){ return !isFinished(a); }
function finalDecisionOf(a){ return a.finalDecision || grade(calcScore(a)); }

function setPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titleMap = {home:'홈',applicants:'지원자 목록',form:'지원자 입력',today:'오늘 할 일',templates:'안내문구',backup:'백업/내보내기'};
  $('page-title').textContent = titleMap[page] || '홈';
  if(page==='form' && !$('applyDate').value) $('applyDate').value = today();
  const topActions = document.querySelector('.top-actions');
  if(topActions) topActions.style.display = page==='form' ? 'none' : 'flex';
  renderAll();
}
function renderStats(){
  const total=applicants.length, cheonan=applicants.filter(a=>a.workplace==='천안').length, pyeong=applicants.filter(a=>a.workplace==='평택').length;
  const contact=applicants.filter(a=>['미연락','부재중','문자발송'].includes(a.status)).length;
  const priority=applicants.filter(a=>finalDecisionOf(a)==='우선검토').length;
  const needs=applicants.filter(a=>(a.checkNeeds||'').trim()).length;
  const data=[['전체',total],['천안',cheonan],['평택',pyeong],['연락필요',contact],['우선검토',priority],['확인필요',needs]];
  $('statsGrid').innerHTML=data.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
}
function backupNotice(){
  const last = localStorage.getItem(BACKUP_KEY);
  const msg = last ? `마지막 JSON 백업: ${last}` : '백업은 백업/내보내기 메뉴에서 필요할 때 진행할 수 있습니다.';
  $('backupAlert').textContent = msg;
  $('lastBackupText').textContent = msg;
}
function shortNeeds(a){ return (a.checkNeeds||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,2); }
function needsHtml(a){ const needs=shortNeeds(a); return needs.length?`<div class="need-tags">${needs.map(n=>`<span class="need-tag">${esc(n)}</span>`).join('')}</div>`:'-'; }
function card(a){
  const score=calcScore(a), decision=finalDecisionOf(a);
  return `<div class="person-card"><div><strong>${esc(a.name||'이름없음')} <span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></strong><small>${esc(a.workplace||'근무지 미입력')} · ${esc(displayCategory(a))} · ${score}점/${esc(decision)} · ${esc(nextAction(a))}</small></div><button class="mini" onclick="editApplicant('${a.id}')">수정</button></div>`;
}
function renderHomeLists(){
  const priority = applicants.filter(a=>['미연락','부재중','문자발송'].includes(a.status) || finalDecisionOf(a)==='우선검토' || (a.checkNeeds||'').trim()).slice(0,6);
  const recent=[...applicants].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  $('priorityList').innerHTML=priority.length?priority.map(card).join(''):`<div class="empty">우선 처리할 지원자가 없습니다.</div>`;
  $('recentList').innerHTML=recent.length?recent.map(card).join(''):`<div class="empty">등록된 지원자가 없습니다.</div>`;
}
function filtered(){
  let rows = applicants.filter(a=>{
    const workplaceOk=currentWorkplace==='all'||(currentWorkplace==='기타'?!['천안','평택'].includes(a.workplace):a.workplace===currentWorkplace);
    const text=Object.values(a).join(' ').toLowerCase();
    const searchOk=!currentSearch||text.includes(currentSearch.toLowerCase());
    const jobOk=currentJobFit==='all'||displayCategory(a)===currentJobFit;
    const careerOk=currentCareerType==='all'||a.careerType===currentCareerType;
    const needsOk=currentNeeds==='all'||(currentNeeds==='has' ? !!(a.checkNeeds||'').trim() : !(a.checkNeeds||'').trim());
    let filterOk=true;
    if(currentFilter==='priority') filterOk=finalDecisionOf(a)==='우선검토';
    if(currentFilter==='contact') filterOk=['미연락','부재중','문자발송'].includes(a.status);
    if(currentFilter==='interview') filterOk=a.status==='면접예정';
    if(currentFilter==='decision') filterOk=a.status==='면접완료'&&!a.finalDecision;
    if(currentFilter==='hold') filterOk=a.status==='보류'||a.finalDecision==='보류';
    if(currentFilter==='active') filterOk=isActive(a);
    return workplaceOk && searchOk && jobOk && careerOk && needsOk && filterOk;
  });
  if(hideFinished) rows = rows.filter(isActive);
  rows.sort((a,b)=>{
    if(currentSort==='applyDesc') return (b.applyDate||'').localeCompare(a.applyDate||'');
    if(currentSort==='applyAsc') return (a.applyDate||'').localeCompare(b.applyDate||'');
    if(currentSort==='interviewAsc'){
      const av=(a.interviewDate||'9999-12-31')+' '+(a.interviewTime||'23:59');
      const bv=(b.interviewDate||'9999-12-31')+' '+(b.interviewTime||'23:59');
      return av.localeCompare(bv);
    }
    if(currentSort==='scoreDesc') return calcScore(b)-calcScore(a);
    if(currentSort==='nameAsc') return (a.name||'').localeCompare(b.name||'', 'ko');
    return (b.createdAt||'').localeCompare(a.createdAt||'');
  });
  return rows;
}
function renderTable(){
  const rows=filtered();
  const sortName=$('sortSelect').selectedOptions[0]?.textContent || '최근 등록순';
  $('listSummary').textContent = `현재 ${rows.length}명 표시 · 정렬: ${sortName}${hideFinished ? ' · 종료/불합격 숨김 적용' : ''}`;
  $('applicantTbody').innerHTML=rows.length?rows.map((a,idx)=>{
    const score=calcScore(a), decision=finalDecisionOf(a);
    const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ') || '-';
    return `<tr>
      <td>${idx+1}</td>
      <td><span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></td>
      <td><strong>${esc(a.name||'')}</strong><span class="compact-sub">${esc(a.source||'지원경로 미입력')}</span></td>
      <td>${esc(a.phone||'')}</td>
      <td>${esc(a.workplace||'')}</td>
      <td>${esc(a.region||'-')}</td>
      <td>${esc(interview)}</td>
      <td><span class="compact-decision">${esc(decision)}</span><span class="compact-sub">${score}점 · ${esc(displayCategory(a))}</span></td>
      <td class="row-actions"><button onclick="viewApplicant('${a.id}')">상세</button><button onclick="editApplicant('${a.id}')">수정</button><button onclick="duplicateApplicant('${a.id}')">복제</button><button class="delete" onclick="deleteApplicant('${a.id}')">삭제</button></td>
    </tr>`;
  }).join(''):`<tr><td colspan="9" class="empty">조건에 맞는 지원자가 없습니다.</td></tr>`;
}
function renderToday(){
  const t=today();
  const interviews=applicants.filter(a=>a.interviewDate===t || a.status==='면접예정');
  const recalls=applicants.filter(a=>['부재중','문자발송','미연락'].includes(a.status));
  const decisions=applicants.filter(a=>a.status==='면접완료'&&!a.finalDecision || finalDecisionOf(a)==='우선검토');
  const waits=applicants.filter(a=>['입사예정','보류'].includes(a.status)||['입사예정','보류'].includes(a.finalDecision));
  $('todayInterview').innerHTML=interviews.length?interviews.map(card).join(''):`<div class="empty">오늘 면접/면접예정자가 없습니다.</div>`;
  $('recallList').innerHTML=recalls.length?recalls.map(card).join(''):`<div class="empty">연락 대상이 없습니다.</div>`;
  $('decisionList').innerHTML=decisions.length?decisions.map(card).join(''):`<div class="empty">판정 필요자가 없습니다.</div>`;
  $('waitingList').innerHTML=waits.length?waits.map(card).join(''):`<div class="empty">입사/보류 대기자가 없습니다.</div>`;
}
function renderTemplateSelect(){ $('templateApplicant').innerHTML=applicants.map(a=>`<option value="${a.id}">${esc(a.name||'이름없음')} - ${esc(a.workplace||'')}</option>`).join('')||`<option value="">지원자 없음</option>`; }
function renderAll(){ renderStats(); backupNotice(); renderHomeLists(); renderTable(); renderToday(); renderTemplateSelect(); updateScorePreview(); }

const fields=['editId','applyDate','source','extra','status','workplace','name','phone','email','gender','birthYear','age','region','commute','dormUse','education','finalEducation','school','major','gradePoint','languageEtc','certs','career','lastCompany','duties','leaveReason','careerType','jobFitCategory','interviewDate','interviewTime','hireDate','finalDecision','decisionReason','consult','memo'];
function getChecked(name){ return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value).join(', '); }
function setChecked(name, value){ const values=String(value||'').split(',').map(x=>x.trim()).filter(Boolean); document.querySelectorAll(`input[name="${name}"]`).forEach(x=>x.checked=values.includes(x.value)); }
function getForm(){ const o=fields.reduce((obj,id)=>{ if($(id)) obj[id]=$(id).value.trim(); return obj; },{}); o.checkNeeds=getChecked('checkNeeds'); o.selfIntroKeywords=getChecked('selfIntroKeywords'); return o; }
function fillForm(a){ fields.forEach(id=>{ const el=$(id); if(!el) return; const value = id==='editId' ? (a.id||a.editId||'') : (a[id]||''); if(id==='interviewTime' && value && ![...el.options].some(o=>o.value===value)){ el.add(new Option(value, value)); } el.value = value; }); setChecked('checkNeeds', a.checkNeeds); setChecked('selfIntroKeywords', a.selfIntroKeywords); updateScorePreview(); checkDuplicate(); updateFormMode(); }
function resetForm(){ $('applicantForm').reset(); setChecked('checkNeeds',''); setChecked('selfIntroKeywords',''); $('editId').value=''; $('applyDate').value=today(); $('duplicateBox').textContent=''; $('duplicateBox').className='wide duplicate-box'; updateScorePreview(); updateFormMode(); }
function editApplicant(id){ const a=applicants.find(x=>x.id===id); if(a){ fillForm(a); setPage('form'); } }
function duplicateApplicant(id){ const a=applicants.find(x=>x.id===id); if(a){ const copy={...a,id:'',name:a.name+' 복사',phone:'',email:'',createdAt:''}; fillForm(copy); setPage('form'); } }
function deleteApplicant(id){ if(confirm('삭제할까요?')){ applicants=applicants.filter(a=>a.id!==id); save(); } }
function detailRow(label, value){
  const v = String(value ?? '').trim();
  if(!v) return '';
  return `<div class="detail-row"><span>${label}</span><strong>${esc(v)}</strong></div>`;
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
상태: ${a.status||'-'} / 기숙사: ${a.dormUse||'-'} / 기타: ${a.extra||'-'} / 판정: ${finalDecisionOf(a)} / 검토점수: ${score}점
직무적합: ${displayCategory(a)} / 경력구분: ${a.careerType||'-'}
학교·전공: ${[a.school,a.major].filter(Boolean).join(' / ')||'-'} / 외국어·기타자격: ${a.languageEtc||'-'}
세부점수: 전공 ${sc.major}/25, 경력 ${sc.career}/35, 자격 ${sc.cert}/20, 현장 ${sc.field}/20
확인필요: ${a.checkNeeds||'-'}
자격증: ${a.certs||'-'}
판정/메모: ${[a.memo,a.decisionReason].filter(Boolean).join(' / ')||'-'}`; }
function viewApplicant(id){
  const a=applicants.find(x=>x.id===id); if(!a) return;
  detailCurrentId=id; const score=calcScore(a); const sc=deriveScores(a);
  const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ');
  const core = `
    <div class="detail-core-card">
      ${coreItem('성명',a.name)}${coreItem('연락처',a.phone)}${coreItem('지원근무지',a.workplace)}
      ${coreItem('연락상태',a.status)}${coreItem('면접일정',interview)}${coreItem('최종판정',finalDecisionOf(a))}
    </div>`;
  const resumeRows = [
    detailRow('최종학교/전공',[a.school,a.major].filter(Boolean).join(' / ')), detailRow('경력',a.career),
    detailRow('자격증',a.certs), detailRow('외국어/기타자격',a.languageEtc), detailRow('경력구분',a.careerType), detailRow('기숙사 사용',a.dormUse)
  ].join('');
  const manageRows = [
    detailRow('지원일',a.applyDate), detailRow('지원경로',a.source), detailRow('지역',a.region), detailRow('이메일',a.email),
    detailRow('성별',a.gender), detailRow('생년월일',a.birthYear), detailRow('연령',a.age), detailRow('입사예정일',a.hireDate),
    detailRow('기타',a.extra), detailRow('직무적합',displayCategory(a))
  ].join('');
  $('detailTitle').textContent = `${a.name||'이름없음'} · ${a.workplace||'근무지 미입력'}`;
  $('detailBody').innerHTML = `
    ${core}
    ${resumeRows ? `<div class="summary-card"><h4>이력서 핵심요약</h4><div class="detail-grid">${resumeRows}</div></div>` : ''}
    ${manageRows ? `<h4 class="detail-section-title">진행관리</h4><div class="detail-grid">${manageRows}</div>` : ''}
    ${memoBlock('확인필요사항',a.checkNeeds)}
    ${memoBlock('자소서/태도 키워드',a.selfIntroKeywords)}
    ${memoBlock('상담내용',a.consult)}
    ${memoBlock('판정사유/메모/다음액션',[a.memo,a.decisionReason].filter(Boolean).join(' / '))}
    <div class="detail-score-section"><h4>검토점수</h4><div class="detail-score"><strong>${score}점</strong><span>${esc(finalDecisionOf(a))}</span><small>${esc(displayCategory(a))} · ${esc(nextAction(a))}</small></div>
    <div class="detail-score-grid"><div><span>전공적합</span><strong>${sc.major}/25</strong></div><div><span>경력적합</span><strong>${sc.career}/35</strong></div><div><span>자격적합</span><strong>${sc.cert}/20</strong></div><div><span>현장적응</span><strong>${sc.field}/20</strong></div></div></div>`;
  $('detailModal').classList.add('show');
}
function closeDetail(){ $('detailModal').classList.remove('show'); detailCurrentId=''; }
window.editApplicant=editApplicant; window.deleteApplicant=deleteApplicant; window.duplicateApplicant=duplicateApplicant; window.viewApplicant=viewApplicant;

function updateFormMode(){
  const editing = !!($('editId') && $('editId').value);
  if($('saveBarTitle')) $('saveBarTitle').textContent = editing ? '수정 내용 저장' : '입력 후 저장';
  if($('saveBarSub')) $('saveBarSub').textContent = editing ? '기존 지원자 정보에 덮어쓰기 저장됩니다.' : '새 지원자로 등록됩니다.';
  if($('submitBtn')) $('submitBtn').textContent = editing ? '수정 저장' : '지원자 등록';
}

function updateScorePreview(){
  if(!$('scorePreview')) return;
  if(!$('age').value && $('birthYear').value) $('age').value=calcAge($('birthYear').value);
  const data=getForm(), sc=deriveScores(data);
  $('scorePreview').innerHTML=`검토점수 미리보기: <b>${sc.total}점 · ${grade(sc.total)}</b><div class="score-line"><span class="score-pill">전공 ${sc.major}/25</span><span class="score-pill">경력 ${sc.career}/35</span><span class="score-pill">자격 ${sc.cert}/20</span><span class="score-pill">현장 ${sc.field}/20</span></div>`;
}
function checkDuplicate(){
  if(!$('duplicateBox')) return;
  const f=getForm();
  const dups=applicants.filter(a=>a.id!==f.editId && ((f.phone&&a.phone===f.phone)||(f.email&&a.email===f.email)||(f.name&&a.name===f.name&&f.birthYear&&a.birthYear===f.birthYear)));
  if(dups.length){ $('duplicateBox').className='wide duplicate-box warn'; $('duplicateBox').textContent=`중복 가능성: ${dups.map(d=>d.name+'('+d.phone+')').join(', ')}`; }
  else { $('duplicateBox').textContent=''; $('duplicateBox').className='wide duplicate-box'; }
}
function makeTemplate(){
  const a=applicants.find(x=>x.id===$('templateApplicant').value)||{};
  const name=a.name||'지원자'; const wp=a.workplace||'지원근무지'; const dt=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ')||'협의된 일정'; const type=$('templateType').value;
  const map={
    '면접 안내':`안녕하세요, ${name}님.\n에이치티솔루션 채용 담당자입니다.\n지원해주신 이력서 검토 후 면접 일정 안내드립니다.\n\n- 지원근무지: ${wp}\n- 면접일정: ${dt}\n\n확인 후 가능 여부 회신 부탁드립니다. 감사합니다.`,
    '면접 일정 변경':`안녕하세요, ${name}님.\n기존에 안내드린 면접 일정 관련하여 일정 조율이 필요해 연락드립니다.\n가능하신 시간대를 회신해주시면 확인 후 다시 안내드리겠습니다.`,
    '면접 취소/전형 안내':`안녕하세요, ${name}님.\n채용 일정 관련하여 안내드립니다.\n내부 검토 결과 현재 채용 진행 상황이 변동되어 예정된 면접 진행이 어려울 수 있어 안내드립니다.\n지원해주셔서 감사합니다.`,
    '천안 → 평택 문의':`안녕하세요, ${name}님.\n지원해주신 이력서 확인 후 연락드립니다.\n현재 천안사업장은 내부 검토 중인 지원자가 있어, 혹시 평택사업장 근무도 검토 가능하실지 조심스럽게 문의드립니다.`,
    '평택 → 천안 문의':`안녕하세요, ${name}님.\n지원해주신 이력서 확인 후 연락드립니다.\n혹시 평택 외 천안사업장 근무도 검토 가능하실지 확인차 문의드립니다.`,
    '부재중 재연락':`안녕하세요, ${name}님.\n에이치티솔루션 채용 관련하여 연락드렸으나 부재중이셔서 문자 남깁니다.\n통화 가능하실 때 회신 부탁드립니다.`,
    '서류 확인 요청':`안녕하세요, ${name}님.\n지원서류 확인 중 추가 확인이 필요한 사항이 있어 연락드립니다.\n확인 가능하실 때 회신 부탁드립니다.`,
    '보류/검토 안내':`안녕하세요, ${name}님.\n지원해주신 서류는 현재 내부 검토 중입니다.\n검토 결과에 따라 추가 안내드리겠습니다. 감사합니다.`,
    '입사 안내':`안녕하세요, ${name}님.\n입사 관련 안내드립니다.\n준비사항 및 세부 일정은 별도 안내드릴 예정입니다. 감사합니다.`
  };
  $('templateOutput').value=map[type]||'';
}
function download(name, content, type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function csv(){
  const headers=['지원날짜','지원경로','기타','연락상태','지원근무지','성명','연락처','이메일','성별','생년월일','연령','거주지역','기숙사사용','최종학교','전공/학과','외국어/기타자격','경력구분','직무적합분류','확인필요사항','자소서키워드','자격증','경력키워드','면접날짜','면접시간','입사예정일','내최종판정','상담내용','판정/메모/다음액션','전공적합도','경력적합도','자격적합도','현장적응도','총점','추천등급','다음액션'];
  const lines=[headers,...applicants.map(a=>{ const sc=deriveScores(a); return [a.applyDate,a.source,a.extra,a.status,a.workplace,a.name,a.phone,a.email,a.gender,a.birthYear,a.age,a.region,a.dormUse,a.school,a.major,a.languageEtc,a.careerType,displayCategory(a),a.checkNeeds,a.selfIntroKeywords,a.certs,a.career,a.interviewDate,a.interviewTime,a.hireDate,a.finalDecision,a.consult,[a.memo,a.decisionReason].filter(Boolean).join(' / '),sc.major,sc.career,sc.cert,sc.field,sc.total,grade(sc.total),nextAction(a)]; })].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`지원자명단_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function jsonBackup(){ localStorage.setItem(BACKUP_KEY, today()); download(`resume_management_backup_${today()}.json`,JSON.stringify(applicants,null,2),'application/json'); renderAll(); }

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.go)));
$('applicantForm').addEventListener('input',()=>{ updateScorePreview(); checkDuplicate(); });
$('applicantForm').addEventListener('submit',e=>{
  e.preventDefault();
  const f=getForm();
  if(!f.name){ alert('성명을 입력해주세요.'); return; }
  const dup=applicants.find(a=>a.id!==f.editId&&((f.phone&&a.phone===f.phone)||(f.email&&a.email===f.email)));
  if(dup&&!confirm(`중복 가능성이 있습니다: ${dup.name}\n그래도 저장할까요?`)) return;
  if(f.editId){ applicants=applicants.map(a=>a.id===f.editId?normalize({...a,...f,id:f.editId,updatedAt:new Date().toISOString()}):a); }
  else { applicants.unshift(normalize({...f,id:uid(),createdAt:new Date().toISOString()})); }
  resetForm(); save(); setPage('applicants');
});
$('btnResetForm').addEventListener('click', resetForm);
$('searchInput').addEventListener('input',e=>{ currentSearch=e.target.value; renderTable(); });
document.querySelectorAll('#workplaceTabs .tab').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentWorkplace=b.dataset.workplace; renderTable(); }));
document.querySelectorAll('#quickFilters .chip').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentFilter=b.dataset.filter; renderTable(); }));
$('sortSelect').addEventListener('change',e=>{ currentSort=e.target.value; renderTable(); });
$('hideFinished').addEventListener('change',e=>{ hideFinished=e.target.checked; renderTable(); });
if($('jobFitFilter')) $('jobFitFilter').addEventListener('change',e=>{ currentJobFit=e.target.value; renderTable(); });
if($('careerTypeFilter')) $('careerTypeFilter').addEventListener('change',e=>{ currentCareerType=e.target.value; renderTable(); });
if($('needsFilter')) $('needsFilter').addEventListener('change',e=>{ currentNeeds=e.target.value; renderTable(); });
$('btnMakeTemplate').addEventListener('click', makeTemplate);
$('btnCopyTemplate').addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText($('templateOutput').value); alert('복사됐습니다.'); }catch{ alert('복사가 막히면 직접 드래그해서 복사해주세요.'); } });
$('btnCsv').addEventListener('click', csv);
$('btnJson').addEventListener('click', jsonBackup);
$('jsonImport').addEventListener('change',e=>{ const file=e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(Array.isArray(data)){ applicants=data.map(normalize); save(); alert('가져오기 완료'); } else alert('지원자 백업 JSON 형식이 아닙니다.'); }catch{ alert('JSON 파일을 확인해주세요.'); } }; r.readAsText(file); });
$('btnClearAll').addEventListener('click',()=>{ if(confirm('현재 브라우저의 모든 지원자 데이터를 삭제할까요?')){ applicants=[]; save(); } });
if($('btnCloseDetail')) $('btnCloseDetail').addEventListener('click', closeDetail);
if($('detailBackdrop')) $('detailBackdrop').addEventListener('click', closeDetail);
if($('btnDetailEdit')) $('btnDetailEdit').addEventListener('click',()=>{ const id=detailCurrentId; closeDetail(); if(id) editApplicant(id); });
if($('btnCopySummary')) $('btnCopySummary').addEventListener('click',async()=>{ const a=applicants.find(x=>x.id===detailCurrentId); if(!a) return; try{ await navigator.clipboard.writeText(applicantSummary(a)); alert('지원자 요약이 복사됐습니다.'); }catch{ alert('복사가 막히면 상세 내용을 직접 드래그해서 복사해주세요.'); } });

resetForm();
renderAll();
