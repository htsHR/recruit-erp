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
function renderHireStats(){ renderStatsWorkplaceFilter(); renderStatsSummary(); renderStatsYear(); renderStatsMonth(); renderStatsWorkplace(); renderStatsDorm(); renderStatsStatus(); renderStatsFunnel(); renderStatsSource(); }

