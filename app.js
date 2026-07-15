// [HOME_DEV] Recruit ERP v10.39.1 CSS_JS_CONSOLIDATION — 통교체용 통합 빌드
const STORAGE_KEY = 'recruit_erp_applicants_stable';
const LEGACY_KEYS = ['resume_excel_like_v9_rows','recruit_erp_vercel_v2_applicants','recruit_erp_vercel_v1_applicants'];
const BACKUP_KEY = 'recruit_erp_last_backup_date';
const CALENDAR_EVENTS_KEY = 'recruit_erp_calendar_events';
const REMINDER_DISMISS_KEY = 'recruit_erp_reminder_dismissed_date';
const SCHOOLS_KEY = 'recruit_erp_schools';
const NAV_COLLAPSE_KEY = 'recruit_erp_nav_collapsed';
const EMPLOYEES_KEY = 'recruit_erp_employees';
const STATUS_OPTIONS = ['미연락','부재중','면접예정','면접완료','다음면접','입사예정','출근','불합격','서류탈락','철회','연락두절'];
let schools = loadSchools();
let editingSchoolId = '';
let employees = loadEmployees();
let editingEmployeeId = '';
let applicants = load();
let currentWorkplace = 'all';
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'recent';
let hideFinished = false;
let currentSchoolFilterId = '';
let detailCurrentId = '';
console.info('[HOME_DEV] Recruit ERP v10.39.9 loaded applicants:', applicants.length);
const $ = id => document.getElementById(id);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
let calendarEvents = loadCalendarEvents();
let calendarCursor = new Date(today() + 'T00:00:00');
calendarCursor.setDate(1);
let selectedCalendarDate = today();
let calendarWorkplaceFilter = '전체';
function esc(s){ return String(s ?? '').replace(/[&<>\"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function normalizeGender(v){ const s=String(v||'').trim(); if(s==='남') return '남자'; if(s==='여') return '여자'; if(s==='남자'||s==='여자') return s; return ''; }
function genderClass(a){ const g=normalizeGender(a?.gender); if(g==='남자') return 'gender-male'; if(g==='여자') return 'gender-female'; return 'gender-unknown'; }
function normalizeStatus(v){
  const s=String(v||'').trim();
  const map={
    '문자발송':'미연락','연락완료':'면접예정','보류':'다음면접',
    '부적합':'서류탈락','전형마감':'서류탈락','취소':'철회','입사포기':'철회'
  };
  const out=map[s] || s || '미연락';
  return STATUS_OPTIONS.includes(out) ? out : '미연락';
}
function statusOptionsHtml(current){ const cur=normalizeStatus(current); return STATUS_OPTIONS.map(v=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(v)}</option>`).join(''); }
function normalizeDorm(v){
  const s=String(v||'').trim();
  if(['사용','기숙사 사용','기숙사'].includes(s)) return '기숙사';
  if(['미사용','해당없음','출퇴근','통근'].includes(s)) return '출퇴근';
  if(['확인필요','미확인'].includes(s)) return '확인필요';
  return '';
}
function dormLabel(a){ return normalizeDorm(a?.dormUse) || '미확인'; }
function dormClass(v){ const d=normalizeDorm(v); if(d==='기숙사') return 'on'; if(d==='출퇴근') return 'off'; return 'pending'; }
function displayCheckNeeds(v){ return String(v||'').replaceAll('근무형태 확인','출근방법 확인').replaceAll('근무형태','출근방법'); }
function normalize(a){ return {
  id:a.id||uid(), createdAt:a.createdAt||new Date().toISOString(), updatedAt:a.updatedAt||'',
  applyDate:a.applyDate||'', source:a.source||'', extra:a.extra||a.etc||'', status:normalizeStatus(a.status), workplace:a.workplace||'',
  batch:a.batch||'',
  name:a.name||'', phone:formatPhoneDisplay(a.phone||''), email:a.email||'', gender:normalizeGender(a.gender), birthYear:formatBirthDisplay(a.birthYear||''),
    age:a.age||'', region:a.region||'', commute:a.commute||'', dormUse:normalizeDorm(a.dormUse),
  education:a.education||'', finalEducation:a.finalEducation||'', school:a.school||'', schoolId:a.schoolId||resolveSchoolId(a.school||''), major:a.major||'', gradePoint:a.gradePoint||'', languageEtc:a.languageEtc||'',
  certs:a.certs||'', career:a.career||'', lastCompany:a.lastCompany||'', duties:a.duties||'', leaveReason:a.leaveReason||'',
  careerType:a.careerType||'', jobFitCategory:a.jobFitCategory||'', checkNeeds:a.checkNeeds||'', selfIntroKeywords:a.selfIntroKeywords||'',
  interviewDate:a.interviewDate||'', interviewTime:a.interviewTime||'', hireDate:a.hireDate||'',
    finalDecision:a.finalDecision||'', decisionReason:a.decisionReason||'', consult:a.consult||'',
    memo:a.memo||'', employeeId:a.employeeId||''
}; }
function looksLikeApplicantRow(x){
  return x && typeof x === 'object' && (x.name || x.phone || x.email || x.applyDate || x.workplace || x.interviewDate);
}
function readArrayFromStorageKey(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    if(Array.isArray(parsed)) return parsed;
    if(parsed && Array.isArray(parsed.applicants)) return parsed.applicants;
    if(parsed && Array.isArray(parsed.rows)) return parsed.rows;
    return [];
  }catch{ return []; }
}
function load(){
  try{
    let data = readArrayFromStorageKey(STORAGE_KEY);
    if(!data.length){
      for(const key of LEGACY_KEYS){
        const legacy = readArrayFromStorageKey(key);
        if(Array.isArray(legacy) && legacy.some(looksLikeApplicantRow)){
          data = legacy;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.map(normalize)));
          break;
        }
      }
    }
    if(!data.length){
      const candidates = [];
      for(let i=0;i<localStorage.length;i++){
        const key = localStorage.key(i);
        if(!key || key === STORAGE_KEY || key === BACKUP_KEY) continue;
        const arr = readArrayFromStorageKey(key);
        if(Array.isArray(arr) && arr.some(looksLikeApplicantRow)) candidates.push(arr);
      }
      if(candidates.length){
        candidates.sort((a,b)=>b.length-a.length);
        data = candidates[0];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.map(normalize)));
      }
    }
    return Array.isArray(data) ? data.map(normalize) : [];
  }catch(e){
    console.error('Recruit ERP load error', e);
    return [];
  }
}
let cloudSyncStatus = 'unknown'; // 'ok' | 'error' | 'unknown'
let cloudAuthenticated = false;
const OPERATION_ENV_STORAGE_KEY = 'recruit_erp_ui_operation_environment';
function isCompanyLocalMode(){ return localStorage.getItem(OPERATION_ENV_STORAGE_KEY) === 'company'; }
function canUseCloud(){ return !!window.sb && !isCompanyLocalMode() && cloudAuthenticated; }
function setCloudSyncStatus(status){ cloudSyncStatus = status; updateStorageNote(); }
function updateStorageNote(){
  var el = $('storageNote');
  if(!el) return;
  if(!window.sb){
    el.innerHTML = '<strong>서버 저장 없음</strong><span>지원자 데이터는 현재 브라우저에만 저장됩니다.</span>';
  } else if(cloudSyncStatus === 'error'){
    el.className = 'security-note sync-warn-note';
    el.innerHTML = '<strong>⚠ 클라우드 동기화 실패</strong><span>브라우저에는 정상 저장됐지만 클라우드 반영에 실패했어요. 인터넷 연결을 확인해주세요.</span>';
  } else {
    el.className = 'security-note';
    el.innerHTML = '<strong>클라우드 동기화 중</strong><span>브라우저 + Supabase 클라우드에 동시 저장됩니다.</span>';
  }
}
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants)); if(canUseCloud()) supabaseSyncAll(applicants); renderAll(); }

/* =========================================================
   v10.8.0 Supabase 연동
   - 브라우저 저장(localStorage)은 그대로 유지 (항상 우선 동작, 오프라인/차단 시에도 안전)
   - window.sb가 연결돼 있으면 추가로 클라우드에도 동기화
   - 실패해도 절대 로컬 동작을 막지 않음 (전부 try/catch로 감쌈)
   ========================================================= */
function applicantForCloud(a){
  // v10.30.3: employeeId는 로컬 전용 연결값으로 유지합니다.
  // 기존 Supabase applicants 테이블에 employeeId 컬럼이 없는 환경에서도
  // 저장 오류가 나지 않도록 클라우드 전송본에서만 제외합니다.
  var row = {...a};
  delete row.employeeId;
  return row;
}
function supabaseSyncAll(list){
  if(!canUseCloud()) return;
  var cloudRows = (Array.isArray(list) ? list : []).map(applicantForCloud);
  window.sb.from('applicants').upsert(cloudRows).then(function(res){
    if(res && res.error){ console.warn('Supabase 저장 실패(로컬엔 정상 저장됨):', res.error.message); setCloudSyncStatus('error'); return; }
    setCloudSyncStatus('ok');
  }).catch(function(e){ console.warn('Supabase 저장 실패(로컬엔 정상 저장됨):', e); setCloudSyncStatus('error'); });
}
function supabaseDeleteOne(id){
  if(!canUseCloud()) return;
  window.sb.from('applicants').delete().eq('id', id).then(function(res){
    if(res && res.error) console.warn('Supabase 삭제 실패(로컬엔 정상 삭제됨):', res.error.message);
  }).catch(function(e){ console.warn('Supabase 삭제 실패(로컬엔 정상 삭제됨):', e); });
}
function supabaseDeleteAll(){
  if(!canUseCloud()) return;
  window.sb.from('applicants').delete().neq('id','__none__').then(function(res){
    if(res && res.error) console.warn('Supabase 전체삭제 실패(로컬엔 정상 삭제됨):', res.error.message);
  }).catch(function(e){ console.warn('Supabase 전체삭제 실패(로컬엔 정상 삭제됨):', e); });
}
/* =========================================================
   v10.9.0 자동 백업 스냅샷
   - 위험한 작업(전체삭제/JSON가져오기) 직전에 자동으로 스냅샷 저장
   - 하루 지나면 자동으로 "일일 스냅샷" 하나 추가 저장
   - 최근 14개까지만 유지(오래된 것은 자동 정리)
   - 전부 실패해도 로컬 동작에는 영향 없음(try/catch)
   ========================================================= */
function supabaseSnapshotSave(reason){
  if(!canUseCloud() || !applicants.length) return Promise.resolve();
  return window.sb.from('applicant_snapshots').insert({
    reason: reason || '',
    count: applicants.length,
    data: applicants
  }).then(function(res){
    if(res && res.error){ console.warn('스냅샷 저장 실패:', res.error.message); return; }
    supabaseSnapshotCleanup();
  }).catch(function(e){ console.warn('스냅샷 저장 실패:', e); });
}
function supabaseSnapshotCleanup(){
  if(!canUseCloud()) return;
  window.sb.from('applicant_snapshots').select('id,created_at').order('created_at',{ascending:false}).then(function(res){
    if(!res || res.error || !res.data) return;
    var extra = res.data.slice(14);
    if(!extra.length) return;
    var ids = extra.map(function(r){ return r.id; });
    window.sb.from('applicant_snapshots').delete().in('id', ids).then(function(){});
  }).catch(function(){});
}
function supabaseSnapshotDailyCheck(){
  if(!canUseCloud()) return;
  window.sb.from('applicant_snapshots').select('created_at').order('created_at',{ascending:false}).limit(1).then(function(res){
    if(res && res.error) return;
    var last = (res && res.data && res.data[0]) ? res.data[0].created_at : null;
    var need = true;
    if(last){ need = (Date.now() - new Date(last).getTime())/3600000 >= 20; }
    if(need){ supabaseSnapshotSave('일일 자동 백업').then(renderSnapshotList); }
  }).catch(function(){});
}
function renderSnapshotList(){
  var el = $('snapshotList');
  if(!el) return;
  if(!canUseCloud()){ el.innerHTML = '<div class="empty">회사 로컬 모드이거나 로그인되지 않아 클라우드 백업 이력을 사용하지 않습니다.</div>'; return; }
  window.sb.from('applicant_snapshots').select('id,created_at,reason,count').order('created_at',{ascending:false}).limit(14).then(function(res){
    if(!res || res.error || !res.data || !res.data.length){ el.innerHTML = '<div class="empty">아직 저장된 백업 이력이 없습니다. (자동으로 하루 단위로 쌓여요)</div>'; return; }
    el.innerHTML = res.data.map(function(s){
      var dt = new Date(s.created_at);
      var label = dt.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      return '<div class="snapshot-row"><span class="snapshot-time">'+esc(label)+'</span><span class="snapshot-reason">'+esc(s.reason||'')+'</span><span class="snapshot-count">'+s.count+'명</span><button class="mini" onclick="restoreSnapshot('+s.id+')">이 시점으로 복원</button></div>';
    }).join('');
  }).catch(function(){ el.innerHTML = '<div class="empty">백업 이력을 불러오지 못했습니다.</div>'; });
}
function restoreSnapshot(id){
  if(!canUseCloud()) return;
  if(!confirm('이 시점으로 복원하면 현재 데이터('+applicants.length+'명)가 그 시점 데이터로 교체됩니다.\n\n복원 전에 현재 상태도 자동으로 백업해둘게요. 진행할까요?')) return;
  supabaseSnapshotSave('복원 직전 자동 백업').then(function(){
    return window.sb.from('applicant_snapshots').select('data,count,created_at').eq('id', id).single();
  }).then(function(res){
    if(!res || res.error || !res.data){ alert('복원 실패: 스냅샷을 찾을 수 없습니다.'); return; }
    applicants = (res.data.data || []).map(normalize);
    save();
    renderSnapshotList();
    alert('복원 완료: '+applicants.length+'명 ('+new Date(res.data.created_at).toLocaleString('ko-KR')+' 시점)');
  }).catch(function(e){ alert('복원 중 오류가 발생했습니다: '+e); });
}
function supabaseSyncOnLoad(){
  if(!canUseCloud()) return;
  window.sb.from('applicants').select('*').then(function(res){
    if(res && res.error){ console.warn('Supabase 불러오기 실패, 로컬 데이터로 계속 진행:', res.error.message); setCloudSyncStatus('error'); return; }
    setCloudSyncStatus('ok');
    var cloud = (res && res.data) ? res.data.map(normalize) : [];
    var local = applicants;

    // v10.8.1: 무조건 덮어쓰기(위험) -> id 기준 병합(안전)으로 변경
    // 로컬에만 있는 지원자, 클라우드에만 있는 지원자 모두 보존.
    // 같은 id가 양쪽에 있으면 더 최근에 수정된 쪽을 채택.
    var map = {};
    local.forEach(function(a){ map[a.id] = a; });
    cloud.forEach(function(c){
      var l = map[c.id];
      if(!l){ map[c.id] = c; return; }
      var lt = l.updatedAt || l.createdAt || '';
      var ct = c.updatedAt || c.createdAt || '';
      map[c.id] = (ct > lt) ? c : l;
    });
    var merged = Object.keys(map).map(function(k){ return map[k]; });

    var beforeCount = local.length;
    applicants = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
    renderAll();
    // v10.35.1: 병합 직후 자동 재업로드(supabaseSyncAll) 제거.
    // 로드는 이제 읽기 전용 병합 + 화면 렌더만 수행하고, 클라우드에는 아무것도 쓰지 않음.
    // 신규 등록/수정/삭제/JSON 가져오기 등 사용자가 직접 저장을 실행할 때만 업로드됨(save() 등 기존 경로 그대로 유지).
    console.info('Supabase 동기화(병합) 완료: 로컬 ' + beforeCount + '명 + 클라우드 ' + cloud.length + '명 -> 화면에 ' + merged.length + '명 표시 (클라우드에는 다시 쓰지 않음)');
  }).catch(function(e){ console.warn('Supabase 연결 실패, 로컬 데이터로 계속 진행:', e); setCloudSyncStatus('error'); });
}
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
/* =========================================================
   v10.22.0 직원명부 (인재풀·HR)
   - 지원자 파이프라인(applicants)과 완전히 분리된 별도 저장소
   - 필드: 사번/성명/학교/입사일/퇴사일/재직상태/상벌여부만 취급
   - 주민번호·계좌·주소·연락처·이메일 등 민감정보는 절대 다루지 않음
   - 학교 필드는 기존 schools/schoolId 매칭 시스템을 그대로 재사용
   ========================================================= */
function normalizeEmployee(e){
  const school=e.school||'';
  return {
    id: e.id || uid(),
    empNo: e.empNo||'',
    name: e.name||'',
    department: e.department||'',
    role: e.role||'',
    school, schoolId: (e.schoolId!==undefined && e.schoolId!==null) ? e.schoolId : resolveSchoolId(school),
    hireDate: e.hireDate||'',
    leaveDate: e.leaveDate||'',
    status: e.status || (e.leaveDate ? '퇴사' : '재직중'),
    disciplineCount: Number.isFinite(e.disciplineCount) ? e.disciplineCount : (parseInt(e.disciplineCount,10)||0),
    notes: e.notes||'',
    createdAt: e.createdAt || new Date().toISOString(), updatedAt: e.updatedAt||''
  };
}
function loadEmployees(){
  try{
    const raw=localStorage.getItem(EMPLOYEES_KEY);
    const data=raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.map(normalizeEmployee) : [];
  }catch(e){ console.error('직원명부 load error', e); return []; }
}
function saveEmployees(){
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
  supabaseSyncEmployees(employees);
  renderEmployees();
  renderSchools();
}
function supabaseSyncEmployees(list){
  if(!canUseCloud()) return;
  window.sb.from('employees').upsert(list).then(function(res){
    if(res && res.error) console.warn('직원명부 Supabase 저장 실패(로컬엔 정상 저장됨):', res.error.message);
  }).catch(function(e){ console.warn('직원명부 Supabase 저장 실패(로컬엔 정상 저장됨):', e); });
}
function supabaseDeleteEmployee(id){
  if(!canUseCloud()) return;
  window.sb.from('employees').delete().eq('id', id).then(function(res){
    if(res && res.error) console.warn('직원명부 삭제 실패(로컬엔 정상 삭제됨):', res.error.message);
  }).catch(function(e){ console.warn('직원명부 삭제 실패(로컬엔 정상 삭제됨):', e); });
}
function supabaseEmployeesSyncOnLoad(){
  if(!canUseCloud()) return;
  const PAGE_SIZE = 500;
  function loadPage(from, collected){
    return window.sb.from('employees').select('*').order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1)
      .then(function(res){
        if(res && res.error){ throw new Error(res.error.message); }
        const rows = (res && res.data) ? res.data : [];
        const merged = collected.concat(rows);
        if(rows.length < PAGE_SIZE){
          return merged; // 마지막 페이지(요청 크기보다 적게 옴)
        }
        return loadPage(from + PAGE_SIZE, merged);
      });
  }
  loadPage(0, []).then(function(cloudRaw){
    // v10.35.2: 전체 페이지 조회가 전부 성공한 뒤에만 병합/반영. 1,000행 조회 한도로
    // 일부만 가져와 조용히 누락되던 문제(직원 1,381명 중 381명 유실 위험)를 제거함.
    const cloud = cloudRaw.map(normalizeEmployee);
    const local = employees;
    const map = {};
    local.forEach(function(e){ map[e.id] = e; });
    cloud.forEach(function(c){
      const l = map[c.id];
      if(!l){ map[c.id] = c; return; }
      const lt = l.updatedAt || l.createdAt || '';
      const ct = c.updatedAt || c.createdAt || '';
      map[c.id] = (ct > lt) ? c : l;
    });
    employees = Object.keys(map).map(function(k){ return map[k]; });
    localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(employees));
    renderEmployees();
    console.info('직원명부 Supabase 페이지 조회 완료: 클라우드 ' + cloud.length + '명 -> 병합 후 ' + employees.length + '명');
  }).catch(function(e){
    console.warn('직원명부 페이지 조회 중 실패 — 불완전한 데이터를 반영하지 않고 기존 로컬 데이터 유지:', e);
  });
}
let employeeStatusFilter='all';
let employeeSearchName='';
let employeeSearchNo='';
let employeeDeptFilter='all';
let employeeRoleFilter='all';
let employeeSchoolSearch='';
let employeePage=1;
let employeePageSize=10;
let employeeViewMode='list';
function getEmployeeForm(){
  return {
    empNo: ($('empNo')?.value||'').trim(),
    name: ($('empName')?.value||'').trim(),
    department: ($('empDept')?.value||'').trim(),
    role: ($('empRole')?.value||'').trim(),
    school: ($('empSchool')?.value||'').trim(),
    hireDate: $('empHireDate')?.value||'',
    leaveDate: $('empLeaveDate')?.value||'',
    status: $('empStatus')?.value||'재직중',
    disciplineCount: parseInt($('empDisciplineCount')?.value||'0',10)||0,
    notes: ($('empNotes')?.value||'').trim()
  };
}
function resetEmployeeForm(){
  editingEmployeeId='';
  ['empNo','empName','empDept','empRole','empSchool','empHireDate','empLeaveDate','empDisciplineCount','empNotes'].forEach(id=>{ if($(id)) $(id).value=''; });
  if($('empStatus')) $('empStatus').value='재직중';
  if($('btnAddEmployee')) $('btnAddEmployee').textContent='직원 추가';
}
function fillEmployeeForm(e){
  editingEmployeeId=e.id;
  if($('empNo')) $('empNo').value=e.empNo;
  if($('empName')) $('empName').value=e.name;
  if($('empDept')) $('empDept').value=e.department;
  if($('empRole')) $('empRole').value=e.role;
  if($('empSchool')) $('empSchool').value=e.school;
  if($('empHireDate')) $('empHireDate').value=e.hireDate;
  if($('empLeaveDate')) $('empLeaveDate').value=e.leaveDate;
  if($('empStatus')) $('empStatus').value=e.status;
  if($('empDisciplineCount')) $('empDisciplineCount').value=e.disciplineCount||0;
  if($('empNotes')) $('empNotes').value=e.notes;
  if($('btnAddEmployee')) $('btnAddEmployee').textContent='수정 저장';
}
function submitEmployeeForm(){
  const f=getEmployeeForm();
  if(!f.name){ alert('성명을 입력해주세요.'); return; }
  if(editingEmployeeId){
    employees=employees.map(e=>e.id===editingEmployeeId ? normalizeEmployee({...e, ...f, id:editingEmployeeId, updatedAt:new Date().toISOString()}) : e);
  } else {
    employees.unshift(normalizeEmployee({...f, id:uid(), createdAt:new Date().toISOString()}));
  }
  resetEmployeeForm();
  saveEmployees();
}
function editEmployeePrompt(id){ const e=employees.find(x=>x.id===id); if(e){ fillEmployeeForm(e); } }
function deleteEmployee(id){
  const e=employees.find(x=>x.id===id);
  if(!e) return;
  if(!confirm(`"${e.name}" 직원 기록을 삭제할까요?`)) return;
  employees=employees.filter(x=>x.id!==id);
  supabaseDeleteEmployee(id);
  saveEmployees();
}
function employeeDeptList(){ return Array.from(new Set(employees.map(e=>e.department).filter(Boolean))).sort(); }
function employeeRoleList(){ return Array.from(new Set(employees.map(e=>e.role).filter(Boolean))).sort(); }
function employeeStatusBadgeClass(status){
  if(status==='재직중') return 'good';
  if(status==='휴직') return 'missed';
  if(status==='입사예정') return 'info';
  return 'bad';
}
function employeeMatchesFilter(e){
  if(employeeStatusFilter!=='all' && e.status!==employeeStatusFilter) return false;
  if(employeeSearchName && !e.name.toLowerCase().includes(employeeSearchName.toLowerCase())) return false;
  if(employeeSearchNo && !e.empNo.toLowerCase().includes(employeeSearchNo.toLowerCase())) return false;
  if(employeeDeptFilter!=='all' && e.department!==employeeDeptFilter) return false;
  if(employeeRoleFilter!=='all' && e.role!==employeeRoleFilter) return false;
  if(employeeSchoolSearch){
    const term=employeeSchoolSearch.toLowerCase();
    const textMatch=(e.school||'').toLowerCase().includes(term);
    const matchedSchool=findSchoolByText(employeeSchoolSearch);
    const aliasMatch=matchedSchool && e.schoolId===matchedSchool.id;
    if(!textMatch && !aliasMatch) return false;
  }
  return true;
}
function applyEmployeeSearch(){
  employeeSearchName=($('empSearchName')?.value||'').trim();
  employeeSearchNo=($('empSearchNo')?.value||'').trim();
  employeeDeptFilter=$('empDeptFilter')?.value||'all';
  employeeRoleFilter=$('empRoleFilter')?.value||'all';
  employeeSchoolSearch=($('empSearchSchool')?.value||'').trim();
  employeePage=1;
  renderEmployees();
}
function resetEmployeeFilters(){
  employeeSearchName=''; employeeSearchNo=''; employeeDeptFilter='all'; employeeRoleFilter='all'; employeeSchoolSearch=''; employeePage=1;
  if($('empSearchName')) $('empSearchName').value='';
  if($('empSearchNo')) $('empSearchNo').value='';
  if($('empSearchSchool')) $('empSearchSchool').value='';
  if($('empDeptFilter')) $('empDeptFilter').value='all';
  if($('empRoleFilter')) $('empRoleFilter').value='all';
  renderEmployees();
}
function populateEmployeeFilterOptions(){
  const deptSel=$('empDeptFilter');
  if(deptSel){
    const cur=deptSel.value;
    deptSel.innerHTML='<option value="all">전체</option>'+employeeDeptList().map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('');
    deptSel.value=employeeDeptList().includes(cur)?cur:'all';
  }
  const roleSel=$('empRoleFilter');
  if(roleSel){
    const cur=roleSel.value;
    roleSel.innerHTML='<option value="all">전체</option>'+employeeRoleList().map(r=>`<option value="${esc(r)}">${esc(r)}</option>`).join('');
    roleSel.value=employeeRoleList().includes(cur)?cur:'all';
  }
}
function goEmployeePage(p){ employeePage=p; renderEmployees(); }
function renderEmployeePagination(totalPages, totalCount){
  const el=$('employeePagination');
  if(!el) return;
  setText('employeePaginationCount', totalCount);
  if(totalPages<=1){ el.innerHTML=''; return; }
  const start=Math.max(1, employeePage-2), end=Math.min(totalPages, start+4);
  let html=`<button class="mini" ${employeePage===1?'disabled':''} onclick="goEmployeePage(1)">«</button>`;
  html+=`<button class="mini" ${employeePage===1?'disabled':''} onclick="goEmployeePage(${employeePage-1})">‹</button>`;
  for(let p=start;p<=end;p++) html+=`<button class="mini ${p===employeePage?'active':''}" onclick="goEmployeePage(${p})">${p}</button>`;
  html+=`<button class="mini" ${employeePage===totalPages?'disabled':''} onclick="goEmployeePage(${employeePage+1})">›</button>`;
  html+=`<button class="mini" ${employeePage===totalPages?'disabled':''} onclick="goEmployeePage(${totalPages})">»</button>`;
  el.innerHTML=html;
}
function csvEmployees(){
  const headers=['사번','성명','부서','직무','학교','입사일','퇴사일','상태','상벌건수','비고'];
  const lines=[headers,...employees.map(e=>[e.empNo,e.name,e.department,e.role,e.school,e.hireDate,e.leaveDate,e.status,e.disciplineCount,e.notes])]
    .map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`직원명부_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function employeeDeptAggregates(){
  const map={};
  employees.forEach(e=>{
    const dept=e.department||'미분류';
    if(!map[dept]) map[dept]={dept, total:0, active:0, left:0, upcoming:0};
    map[dept].total++;
    if(e.status==='재직중') map[dept].active++;
    if(e.status==='퇴사') map[dept].left++;
    if(e.status==='입사예정') map[dept].upcoming++;
  });
  return Object.values(map).sort((a,b)=>b.total-a.total);
}
function renderEmployeeDeptView(){
  const body=$('employeeDeptBody');
  if(!body) return;
  const rows=employeeDeptAggregates();
  if(!rows.length){ body.innerHTML=`<tr><td colspan="5" class="empty">등록된 직원이 없습니다.</td></tr>`; return; }
  body.innerHTML=rows.map(d=>`<tr><td>${esc(d.dept)}</td><td>${d.total}명</td><td>${d.active}명</td><td>${d.left}명</td><td>${d.upcoming}명</td></tr>`).join('');
}
function toggleRowMore(event, button){
  event.preventDefault();
  event.stopPropagation();
  const menu=button.closest('.row-more-menu');
  if(!menu) return;
  const panel=menu.querySelector('.row-more-menu-panel');
  const willOpen=!menu.classList.contains('open');
  closeAllRowMoreMenus();
  if(!willOpen || !panel) return;
  menu.classList.add('open');
  const rect=button.getBoundingClientRect();
  const panelWidth=120;
  const estimatedHeight=122;
  let left=Math.min(window.innerWidth-panelWidth-12,Math.max(12,rect.right-panelWidth));
  let top=rect.bottom+6;
  if(top+estimatedHeight>window.innerHeight-12) top=Math.max(12,rect.top-estimatedHeight-6);
  panel.style.left=`${left}px`;
  panel.style.top=`${top}px`;
  panel.style.right='auto';
}
function closeAllRowMoreMenus(){
  document.querySelectorAll('.row-more-menu.open').forEach(x=>{
    x.classList.remove('open');
    const panel=x.querySelector('.row-more-menu-panel');
    if(panel){panel.style.left='';panel.style.top='';panel.style.right='';}
  });
}
function listRowKeyActivate(event, action){
  if(event.key!=='Enter' && event.key!==' ') return;
  if(event.target.closest('button,select,a,input,label,summary,details')) return;
  event.preventDefault();
  action();
}
function updateEmployeeStatusTabCounts(){
  const labels={all:'전체',재직중:'재직자',퇴사:'퇴직자',입사예정:'입사예정자',휴직:'휴직'};
  document.querySelectorAll('#employeeStatusTabs [data-empstatus]').forEach(btn=>{
    const key=btn.dataset.empstatus;
    const count=key==='all' ? employees.length : employees.filter(e=>e.status===key).length;
    btn.innerHTML=`<span>${labels[key]||key}</span><small class="tab-count">${count}</small>`;
  });
}
function renderEmployees(){
  const body=$('employeesBody');
  if(!body) return;
  populateEmployeeFilterOptions();
  updateEmployeeStatusTabCounts();
  const all=employees.filter(employeeMatchesFilter).sort((a,b)=>(b.hireDate||'').localeCompare(a.hireDate||''));
  setText('employeesTotalCount', employees.length);
  setText('employeesActiveCount', employees.filter(e=>e.status==='재직중').length);
  setText('employeesLeftCount', employees.filter(e=>e.status==='퇴사').length);
  setText('employeesUpcomingCount', employees.filter(e=>e.status==='입사예정').length);
  const activeFilterCount=[employeeStatusFilter!=='all',employeeSearchName,employeeSearchNo,employeeDeptFilter!=='all',employeeRoleFilter!=='all',employeeSchoolSearch].filter(Boolean).length;
  const resultText=activeFilterCount ? `${all.length}명 / 전체 ${employees.length}명` : `${all.length}명 표시`;
  setText('employeeListSummary', resultText);
  const totalPages=Math.max(1, Math.ceil(all.length/employeePageSize));
  if(employeePage>totalPages) employeePage=totalPages;
  const start=(employeePage-1)*employeePageSize;
  const rows=all.slice(start, start+employeePageSize);
  renderEmployeePagination(totalPages, all.length);
  renderEmployeeDeptView();
  if(!all.length){ body.innerHTML=`<tr><td colspan="10" class="empty employee-empty-state"><strong>조건에 맞는 직원이 없습니다.</strong><span>검색어 또는 필터를 바꿔주세요.</span><button class="ghost" onclick="resetEmployeeFilters()">검색조건 초기화</button></td></tr>`; return; }
  body.innerHTML=rows.map(e=>`<tr class="employee-list-row clickable-data-row" tabindex="0" onclick="if(!event.target.closest('button,select,a,input,label,summary,details')) openEmployeeDetail('${e.id}')" onkeydown="listRowKeyActivate(event,()=>openEmployeeDetail('${e.id}'))">
    <td class="employee-no-cell" data-label="사번">${esc(e.empNo)||'-'}</td>
    <td class="employee-name-cell" data-label="이름"><button class="link-like employee-name-link" onclick="openEmployeeDetail('${e.id}')">${esc(e.name)}</button><small>${esc(e.department)||'부서 미입력'} · ${esc(e.role)||'직무 미입력'}</small></td>
    <td class="employee-dept-cell" data-label="부서">${esc(e.department)||'-'}</td>
    <td class="employee-role-cell" data-label="직무">${esc(e.role)||'-'}</td>
    <td class="employee-hire-cell" data-label="입사일">${esc(e.hireDate)||'-'}</td>
    <td class="employee-status-cell" data-label="상태"><span class="badge ${employeeStatusBadgeClass(e.status)}">${esc(e.status)}</span></td>
    <td class="employee-school-cell" data-label="출신학교">${esc(e.school)||'<span class="muted">미입력</span>'}</td>
    <td class="employee-notes-cell" data-label="비고">${esc(e.notes)||'-'}</td>
    <td class="employee-discipline-cell" data-label="상벌">${e.disciplineCount>0 ? `<span class="badge bad">${e.disciplineCount}건</span>` : '<span class="muted">없음</span>'}</td>
    <td class="row-actions employee-row-actions" data-label="관리"><button class="view" onclick="openEmployeeDetail('${e.id}')">상세</button><button onclick="editEmployeePrompt('${e.id}')">수정</button><div class="row-more-menu"><button type="button" class="row-more-toggle" onclick="toggleRowMore(event,this)">더보기</button><div class="row-more-menu-panel"><button class="delete" onclick="deleteEmployee('${e.id}')">삭제</button></div></div></td>
  </tr>`).join('');
}
function importEmployeesJson(list){
  if(!Array.isArray(list) || !list.length){ alert('직원명부 JSON 형식이 아니거나 비어 있습니다.'); return; }
  const byEmpNo={};
  employees.forEach(e=>{ if(e.empNo) byEmpNo[e.empNo]=e; });
  let added=0, updated=0, skipped=0;
  list.forEach(raw=>{
    const incoming=normalizeEmployee(raw);
    if(!incoming.name){ skipped++; return; }
    const existing=incoming.empNo ? byEmpNo[incoming.empNo] : null;
    if(existing){
      employees=employees.map(e=>e.id===existing.id ? normalizeEmployee({...e, ...incoming, id:existing.id, updatedAt:new Date().toISOString()}) : e);
      updated++;
    } else {
      const created=normalizeEmployee({...incoming, id:uid(), createdAt:new Date().toISOString()});
      employees.push(created);
      if(created.empNo) byEmpNo[created.empNo]=created;
      added++;
    }
  });
  saveEmployees();
  alert(`직원명부 가져오기 완료: 신규 ${added}명, 갱신 ${updated}명, 건너뜀 ${skipped}명.`);
}
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
function formatBirthDisplay(v){
  const raw = String(v || '').trim();
  if(!raw) return '';
  const digits = raw.replace(/\D/g,'');
  if(digits.length === 8) return `${digits.slice(0,4)}.${digits.slice(4,6)}.${digits.slice(6,8)}`;
  if(digits.length === 6) return `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}`;
  const ymd = raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if(ymd) return `${ymd[1]}.${ymd[2].padStart(2,'0')}.${ymd[3].padStart(2,'0')}`;
  const shortYmd = raw.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);
  if(shortYmd) return `${shortYmd[1]}.${shortYmd[2].padStart(2,'0')}.${shortYmd[3].padStart(2,'0')}`;
  return raw.replaceAll('-', '.').replaceAll('/', '.');
}
/* =========================================================
   v10.12.4 연락처 자동 하이픈 포맷
   - 010 1234 5678 / 010.1234.5678 / 01012345678 등 어떻게 입력해도
     저장 시점(normalize)에 010-1234-5678 형태로 통일
   - 서울 지역번호(02), 그 외 지역번호(0XX), 알 수 없는 형식은
     원래 숫자만 남긴 값으로 안전하게 폴백(잘못된 자리로 하이픈을
     끼워넣지 않음)
   ========================================================= */
function formatPhoneDisplay(v){
  const raw = String(v || '').trim();
  if(!raw) return '';
  const digits = raw.replace(/\D/g,'');
  if(!digits) return raw;
  if(digits.startsWith('02')){
    if(digits.length === 9) return `${digits.slice(0,2)}-${digits.slice(2,5)}-${digits.slice(5,9)}`;
    if(digits.length === 10) return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,10)}`;
    return digits;
  }
  if(digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
  if(digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
  return digits;
}
function textOf(a){
  return `${a.dormUse||''} ${a.extra||''} ${a.education||''} ${a.finalEducation||''} ${a.school||''} ${a.major||''}
    ${a.gradePoint||''} ${a.languageEtc||''} ${a.certs||''} ${a.career||''} ${a.lastCompany||''} ${a.duties||''}
    ${a.leaveReason||''} ${a.careerType||''} ${a.jobFitCategory||''} ${a.consult||''} ${a.memo||''}
    ${a.decisionReason||''} ${a.selfIntroKeywords||''}`.toLowerCase();
  }
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
  if(['입사예정','출근'].includes(status)) return 'good';
  if(['면접예정','다음면접'].includes(status)) return 'info';
  if(status==='서류탈락') return 'neutral';
  if(['불합격','철회'].includes(status)) return 'bad';
  return 'hold';
}
function statusToneClass(a){ return normalizeStatus(a?.status)==='서류탈락' ? 'is-paper-rejected' : ''; }
function nextAction(a){
  if(!a.status || a.status==='미연락') return '첫 연락 필요';
  if(a.status==='부재중') return '재연락';
  if(a.status==='면접예정') return '면접 일정 확인';
  if(a.status==='면접완료') return a.finalDecision ? a.finalDecision : '판정 입력';
  if(a.status==='다음면접') return '다음 면접 조율';
  if(a.status==='출근') return '출근 완료';
  if(a.status==='입사예정') return '입사 안내';
  
  return a.finalDecision || '-';
}
function isFinished(a){ return ['불합격','서류탈락','철회','연락두절'].includes(a.status) || ['불합격','입사포기'].includes(a.finalDecision); }
function isActive(a){ return !isFinished(a); }
function hasFinalDecision(a){ return !!String(a?.finalDecision || '').trim(); }
function isDecisionNeeded(a){ return isActive(a) && a.status === '면접완료' && !hasFinalDecision(a); }
function finalDecisionOf(a){ return a.finalDecision || grade(calcScore(a)); }

function datePlus(days){
  const d = new Date(today() + 'T00:00:00');
  d.setDate(d.getDate() + days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
}
function daysUntil(dateStr){
  if(!dateStr) return null;
  const base = new Date(today() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  if(Number.isNaN(target.getTime())) return null;
  return Math.round((target - base) / 86400000);
}
function daysSinceApply(a){
  const d = daysUntil(a.applyDate);
  return d===null ? null : -d;
}
function isDormPending(a){
  const d=dormLabel(a);
  return isActive(a) && (d === '미확인' || d === '확인필요');
}
function isHireSoon(a){
  const d = daysUntil(a.hireDate);
  return d !== null && d >= 0 && d <= 7 && isActive(a);
}
function countText(n){ return `${n}명`; }
function setText(id, value){ const el=$(id); if(el) el.textContent=value; }

function setPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active', p.id===page));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.page===page));
  const titleMap = {home:'홈',applicants:'지원자 목록',form:'신규 지원자 등록',today:'오늘 할 일',calendar:'일정관리',stats:'채용 통계',schools:'협력학교 관리',employees:'사원명부',templates:'안내문 템플릿',advancedSearch:'고급검색',dataHealth:'데이터 점검센터',duplicates:'중복 지원자 관리',backup:'백업/내보내기'};
  const descMap = {
    home:'오늘의 채용 업무와 주요 현황을 확인합니다.',
    applicants:'지원자 진행상태와 면접·입사 일정을 관리합니다.',
    form:'새 지원자의 기본정보와 전형정보를 등록합니다.',
    today:'오늘 우선 처리할 채용 업무를 확인합니다.',
    calendar:'면접·입사·관리 일정을 한눈에 확인합니다.',
    stats:'채용 흐름과 주요 성과지표를 분석합니다.',
    schools:'협력학교 현황과 지원자·직원 배출 정보를 관리합니다.',
    employees:'재직·휴직·퇴사 현황과 출신학교 정보를 확인합니다.',
    templates:'지원자 안내문을 빠르게 작성하고 복사합니다.',
    advancedSearch:'여러 검색조건을 조합하고 자주 쓰는 조건을 저장합니다.',
    dataHealth:'데이터 누락과 상태 불일치를 읽기 전용으로 점검합니다.',
    duplicates:'중복 후보와 재지원 기록을 사용자 확인 방식으로 검토합니다.',
    backup:'ERP 데이터를 안전하게 백업하고 복원합니다.'
  };
  $('page-title').textContent = titleMap[page] || '홈';
  const breadcrumb=document.querySelector('.topbar-breadcrumb');
  if(breadcrumb) breadcrumb.textContent=descMap[page] || 'Recruit ERP 운영 대시보드';
  if(window.innerWidth<=1020) document.body.classList.remove('sidebar-mobile-open');
  if(page==='form' && !$('applyDate').value) $('applyDate').value = today();
  const topActions = document.querySelector('.top-actions:not(.form-top-actions)');
  const formTopActions = document.querySelector('.form-top-actions');
  if(topActions) topActions.style.display = ['home','applicants'].includes(page) ? 'flex' : 'none';
  if(formTopActions) formTopActions.style.display = page==='form' ? 'flex' : 'none';
  renderAll();
}
function taskGroups(){
  const t=today();
  const todayInterviews=applicants.filter(a=>isActive(a) && a.interviewDate===t);
  const upcomingInterviews=applicants.filter(a=>{
    if(!isActive(a)) return false;
    if(a.interviewDate && a.interviewDate!==t && daysUntil(a.interviewDate) >= 0) return true;
    return ['면접예정','다음면접'].includes(a.status) && !a.interviewDate;
  }).sort((a,b)=>{
    const av=a.interviewDate || '9999-12-31';
    const bv=b.interviewDate || '9999-12-31';
    return (av+' '+(a.interviewTime||'23:59')).localeCompare(bv+' '+(b.interviewTime||'23:59'));
  });
  const recalls=applicants.filter(a=>isActive(a) && ['부재중','미연락'].includes(a.status));
  const dorms=applicants.filter(isDormPending);
  const hireD7=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===7);
  const hireD3=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===3);
  const hireToday=applicants.filter(a=>isActive(a) && daysUntil(a.hireDate)===0);
  const hireSoon=applicants.filter(isHireSoon);
  const decisions=applicants.filter(isDecisionNeeded);
  const weekInterviews=applicants.filter(a=>isActive(a) && a.interviewDate && daysUntil(a.interviewDate)>=0 && daysUntil(a.interviewDate)<=6);
  const overdue=applicants.filter(a=>{
    if(!isActive(a)) return false;
    const interviewOverdue=a.interviewDate && daysUntil(a.interviewDate)<0 && ['면접예정','다음면접'].includes(a.status);
    const hireOverdue=a.hireDate && daysUntil(a.hireDate)<0 && a.status==='입사예정';
    return interviewOverdue || hireOverdue;
  });
  const waits=applicants.filter(a=>isActive(a) && (['입사예정'].includes(a.status)||['입사예정','보류'].includes(a.finalDecision))); 
  return {todayInterviews,upcomingInterviews,tomorrowInterviews:upcomingInterviews,recalls,dorms,hireD7,hireD3,hireToday,hireSoon,decisions,weekInterviews,overdue,waits};
}
function renderStats(){
  const total=applicants.length;
  const active=applicants.filter(isActive).length;
  const g=taskGroups();
  const data=[
    ['전체 지원자',total],
    ['진행중',active],
    ['오늘 면접',g.todayInterviews.length],
    ['기한 경과',g.overdue.length]
  ];
  $('statsGrid').innerHTML=data.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
  setText('homeTodayInterviewCount',g.todayInterviews.length);
  setText('homeTomorrowInterviewCount',g.upcomingInterviews.length);
  setText('homeContactCount',g.recalls.length);
  setText('homeDormCheckCount',g.dorms.length);
  setText('homeCheckCount',g.dorms.length);
  setText('homeHireSoonCount',g.hireSoon.length);
  setText('homeWeekInterviewCount',g.weekInterviews.length);
  setText('homeOverdueCount',g.overdue.length);
  setText('homeDecisionCount',g.decisions.length);
}
function backupNotice(){
  const last = localStorage.getItem(BACKUP_KEY);
  const msg = last ? `마지막 JSON 백업: ${last}` : '백업은 백업/내보내기 메뉴에서 필요할 때 진행할 수 있습니다.';
  setText('backupAlert', msg);
  setText('lastBackupText', last || '기록 없음');
  setText('backupApplicantCount', countText(applicants.length));
  setText('backupStorageKey', STORAGE_KEY);
}
function shortNeeds(a){ return displayCheckNeeds(a.checkNeeds).split(',').map(x=>x.trim()).filter(Boolean).slice(0,2); }
function needsHtml(a){ const needs=shortNeeds(a); return needs.length?`<div class="need-tags">${needs.map(n=>`<span class="need-tag">${esc(n)}</span>`).join('')}</div>`:'-'; }
function card(a){
  const score=calcScore(a), decision=finalDecisionOf(a), dorm=dormLabel(a);
  const schedule=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ');
  const scheduleText=schedule ? `면접 ${schedule} · ` : '';
  return `<div class="person-card compact-person-card ${statusToneClass(a)}">
    <div><strong><span class="person-name ${genderClass(a)}">${esc(a.name||'이름없음')}</span>
    <span class="badge ${badgeClass(a.status)}">${esc(a.status||'미입력')}</span></strong>
    <small>${esc(scheduleText)}${esc(a.workplace||'근무지 미입력')} · ${esc(dorm)} · ${esc(displayCategory(a))} · ${score}점/${esc(decision)}</small></div>
    <button class="mini" onclick="editApplicant('${a.id}')">수정</button></div>`;
}
/* =========================================================
   v10.12.5 일정 리마인더 배너
   - 홈 화면 최상단에 오늘/내일 면접·입사·중요일정 요약 배너 표시
   - "오늘은 닫기" 누르면 그날 하루는 다시 안 뜨고, 날짜 바뀌면 자동 재노출
   - calendarItemsOn()을 그대로 재사용해 캘린더 데이터와 항상 일치
   ========================================================= */
function renderScheduleReminder(){
  const el = $('scheduleReminder');
  if(!el) return;
  const todayStr = today();
  if(localStorage.getItem(REMINDER_DISMISS_KEY) === todayStr){ el.style.display='none'; el.innerHTML=''; return; }
  const tomorrowStr = datePlus(1);
  const todayItems = calendarItemsOn(todayStr);
  const tomorrowItems = calendarItemsOn(tomorrowStr);
  const countType = (items, type) => items.filter(i=>i.type===type).length;
  const todayInterview = countType(todayItems,'면접');
  const todayHire = countType(todayItems,'입사');
  const tomorrowInterview = countType(tomorrowItems,'면접');
  const tomorrowHire = countType(tomorrowItems,'입사');
  const tomorrowImportant = tomorrowItems.filter(i=>i.kind==='custom' && ['high','urgent'].includes(i.importance)).length;
  const hasToday = todayInterview || todayHire;
  const hasTomorrow = tomorrowInterview || tomorrowHire || tomorrowImportant;
  if(!hasToday && !hasTomorrow){ el.style.display='none'; el.innerHTML=''; return; }
  const segs=[];
  if(hasToday) segs.push(`오늘: ${[todayInterview&&`면접 ${todayInterview}건`, todayHire&&`입사 ${todayHire}건`].filter(Boolean).join(' · ')}`);
  if(hasTomorrow) segs.push(`내일(${tomorrowStr.slice(5).replace('-','.')}): ${[tomorrowInterview&&`면접 ${tomorrowInterview}건`, tomorrowHire&&`입사 ${tomorrowHire}건`, tomorrowImportant&&`중요일정 ${tomorrowImportant}건`].filter(Boolean).join(' · ')}`);
  el.style.display='flex';
  el.innerHTML = `<div class="reminder-text"><strong>일정 알림</strong><span>${esc(segs.join('  ·  '))}</span></div><div class="reminder-actions"><button class="mini" onclick="setPage('calendar')">캘린더 보기</button><button class="mini" onclick="dismissScheduleReminder()">오늘은 닫기</button></div>`;
}
function dismissScheduleReminder(){ localStorage.setItem(REMINDER_DISMISS_KEY, today()); renderScheduleReminder(); }
function renderHomeLists(){
  const todayStr=today();
  const priority = applicants.filter(a=>
    (a.interviewDate===todayStr) ||
    ['미연락','부재중'].includes(a.status) ||
    isDormPending(a) ||
    isHireSoon(a) ||
    (a.interviewDate && daysUntil(a.interviewDate)<0 && ['면접예정','다음면접'].includes(a.status)) ||
    (a.hireDate && daysUntil(a.hireDate)<0 && a.status==='입사예정') ||
    (a.status==='면접완료' && !a.finalDecision)
  ).sort((a,b)=>{
    const ap = a.interviewDate===todayStr ? 0 : isHireSoon(a) ? 1 : ['미연락','부재중'].includes(a.status) ? 2 : isDormPending(a) ? 3 : 4;
    const bp = b.interviewDate===todayStr ? 0 : isHireSoon(b) ? 1 : ['미연락','부재중'].includes(b.status) ? 2 : isDormPending(b) ? 3 : 4;
    return ap-bp;
  }).slice(0,6);
  const recent=[...applicants].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  $('priorityList').innerHTML=priority.length?priority.map(card).join(''):`<div class="empty">오늘 우선 처리할 지원자가 없습니다.</div>`;
  $('recentList').innerHTML=recent.length?recent.map(card).join(''):`<div class="empty">등록된 지원자가 없습니다.</div>`;
}
function duplicatePhoneSet(){
  const counts={};
  applicants.forEach(a=>{
    const p=normalizePhone(a.phone);
    if(p.length>=8){ counts[p]=(counts[p]||0)+1; }
  });
  return new Set(Object.keys(counts).filter(p=>counts[p]>1));
}
function filtered(){
  const dupSet = currentFilter==='duplicate' ? duplicatePhoneSet() : null;
  let rows = applicants.filter(a=>{
    const workplaceOk=currentWorkplace==='all'||(currentWorkplace==='기타'?!['천안','평택'].includes(a.workplace):a.workplace===currentWorkplace);
    const text=Object.values(a).join(' ').toLowerCase();
    const searchOk=!currentSearch||text.includes(currentSearch.toLowerCase());
    const schoolOk=!currentSchoolFilterId||a.schoolId===currentSchoolFilterId;
    let filterOk=true;
    if(currentFilter==='priority') filterOk=finalDecisionOf(a)==='우선검토';
    if(currentFilter==='contact') filterOk=['미연락','부재중'].includes(a.status);
    if(currentFilter==='interview') filterOk=['면접예정','다음면접'].includes(a.status);
    if(currentFilter==='decision') filterOk=isDecisionNeeded(a);
    if(currentFilter==='hold') filterOk=a.finalDecision==='보류';
    if(currentFilter==='active') filterOk=isActive(a);
    if(currentFilter==='rejected') filterOk=a.status==='서류탈락';
    if(currentFilter==='duplicate') filterOk=dupSet.has(normalizePhone(a.phone));
    return workplaceOk && searchOk && schoolOk && filterOk;
  });
  if(hideFinished) rows = rows.filter(isActive);
  if(Array.isArray(window.__erpAdvancedFilterIds)) {
    const advancedIds = new Set(window.__erpAdvancedFilterIds);
    rows = rows.filter(a=>advancedIds.has(a.id));
  }
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
function resetListFiltersToAll(){
  currentWorkplace='all'; currentFilter='all'; currentSearch=''; currentSort='recent'; hideFinished=false; currentSchoolFilterId='';
  if($('searchInput')) $('searchInput').value='';
  if($('sortSelect')) $('sortSelect').value='recent';
  if($('hideFinished')) $('hideFinished').checked=false;
  document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.toggle('active', x.dataset.workplace==='all'));
  document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.toggle('active', x.dataset.filter==='all'));
}
function renderTable(){
  const rows=filtered();
  const dupChip=$('duplicateFilterChip');
  if(dupChip){ const dset=duplicatePhoneSet(); const n=applicants.filter(a=>dset.has(normalizePhone(a.phone))).length; dupChip.textContent = n ? `중복의심 ${n}명` : '중복의심'; dupChip.classList.toggle('chip-alert', n>0); }
  const sortName=$('sortSelect')?.selectedOptions?.[0]?.textContent || '최근 등록순';
  const contactCount=rows.filter(a=>['미연락','부재중'].includes(a.status)).length;
  const interviewCount=rows.filter(a=>['면접예정','다음면접'].includes(a.status) || a.interviewDate).length;
  const dormCount=rows.filter(a=>dormLabel(a)==='기숙사').length;
  const commuteCount=rows.filter(a=>dormLabel(a)==='출퇴근').length;
  const dormPendingCount=rows.filter(isDormPending).length;
  const schoolFilterName = currentSchoolFilterId ? (schools.find(s=>s.id===currentSchoolFilterId)?.name || '선택한 학교') : '';
  $('listSummary').innerHTML = `<span class="summary-strong">${rows.length}명</span> 표시 <span>정렬 ${esc(sortName)}</span><span>연락필요 ${contactCount}명</span><span>면접/예정 ${interviewCount}명</span><span class="summary-commute">출근방법: 기숙사 ${dormCount}명 · 출퇴근 ${commuteCount}명 · 확인 ${dormPendingCount}명</span>${hideFinished ? '<span>종료숨김 적용</span>' : ''}${schoolFilterName ? `<span class="workplace-pill school-filter-pill">학교 필터: ${esc(schoolFilterName)}<button onclick="currentSchoolFilterId='';renderTable();" aria-label="학교 필터 해제">×</button></span>` : ''}<span class="list-interaction-hint">행 클릭 → 상세보기</span>`;
  $('applicantTbody').innerHTML=rows.length?rows.map((a,idx)=>{
    const score=calcScore(a), decision=finalDecisionOf(a);
    const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ');
    const scheduleStrong = interview || '일정 미정';
    const scheduleNote = interview ? '' : (['면접예정','다음면접'].includes(a.status) ? '<small>일정 확인</small>' : '');
    const dorm = dormLabel(a);
    const typeLine = [a.batch, a.careerType, a.education].filter(Boolean).join(' · ') || '기본정보 미입력';
    const staleDays = ['미연락','부재중'].includes(a.status) ? daysSinceApply(a) : null;
    const staleBadge = (staleDays!==null && staleDays>=3) ? `<span class="stale-badge" title="지원일 기준 ${staleDays}일째 연락 안 됨">⏰${staleDays}일째</span>` : '';
    return `<tr class="applicant-row compact-row clickable-data-row ${statusToneClass(a)}" tabindex="0" onclick="if(!event.target.closest('button,select,a,input,label,summary,details')) viewApplicant('${a.id}')" onkeydown="listRowKeyActivate(event,()=>viewApplicant('${a.id}'))">
      <td class="no-cell sticky-app-col sticky-app-no" data-label="번호">${idx+1}</td>
      <td class="apply-date-cell sticky-app-col sticky-app-date" data-label="지원일">${esc(a.applyDate||'-')}</td>
      <td class="status-cell sticky-app-col sticky-app-status" data-label="상태"><select class="status-inline ${badgeClass(a.status)}" onchange="updateApplicantStatus('${a.id}', this.value)">${statusOptionsHtml(a.status)}</select></td>
      <td class="applicant-name-cell sticky-app-col sticky-app-name" data-label="성명"><button class="name-button ${genderClass(a)}" onclick="viewApplicant('${a.id}')">${esc(a.name||'이름없음')}</button>${staleBadge}<small>${esc(typeLine)}</small></td>
      <td class="phone-cell" data-label="연락처"><strong>${esc(a.phone||'')}</strong></td>
      <td class="email-cell" data-label="이메일">${a.email ? `<span>${esc(a.email)}</span>` : ''}</td>
      <td data-label="근무지"><span class="workplace-pill">${esc(a.workplace||'')}</span></td>
      <td class="region-cell" data-label="지역">${esc(a.region||'')}</td>
      <td class="schedule-cell" data-label="면접일정"><strong class="${interview?'':'muted-schedule'}">${esc(scheduleStrong)}</strong>${scheduleNote}</td>
      <td class="commute-cell" data-label="출근방법"><span class="dorm-pill ${dormClass(dorm)}">${esc(dorm)}</span></td>
      <td class="decision-cell" data-label="판정"><strong>${esc(decision)}</strong><small>${score}점</small></td>
      <td class="row-actions compact-actions applicant-actions" data-label="관리"><button class="view" onclick="viewApplicant('${a.id}')">상세</button><div class="row-more-menu"><button type="button" class="row-more-toggle applicant-more-toggle" aria-label="지원자 관리 메뉴" title="더보기">⋯</button><div class="row-more-menu-panel applicant-more-panel"><button onclick="editApplicant('${a.id}')">수정</button><button onclick="duplicateApplicant('${a.id}')">복제</button><button class="delete" onclick="deleteApplicant('${a.id}')">삭제</button></div></div></td>
    </tr>`;
  }).join(''):`<tr><td colspan="12" class="empty list-empty-cell"><div>조건에 맞는 지원자가 없습니다.</div><button class="mini" onclick="resetAndRenderList()">필터 초기화</button></td></tr>`;
}
function resetAndRenderList(){ resetListFiltersToAll(); renderTable(); }
/* =========================================================
   v10.29.0 지원자 → 직원명부 자동 연결
   - 지원자 status가 "출근"인데 아직 사원명부에 안 넘어간 사람을 찾아서
     "오늘 할 일"에 보여주고, 버튼 한 번으로 이름/학교/입사일을 그대로
     복사해 직원명부에 새로 등록함(다시 타이핑 안 해도 됨)
   - 한 번 등록하면 applicant.employeeId가 채워져서 다시 안 뜸
   ========================================================= */
function applicantsPendingEmployeeLink(){
  return applicants.filter(a=>a.status==='출근' && !a.employeeId);
}
function linkApplicantToEmployee(applicantId){
  const a=applicants.find(x=>x.id===applicantId);
  if(!a) return;
  const newEmployee=normalizeEmployee({
    name:a.name, school:a.school, schoolId:a.schoolId,
    department:a.workplace||'', hireDate:a.hireDate||a.applyDate||'',
    status:'재직중', notes:`Recruit ERP 지원자 연결(자동)`
  });
  employees.unshift(newEmployee);
  applicants = applicants.map(x=>x.id===applicantId ? {...x, employeeId:newEmployee.id, updatedAt:new Date().toISOString()} : x);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseSyncAll(applicants);
  saveEmployees();
  renderToday();
  renderHomeLists();
  alert(`"${a.name}"님을 직원명부에 등록했어요. 부서/직무/사번은 필요하면 사원명부에서 마저 채워주세요.`);
}
function dismissApplicantEmployeeLink(applicantId){
  if(!confirm('이 지원자는 직원명부에 자동으로 안 넣고 목록에서만 빼둘까요? (이미 따로 등록하셨거나, 이번엔 등록 안 하고 싶을 때 사용하세요)')) return;
  applicants = applicants.map(x=>x.id===applicantId ? {...x, employeeId:'수동처리', updatedAt:new Date().toISOString()} : x);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  supabaseSyncAll(applicants);
  renderToday();
}
function renderEmployeeLinkTask(){
  const el=$('employeeLinkList');
  if(!el) return;
  const rows=applicantsPendingEmployeeLink();
  setText('employeeLinkCount', rows.length);
  el.innerHTML = rows.length ? rows.map(a=>`<div class="person-card compact-person-card">
    <div><strong>${esc(a.name||'이름없음')}</strong>
    <small>${esc(a.school||'출신학교 미입력')} · 입사일 ${esc(a.hireDate||a.applyDate||'미입력')} · ${esc(a.workplace||'근무지 미입력')}</small></div>
    <div class="row-actions">
      <button class="mini" onclick="linkApplicantToEmployee('${a.id}')">직원명부에 추가</button>
      <button class="mini" onclick="dismissApplicantEmployeeLink('${a.id}')">건너뛰기</button>
    </div>
  </div>`).join('') : `<div class="empty">직원명부에 아직 안 넘어간 출근자가 없습니다.</div>`;
}
function renderToday(){
  const g=taskGroups();
  const hireSchedule=[...g.hireToday,...g.hireD3,...g.hireD7]
    .filter((a,idx,arr)=>arr.findIndex(x=>x.id===a.id)===idx)
    .sort((a,b)=>daysUntil(a.hireDate)-daysUntil(b.hireDate));
  const decisionWait=[...g.decisions,...g.waits]
    .filter((a,idx,arr)=>arr.findIndex(x=>x.id===a.id)===idx);
  const checkCount=g.dorms.length;
  const nearestInterview=g.upcomingInterviews.find(a=>a.interviewDate);
  const noDateInterviewCount=g.upcomingInterviews.filter(a=>!a.interviewDate).length;
  const nearestText=nearestInterview
    ? `가장 가까운: ${[nearestInterview.interviewDate, nearestInterview.interviewTime].filter(Boolean).join(' ')}${nearestInterview.name ? ' · '+nearestInterview.name : ''}`
    : (noDateInterviewCount ? `일정 미정 ${noDateInterviewCount}명` : '예정 없음');

  setText('todayInterviewCount',g.todayInterviews.length);
  setText('tomorrowInterviewCount',g.upcomingInterviews.length);
  setText('nearestInterviewText',nearestText);
  setText('recallCount',g.recalls.length);
  setText('todayCheckCount',checkCount);
  setText('hireScheduleCount',hireSchedule.length);
  setText('dormCheckCount',g.dorms.length);
  setText('decisionCount',g.decisions.length);
  setText('waitingCount',g.waits.length);

  $('todayInterview').innerHTML=g.todayInterviews.length?g.todayInterviews.map(card).join(''):`<div class="empty">오늘 면접자가 없습니다.</div>`;
  if($('tomorrowInterview')) $('tomorrowInterview').innerHTML=g.upcomingInterviews.length?g.upcomingInterviews.map(card).join(''):`<div class="empty">오늘 이후 면접 예정자 또는 일정 확인 대상이 없습니다.</div>`;
  $('recallList').innerHTML=g.recalls.length?g.recalls.map(card).join(''):`<div class="empty">연락 대상이 없습니다.</div>`;
  if($('dormCheckList')) $('dormCheckList').innerHTML=g.dorms.length?g.dorms.map(card).join(''):`<div class="empty">출근방법 확인 대상이 없습니다.</div>`;
  if($('hireScheduleList')) $('hireScheduleList').innerHTML=hireSchedule.length?hireSchedule.map(card).join(''):`<div class="empty">입사 일정 대상이 없습니다.</div>`;
  if($('decisionWaitList')) $('decisionWaitList').innerHTML=decisionWait.length?decisionWait.map(card).join(''):`<div class="empty">판정/대기 대상이 없습니다.</div>`;
}

/* =========================================================
   v10.12.2 일정관리 월간 캘린더
   - 지원자 면접일/입사예정일은 자동 일정으로 표시
   - 직접 입력 일정은 recruit_erp_calendar_events 별도 키에 저장
   - 기존 지원자 localStorage 키는 변경하지 않음
   ========================================================= */
function normalizeCalendarEvent(e){
  return {
    id:e.id||uid(), title:String(e.title||'').trim(), date:e.date||today(), time:e.time||'', type:e.type||'중요',
    workplace:e.workplace||'전체', importance:e.importance||'normal', memo:e.memo||'',
    createdAt:e.createdAt||new Date().toISOString(), updatedAt:e.updatedAt||''
  };
}
function loadCalendarEvents(){
  try{
    const raw=localStorage.getItem(CALENDAR_EVENTS_KEY);
    const data=raw?JSON.parse(raw):[];
    return Array.isArray(data)?data.map(normalizeCalendarEvent).filter(e=>e.title&&e.date):[];
  }catch(e){ console.warn('일정관리 데이터 로드 실패:', e); return []; }
}
function saveCalendarEvents(){ localStorage.setItem(CALENDAR_EVENTS_KEY, JSON.stringify(calendarEvents)); renderCalendar(); }
function calendarDateKey(d){ const x=new Date(d); x.setMinutes(x.getMinutes()-x.getTimezoneOffset()); return x.toISOString().slice(0,10); }
function calendarDateLabel(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  if(Number.isNaN(d.getTime())) return dateStr;
  const days=['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}(${days[d.getDay()]})`;
}
function calendarMonthLabel(){ return `${calendarCursor.getFullYear()}년 ${String(calendarCursor.getMonth()+1).padStart(2,'0')}월`; }
function monthKey(dateStr){ return String(dateStr||'').slice(0,7); }
function calendarFilterOk(item){
  if(calendarWorkplaceFilter==='전체') return true;
  const wp=item.workplace||'전체';
  if(wp==='전체') return true;
  if(calendarWorkplaceFilter==='기타') return !['천안','평택','전체'].includes(wp);
  return wp===calendarWorkplaceFilter;
}
function calendarAutoItems(){
  const items=[];
  applicants.forEach(a=>{
    if(a.interviewDate){
      items.push({kind:'auto',type:'면접',date:a.interviewDate,time:a.interviewTime||'',title:`${a.name||'이름없음'} 면접`,workplace:a.workplace||'',status:a.status||'',applicantId:a.id,memo:[a.phone,a.region,dormLabel(a)].filter(Boolean).join(' · ')});
    }
    if(a.hireDate){
      items.push({kind:'auto',type:'입사',date:a.hireDate,time:'',title:`${a.name||'이름없음'} 입사 예정`,workplace:a.workplace||'',status:a.status||'',applicantId:a.id,memo:[a.phone,a.region,dormLabel(a)].filter(Boolean).join(' · ')});
    }
  });
  return items;
}
function calendarAllItems(){
  const custom=calendarEvents.map(e=>({...e,kind:'custom'}));
  return [...calendarAutoItems(),...custom].filter(calendarFilterOk);
}
function calendarItemsOn(dateStr){
  return calendarAllItems().filter(i=>i.date===dateStr).sort((a,b)=>{
    const at=a.time||'99:99', bt=b.time||'99:99';
    if(at!==bt) return at.localeCompare(bt);
    const order={면접:1,입사:2,중요:3,회의:4,마감:5,교육:6,메모:7,기타:8};
    return (order[a.type]||9)-(order[b.type]||9);
  });
}
function calendarTypeClass(item){
  if(item.importance==='urgent') return 'calendar-type-urgent';
  if(item.type==='면접') return 'calendar-type-interview';
  if(item.type==='입사') return 'calendar-type-hire';
  return 'calendar-type-custom';
}
function renderCalendarWorkplaceOptions(){
  const sel=$('calendarWorkplaceFilter');
  if(!sel) return;
  const values=['전체','천안','평택','기타'];
  applicants.map(a=>a.workplace).filter(Boolean).forEach(v=>{ if(!values.includes(v)) values.push(v); });
  calendarEvents.map(e=>e.workplace).filter(Boolean).forEach(v=>{ if(!values.includes(v)) values.push(v); });
  const prev=sel.value||calendarWorkplaceFilter;
  sel.innerHTML=values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  sel.value=values.includes(prev)?prev:'전체';
  calendarWorkplaceFilter=sel.value;
}
function renderCalendar(){
  if(!$('calendarGrid')) return;
  renderCalendarWorkplaceOptions();
  setText('calendarMonthTitle', calendarMonthLabel());
  const y=calendarCursor.getFullYear(), m=calendarCursor.getMonth();
  const first=new Date(y,m,1);
  const start=new Date(y,m,1-first.getDay());
  const cells=[];
  const all=calendarAllItems();
  const curMonth=`${y}-${String(m+1).padStart(2,'0')}`;
  setText('calendarTodayCount', all.filter(i=>i.date===today()).length);
  setText('calendarMonthInterviewCount', all.filter(i=>i.type==='면접'&&monthKey(i.date)===curMonth).length);
  setText('calendarMonthHireCount', all.filter(i=>i.type==='입사'&&monthKey(i.date)===curMonth).length);
  setText('calendarMonthCustomCount', all.filter(i=>i.kind==='custom'&&monthKey(i.date)===curMonth).length);
  for(let i=0;i<42;i++){
    const d=new Date(start); d.setDate(start.getDate()+i);
    const dateStr=calendarDateKey(d);
    const inMonth=d.getMonth()===m;
    const dayItems=all.filter(item=>item.date===dateStr);
    const interviewItems=dayItems.filter(item=>item.type==='면접');
    const interviewCount=interviewItems.length;
    const hireCount=dayItems.filter(item=>item.type==='입사').length;
    const urgentCount=dayItems.filter(item=>item.importance==='urgent').length;
    const customCount=dayItems.filter(item=>item.kind==='custom').length;
    const interviewRegionMap={};
    interviewItems.forEach(item=>{
      const key=(item.workplace||'기타').trim()||'기타';
      interviewRegionMap[key]=(interviewRegionMap[key]||0)+1;
    });
    const regionOrder=['평택','천안','기타'];
    const interviewBreakdown=Object.keys(interviewRegionMap)
      .sort((a,b)=>{
        const ai=regionOrder.indexOf(a), bi=regionOrder.indexOf(b);
        if(ai===-1 && bi===-1) return a.localeCompare(b,'ko');
        if(ai===-1) return 1;
        if(bi===-1) return -1;
        return ai-bi;
      })
      .map(region=>`(${region}${interviewRegionMap[region]})`)
      .join(' ');
    const lines=[];
    if(interviewCount) lines.push(`<span class="calendar-day-line calendar-type-interview"><span class="calendar-line-main">면접 ${interviewCount}</span>${interviewBreakdown?`<span class="calendar-line-side">${interviewBreakdown}</span>`:''}</span>`);
    if(hireCount) lines.push(`<span class="calendar-day-line calendar-type-hire"><span class="calendar-line-main">입사 ${hireCount}</span></span>`);
    if(urgentCount) lines.push(`<span class="calendar-day-line calendar-type-urgent"><span class="calendar-line-main">매우중요 ${urgentCount}</span></span>`);
    else if(customCount) lines.push(`<span class="calendar-day-line calendar-type-custom"><span class="calendar-line-main">직접 ${customCount}</span></span>`);
    cells.push(`<button type="button" class="calendar-day ${inMonth?'':'other-month'} ${dateStr===today()?'today':''} ${dateStr===selectedCalendarDate?'selected':''}" onclick="selectCalendarDate('${dateStr}')">
      <span class="calendar-date-num"><span>${d.getDate()}</span>${dateStr===today()?'<span class="calendar-today-dot">오늘</span>':''}</span>
      <span class="calendar-day-lines">${lines.join('')}</span>
    </button>`);
  }
  $('calendarGrid').innerHTML=cells.join('');
  renderCalendarTimeline();
}
function renderCalendarTimeline(){
  if(!$('calendarTimeline')) return;
  setText('calendarSelectedTitle', calendarDateLabel(selectedCalendarDate));
  const list=calendarItemsOn(selectedCalendarDate);
  if($('calendarEventDate') && !$('calendarEventId')?.value) $('calendarEventDate').value=selectedCalendarDate;
  $('calendarTimeline').innerHTML=list.length?list.map(item=>{
    const badge=`<span class="calendar-time-badge ${calendarTypeClass(item)}">${item.time||'시간미정'} · ${esc(item.type)}</span>`;
    const detail=[item.workplace,item.status,item.memo].filter(Boolean).join(' · ');
    const actions=item.kind==='custom'
      ? `<button class="mini" onclick="editCalendarEvent('${item.id}')">수정</button><button class="mini danger" onclick="deleteCalendarEvent('${item.id}')">삭제</button>`
      : `<button class="mini" onclick="viewApplicant('${item.applicantId}')">상세</button><button class="mini" onclick="editApplicant('${item.applicantId}')">지원자 수정</button>`;
    return `<div class="calendar-timeline-item ${calendarTypeClass(item)}"><div class="calendar-timeline-main">${badge}<strong>${esc(item.title)}</strong><small>${esc(detail||'추가 정보 없음')}</small></div><div class="calendar-timeline-actions">${actions}</div></div>`;
  }).join(''):`<div class="empty">선택한 날짜에 등록된 일정이 없습니다. 오른쪽에서 직접 일정을 추가할 수 있어요.</div>`;
}
function selectCalendarDate(dateStr){
  selectedCalendarDate=dateStr;
  const d=new Date(dateStr+'T00:00:00');
  if(!Number.isNaN(d.getTime())){ calendarCursor=new Date(d.getFullYear(),d.getMonth(),1); }
  if($('calendarEventId') && !$('calendarEventId').value && $('calendarEventDate')) $('calendarEventDate').value=dateStr;
  renderCalendar();
}
function resetCalendarEventForm(){
  if(!$('calendarEventForm')) return;
  $('calendarEventForm').reset();
  $('calendarEventId').value='';
  $('calendarEventDate').value=selectedCalendarDate||today();
  if($('calendarEventType')) $('calendarEventType').value='중요';
  if($('calendarEventWorkplace')) $('calendarEventWorkplace').value='전체';
  if($('calendarEventImportance')) $('calendarEventImportance').value='normal';
  if($('btnCalendarDelete')) $('btnCalendarDelete').style.display='none';
}
function getCalendarForm(){
  return normalizeCalendarEvent({
    id:$('calendarEventId')?.value||'', title:$('calendarEventTitle')?.value||'', date:$('calendarEventDate')?.value||selectedCalendarDate,
    time:$('calendarEventTime')?.value||'', type:$('calendarEventType')?.value||'중요', workplace:$('calendarEventWorkplace')?.value||'전체',
    importance:$('calendarEventImportance')?.value||'normal', memo:$('calendarEventMemo')?.value||''
  });
}
function saveCalendarEventFromForm(e){
  e.preventDefault();
  const item=getCalendarForm();
  if(!item.title){ alert('일정명을 입력해주세요.'); return; }
  if(!item.date){ alert('날짜를 선택해주세요.'); return; }
  const idx=calendarEvents.findIndex(x=>x.id===item.id);
  if(idx>=0){ calendarEvents[idx]=normalizeCalendarEvent({...calendarEvents[idx],...item,updatedAt:new Date().toISOString()}); }
  else { calendarEvents.unshift(normalizeCalendarEvent({...item,id:uid(),createdAt:new Date().toISOString()})); }
  selectedCalendarDate=item.date;
  const d=new Date(item.date+'T00:00:00');
  if(!Number.isNaN(d.getTime())) calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  saveCalendarEvents();
  resetCalendarEventForm();
}
function editCalendarEvent(id){
  const e=calendarEvents.find(x=>x.id===id);
  if(!e) return;
  selectedCalendarDate=e.date;
  const d=new Date(e.date+'T00:00:00');
  if(!Number.isNaN(d.getTime())) calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
  $('calendarEventId').value=e.id;
  $('calendarEventTitle').value=e.title||'';
  $('calendarEventDate').value=e.date||today();
  $('calendarEventTime').value=e.time||'';
  $('calendarEventType').value=e.type||'중요';
  $('calendarEventWorkplace').value=e.workplace||'전체';
  $('calendarEventImportance').value=e.importance||'normal';
  $('calendarEventMemo').value=e.memo||'';
  if($('btnCalendarDelete')) $('btnCalendarDelete').style.display='inline-flex';
  renderCalendar();
}
function deleteCalendarEvent(id){
  const target=id || $('calendarEventId')?.value;
  if(!target) return;
  if(!confirm('이 일정을 삭제할까요?')) return;
  calendarEvents=calendarEvents.filter(e=>e.id!==target);
  saveCalendarEvents();
  resetCalendarEventForm();
}
function moveCalendarMonth(delta){ calendarCursor.setMonth(calendarCursor.getMonth()+delta); renderCalendar(); }
function goCalendarToday(){ selectedCalendarDate=today(); calendarCursor=new Date(today()+'T00:00:00'); calendarCursor.setDate(1); resetCalendarEventForm(); renderCalendar(); }

/* =========================================================
   v10.7 입사 통계
   - 연도별/월별/근무지별 입사인원(출근 상태 기준)
   - 출근방법별 인원(진행중 기준), 상태별 지원자 수(전체 기준)
   - 기존 함수/데이터 구조 변경 없이 신규 추가만 함

   v10.7.3 추가
   - 근무지 필터: 선택한 근무지 기준으로 모든 통계를 다시 계산
   - 근무지 목록은 하드코딩하지 않고 실제 데이터에서 자동 추출
     (나중에 근무지가 늘어나도 코드 수정 없이 선택지에 자동 반영)
   ========================================================= */
let statsWorkplaceFilter = '전체';
function statsWorkplaceValues(){
  return [...new Set(applicants.map(a=>a.workplace).filter(Boolean))].sort();
}
function statsScope(){
  return statsWorkplaceFilter === '전체' ? applicants : applicants.filter(a=>a.workplace===statsWorkplaceFilter);
}
function renderStatsWorkplaceFilter(){
  const sel=$('statsWorkplaceFilter');
  if(!sel) return;
  const values=['전체', ...statsWorkplaceValues()];
  const prev = sel.value || statsWorkplaceFilter;
  sel.innerHTML = values.map(v=>`<option value="${esc(v)}">${v==='전체'?'전체':esc(v)}</option>`).join('');
  sel.value = values.includes(prev) ? prev : '전체';
  statsWorkplaceFilter = sel.value;
}
function hireYearOf(a){ return a.hireDate ? a.hireDate.slice(0,4) : ''; }
function hireMonthOf(a){ return a.hireDate ? a.hireDate.slice(5,7) : ''; }
function statsHiredList(){ return statsScope().filter(a=>a.status==='출근'); }
function barRow(label, count, max){
  const pct = max>0 ? Math.round((count/max)*100) : 0;
  return `<div class="bar-row"><span class="bar-label">${esc(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="bar-count">${count}명</span></div>`;
}
function renderStatsSummary(){
  if(!$('statsSummaryGrid')) return;
  const scope=statsScope();
  const g=taskGroups();
  const scopeIds = statsWorkplaceFilter==='전체' ? null : new Set(scope.map(a=>a.id));
  const interviewSoon = scopeIds ? g.upcomingInterviews.filter(a=>scopeIds.has(a.id)).length : g.upcomingInterviews.length;
  const data=[
    ['전체 지원자', scope.length],
    ['출근(입사완료)', scope.filter(a=>a.status==='출근').length],
    ['입사예정', scope.filter(a=>a.status==='입사예정').length],
    ['면접예정', interviewSoon],
    ['진행중', scope.filter(isActive).length]
  ];
  $('statsSummaryGrid').innerHTML=data.map(([k,v])=>`<div class="stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
}
function renderStatsYear(){
  if(!$('statsYearList')) return;
  const hired=statsHiredList();
  const map={};
  hired.forEach(a=>{ const y=hireYearOf(a)||'미입력'; map[y]=(map[y]||0)+1; });
  const years=Object.keys(map).filter(y=>y!=='미입력').sort();
  if(map['미입력']) years.push('미입력');
  const max=Math.max(1,...years.map(y=>map[y]));
  $('statsYearList').innerHTML = years.length ? years.map(y=>barRow(y==='미입력'?y:y+'년', map[y], max)).join('') : `<div class="empty">출근 처리된 지원자가 없습니다.</div>`;
}
function statsYearOptions(){
  const hired=statsHiredList();
  const years=[...new Set(hired.map(hireYearOf).filter(Boolean))];
  const cur=String(new Date().getFullYear());
  if(!years.includes(cur)) years.push(cur);
  return years.sort();
}
function renderStatsMonth(){
  const sel=$('statsYearSelect');
  if(!sel || !$('statsMonthList')) return;
  const years=statsYearOptions();
  const prev=sel.value || String(new Date().getFullYear());
  sel.innerHTML=years.map(y=>`<option value="${y}">${y}년</option>`).join('');
  sel.value = years.includes(prev) ? prev : String(new Date().getFullYear());
  const year=sel.value;
  const hired=statsHiredList().filter(a=>hireYearOf(a)===year);
  const counts=Array.from({length:12},()=>0);
  hired.forEach(a=>{ const m=Number(hireMonthOf(a)); if(m>=1&&m<=12) counts[m-1]++; });
  const max=Math.max(1,...counts);
  $('statsMonthList').innerHTML = counts.map((c,i)=>barRow((i+1)+'월', c, max)).join('');
}
function renderStatsWorkplace(){
  if(!$('statsWorkplaceList')) return;
  const hired=statsHiredList();
  const groups=statsWorkplaceValues();
  const map={};
  groups.forEach(g=>map[g]=0);
  hired.forEach(a=>{ if(map[a.workplace]!==undefined) map[a.workplace]++; });
  const max=Math.max(1,...groups.map(g=>map[g]));
  $('statsWorkplaceList').innerHTML = hired.length ? groups.map(g=>barRow(g, map[g], max)).join('') : `<div class="empty">출근 처리된 지원자가 없습니다.</div>`;
}
function renderStatsDorm(){
  if(!$('statsDormList')) return;
  const rows=statsScope().filter(isActive);
  const map={기숙사:0,출퇴근:0,확인필요:0};
  rows.forEach(a=>{ const d=dormLabel(a); const key = d==='미확인' ? '확인필요' : d; if(map[key]!==undefined) map[key]++; });
  const max=Math.max(1,...Object.values(map));
  $('statsDormList').innerHTML = rows.length ? Object.entries(map).map(([k,v])=>barRow(k,v,max)).join('') : `<div class="empty">진행중인 지원자가 없습니다.</div>`;
}
function renderStatsStatus(){
  if(!$('statsStatusList')) return;
  const scope=statsScope();
  const map={};
  STATUS_OPTIONS.forEach(s=>map[s]=0);
  scope.forEach(a=>{ const s=normalizeStatus(a.status); if(map[s]!==undefined) map[s]++; });
  const max=Math.max(1,...STATUS_OPTIONS.map(s=>map[s]));
  $('statsStatusList').innerHTML = scope.length ? STATUS_OPTIONS.map(s=>barRow(s, map[s], max)).join('') : `<div class="empty">등록된 지원자가 없습니다.</div>`;
}
function applyMonthOf(a){ return a.applyDate ? a.applyDate.slice(0,7) : ''; }
function isInterviewed(a){ return !!a.interviewDate && daysUntil(a.interviewDate) <= 0; }
function isPassed(a){ return ['입사예정','출근'].includes(a.status); }
function funnelRowCells(v){
  const rate = v.apply ? Math.round((v.pass/v.apply)*100) : 0;
  return `<td>${v.apply}명</td><td>${v.interview}명</td><td>${v.pass}명</td><td>${rate}%</td>`;
}
function renderStatsFunnel(){
  if(!$('statsFunnelBody')) return;
  const map={};
  statsScope().forEach(a=>{
    const m=applyMonthOf(a);
    if(!m) return;
    if(!map[m]) map[m]={apply:0,interview:0,pass:0};
    map[m].apply++;
    if(isInterviewed(a)) map[m].interview++;
    if(isPassed(a)) map[m].pass++;
  });
  const months=Object.keys(map).sort();
  if(!months.length){ $('statsFunnelBody').innerHTML=`<tr><td colspan="5" class="empty">지원일이 입력된 지원자가 없습니다.</td></tr>`; return; }
  const total=months.reduce((acc,m)=>{ acc.apply+=map[m].apply; acc.interview+=map[m].interview; acc.pass+=map[m].pass; return acc; },{apply:0,interview:0,pass:0});
  const rows=months.map(m=>`<tr><td>${esc(m)}</td>${funnelRowCells(map[m])}</tr>`).join('');
  const totalRow=`<tr class="funnel-total-row"><td>전체 합계</td>${funnelRowCells(total)}</tr>`;
  $('statsFunnelBody').innerHTML = rows + totalRow;
}
function renderStatsSource(){
  if(!$('statsSourceBody')) return;
  const map={};
  statsScope().forEach(a=>{
    const s=(a.source||'').trim() || '미입력';
    if(!map[s]) map[s]={apply:0,interview:0,pass:0};
    map[s].apply++;
    if(isInterviewed(a)) map[s].interview++;
    if(isPassed(a)) map[s].pass++;
  });
  const sources=Object.keys(map).sort((a,b)=>map[b].apply-map[a].apply);
  if(!sources.length){ $('statsSourceBody').innerHTML=`<tr><td colspan="5" class="empty">지원경로가 입력된 지원자가 없습니다.</td></tr>`; return; }
  const total=sources.reduce((acc,s)=>{ acc.apply+=map[s].apply; acc.interview+=map[s].interview; acc.pass+=map[s].pass; return acc; },{apply:0,interview:0,pass:0});
  const rows=sources.map(s=>`<tr><td>${esc(s)}</td>${funnelRowCells(map[s])}</tr>`).join('');
  const totalRow=`<tr class="funnel-total-row"><td>전체 합계</td>${funnelRowCells(total)}</tr>`;
  $('statsSourceBody').innerHTML = rows + totalRow;
}
const BATCH_TARGET_KEY = 'recruit_erp_batch_targets';
function getBatchTargets(){
  try{ return JSON.parse(localStorage.getItem(BATCH_TARGET_KEY)||'{}'); }catch{ return {}; }
}
function promptBatchTarget(batchName){
  const targets=getBatchTargets();
  const cur=targets[batchName]||'';
  const v=prompt(`"${batchName}" 배치의 채용 목표 인원을 숫자로 입력하세요.\n(합격=입사예정 또는 출근 상태 기준으로 진행률을 계산합니다. 비우면 목표 해제)`, cur);
  if(v===null) return;
  const n=parseInt(v,10);
  if(Number.isFinite(n) && n>0){ targets[batchName]=n; } else { delete targets[batchName]; }
  localStorage.setItem(BATCH_TARGET_KEY, JSON.stringify(targets));
  renderStatsBatch();
}
function renderStatsBatch(){
  if(!$('statsBatchBody')) return;
  const map={};
  statsScope().forEach(a=>{
    const b=(a.batch||'').trim() || '기수 미지정';
    if(!map[b]) map[b]={apply:0,interview:0,pass:0};
    map[b].apply++;
    if(isInterviewed(a)) map[b].interview++;
    if(isPassed(a)) map[b].pass++;
  });
  const batches=Object.keys(map).sort((a,b)=>map[b].apply-map[a].apply);
  if(!batches.length){ $('statsBatchBody').innerHTML=`<tr><td colspan="6" class="empty">기수/배치가 입력된 지원자가 없습니다. 지원자 입력 화면에서 "기수/배치" 칸을 채워주세요.</td></tr>`; return; }
  const targets=getBatchTargets();
  $('statsBatchBody').innerHTML = batches.map(b=>{
    const v=map[b];
    const rate = v.apply ? Math.round((v.pass/v.apply)*100) : 0;
    const target=targets[b]||0;
    const progressCell = target
      ? `<div class="batch-progress"><div class="batch-progress-track"><div class="batch-progress-fill" style="width:${Math.min(100,Math.round((v.pass/target)*100))}%"></div></div><span>${v.pass}/${target}명 · <button class="mini" onclick="promptBatchTarget('${esc(b)}')">수정</button></span></div>`
      : `<button class="mini" onclick="promptBatchTarget('${esc(b)}')">목표 설정</button>`;
    return `<tr><td>${esc(b)}</td><td>${v.apply}명</td><td>${v.interview}명</td><td>${v.pass}명</td><td>${rate}%</td><td>${progressCell}</td></tr>`;
  }).join('');
}
function renderHireStats(){ renderStatsWorkplaceFilter(); renderStatsSummary(); renderStatsYear(); renderStatsMonth(); renderStatsWorkplace(); renderStatsDorm(); renderStatsStatus(); renderStatsFunnel(); renderStatsSource(); renderStatsBatch(); }

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
  const retiredCount = list.filter(e=>e.status==='퇴사').length;
  const now = new Date();
  let tenureSum=0, tenureN=0;
  list.forEach(e=>{
    if(!e.hireDate) return;
    const hire=new Date(e.hireDate);
    if(isNaN(hire)) return;
    let endDate=null;
    if(e.status==='퇴사' && e.leaveDate){ endDate=new Date(e.leaveDate); if(isNaN(endDate)) endDate=null; }
    else if(e.status==='재직중'){ endDate=now; }
    if(!endDate) return;
    const months=(endDate.getFullYear()-hire.getFullYear())*12+(endDate.getMonth()-hire.getMonth());
    if(months<0) return;
    tenureSum+=months; tenureN++;
  });
  const disciplined = list.filter(e=>e.disciplineCount>0).length;
  const totalHeadcount = activeCount + retiredCount;
  return {
    activeCount, retiredCount, totalHeadcount,
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


function renderBatchOptions(){
  const el=$('batchOptions');
  if(!el) return;
  const values=[...new Set(applicants.map(a=>a.batch).filter(Boolean))].sort();
  el.innerHTML = values.map(v=>`<option value="${esc(v)}"></option>`).join('');
}
function renderAll(){ renderStats(); backupNotice(); renderScheduleReminder(); renderHomeLists(); renderTable(); renderToday(); renderEmployeeLinkTask(); renderCalendar(); renderHireStats(); populateSchoolDatalist(); renderSchools(); renderSchoolManage(); renderEmployees(); updateScorePreview(); renderBatchOptions(); }

const fields=['editId','applyDate','source','extra','status','workplace','batch','name','phone','email',
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
function resetForm(){ $('applicantForm').reset(); setChecked('checkNeeds',''); setChecked('selfIntroKeywords',
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
상태: ${a.status||'-'} / 출근방법: ${dormLabel(a)} / 기타: ${a.extra||'-'} / 판정: ${finalDecisionOf(a)} / 검토점수: ${score}점
직무적합: ${displayCategory(a)} / 경력구분: ${a.careerType||'-'}
학력구분: ${a.education||'-'} / 학교·전공: ${[a.school,a.major].filter(Boolean).join(' / ')||'-'} / 외국어·기타자격: ${a.languageEtc||'-'}
세부점수: 전공 ${sc.major}/25, 경력 ${sc.career}/35, 자격 ${sc.cert}/20, 현장 ${sc.field}/20
확인필요: ${displayCheckNeeds(a.checkNeeds)||'-'}
자격증: ${a.certs||'-'}
판정/메모: ${[a.memo,a.decisionReason].filter(Boolean).join(' / ')||'-'}`; }
function viewApplicant(id){
  const a=applicants.find(x=>x.id===id); if(!a) return;
  detailCurrentId=id; const score=calcScore(a); const sc=deriveScores(a);
  const interview=[a.interviewDate,a.interviewTime].filter(Boolean).join(' ') || '일정 미정';
  const dorm=dormLabel(a);
  const decision=finalDecisionOf(a);
  const action=nextAction(a);
  const profileSub=[a.careerType,a.education,a.workplace].filter(Boolean).join(' · ') || '지원자 기본정보';
  const status=normalizeStatus(a.status);
  const rejectedCls=statusToneClass(a);
  const detailSection=(title, rows, cls='')=>rows ? `<section class="detail-section-card detail-section-v108 ${cls}"><div class="detail-section-title"><h4>${title}</h4></div><div class="detail-grid detail-grid-v108">${rows}</div></section>` : '';
  const longBlock=(title, value, cls='')=>{
    const v=String(value ?? '').trim();
    if(!v) return '';
    return `<section class="detail-section-card detail-section-v108 detail-long-section ${cls}"><div class="detail-section-title"><h4>${title}</h4></div><p>${esc(v)}</p></section>`;
  };

  const profile = `<div class="profile-hero-detail detail-hero-v109 ${rejectedCls}">
    <div class="detail-hero-main-v109">
      <p class="eyebrow">APPLICANT PROFILE</p>
      <h2 class="detail-name ${genderClass(a)}">${esc(a.name||'이름없음')}</h2>
      <p class="detail-subline">${esc(profileSub)}</p>
      <div class="profile-badges"><span class="badge ${badgeClass(status)}">${esc(status||'미입력')}</span><span class="dorm-pill ${dormClass(dorm)}">${
        esc(dorm)}</span><span class="workplace-pill">${esc(a.workplace||'근무지 미입력')}</span></div>
    </div>
    <div class="detail-summary-v109">
      <div><span>판정</span><strong>${esc(decision)}</strong></div>
      <div><span>다음액션</span><strong>${esc(action)}</strong></div>
    </div>
  </div>`;

  const core = `<div class="detail-core-card detail-core-v108">
    ${coreItem('연락처',a.phone)}${coreItem('이메일',a.email)}${coreItem('지원일',a.applyDate)}${coreItem('지원경로',a.source)}
    ${coreItem('근무지',a.workplace)}${coreItem('출근방법',dorm)}${coreItem('면접일정',interview)}${coreItem('입사예정일',a.hireDate)}
  </div>`;

  const personalRows = [
    detailRow('성별',a.gender), detailRow('생년월일/연령',[a.birthYear,a.age&&a.age+'세'].filter(Boolean).join(' / ')), detailRow('거주지역',a.region), detailRow('경력구분',a.careerType)
  ].join('');
  const educationRows = [
    detailRow('학력구분',a.education), detailRow('학교/전공',[a.school,a.major].filter(Boolean).join(' / ')),
      detailRow('자격증',a.certs,'wide-row'), detailRow('외국어/기타자격',a.languageEtc,'wide-row'), detailRow('기타',
      a.extra,'wide-row')
  ].join('');
  const jobRows = [
    detailRow('직무적합',displayCategory(a)), detailRow('확인필요사항',displayCheckNeeds(a.checkNeeds),'wide-row'), detailRow('자소서/태도 키워드',a.selfIntroKeywords,'wide-row')
  ].join('');
  const memoRows = [
    longBlock('상담내용', a.consult, 'memo-primary'),
    longBlock('메모·다음액션', a.memo),
    longBlock('판정사유·참고', a.decisionReason)
  ].filter(Boolean).join('');
  const careerBlock = longBlock('경력사항', a.career, 'career-long detail-career-v109');

  $('detailTitle').textContent = `${a.name||'이름없음'} · 상세 프로필`;
  $('detailBody').innerHTML = `
    ${profile}
    ${core}
    ${memoRows ? `<div class="detail-memo-stack-v109">${memoRows}</div>` : ''}
    <div class="detail-info-board-v109">
      ${detailSection('인적사항', personalRows)}
      ${detailSection('학력·자격 정보', educationRows)}
      ${detailSection('검토 참고정보', jobRows)}
    </div>
    ${careerBlock}
    <section class="detail-score-section detail-score-v108 detail-score-v109"><div class="detail-section-title"><h4>검토점수</h4><span>참고용 자동 점수</span></div><div class="detail-score"><strong>${
      score}점</strong><span>${esc(decision)}</span><small>${esc(displayCategory(a))} · ${esc(action)}</small></div>
    <div class="detail-score-grid"><div><span>전공적합</span><strong>${sc.major}/25</strong></div><div><span>경력적합</span><strong>${
      sc.career}/35</strong></div><div><span>자격적합</span><strong>${sc.cert}/20</strong></div><div><span>현장적응</span><strong>${
      sc.field}/20</strong></div></div></section>`;
  $('detailModal').classList.add('show');
}
function closeDetail(){ $('detailModal').classList.remove('show'); detailCurrentId=''; }
/* =========================================================
   v10.30.0 학교 상세 화면 — 학교 관계관리
   - 기존 지원자 상세보기 모달과 같은 CSS(.detail-grid/.detail-row/.core-item)를
     그대로 재사용해서 통일감 있게 만듦
   - 채용성과는 applicants, 재직성과는 schoolEmployeeStats()에서 실시간 계산
   - 관리이력(최근연락일/다음연락예정일/최근채용의뢰)만 이 화면에서 직접 입력
   ========================================================= */
let schoolDetailCurrentId='';
let schoolDetailInitialHistory='';
function schoolRecruitStats(schoolId){
  const list = applicants.filter(a=>a.schoolId===schoolId);
  const total = list.length;
  const docPassStatuses=['면접예정','면접완료','다음면접','입사예정','출근'];
  const docPass = list.filter(a=>docPassStatuses.includes(normalizeStatus(a.status))).length;
  const interview = list.filter(a=>['면접완료','다음면접','입사예정','출근'].includes(normalizeStatus(a.status)) || isInterviewed(a)).length;
  const hireConfirmed = list.filter(a=>['입사예정','출근'].includes(normalizeStatus(a.status))).length;
  const started = list.filter(a=>normalizeStatus(a.status)==='출근').length;
  let latestApply='';
  list.forEach(a=>{ if(!latestApply || (a.applyDate||'')>latestApply) latestApply=a.applyDate||''; });
  return { total, docPass, interview, hireConfirmed, started, hireRate: total ? Math.round(hireConfirmed/total*1000)/10 : null, latestApply };
}
function schoolHistorySnapshot(){
  return JSON.stringify({
    lastContactDate:$('schoolDetailLastContact')?.value||'',
    nextContactDate:$('schoolDetailNextContact')?.value||'',
    lastRequestNote:$('schoolDetailRequestNote')?.value||''
  });
}
function schoolHistoryChanged(){ return !!schoolDetailCurrentId && schoolDetailInitialHistory && schoolHistorySnapshot()!==schoolDetailInitialHistory; }
function schoolNextContactStatus(date){
  if(!date) return '<span class="school-date-status neutral">예정일 미등록</span>';
  const d=daysUntil(date);
  if(d===null) return '';
  if(d<0) return `<span class="school-date-status overdue">${Math.abs(d)}일 지남</span>`;
  if(d===0) return '<span class="school-date-status today">오늘 연락 예정</span>';
  return `<span class="school-date-status upcoming">D-${d}</span>`;
}
function schoolKpiItem(label, value, action='', help=''){
  const attrs=action ? ` role="button" tabindex="0" onclick="${action}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${action}}"` : '';
  return `<div class="school-kpi-item${action?' is-clickable':''}"${attrs}><span>${esc(label)}</span><strong>${esc(String(value ?? '-'))}</strong>${help?`<small>${esc(help)}</small>`:''}${action?'<em>목록 보기 →</em>':''}</div>`;
}
function openSchoolDetail(schoolId){
  const s=schools.find(x=>x.id===schoolId);
  if(!s) return;
  schoolDetailCurrentId=schoolId;
  renderSchoolDetail();
  $('schoolDetailModal').classList.add('show');
}
function closeSchoolDetail(force=false){
  if(!force && schoolHistoryChanged() && !confirm('저장하지 않은 관리이력 변경사항이 있습니다.\n그래도 닫을까요?')) return;
  $('schoolDetailModal').classList.remove('show');
  schoolDetailCurrentId='';
  schoolDetailInitialHistory='';
}
function renderSchoolDetail(){
  const s=schools.find(x=>x.id===schoolDetailCurrentId);
  if(!s) return;
  const rec=schoolRecruitStats(s.id);
  const hr=schoolEmployeeStats(s.id);
  const activeCount=hr?.activeCount||0;
  const totalHeadcount=hr?.totalHeadcount||0;
  const retiredCount=hr?.retiredCount||0;
  $('schoolDetailTitle').textContent=`${s.name} · 학교 상세`;
  const identitySub=[s.region,schoolTypeGroupDetail(s.type),schoolManagementStatusLabel(s.managementStatus)].filter(Boolean).join(' · ')||'학교 기본정보';
  const basicRows=[
    detailRow('학교명', s.name),
    detailRow('지역', s.region||'-'),
    detailRow('유형', schoolTypeGroupDetail(s.type)||'-'),
    detailRow('관리상태', schoolManagementStatusLabel(s.managementStatus)),
    detailRow('담당자', s.contact),
    detailRow('연락처', s.contactPhone),
    detailRow('MOU 체결일', s.mouDate),
    detailRow('비고', s.notes, 'wide-row'),
  ].join('');
  const recruitRows=[
    schoolKpiItem('총 지원자', rec.total+'명', `closeSchoolDetail(true);viewSchoolApplicants('${s.id}')`, '연결된 지원자 전체'),
    schoolKpiItem('서류합격', rec.docPass+'명', '', '면접 단계 이상'),
    schoolKpiItem('면접 실시', rec.interview+'명', '', '면접일 경과 또는 면접완료'),
    schoolKpiItem('입사 확정', rec.hireConfirmed+'명', '', `출근완료 ${rec.started}명`),
    schoolKpiItem('입사 확정률', rec.hireRate!=null ? rec.hireRate+'%' : '-', '', '총 지원자 대비'),
    schoolKpiItem('최근 지원일', rec.latestApply||'-'),
  ].join('');
  const hrRows = hr ? [
    schoolKpiItem('총 배출인원', totalHeadcount+'명', `closeSchoolDetail(true);viewSchoolEmployees('${s.id}','${escJs(s.name)}')`, `퇴사 ${retiredCount}명 포함`),
    schoolKpiItem('현재 재직', activeCount+'명', `closeSchoolDetail(true);viewSchoolEmployees('${s.id}','${escJs(s.name)}')`, '사원명부 연결 기준'),
    schoolKpiItem('평균근속', hr.avgTenureMonths!=null ? Math.round(hr.avgTenureMonths)+'개월' : '-', '', '재직·퇴사 전체 기준'),
    schoolKpiItem('무사고율', hr.disciplineRate!=null ? Math.round(100-hr.disciplineRate)+'%' : '-', '', '상벌 기록 기준'),
  ].join('') : '';
  $('schoolDetailBody').innerHTML=`
    <section class="school-detail-hero">
      <div><p class="eyebrow">SCHOOL OVERVIEW</p><h2>${esc(s.name)}</h2><p>${esc(identitySub)}</p></div>
      <div class="school-detail-hero-kpis">
        ${schoolKpiItem('총 지원자', rec.total+'명', `closeSchoolDetail(true);viewSchoolApplicants('${s.id}')`)}
        ${schoolKpiItem('현재 재직', activeCount+'명', `closeSchoolDetail(true);viewSchoolEmployees('${s.id}','${escJs(s.name)}')`)}
        ${schoolKpiItem('입사 확정', rec.hireConfirmed+'명')}
        ${schoolKpiItem('평균근속', hr?.avgTenureMonths!=null ? Math.round(hr.avgTenureMonths)+'개월' : '-')}
      </div>
    </section>
    <section class="summary-card school-detail-section"><div class="school-detail-section-head"><div><h4>기본정보</h4><p>학교와 담당자 정보를 확인합니다.</p></div></div><div class="detail-grid school-basic-grid">${basicRows}</div></section>
    <section class="summary-card school-detail-section"><div class="school-detail-section-head"><div><h4>채용성과</h4><p>지원부터 입사 확정까지의 흐름입니다.</p></div></div><div class="school-detail-kpi-grid">${recruitRows}</div></section>
    <section class="summary-card school-detail-section"><div class="school-detail-section-head"><div><h4>재직성과</h4><p>사원명부에 연결된 인원의 재직 결과입니다.</p></div></div>${hr ? `<div class="school-detail-kpi-grid school-detail-hr-grid">${hrRows}</div>` : '<div class="empty">사원명부에 연결된 직원이 없습니다.</div>'}</section>
    <section class="summary-card school-detail-section school-history-card">
      <div class="school-detail-section-head"><div><h4>관리이력</h4><p>최근 학교 연락과 다음 할 일을 기록합니다. 이 부분만 직접 수정됩니다.</p></div></div>
      <div class="form-grid compact school-history-grid">
        <label>최근 연락일<input type="date" id="schoolDetailLastContact" value="${esc(s.lastContactDate||'')}" /></label>
        <label>다음 연락 예정일<input type="date" id="schoolDetailNextContact" value="${esc(s.nextContactDate||'')}" /><span id="schoolDetailNextContactStatus">${schoolNextContactStatus(s.nextContactDate||'')}</span></label>
        <label class="wide">최근 채용 의뢰<input id="schoolDetailRequestNote" value="${esc(s.lastRequestNote||'')}" placeholder="예: 2026년 하반기 3명 요청" /></label>
      </div>
    </section>`;
  schoolDetailInitialHistory=schoolHistorySnapshot();
  updateSchoolDetailSaveState();
  const historyInputs=['schoolDetailLastContact','schoolDetailNextContact','schoolDetailRequestNote'];
  historyInputs.forEach(id=>$(id)?.addEventListener('input',()=>{
    if(id==='schoolDetailNextContact') $('schoolDetailNextContactStatus').innerHTML=schoolNextContactStatus($(id).value);
    updateSchoolDetailSaveState();
  }));
}
function updateSchoolDetailSaveState(){
  const el=$('schoolDetailSaveState');
  if(!el) return;
  const changed=schoolHistoryChanged();
  el.textContent=changed?'저장하지 않은 변경사항':'저장된 상태';
  el.classList.toggle('is-dirty',changed);
}
function saveSchoolDetailHistory(){
  const s=schools.find(x=>x.id===schoolDetailCurrentId);
  if(!s) return;
  s.lastContactDate=$('schoolDetailLastContact')?.value||'';
  s.nextContactDate=$('schoolDetailNextContact')?.value||'';
  s.lastRequestNote=$('schoolDetailRequestNote')?.value||'';
  s.updatedAt=new Date().toISOString();
  saveSchools();
  renderSchoolDetail();
  renderSchoolManage();
  alert('관리이력이 안전하게 저장됐습니다.');
}
/* =========================================================
   v10.34.3 직원 상세 모달 ( 빌드 — DB/Supabase 연결 없음)
   - 학교 상세 모달과 같은 CSS(.detail-grid/.core-item)를 재사용
   - 이번 단계 범위: 모달 UI, 이름클릭 연결, 5개 섹션 표시만
   - 휴직/발령은 employees의 단일 필드가 아니라 별도 이력 배열로 설계
     (한 사람이 여러 번 휴직/발령날 수 있으므로)
   - 저장 기능은 다음 단계에서 연결 예정. 지금은 항상 빈 배열이라
     "이력 없음"으로 보이는 게 정상입니다.

   예정 스키마 (다음 단계에서 Supabase 테이블로 그대로 옮길 구조):
   employeeLeaves: {
     id, employeeId, empNo, leaveType, startDate,
     expectedReturnDate, actualReturnDate, status, note,
     createdAt, updatedAt
   }
   employeeChanges: {
     id, employeeId, empNo, changeType, fromValue, toValue,
     note, createdAt
   }
   ========================================================= */
let employeeDetailCurrentId='';
let employeeLeaves=[];   // 다음 단계에서 loadEmployeeLeaves()로 교체 예정
let employeeChanges=[];  // 다음 단계에서 loadEmployeeChanges()로 교체 예정
function openEmployeeDetail(id){
  const e=employees.find(x=>x.id===id);
  if(!e) return;
  employeeDetailCurrentId=id;
  renderEmployeeDetail();
  $('employeeDetailModal').classList.add('show');
}
function closeEmployeeDetail(){ $('employeeDetailModal').classList.remove('show'); employeeDetailCurrentId=''; }
function renderEmployeeDetail(){
  const e=employees.find(x=>x.id===employeeDetailCurrentId);
  if(!e) return;
  $('employeeDetailTitle').textContent=`${e.name} · 직원 상세`;
  const initials=String(e.name||'?').trim().slice(0,1)||'?';
  const statusClass=e.status==='재직중'?'good':e.status==='휴직'?'hold':e.status==='퇴사'?'bad':'info';
  const basicRows=[
    detailRow('사번', e.empNo||'-'),
    detailRow('성명', e.name),
    detailRow('부서', e.department||'-'),
    detailRow('직무', e.role||'-'),
    detailRow('비고', e.notes||'-'),
  ].join('');
  const employmentRows=[
    detailRow('재직상태', e.status),
    detailRow('입사일', e.hireDate||'-'),
    detailRow('퇴사일', e.leaveDate||'-'),
    detailRow('상벌 건수', (e.disciplineCount||0)+'건'),
  ].join('');
  const schoolRows=[
    detailRow('출신학교', e.school||'-'),
    detailRow('학교 연결 상태', e.schoolId ? '등록된 학교와 연결됨' : '미연결(학교명 텍스트만 있음)'),
  ].join('');
  const leaveList=employeeLeaves.filter(l=>l.employeeId===e.id);
  const leaveRows = leaveList.length
    ? `<table class="funnel-table"><thead><tr><th>휴직종류</th><th>시작일</th><th>복직예정일</th><th>실제복직일</th><th>상태</th></tr></thead><tbody>${
        leaveList.map(l=>`<tr><td>${esc(l.leaveType||'-')}</td><td>${esc(l.startDate||'-')}</td><td>${esc(l.expectedReturnDate||'-')}</td><td>${esc(l.actualReturnDate||'-')}</td><td>${esc(l.status||'-')}</td></tr>`).join('')
      }</tbody></table>`
    : '<div class="empty">휴직 이력이 없습니다. (이 기능은 다음 단계에서 실제로 연결됩니다)</div>';
  const changeList=employeeChanges.filter(c=>c.employeeId===e.id);
  const changeRows = changeList.length
    ? `<table class="funnel-table"><thead><tr><th>일시</th><th>구분</th><th>내용</th></tr></thead><tbody>${
        changeList.map(c=>`<tr><td>${esc(c.createdAt||'-')}</td><td>${esc(c.changeType||'-')}</td><td>${esc(c.note||'-')}</td></tr>`).join('')
      }</tbody></table>`
    : '<div class="empty">인사발령 이력이 없습니다. (이 기능은 다음 단계에서 실제로 연결됩니다)</div>';
  $('employeeDetailBody').innerHTML=`
    <section class="employee-profile-hero">
      <div class="employee-avatar" aria-hidden="true">${esc(initials)}</div>
      <div class="employee-profile-main">
        <p class="eyebrow">EMPLOYEE PROFILE</p>
        <h2>${esc(e.name||'-')}</h2>
        <div class="employee-profile-meta">
          <span>${esc(e.empNo||'사번 미등록')}</span>
          <span>${esc(e.department||'부서 미등록')}</span>
          <span>${esc(e.role||'직무 미등록')}</span>
        </div>
      </div>
      <div class="employee-profile-status">
        <span class="badge ${statusClass}">${esc(e.status||'상태 미등록')}</span>
        <small>현재 재직 상태</small>
      </div>
    </section>

    <div class="employee-detail-quick-grid">
      <div><span>입사일</span><strong>${esc(e.hireDate||'-')}</strong></div>
      <div><span>출신학교</span><strong>${esc(e.school||'-')}</strong></div>
      <div><span>상벌 건수</span><strong>${esc(String(e.disciplineCount||0))}건</strong></div>
    </div>

    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">01</span><div><h4>기본정보</h4><p>직원의 기본 인사 정보를 확인합니다.</p></div></div><div class="detail-grid">${basicRows}</div></section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">02</span><div><h4>재직정보</h4><p>현재 재직 상태와 입·퇴사 정보를 확인합니다.</p></div></div><div class="detail-grid">${employmentRows}</div></section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">03</span><div><h4>출신학교</h4><p>학교 연결 상태와 원본 학교명을 확인합니다.</p></div></div><div class="detail-grid">${schoolRows}</div></section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">04</span><div><h4>휴직 이력</h4><p>휴직 기록은 다음 단계에서 저장 기능과 연결됩니다.</p></div></div>${leaveRows}</section>
    <section class="employee-detail-section"><div class="employee-detail-section-head"><span class="employee-section-index">05</span><div><h4>인사발령 이력</h4><p>부서이동·직무변경 등 발령 기록 영역입니다.</p></div></div>${changeRows}</section>
  `;
}
window.editApplicant=editApplicant; window.deleteApplicant=deleteApplicant; window.duplicateApplicant=duplicateApplicant;
  window.viewApplicant=viewApplicant; window.updateApplicantStatus=updateApplicantStatus; window.resetAndRenderList=resetAndRenderList;

function updateFormMode(){
  const editing = !!($('editId') && $('editId').value);
  if($('submitBtn')) $('submitBtn').textContent = editing ? '수정 저장' : '지원자 등록';
}

function updateScorePreview(){
  if(!$('scorePreview')) return;
  if(!$('age').value && $('birthYear').value) $('age').value=calcAge($('birthYear').value);
  const data=getForm(), sc=deriveScores(data);
  $('scorePreview').innerHTML=`검토점수 미리보기: <b>${sc.total}점 · ${grade(sc.total)}</b><div class="score-line"><span class="score-pill">전공 ${sc.major}/25</span><span class="score-pill">경력 ${sc.career}/35</span><span class="score-pill">자격 ${sc.cert}/20</span><span class="score-pill">현장 ${sc.field}/20</span></div>`;
}
function normalizePhone(v){ return String(v||'').replace(/\D/g,''); }
function checkDuplicate(){
  if(!$('duplicateBox')) return;
  const f=getForm();
  const fPhone=normalizePhone(f.phone);
  const dups=applicants.filter(a=>a.id!==f.editId && ((fPhone && fPhone.length>=8 && normalizePhone(a.phone)===fPhone)||(f.email&&a.email===f.email)||(f.name&&a.name===f.name&&f.birthYear&&a.birthYear===f.birthYear)));
  if(dups.length){ $('duplicateBox').className='wide duplicate-box warn'; $('duplicateBox').textContent=`중복 가능성: ${dups.map(d=>d.name+'('+d.phone+')').join(', ')}`; }
  else { $('duplicateBox').textContent=''; $('duplicateBox').className='wide duplicate-box'; }
}
function makeTemplate(){
  const a={};
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
  const headers=['지원날짜','지원경로','기타','연락상태','지원근무지','기수/배치','성명','연락처','이메일','성별','생년월일','연령','거주지역',
    '출근방법','학력구분','최종학교','전공/학과','외국어/기타자격','경력구분','직무적합분류','확인필요사항','자소서키워드','자격증','경력키워드','면접날짜',
    '면접시간','입사예정일','상담내용','판정/메모/다음액션','전공적합도','경력적합도','자격적합도','현장적응도','총점','추천등급','다음액션'];
  const lines=[headers,...applicants.map(a=>{ const sc=deriveScores(a); return [a.applyDate,
    a.source,a.extra,a.status,a.workplace,a.batch,a.name,a.phone,a.email,a.gender,a.birthYear,a.age,a.region,
    dormLabel(a),a.education,a.school,a.major,a.languageEtc,a.careerType,displayCategory(a),displayCheckNeeds(a.checkNeeds),
    a.selfIntroKeywords,a.certs,a.career,a.interviewDate,a.interviewTime,a.hireDate,a.consult,[a.memo,
    a.decisionReason].filter(Boolean).join(' / '),sc.major,sc.career,sc.cert,sc.field,sc.total,
    grade(sc.total),nextAction(a)]; })].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  download(`지원자명단_${today()}.csv`,'\ufeff'+lines.join('\n'),'text/csv;charset=utf-8');
}
function jsonBackup(){ localStorage.setItem(BACKUP_KEY, today()); download(`resume_management_backup_${today()}.json`,JSON.stringify(applicants,null,2),'application/json'); renderAll(); }

/* =========================================================
   v10.11.10 면접 명단표 인쇄
   - 회사 양식(채용 면접 평가표) 그대로 재현
   - 선택 날짜에 면접 잡힌 지원자를 5명 단위로 페이지 구분
   - 이름/성별/생년월일(나이)만 자동 채움, 평가란은 인쇄 후 손으로 기입
   ========================================================= */
function rosterAgeOf(a){
  if(a.age) return a.age;
  const m=String(a.birthYear||'').match(/\d{4}/);
  if(!m) return '';
  return String(new Date().getFullYear()-parseInt(m[0],10));
}
function rosterGenderChar(a){
  if(a.gender==='남자') return '남';
  if(a.gender==='여자') return '여';
  return '';
}
function rosterDateLabel(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  if(Number.isNaN(d.getTime())) return dateStr;
  const days=['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}(${days[d.getDay()]})`;
}
function rosterRow(no, a){
  if(a){
    const bday=formatBirthDisplay(a.birthYear||'');
    const bdayLine=bday?`${esc(bday)}(${rosterAgeOf(a)})`:'';
    return `<tr class="roster-row-top">
      <td class="roster-no" rowspan="2">${no}</td>
      <td class="roster-name">${esc(a.name||'')} (${rosterGenderChar(a)})</td>
      <td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td>
      <td class="roster-pass" rowspan="2">Y / N</td>
      <td class="roster-opinion" rowspan="2"></td>
    </tr>
    <tr class="roster-row-bottom">
      <td class="roster-name">${bdayLine}</td>
    </tr>`;
  }
  return `<tr class="roster-row-top">
    <td class="roster-no" rowspan="2"></td>
    <td class="roster-name"></td>
    <td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td>
    <td class="roster-pass" rowspan="2">Y / N</td>
    <td class="roster-opinion" rowspan="2"></td>
  </tr>
  <tr class="roster-row-bottom">
    <td class="roster-name"></td>
  </tr>`;
}
function buildRosterHtml(dateStr){
  const list=applicants.filter(a=>a.interviewDate===dateStr).sort((a,b)=>(a.interviewTime||'').localeCompare(b.interviewTime||''));
  const numbered=list.map((a,i)=>({no:i+1,a}));
  const pages=[];
  for(let i=0;i<Math.max(numbered.length,1);i+=5){ pages.push(numbered.slice(i,i+5)); }
  const dateLabel=rosterDateLabel(dateStr);
  return pages.map((pageItems,pageIndex)=>{
    const rows=[];
    for(let i=0;i<5;i++){ rows.push(rosterRow(pageItems[i]?pageItems[i].no:'', pageItems[i]?pageItems[i].a:null)); }
    return `<div class="roster-page">
      <p class="roster-company">에이치티솔루션</p>
      <h3 class="roster-title">채용 면접 평가표</h3>
      <div class="roster-oath-box">
        <div class="roster-oath-text">본 평가에 있어 면접관 본인은 면접 응시자에 대한 주관을 배제하고 객관적으로 평가하였음을 밝힙니다.<br/>또한 평가자료, 평가 후 평가결과에 대해 외부로 그 내용을 절대 누설하지 않을 것을 서약합니다.</div>
        <div class="roster-oath-meta"><div class="roster-oath-meta-inner"><div class="roster-oath-line"><span class="roster-oath-label">면접일</span> : ${esc(dateLabel)}</div><div class="roster-oath-line"><span class="roster-oath-label">면접관</span> : ________________ (서명)</div></div></div>
      </div>
      <table class="roster-table">
        <colgroup>
          <col style="width:4.1%"/><col style="width:11.3%"/>
          <col style="width:11.25%"/><col style="width:11.25%"/><col style="width:11.25%"/><col style="width:11.3%"/>
          <col style="width:8.1%"/><col style="width:31.45%"/>
        </colgroup>
        <thead>
          <tr><th rowspan="2">NO</th><th rowspan="2" class="roster-name-head-cell"><div class="roster-name-head"><span class="roster-name-head-text">성명(성별)</span><span class="roster-name-head-divider"></span><span class="roster-name-head-text">생년월일(나이)</span></div></th><th colspan="4">평가항목</th><th rowspan="2">합격여부</th><th rowspan="2">면접의견</th></tr>
          <tr><th>지원동기/준비</th><th>지식/역량</th><th>규범/적극</th><th>태도/인성</th></tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <p class="roster-legend">- 평가 등급 : S(탁월), A(우수), B+(보통), B(미흡), C(매우 미흡)</p>
      <p class="roster-legend">- 합격 기준 : 전문대↑(이공계) - 평균 B+ 이상 / 전문대↑(比이공계), 고교 - 평균 A 이상</p>
    </div>`;
  }).join('');
}
function openRosterPrint(){
  const dateStr=$('rosterDate').value;
  if(!dateStr){ alert('명단표를 뽑을 면접 날짜를 먼저 선택해주세요.'); return; }
  const list=applicants.filter(a=>a.interviewDate===dateStr);
  if(!list.length && !confirm('선택하신 날짜에 면접 일정이 등록된 지원자가 없습니다. 빈 양식으로 출력할까요?')) return;
  $('rosterPrintArea').innerHTML=buildRosterHtml(dateStr);
  document.body.classList.add('roster-printing');
  // v10.11.1: innerHTML 반영 직후 바로 print()를 부르면 브라우저가 아직 화면을
  // 다 그리기 전이라 미리보기가 흰 화면으로 뜨는 경우가 있어, 두 번의 화면
  // 갱신(requestAnimationFrame)을 기다린 뒤 인쇄를 실행하도록 안전하게 처리.
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ window.print(); }); });
}
window.addEventListener('afterprint', ()=>{ document.body.classList.remove('roster-printing'); });
bind('btnRosterPrint','click', openRosterPrint);
bind('btnCalendarPrev','click',()=>moveCalendarMonth(-1));
bind('btnCalendarNext','click',()=>moveCalendarMonth(1));
bind('btnCalendarToday','click',goCalendarToday);
bind('btnCalendarAdd','click',resetCalendarEventForm);
bind('calendarWorkplaceFilter','change',e=>{ calendarWorkplaceFilter=e.target.value; renderCalendar(); });
bind('calendarEventForm','submit',saveCalendarEventFromForm);
bind('btnCalendarReset','click',resetCalendarEventForm);
bind('btnCalendarDelete','click',()=>deleteCalendarEvent());
bind('btnCalendarPrintRoster','click',()=>{ if(!selectedCalendarDate){ alert('날짜를 먼저 선택해주세요.'); return; } if($('rosterDate')) $('rosterDate').value=selectedCalendarDate; openRosterPrint(); });

