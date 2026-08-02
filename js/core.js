// [HOME_DEV] Recruit ERP v10.40.30 SCHOOL_EXACT_AUTO_LINK — 역할별 파일 분리 빌드
const STORAGE_KEY = 'recruit_erp_applicants_stable';
const LEGACY_KEYS = ['resume_excel_like_v9_rows','recruit_erp_vercel_v2_applicants','recruit_erp_vercel_v1_applicants'];
const BACKUP_KEY = 'recruit_erp_last_backup_date';
const CALENDAR_EVENTS_KEY = 'recruit_erp_calendar_events';
const HIRE_WAITING_PROFILES_KEY = 'recruit_erp_hire_waiting_profiles';
const MESSAGE_TEMPLATES_KEY = 'recruit_erp_message_templates';
const REMINDER_DISMISS_KEY = 'recruit_erp_reminder_dismissed_date';
const SCHOOLS_KEY = 'recruit_erp_schools';
const NAV_COLLAPSE_KEY = 'recruit_erp_nav_collapsed';
const EMPLOYEES_KEY = 'recruit_erp_employees';
const STATUS_OPTIONS = ['서류검토','서류합격','부재중','면접예정','면접완료','다음면접','입사예정','출근','불합격','서류탈락','면접거절','면접불참','입사철회'];
const LEGACY_STATUS_OPTIONS = ['철회','연락두절'];
let schools = [];
let editingSchoolId = '';
let employees = [];
let editingEmployeeId = '';
let applicants = [];
let hireWaitingProfiles = [];
let messageTemplates = [];
let currentWorkplace = 'all';
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'recent';
let hideFinished = false;
let currentSchoolFilterId = '';
let currentApplicantPage = 1;
let applicantPageSize = 30;
let lastApplicantFilterSignature = '';
let detailCurrentId = '';

const $ = id => document.getElementById(id);
function bind(id, event, handler){ const el=$(id); if(el) el.addEventListener(event, handler); }
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };

