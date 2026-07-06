const STORAGE_KEY = 'recruit_erp_vercel_v2_applicants';
let applicants = load();
let currentWorkplace = 'all';
let currentFilter = 'all';
let currentSearch = '';

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);

function load(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants)); renderAll(); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function calcScore(a){
  const text = `${a.major||''} ${a.certs||''} ${a.career||''} ${a.memo||''}`.toLowerCase();
  let score = 0;
  if(/pm|예방정비|설비|장비|maintenance|field|fe|셋업|set.?up|반도체|fab|클린룸|방진복|esc|웨이퍼|chamber|particle|cmp|cvd|pvd|etch/.test(text)) score += 40;
  if(/전기|전자|기계|반도체|자동화|메카|화공|산업경영|공학/.test(text)) score += 20;
  if(/산업안전|전기|기계|설비보전|자동화|위험물|기능사|산업기사|기사|운전면허|컴활/.test(text)) score += 20;
  if(/개선|원인|분석|트러블|표준화|매뉴얼|인수인계|정비|점검|교대/.test(text)) score += 10;
  if(a.name && a.phone && a.workplace) score += 10;
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
  if(a.status==='면접완료') return '판정 입력';
  if(a.status==='입사예정') return '입사 안내';
  if(a.status==='보류') return '추가 검토';
  return '-';
}

function setPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titleMap = {home:'홈',applicants:'지원자 목록',form:'지원자 입력',today:'오늘 할 일',templates:'안내문구',backup:'백업/내보내기'};
  $('page-title').textContent = titleMap[page] || '홈';
  if(page==='form' && !$('applyDate').value) $('applyDate').value = today();
  renderAll();
}

function renderStats(){
  const total = applicants.length;
  const cheonan = applicants.filter(a=>a.workplace==='천안').length;
  const pyeong = applicants.filter(a=>a.workplace==='평택').length;
  const interview = applicants.filter(a=>a.status==='면접예정').length;
  const priority = applicants.filter(a=>['미연락','부재중','문자발송'].includes(a.status)).length;
  const data = [['전체',total],['천안',cheonan],['평택',pyeong],['면접예정',interview],['연락필요',priority]];
  $('statsGrid').innerHTML = data.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
}
function card(a){
  const score = calcScore(a);
  return `<div class="person-card"><div><strong>${esc(a.name||'이름없음')} <span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></strong><small>${esc(a.workplace||'근무지 미입력')} · ${esc(a.phone||'연락처 없음')} · ${score}점/${grade(score)}</small></div><button class="mini" onclick="editApplicant('${a.id}')">수정</button></div>`;
}
function renderHomeLists(){
  const priority = applicants.filter(a=>['미연락','부재중','문자발송'].includes(a.status)).slice(0,5);
  const recent = [...applicants].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5);
  $('priorityList').innerHTML = priority.length ? priority.map(card).join('') : `<div class="empty">먼저 볼 지원자가 없습니다.</div>`;
  $('recentList').innerHTML = recent.length ? recent.map(card).join('') : `<div class="empty">등록된 지원자가 없습니다.</div>`;
}
function filtered(){
  return applicants.filter(a=>{
    const workplaceOk = currentWorkplace==='all' || (currentWorkplace==='기타' ? !['천안','평택'].includes(a.workplace) : a.workplace===currentWorkplace);
    const text = Object.values(a).join(' ').toLowerCase();
    const searchOk = !currentSearch || text.includes(currentSearch.toLowerCase());
    let filterOk = true;
    if(currentFilter==='contact') filterOk = ['미연락','부재중','문자발송'].includes(a.status);
    if(currentFilter==='interview') filterOk = a.status==='면접예정';
    if(currentFilter==='hold') filterOk = a.status==='보류';
    if(currentFilter==='active') filterOk = !['불합격','연락두절'].includes(a.status);
    return workplaceOk && searchOk && filterOk;
  });
}
function renderTable(){
  const rows = filtered();
  $('applicantTbody').innerHTML = rows.length ? rows.map(a=>{
    const score = calcScore(a);
    return `<tr>
      <td><span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></td>
      <td>${esc(a.name||'')}</td><td>${esc(a.workplace||'')}</td><td>${esc(a.phone||'')}</td><td>${esc(a.applyDate||'')}</td><td>${esc(a.interviewDate||'')}</td>
      <td>${esc([a.school,a.major].filter(Boolean).join(' / '))}</td><td>${score} · ${grade(score)}</td><td>${nextAction(a)}</td>
      <td class="row-actions"><button onclick="editApplicant('${a.id}')">수정</button><button class="delete" onclick="deleteApplicant('${a.id}')">삭제</button></td>
    </tr>`;
  }).join('') : `<tr><td colspan="10" class="empty">조건에 맞는 지원자가 없습니다.</td></tr>`;
}
function renderToday(){
  const t = today();
  const interviews = applicants.filter(a=>a.interviewDate===t || a.status==='면접예정');
  const recalls = applicants.filter(a=>['부재중','문자발송','미연락'].includes(a.status));
  const waits = applicants.filter(a=>['입사예정','보류','면접완료'].includes(a.status));
  $('todayInterview').innerHTML = interviews.length ? interviews.map(card).join('') : `<div class="empty">오늘 면접/면접예정자가 없습니다.</div>`;
  $('recallList').innerHTML = recalls.length ? recalls.map(card).join('') : `<div class="empty">재연락 대상이 없습니다.</div>`;
  $('waitingList').innerHTML = waits.length ? waits.map(card).join('') : `<div class="empty">입사/검토 대기자가 없습니다.</div>`;
}
function renderTemplateSelect(){
  $('templateApplicant').innerHTML = applicants.map(a=>`<option value="${a.id}">${esc(a.name||'이름없음')} - ${esc(a.workplace||'')}</option>`).join('') || `<option value="">지원자 없음</option>`;
}
function renderAll(){ renderStats(); renderHomeLists(); renderTable(); renderToday(); renderTemplateSelect(); updateScorePreview(); }

