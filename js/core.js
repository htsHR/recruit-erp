// [HOME_DEV] Recruit ERP v10.40.2 MODULE_SPLIT — 역할별 파일 분리 빌드
const STORAGE_KEY = 'recruit_erp_applicants_stable';
const LEGACY_KEYS = ['resume_excel_like_v9_rows','recruit_erp_vercel_v2_applicants','recruit_erp_vercel_v1_applicants'];
const BACKUP_KEY = 'recruit_erp_last_backup_date';
const CALENDAR_EVENTS_KEY = 'recruit_erp_calendar_events';
const REMINDER_DISMISS_KEY = 'recruit_erp_reminder_dismissed_date';
const SCHOOLS_KEY = 'recruit_erp_schools';
const NAV_COLLAPSE_KEY = 'recruit_erp_nav_collapsed';
const EMPLOYEES_KEY = 'recruit_erp_employees';
const STATUS_OPTIONS = ['미연락','부재중','면접예정','면접완료','다음면접','입사예정','출근','불합격','서류탈락','철회','연락두절'];
let schools = [];
let editingSchoolId = '';
let employees = [];
let editingEmployeeId = '';
let applicants = [];
let currentWorkplace = 'all';
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'recent';
let hideFinished = false;
let currentSchoolFilterId = '';
let detailCurrentId = '';

const $ = id => document.getElementById(id);
function bind(id, event, handler){ const el=$(id); if(el) el.addEventListener(event, handler); }
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
let calendarEvents = [];
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

