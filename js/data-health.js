/* Recruit ERP v10.40.9 DATA_HEALTH_FINAL
 * 지원자·학교 연결·사원명부 데이터의 누락/형식/상태 불일치를 읽기 전용으로 점검합니다.
 * 자동 수정·자동 병합·자동 삭제는 수행하지 않습니다.
 */
(function(){
'use strict';
const REVIEW_KEY='recruit_erp_duplicate_review_v10_38_2';
const EXCEL_ORIGIN_KEY='recruit_erp_excel_paste_applicant_ids_v10_40_9';
let healthIssues=[];
let duplicateGroups=[];
let healthSeverity='all';
let healthCategory='all';
let healthExcelOnly=false;
let duplicateType='all';
let excelOriginCache=new Set();

function byId(id){ return document.getElementById(id); }
function safe(v){ return String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function compact(v){ return String(v||'').trim().toLowerCase().replace(/[\s\-_.·(),]/g,''); }
function digits(v){ return String(v||'').replace(/\D/g,''); }
function personName(v){ return compact(v).replace(/님$/,''); }
function rawDate(v){ return String(v||'').trim(); }
function parseIsoDate(v){
  const s=rawDate(v); if(!s)return null;
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!m)return null;
  const y=Number(m[1]),mo=Number(m[2]),d=Number(m[3]);
  const out=new Date(Date.UTC(y,mo-1,d));
  return out.getUTCFullYear()===y&&out.getUTCMonth()===mo-1&&out.getUTCDate()===d?out:null;
}
function daysFromToday(v){ const d=parseIsoDate(v); if(!d)return null; const now=parseIsoDate(typeof today==='function'?today():new Date().toISOString().slice(0,10)); return Math.floor((now-d)/86400000); }
function compareDate(a,b){ const x=parseIsoDate(a),y=parseIsoDate(b); if(!x||!y)return null; return x-y; }
function appLabel(a){ return (a.name||'이름 없음')+(a.workplace?' · '+a.workplace:''); }
function getReviews(){ try{return JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}')||{};}catch{return{};} }
function saveReviews(v){ localStorage.setItem(REVIEW_KEY,JSON.stringify(v)); }
function readExcelOriginIds(){
  try{const parsed=JSON.parse(localStorage.getItem(EXCEL_ORIGIN_KEY)||'[]');return new Set(Array.isArray(parsed)?parsed.map(String):[]);}catch{return new Set();}
}
function writeExcelOriginIds(ids){
  const validApplicants=new Set((Array.isArray(applicants)?applicants:[]).map(a=>String(a.id)));
  const list=[...new Set((ids||[]).map(String))].filter(id=>validApplicants.has(id));
  localStorage.setItem(EXCEL_ORIGIN_KEY,JSON.stringify(list));
  excelOriginCache=new Set(list);
  return list;
}
function markExcelApplicants(ids){const next=readExcelOriginIds();(Array.isArray(ids)?ids:[ids]).filter(Boolean).forEach(id=>next.add(String(id)));writeExcelOriginIds([...next]);}
function unmarkExcelApplicants(ids){const next=readExcelOriginIds();(Array.isArray(ids)?ids:[ids]).filter(Boolean).forEach(id=>next.delete(String(id)));writeExcelOriginIds([...next]);}
function schoolById(id){ return (Array.isArray(schools)?schools:[]).find(s=>String(s.id)===String(id)); }
function schoolAliases(s){ return Array.isArray(s?.aliases)?s.aliases:[]; }
function findSchoolByText(text){ const t=compact(text); if(!t)return null; return (Array.isArray(schools)?schools:[]).find(s=>compact(s.name)===t||schoolAliases(s).some(a=>compact(a)===t)); }
function entityKey(entityType,entity){return `${entityType}:${String(entity?.id||entity?.name||Math.random())}`;}
function addIssue(severity,type,category,title,detail,entity,entityType,extra){
  healthIssues.push({
    id:`${type}-${entityKey(entityType,entity)}-${healthIssues.length}`,
    severity,type,category,title,detail,entity,entityType,
    source:entityType==='applicant'&&excelOriginCache.has(String(entity?.id))?'excel':'existing',
    extra:extra||{}
  });
}
function validPhone(v){
  const d=digits(v); if(!d)return false;
  if(/^01[016789]\d{7,8}$/.test(d))return true;
  if(/^02\d{7,8}$/.test(d))return true;
  return /^0(?:3[1-3]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/.test(d);
}
function validEmail(v){const s=String(v||'').trim();return !s||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);}
function birthInfo(v){
  const s=String(v||'').trim(); if(!s)return {valid:true,empty:true};
  const only=digits(s); const current=new Date().getFullYear();
  if(/^\d{4}$/.test(only)&&only===s.replace(/\s/g,'')){
    const y=Number(only); return {valid:y>=1940&&y<=current,year:y};
  }
  if(/^\d{2}$/.test(only)&&only===s.replace(/\s/g,''))return {valid:true,year:Number(only)>30?1900+Number(only):2000+Number(only),ambiguous:true};
  let y,m,d;
  const full=s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  const short=s.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if(full){y=Number(full[1]);m=Number(full[2]);d=Number(full[3]);}
  else if(short){const yy=Number(short[1]);y=yy>30?1900+yy:2000+yy;m=Number(short[2]);d=Number(short[3]);}
  else if(/^\d{8}$/.test(only)){y=Number(only.slice(0,4));m=Number(only.slice(4,6));d=Number(only.slice(6,8));}
  else if(/^\d{6}$/.test(only)){const yy=Number(only.slice(0,2));y=yy>30?1900+yy:2000+yy;m=Number(only.slice(2,4));d=Number(only.slice(4,6));}
  else return {valid:false};
  const dt=new Date(Date.UTC(y,m-1,d));
  const valid=y>=1940&&y<=current&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
  return {valid,year:y,month:m,day:d};
}
function workplaceKnown(v){return ['천안','평택','기타'].includes(String(v||'').trim());}
function dormKnown(v){return ['기숙사','출퇴근'].includes(typeof normalizeDorm==='function'?normalizeDorm(v):String(v||'').trim());}
function statusOf(v){return typeof normalizeStatus==='function'?normalizeStatus(v):String(v||'').trim();}

function inspectSchoolLink(entity,entityType){
  const school=String(entity.school||'').trim(),schoolId=entity.schoolId;
  if(!school&&!schoolId)return;
  const linked=schoolId!==''&&schoolId!==null&&schoolId!==undefined?schoolById(schoolId):null;
  const matched=school?findSchoolByText(school):null;
  if(schoolId&&!linked){
    addIssue('warning','school-id-missing','school','학교 연결값 불일치',`schoolId “${schoolId}”가 협력학교 명부에 존재하지 않습니다.${school?` 학교 표기: ${school}`:''}`,entity,entityType);
    return;
  }
  if(linked&&!school){
    addIssue('warning','school-name-empty','school','학교명 표기 불일치',`학교 연결값은 “${linked.name}”이지만 학교명이 비어 있습니다.`,entity,entityType);
    return;
  }
  if(linked&&school&&compact(linked.name)!==compact(school)&&!schoolAliases(linked).some(x=>compact(x)===compact(school))){
    addIssue('warning','school-name-mismatch','school','학교명 표기 불일치',`데이터 표기 “${school}”와 연결된 학교 “${linked.name}”가 다릅니다.`,entity,entityType);
    return;
  }
  if(!linked&&matched){
    addIssue('review','school-id-unlinked','school','학교 연결값 누락',`“${school}”은 협력학교 명부의 “${matched.name}”과 일치하지만 schoolId가 연결되지 않았습니다.`,entity,entityType,{matchedSchoolId:matched.id});
    return;
  }
  if(!linked&&!matched&&school){
    addIssue('review','school-unmatched','school','학교명 표기 불일치',`“${school}”을 협력학교 명부에서 찾지 못했습니다.`,entity,entityType);
  }
}

function buildHealthIssues(){
  healthIssues=[];
  excelOriginCache=readExcelOriginIds();
  const staleDays=parseInt(byId('healthStaleDays')?.value||'30',10);
  const interviewStatuses=['면접예정','면접완료','다음면접'];
  const hireStatuses=['입사예정','출근'];
  const pendingStatuses=['미연락','부재중','면접예정','면접완료','다음면접'];
  const earlyStatuses=['미연락','부재중','서류탈락','불합격','철회','연락두절'];
  const todayValue=typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const dupMembership=new Map();
  buildDuplicateGroups().forEach(g=>g.members.forEach(a=>dupMembership.set(String(a.id),true)));

  (Array.isArray(applicants)?applicants:[]).forEach(a=>{
    const status=statusOf(a.status);
    if(!String(a.name||'').trim())addIssue('error','missing-name','applicant','성명 누락','지원자 성명이 비어 있습니다.',a,'applicant');
    if(!String(a.phone||'').trim())addIssue('error','missing-phone','applicant','연락처 누락',`${appLabel(a)}의 연락처가 비어 있습니다.`,a,'applicant');
    else if(!validPhone(a.phone))addIssue('error','phone-format','applicant','연락처 형식 오류',`“${a.phone}”은 정상적인 국내 연락처 형식으로 인식되지 않습니다.`,a,'applicant');
    if(a.email&&!validEmail(a.email))addIssue('error','email-format','applicant','이메일 형식 오류',`“${a.email}”의 이메일 형식을 확인하세요.`,a,'applicant');
    if(a.birthYear){const b=birthInfo(a.birthYear);if(!b.valid)addIssue('error','birth-format','applicant','생년월일 형식 오류',`“${a.birthYear}”을 유효한 생년 또는 생년월일로 인식하지 못했습니다.`,a,'applicant');}
    if(!String(a.workplace||'').trim())addIssue('warning','workplace-missing','applicant','지원근무지 미확인','지원근무지가 선택되지 않았습니다.',a,'applicant');
    else if(!workplaceKnown(a.workplace))addIssue('warning','workplace-unknown','applicant','지원근무지 미확인',`“${a.workplace}”은 천안·평택·기타 표준값이 아닙니다.`,a,'applicant');
    if(!dormKnown(a.dormUse))addIssue('review','dorm-unconfirmed','applicant','출근방법 미확인',`출근방법이 ${a.dormUse?'“'+a.dormUse+'”':'비어 있음'} 상태입니다. 기숙사 또는 출퇴근 여부를 확인하세요.`,a,'applicant');

    if(interviewStatuses.includes(status)&&!a.interviewDate)addIssue('error','missing-interview-date','applicant','면접일 누락',`${status} 상태이지만 면접일이 없습니다.`,a,'applicant');
    if(a.interviewTime&&!a.interviewDate)addIssue('error','interview-time-without-date','applicant','상태·날짜 불일치','면접시간이 입력돼 있지만 면접일이 없습니다.',a,'applicant');
    if(hireStatuses.includes(status)&&!a.hireDate)addIssue('error','missing-hire-date','applicant','입사일 누락',`${status} 상태이지만 입사일이 없습니다.`,a,'applicant');

    if(a.applyDate&&!parseIsoDate(a.applyDate))addIssue('error','apply-date-format','applicant','지원일 형식 오류',`지원일 “${a.applyDate}”이 YYYY-MM-DD 형식의 유효한 날짜가 아닙니다.`,a,'applicant');
    if(a.interviewDate&&!parseIsoDate(a.interviewDate))addIssue('error','interview-date-format','applicant','면접일 형식 오류',`면접일 “${a.interviewDate}”이 유효한 날짜가 아닙니다.`,a,'applicant');
    if(a.hireDate&&!parseIsoDate(a.hireDate))addIssue('error','hire-date-format','applicant','입사일 형식 오류',`입사일 “${a.hireDate}”이 유효한 날짜가 아닙니다.`,a,'applicant');
    if(compareDate(a.interviewDate,a.applyDate)!==null&&compareDate(a.interviewDate,a.applyDate)<0)addIssue('error','date-order-interview','applicant','상태·날짜 불일치','면접일이 지원일보다 빠릅니다.',a,'applicant');
    if(compareDate(a.hireDate,a.applyDate)!==null&&compareDate(a.hireDate,a.applyDate)<0)addIssue('error','date-order-hire-apply','applicant','상태·날짜 불일치','입사일이 지원일보다 빠릅니다.',a,'applicant');
    if(compareDate(a.hireDate,a.interviewDate)!==null&&compareDate(a.hireDate,a.interviewDate)<0)addIssue('error','date-order-hire-interview','applicant','입사일이 면접일보다 빠릅니다.',a,'applicant');
    if(earlyStatuses.includes(status)&&(a.interviewDate||a.hireDate))addIssue('warning','status-date','applicant','상태·날짜 불일치',`${status} 상태인데 면접일 또는 입사일이 입력돼 있습니다.`,a,'applicant');
    if(status==='면접예정'&&a.interviewDate&&a.interviewDate<todayValue)addIssue('warning','interview-overdue','applicant','면접 상태 확인 필요',`면접일 ${a.interviewDate}이 지났지만 상태가 면접예정입니다.`,a,'applicant');
    if(status==='입사예정'&&a.hireDate&&a.hireDate<todayValue)addIssue('warning','hire-overdue','applicant','입사 상태 확인 필요',`입사일 ${a.hireDate}이 지났지만 상태가 입사예정입니다.`,a,'applicant');
    if(status==='출근'&&a.hireDate&&a.hireDate>todayValue)addIssue('warning','hire-future-active','applicant','입사 상태 확인 필요',`입사일 ${a.hireDate}이 미래인데 상태가 출근입니다.`,a,'applicant');

    inspectSchoolLink(a,'applicant');
    if(dupMembership.has(String(a.id)))addIssue('review','duplicate','applicant','중복 지원자 후보','중복 지원자 관리에서 비교가 필요합니다.',a,'applicant');
    const age=daysFromToday(a.applyDate||String(a.createdAt||'').slice(0,10));
    if(pendingStatuses.includes(status)&&age!==null&&age>=staleDays)addIssue('warning','stale','applicant','오래된 미처리 지원자',`지원 후 ${age}일이 지났지만 상태가 ${status}입니다.`,a,'applicant',{age});
  });

  const employeesList=Array.isArray(employees)?employees:[];
  const employeesById=new Map(employeesList.map(e=>[String(e.id),e]));
  const completedApps=(Array.isArray(applicants)?applicants:[]).filter(a=>statusOf(a.status)==='출근'&&String(a.employeeId||'')!=='수동처리');
  completedApps.forEach(a=>{
    const linked=a.employeeId?employeesById.get(String(a.employeeId)):null;
    const same=employeesList.find(e=>personName(e.name)===personName(a.name)&&(!a.hireDate||!e.hireDate||a.hireDate===e.hireDate));
    if(!linked&&!same)addIssue('warning','employee-missing','employee','입사완료 지원자의 사원명부 누락','출근 처리된 지원자이지만 사원명부에서 일치하는 직원을 찾지 못했습니다.',a,'applicant');
  });

  employeesList.forEach(e=>{
    const status=String(e.status||'').trim();
    inspectSchoolLink(e,'employee');
    if(status==='퇴사'&&!e.leaveDate)addIssue('error','employee-leave-date-missing','employee','퇴직자 퇴사일 누락','퇴사 상태이지만 퇴사일이 없습니다.',e,'employee');
    if(status!=='퇴사'&&e.leaveDate)addIssue('warning','employee-leave-status','employee','사원 상태와 퇴사일 불일치',`${status||'상태 미입력'} 상태인데 퇴사일 ${e.leaveDate}이 입력돼 있습니다.`,e,'employee');
    if(status==='입사예정'&&!e.hireDate)addIssue('warning','employee-hire-date-missing','employee','사원 상태와 입사일 불일치','입사예정 상태이지만 입사일이 없습니다.',e,'employee');
    if(e.hireDate&&!parseIsoDate(e.hireDate))addIssue('error','employee-hire-date-format','employee','입사일 형식 오류',`입사일 “${e.hireDate}”이 유효한 날짜가 아닙니다.`,e,'employee');
    if(e.leaveDate&&!parseIsoDate(e.leaveDate))addIssue('error','employee-leave-date-format','employee','퇴사일 형식 오류',`퇴사일 “${e.leaveDate}”이 유효한 날짜가 아닙니다.`,e,'employee');
    if(compareDate(e.leaveDate,e.hireDate)!==null&&compareDate(e.leaveDate,e.hireDate)<0)addIssue('error','employee-date-order','employee','사원 상태와 입·퇴사일 불일치','퇴사일이 입사일보다 빠릅니다.',e,'employee');
    if(['재직중','휴직'].includes(status)&&e.hireDate&&e.hireDate>todayValue)addIssue('warning','employee-active-before-hire','employee','사원 상태와 입사일 불일치',`입사일 ${e.hireDate}이 미래인데 상태가 ${status}입니다.`,e,'employee');
    if(status==='입사예정'&&e.hireDate&&e.hireDate<todayValue)addIssue('warning','employee-hire-overdue','employee','사원 상태와 입사일 불일치',`입사일 ${e.hireDate}이 지났지만 상태가 입사예정입니다.`,e,'employee');
    if(status==='퇴사'&&e.leaveDate&&e.leaveDate>todayValue)addIssue('warning','employee-future-leave','employee','사원 상태와 퇴사일 불일치',`퇴사일 ${e.leaveDate}이 미래인데 상태가 퇴사입니다.`,e,'employee');
  });
  return healthIssues;
}

function pairScore(a,b){
  const sameName=personName(a.name)&&personName(a.name)===personName(b.name);
  const pa=digits(a.phone),pb=digits(b.phone),samePhone=pa&&pb&&pa===pb;
  const sameBirth=compact(a.birthYear)&&compact(a.birthYear)===compact(b.birthYear);
  let score=0,reasons=[],type='reapply';
  if(sameName&&samePhone){score+=100;reasons.push('이름+연락처 동일');type='exact';}
  else if(samePhone){score+=80;reasons.push('연락처 동일');type='phone';}
  if(sameName&&sameBirth){score+=70;reasons.push('이름+생년월일 동일');if(type==='reapply')type='birth';}
  if(sameName&&a.workplace&&b.workplace&&a.workplace!==b.workplace){score+=25;reasons.push('다른 근무지 재지원');if(score<70)type='reapply';}
  if(sameName&&a.applyDate&&b.applyDate&&a.applyDate!==b.applyDate){score+=15;reasons.push('지원일이 다른 재지원');}
  const former=(Array.isArray(employees)?employees:[]).some(e=>e.status==='퇴사'&&personName(e.name)===personName(a.name));
  if(sameName&&former){score+=30;reasons.push('퇴사자 재지원 가능성');type='former';}
  return {score,reasons:[...new Set(reasons)],type};
}
function buildDuplicateGroups(){
  const list=Array.isArray(applicants)?applicants:[],pairs=[];
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const p=pairScore(list[i],list[j]);if(p.score>=40)pairs.push({a:list[i],b:list[j],...p});
  }
  const parent=new Map();
  function find(x){if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,find(parent.get(x)));return parent.get(x);}
  function union(a,b){const x=find(a),y=find(b);if(x!==y)parent.set(y,x);}
  pairs.forEach(p=>union(p.a.id,p.b.id));
  const groups=new Map();
  pairs.forEach(p=>{const root=find(p.a.id);if(!groups.has(root))groups.set(root,{members:new Map(),reasons:new Set(),score:0,types:new Set()});const g=groups.get(root);g.members.set(p.a.id,p.a);g.members.set(p.b.id,p.b);p.reasons.forEach(r=>g.reasons.add(r));g.score=Math.max(g.score,p.score);g.types.add(p.type);});
  duplicateGroups=[...groups.values()].map(g=>({id:[...g.members.keys()].sort().join('|'),members:[...g.members.values()].sort((a,b)=>String(b.applyDate||b.createdAt).localeCompare(String(a.applyDate||a.createdAt))),reasons:[...g.reasons],score:g.score,type:g.types.has('exact')?'exact':g.types.has('phone')?'phone':g.types.has('birth')?'birth':g.types.has('former')?'former':'reapply'})).sort((a,b)=>b.score-a.score);
  return duplicateGroups;
}

function severityLabel(v){return v==='error'?'오류':v==='warning'?'주의':'확인 필요';}
function categoryLabel(v){return v==='school'?'학교 연결':v==='employee'?'사원':'지원자';}
function issueEntityLabel(x){return x.entityType==='employee'?'사원':x.entityType==='school'?'학교':'지원자';}
function filteredHealthIssues(){
  const q=compact(byId('healthSearch')?.value);
  return healthIssues.filter(x=>
    (healthSeverity==='all'||x.severity===healthSeverity)&&
    (healthCategory==='all'||x.category===healthCategory)&&
    (!healthExcelOnly||x.source==='excel')&&
    (!q||compact(`${x.title} ${x.detail} ${x.entity?.name||''} ${x.entity?.school||''} ${x.entity?.phone||''}`).includes(q))
  );
}
function renderHealth(rebuild=true){
  if(rebuild)buildHealthIssues();
  const counts={error:0,warning:0,review:0};healthIssues.forEach(x=>counts[x.severity]++);
  const unique=new Set(healthIssues.map(x=>entityKey(x.entityType,x.entity))).size;
  const kpi=byId('healthKpiGrid');if(kpi)kpi.innerHTML=`<article><span>전체 문제</span><strong>${healthIssues.length}</strong></article><article class="error"><span>오류</span><strong>${counts.error}</strong></article><article class="warning"><span>주의</span><strong>${counts.warning}</strong></article><article class="review"><span>확인 필요</span><strong>${counts.review}</strong></article><article><span>영향 데이터</span><strong>${unique}</strong></article>`;
  const filtered=filteredHealthIssues();
  const excelCount=healthIssues.filter(x=>x.source==='excel').length;
  const summary=byId('healthSummary');if(summary)summary.innerHTML=`<span>총 <strong>${healthIssues.length}</strong>건 중 <strong>${filtered.length}</strong>건 표시</span><span>지원자 ${healthIssues.filter(x=>x.category==='applicant').length} · 학교 연결 ${healthIssues.filter(x=>x.category==='school').length} · 사원 ${healthIssues.filter(x=>x.category==='employee').length}</span><span>엑셀 추적 문제 ${excelCount}건 · 자동 수정 없음</span>`;
  const list=byId('healthIssueList');if(!list)return;
  list.innerHTML=filtered.length?filtered.map(x=>`<article class="health-issue ${x.severity}" data-health-issue-id="${safe(x.id)}">
    <div class="issue-severity"><span>${severityLabel(x.severity)}</span><small>${categoryLabel(x.category)}</small></div>
    <div class="issue-copy"><div class="issue-title-line"><h4>${safe(x.title)}</h4>${x.source==='excel'?'<span class="health-source-badge">엑셀 붙여넣기</span>':''}</div><p>${safe(x.detail)}</p><small>${safe(issueEntityLabel(x))} · ${safe(x.entity?.name||'이름 없음')}${x.entity?.phone?' · '+safe(x.entity.phone):''}${x.entity?.school?' · '+safe(x.entity.school):''}</small></div>
    <div class="health-issue-actions"><button class="ghost health-open" data-mode="detail" data-entity-type="${safe(x.entityType)}" data-entity-id="${safe(x.entity?.id)}">상세</button><button class="primary health-open" data-mode="edit" data-entity-type="${safe(x.entityType)}" data-entity-id="${safe(x.entity?.id)}">수정</button></div>
  </article>`).join(''):'<div class="health-empty"><strong>표시할 문제가 없습니다.</strong><span>현재 선택한 조건에서는 점검 항목이 발견되지 않았습니다.</span></div>';
}
function reviewStatus(id){return getReviews()[id]?.status||'pending';}
function renderDuplicates(){
  buildDuplicateGroups();
  const filter=byId('duplicateReviewFilter')?.value||'pending',q=compact(byId('duplicateSearch')?.value);
  const list=duplicateGroups.filter(g=>(duplicateType==='all'||g.type===duplicateType)&&(!q||g.members.some(a=>compact(a.name+a.phone).includes(q)))&&(filter==='all'||reviewStatus(g.id)===filter));
  const candidatePeople=new Set(duplicateGroups.flatMap(g=>g.members.map(a=>a.id))).size;
  const pending=duplicateGroups.filter(g=>reviewStatus(g.id)==='pending').length;
  const kpi=byId('duplicateKpiGrid');if(kpi)kpi.innerHTML=`<article><span>후보 그룹</span><strong>${duplicateGroups.length}</strong></article><article class="error"><span>강한 중복</span><strong>${duplicateGroups.filter(g=>g.type==='exact'||g.type==='phone').length}</strong></article><article class="warning"><span>재지원 후보</span><strong>${duplicateGroups.filter(g=>['reapply','former'].includes(g.type)).length}</strong></article><article class="review"><span>미검토</span><strong>${pending}</strong></article><article><span>관련 지원자</span><strong>${candidatePeople}</strong></article>`;
  const summary=byId('duplicateSummary');if(summary)summary.textContent=`후보 ${duplicateGroups.length}그룹 중 ${list.length}그룹 표시 · 자동 병합 금지`;
  const target=byId('duplicateList');if(!target)return;
  target.innerHTML=list.length?list.map(g=>{const st=reviewStatus(g.id);return `<article class="duplicate-card"><header><div><span class="duplicate-score">유사도 ${Math.min(100,g.score)}점</span><h4>${safe(g.reasons.join(' · '))}</h4></div><span class="review-state ${st}">${st==='pending'?'미검토':st==='reapply'?'정상 재지원':'중복 아님'}</span></header><div class="duplicate-members">${g.members.map(a=>`<div class="duplicate-member"><div><strong>${safe(a.name||'이름 없음')}</strong><span>${safe(a.status||'')} · ${safe(a.workplace||'근무지 없음')}</span></div><dl><div><dt>연락처</dt><dd>${safe(a.phone||'없음')}</dd></div><div><dt>생년월일</dt><dd>${safe(a.birthYear||'없음')}</dd></div><div><dt>지원일</dt><dd>${safe(a.applyDate||'없음')}</dd></div><div><dt>학교</dt><dd>${safe(a.school||'없음')}</dd></div></dl><button class="ghost duplicate-open" data-applicant-id="${safe(a.id)}">지원자 열기</button></div>`).join('')}</div><footer><span>자동 병합하지 않습니다. 비교 후 분류만 저장됩니다.</span><div><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="pending">미검토</button><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="reapply">정상 재지원</button><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="exclude">중복 아님</button></div></footer></article>`}).join(''):'<div class="health-empty"><strong>표시할 중복 후보가 없습니다.</strong><span>검색 조건 또는 검토 상태를 변경해보세요.</span></div>';
}
function openEntity(type,id,mode){
  if(type==='employee'){
    if(mode==='edit'&&typeof editEmployeePrompt==='function'){setPage('employees');setTimeout(()=>{editEmployeePrompt(id);byId('employeeForm')?.scrollIntoView({behavior:'smooth',block:'start'});},0);return;}
    if(typeof openEmployeeDetail==='function'){openEmployeeDetail(id);return;}setPage('employees');return;
  }
  if(type==='school'){
    if(mode==='edit'&&typeof editSchoolPrompt==='function'){setPage('schools');setTimeout(()=>editSchoolPrompt(id),0);return;}
    if(typeof openSchoolDetail==='function'){openSchoolDetail(id);return;}setPage('schools');return;
  }
  if(mode==='edit'&&typeof editApplicant==='function'){editApplicant(id);return;}
  if(typeof viewApplicant==='function'){viewApplicant(id);return;}
  setPage('applicants');
}
function bind(){
  byId('btnRunHealthCheck')?.addEventListener('click',renderHealth);
  byId('healthStaleDays')?.addEventListener('change',renderHealth);
  byId('healthSearch')?.addEventListener('input',()=>renderHealth(false));
  byId('healthCategory')?.addEventListener('change',e=>{healthCategory=e.target.value||'all';renderHealth(false);});
  byId('healthExcelOnly')?.addEventListener('change',e=>{healthExcelOnly=!!e.target.checked;renderHealth(false);});
  byId('healthSeverityTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-health-severity]');if(!b)return;healthSeverity=b.dataset.healthSeverity;document.querySelectorAll('[data-health-severity]').forEach(x=>x.classList.toggle('active',x===b));renderHealth(false);});
  byId('healthIssueList')?.addEventListener('click',e=>{const b=e.target.closest('.health-open');if(b)openEntity(b.dataset.entityType,b.dataset.entityId,b.dataset.mode||'detail');});
  byId('btnRunDuplicateCheck')?.addEventListener('click',renderDuplicates);
  byId('duplicateReviewFilter')?.addEventListener('change',renderDuplicates);
  byId('duplicateSearch')?.addEventListener('input',renderDuplicates);
  byId('duplicateTypeTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-duplicate-type]');if(!b)return;duplicateType=b.dataset.duplicateType;document.querySelectorAll('[data-duplicate-type]').forEach(x=>x.classList.toggle('active',x===b));renderDuplicates();});
  byId('duplicateList')?.addEventListener('click',e=>{const open=e.target.closest('.duplicate-open');if(open){openEntity('applicant',open.dataset.applicantId,'detail');return;}const b=e.target.closest('.duplicate-review');if(!b)return;const reviews=getReviews();reviews[b.dataset.groupId]={status:b.dataset.review,reviewedAt:new Date().toISOString()};saveReviews(reviews);renderDuplicates();renderHealth();});
  document.querySelectorAll('.nav-btn[data-page="dataHealth"],.nav-btn[data-page="duplicates"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>b.dataset.page==='dataHealth'?renderHealth():renderDuplicates(),0)));
}
const originalRenderAll=window.renderAll;
if(typeof originalRenderAll==='function')window.renderAll=function(){originalRenderAll();if(byId('dataHealth')?.classList.contains('active'))renderHealth();if(byId('duplicates')?.classList.contains('active'))renderDuplicates();};
window.erpRenderDataHealth=renderHealth;
window.erpRenderDuplicates=renderDuplicates;
window.erpMarkExcelApplicants=markExcelApplicants;
window.erpUnmarkExcelApplicants=unmarkExcelApplicants;
window.erpGetExcelApplicantIds=()=>[...readExcelOriginIds()];
window.erpSetExcelApplicantIds=ids=>writeExcelOriginIds(Array.isArray(ids)?ids:[]);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();renderHealth();renderDuplicates();});else{bind();renderHealth();renderDuplicates();}
})();