function getForm(){
  return ['editId','name','phone','email','workplace','applyDate','status','interviewDate','source','school','major','certs','career','memo'].reduce((o,id)=>{ o[id]=$((id)).value.trim(); return o; },{});
}
function fillForm(a){
  $('editId').value = a.id || '';
  ['name','phone','email','workplace','applyDate','status','interviewDate','source','school','major','certs','career','memo'].forEach(id=>$(id).value = a[id] || '');
  updateScorePreview();
}
function resetForm(){ $('applicantForm').reset(); $('editId').value=''; $('applyDate').value=today(); updateScorePreview(); }
function editApplicant(id){ const a=applicants.find(x=>x.id===id); if(a){ fillForm(a); setPage('form'); } }
function deleteApplicant(id){ if(confirm('삭제할까요?')){ applicants = applicants.filter(a=>a.id!==id); save(); } }
window.editApplicant = editApplicant; window.deleteApplicant = deleteApplicant;

function updateScorePreview(){
  if(!$('scorePreview')) return;
  const data = getForm();
  const score = calcScore(data);
  $('scorePreview').textContent = `PM점수 미리보기: ${score}점 · ${grade(score)}`;
}
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function makeTemplate(){
  const id = $('templateApplicant').value; const a = applicants.find(x=>x.id===id) || {};
  const name = a.name || '지원자'; const wp = a.workplace || '지원 근무지'; const dt = a.interviewDate || '협의된 일정';
  const type = $('templateType').value;
  const map = {
    '면접 안내': `안녕하세요, ${name}님.\n에이치티솔루션 채용 담당자입니다.\n지원해주신 이력서 검토 후 면접 일정 안내드립니다.\n\n- 지원근무지: ${wp}\n- 면접일정: ${dt}\n\n확인 후 가능 여부 회신 부탁드립니다. 감사합니다.`,
    '부재중 재연락': `안녕하세요, ${name}님.\n에이치티솔루션 채용 관련하여 연락드렸으나 부재중이셔서 문자 남깁니다.\n통화 가능하실 때 회신 부탁드립니다.`,
    '근무지 변경 문의': `안녕하세요, ${name}님.\n지원해주신 이력서 확인 후 연락드립니다.\n현재 내부 검토 과정에서 ${wp} 외 다른 근무지 가능 여부도 함께 확인하고 있습니다.\n혹시 천안/평택 근무도 검토 가능하실지 조심스럽게 문의드립니다.`,
    '보류/검토 안내': `안녕하세요, ${name}님.\n지원해주신 서류는 현재 내부 검토 중입니다.\n검토 결과에 따라 추가 안내드리겠습니다. 감사합니다.`,
    '입사 안내': `안녕하세요, ${name}님.\n입사 관련 안내드립니다.\n준비사항 및 세부 일정은 별도 안내드릴 예정입니다. 감사합니다.`
  };
  $('templateOutput').value = map[type] || '';
}
function download(name, content, type='text/plain;charset=utf-8'){
  const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function csv(){
  const headers = ['성명','연락처','이메일','지원근무지','지원일','연락상태','면접일','지원경로','학교','전공','자격증','경력','메모','PM점수','추천등급','다음액션'];
  const lines = [headers, ...applicants.map(a=>[a.name,a.phone,a.email,a.workplace,a.applyDate,a.status,a.interviewDate,a.source,a.school,a.major,a.certs,a.career,a.memo,calcScore(a),grade(calcScore(a)),nextAction(a)])]
    .map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`지원자명단_${today()}.csv`, '\ufeff' + lines.join('\n'), 'text/csv;charset=utf-8');
}
function addSample(){
  if(applicants.length && !confirm('샘플 데이터를 추가할까요?')) return;
  const samples = [
    {name:'김진쩌',phone:'010-1111-2222',email:'sample1@example.com',workplace:'평택',applyDate:today(),status:'미연락',interviewDate:'',source:'사람인',school:'한국폴리텍',major:'반도체장비설계',certs:'산업안전산업기사, 전기기능사',career:'반도체 장비 셋업 FE 경험',memo:'PM 우선검토'},
    {name:'박채용',phone:'010-3333-4444',email:'sample2@example.com',workplace:'천안',applyDate:today(),status:'면접예정',interviewDate:today(),source:'잡코리아',school:'연암공과대학교',major:'전기전자',certs:'운전면허 1종',career:'금형 조립, 정비병 경험',memo:'현장 적응 확인 필요'}
  ].map(x=>({...x,id:uid(),createdAt:new Date().toISOString()}));
  applicants = [...samples, ...applicants]; save();
}