function bind(id, event, handler){ const el=$(id); if(el) el.addEventListener(event, handler); }

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.go)));
bind('applicantForm','input',()=>{ updateScorePreview(); checkDuplicate(); });
bind('applicantForm','keydown', e=>{
  if(e.key !== 'Enter') return;
  const tag = e.target.tagName;
  const type = (e.target.getAttribute('type') || '').toLowerCase();
  if(tag === 'TEXTAREA' || type === 'submit' || type === 'button') return;
  e.preventDefault();
  const form = $('applicantForm');
  const controls = [...form.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(el=>!el.disabled && el.offsetParent !== null);
  const idx = controls.indexOf(e.target);
  if(idx >= 0 && controls[idx+1]) controls[idx+1].focus();
});
bind('applicantForm','submit',e=>{
  e.preventDefault();
  const f=getForm();
  if(!f.name){ alert('성명을 입력해주세요.'); return; }
  const fPhone=normalizePhone(f.phone);
  const dup=applicants.find(a=>a.id!==f.editId&&((fPhone&&fPhone.length>=8&&normalizePhone(a.phone)===fPhone)||(f.email&&a.email===f.email)));
  if(dup&&!confirm(`중복 가능성이 있습니다: ${dup.name}\n그래도 저장할까요?`)) return;
  if(f.editId){ applicants=applicants.map(a=>a.id===f.editId?normalize({...a,...f,id:f.editId,updatedAt:new Date().toISOString()}):a); }
  else { applicants.unshift(normalize({...f,id:uid(),createdAt:new Date().toISOString()})); }
  resetForm(); save(); setPage('applicants');
});
bind('btnResetForm','click', resetForm);
bind('searchInput','input',e=>{ currentSearch=e.target.value; renderTable(); });
document.querySelectorAll('#workplaceTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#workplaceTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); currentWorkplace=b.dataset.workplace; renderTable(); }));
document.querySelectorAll('#quickFilters .chip').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#quickFilters .chip').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); currentFilter=b.dataset.filter; renderTable(); }));
/* v10.21.0: 사이드바 그룹 접기/펴기 상태 저장 */
function loadNavCollapsed(){
  try{ const raw=localStorage.getItem(NAV_COLLAPSE_KEY); return raw ? JSON.parse(raw) : {}; }catch{ return {}; }
}
function saveNavCollapsed(state){ localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(state)); }
(function initNavGroups(){
  const collapsed = loadNavCollapsed();
  document.querySelectorAll('.nav-group').forEach(g=>{
    const key = g.dataset.navgroup;
    if(collapsed[key]) g.classList.add('collapsed');
  });
  document.querySelectorAll('[data-navtoggle]').forEach(b=>b.addEventListener('click',()=>{
    const group = b.closest('.nav-group');
    if(!group) return;
    group.classList.toggle('collapsed');
    const state = loadNavCollapsed();
    state[group.dataset.navgroup] = group.classList.contains('collapsed');
    saveNavCollapsed(state);
  }));
})();
document.querySelectorAll('#schoolSubTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#schoolSubTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  const isManage = b.dataset.schooltab==='manage';
  if($('schoolRankView')) $('schoolRankView').style.display = isManage ? 'none' : '';
  if($('schoolManageView')) $('schoolManageView').style.display = isManage ? '' : 'none';
}));
document.querySelectorAll('#schoolRankTypeTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#schoolRankTypeTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); schoolRankTypeFilter=b.dataset.schoolranktype; renderSchools();
}));
document.querySelectorAll('#schoolManageTypeTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#schoolManageTypeTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); schoolManageTypeFilter=b.dataset.schoolmanagetype; schoolManagePage=1; renderSchoolManage();
}));
bind('schoolHideLowVolume','change',e=>{ schoolHideLowVolume=e.target.checked; renderSchools(); });
bind('schoolManageSort','change',e=>{ schoolManageSort=e.target.value; schoolManageSortDirection=(schoolManageSort==='applicant'||schoolManageSort==='employee')?'desc':'asc'; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageSearch','input',e=>{ schoolManageSearch=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageRegion','change',e=>{ schoolManageRegionFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageContact','change',e=>{ schoolManageContactFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageMou','change',e=>{ schoolManageMouFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageStatus','change',e=>{ schoolManageStatusFilter=e.target.value; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageHasApplicants','change',e=>{ schoolManageHasApplicants=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageHasEmployees','change',e=>{ schoolManageHasEmployees=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageMissingHistory','change',e=>{ schoolManageMissingHistory=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('schoolManageUnclassified','change',e=>{ schoolManageUnclassifiedFilter=e.target.checked; schoolManagePage=1; renderSchoolManage(); });
bind('btnResetSchoolManageFilters','click',resetSchoolManageFilters);
bind('btnApplySchoolFilters','click',()=>{ schoolManagePage=1; renderSchoolManage(); });
bind('sidebarToggle','click',()=>{
  if(window.innerWidth<=1020){
    document.body.classList.toggle('sidebar-mobile-open');
  }else{
    document.body.classList.toggle('sidebar-collapsed');
  }
});
bind('btnToggleSchoolEditPanel','click',()=>toggleSchoolRegisterForm(false));
bind('btnOpenSchoolRegister','click',()=>{
  toggleSchoolRegisterForm(true);
  const panel=$('schoolEditPanel');
  if(panel && panel.scrollIntoView) panel.scrollIntoView({behavior:'smooth', block:'start'});
});
document.querySelectorAll('#schoolManageKpiGrid .school-kpi-card').forEach(b=>b.addEventListener('click',()=>applySchoolKpiFilter(b.dataset.kpi)));
bind('btnToggleSchoolFilters','click',toggleSchoolManageFilters);
bind('schoolManagePageSize','change',e=>{ schoolManagePageSize=Number(e.target.value)||30; schoolManagePage=1; renderSchoolManage(); });
bind('btnAddSchool','click', submitSchoolForm);
bind('schoolJsonImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.schools) ? parsed.schools : []);
      if(!confirm(`학교 ${data.length}개를 가져올까요? 기존 학교는 지워지지 않고, 이름이 같으면 별칭/구분 정보만 보강됩니다.`)) return;
      importSchoolsJson(data);
    }catch{ alert('학교 JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('schoolHrStatsImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.stats) ? parsed.stats : []);
      if(!confirm(`학교 HR 통계 ${data.length}건을 반영할까요? 개인정보는 담겨있지 않은 학교 단위 집계 수치입니다.`)) return;
      importSchoolHrStats(data);
    }catch{ alert('HR 통계 JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('school','input', renderSchoolSimilarHint);
bind('btnAddEmployee','click', submitEmployeeForm);
bind('empSchool','input', ()=>renderSchoolSimilarHintFor('empSchool','empSchoolSimilarHint'));
bind('employeeJsonImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.employees) ? parsed.employees : []);
      if(!confirm(`직원 ${data.length}명을 가져올까요? 사번이 같으면 정보가 갱신되고, 새 사번이면 추가됩니다.`)) return;
      importEmployeesJson(data);
    }catch{ alert('직원명부 JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
document.addEventListener('click',e=>{ if(!e.target.closest('.row-more-menu')) closeAllRowMoreMenus(); });
window.addEventListener('scroll',closeAllRowMoreMenus,true);
window.addEventListener('resize',closeAllRowMoreMenus);
document.querySelectorAll('#employeeStatusTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#employeeStatusTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); employeeStatusFilter=b.dataset.empstatus; employeePage=1; renderEmployees();
}));
document.querySelectorAll('#employeeViewTabs .tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#employeeViewTabs .tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  employeeViewMode=b.dataset.empview;
  if($('employeeListView')) $('employeeListView').style.display = employeeViewMode==='list' ? '' : 'none';
  if($('employeeDeptView')) $('employeeDeptView').style.display = employeeViewMode==='dept' ? '' : 'none';
}));
bind('btnEmployeeSearch','click', applyEmployeeSearch);
['empSearchName','empSearchNo','empSearchSchool'].forEach(id=>bind(id,'keydown',e=>{ if(e.key==='Enter') applyEmployeeSearch(); }));
bind('btnEmployeeResetFilters','click', resetEmployeeFilters);
bind('btnCsvEmployees','click', csvEmployees);
bind('btnGoSchools','click', ()=>setPage('schools'));
bind('btnResetFilters','click',()=>{ resetListFiltersToAll(); renderTable(); });
bind('sortSelect','change',e=>{ currentSort=e.target.value; renderTable(); });
bind('statsYearSelect','change', renderStatsMonth);
bind('statsWorkplaceFilter','change', e=>{ statsWorkplaceFilter = e.target.value; renderHireStats(); });
bind('hideFinished','change',e=>{ hideFinished=e.target.checked; renderTable(); });
bind('btnMakeTemplate','click', makeTemplate);
bind('btnCopyTemplate','click', async()=>{ try{ await navigator.clipboard.writeText($('templateOutput').value); alert('복사됐습니다.'); }catch{ alert('복사가 막히면 직접 드래그해서 복사해주세요.'); } });
bind('btnCsv','click', csv);
bind('btnJson','click', jsonBackup);
bind('jsonImport','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.applicants) ? parsed.applicants : []);
      if(!Array.isArray(data) || !data.length){ alert('지원자 백업 JSON 형식이 아니거나 데이터가 비어 있습니다.'); return; }
      const ok=confirm(`JSON 가져오기 전 확인\n\n현재 저장된 지원자: ${applicants.length}명\n가져올 지원자: ${data.length}명\n\n가져오면 현재 브라우저의 지원자 목록이 가져온 파일 기준으로 교체됩니다. 진행할까요?`);
      if(!ok) return;
      supabaseSnapshotSave('가져오기 직전 자동 백업').then(()=>{
        applicants=data.map(normalize);
        save();
        renderSnapshotList();
        alert(`가져오기 완료: ${applicants.length}명`);
      });
    }catch{ alert('JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('jsonImportMerge','change',e=>{
  const file=e.target.files[0];
  if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const parsed=JSON.parse(r.result);
      const data=Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.applicants) ? parsed.applicants : []);
      if(!Array.isArray(data) || !data.length){ alert('지원자 백업 JSON 형식이 아니거나 데이터가 비어 있습니다.'); return; }
      const incoming=data.map(normalize);
      const map={};
      applicants.forEach(a=>{ map[a.id]=a; });
      let updatedCount=0, addedCount=0;
      incoming.forEach(c=>{
        const l=map[c.id];
        if(!l){ map[c.id]=c; addedCount++; return; }
        const lt=l.updatedAt||l.createdAt||'';
        const ct=c.updatedAt||c.createdAt||'';
        if(ct>lt){ map[c.id]=c; updatedCount++; }
      });
      const beforeCount=applicants.length;
      const ok=confirm(`JSON 병합 가져오기 전 확인\n\n현재 저장된 지원자: ${beforeCount}명\n가져올 파일 지원자: ${incoming.length}명\n\n기존 지원자는 지워지지 않습니다. id가 같으면 더 최근에 수정된 쪽을 채택하고, 새 id는 그대로 추가됩니다. 진행할까요?`);
      if(!ok) return;
      supabaseSnapshotSave('병합 가져오기 직전 자동 백업').then(()=>{
        applicants=Object.keys(map).map(k=>map[k]);
        save();
        renderSnapshotList();
        alert(`병합 완료: 기존 ${beforeCount}명 + 가져온 파일 ${incoming.length}명 -> 최종 ${applicants.length}명 (신규 ${addedCount}명, 갱신 ${updatedCount}명, 데이터 손실 없음)`);
      });
    }catch{ alert('JSON 파일을 확인해주세요.'); }
    finally{ e.target.value=''; }
  };
  r.readAsText(file);
});
bind('btnClearAll','click',()=>{
  if(!confirm(`현재 브라우저의 지원자 ${applicants.length}명을 모두 삭제할까요?\n\n삭제 직전 자동으로 클라우드에 백업을 남겨둡니다.`)) return;
  const phrase=prompt('정말 삭제하려면 아래 문구를 그대로 입력하세요.\n\n전체삭제');
  if(phrase !== '전체삭제'){ alert('삭제가 취소되었습니다.'); return; }
  supabaseSnapshotSave('전체삭제 직전 자동 백업').then(()=>{
    applicants=[];
    supabaseDeleteAll();
    save();
    renderSnapshotList();
    alert('전체 삭제 완료 (삭제 전 상태는 백업/내보내기 화면에서 복원 가능합니다)');
  });
});
bind('btnCloseDetail','click', closeDetail);
bind('detailBackdrop','click', closeDetail);
bind('btnDetailEdit','click',()=>{ const id=detailCurrentId; closeDetail(); if(id) editApplicant(id); });
bind('btnCloseSchoolDetail','click', closeSchoolDetail);
bind('schoolDetailBackdrop','click', closeSchoolDetail);
bind('btnSaveSchoolDetail','click', saveSchoolDetailHistory);
bind('btnCloseEmployeeDetail','click', closeEmployeeDetail);
bind('employeeDetailBackdrop','click', closeEmployeeDetail);
bind('btnCancelSchoolEdit','click', resetSchoolForm);
bind('btnCopySummary','click',async()=>{ const a=applicants.find(x=>x.id===detailCurrentId);
  if(!a) return; try{ await navigator.clipboard.writeText(applicantSummary(a)); alert('지원자 요약이 복사됐습니다.');
  }catch{ alert('복사가 막히면 상세 내용을 직접 드래그해서 복사해주세요.'); } });

/* =========================================================
   v10.10.0 로그인(Supabase Auth)
   - 클라우드 미연결(window.sb 없음) 시에는 로그인 화면 자체를 안 띄움 (지금까지처럼 로컬만 사용)
   - 클라우드 연결됐는데 로그인 안 된 상태면 로그인 화면 표시
   - "로그인 없이 계속"을 누르면 로컬 데이터는 그대로 쓰되 클라우드 동기화는 시도하지 않음
   ========================================================= */
function showLoginOverlay(msg){
  var ov=$('loginOverlay');
  if(ov) ov.style.display='flex';
  if($('loginError')) $('loginError').textContent = msg || '';
}
function hideLoginOverlay(){ var ov=$('loginOverlay'); if(ov) ov.style.display='none'; }
function updateAuthNote(email){
  var note=$('authNote');
  var loggedIn=$('authLoggedIn');
  var loggedOut=$('authLoggedOut');
  if(note) note.style.display='flex';
  if(email){
    if(loggedIn) loggedIn.style.display='flex';
    if(loggedOut) loggedOut.style.display='none';
    if($('authEmailText')) $('authEmailText').textContent=email;
  } else {
    if(loggedIn) loggedIn.style.display='none';
    if(loggedOut) loggedOut.style.display='flex';
  }
  var topbarUser=$('topbarUser');
  if(topbarUser){
    if(email){
      topbarUser.style.display='flex';
      if($('topbarUserEmail')) $('topbarUserEmail').textContent=email;
      const userInitials=String(email||'HT').split('@')[0].replace(/[^a-zA-Z0-9가-힣]/g,'').slice(0,2).toUpperCase() || 'HT';
      if($('topbarUserMark')) $('topbarUserMark').textContent=userInitials;
      if($('authUserMark')) $('authUserMark').textContent=userInitials;
    } else {
      topbarUser.style.display='none';
    }
  }
}
function afterLoginSuccess(email){
  cloudAuthenticated = true;
  hideLoginOverlay();
  updateAuthNote(email);
  supabaseSyncOnLoad();
  supabaseSchoolsSyncOnLoad();
  supabaseEmployeesSyncOnLoad();
  renderSnapshotList();
  supabaseSnapshotDailyCheck();
}
function initAuth(){
  if(!window.sb) return;
  if(isCompanyLocalMode()){ cloudAuthenticated=false; hideLoginOverlay(); updateAuthNote(null); cloudSyncStatus='unknown'; updateStorageNote(); return; }
  window.sb.auth.getSession().then(function(res){
    var session = res && res.data ? res.data.session : null;
    if(session && session.user){ afterLoginSuccess(session.user.email); }
    else { cloudAuthenticated=false; showLoginOverlay(); updateAuthNote(null); }
  }).catch(function(){ showLoginOverlay(); });
}
function doLogin(){
  if(!window.sb) return;
  var email=($('loginEmail').value||'').trim();
  var pw=$('loginPassword').value||'';
  if(!email || !pw){ showLoginOverlay('이메일과 비밀번호를 입력해주세요.'); return; }
  showLoginOverlay('로그인 중...');
  window.sb.auth.signInWithPassword({email:email, password:pw}).then(function(res){
    if(res.error){ showLoginOverlay('로그인 실패: '+res.error.message); return; }
    afterLoginSuccess(res.data.user.email);
  }).catch(function(){ showLoginOverlay('로그인 중 오류가 발생했습니다.'); });
}
function doLogout(){
  if(!window.sb) return;
  window.sb.auth.signOut().then(function(){
    cloudAuthenticated=false;
    updateAuthNote(null);
    cloudSyncStatus='unknown';
    updateStorageNote();
    showLoginOverlay();
  });
}
function handleOperationEnvironmentChange(mode){
  if(mode === 'company'){
    cloudAuthenticated=false;
    hideLoginOverlay();
    updateAuthNote(null);
    cloudSyncStatus='unknown';
    updateStorageNote();
    renderSnapshotList();
    return;
  }
  initAuth();
}
window.erpHandleOperationEnvironmentChange = handleOperationEnvironmentChange;

bind('btnOpenLogin','click', ()=>{ if(!window.sb){ alert('Supabase 설정을 찾을 수 없습니다.'); return; } showLoginOverlay(); });
bind('btnLogin','click', doLogin);
bind('btnLoginSkip','click', ()=>{ cloudAuthenticated=false; hideLoginOverlay(); updateAuthNote(null); cloudSyncStatus='unknown'; updateStorageNote(); });
bind('btnLogout','click', doLogout);
bind('loginPassword','keydown', e=>{ if(e.key==='Enter') doLogin(); });

try{ resetForm(); resetCalendarEventForm(); renderAll(); updateStorageNote(); initAuth(); if($('rosterDate') && !$('rosterDate').value) $('rosterDate').value = today(); }catch(e){ console.error('Recruit ERP render error', e); alert('화면 표시 중 오류가 발생했습니다. app.js 교체 상태를 확인해주세요.'); }




/* ===== v10.39.9 verified applicant action menu ===== */
(function(){
  'use strict';
  function closeApplicantActionMenus(except){
    document.querySelectorAll('#applicants .row-more-menu.open').forEach(function(menu){
      if(menu===except) return;
      menu.classList.remove('open');
      var panel=menu.querySelector('.applicant-more-panel');
      if(panel){ panel.style.left=''; panel.style.top=''; panel.style.right=''; }
    });
  }
  function positionApplicantActionMenu(button, panel){
    var rect=button.getBoundingClientRect();
    var width=Math.max(120, panel.offsetWidth || 120);
    var height=Math.max(118, panel.offsetHeight || 118);
    var left=Math.max(8, Math.min(window.innerWidth-width-8, rect.right-width));
    var top=rect.bottom+6;
    if(top+height>window.innerHeight-8) top=Math.max(8, rect.top-height-6);
    panel.style.position='fixed';
    panel.style.left=left+'px';
    panel.style.top=top+'px';
    panel.style.right='auto';
  }
  document.addEventListener('click', function(event){
    var button=event.target.closest('#applicants .applicant-more-toggle');
    if(button){
      event.preventDefault();
      event.stopPropagation();
      var menu=button.closest('.row-more-menu');
      var panel=menu && menu.querySelector('.applicant-more-panel');
      if(!menu || !panel) return;
      var shouldOpen=!menu.classList.contains('open');
      closeApplicantActionMenus(menu);
      menu.classList.toggle('open', shouldOpen);
      if(shouldOpen) requestAnimationFrame(function(){ positionApplicantActionMenu(button,panel); });
      return;
    }
    if(!event.target.closest('#applicants .applicant-more-panel')) closeApplicantActionMenus();
  });
  document.addEventListener('keydown', function(event){ if(event.key==='Escape') closeApplicantActionMenus(); });
  window.addEventListener('scroll', function(){ closeApplicantActionMenus(); }, true);
  window.addEventListener('resize', function(){ closeApplicantActionMenus(); });
  window.erpCloseApplicantActionMenus=closeApplicantActionMenus;
})();
