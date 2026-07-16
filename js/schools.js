/* =========================================================
   v10.14.0 협력학교 마스터 (학교 정식 엔티티화, 1단계)
   - applicants.school(자유텍스트)는 그대로 유지 — 지원자목록/오늘할일/
     일정관리/면접명단표/입사통계/기존 Supabase 동기화 전부 안 건드림
   - schools를 별도 저장소로 신설, applicants.schoolId는 추가 필드로만 붙임
   - schoolId가 비어있어도 기존 6개 기능은 예전과 완전히 동일하게 동작함
   ========================================================= */
/* v10.35.0: 학교 구분(type) 표준화 — 공통 정규화 함수
   표준: 고등학교 / 전문대 / 대학교 / 기타
   미인식 값은 임의로 "기타"로 바꾸지 않고 빈 값으로 남겨 검토 대상으로 표시 */
function normalizeSchoolType(type){
  const t = String(type||'').trim();
  if(t==='고등학교') return '고등학교';
  if(['전문대','전문대학교','전문대학','폴리텍','직업학교','직업전문학교','기능대학','전문교육기관'].includes(t)) return '전문대';
  if(['대학교','4년제','4년제대학교'].includes(t)) return '대학교';
  if(t==='기타') return '기타';
  return '';
}
function normalizeSchool(s){
  return {
    id: s.id || uid(),
    name: (s.name||'').trim(),
    type: normalizeSchoolType(s.type),
    aliases: Array.isArray(s.aliases) ? s.aliases.map(x=>String(x||'').trim()).filter(Boolean) : String(s.aliases||'').split(',').map(x=>x.trim()).filter(Boolean),
    region: s.region||'', contact: s.contact||'', contactPhone: s.contactPhone||'', mouDate: s.mouDate||'', notes: s.notes||'',
    managementStatus: s.managementStatus||'',
    lastContactDate: s.lastContactDate||'', nextContactDate: s.nextContactDate||'', lastRequestNote: s.lastRequestNote||'',
    hrStats: s.hrStats ? {
      activeCount: s.hrStats.activeCount||0, retiredCount: s.hrStats.retiredCount||0,
      avgTenureMonths: s.hrStats.avgTenureMonths ?? null, under12MonthRate: s.hrStats.under12MonthRate ?? null,
      under24MonthRate: s.hrStats.under24MonthRate ?? null, disciplineRate: s.hrStats.disciplineRate ?? null,
      updatedAt: s.hrStats.updatedAt||''
    } : null,
    createdAt: s.createdAt || new Date().toISOString(), updatedAt: s.updatedAt||''
  };
}
function loadSchools(){
  try{
    const raw = localStorage.getItem(SCHOOLS_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.map(normalizeSchool) : [];
  }catch(e){ console.error('학교마스터 load error', e); return []; }
}
function saveSchools(){
  localStorage.setItem(SCHOOLS_KEY, JSON.stringify(schools));
  supabaseSyncSchools(schools);
  populateSchoolDatalist();
  renderSchoolManage();
  renderSchools();
}
function supabaseSyncSchools(list){
  if(!canUseCloud()) return;
  window.sb.from('schools').upsert(list).then(function(res){
    if(!res || !res.error) return;
    const msg=String(res.error.message||'');
    if(msg.includes('managementStatus')){
      const safeList=list.map(({managementStatus, ...rest})=>rest);
      console.warn('Supabase schools 테이블에 managementStatus 컬럼이 없어 관리상태를 제외하고 재저장합니다. 로컬에는 정상 보존됩니다. v10.32.0 SQL 파일을 적용하면 클라우드에도 동기화됩니다.');
      return window.sb.from('schools').upsert(safeList).then(function(retry){
        if(retry && retry.error) console.warn('학교마스터 Supabase 저장 실패(로컬엔 정상 저장됨):', retry.error.message);
      });
    }
    console.warn('학교마스터 Supabase 저장 실패(로컬엔 정상 저장됨):', msg);
  }).catch(function(e){ console.warn('학교마스터 Supabase 저장 실패(로컬엔 정상 저장됨):', e); });
}
function supabaseDeleteSchool(id){
  if(!canUseCloud()) return;
  window.sb.from('schools').delete().eq('id', id).then(function(res){
    if(res && res.error) console.warn('학교마스터 삭제 실패(로컬엔 정상 삭제됨):', res.error.message);
  }).catch(function(e){ console.warn('학교마스터 삭제 실패(로컬엔 정상 삭제됨):', e); });
}
function supabaseSchoolsSyncOnLoad(){
  if(!canUseCloud()) return;
  window.sb.from('schools').select('*').then(function(res){
    if(res && res.error){ console.warn('학교마스터 불러오기 실패, 로컬 데이터로 계속 진행:', res.error.message); return; }
    const cloud = (res && res.data) ? res.data.map(normalizeSchool) : [];
    const local = schools;
    const map = {};
    local.forEach(function(s){ map[s.id] = s; });
    cloud.forEach(function(c){
      const l = map[c.id];
      if(!l){ map[c.id] = c; return; }
      const lt = l.updatedAt || l.createdAt || '';
      const ct = c.updatedAt || c.createdAt || '';
      map[c.id] = (ct > lt) ? c : l;
    });
    schools = Object.keys(map).map(function(k){ return map[k]; });
    localStorage.setItem(SCHOOLS_KEY, JSON.stringify(schools));
    populateSchoolDatalist(); renderSchoolManage(); renderSchools();
  }).catch(function(e){ console.warn('학교마스터 Supabase 연결 실패, 로컬 데이터로 계속 진행:', e); });
}
function findSchoolByText(text){
  const t = String(text||'').trim().toLowerCase();
  if(!t) return null;
  return schools.find(s => s.name.trim().toLowerCase()===t || (s.aliases||[]).some(a=>a.trim().toLowerCase()===t)) || null;
}
function resolveSchoolId(text){ const s=findSchoolByText(text); return s ? s.id : ''; }
function populateSchoolDatalist(){
  const dl=$('schoolDatalist');
  if(!dl) return;
  const values=new Set();
  schools.forEach(s=>{
    if(s.name) values.add(s.name);
    (s.aliases||[]).forEach(a=>{ if(a) values.add(a); });
  });
  dl.innerHTML = Array.from(values).map(v=>`<option value="${esc(v)}"></option>`).join('');
}
/* =========================================================
   v10.16.0 유사 학교명 힌트
   - 정확히 일치하는 학교/별칭이 없을 때, 앞부분이 비슷한 등록 학교가
     있으면 "혹시 이 학교인가요?" 힌트만 보여줌 (자동 병합은 절대 안 함)
   - "예"를 누르면 그 자리에서 별칭으로 추가하고 학교명을 정식 명칭으로 맞춰줌
   - "아니요"를 누르면 그냥 닫히고 입력한 텍스트 그대로 진행 (표기 정리에서 나중에 처리 가능)
   ========================================================= */
function schoolPrefixSimilarity(a,b){
  const ta=String(a||'').trim(), tb=String(b||'').trim();
  let i=0;
  while(i<ta.length && i<tb.length && ta[i]===tb[i]) i++;
  return i;
}
function findSimilarSchools(text){
  const t=String(text||'').trim();
  if(t.length<2 || findSchoolByText(t)) return [];
  return schools.filter(s=>{
    return [s.name, ...(s.aliases||[])].some(n=>{
      const p=schoolPrefixSimilarity(t, n);
      return p>=2 && p>=Math.min(t.length, n.length)*0.5;
    });
  });
}
function renderSchoolSimilarHintFor(inputId, hintId){
  const el=$(hintId);
  const input=$(inputId);
  if(!el || !input) return;
  const candidates=findSimilarSchools(input.value);
  if(!candidates.length){ el.style.display='none'; el.innerHTML=''; return; }
  el.style.display='flex';
  el.innerHTML = candidates.slice(0,2).map(s=>`<span>혹시 <strong>${esc(s.name)}</strong>을(를) 말씀하시는 건가요?</span><button type="button" class="mini" onclick="acceptSchoolHint('${s.id}','${inputId}','${hintId}')">예, 맞아요</button><button type="button" class="mini" onclick="dismissSchoolHintFor('${hintId}')">아니요</button>`).join('');
}
function renderSchoolSimilarHint(){ renderSchoolSimilarHintFor('school','schoolSimilarHint'); }
function acceptSchoolHint(schoolId, inputId, hintId){
  const s=schools.find(x=>x.id===schoolId);
  const input=$(inputId||'school');
  if(!s || !input) return;
  const typed=input.value.trim();
  if(typed && typed.toLowerCase()!==s.name.toLowerCase() && !(s.aliases||[]).some(a=>a.toLowerCase()===typed.toLowerCase())){
    s.aliases=[...(s.aliases||[]), typed];
    s.updatedAt=new Date().toISOString();
    saveSchools();
  }
  input.value=s.name;
  dismissSchoolHintFor(hintId||'schoolSimilarHint');
}
function dismissSchoolHintFor(hintId){
  const el=$(hintId||'schoolSimilarHint');
  if(el){ el.style.display='none'; el.innerHTML=''; }
}
function dismissSchoolHint(){ dismissSchoolHintFor('schoolSimilarHint'); }
function schoolApplicantCount(schoolId){ return applicants.filter(a=>a.schoolId===schoolId).length; }
function schoolEmployeeCount(schoolId){ return employees.filter(e=>e.schoolId===schoolId).length; }
function getSchoolForm(){
  return {
    name: ($('schoolNewName')?.value||'').trim(),
    type: $('schoolNewType')?.value||'',
    region: ($('schoolNewRegion')?.value||'').trim(),
    contact: ($('schoolNewContact')?.value||'').trim(),
    contactPhone: ($('schoolNewContactPhone')?.value||'').trim(),
    mouDate: $('schoolNewMou')?.value||'',
    managementStatus: $('schoolNewManagementStatus')?.value||'',
    aliases: ($('schoolNewAliases')?.value||'').trim(),
    notes: ($('schoolNewNotes')?.value||'').trim()
  };
}
function resetSchoolForm(){
  editingSchoolId='';
  ['schoolNewName','schoolNewRegion','schoolNewContact','schoolNewContactPhone','schoolNewMou','schoolNewAliases','schoolNewNotes'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('schoolNewType')) $('schoolNewType').value='';
  if($('schoolNewManagementStatus')) $('schoolNewManagementStatus').value='';
  if($('btnAddSchool')) $('btnAddSchool').textContent='학교 추가';
  if($('btnCancelSchoolEdit')) $('btnCancelSchoolEdit').style.display='none';
  const panel=$('schoolEditPanel');
  if(panel) panel.classList.remove('is-editing');
  if($('schoolFormTitle')) $('schoolFormTitle').textContent='학교 등록';
}
function fillSchoolForm(s){
  if(!s) return;
  editingSchoolId=s.id;
  if($('schoolNewName')) $('schoolNewName').value=s.name;
  if($('schoolNewType')) $('schoolNewType').value=s.type||'';
  if($('schoolNewRegion')) $('schoolNewRegion').value=s.region;
  if($('schoolNewContact')) $('schoolNewContact').value=s.contact;
  if($('schoolNewContactPhone')) $('schoolNewContactPhone').value=s.contactPhone||'';
  if($('schoolNewMou')) $('schoolNewMou').value=s.mouDate;
  if($('schoolNewManagementStatus')) $('schoolNewManagementStatus').value=s.managementStatus||'';
  if($('schoolNewAliases')) $('schoolNewAliases').value=(s.aliases||[]).join(', ');
  if($('schoolNewNotes')) $('schoolNewNotes').value=s.notes;
  if($('btnAddSchool')) $('btnAddSchool').textContent='수정 저장';
  if($('btnCancelSchoolEdit')) $('btnCancelSchoolEdit').style.display='inline-flex';
  if($('schoolFormTitle')) $('schoolFormTitle').textContent='학교 정보 수정';
  const panel=$('schoolEditPanel');
  if(panel){
    panel.classList.add('is-editing');
    panel.scrollIntoView({behavior:'smooth', block:'start'});
  }
  setTimeout(()=>{ if($('schoolNewName')) $('schoolNewName').focus({preventScroll:true}); }, 350);
}
function submitSchoolForm(){
  const f=getSchoolForm();
  if(!f.name){ alert('학교명을 입력해주세요.'); return; }
  const dup=schools.find(s=>s.id!==editingSchoolId && s.name.trim().toLowerCase()===f.name.toLowerCase());
  if(dup){ alert('이미 같은 이름의 학교가 있습니다. 별칭으로 추가하려면 "표기 정리"를 이용해주세요.'); return; }
  if(editingSchoolId){
    schools = schools.map(s=>s.id===editingSchoolId ? normalizeSchool({...s, ...f, id:editingSchoolId, updatedAt:new Date().toISOString()}) : s);
  } else {
    schools.unshift(normalizeSchool({...f, id:uid(), createdAt:new Date().toISOString()}));
  }
  resetSchoolForm();
  saveSchools();
}
function editSchoolPrompt(id){
  const s=schools.find(x=>x.id===id);
  if(!s){ alert('학교 정보를 찾지 못했습니다. 화면을 새로고침한 뒤 다시 시도해주세요.'); return; }
  fillSchoolForm(s);
  toggleSchoolRegisterForm(true);
  const panel=$('schoolEditPanel');
  if(panel && panel.scrollIntoView) panel.scrollIntoView({behavior:'smooth', block:'start'});
}
/* =========================================================
   v10.18.0 학교 JSON 일괄 가져오기
   - 이름(대소문자 무시) 기준으로 안전 병합: 이미 있는 학교면 별칭만 합쳐서
     보강하고, 없는 학교면 새로 추가. 기존 학교는 절대 지우거나 덮어쓰지 않음
   ========================================================= */
function importSchoolsJson(list){
  if(!Array.isArray(list) || !list.length){ alert('학교 목록 JSON 형식이 아니거나 비어 있습니다.'); return; }
  let added=0, enriched=0, unrecognizedType=0;
  list.forEach(raw=>{
    const incoming=normalizeSchool(raw);
    if(!incoming.name) return;
    if(!incoming.type && String(raw.type||'').trim()) unrecognizedType++;
    const candidateTexts=[incoming.name, ...(incoming.aliases||[])];
    let existing=null;
    for(const t of candidateTexts){ existing=findSchoolByText(t); if(existing) break; }
    if(!existing){
      const created=normalizeSchool({...incoming, id:uid(), createdAt:new Date().toISOString()});
      schools.push(created);
      added++;
      return;
    }
    let changed=false;
    const addAlias=(a)=>{
      if(a && a.trim().toLowerCase()!==existing.name.trim().toLowerCase() && !existing.aliases.some(x=>x.toLowerCase()===a.toLowerCase())){
        existing.aliases=[...existing.aliases, a]; changed=true;
      }
    };
    if(incoming.name.trim().toLowerCase()!==existing.name.trim().toLowerCase()) addAlias(incoming.name);
    (incoming.aliases||[]).forEach(addAlias);
    if(!existing.type && incoming.type){ existing.type=incoming.type; changed=true; }
    if(!existing.region && incoming.region){ existing.region=incoming.region; changed=true; }
    if(!existing.contact && incoming.contact){ existing.contact=incoming.contact; changed=true; }
    if(!existing.contactPhone && incoming.contactPhone){ existing.contactPhone=incoming.contactPhone; changed=true; }
    if(!existing.mouDate && incoming.mouDate){ existing.mouDate=incoming.mouDate; changed=true; }
    if(!existing.managementStatus && incoming.managementStatus){ existing.managementStatus=incoming.managementStatus; changed=true; }
    if(!existing.notes && incoming.notes){ existing.notes=incoming.notes; changed=true; }
    if(changed){ existing.updatedAt=new Date().toISOString(); enriched++; }
  });
  saveSchools();
  const typeNote = unrecognizedType ? ` (구분값 미인식 ${unrecognizedType}건 — 빈 값으로 저장되어 검토 필요)` : '';
  alert(`학교 가져오기 완료: 신규 ${added}개교 추가, 기존 ${enriched}개교 보강 (별칭/구분 등). 기존 학교는 지워지지 않았습니다.${typeNote}`);
}
/* =========================================================
   v10.19.0 학교 HR 통계(재직·무사고) 가져오기 — 2단계 KPI
   - 사원명부에서 개인정보는 전혀 담지 않고 학교 단위로 집계한 통계만 반영
   - schoolName(또는 별칭) 기준으로 기존 학교를 찾아 hrStats만 갱신(최신 값으로 덮어씀)
   - 매칭되는 학교가 없으면 건너뜀(새 학교를 함부로 만들지 않음 — 먼저 학교 가져오기로 등록 필요)
   ========================================================= */
function importSchoolHrStats(list){
  if(!Array.isArray(list) || !list.length){ alert('HR 통계 JSON 형식이 아니거나 비어 있습니다.'); return; }
  let updated=0, skipped=0;
  list.forEach(row=>{
    const name=row.schoolName||row.school||'';
    const target=findSchoolByText(name);
    if(!target){ skipped++; return; }
    target.hrStats={
      activeCount: row.activeCount||0, retiredCount: row.retiredCount||0,
      avgTenureMonths: row.avgTenureMonths ?? null, under12MonthRate: row.under12MonthRate ?? null,
      under24MonthRate: row.under24MonthRate ?? null, disciplineRate: row.disciplineRate ?? null,
      updatedAt: new Date().toISOString()
    };
    target.updatedAt=new Date().toISOString();
    updated++;
  });
  saveSchools();
  alert(`HR 통계 반영 완료: ${updated}개교 갱신, ${skipped}개교는 등록된 학교와 매칭이 안 돼 건너뜀(먼저 학교 등록 필요). 개인정보는 전혀 저장되지 않았습니다.`);
}
function deleteSchool(id){
  const s=schools.find(x=>x.id===id);
  if(!s) return;
  const n=schoolApplicantCount(id);
  if(!confirm(`"${s.name}" 학교를 삭제할까요?${n?`\n(이 학교로 연결된 지원자 ${n}명은 삭제되지 않고, schoolId만 다시 비워집니다.)`:''}`)) return;
  schools = schools.filter(x=>x.id!==id);
  applicants = applicants.map(a=>a.schoolId===id ? {...a, schoolId:''} : a);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseDeleteSchool(id);
  if(editingSchoolId===id) resetSchoolForm();
  saveSchools();
  renderTable();
}
function unmatchedSchoolTexts(){
  const map={};
  applicants.forEach(a=>{
    const text=String(a.school||'').trim();
    if(!text) return;
    if(findSchoolByText(text)) return;
    if(!map[text]) map[text]=0;
    map[text]++;
  });
  employees.forEach(e=>{
    const text=String(e.school||'').trim();
    if(!text) return;
    if(findSchoolByText(text)) return;
    if(!map[text]) map[text]=0;
    map[text]++;
  });
  return Object.keys(map).sort((a,b)=>map[b]-map[a]).map(text=>({text, count:map[text]}));
}
function schoolOptionsHtml(){
  return schools.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
}
function renderSchoolUnmatched(){
  const el=$('schoolUnmatchedList');
  if(!el) return;
  const empWithSchool=employees.filter(e=>String(e.school||'').trim());
  const empConnected=empWithSchool.filter(e=>e.schoolId).length;
  const appWithSchool=applicants.filter(a=>String(a.school||'').trim());
  const appConnected=appWithSchool.filter(a=>a.schoolId).length;
  setText('schoolCoverageStat', `직원 연결 ${empConnected}/${empWithSchool.length}명 · 지원자 연결 ${appConnected}/${appWithSchool.length}명`);
  const rows=unmatchedSchoolTexts();
  if(!rows.length){ el.innerHTML=`<div class="empty">정리할 항목이 없습니다. 모든 지원자의 출신학교가 등록된 학교와 매칭돼 있어요.</div>`; return; }
  el.innerHTML=rows.map(r=>`<div class="person-card compact-person-card">
    <div><strong>${esc(r.text)}</strong><small>${r.count}명이 이렇게 적었어요</small></div>
    <div class="row-actions">
      <select class="wide-select" id="mergeTarget_${esc(uidSafe(r.text))}">
        <option value="">기존 학교에 합치기…</option>
        ${schoolOptionsHtml()}
      </select>
      <button class="mini" onclick="mergeUnmatchedText('${escJs(r.text)}')">합치기</button>
      <button class="mini" onclick="createSchoolFromText('${escJs(r.text)}')">새 학교로 등록</button>
    </div>
  </div>`).join('');
}
function uidSafe(text){ return String(text).replace(/[^a-zA-Z0-9가-힣]/g,'_'); }
function escJs(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
function mergeUnmatchedText(text){
  const sel=$('mergeTarget_'+uidSafe(text));
  const targetId=sel ? sel.value : '';
  if(!targetId){ alert('합칠 기존 학교를 선택해주세요.'); return; }
  const target=schools.find(s=>s.id===targetId);
  if(!target) return;
  if(!target.aliases.some(a=>a.trim().toLowerCase()===text.trim().toLowerCase())){
    target.aliases=[...target.aliases, text];
  }
  target.updatedAt=new Date().toISOString();
  applicants = applicants.map(a=>String(a.school||'').trim()===text ? {...a, schoolId:targetId} : a);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseSyncAll(applicants);
  employees = employees.map(e=>String(e.school||'').trim()===text ? {...e, schoolId:targetId} : e);
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  supabaseSyncEmployees(employees);
  saveSchools();
  renderTable();
  renderEmployees();
}
function createSchoolFromText(text){
  if(!confirm(`"${text}"을(를) 새 학교로 등록할까요?`)) return;
  const s=normalizeSchool({name:text, id:uid(), createdAt:new Date().toISOString()});
  schools.unshift(s);
  applicants = applicants.map(a=>String(a.school||'').trim()===text ? {...a, schoolId:s.id} : a);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseSyncAll(applicants);
  employees = employees.map(e=>String(e.school||'').trim()===text ? {...e, schoolId:s.id} : e);
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  supabaseSyncEmployees(employees);
  saveSchools();
  renderTable();
  renderEmployees();
}
function viewSchoolApplicants(schoolId, fallbackText){
  resetListFiltersToAll();
  if(schoolId){ currentSchoolFilterId=schoolId; }
  else { currentSearch=fallbackText||''; if($('searchInput')) $('searchInput').value=currentSearch; }
  setPage('applicants');
}
const SCHOOL_MANAGEMENT_STATUSES=['신규 발굴','연락 예정','협의 중','협력 중','휴면','관리 제외'];
function schoolManagementStatusLabel(status){ return SCHOOL_MANAGEMENT_STATUSES.includes(status) ? status : '미지정'; }
function schoolManagementStatusClass(status){
  const map={'신규 발굴':'new','연락 예정':'planned','협의 중':'discussion','협력 중':'active','휴면':'dormant','관리 제외':'excluded'};
  return map[status]||'unset';
}
/* v10.36.5: 협력학교 관리 탭 UI 개선 — 학교구분 배지, KPI 카드, 등록폼 접기/펼치기 */
function schoolTypeBadgeClass(type){
  const t = normalizeSchoolType(type);
  const map = {'고등학교':'type-high','전문대':'type-college','대학교':'type-univ','기타':'type-etc'};
  return map[t] || 'type-unset';
}
function schoolTypeBadge(type){
  const t = normalizeSchoolType(type);
  return `<span class="school-type-badge ${schoolTypeBadgeClass(type)}">${esc(t || '미분류')}</span>`;
}
function schoolNeedsAttention(s){
  return !schoolManagementStatusLabel(s.managementStatus) || schoolManagementStatusLabel(s.managementStatus)==='미지정' || !schoolHasManagementHistory(s);
}
function renderSchoolManageKpis(){
  if(!$('schoolKpiTotal')) return;
  setText('schoolKpiTotal', schools.length);
  setText('schoolKpiHigh', schools.filter(s=>normalizeSchoolType(s.type)==='고등학교').length);
  setText('schoolKpiCollege', schools.filter(s=>normalizeSchoolType(s.type)==='전문대').length);
  setText('schoolKpiUniv', schools.filter(s=>normalizeSchoolType(s.type)==='대학교').length);
  setText('schoolKpiEmployed', schools.filter(s=>schoolEmployeeCount(s.id)>0).length);
  setText('schoolKpiNeedsAttention', schools.filter(schoolNeedsAttention).length);
}
function applySchoolKpiFilter(kpi){
  document.querySelectorAll('#schoolManageKpiGrid .school-kpi-card').forEach(b=>b.classList.toggle('active', b.dataset.kpi===kpi));
  schoolManagePage = 1;
  if(kpi==='all'){
    schoolManageTypeFilter='all'; schoolManageHasEmployees=false; schoolManageMissingHistory=false;
  } else if(kpi==='고등학교' || kpi==='전문대' || kpi==='대학교'){
    schoolManageTypeFilter = (kpi==='고등학교') ? '고등학교' : '대학교'; // 랭킹과 동일하게 전문대/대학교는 '대학교' 그룹
    schoolManageHasEmployees=false; schoolManageMissingHistory=false;
  } else if(kpi==='employed'){
    schoolManageTypeFilter='all'; schoolManageHasEmployees=true; schoolManageMissingHistory=false;
  } else if(kpi==='needs-attention'){
    schoolManageTypeFilter='all'; schoolManageHasEmployees=false; schoolManageMissingHistory=true;
  }
  if($('schoolManageHasEmployees')) $('schoolManageHasEmployees').checked = schoolManageHasEmployees;
  if($('schoolManageMissingHistory')) $('schoolManageMissingHistory').checked = schoolManageMissingHistory;
  document.querySelectorAll('#schoolManageTypeTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.schoolmanagetype===schoolManageTypeFilter));
  renderSchoolManage();
}
function toggleSchoolRegisterForm(forceOpen){
  const body = $('schoolEditPanelBody');
  const btn = $('btnToggleSchoolEditPanel');
  const panel = $('schoolEditPanel');
  if(!body) return;
  const currentlyOpen = body.style.display !== 'none';
  const shouldOpen = forceOpen !== undefined ? !!forceOpen : !currentlyOpen;
  body.style.display = shouldOpen ? '' : 'none';
  if(panel) panel.classList.toggle('is-collapsed', !shouldOpen);
  if(btn){
    btn.setAttribute('aria-expanded', String(shouldOpen));
    btn.textContent = shouldOpen ? '접기 ▴' : '닫기';
  }
}
function schoolManagementStatusBadge(status){
  return `<span class="school-status-badge ${schoolManagementStatusClass(status)}">${esc(schoolManagementStatusLabel(status))}</span>`;
}
function schoolHasManagementHistory(s){
  return !!String(s?.lastContactDate||'').trim() || !!String(s?.nextContactDate||'').trim() || !!String(s?.lastRequestNote||'').trim();
}
function schoolManageFilterSummary(){
  const labels=[];
  if(schoolManageSearch) labels.push(`학교명 “${schoolManageSearch}”`);
  if(schoolManageRegionFilter!=='all') labels.push(`지역 ${schoolManageRegionFilter}`);
  if(schoolManageTypeFilter!=='all') labels.push(`구분 ${schoolManageTypeFilter}`);
  if(schoolManageContactFilter==='yes') labels.push('담당자 등록');
  if(schoolManageContactFilter==='no') labels.push('담당자 미등록');
  if(schoolManageMouFilter==='yes') labels.push('MOU 체결');
  if(schoolManageMouFilter==='no') labels.push('MOU 미체결');
  if(schoolManageStatusFilter!=='all') labels.push(`관리상태 ${schoolManagementStatusLabel(schoolManageStatusFilter)}`);
  if(schoolManageHasApplicants) labels.push('지원자 있음');
  if(schoolManageHasEmployees) labels.push('직원 있음');
  if(schoolManageMissingHistory) labels.push('관리이력 미등록');
  return labels;
}
function schoolManageCompare(a,b){
  let av='', bv='';
  if(schoolManageSort==='region'){ av=String(a.region||''); bv=String(b.region||''); }
  else if(schoolManageSort==='type'){ av=schoolTypeGroupDetail(a.type); bv=schoolTypeGroupDetail(b.type); }
  else if(schoolManageSort==='status'){ av=schoolManagementStatusLabel(a.managementStatus); bv=schoolManagementStatusLabel(b.managementStatus); }
  else if(schoolManageSort==='applicant'){ av=schoolApplicantCount(a.id); bv=schoolApplicantCount(b.id); }
  else if(schoolManageSort==='employee'){ av=schoolEmployeeCount(a.id); bv=schoolEmployeeCount(b.id); }
  else { av=String(a.name||''); bv=String(b.name||''); }
  let result;
  if(typeof av==='number' && typeof bv==='number') result=av-bv;
  else result=String(av).localeCompare(String(bv),'ko',{numeric:true,sensitivity:'base'});
  if(result===0 && schoolManageSort!=='name') result=String(a.name||'').localeCompare(String(b.name||''),'ko');
  return schoolManageSortDirection==='desc' ? -result : result;
}
function schoolManageSortIcon(key){
  if(schoolManageSort!==key) return '<span class="sort-mark">↕</span>';
  return `<span class="sort-mark active">${schoolManageSortDirection==='asc'?'↑':'↓'}</span>`;
}
function setSchoolManageSort(key){
  if(schoolManageSort===key) schoolManageSortDirection=schoolManageSortDirection==='asc'?'desc':'asc';
  else { schoolManageSort=key; schoolManageSortDirection=(key==='applicant'||key==='employee')?'desc':'asc'; }
  schoolManagePage=1;
  if($('schoolManageSort')) $('schoolManageSort').value=schoolManageSort;
  renderSchoolManage();
}
function setSchoolManagePage(page){
  schoolManagePage=Math.max(1,Number(page)||1);
  renderSchoolManage();
}
function toggleSchoolManageFilters(){
  schoolManageFiltersCollapsed=!schoolManageFiltersCollapsed;
  const panel=$('schoolFilterContent');
  const btn=$('btnToggleSchoolFilters');
  if(panel) panel.hidden=schoolManageFiltersCollapsed;
  if(btn){ btn.setAttribute('aria-expanded',String(!schoolManageFiltersCollapsed)); btn.innerHTML=schoolManageFiltersCollapsed?'필터 펼치기 ▾':'필터 접기 ▴'; }
}
function renderSchoolManage(){
  refreshSchoolManageRegionOptions();
  renderSchoolManageKpis();
  const body=$('schoolManageBody');
  if(!body) return;
  const q=String(schoolManageSearch||'').trim().toLowerCase();
  let list=[...schools].filter(s=>{
    if(q){
      const hay=[s.name, ...(s.aliases||[])].join(' ').toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(schoolManageTypeFilter!=='all' && schoolTypeGroup(s.type)!==schoolManageTypeFilter) return false;
    if(schoolManageRegionFilter!=='all' && String(s.region||'').trim()!==schoolManageRegionFilter) return false;
    const hasContact=!!String(s.contact||'').trim();
    if(schoolManageContactFilter==='yes' && !hasContact) return false;
    if(schoolManageContactFilter==='no' && hasContact) return false;
    const hasMou=!!String(s.mouDate||'').trim();
    if(schoolManageMouFilter==='yes' && !hasMou) return false;
    if(schoolManageMouFilter==='no' && hasMou) return false;
    if(schoolManageStatusFilter!=='all' && String(s.managementStatus||'')!==schoolManageStatusFilter) return false;
    if(schoolManageHasApplicants && schoolApplicantCount(s.id)<1) return false;
    if(schoolManageHasEmployees && schoolEmployeeCount(s.id)<1) return false;
    if(schoolManageMissingHistory && schoolHasManagementHistory(s)) return false;
    if(schoolManageUnclassifiedFilter && normalizeSchoolType(s.type)) return false;
    return true;
  });
  list.sort(schoolManageCompare);
  const totalFiltered=list.length;
  const totalPages=Math.max(1,Math.ceil(totalFiltered/schoolManagePageSize));
  if(schoolManagePage>totalPages) schoolManagePage=totalPages;
  const startIndex=(schoolManagePage-1)*schoolManagePageSize;
  const pageList=list.slice(startIndex,startIndex+schoolManagePageSize);
  const filterLabels=schoolManageFilterSummary();
  setText('schoolManageCount', `${totalFiltered}개교${filterLabels.length?` / 전체 ${schools.length}개교`:''}`);
  const summary=$('schoolManageFilterSummary');
  if(summary){
    summary.innerHTML=filterLabels.length
      ? `<span class="school-filter-summary-label">적용 중 ${filterLabels.length}개</span>${filterLabels.map(x=>`<span class="school-filter-chip">${esc(x)}</span>`).join('')}`
      : '<span class="muted">검색 조건 없이 전체 학교를 표시하고 있습니다.</span>';
  }
  const thead=$('schoolManageHead');
  if(thead) thead.innerHTML=`<tr>
    <th class="sticky-col sticky-left"><button class="table-sort-btn" onclick="setSchoolManageSort('name')">학교명 ${schoolManageSortIcon('name')}</button></th>
    <th><button class="table-sort-btn" onclick="setSchoolManageSort('type')">구분 ${schoolManageSortIcon('type')}</button></th>
    <th><button class="table-sort-btn" onclick="setSchoolManageSort('status')">관리상태 ${schoolManageSortIcon('status')}</button></th>
    <th><button class="table-sort-btn" onclick="setSchoolManageSort('region')">지역 ${schoolManageSortIcon('region')}</button></th>
    <th>담당자</th><th>MOU일</th>
    <th><button class="table-sort-btn" onclick="setSchoolManageSort('applicant')">지원자 ${schoolManageSortIcon('applicant')}</button></th>
    <th><button class="table-sort-btn" onclick="setSchoolManageSort('employee')">직원 ${schoolManageSortIcon('employee')}</button></th>
    <th class="sticky-col sticky-right">관리</th></tr>`;
  body.innerHTML = pageList.length ? pageList.map(s=>{
    const schoolAlias=(s.aliases||[]).filter(Boolean).slice(0,2).join(' · ');
    const schoolMeta=schoolAlias ? `별칭 ${schoolAlias}` : (s.region ? `지역 ${s.region}` : '등록된 기본 정보 확인');
    const contactLine=String(s.contact||'').trim() || '담당자 미등록';
    const mouLine=String(s.mouDate||'').trim() || '미체결';
    return `<tr class="school-manage-row clickable-data-row" tabindex="0" onclick="if(!event.target.closest('button,select,a,input,label,summary,details')) openSchoolDetail('${s.id}')" onkeydown="listRowKeyActivate(event,()=>openSchoolDetail('${s.id}'))">
      <td class="sticky-col sticky-left school-name-cell" data-label="학교명" title="${esc(s.name)}"><button class="link-like school-name-link" onclick="openSchoolDetail('${s.id}')">${esc(s.name)}</button><small class="school-name-sub">${esc(schoolMeta)}</small></td>
      <td class="school-type-cell" data-label="구분">${schoolTypeBadge(s.type)}</td>
      <td class="school-status-cell" data-label="관리상태">${schoolManagementStatusBadge(s.managementStatus)}</td>
      <td class="school-region-cell" data-label="지역"><span class="school-inline-value">${esc(s.region)||'-'}</span></td>
      <td class="school-contact-cell" data-label="담당자"><div class="school-inline-stack"><strong>${esc(contactLine)}</strong><small>${String(s.contactPhone||'').trim()?esc(s.contactPhone):'연락처 미등록'}</small></div></td>
      <td class="school-mou-cell" data-label="MOU일"><div class="school-inline-stack"><strong>${esc(mouLine)}</strong><small>${String(s.mouDate||'').trim()?'체결일 등록':'일정 없음'}</small></div></td>
      <td class="school-applicant-cell" data-label="지원자"><button class="count-pill" onclick="viewSchoolApplicants('${s.id}')">${schoolApplicantCount(s.id)}명</button></td>
      <td class="school-employee-cell" data-label="직원"><button class="count-pill employee" onclick="viewSchoolEmployees('${s.id}','${escJs(s.name)}')">${schoolEmployeeCount(s.id)}명</button></td>
      <td class="row-actions sticky-col sticky-right school-row-actions" data-label="관리"><button class="school-action-btn edit" onclick="editSchoolPrompt('${s.id}')">수정</button><div class="row-more-menu"><button type="button" class="row-more-toggle" onclick="toggleRowMore(event,this)">더보기</button><div class="row-more-menu-panel"><button class="school-action-btn delete" onclick="deleteSchool('${s.id}')">삭제</button></div></div></td>
    </tr>`;
  }).join('') : `<tr><td colspan="9" class="empty school-empty-state"><strong>조건에 맞는 학교가 없습니다.</strong><span>검색어 또는 필터를 바꾸거나 검색조건을 초기화해 주세요.</span><button type="button" class="ghost" onclick="resetSchoolManageFilters()">검색조건 초기화</button></td></tr>`;
  const pager=$('schoolManagePagination');
  if(pager){
    const first=totalFiltered?startIndex+1:0;
    const last=Math.min(startIndex+schoolManagePageSize,totalFiltered);
    pager.innerHTML=`<div class="school-page-summary">${first}-${last} / ${totalFiltered}개교</div>
      <div class="school-page-controls">
        <button type="button" ${schoolManagePage<=1?'disabled':''} onclick="setSchoolManagePage(1)">처음</button>
        <button type="button" ${schoolManagePage<=1?'disabled':''} onclick="setSchoolManagePage(${schoolManagePage-1})">이전</button>
        <span><strong>${schoolManagePage}</strong> / ${totalPages}</span>
        <button type="button" ${schoolManagePage>=totalPages?'disabled':''} onclick="setSchoolManagePage(${schoolManagePage+1})">다음</button>
        <button type="button" ${schoolManagePage>=totalPages?'disabled':''} onclick="setSchoolManagePage(${totalPages})">마지막</button>
      </div>`;
  }
  const panel=$('schoolFilterContent');
  const btn=$('btnToggleSchoolFilters');
  if(panel) panel.hidden=schoolManageFiltersCollapsed;
  if(btn){ btn.setAttribute('aria-expanded',String(!schoolManageFiltersCollapsed)); btn.innerHTML=schoolManageFiltersCollapsed?'필터 펼치기 ▾':'필터 접기 ▴'; }
  renderSchoolUnmatched();
}
function resetSchoolManageFilters(){
  schoolManageSearch='';
  schoolManageRegionFilter='all';
  schoolManageTypeFilter='all';
  schoolManageContactFilter='all';
  schoolManageMouFilter='all';
  schoolManageStatusFilter='all';
  schoolManageHasApplicants=false;
  schoolManageHasEmployees=false;
  schoolManageMissingHistory=false;
  schoolManageUnclassifiedFilter=false;
  schoolManagePage=1;
  if($('schoolManageSearch')) $('schoolManageSearch').value='';
  if($('schoolManageRegion')) $('schoolManageRegion').value='all';
  if($('schoolManageContact')) $('schoolManageContact').value='all';
  if($('schoolManageMou')) $('schoolManageMou').value='all';
  if($('schoolManageStatus')) $('schoolManageStatus').value='all';
  if($('schoolManageHasApplicants')) $('schoolManageHasApplicants').checked=false;
  if($('schoolManageHasEmployees')) $('schoolManageHasEmployees').checked=false;
  if($('schoolManageMissingHistory')) $('schoolManageMissingHistory').checked=false;
  if($('schoolManageUnclassified')) $('schoolManageUnclassified').checked=false;
  document.querySelectorAll('#schoolManageTypeTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.schoolmanagetype==='all'));
  document.querySelectorAll('#schoolManageKpiGrid .school-kpi-card').forEach(b=>b.classList.toggle('active', b.dataset.kpi==='all'));
  renderSchoolManage();
}
function refreshSchoolManageRegionOptions(){
  const el=$('schoolManageRegion');
  if(!el) return;
  const current=schoolManageRegionFilter;
  const regions=[...new Set(schools.map(s=>String(s.region||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
  el.innerHTML='<option value="all">지역 전체</option>'+regions.map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
  el.value=regions.includes(current)?current:'all';
  if(el.value==='all') schoolManageRegionFilter='all';
}
function viewSchoolEmployees(schoolId, fallbackText){
  employeeSchoolSearch = fallbackText||'';
  employeeDeptFilter='all'; employeeRoleFilter='all'; employeeSearchName=''; employeeSearchNo=''; employeeStatusFilter='all'; employeePage=1;
  if($('empSearchSchool')) $('empSearchSchool').value=employeeSchoolSearch;
  if($('empSearchName')) $('empSearchName').value='';
  if($('empSearchNo')) $('empSearchNo').value='';
  document.querySelectorAll('#employeeStatusTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.empstatus==='all'));
  setPage('employees');
}
function schoolTypeGroupDetail(type){ return normalizeSchoolType(type); }