// events
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.go)));
$('btnSample').addEventListener('click', addSample);
$('applicantForm').addEventListener('input', updateScorePreview);
$('applicantForm').addEventListener('submit', e=>{
  e.preventDefault();
  const f = getForm();
  if(!f.name){ alert('성명을 입력해주세요.'); return; }
  const dup = applicants.find(a=>a.id!==f.editId && ((f.phone && a.phone===f.phone) || (f.email && a.email===f.email)));
  if(dup && !confirm(`중복 가능성이 있습니다: ${dup.name}\n그래도 저장할까요?`)) return;
  if(f.editId){ applicants = applicants.map(a=>a.id===f.editId ? {...a,...f,id:f.editId,updatedAt:new Date().toISOString()} : a); }
  else { applicants.unshift({...f,id:uid(),createdAt:new Date().toISOString()}); }
  resetForm(); save(); setPage('applicants');
});
$('btnResetForm').addEventListener('click', resetForm);
$('searchInput').addEventListener('input', e=>{ currentSearch=e.target.value; renderTable(); });
document.querySelectorAll('#workplaceTabs .tab').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentWorkplace=b.dataset.workplace; renderTable(); }));
document.querySelectorAll('#quickFilters .chip').forEach(b=>b.addEventListener('click',()=>{ document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.remove('active')); b.classList.add('active'); currentFilter=b.dataset.filter; renderTable(); }));
$('btnMakeTemplate').addEventListener('click', makeTemplate);
$('btnCopyTemplate').addEventListener('click', async()=>{ await navigator.clipboard.writeText($('templateOutput').value); alert('복사됐습니다.'); });
$('btnCsv').addEventListener('click', csv);
$('btnJson').addEventListener('click', ()=>download(`recruit_erp_backup_${today()}.json`, JSON.stringify(applicants,null,2), 'application/json'));
$('jsonImport').addEventListener('change', e=>{ const file=e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(Array.isArray(data)){ applicants=data; save(); alert('가져오기 완료'); } }catch{ alert('JSON 파일을 확인해주세요.'); } }; r.readAsText(file); });
$('btnClearAll').addEventListener('click', ()=>{ if(confirm('현재 브라우저의 모든 지원자 데이터를 삭제할까요?')){ applicants=[]; save(); } });

resetForm(); renderAll();
