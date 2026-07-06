const STORAGE_KEY = 'recruit_erp_applicants_stable';
const LEGACY_KEYS = ['recruit_erp_vercel_v2_applicants','recruit_erp_vercel_v1_applicants'];
const BACKUP_KEY = 'recruit_erp_last_backup_date';
let applicants = load();
let currentWorkplace = 'all';
let currentFilter = 'all';
let currentSearch = '';
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);

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
function normalize(a){ return {
  id:a.id||uid(), createdAt:a.createdAt||new Date().toISOString(), updatedAt:a.updatedAt||'',
  applyDate:a.applyDate||'', source:a.source||'', status:a.status||'미연락', workplace:a.workplace||'',
  name:a.name||'', phone:a.phone||'', email:a.email||'', gender:a.gender||'', birthYear:a.birthYear||'', age:a.age||'', region:a.region||'', commute:a.commute||'',
  education:a.education||'', finalEducation:a.finalEducation||'', school:a.school||'', major:a.major||'', certs:a.certs||'', career:a.career||'',
  interviewDate:a.interviewDate||'', interviewTime:a.interviewTime||'', hireDate:a.hireDate||'', finalDecision:a.finalDecision||'', decisionReason:a.decisionReason||'', consult:a.consult||'', memo:a.memo||''
}; }
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants)); renderAll(); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function esc(s){ return String(s ?? '').replace(/[&<>\"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

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
function calcScore(a){
  const text = `${a.education||''} ${a.finalEducation||''} ${a.school||''} ${a.major||''} ${a.certs||''} ${a.career||''} ${a.consult||''} ${a.memo||''}`.toLowerCase();
  let score = 0;
  if(/pm|예방정비|설비|장비|maintenance|field|fe|셋업|set.?up|반도체|fab|클린룸|방진복|esc|웨이퍼|chamber|particle|cmp|cvd|pvd|etch|필드/.test(text)) score += 40;
  if(/전기|전자|기계|반도체|자동화|메카|화공|산업경영|공학|금형|정비/.test(text)) score += 20;
  if(/산업안전|전기|기계|설비보전|자동화|위험물|기능사|산업기사|기사|운전면허|컴활|공유압|지게차/.test(text)) score += 20;
  if(/개선|원인|분석|트러블|표준화|매뉴얼|인수인계|정비|점검|교대|책임|소통/.test(text)) score += 10;
  if(a.name && a.phone && a.workplace && a.applyDate) score += 10;
  return Math.min(score,100);
}
function grade(score){ if(score>=75) return '우선검토'; if(score>=55) return '검토가능'; if(score>=35) return '추가확인'; return '조건미흡 가능성'; }
function badgeClass(status){
  if(['부재중','미연락','연락두절'].includes(status)) return 'missed';
  if(['입사예정','면접완료','연락완료'].includes(status)) return 'good';
  if(['면접예정','문자발송'].includes(status)) return 'info';
  if(['불합격'].includes(status)) return 'bad';
  return 'hold';
}
function nextAction(a){
  if(!a.status || a.status==='미연락') return '첫 연락 필요';
  if(a.status==='부재중') return '재연락';
  if(a.status==='문자발송') return '답변 확인';
  if(a.status==='면접예정') return '면접 준비';
  if(a.status==='면접완료' && !a.finalDecision) return '판정 입력';
  if(a.status==='입사예정') return '입사 안내';
  if(a.status==='보류') return '재검토일 확인';
  return a.finalDecision || '-';
}
function isActive(a){ return !['불합격','연락두절','입사포기'].includes(a.status) && !['불합격','입사포기'].includes(a.finalDecision); }

function setPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titleMap = {home:'홈',applicants:'지원자 목록',form:'지원자 입력',today:'오늘 할 일',templates:'안내문구',backup:'백업/내보내기'};
  $('page-title').textContent = titleMap[page] || '홈';
  if(page==='form' && !$('applyDate').value) $('applyDate').value = today();
  renderAll();
}
function renderStats(){
  const total=applicants.length, cheonan=applicants.filter(a=>a.workplace==='천안').length, pyeong=applicants.filter(a=>a.workplace==='평택').length;
  const contact=applicants.filter(a=>['미연락','부재중','문자발송'].includes(a.status)).length;
  const interview=applicants.filter(a=>a.status==='면접예정').length;
  const decision=applicants.filter(a=>a.status==='면접완료' && !a.finalDecision).length;
  const data=[['전체',total],['천안',cheonan],['평택',pyeong],['연락필요',contact],['면접예정',interview],['판정필요',decision]];
  $('statsGrid').innerHTML=data.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
}
function backupNotice(){
  const last = localStorage.getItem(BACKUP_KEY);
  const msg = last ? `마지막 JSON 백업: ${last}` : '아직 백업 기록이 없습니다. 퇴근 전 JSON 백업을 권장합니다.';
  $('backupAlert').textContent = msg;
  $('lastBackupText').textContent = msg;
}
function card(a){
  const score=calcScore(a), decision=a.finalDecision || grade(score);
  return `<div class="person-card"><div><strong>${esc(a.name||'이름없음')} <span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></strong><small>${esc(a.workplace||'근무지 미입력')} · ${esc(a.phone||'연락처 없음')} · ${score}점/${esc(decision)} · ${esc(nextAction(a))}</small></div><button class="mini" onclick="editApplicant('${a.id}')">수정</button></div>`;
}
function renderHomeLists(){
  const priority = applicants.filter(a=>['미연락','부재중','문자발송'].includes(a.status) || (a.status==='면접완료'&&!a.finalDecision)).slice(0,6);
  const recent=[...applicants].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  $('priorityList').innerHTML=priority.length?priority.map(card).join(''):`<div class="empty">우선 처리할 지원자가 없습니다.</div>`;
  $('recentList').innerHTML=recent.length?recent.map(card).join(''):`<div class="empty">등록된 지원자가 없습니다.</div>`;
}
function filtered(){ return applicants.filter(a=>{
  const workplaceOk=currentWorkplace==='all'||(currentWorkplace==='기타'?!['천안','평택'].includes(a.workplace):a.workplace===currentWorkplace);
  const text=Object.values(a).join(' ').toLowerCase();
  const searchOk=!currentSearch||text.includes(currentSearch.toLowerCase());
  let filterOk=true;
  if(currentFilter==='contact') filterOk=['미연락','부재중','문자발송'].includes(a.status);
  if(currentFilter==='interview') filterOk=a.status==='면접예정';
  if(currentFilter==='decision') filterOk=a.status==='면접완료'&&!a.finalDecision;
  if(currentFilter==='hold') filterOk=a.status==='보류'||a.finalDecision==='보류';
  if(currentFilter==='active') filterOk=isActive(a);
  return workplaceOk&&searchOk&&filterOk;
}); }
function renderTable(){
  const rows=filtered();
  $('applicantTbody').innerHTML=rows.length?rows.map(a=>{ const score=calcScore(a); const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' '); return `<tr>
    <td><span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></td><td><strong>${esc(a.name||'')}</strong></td><td>${esc(a.workplace||'')}</td><td>${esc(a.phone||'')}</td><td>${esc(a.applyDate||'')}</td><td>${esc(interview)}</td><td>${esc([a.school,a.major].filter(Boolean).join(' / '))}</td><td><span class="decision">${esc(a.finalDecision||'-')}</span></td><td>${score} · ${grade(score)}</td><td>${esc(nextAction(a))}</td><td class="row-actions"><button onclick="editApplicant('${a.id}')">수정</button><button onclick="duplicateApplicant('${a.id}')">복제</button><button class="delete" onclick="deleteApplicant('${a.id}')">삭제</button></td>
  </tr>`; }).join(''):`<tr><td colspan="11" class="empty">조건에 맞는 지원자가 없습니다.</td></tr>`;
}
function renderToday(){
  const t=today();
  const interviews=applicants.filter(a=>a.interviewDate===t || a.status==='면접예정');
  const recalls=applicants.filter(a=>['부재중','문자발송','미연락'].includes(a.status));
  const decisions=applicants.filter(a=>a.status==='면접완료'&&!a.finalDecision);
  const waits=applicants.filter(a=>['입사예정','보류'].includes(a.status)||['입사예정','보류'].includes(a.finalDecision));
  $('todayInterview').innerHTML=interviews.length?interviews.map(card).join(''):`<div class="empty">오늘 면접/면접예정자가 없습니다.</div>`;
  $('recallList').innerHTML=recalls.length?recalls.map(card).join(''):`<div class="empty">연락 대상이 없습니다.</div>`;
  $('decisionList').innerHTML=decisions.length?decisions.map(card).join(''):`<div class="empty">판정 필요자가 없습니다.</div>`;
  $('waitingList').innerHTML=waits.length?waits.map(card).join(''):`<div class="empty">입사/보류 대기자가 없습니다.</div>`;
}
function renderTemplateSelect(){ $('templateApplicant').innerHTML=applicants.map(a=>`<option value="${a.id}">${esc(a.name||'이름없음')} - ${esc(a.workplace||'')}</option>`).join('')||`<option value="">지원자 없음</option>`; }
function renderAll(){ renderStats(); backupNotice(); renderHomeLists(); renderTable(); renderToday(); renderTemplateSelect(); updateScorePreview(); }

const fields=['editId','applyDate','source','status','workplace','name','phone','email','gender','birthYear','age','region','commute','education','finalEducation','school','major','certs','career','interviewDate','interviewTime','hireDate','finalDecision','decisionReason','consult','memo'];
function getForm(){ return fields.reduce((o,id)=>{ o[id]=$(id).value.trim(); return o; },{}); }
function fillForm(a){ fields.forEach(id=>$(id).value=a[id]||''); updateScorePreview(); checkDuplicate(); }
function resetForm(){ $('applicantForm').reset(); $('editId').value=''; $('applyDate').value=today(); $('duplicateBox').textContent=''; $('duplicateBox').className='wide duplicate-box'; updateScorePreview(); }
function editApplicant(id){ const a=applicants.find(x=>x.id===id); if(a){ fillForm(a); setPage('form'); } }
function duplicateApplicant(id){ const a=applicants.find(x=>x.id===id); if(a){ const copy={...a,id:'',name:a.name+' 복사',phone:'',email:'',createdAt:''}; fillForm(copy); setPage('form'); } }
function deleteApplicant(id){ if(confirm('삭제할까요?')){ applicants=applicants.filter(a=>a.id!==id); save(); } }
window.editApplicant=editApplicant; window.deleteApplicant=deleteApplicant; window.duplicateApplicant=duplicateApplicant;
function updateScorePreview(){
  if(!$('scorePreview')) return;
  if(!$('age').value && $('birthYear').value) $('age').value=calcAge($('birthYear').value);
  const data=getForm(), score=calcScore(data);
  $('scorePreview').textContent=`PM점수 미리보기: ${score}점 · ${grade(score)}`;
}
function checkDuplicate(){
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
  const headers=['지원날짜','지원경로','연락상태','지원근무지','성명','연락처','이메일','성별','연생','연령','지역','출퇴근여부','학력','최종학력','학교','학과','자격증','경력','면접날짜','면접시간','입사예정일','내최종판정','판정사유','상담내용','메모','PM점수','추천등급','다음액션'];
  const lines=[headers,...applicants.map(a=>[a.applyDate,a.source,a.status,a.workplace,a.name,a.phone,a.email,a.gender,a.birthYear,a.age,a.region,a.commute,a.education,a.finalEducation,a.school,a.major,a.certs,a.career,a.interviewDate,a.interviewTime,a.hireDate,a.finalDecision,a.decisionReason,a.consult,a.memo,calcScore(a),grade(calcScore(a)),nextAction(a)])].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`지원자명단_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function jsonBackup(){ localStorage.setItem(BACKUP_KEY, today()); download(`recruit_erp_backup_${today()}.json`,JSON.stringify(applicants,null,2),'application/json'); renderAll(); }

// events
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.go)));
$('btnQuickBackup').addEventListener('click', jsonBackup);
$('applicantForm').addEventListener('input',()=>{ updateScorePreview(); checkDuplicate(); });
$('applicantForm').addEventListener('submit',e=>{ e.preventDefault(); const f=getForm(); if(!f.name){ alert('성명을 입력해주세요.'); return; } const dup=applicants.find(a=>a.id!==f.editId&&((f.phone&&a.phone===f.phone)||(f.email&&a.email===f.email))); if(dup&&!confirm(`중복 가능성이 있습니다: ${dup.name}\n그래도 저장할까요?`)) return; if(f.editId){ applicants=applicants.map(a=>a.id===f.editId?normalize({...a,...f,id:f.editId,updatedAt:new Date().toISOString()}):a); } else { applicants.unshift(normalize({...f,id:uid(),createdAt:new Date().toISOString()})); } resetForm(); save(); setPage('applicants'); });
$('btnResetForm').addEventListener('click', resetForm);
$('searchInput').addEventListener('input',e=>{ currentSearch=e.target.value; renderTable(); });
document.querySelectorAll('#workplaceTabs .tab').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentWorkplace=b.dataset.workplace; renderTable(); }));
document.querySelectorAll('#quickFilters .chip').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentFilter=b.dataset.filter; renderTable(); }));
$('btnMakeTemplate').addEventListener('click', makeTemplate);
$('btnCopyTemplate').addEventListener('click', async()=>{ try{ await navigator.clipboard.writeText($('templateOutput').value); alert('복사됐습니다.'); }catch{ alert('복사가 막히면 직접 드래그해서 복사해주세요.'); } });
$('btnCsv').addEventListener('click', csv);
$('btnJson').addEventListener('click', jsonBackup);
$('jsonImport').addEventListener('change',e=>{ const file=e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(Array.isArray(data)){ applicants=data.map(normalize); save(); alert('가져오기 완료'); } else alert('지원자 백업 JSON 형식이 아닙니다.'); }catch{ alert('JSON 파일을 확인해주세요.'); } }; r.readAsText(file); });
$('btnClearAll').addEventListener('click',()=>{ if(confirm('현재 브라우저의 모든 지원자 데이터를 삭제할까요?')){ applicants=[]; save(); } });
resetForm(); renderAll();