function uid(){ return globalThis.crypto?.randomUUID?.() || ('erp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)); }
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
    '미연락':'서류검토','문자발송':'서류검토','연락완료':'면접예정','보류':'다음면접',
    '부적합':'서류탈락','전형마감':'서류탈락','입사포기':'입사철회','포기':'입사철회','취소':'철회'
  };
  const out=map[s] || s || '서류검토';
  if(!out) return '서류검토';
  // v10.48.0: 알 수 없는(미래) 상태값은 서류검토로 뭉개지 않고 원문 그대로 보존한다.
  return out;
}
function statusOptionsHtml(current){
  const cur=normalizeStatus(current);
  const isKnown=STATUS_OPTIONS.includes(cur)||LEGACY_STATUS_OPTIONS.includes(cur);
  // v10.48.0: 이 버전이 모르는 상태값(미래 상태)도 legacy와 동일하게 임시 옵션으로 보존해
  // 사용자가 직접 다른 상태를 고르기 전까지 값이 유지되게 한다.
  const extra=!isKnown?`<option value="${esc(cur)}" selected>${esc(cur)} — 현재 버전에서 정의되지 않은 상태</option>`
    :(LEGACY_STATUS_OPTIONS.includes(cur)?`<option value="${esc(cur)}" selected>${esc(cur)}</option>`:'');
  return extra+STATUS_OPTIONS.map(v=>`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(v)}</option>`).join('');
}
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
  id:window.erpSecurity?.isValidId(a.id)?String(a.id):uid(), createdAt:a.createdAt||new Date().toISOString(), updatedAt:a.updatedAt||'',
  applyDate:a.applyDate||'', source:a.source||'', extra:a.extra||a.etc||'', status:normalizeStatus(a.status), workplace:a.workplace||'',
  batch:a.batch||'',
  name:a.name||'', phone:formatPhoneDisplay(a.phone||''), email:a.email||'', gender:normalizeGender(a.gender), birthYear:formatBirthDisplay(a.birthYear||''),
    age:a.age||'', region:a.region||'', commute:a.commute||'', dormUse:normalizeDorm(a.dormUse),
  education:a.education||'', finalEducation:a.finalEducation||'', school:a.school||'', schoolId:(a.schoolId!==undefined&&a.schoolId!==null&&a.schoolId!=='')?String(a.schoolId).trim():'', major:a.major||'', gradePoint:a.gradePoint||'', languageEtc:a.languageEtc||'',
  certs:a.certs||'', career:a.career||'', lastCompany:a.lastCompany||'', duties:a.duties||'', leaveReason:a.leaveReason||'',
  careerType:a.careerType||'', jobFitCategory:a.jobFitCategory||'', checkNeeds:a.checkNeeds||'', selfIntroKeywords:a.selfIntroKeywords||'',
  interviewDate:a.interviewDate||'', interviewTime:a.interviewTime||'', hireDate:a.hireDate||'',
    finalDecision:a.finalDecision||'', decisionReason:a.decisionReason||'', consult:a.consult||'',
    memo:a.memo||'', employeeId:a.employeeId||'',
    failureReason:a.failureReason||'', withdrawalReason:a.withdrawalReason||'',
    lastContactDate:a.lastContactDate||'', nextContactDate:a.nextContactDate||'',
    progressHistory:Array.isArray(a.progressHistory)?a.progressHistory:[],
    lastChangedBy:a.lastChangedBy||'', lastChangedAt:a.lastChangedAt||''
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
function safeLocalStorageSet(key,value,options){
  if(window.erpSafety&&typeof window.erpSafety.safeLocalStorageSet==='function'){
    return window.erpSafety.safeLocalStorageSet(key,value,options);
  }
  try{localStorage.setItem(key,value);return true;}
  catch(error){console.error('브라우저 저장 실패:',key,error);if(!options||options.notify!==false)alert('데이터를 저장하지 못했습니다. 입력한 내용은 화면에 남아 있습니다.');return false;}
}
function load(){
  try{
    let data = readArrayFromStorageKey(STORAGE_KEY);
    if(!data.length){
      for(const key of LEGACY_KEYS){
        const legacy = readArrayFromStorageKey(key);
        if(Array.isArray(legacy) && legacy.some(looksLikeApplicantRow)){
          data = legacy;
          safeLocalStorageSet(STORAGE_KEY, JSON.stringify(data.map(normalize)), {notify:false});
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
        safeLocalStorageSet(STORAGE_KEY, JSON.stringify(data.map(normalize)), {notify:false});
      }
    }
    return Array.isArray(data) ? data.map(normalize) : [];
  }catch(e){
    console.error('Recruit ERP load error', e);
    return [];
  }
}
let cloudSyncStatus = 'unknown'; // 'syncing' | 'ok' | 'error' | 'unknown'
let cloudAuthenticated = false;
const OPERATION_ENV_STORAGE_KEY = 'recruit_erp_ui_operation_environment';
const CLOUD_LAST_SUCCESS_KEY = 'recruit_erp_cloud_last_success_at';
function isCompanyLocalMode(){ return localStorage.getItem(OPERATION_ENV_STORAGE_KEY) === 'company'; }
function canUseCloud(){ return !!window.sb && !isCompanyLocalMode() && cloudAuthenticated; }
function cloudLastSuccessAt(){ return localStorage.getItem(CLOUD_LAST_SUCCESS_KEY)||''; }
function cloudLastSuccessLabel(){
  const value=cloudLastSuccessAt();if(!value)return '아직 성공 기록 없음';
  const date=new Date(value);return Number.isNaN(date.getTime())?'기록 확인 불가':date.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function setCloudSyncStatus(status){
  cloudSyncStatus=status;
  if(status==='ok')safeLocalStorageSet(CLOUD_LAST_SUCCESS_KEY,new Date().toISOString(),{notify:false});
  updateStorageNote();
}
function updateStorageNote(){
  var el = $('storageNote');
  if(!el) return;
  el.setAttribute('aria-live','polite');
  el.className='security-note';
  const last='<small>마지막 성공: '+esc(cloudLastSuccessLabel())+'</small>';
  if(isCompanyLocalMode()){
    el.className='security-note sync-local-note';
    el.innerHTML='<strong>회사 로컬 모드</strong><span>이 브라우저에만 저장하며 클라우드로 보내지 않습니다.</span>';
  } else if(!window.sb){
    el.className='security-note sync-local-note';
    el.innerHTML='<strong>로컬 전용</strong><span>클라우드 설정이 없어 이 브라우저에만 저장합니다.</span>';
  } else if(!cloudAuthenticated){
    el.className='security-note sync-logged-out-note';
    el.innerHTML='<strong>클라우드 로그아웃</strong><span>로컬 저장만 사용 중입니다. 로그인하면 동기화를 다시 시작합니다.</span>'+last;
  } else if(cloudSyncStatus === 'error'){
    el.className = 'security-note sync-warn-note';
    el.innerHTML = '<strong>⚠ 클라우드 동기화 실패</strong><span>로컬 저장은 완료됐지만 클라우드 반영에 실패했습니다. 인터넷 연결을 확인해주세요.</span>'+last;
  } else if(cloudSyncStatus === 'ok'){
    el.className='security-note sync-ok-note';
    el.innerHTML='<strong>클라우드 동기화 정상</strong><span>로컬과 클라우드 저장이 정상 작동합니다.</span>'+last;
  } else {
    el.className='security-note sync-progress-note';
    el.innerHTML='<strong>클라우드 동기화 중</strong><span>클라우드 상태를 확인하고 있습니다.</span>'+last;
  }
  if(window.erpSyncSafety&&typeof window.erpSyncSafety.decorateStatus==='function')window.erpSyncSafety.decorateStatus(el);
}
function save(){
  if(!safeLocalStorageSet(STORAGE_KEY,JSON.stringify(applicants)))return false;
  if(canUseCloud())supabaseSyncAll(applicants);
  renderAll();
  return true;
}

