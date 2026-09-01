// [HOME_DEV] Recruit ERP v10.40.30 SCHOOL_EXACT_AUTO_LINK — 역할별 파일 분리 빌드
const STORAGE_KEY = 'recruit_erp_applicants_stable';
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
let employees = [];
let applicants = [];
let hireWaitingProfiles = [];
let messageTemplates = [];
let currentWorkplace = 'all';
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'recent';
let hideFinished = false;
let currentApplicantPage = 1;
let applicantPageSize = 30;
let lastApplicantFilterSignature = '';
let detailCurrentId = '';

const $ = id => document.getElementById(id);
function bind(id, event, handler){ const el=$(id); if(el) el.addEventListener(event, handler); }
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,10); };

function uid(){ return globalThis.crypto?.randomUUID?.() || ('erp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10)); }
function auditDeletionReason(){
  const value=prompt('삭제 사유를 입력하세요. (변경 이력에 기록됩니다.)','중복 또는 잘못 등록된 자료 정리');
  if(value===null||!String(value).trim()){alert('삭제 사유를 입력해야 합니다.');return '';}
  return String(value).trim();
}
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
function formatPhoneDisplay(v){
  const raw=String(v||'').trim();if(!raw)return '';
  const digits=raw.replace(/\D/g,'');if(!digits)return raw;
  if(digits.startsWith('02')){
    if(digits.length===9)return `${digits.slice(0,2)}-${digits.slice(2,5)}-${digits.slice(5,9)}`;
    if(digits.length===10)return `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,10)}`;
    return digits;
  }
  if(digits.length===10)return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
  if(digits.length===11)return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
  return digits;
}
function formatBirthDisplay(v){
  const raw=String(v||'').trim();if(!raw)return '';
  const digits=raw.replace(/\D/g,'');
  if(digits.length===8)return `${digits.slice(0,4)}.${digits.slice(4,6)}.${digits.slice(6,8)}`;
  if(digits.length===6)return `${digits.slice(0,2)}.${digits.slice(2,4)}.${digits.slice(4,6)}`;
  const ymd=raw.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);if(ymd)return `${ymd[1]}.${ymd[2].padStart(2,'0')}.${ymd[3].padStart(2,'0')}`;
  const shortYmd=raw.match(/^(\d{2})[-./](\d{1,2})[-./](\d{1,2})$/);if(shortYmd)return `${shortYmd[1]}.${shortYmd[2].padStart(2,'0')}.${shortYmd[3].padStart(2,'0')}`;
  return raw.replaceAll('-','.').replaceAll('/','.');
}
function normalizeRosterOrderDate(v){
  const s=String(v||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d=new Date(`${s}T00:00:00`);
  if(Number.isNaN(d.getTime())) return '';
  const normalized=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return normalized===s?s:'';
}
function normalizeRosterOrder(v){
  if(v===null||v===undefined||v==='') return '';
  const n=Number(v);
  return Number.isInteger(n)&&n>=1?n:'';
}
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
    rosterOrderDate:normalizeRosterOrderDate(a.rosterOrderDate), rosterOrder:normalizeRosterOrder(a.rosterOrder),
    finalDecision:a.finalDecision||'', decisionReason:a.decisionReason||'', consult:a.consult||'',
    memo:a.memo||'', employeeId:a.employeeId||'',
    failureReason:a.failureReason||'', withdrawalReason:a.withdrawalReason||'',
    lastContactDate:a.lastContactDate||'', nextContactDate:a.nextContactDate||'',
    progressHistory:Array.isArray(a.progressHistory)?a.progressHistory:[],
    lastChangedBy:a.lastChangedBy||'', lastChangedAt:a.lastChangedAt||''
}; }
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
    const data = readArrayFromStorageKey(STORAGE_KEY);
    return Array.isArray(data) ? data.map(normalize) : [];
  }catch(e){
    console.error('Recruit ERP load error', e);
    return [];
  }
}
const OPERATION_ENV_STORAGE_KEY = 'recruit_erp_ui_operation_environment';
function isCompanyLocalMode(){ return localStorage.getItem(OPERATION_ENV_STORAGE_KEY) === 'company'; }
function isLocalOnlyRuntime(){ return window.erpAppVersion?.LOCAL_ONLY === true; }
function updateStorageNote(){
  var el = $('storageNote');
  if(!el) return;
  el.setAttribute('aria-live','polite');
  el.className='security-note sync-local-note';
  el.innerHTML='<strong>LOCAL ONLY</strong><span>이 브라우저에만 안전하게 저장합니다.</span>';
}
window.isLocalOnlyRuntime=isLocalOnlyRuntime;
function save(){
  if(window.erpPermissions&&!window.erpPermissions.require('applicant.write'))return false;
  const auditBefore=window.erpAudit?.capture('applicant');
  if(!safeLocalStorageSet(STORAGE_KEY,JSON.stringify(applicants)))return false;
  window.erpAudit?.commitSave('applicant',auditBefore,applicants);
  renderAll();
  return true;
}
