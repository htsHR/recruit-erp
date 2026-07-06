const STORAGE_KEY = 'resume_excel_like_v9_rows';
const BACKUP_KEY = 'resume_excel_like_v9_last_saved';
let rows = loadRows();
let currentPage = 'home';
let currentSearch = '';
let workplaceFilter = 'all';
let statusFilter = 'all';
let sortMode = 'noAsc';
let detailId = '';
const $ = id => document.getElementById(id);
const today = () => new Date().toISOString().slice(0,10);

const columns = [
  {key:'no', label:'NO', readonly:true, cls:'col-no'},
  {key:'applyDate', label:'지원날짜', type:'date', cls:'col-date'},
  {key:'status', label:'연락상태', type:'select', cls:'col-status', options:['','미연락','연락완료','부재중','문자발송','면접예정','면접완료','출근','입사예정','불합격','부적합','철회','취소','전형마감','보류','연락두절']},
  {key:'interviewDate', label:'면접날짜', type:'date', cls:'col-date'},
  {key:'interviewTime', label:'시간', type:'time', cls:'col-time'},
  {key:'hireDate', label:'입사날짜', type:'date', cls:'col-date'},
  {key:'source', label:'지원\n경로', cls:'col-source'},
  {key:'etc', label:'기타', cls:'col-etc'},
  {key:'gender', label:'성별', type:'select', cls:'col-gender', options:['','남자','여자','미기재']},
  {key:'workplace', label:'지원\n근무지', type:'select', cls:'col-workplace', options:['','천안','평택','기타']},
  {key:'name', label:'성  명', cls:'col-name'},
  {key:'email', label:'이메일', type:'email', cls:'col-email'},
  {key:'education', label:'학력', cls:'col-edu'},
  {key:'finalEducation', label:'최종학력', cls:'col-school'},
  {key:'major', label:'학과', cls:'col-major'},
  {key:'phone', label:'연락처', cls:'col-phone'},
  {key:'age', label:'연령', type:'number', cls:'col-age'},
  {key:'birthYear', label:'연생', type:'number', cls:'col-year'},
  {key:'region', label:'지역(시)', cls:'col-region'},
  {key:'career', label:'경     력', type:'textarea', cls:'col-career'},
  {key:'certs', label:'자격증', type:'textarea', cls:'col-certs'},
  {key:'consult', label:'상담내용', type:'textarea', cls:'col-consult'},
  {key:'commute', label:'출퇴근여부', type:'select', cls:'col-commute', options:['','출퇴근','기숙사','확인필요','어려움']}
];
const dataKeys = columns.filter(c=>!c.readonly).map(c=>c.key);

