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
    memoHistory: Array.isArray(s.memoHistory)?s.memoHistory:[], contacts: Array.isArray(s.contacts)?s.contacts:[], activities: Array.isArray(s.activities)?s.activities:[],
    recommendationRequests: Array.isArray(s.recommendationRequests)?s.recommendationRequests:[],
    departments: Array.isArray(s.departments)?s.departments:[],
    mouInfo: s.mouInfo && typeof s.mouInfo==='object' ? {
      status:s.mouInfo.status||'', signedDate:s.mouInfo.signedDate||s.mouDate||'', expireDate:s.mouInfo.expireDate||'',
      type:s.mouInfo.type||'', department:s.mouInfo.department||'', owner:s.mouInfo.owner||'', note:s.mouInfo.note||''
    } : {status:s.mouDate?'체결':'',signedDate:s.mouDate||'',expireDate:'',type:'',department:'',owner:'',note:''},
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
    const relationshipColumns=['managementStatus','memoHistory','contacts','activities','recommendationRequests','departments','mouInfo'];
    const missingRelationshipColumn=relationshipColumns.some(col=>msg.includes(col));
    if(missingRelationshipColumn){
      const safeList=list.map(s=>{
        const copy={...s};
        relationshipColumns.forEach(k=>delete copy[k]);
        return copy;
      });
      console.warn('Supabase schools 확장 컬럼이 없어 관계관리 확장정보를 제외하고 재저장합니다. 로컬에는 전체 정보가 보존됩니다. v10.42.0 SQL을 적용하면 클라우드에도 저장됩니다.');
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
  // v10.48.0: 학교가 이미 1,000행을 넘어 Supabase 기본 제한에 걸릴 수 있으므로
  // employees.js·cloud-sync.js(지원자)와 동일한 500건 페이지 재귀 조회로 변경.
  const PAGE_SIZE=500;
  function loadPage(from,collected){
    return window.sb.from('schools').select('*').order('id',{ascending:true}).range(from,from+PAGE_SIZE-1).then(function(res){
      if(res&&res.error) throw new Error(res.error.message);
      const rows=(res&&res.data)?res.data:[];
      const merged=collected.concat(rows);
      return rows.length<PAGE_SIZE?merged:loadPage(from+PAGE_SIZE,merged);
    });
  }
  loadPage(0,[]).then(function(cloudRaw){
    const cloud = cloudRaw.map(normalizeSchool);
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
    console.info('학교마스터 Supabase 페이지 조회 완료: 클라우드 '+cloud.length+'개 -> 병합 후 '+schools.length+'개');
  }).catch(function(e){ console.warn('학교마스터 Supabase 페이지 조회 중 실패 — 기존 로컬 데이터 유지:', e); });
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
function schoolActiveEmployeeCount(schoolId){ return employees.filter(e=>e.schoolId===schoolId && ['재직','재직중','휴직'].includes(String(e.status||'').trim())).length; }
function schoolCumulativeHireCount(schoolId){ return employees.filter(e=>e.schoolId===schoolId).length; }
function schoolLastManagedDate(s){ const activityDates=(Array.isArray(s.activities)?s.activities:[]).map(x=>x.date||x.createdAt||''); const memoDates=(Array.isArray(s.memoHistory)?s.memoHistory:[]).map(x=>x.createdAt||''); return [s.lastContactDate,...activityDates,...memoDates,s.updatedAt,s.createdAt].filter(Boolean).sort().reverse()[0]||''; }
function schoolIsRecentlyManaged(s,days=180){ const d=schoolLastManagedDate(s); if(!d)return false; const t=new Date(d); return Number.isFinite(t.getTime()) && (Date.now()-t.getTime())<=days*86400000; }
function schoolHasBrokenLinks(s){
  const byText=[...applicants,...employees].some(x=>!x.schoolId && String(x.school||'').trim() && findSchoolByText(x.school)?.id===s.id);
  return byText;
}
function normalizedSchoolNameKey(v){return String(v||'').toLowerCase().replace(/\s+/g,'').replace(/대학교$/,'대').replace(/전문대학교$/,'전문대');}
function schoolIsDuplicateSuspect(s){const key=normalizedSchoolNameKey(s.name);return schools.some(x=>x.id!==s.id&&normalizedSchoolNameKey(x.name)===key);}
function formatSchoolDate(v){return v?String(v).slice(0,10):'-';}
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
  const s=schools.find(x=>x.id===id); if(!s)return;
  const appCount=schoolApplicantCount(id), empCount=schoolEmployeeCount(id);
  if(appCount||empCount){alert(`연결된 학교는 삭제할 수 없습니다.\n지원자 ${appCount}명 · 사원 ${empCount}명의 schoolId 연결을 먼저 연결 관리에서 확인해 주세요.`);return;}
  if(!confirm(`"${s.name}" 학교를 삭제할까요?\n연결 데이터가 없는 학교만 삭제됩니다.`))return;
  schools=schools.filter(x=>x.id!==id); supabaseDeleteSchool(id); if(editingSchoolId===id)resetSchoolForm(); saveSchools();
}
function schoolLinkTextKey(text){ return String(text||'').trim().toLocaleLowerCase('ko-KR'); }
function schoolHasValidId(entity){ return !!schools.find(s=>String(s.id)===String(entity?.schoolId||'')); }
function schoolExactLinkIndexes(){
  const names=new Map(), aliases=new Map();
  schools.forEach(s=>{
    const nk=schoolLinkTextKey(s.name);
    if(nk){ if(!names.has(nk)) names.set(nk,[]); names.get(nk).push(s); }
    (Array.isArray(s.aliases)?s.aliases:[]).forEach(alias=>{
      const ak=schoolLinkTextKey(alias);
      if(ak){ if(!aliases.has(ak)) aliases.set(ak,[]); aliases.get(ak).push(s); }
    });
  });
  return {names,aliases};
}
function resolveExactSchoolLink(text,indexes=schoolExactLinkIndexes()){
  const key=schoolLinkTextKey(text); if(!key)return {status:'none'};
  const exact=indexes.names.get(key)||[];
  if(exact.length===1)return {status:'exact-name',school:exact[0]};
  if(exact.length>1)return {status:'ambiguous',schools:exact};
  const alias=indexes.aliases.get(key)||[];
  const unique=[...new Map(alias.map(s=>[String(s.id),s])).values()];
  if(unique.length===1)return {status:'exact-alias',school:unique[0]};
  if(unique.length>1)return {status:'ambiguous',schools:unique};
  return {status:'none'};
}
function schoolUnlinkedEntities(){
  const rows=[];
  (Array.isArray(applicants)?applicants:[]).forEach(a=>{if(String(a.school||'').trim()&&!schoolHasValidId(a))rows.push({entityType:'applicant',entity:a});});
  (Array.isArray(employees)?employees:[]).forEach(e=>{if(String(e.school||'').trim()&&!schoolHasValidId(e))rows.push({entityType:'employee',entity:e});});
  return rows;
}
function unmatchedSchoolTexts(){
  const map={};
  schoolUnlinkedEntities().forEach(({entity})=>{
    const text=String(entity.school||'').trim();
    if(!map[text])map[text]=0;
    map[text]++;
  });
  return Object.keys(map).sort((a,b)=>map[b]-map[a]||a.localeCompare(b,'ko')).map(text=>({text,count:map[text]}));
}
function buildSchoolAutoLinkCandidates(){
  const indexes=schoolExactLinkIndexes(), grouped=new Map(), review=new Set();
  schoolUnlinkedEntities().forEach(row=>{
    const text=String(row.entity.school||'').trim();
    const match=resolveExactSchoolLink(text,indexes);
    if(!['exact-name','exact-alias'].includes(match.status)){review.add(text);return;}
    const key=`${row.entityType}:${row.entity.id}:${match.school.id}`;
    grouped.set(key,{key,entityType:row.entityType,entityId:String(row.entity.id),entityName:String(row.entity.name||row.entity.empNo||'이름 없음'),schoolText:text,targetId:String(match.school.id),targetName:String(match.school.name||''),matchType:match.status});
  });
  return {candidates:[...grouped.values()],reviewCount:review.size};
}
let schoolAutoLinkState={candidates:[],selected:new Set(),reviewCount:0,busy:false};
function schoolAutoLinkSafetyBackup(){
  if(window.erpBackupCenter&&typeof window.erpBackupCenter.safetyBackup==='function')return window.erpBackupCenter.safetyBackup('확실한 학교 자동 연결 적용 직전');
  const payload={format:'recruit-erp-backup',appVersion:'10.40.29',createdAt:new Date().toISOString(),reason:'확실한 학교 자동 연결 적용 직전',applicants,schools,employees,calendarEvents};
  download(`Recruit_ERP_학교자동연결전_안전백업_${today()}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
  return payload;
}
function openSchoolAutoLink(){
  const built=buildSchoolAutoLinkCandidates();
  schoolAutoLinkState={candidates:built.candidates,selected:new Set(built.candidates.map(x=>x.key)),reviewCount:built.reviewCount,busy:false};
  if($('schoolAutoLinkConfirm'))$('schoolAutoLinkConfirm').checked=false;
  renderSchoolAutoLink();
  const modal=$('schoolAutoLinkModal'); if(modal){modal.classList.add('show');modal.setAttribute('aria-hidden','false');}
}
function closeSchoolAutoLink(){
  if(schoolAutoLinkState.busy)return;
  const modal=$('schoolAutoLinkModal'); if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');}
}
function renderSchoolAutoLink(){
  const c=schoolAutoLinkState.candidates, selected=schoolAutoLinkState.selected;
  const selectedRows=c.filter(x=>selected.has(x.key));
  setText('schoolAutoLinkCandidateCount',`${c.length}건`);
  setText('schoolAutoLinkApplicantCount',`${c.filter(x=>x.entityType==='applicant').length}명`);
  setText('schoolAutoLinkEmployeeCount',`${c.filter(x=>x.entityType==='employee').length}명`);
  setText('schoolAutoLinkReviewCount',`${schoolAutoLinkState.reviewCount}종`);
  setText('schoolAutoLinkSelectedSummary',`${selectedRows.length}건 선택`);
  const list=$('schoolAutoLinkList');
  if(list)list.innerHTML=c.length?c.map(x=>`<label class="school-auto-link-row"><input type="checkbox" data-school-auto-key="${esc(x.key)}" ${selected.has(x.key)?'checked':''}/><div><strong>${esc(x.entityName)}</strong><span>${x.entityType==='applicant'?'지원자':'사원'} · 입력 학교명: ${esc(x.schoolText)}</span></div><b>→</b><div><strong>${esc(x.targetName)}</strong><span>${x.matchType==='exact-name'?'학교명 정확 일치':'유일 별칭 정확 일치'}</span></div></label>`).join(''):'<div class="empty"><strong>자동 연결 가능한 항목이 없습니다.</strong><span>남은 항목은 직접 확인해 연결해 주세요.</span></div>';
  const apply=$('btnApplySchoolAutoLink');
  if(apply)apply.disabled=!selectedRows.length||!$('schoolAutoLinkConfirm')?.checked||schoolAutoLinkState.busy;
}
function setSchoolAutoLinkSelection(mode){
  schoolAutoLinkState.selected=mode==='all'?new Set(schoolAutoLinkState.candidates.map(x=>x.key)):new Set();
  renderSchoolAutoLink();
}
function applySchoolAutoLink(){
  if(schoolAutoLinkState.busy)return;
  const selected=schoolAutoLinkState.candidates.filter(x=>schoolAutoLinkState.selected.has(x.key));
  if(!selected.length||!$('schoolAutoLinkConfirm')?.checked)return;
  if(!confirm(`선택한 ${selected.length}건을 정확 일치 기준으로 연결할까요?
적용 직전 전체 JSON 안전백업을 다운로드합니다.`))return;
  schoolAutoLinkState.busy=true; const btn=$('btnApplySchoolAutoLink'); if(btn){btn.disabled=true;btn.textContent='연결 중...';}
  try{
    schoolAutoLinkSafetyBackup();
    const appMap=new Map(selected.filter(x=>x.entityType==='applicant').map(x=>[x.entityId,x]));
    const empMap=new Map(selected.filter(x=>x.entityType==='employee').map(x=>[x.entityId,x]));
    applicants=applicants.map(a=>{const row=appMap.get(String(a.id));return row&&!schoolHasValidId(a)?{...a,schoolId:row.targetId}:a;});
    employees=employees.map(e=>{const row=empMap.get(String(e.id));return row&&!schoolHasValidId(e)?{...e,schoolId:row.targetId}:e;});
    localStorage.setItem(STORAGE_KEY,JSON.stringify(applicants));
    localStorage.setItem(EMPLOYEES_KEY,JSON.stringify(employees));
    if(canUseCloud()){supabaseSyncAll(applicants);supabaseSyncEmployees(employees);}
    renderTable();renderEmployees();renderSchoolManage();renderSchoolUnmatched();
    alert(`학교 연결 완료
지원자 ${appMap.size}명 · 사원 ${empMap.size}명`);
    schoolAutoLinkState.busy=false;
    closeSchoolAutoLink();
  }catch(e){console.error('학교 자동 연결 실패',e);alert(`학교 연결 중 오류가 발생했습니다.
${e.message||e}`);}
  finally{schoolAutoLinkState.busy=false;if(btn)btn.textContent='안전백업 후 선택 연결';}
}
function schoolOptionsHtml(){
  return schools.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
}
function renderSchoolUnmatched(){
  const el=$('schoolUnmatchedList');
  if(!el) return;
  const empWithSchool=employees.filter(e=>String(e.school||'').trim());
  const empConnected=empWithSchool.filter(schoolHasValidId).length;
  const appWithSchool=applicants.filter(a=>String(a.school||'').trim());
  const appConnected=appWithSchool.filter(schoolHasValidId).length;
  const rows=unmatchedSchoolTexts();
  setText('schoolCoverageStat', `미연결 표기 ${rows.length}종 · 직원 ${empConnected}/${empWithSchool.length}명 · 지원자 ${appConnected}/${appWithSchool.length}명`);
  const toggle=$('btnToggleSchoolUnmatched');
  if(toggle){
    toggle.textContent=rows.length ? `연결 대상 보기 (${rows.length}) ▾` : '연결 대상 없음';
    toggle.disabled=!rows.length;
  }
  if(!rows.length){ el.innerHTML=`<div class="empty"><strong>학교 연결이 완료되었습니다.</strong><span>학교명이 입력된 지원자와 사원이 등록 학교에 연결되어 있습니다.</span></div>`; return; }
  el.innerHTML=rows.map(r=>`<div class="person-card compact-person-card">
    <div><strong>${esc(r.text)}</strong><small>${r.count}명의 학교명이 아직 schoolId와 연결되지 않았습니다.</small></div>
    <div class="row-actions">
      <select class="wide-select" id="mergeTarget_${esc(uidSafe(r.text))}">
        <option value="">연결할 기존 학교 선택…</option>
        ${schoolOptionsHtml()}
      </select>
      <button class="mini" onclick="mergeUnmatchedText('${escJs(r.text)}')">기존 학교에 연결</button>
      <button class="mini" onclick="createSchoolFromText('${escJs(r.text)}')">새 학교 등록</button>
    </div>
  </div>`).join('');
}
function toggleSchoolUnmatchedPanel(){
  const body=$('schoolUnmatchedBody');
  const btn=$('btnToggleSchoolUnmatched');
  if(!body) return;
  const open=body.hidden;
  body.hidden=!open;
  if(btn){
    const count=unmatchedSchoolTexts().length;
    btn.setAttribute('aria-expanded',String(open));
    btn.textContent=open?`연결 대상 접기 (${count}) ▴`:`연결 대상 보기 (${count}) ▾`;
  }
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
  const next=s.nextContactDate?schoolManageDaysUntil(s.nextContactDate):null;
  return !normalizeSchoolType(s.type) || !String(s.contact||'').trim() || !String(s.contactPhone||'').trim() || schoolManagementStatusLabel(s.managementStatus)==='미지정' || !schoolHasManagementHistory(s) || (next!==null&&next<0) || schoolHasBrokenLinks(s) || schoolIsDuplicateSuspect(s);
}

function renderSchoolManageKpis(){
  if(!$('schoolKpiTotal')) return;
  setText('schoolKpiTotal', schools.length);
  setText('schoolKpiHigh', schools.filter(s=>normalizeSchoolType(s.type)==='고등학교').length);
  setText('schoolKpiCollege', schools.filter(s=>normalizeSchoolType(s.type)==='전문대').length);
  setText('schoolKpiUniv', schools.filter(s=>normalizeSchoolType(s.type)==='대학교').length);
  setText('schoolKpiEtc', schools.filter(s=>normalizeSchoolType(s.type)==='기타').length);
}
function applySchoolKpiFilter(kpi){
  document.querySelectorAll('#schoolManageKpiGrid .school-kpi-card').forEach(b=>b.classList.toggle('active', b.dataset.kpi===kpi));
  schoolManagePage=1;
  schoolManageTypeFilter='all';
  if(['고등학교','전문대','대학교','기타'].includes(kpi)) schoolManageTypeFilter=kpi;
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
  if(schoolManageHasEmployees) labels.push('재직 사원 있음');
  if(window.schoolManageRecentHistory) labels.push('최근 180일 관리');
  if(window.schoolManageBrokenLinks) labels.push('연결 누락 있음');
  if(window.schoolManageDuplicates) labels.push('중복 의심');
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
    if(schoolManageTypeFilter!=='all' && normalizeSchoolType(s.type)!==schoolManageTypeFilter) return false;
    if(schoolManageRegionFilter!=='all' && String(s.region||'').trim()!==schoolManageRegionFilter) return false;
    const hasContact=!!String(s.contact||'').trim();
    if(schoolManageContactFilter==='yes' && !hasContact) return false;
    if(schoolManageContactFilter==='no' && hasContact) return false;
    const hasMou=!!String(s.mouDate||'').trim();
    if(schoolManageMouFilter==='yes' && !hasMou) return false;
    if(schoolManageMouFilter==='no' && hasMou) return false;
    if(schoolManageStatusFilter!=='all' && String(s.managementStatus||'')!==schoolManageStatusFilter) return false;
    if(schoolManageHasApplicants && schoolApplicantCount(s.id)<1) return false;
    if(schoolManageHasEmployees && schoolActiveEmployeeCount(s.id)<1) return false;
    if(window.schoolManageRecentHistory && !schoolIsRecentlyManaged(s)) return false;
    if(window.schoolManageBrokenLinks && !schoolHasBrokenLinks(s)) return false;
    if(window.schoolManageDuplicates && !schoolIsDuplicateSuspect(s)) return false;
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
  if(thead) thead.innerHTML=`<tr><th class="sticky-col sticky-left"><button class="table-sort-btn" onclick="setSchoolManageSort('name')">학교명 ${schoolManageSortIcon('name')}</button></th><th>지역</th><th>구분</th><th>MOU</th><th>담당자</th><th>지원자</th><th>재직 사원</th><th>누적 입사</th><th>최근 관리일</th><th>관리상태</th><th class="sticky-col sticky-right">관리</th></tr>`;
  body.innerHTML = pageList.length ? pageList.map(s=>{
    const schoolAlias=(s.aliases||[]).filter(Boolean).slice(0,2).join(' · ');
    const alerts=[schoolHasBrokenLinks(s)?'연결 누락':'',schoolIsDuplicateSuspect(s)?'중복 의심':''].filter(Boolean);
    return `<tr class="school-manage-row clickable-data-row" tabindex="0" onclick="if(!event.target.closest('button,a,input,label')) openSchoolDetail('${s.id}')">
      <td class="sticky-col sticky-left school-name-cell" data-label="학교명"><button class="link-like school-name-link" onclick="openSchoolDetail('${s.id}')">${esc(s.name)}</button></td>
      <td data-label="지역">${esc(s.region)||'-'}</td><td data-label="구분">${schoolTypeBadge(s.type)}</td><td data-label="MOU">${s.mouDate?`<span class="school-mou-badge yes">체결</span><small>${formatSchoolDate(s.mouDate)}</small>`:'<span class="school-mou-badge no">미체결</span>'}</td>
      <td data-label="담당자"><div class="school-inline-stack"><strong>${esc(s.contact)||'미등록'}</strong><small>${esc(s.contactPhone)||'연락처 없음'}</small></div></td>
      <td data-label="지원자"><button class="count-pill" onclick="viewSchoolApplicants('${s.id}')">${schoolApplicantCount(s.id)}명</button></td>
      <td data-label="재직 사원"><button class="count-pill employee" onclick="viewSchoolEmployees('${s.id}','${escJs(s.name)}')">${schoolActiveEmployeeCount(s.id)}명</button></td>
      <td data-label="누적 입사">${schoolCumulativeHireCount(s.id)}명</td><td data-label="최근 관리일"><strong>${formatSchoolDate(schoolLastManagedDate(s))}</strong><small>${schoolIsRecentlyManaged(s)?'최근 관리':'관리 점검 필요'}</small></td><td data-label="관리상태">${schoolManagementStatusBadge(s.managementStatus)}</td>
      <td class="row-actions sticky-col sticky-right school-row-actions" data-label="관리"><button class="school-action-btn detail" onclick="openSchoolDetail('${s.id}')">상세</button><button class="school-action-btn edit" onclick="editSchoolPrompt('${s.id}')">수정</button></td></tr>`;
  }).join('') : `<tr><td colspan="11" class="empty school-empty-state"><strong>조건에 맞는 학교가 없습니다.</strong><span>검색어 또는 필터를 바꾸거나 검색조건을 초기화해 주세요.</span><button type="button" class="ghost" onclick="resetSchoolManageFilters()">검색조건 초기화</button></td></tr>`;
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
  window.schoolManageRecentHistory=false; window.schoolManageBrokenLinks=false; window.schoolManageDuplicates=false;
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
  ['schoolManageRecentHistory','schoolManageBrokenLinks','schoolManageDuplicates'].forEach(id=>{if($(id))$(id).checked=false;});
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

/* =========================================================
   v10.41.1 SCHOOL_MANAGEMENT_UX_REDESIGN
   - 학교관리 화면을 실무 현황판 형태로 재구성
   - 목록 가시성 개선, 실무 큐, 선택 학교 요약 패널 추가
   - 학교 ID / 지원자 schoolId / 사원 schoolId 구조는 유지
   ========================================================= */
let schoolManageKpiMode='all';
let schoolManageSelectedId='';
let schoolManageFocusTab='activity';
function schoolManageDaysUntil(dateStr){ if(!dateStr) return null; const today=new Date(); today.setHours(0,0,0,0); const target=new Date(dateStr); if(!Number.isFinite(target.getTime())) return null; target.setHours(0,0,0,0); return Math.round((target.getTime()-today.getTime())/86400000); }

function schoolPrimaryContact(s){
  const contacts=Array.isArray(s?.contacts)?s.contacts:[];
  const primary=contacts.find(c=>c&&c.primary)||contacts[0]||null;
  return {
    name:String(primary?.name||s?.contact||'').trim(),
    phone:String(primary?.phone||s?.contactPhone||'').trim(),
    department:String(primary?.department||'').trim(),
    email:String(primary?.email||'').trim()
  };
}
function schoolLatestActivityInfo(s){
  const activities=Array.isArray(s?.activities)?s.activities.filter(Boolean):[];
  const latest=activities.sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0]||null;
  if(latest) return {type:latest.type||'활동',date:(latest.date||latest.createdAt||'').slice(0,10),note:latest.note||''};
  const last=schoolLastManagedDate(s);
  if(last) return {type:'관리기록',date:String(last).slice(0,10),note:s.lastRequestNote||s.notes||''};
  return null;
}
function schoolRequestStatusInfo(s){
  const requests=Array.isArray(s?.recommendationRequests)?s.recommendationRequests:[];
  const latest=[...requests].sort((a,b)=>String(b.requestDate||b.createdAt||'').localeCompare(String(a.requestDate||a.createdAt||'')))[0]||null;
  if(latest){
    const status=String(latest.status||'요청').trim();
    if(['미회신','회신대기'].includes(status)) return {label:'미회신',className:'pending',detail:latest.requestDate?`요청 ${formatSchoolDate(latest.requestDate)}`:'회신 대기'};
    if(['진행중','요청','협의중'].includes(status)) return {label:'진행중',className:'open',detail:latest.workplace||latest.department||'추천 요청 진행'};
    if(['회신완료','완료','종료'].includes(status)) return {label:'회신완료',className:'history',detail:`추천 ${Number(latest.recommendedCount||0)}명`};
    return {label:status||'기록 있음',className:'history',detail:latest.note||'추천 요청 기록'};
  }
  const hasRequest=!!String(s?.lastRequestNote||'').trim() || (Array.isArray(s?.activities)&&s.activities.some(a=>String(a?.type||'').includes('추천')));
  if(!hasRequest) return {label:'없음', className:'neutral', detail:'추천 요청 기록 없음'};
  const next=s?.nextContactDate||'';
  const d=next?schoolManageDaysUntil(next):null;
  if(d!==null && d<0) return {label:'미회신', className:'pending', detail:`예정일 ${formatSchoolDate(next)}`};
  if(d!==null && d<=7) return {label:'진행중', className:'open', detail:`다음 연락 ${formatSchoolDate(next)}`};
  return {label:'기록 있음', className:'history', detail:String(s?.lastRequestNote||'').trim()||'최근 요청 기록'};
}
function schoolNextContactPill(date){
  if(!date) return '<span class="school-inline-pill neutral">미등록</span>';
  const d=schoolManageDaysUntil(date);
  if(d===null) return '<span class="school-inline-pill neutral">미등록</span>';
  if(d<0) return `<span class="school-inline-pill overdue">D+${Math.abs(d)}</span>`;
  if(d===0) return '<span class="school-inline-pill today">오늘</span>';
  return `<span class="school-inline-pill upcoming">D-${d}</span>`;
}
function schoolManageKpiMatch(s){
  const contact=schoolPrimaryContact(s);
  const request=schoolRequestStatusInfo(s);
  switch(schoolManageKpiMode){
    case 'managed-core': return String(s.managementStatus||'')==='협력 중';
    case 'request-open': return ['진행중','기록 있음'].includes(request.label);
    case 'request-pending': return request.label==='미회신';
    case 'overdue': return !!s.nextContactDate && schoolManageDaysUntil(s.nextContactDate)<0;
    case 'stale': return !schoolIsRecentlyManaged(s,30);
    case 'missing-contact': return !contact.name;
    default: return true;
  }
}
function renderSchoolManageKpis(){
  const counts={
    total:schools.length,
    core:schools.filter(s=>String(s.managementStatus||'')==='협력 중').length,
    request:schools.filter(s=>['진행중','기록 있음'].includes(schoolRequestStatusInfo(s).label)).length,
    pending:schools.filter(s=>schoolRequestStatusInfo(s).label==='미회신').length,
    overdue:schools.filter(s=>s.nextContactDate && schoolManageDaysUntil(s.nextContactDate)<0).length,
    stale:schools.filter(s=>!schoolIsRecentlyManaged(s,30)).length,
    missing:schools.filter(s=>!schoolPrimaryContact(s).name).length,
    today:schools.filter(s=>s.nextContactDate && schoolManageDaysUntil(s.nextContactDate)===0).length,
  };
  setText('schoolKpiTotal', counts.total);
  setText('schoolKpiCore', counts.core);
  setText('schoolKpiRequest', counts.request);
  setText('schoolKpiPending', counts.pending);
  setText('schoolKpiOverdue', counts.overdue);
  setText('schoolKpiStale', counts.stale);
  setText('schoolKpiMissingContact', counts.missing);
  setText('schoolQueueToday', `${counts.today}개교`);
  setText('schoolQueueOverdue', `${counts.overdue}개교`);
  setText('schoolQueueStale', `${counts.stale}개교`);
  setText('schoolQueueMissing', `${counts.missing}개교`);
  document.querySelectorAll('#schoolManageKpiGrid .school-kpi-card').forEach(b=>b.classList.toggle('active', b.dataset.kpi===schoolManageKpiMode));
}
function applySchoolKpiFilter(kpi){ schoolManageKpiMode=kpi||'all'; schoolManagePage=1; renderSchoolManage(); }
function applySchoolQueueFilter(mode){
  schoolManageKpiMode='all';
  if(mode==='overdue') schoolManageKpiMode='overdue';
  else if(mode==='stale') schoolManageKpiMode='stale';
  else if(mode==='missing') schoolManageKpiMode='missing-contact';
  schoolManagePage=1;
  if(mode==='today'){
    resetSchoolManageFilters();
    schoolManagePage=1;
    schoolManageKpiMode='all';
    if($('schoolManageSearch')) $('schoolManageSearch').focus();
    // today queue is a subfilter only inside render
    window.schoolManageTodayOnly=true;
  }else{
    window.schoolManageTodayOnly=false;
  }
  renderSchoolManage();
}
function selectSchoolManage(id,opts={}){
  schoolManageSelectedId=id||'';
  if(opts.tab) schoolManageFocusTab=opts.tab;
  renderSchoolManage();
  if(opts.openDetail) openSchoolDetail(id);
}
function setSchoolManageFocusTab(tab){ schoolManageFocusTab=tab||'activity'; renderSchoolManageFocus(); }
function schoolFocusRelatedApplicants(s){ return applicants.filter(a=>a.schoolId===s.id).slice(0,5); }
function schoolFocusRelatedEmployees(s){ return employees.filter(e=>e.schoolId===s.id).slice(0,5); }
function renderSchoolManageFocus(){
  const empty=$('schoolFocusEmpty'), content=$('schoolFocusContent'), summary=$('schoolFocusSummary'), body=$('schoolFocusTabBody');
  if(!empty||!content||!summary||!body) return;
  const s=schools.find(x=>x.id===schoolManageSelectedId);
  if(!s){ empty.hidden=false; content.hidden=true; return; }
  empty.hidden=true; content.hidden=false;
  document.querySelectorAll('#schoolFocusTabs [data-school-focus-tab]').forEach(btn=>btn.classList.toggle('active', btn.dataset.schoolFocusTab===schoolManageFocusTab));
  const rec=typeof schoolRecruitStats==='function'?schoolRecruitStats(s.id):{total:schoolApplicantCount(s.id),interview:0,hireConfirmed:0};
  const primary=schoolPrimaryContact(s);
  const latest=schoolLatestActivityInfo(s);
  const request=schoolRequestStatusInfo(s);
  const activeEmployees=schoolActiveEmployeeCount(s.id);
  const totalEmployees=schoolCumulativeHireCount(s.id);
  summary.innerHTML=`
    <div class="school-focus-identity">
      <div>
        <span class="school-focus-badge">선택 학교</span>
        <h3>${esc(s.name)}</h3>
        <p>${[s.region||'지역 미등록', normalizeSchoolType(s.type)||'미분류', schoolManagementStatusLabel(s.managementStatus)].filter(Boolean).join(' · ')}</p>
        <div class="school-focus-tags">
          ${schoolManagementStatusBadge(s.managementStatus)}
          ${s.mouDate?'<span class="school-mou-badge yes">MOU 체결</span>':'<span class="school-mou-badge no">MOU 미체결</span>'}
          <span class="school-request-badge ${request.className}">${request.label}</span>
        </div>
      </div>
      <div class="school-focus-actions">
        <button type="button" class="ghost" onclick="openSchoolManagementCore('${s.id}')">관계관리</button>
        <button type="button" class="ghost" onclick="editSchoolPrompt('${s.id}')">수정</button>
        <button type="button" class="primary" onclick="openSchoolDetail('${s.id}')">상세</button>
      </div>
    </div>
    <div class="school-focus-metrics">
      <div><span>주 담당자</span><strong>${esc(primary.name||'미등록')}</strong><small>${esc(primary.phone||primary.department||'연락처 없음')}</small></div>
      <div><span>최근 활동</span><strong>${esc(latest?latest.type:'기록 없음')}</strong><small>${esc(latest?latest.date:'관리 이력 없음')}</small></div>
      <div><span>다음 연락 예정</span><strong>${formatSchoolDate(s.nextContactDate)}</strong><small>${s.nextContactDate?schoolNextContactPill(s.nextContactDate):'미등록'}</small></div>
      <div><span>지원자</span><strong>${rec.total}명</strong><small>면접 ${rec.interview||0}명 · 입사확정 ${rec.hireConfirmed||0}명</small></div>
      <div><span>누적 입사</span><strong>${totalEmployees}명</strong><small>현재 재직 ${activeEmployees}명</small></div>
    </div>`;
  if(schoolManageFocusTab==='activity'){
    const list=(Array.isArray(s.activities)?[...s.activities]:[]).sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')));
    body.innerHTML=list.length?`<div class="school-focus-list timeline">${list.slice(0,8).map(a=>`<article><div class="school-focus-list-head"><span class="school-request-badge history">${esc(a.type||'활동')}</span><strong>${esc((a.date||a.createdAt||'').slice(0,16).replace('T',' '))}</strong></div><p>${esc(a.note||'-')}</p>${a.nextDate?`<small>다음 연락 ${esc(a.nextDate)}</small>`:''}</article>`).join('')}</div>`:'<div class="empty">등록된 활동 이력이 없습니다.</div>';
  }else if(schoolManageFocusTab==='memo'){
    const list=(Array.isArray(s.memoHistory)?[...s.memoHistory]:[]).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    body.innerHTML=list.length?`<div class="school-focus-list">${list.slice(0,8).map(m=>`<article${m.important?' class="important"':''}><div class="school-focus-list-head"><span class="school-request-badge ${m.important?'pending':'neutral'}">${m.important?'중요':'메모'}</span><strong>${esc((m.createdAt||'').slice(0,16).replace('T',' '))}</strong></div><p>${esc(m.text||'-')}</p></article>`).join('')}</div>`:'<div class="empty">등록된 메모가 없습니다.</div>';
  }else if(schoolManageFocusTab==='contact'){
    const list=(Array.isArray(s.contacts)?[...s.contacts]:[]);
    const merged=list.length?list:[{name:s.contact,phone:s.contactPhone,primary:true,department:''}].filter(x=>x.name||x.phone);
    body.innerHTML=merged.length?`<div class="school-focus-contact-grid">${merged.map(c=>`<article><strong>${esc(c.name||'담당자 미등록')} ${c.primary?'<em>주 담당자</em>':''}</strong><p>${esc(c.department||'부서 미등록')}</p><small>${esc(c.phone||'연락처 없음')}</small>${c.email?`<small>${esc(c.email)}</small>`:''}</article>`).join('')}</div>`:'<div class="empty">등록된 담당자가 없습니다.</div>';
  }else{
    const applicantList=schoolFocusRelatedApplicants(s);
    const employeeList=schoolFocusRelatedEmployees(s);
    body.innerHTML=`<div class="school-focus-related-grid"><section><div class="school-focus-list-head split"><strong>지원자</strong><button type="button" class="mini" onclick="viewSchoolApplicants('${s.id}')">전체 보기</button></div>${applicantList.length?`<ul>${applicantList.map(a=>`<li><strong>${esc(a.name||'-')}</strong><span>${esc(a.status||'-')}</span></li>`).join('')}</ul>`:'<div class="empty small">연결된 지원자가 없습니다.</div>'}</section><section><div class="school-focus-list-head split"><strong>사원</strong><button type="button" class="mini" onclick="viewSchoolEmployees('${s.id}','${escJs(s.name)}')">전체 보기</button></div>${employeeList.length?`<ul>${employeeList.map(e=>`<li><strong>${esc(e.name||'-')}</strong><span>${esc(e.status||'-')}</span></li>`).join('')}</ul>`:'<div class="empty small">연결된 사원이 없습니다.</div>'}</section></div>`;
  }
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
    if(schoolManageTypeFilter!=='all' && normalizeSchoolType(s.type)!==schoolManageTypeFilter) return false;
    if(schoolManageRegionFilter!=='all' && String(s.region||'').trim()!==schoolManageRegionFilter) return false;
    const hasContact=!!schoolPrimaryContact(s).name;
    if(schoolManageContactFilter==='yes' && !hasContact) return false;
    if(schoolManageContactFilter==='no' && hasContact) return false;
    const hasMou=!!String(s.mouDate||'').trim();
    if(schoolManageMouFilter==='yes' && !hasMou) return false;
    if(schoolManageMouFilter==='no' && hasMou) return false;
    if(schoolManageStatusFilter!=='all' && String(s.managementStatus||'')!==schoolManageStatusFilter) return false;
    if(schoolManageHasApplicants && schoolApplicantCount(s.id)<1) return false;
    if(schoolManageHasEmployees && schoolActiveEmployeeCount(s.id)<1) return false;
    if(window.schoolManageRecentHistory && !schoolIsRecentlyManaged(s)) return false;
    if(window.schoolManageBrokenLinks && !schoolHasBrokenLinks(s)) return false;
    if(window.schoolManageDuplicates && !schoolIsDuplicateSuspect(s)) return false;
    if(schoolManageMissingHistory && schoolHasManagementHistory(s)) return false;
    if(schoolManageUnclassifiedFilter && normalizeSchoolType(s.type)) return false;
    if(window.schoolManageTodayOnly && !(s.nextContactDate && schoolManageDaysUntil(s.nextContactDate)===0)) return false;
    if(!schoolManageKpiMatch(s)) return false;
    return true;
  });
  list.sort(schoolManageCompare);
  const totalFiltered=list.length;
  const totalPages=Math.max(1,Math.ceil(totalFiltered/schoolManagePageSize));
  if(schoolManagePage>totalPages) schoolManagePage=totalPages;
  const startIndex=(schoolManagePage-1)*schoolManagePageSize;
  const pageList=list.slice(startIndex,startIndex+schoolManagePageSize);
  const filterLabels=schoolManageFilterSummary();
  if(window.schoolManageTodayOnly) filterLabels.push('오늘 연락 예정');
  if(schoolManageKpiMode!=='all'){
    const labelMap={'managed-core':'협력 중','request-open':'추천 요청 진행','request-pending':'미회신 학교','overdue':'연락기한 경과','stale':'최근 30일 활동 없음','missing-contact':'담당자 미등록'};
    filterLabels.push(`상단 카드 ${labelMap[schoolManageKpiMode]||schoolManageKpiMode}`);
  }
  setText('schoolManageCount', `${totalFiltered}개교${filterLabels.length?` / 전체 ${schools.length}개교`:''}`);
  const summaryEl=$('schoolManageFilterSummary');
  if(summaryEl){
    summaryEl.innerHTML=filterLabels.length ? `<span class="school-filter-summary-label">적용 중 ${filterLabels.length}개</span>${filterLabels.map(x=>`<span class="school-filter-chip">${esc(x)}</span>`).join('')}` : '<span class="muted">검색 조건 없이 전체 학교를 표시하고 있습니다.</span>';
  }
  const thead=$('schoolManageHead');
  if(thead) thead.innerHTML=`<tr><th class="sticky-col sticky-left">학교명</th><th>지역</th><th>학교구분</th><th>관리상태</th><th>주 담당자</th><th>최근 활동</th><th>다음 연락 예정</th><th>추천 요청</th><th>지원자</th><th>누적 입사</th><th>재직자</th><th class="sticky-col sticky-right">관리</th></tr>`;
  if(!schoolManageSelectedId || !list.some(s=>s.id===schoolManageSelectedId)) schoolManageSelectedId=pageList[0]?.id||'';
  body.innerHTML = pageList.length ? pageList.map(s=>{
    const primary=schoolPrimaryContact(s);
    const latest=schoolLatestActivityInfo(s);
    const request=schoolRequestStatusInfo(s);
    const alias=(s.aliases||[]).filter(Boolean).slice(0,2).join(' · ');
    return `<tr class="school-manage-row is-practical ${schoolManageSelectedId===s.id?'is-selected':''}" tabindex="0" onclick="selectSchoolManage('${s.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();selectSchoolManage('${s.id}');}">
      <td class="sticky-col sticky-left school-name-cell" data-label="학교명"><div class="school-name-stack"><button class="link-like school-name-link" onclick="event.stopPropagation();openSchoolDetail('${s.id}')">${esc(s.name)}</button>${alias?`<small>${esc(alias)}</small>`:''}</div></td>
      <td data-label="지역">${esc(s.region)||'-'}</td>
      <td data-label="학교구분">${schoolTypeBadge(s.type)}</td>
      <td data-label="관리상태">${schoolManagementStatusBadge(s.managementStatus)}</td>
      <td data-label="주 담당자"><div class="school-inline-stack"><strong>${esc(primary.name)||'미등록'}</strong><small>${esc(primary.phone||primary.department||'연락처 없음')}</small></div></td>
      <td data-label="최근 활동"><div class="school-inline-stack"><strong>${esc(latest?latest.type:'기록 없음')}</strong><small>${esc(latest?latest.date:'관리 이력 없음')}</small></div></td>
      <td data-label="다음 연락 예정"><div class="school-inline-stack"><strong>${formatSchoolDate(s.nextContactDate)}</strong><small>${schoolNextContactPill(s.nextContactDate)}</small></div></td>
      <td data-label="추천 요청"><div class="school-inline-stack"><span class="school-request-badge ${request.className}">${esc(request.label)}</span><small>${esc(request.detail)}</small></div></td>
      <td data-label="지원자"><button class="count-pill" onclick="event.stopPropagation();viewSchoolApplicants('${s.id}')">${schoolApplicantCount(s.id)}명</button></td>
      <td data-label="누적 입사">${schoolCumulativeHireCount(s.id)}명</td>
      <td data-label="재직자"><button class="count-pill employee" onclick="event.stopPropagation();viewSchoolEmployees('${s.id}','${escJs(s.name)}')">${schoolActiveEmployeeCount(s.id)}명</button></td>
      <td class="row-actions sticky-col sticky-right school-row-actions" data-label="관리"><button class="school-action-btn detail" onclick="event.stopPropagation();openSchoolDetail('${s.id}')">상세</button><button class="school-action-btn edit" onclick="event.stopPropagation();editSchoolPrompt('${s.id}')">수정</button><button class="school-action-btn ghost" onclick="event.stopPropagation();openSchoolManagementCore('${s.id}')">관계</button></td></tr>`;
  }).join('') : `<tr><td colspan="12" class="empty school-empty-state"><strong>조건에 맞는 학교가 없습니다.</strong><span>검색어 또는 필터를 바꾸거나 검색조건을 초기화해 주세요.</span><button type="button" class="ghost" onclick="resetSchoolManageFilters()">검색조건 초기화</button></td></tr>`;
  const pager=$('schoolManagePagination');
  if(pager){
    const first=totalFiltered?startIndex+1:0;
    const last=Math.min(startIndex+schoolManagePageSize,totalFiltered);
    pager.innerHTML=`<div class="school-page-summary">${first}-${last} / ${totalFiltered}개교</div><div class="school-page-controls"><button type="button" ${schoolManagePage<=1?'disabled':''} onclick="setSchoolManagePage(1)">처음</button><button type="button" ${schoolManagePage<=1?'disabled':''} onclick="setSchoolManagePage(${schoolManagePage-1})">이전</button><span><strong>${schoolManagePage}</strong> / ${totalPages}</span><button type="button" ${schoolManagePage>=totalPages?'disabled':''} onclick="setSchoolManagePage(${schoolManagePage+1})">다음</button><button type="button" ${schoolManagePage>=totalPages?'disabled':''} onclick="setSchoolManagePage(${totalPages})">마지막</button></div>`;
  }
  const panel=$('schoolFilterContent');
  const btn=$('btnToggleSchoolFilters');
  if(panel) panel.hidden=schoolManageFiltersCollapsed;
  if(btn){ btn.setAttribute('aria-expanded',String(!schoolManageFiltersCollapsed)); btn.innerHTML=schoolManageFiltersCollapsed?'필터 펼치기 ▾':'필터 접기 ▴'; }
  renderSchoolManageFocus();
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
  schoolManageKpiMode='all';
  window.schoolManageRecentHistory=false; window.schoolManageBrokenLinks=false; window.schoolManageDuplicates=false; window.schoolManageTodayOnly=false;
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
  ['schoolManageRecentHistory','schoolManageBrokenLinks','schoolManageDuplicates'].forEach(id=>{if($(id))$(id).checked=false;});
  document.querySelectorAll('#schoolManageTypeTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.schoolmanagetype==='all'));
  document.querySelectorAll('#schoolManageKpiGrid .school-kpi-card').forEach(b=>b.classList.toggle('active', b.dataset.kpi==='all'));
  renderSchoolManage();
}
window.applySchoolQueueFilter=applySchoolQueueFilter;
window.selectSchoolManage=selectSchoolManage;
window.setSchoolManageFocusTab=setSchoolManageFocusTab;
