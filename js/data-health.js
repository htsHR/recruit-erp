/* ===== CONSOLIDATED SOURCE: data-health-v10.38.2.js ===== */
(function(){
'use strict';
const REVIEW_KEY='recruit_erp_duplicate_review_v10_38_2';
let healthIssues=[];
let duplicateGroups=[];
let healthSeverity='all';
let duplicateType='all';

function byId(id){ return document.getElementById(id); }
function safe(v){ return String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function compact(v){ return String(v||'').trim().toLowerCase().replace(/[\s\-_.·(),]/g,''); }
function digits(v){ return String(v||'').replace(/\D/g,''); }
function personName(v){ return compact(v).replace(/님$/,''); }
function dateValue(v){ const d=new Date(String(v||'')+'T00:00:00'); return Number.isNaN(d.getTime())?null:d; }
function daysFromToday(v){ const d=dateValue(v); if(!d)return null; const now=dateValue(new Date().toISOString().slice(0,10)); return Math.round((now-d)/86400000); }
function appLabel(a){ return (a.name||'이름 없음')+(a.workplace?' · '+a.workplace:''); }
function getReviews(){ try{return JSON.parse(localStorage.getItem(REVIEW_KEY)||'{}')||{};}catch{return{};} }
function saveReviews(v){ localStorage.setItem(REVIEW_KEY,JSON.stringify(v)); }
function schoolById(id){ return (schools||[]).find(s=>String(s.id)===String(id)); }
function findSchoolByText(text){ const t=compact(text); if(!t)return null; return (schools||[]).find(s=>compact(s.name)===t||(s.aliases||[]).some(a=>compact(a)===t)); }
function addIssue(severity,type,title,detail,entity,entityType,extra){ healthIssues.push({id:type+'-'+(entity?.id||Math.random()),severity,type,title,detail,entity,entityType,extra:extra||{}}); }

function buildHealthIssues(){
  healthIssues=[];
  const staleDays=parseInt(byId('healthStaleDays')?.value||'30',10);
  const interviewStatuses=['면접예정','면접완료','다음면접'];
  const hireStatuses=['입사예정','출근'];
  const pendingStatuses=['미연락','부재중','면접예정','면접완료','다음면접'];
  const dupMembership=new Map();
  buildDuplicateGroups().forEach(g=>g.members.forEach(a=>dupMembership.set(a.id,true)));

  (applicants||[]).forEach(a=>{
    if(!String(a.phone||'').trim()) addIssue('error','missing-phone','연락처 누락',`${appLabel(a)}의 연락처가 비어 있습니다.`,a,'applicant');
    if(interviewStatuses.includes(a.status)&&!a.interviewDate) addIssue('error','missing-interview-date','면접일 누락',`${a.status} 상태이지만 면접일이 없습니다.`,a,'applicant');
    if(hireStatuses.includes(a.status)&&!a.hireDate) addIssue('error','missing-hire-date','입사일 누락',`${a.status} 상태이지만 입사일이 없습니다.`,a,'applicant');
    const ad=dateValue(a.applyDate), id=dateValue(a.interviewDate), hd=dateValue(a.hireDate);
    if(ad&&id&&id<ad) addIssue('error','date-order','상태·날짜 불일치','면접일이 지원일보다 빠릅니다.',a,'applicant');
    if(ad&&hd&&hd<ad) addIssue('error','date-order','상태·날짜 불일치','입사일이 지원일보다 빠릅니다.',a,'applicant');
    if(id&&hd&&hd<id) addIssue('error','date-order','상태·날짜 불일치','입사일이 면접일보다 빠릅니다.',a,'applicant');
    if(['미연락','부재중','서류탈락','불합격','철회','연락두절'].includes(a.status)&&(a.interviewDate||a.hireDate)) addIssue('warning','status-date','상태·날짜 불일치',`${a.status} 상태인데 면접일 또는 입사일이 입력돼 있습니다.`,a,'applicant');
    if(a.school){
      const linked=schoolById(a.schoolId), matched=findSchoolByText(a.school);
      if(a.schoolId&&!linked) addIssue('warning','school-link','학교명 표기 불일치',`연결된 schoolId가 학교 명부에 없습니다: ${a.school}`,a,'applicant');
      else if(linked&&compact(linked.name)!==compact(a.school)&&!(linked.aliases||[]).some(x=>compact(x)===compact(a.school))) addIssue('warning','school-name','학교명 표기 불일치',`지원자 표기 “${a.school}”와 연결 학교 “${linked.name}”가 다릅니다.`,a,'applicant');
      else if(!linked&&!matched) addIssue('review','school-unmatched','학교명 표기 불일치',`“${a.school}”이 협력학교 명부와 연결되지 않았습니다.`,a,'applicant');
    }
    if(dupMembership.has(a.id)) addIssue('review','duplicate','중복 지원자 후보','중복 지원자 관리에서 비교가 필요합니다.',a,'applicant');
    const age=daysFromToday(a.applyDate||a.createdAt?.slice(0,10));
    if(pendingStatuses.includes(a.status)&&age!==null&&age>=staleDays) addIssue('warning','stale','오래된 미처리 지원자',`지원 후 ${age}일이 지났지만 상태가 ${a.status}입니다.`,a,'applicant',{age});
  });

  const employeesById=new Map((employees||[]).map(e=>[String(e.id),e]));
  const activeHireApps=(applicants||[]).filter(a=>a.status==='출근'||(a.hireDate&&['입사예정','출근'].includes(a.status)));
  activeHireApps.forEach(a=>{
    const linked=a.employeeId?employeesById.get(String(a.employeeId)):null;
    const same=(employees||[]).find(e=>personName(e.name)===personName(a.name)&&(!a.hireDate||!e.hireDate||a.hireDate===e.hireDate));
    if(!linked&&!same) addIssue('warning','employee-missing','사원명부와 입사자 불일치','입사 또는 출근 처리됐지만 사원명부에서 일치하는 직원을 찾지 못했습니다.',a,'applicant');
  });
  (employees||[]).filter(e=>e.status!=='퇴사').forEach(e=>{
    const linked=(applicants||[]).find(a=>String(a.employeeId||'')===String(e.id)||personName(a.name)===personName(e.name));
    if(!linked) addIssue('review','applicant-missing','사원명부와 입사자 불일치','재직·입사예정 직원이지만 지원자 기록을 찾지 못했습니다.',e,'employee');
  });
  return healthIssues;
}

function pairScore(a,b){
  const sameName=personName(a.name)&&personName(a.name)===personName(b.name);
  const pa=digits(a.phone), pb=digits(b.phone), samePhone=pa&&pb&&pa===pb;
  const sameBirth=compact(a.birthYear)&&compact(a.birthYear)===compact(b.birthYear);
  let score=0,reasons=[],type='reapply';
  if(sameName&&samePhone){score+=100;reasons.push('이름+연락처 동일');type='exact';}
  else if(samePhone){score+=80;reasons.push('연락처 동일');type='phone';}
  if(sameName&&sameBirth){score+=70;reasons.push('이름+생년 동일');if(type==='reapply')type='birth';}
  if(sameName&&a.workplace&&b.workplace&&a.workplace!==b.workplace){score+=25;reasons.push('다른 근무지 재지원');if(score<70)type='reapply';}
  if(sameName&&a.applyDate&&b.applyDate&&a.applyDate!==b.applyDate){score+=15;reasons.push('지원일이 다른 재지원');}
  const former=(employees||[]).some(e=>e.status==='퇴사'&&personName(e.name)===personName(a.name));
  if(sameName&&former){score+=30;reasons.push('퇴사자 재지원 가능성');type='former';}
  return {score,reasons:[...new Set(reasons)],type};
}
function buildDuplicateGroups(){
  const list=applicants||[], pairs=[];
  for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){
    const p=pairScore(list[i],list[j]);
    if(p.score>=40) pairs.push({a:list[i],b:list[j],...p});
  }
  const parent=new Map();
  function find(x){if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,find(parent.get(x)));return parent.get(x);}
  function union(a,b){const x=find(a),y=find(b);if(x!==y)parent.set(y,x);}
  pairs.forEach(p=>union(p.a.id,p.b.id));
  const groups=new Map();
  pairs.forEach(p=>{const root=find(p.a.id);if(!groups.has(root))groups.set(root,{members:new Map(),reasons:new Set(),score:0,types:new Set()});const g=groups.get(root);g.members.set(p.a.id,p.a);g.members.set(p.b.id,p.b);p.reasons.forEach(r=>g.reasons.add(r));g.score=Math.max(g.score,p.score);g.types.add(p.type);});
  duplicateGroups=[...groups.values()].map((g,idx)=>({id:[...g.members.keys()].sort().join('|'),members:[...g.members.values()].sort((a,b)=>String(b.applyDate||b.createdAt).localeCompare(String(a.applyDate||a.createdAt))),reasons:[...g.reasons],score:g.score,type:g.types.has('exact')?'exact':g.types.has('phone')?'phone':g.types.has('birth')?'birth':g.types.has('former')?'former':'reapply'})).sort((a,b)=>b.score-a.score);
  return duplicateGroups;
}

function severityLabel(v){return v==='error'?'오류':v==='warning'?'주의':'확인 필요';}
function renderHealth(){
  buildHealthIssues();
  const counts={error:0,warning:0,review:0};healthIssues.forEach(x=>counts[x.severity]++);
  const unique=new Set(healthIssues.map(x=>x.entityType+':'+x.entity?.id)).size;
  byId('healthKpiGrid').innerHTML=`<article><span>전체 문제</span><strong>${healthIssues.length}</strong></article><article class="error"><span>오류</span><strong>${counts.error}</strong></article><article class="warning"><span>주의</span><strong>${counts.warning}</strong></article><article class="review"><span>확인 필요</span><strong>${counts.review}</strong></article><article><span>영향 데이터</span><strong>${unique}</strong></article>`;
  const q=compact(byId('healthSearch')?.value); const filtered=healthIssues.filter(x=>(healthSeverity==='all'||x.severity===healthSeverity)&&(!q||compact(x.title+x.detail+x.entity?.name+x.entity?.school).includes(q)));
  byId('healthSummary').textContent=`총 ${healthIssues.length}건 중 ${filtered.length}건 표시 · 자동 수정 없음`;
  byId('healthIssueList').innerHTML=filtered.length?filtered.map(x=>`<article class="health-issue ${x.severity}"><div class="issue-severity">${severityLabel(x.severity)}</div><div class="issue-copy"><h4>${safe(x.title)}</h4><p>${safe(x.detail)}</p><small>${safe(x.entityType==='employee'?'사원':'지원자')} · ${safe(x.entity?.name||'이름 없음')}${x.entity?.phone?' · '+safe(x.entity.phone):''}</small></div><button class="ghost health-open" data-entity-type="${x.entityType}" data-entity-id="${safe(x.entity?.id)}">열기</button></article>`).join(''):'<div class="health-empty"><strong>표시할 문제가 없습니다.</strong><span>현재 선택한 조건에서는 점검 항목이 발견되지 않았습니다.</span></div>';
}
function reviewStatus(id){return getReviews()[id]?.status||'pending';}
function renderDuplicates(){
  buildDuplicateGroups(); const reviews=getReviews();
  const filter=byId('duplicateReviewFilter')?.value||'pending', q=compact(byId('duplicateSearch')?.value);
  let list=duplicateGroups.filter(g=>(duplicateType==='all'||g.type===duplicateType)&&(!q||g.members.some(a=>compact(a.name+a.phone).includes(q)))&&(filter==='all'||reviewStatus(g.id)===filter));
  const candidatePeople=new Set(duplicateGroups.flatMap(g=>g.members.map(a=>a.id))).size;
  const pending=duplicateGroups.filter(g=>reviewStatus(g.id)==='pending').length;
  byId('duplicateKpiGrid').innerHTML=`<article><span>후보 그룹</span><strong>${duplicateGroups.length}</strong></article><article class="error"><span>강한 중복</span><strong>${duplicateGroups.filter(g=>g.type==='exact'||g.type==='phone').length}</strong></article><article class="warning"><span>재지원 후보</span><strong>${duplicateGroups.filter(g=>['reapply','former'].includes(g.type)).length}</strong></article><article class="review"><span>미검토</span><strong>${pending}</strong></article><article><span>관련 지원자</span><strong>${candidatePeople}</strong></article>`;
  byId('duplicateSummary').textContent=`후보 ${duplicateGroups.length}그룹 중 ${list.length}그룹 표시 · 자동 병합 금지`;
  byId('duplicateList').innerHTML=list.length?list.map(g=>{const st=reviewStatus(g.id);return `<article class="duplicate-card"><header><div><span class="duplicate-score">유사도 ${Math.min(100,g.score)}점</span><h4>${safe(g.reasons.join(' · '))}</h4></div><span class="review-state ${st}">${st==='pending'?'미검토':st==='reapply'?'정상 재지원':'중복 아님'}</span></header><div class="duplicate-members">${g.members.map(a=>`<div class="duplicate-member"><div><strong>${safe(a.name||'이름 없음')}</strong><span>${safe(a.status||'')} · ${safe(a.workplace||'근무지 없음')}</span></div><dl><div><dt>연락처</dt><dd>${safe(a.phone||'없음')}</dd></div><div><dt>생년</dt><dd>${safe(a.birthYear||'없음')}</dd></div><div><dt>지원일</dt><dd>${safe(a.applyDate||'없음')}</dd></div><div><dt>학교</dt><dd>${safe(a.school||'없음')}</dd></div></dl><button class="ghost duplicate-open" data-applicant-id="${safe(a.id)}">지원자 열기</button></div>`).join('')}</div><footer><span>자동 병합하지 않습니다. 비교 후 분류만 저장됩니다.</span><div><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="pending">미검토</button><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="reapply">정상 재지원</button><button class="ghost duplicate-review" data-group-id="${safe(g.id)}" data-review="exclude">중복 아님</button></div></footer></article>`}).join(''):'<div class="health-empty"><strong>표시할 중복 후보가 없습니다.</strong><span>검색 조건 또는 검토 상태를 변경해보세요.</span></div>';
}
function openEntity(type,id){
  if(type==='employee'){ if(typeof openEmployeeDetail==='function')openEmployeeDetail(id); else {setPage('employees');} }
  else { if(typeof openDetail==='function')openDetail(id); else if(typeof viewApplicant==='function')viewApplicant(id); else {setPage('applicants');} }
}
function bind(){
  byId('btnRunHealthCheck')?.addEventListener('click',renderHealth);byId('healthStaleDays')?.addEventListener('change',renderHealth);byId('healthSearch')?.addEventListener('input',renderHealth);
  byId('healthSeverityTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-health-severity]');if(!b)return;healthSeverity=b.dataset.healthSeverity;document.querySelectorAll('[data-health-severity]').forEach(x=>x.classList.toggle('active',x===b));renderHealth();});
  byId('healthIssueList')?.addEventListener('click',e=>{const b=e.target.closest('.health-open');if(b)openEntity(b.dataset.entityType,b.dataset.entityId);});
  byId('btnRunDuplicateCheck')?.addEventListener('click',renderDuplicates);byId('duplicateReviewFilter')?.addEventListener('change',renderDuplicates);byId('duplicateSearch')?.addEventListener('input',renderDuplicates);
  byId('duplicateTypeTabs')?.addEventListener('click',e=>{const b=e.target.closest('[data-duplicate-type]');if(!b)return;duplicateType=b.dataset.duplicateType;document.querySelectorAll('[data-duplicate-type]').forEach(x=>x.classList.toggle('active',x===b));renderDuplicates();});
  byId('duplicateList')?.addEventListener('click',e=>{const open=e.target.closest('.duplicate-open');if(open){openEntity('applicant',open.dataset.applicantId);return;}const b=e.target.closest('.duplicate-review');if(!b)return;const reviews=getReviews();reviews[b.dataset.groupId]={status:b.dataset.review,reviewedAt:new Date().toISOString()};saveReviews(reviews);renderDuplicates();renderHealth();});
  document.querySelectorAll('.nav-btn[data-page="dataHealth"],.nav-btn[data-page="duplicates"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>b.dataset.page==='dataHealth'?renderHealth():renderDuplicates(),0)));
}
const originalRenderAll=window.renderAll;
if(typeof originalRenderAll==='function') window.renderAll=function(){ originalRenderAll(); if(document.getElementById('dataHealth')?.classList.contains('active'))renderHealth(); if(document.getElementById('duplicates')?.classList.contains('active'))renderDuplicates(); };
window.erpRenderDataHealth=renderHealth;window.erpRenderDuplicates=renderDuplicates;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bind();renderHealth();renderDuplicates();});else{bind();renderHealth();renderDuplicates();}
})();

;