function blankRow(){
  const r = { id: uid(), createdAt: new Date().toISOString(), updatedAt:'' };
  dataKeys.forEach(k=>r[k]='');
  r.status = '미연락';
  r.applyDate = today();
  return r;
}
function normalize(row){
  const base = blankRow();
  return { ...base, ...row, id: row.id || uid(), createdAt: row.createdAt || new Date().toISOString() };
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function esc(s){ return String(s ?? '').replace(/[&<>\"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function loadRows(){
  try{
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(data) ? data.map(normalize) : [];
  }catch{ return []; }
}
function saveRows(showToast=false){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  if(showToast) alert('저장되었습니다.');
  renderAll();
}
function setPage(page){
  currentPage = page;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titleMap = {home:'홈', sheet:'지원자명단', paste:'엑셀 붙여넣기', today:'오늘 할 일', backup:'백업/내보내기'};
  $('page-title').textContent = titleMap[page] || '홈';
  renderAll();
}
function statusBadge(status){
  const s = status || '미입력';
  let cls = 'hold';
  if(['출근','입사예정','면접완료','연락완료'].includes(s)) cls='good';
  if(['면접예정','문자발송'].includes(s)) cls='info';
  if(['미연락','부재중','연락두절'].includes(s)) cls='missed';
  if(['불합격','부적합','취소','전형마감','철회'].includes(s)) cls='bad';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}
function isFinished(r){ return ['불합격','부적합','철회','취소','전형마감','연락두절'].includes(r.status); }
function nextAction(r){
  if(!r.status || r.status==='미연락') return '첫 연락 필요';
  if(r.status==='부재중') return '재연락';
  if(r.status==='문자발송') return '답변 확인';
  if(r.status==='면접예정') return '면접 준비';
  if(r.status==='출근') return '출근 완료';
  if(r.status==='입사예정') return '입사 안내';
  if(isFinished(r)) return '종료';
  return r.consult || '-';
}
function visibleRows(){
  let arr = rows.filter(r=>{
    const searchText = columns.map(c=>r[c.key] || '').join(' ').toLowerCase();
    const searchOk = !currentSearch || searchText.includes(currentSearch.toLowerCase());
    const workOk = workplaceFilter==='all' || (workplaceFilter==='blank' ? !r.workplace : r.workplace===workplaceFilter);
    const statusOk = statusFilter==='all' || r.status===statusFilter;
    return searchOk && workOk && statusOk;
  });
  arr.sort((a,b)=>{
    if(sortMode==='recent') return (b.createdAt||'').localeCompare(a.createdAt||'');
    if(sortMode==='applyDesc') return (b.applyDate||'').localeCompare(a.applyDate||'');
    if(sortMode==='interviewAsc') return (a.interviewDate||'9999-12-31').localeCompare(b.interviewDate||'9999-12-31');
    if(sortMode==='nameAsc') return (a.name||'').localeCompare(b.name||'', 'ko');
    return rows.indexOf(a)-rows.indexOf(b);
  });
  return arr;
}
function renderStats(){
  const total=rows.length;
  const cheonan=rows.filter(r=>r.workplace==='천안').length;
  const pyeong=rows.filter(r=>r.workplace==='평택').length;
  const contact=rows.filter(r=>['미연락','부재중','문자발송'].includes(r.status)).length;
  const interview=rows.filter(r=>r.status==='면접예정' || r.interviewDate===today()).length;
  const finished=rows.filter(isFinished).length;
  const data=[['전체',total],['천안',cheonan],['평택',pyeong],['연락필요',contact],['면접예정',interview],['종료',finished]];
  $('statsGrid').innerHTML = data.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
}
function card(r){
  const idx = rows.indexOf(r)+1;
  return `<div class="person-card"><div><strong>${esc(r.name||'이름없음')} ${statusBadge(r.status)}</strong><small>NO.${idx} · ${esc(r.workplace||'근무지 미입력')} · ${esc(r.phone||'연락처 없음')} · ${esc(nextAction(r))}</small></div><button class="mini" onclick="focusRow('${r.id}')">보기</button></div>`;
}
function renderHome(){
  const priority = rows.filter(r=>['미연락','부재중','문자발송'].includes(r.status)).slice(0,6);
  const recent = [...rows].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  $('priorityList').innerHTML = priority.length ? priority.map(card).join('') : '<div class="empty">우선 처리할 지원자가 없습니다.</div>';
  $('recentList').innerHTML = recent.length ? recent.map(card).join('') : '<div class="empty">등록된 지원자가 없습니다.</div>';
}
function renderHead(){
  const headers = ['선택', ...columns.map(c=>c.label), '관리'];
  const classes = ['col-select', ...columns.map(c=>c.cls || ''), 'col-actions'];
  $('excelHead').innerHTML = `<tr>${headers.map((h,i)=>`<th class="${classes[i]||''}">${esc(h)}</th>`).join('')}</tr>`;
}
function cellInput(row, col, index){
  if(col.readonly) return `<input value="${index+1}" readonly tabindex="-1" />`;
  const v = row[col.key] ?? '';
  const common = `data-id="${row.id}" data-key="${col.key}"`;
  if(col.type==='select'){
    return `<select ${common}>${col.options.map(o=>`<option value="${esc(o)}" ${String(v)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  }
  if(col.type==='textarea') return `<textarea ${common}>${esc(v)}</textarea>`;
  return `<input ${common} type="${col.type||'text'}" value="${esc(v)}" />`;
}
function renderSheet(){
  renderHead();
  const arr = visibleRows();
  $('listSummary').textContent = `현재 ${arr.length}명 표시 / 전체 ${rows.length}명 · 기존 엑셀 지원자명단 데이터는 포함되지 않은 새 명단입니다.`;
  if(!arr.length){
    $('excelBody').innerHTML = `<tr><td colspan="${columns.length+2}" class="empty">아직 입력된 지원자가 없습니다. 행 추가를 눌러 시작하세요.</td></tr>`;
    return;
  }
  $('excelBody').innerHTML = arr.map(r=>{
    const index = rows.indexOf(r);
    return `<tr data-id="${r.id}">
      <td class="col-select"><input type="checkbox" class="row-check" data-id="${r.id}" /></td>
      ${columns.map(c=>`<td class="${c.cls||''}">${cellInput(r,c,index)}</td>`).join('')}
      <td class="row-actions"><button onclick="viewDetail('${r.id}')">상세</button><button onclick="duplicateRow('${r.id}')">복제</button><button class="delete" onclick="deleteRow('${r.id}')">삭제</button></td>
    </tr>`;
  }).join('');
}
function renderToday(){
  const t=today();
  const todayInterview = rows.filter(r=>r.interviewDate===t || r.status==='면접예정').slice(0,20);
  const contacts = rows.filter(r=>['미연락','부재중','문자발송'].includes(r.status)).slice(0,20);
  const hire = rows.filter(r=>r.hireDate || r.status==='입사예정' || r.status==='출근').slice(0,20);
  const consult = rows.filter(r=>r.consult).slice(-20).reverse();
  $('todayInterview').innerHTML = todayInterview.length ? todayInterview.map(card).join('') : '<div class="empty">오늘 면접/면접예정자가 없습니다.</div>';
  $('contactList').innerHTML = contacts.length ? contacts.map(card).join('') : '<div class="empty">연락 필요 대상이 없습니다.</div>';
  $('hireList').innerHTML = hire.length ? hire.map(card).join('') : '<div class="empty">입사 예정/출근 대상이 없습니다.</div>';
  $('consultList').innerHTML = consult.length ? consult.map(card).join('') : '<div class="empty">상담내용이 입력된 지원자가 없습니다.</div>';
}
function renderPasteOrder(){
  $('pasteOrder').innerHTML = columns.map(c=>`<span>${esc(c.label.replace(/\n/g,''))}</span>`).join('');
}
function renderBackupText(){
  const last = localStorage.getItem(BACKUP_KEY);
  $('lastSavedText').textContent = last ? `마지막 저장: ${new Date(last).toLocaleString()}` : '아직 저장 기록이 없습니다.';
}
function renderAll(){ renderStats(); renderHome(); renderSheet(); renderToday(); renderPasteOrder(); renderBackupText(); }

function addRow(){ rows.push(blankRow()); saveRows(); setPage('sheet'); setTimeout(()=>{ const last = document.querySelector('#excelBody tr:last-child input:not([readonly])'); if(last) last.focus(); },50); }
function updateCell(id,key,value){
  const row = rows.find(r=>r.id===id); if(!row) return;
  row[key] = value;
  row.updatedAt = new Date().toISOString();
  if(key==='birthYear' && !row.age) row.age = calcAge(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
  renderStats(); renderHome(); renderToday(); renderBackupText();
}
function calcAge(v){
  const n = String(v||'').replace(/\D/g,''); if(!n) return '';
  let year = n.length>=4 ? Number(n.slice(0,4)) : 0;
  if(n.length===6){ const yy=Number(n.slice(0,2)); year = yy>30 ? 1900+yy : 2000+yy; }
  if(!year || year<1950 || year>new Date().getFullYear()) return '';
  return String(new Date().getFullYear()-year);
}
function deleteRow(id){ if(confirm('이 행을 삭제할까요?')){ rows = rows.filter(r=>r.id!==id); saveRows(); } }
function duplicateRow(id){ const r=rows.find(x=>x.id===id); if(!r) return; const copy=normalize({...r,id:uid(),name:(r.name||'')+' 복사',createdAt:new Date().toISOString()}); rows.push(copy); saveRows(); }
function deleteSelected(){
  const ids=[...document.querySelectorAll('.row-check:checked')].map(x=>x.dataset.id);
  if(!ids.length){ alert('삭제할 행을 선택해주세요.'); return; }
  if(confirm(`${ids.length}개 행을 삭제할까요?`)){ rows=rows.filter(r=>!ids.includes(r.id)); saveRows(); }
}
function focusRow(id){ setPage('sheet'); setTimeout(()=>{ const tr=document.querySelector(`tr[data-id="${id}"]`); if(tr){ tr.scrollIntoView({block:'center',inline:'start'}); tr.style.outline='3px solid #60a5fa'; setTimeout(()=>tr.style.outline='',1600); } },80); }
function viewDetail(id){
  const r=rows.find(x=>x.id===id); if(!r) return; detailId=id;
  $('detailTitle').textContent = `${r.name||'이름없음'} · ${r.workplace||'근무지 미입력'}`;
  const detailRows = columns.map(c=>`<div class="detail-row"><span>${esc(c.label.replace(/\n/g,''))}</span><strong>${esc(c.readonly ? rows.indexOf(r)+1 : r[c.key] || '-')}</strong></div>`).join('');
  $('detailBody').innerHTML = `<div class="detail-grid">${detailRows}</div><div class="detail-memo"><h4>다음액션</h4><p>${esc(nextAction(r))}</p></div>`;
  $('detailModal').classList.add('show');
}
function closeDetail(){ $('detailModal').classList.remove('show'); detailId=''; }
function summaryText(r){
  return `NO.${rows.indexOf(r)+1} ${r.name||'이름없음'} / ${r.workplace||'근무지 미입력'} / ${r.phone||'연락처 없음'}\n상태: ${r.status||'-'} / 지원일: ${r.applyDate||'-'} / 면접: ${[r.interviewDate,r.interviewTime].filter(Boolean).join(' ')||'-'}\n학교·전공: ${[r.finalEducation,r.major].filter(Boolean).join(' / ')||'-'}\n경력: ${r.career||'-'}\n자격증: ${r.certs||'-'}\n상담내용: ${r.consult||'-'}\n출퇴근여부: ${r.commute||'-'}`;
}
function toCsv(){
  const headers = columns.map(c=>c.label.replace(/\n/g,''));
  const lines = [headers, ...rows.map((r,i)=>columns.map(c=>c.readonly ? i+1 : r[c.key]||''))]
    .map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`이력서관리시스템_지원자명단_${today()}.csv`, '\ufeff'+lines.join('\n'), 'text/csv;charset=utf-8');
}
function jsonBackup(){ download(`이력서관리시스템_백업_${today()}.json`, JSON.stringify(rows,null,2), 'application/json'); }
function download(name, content, type='text/plain;charset=utf-8'){
  const blob=new Blob([content],{type}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
}
function parsePasted(){
  const raw=$('pasteBox').value.trim();
  if(!raw){ alert('붙여넣은 내용이 없습니다.'); return; }
  const lines=raw.split(/\r?\n/).filter(Boolean);
  let added=0;
  for(const line of lines){
    const cells=line.split('\t');
    const first=(cells[0]||'').trim();
    if(first==='NO' || first==='지원날짜') continue;
    const row=blankRow();
    columns.forEach((c,idx)=>{ if(c.readonly) return; const val=(cells[idx]||'').trim(); if(val) row[c.key]=val; });
    row.createdAt=new Date().toISOString();
    rows.push(row); added++;
  }
  saveRows();
  $('pasteBox').value='';
  alert(`${added}개 행을 추가했습니다.`);
  setPage('sheet');
}
function importJson(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!Array.isArray(data)) throw new Error('array required');
      rows=data.map(normalize);
      saveRows(true);
    }catch{ alert('JSON 백업 파일 형식을 확인해주세요.'); }
  };
  reader.readAsText(file);
}
function clearAll(){ if(confirm('현재 브라우저의 모든 지원자 데이터를 삭제할까요?')){ rows=[]; saveRows(true); } }

// events

document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.page)));
document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>setPage(btn.dataset.go)));
$('btnAddTop').addEventListener('click', addRow);
$('btnAddRow').addEventListener('click', addRow);
$('btnSaveTop').addEventListener('click',()=>saveRows(true));
$('btnSaveRows').addEventListener('click',()=>saveRows(true));
$('btnDeleteSelected').addEventListener('click', deleteSelected);
$('btnCsvSheet').addEventListener('click', toCsv);
$('btnCsvBackup').addEventListener('click', toCsv);
$('btnJsonBackup').addEventListener('click', jsonBackup);
$('btnClearAll').addEventListener('click', clearAll);
$('btnImportPaste').addEventListener('click', parsePasted);
$('btnClearPaste').addEventListener('click',()=>$('pasteBox').value='');
$('searchInput').addEventListener('input',e=>{ currentSearch=e.target.value; renderSheet(); });
$('workplaceFilter').addEventListener('change',e=>{ workplaceFilter=e.target.value; renderSheet(); });
$('statusFilter').addEventListener('change',e=>{ statusFilter=e.target.value; renderSheet(); });
$('sortSelect').addEventListener('change',e=>{ sortMode=e.target.value; renderSheet(); });
$('excelBody').addEventListener('input',e=>{ const el=e.target; if(el.dataset.id && el.dataset.key) updateCell(el.dataset.id,el.dataset.key,el.value); });
$('excelBody').addEventListener('change',e=>{ const el=e.target; if(el.dataset.id && el.dataset.key) updateCell(el.dataset.id,el.dataset.key,el.value); });
$('jsonImport').addEventListener('change',e=>{ const file=e.target.files[0]; if(file) importJson(file); });
$('detailBackdrop').addEventListener('click', closeDetail);
$('btnCloseDetail').addEventListener('click', closeDetail);
$('btnDetailEditFocus').addEventListener('click',()=>{ const id=detailId; closeDetail(); if(id) focusRow(id); });
$('btnCopySummary').addEventListener('click',async()=>{ const r=rows.find(x=>x.id===detailId); if(!r) return; try{ await navigator.clipboard.writeText(summaryText(r)); alert('요약이 복사되었습니다.'); }catch{ alert('복사가 막히면 상세 내용을 직접 드래그해서 복사해주세요.'); } });

window.viewDetail=viewDetail;
window.deleteRow=deleteRow;
window.duplicateRow=duplicateRow;
window.focusRow=focusRow;

renderAll();
