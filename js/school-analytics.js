/* Recruit ERP v10.43.0 SCHOOL_ANALYTICS_PACK */
(function(){
  const state={year:'all',type:'all',workplace:'all',search:'',sort:'score',rows:[]};
  const el=id=>document.getElementById(id);
  const safe=v=>typeof esc==='function'?esc(v):String(v??'');
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  function yearOf(v){const m=String(v||'').match(/^(\d{4})/);return m?m[1]:'';}
  function todayYear(){return String(new Date().getFullYear());}
  function isInterview(a){
    if(a.interviewDate) return true;
    const st=typeof normalizeStatus==='function'?normalizeStatus(a.status):String(a.status||'');
    return ['면접완료','다음면접','입사예정','출근'].includes(st);
  }
  function isApplicantHire(a){
    const st=typeof normalizeStatus==='function'?normalizeStatus(a.status):String(a.status||'');
    return ['입사예정','출근'].includes(st)||!!a.hireDate;
  }
  function tenureMonths(e){
    if(!e.hireDate)return null;
    const start=new Date(e.hireDate);if(!Number.isFinite(start.getTime()))return null;
    let end=new Date();
    if(String(e.status||'')==='퇴사'&&e.leaveDate){const d=new Date(e.leaveDate);if(Number.isFinite(d.getTime()))end=d;}
    const months=(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth());
    return months>=0?months:null;
  }
  function employeeForYear(e,year){
    if(year==='all')return true;
    return yearOf(e.hireDate)===year;
  }
  function applicantForYear(a,year){
    if(year==='all')return true;
    return yearOf(a.applyDate)===year;
  }
  function recentOneYearDate(){const d=new Date();d.setFullYear(d.getFullYear()-1);return d;}
  function schoolRows(){
    const recentCut=recentOneYearDate();
    const rows=(Array.isArray(schools)?schools:[]).map(s=>{
      let apps=(Array.isArray(applicants)?applicants:[]).filter(a=>String(a.schoolId||'')===String(s.id));
      let emps=(Array.isArray(employees)?employees:[]).filter(e=>String(e.schoolId||'')===String(s.id));
      const allApps=apps.slice(),allEmps=emps.slice();
      apps=apps.filter(a=>applicantForYear(a,state.year));
      emps=emps.filter(e=>employeeForYear(e,state.year));
      if(state.workplace!=='all') apps=apps.filter(a=>String(a.workplace||'기타')===state.workplace);
      const applicantCount=apps.length;
      const interviewCount=apps.filter(isInterview).length;
      const applicantHires=apps.filter(isApplicantHire).length;
      const employeeHires=emps.length;
      const hireCount=state.workplace==='all'?Math.max(applicantHires,employeeHires):applicantHires;
      const activeCount=allEmps.filter(e=>['재직중','재직','휴직'].includes(String(e.status||''))).length;
      const retiredCount=allEmps.filter(e=>['퇴사','퇴직'].includes(String(e.status||''))).length;
      const tenures=allEmps.map(tenureMonths).filter(v=>v!==null);
      const avgTenure=tenures.length?Math.round(tenures.reduce((a,b)=>a+b,0)/tenures.length*10)/10:null;
      const conversion=applicantCount?Math.round(Math.min(hireCount,applicantCount)/applicantCount*1000)/10:0;
      const recentHires=allEmps.filter(e=>{const d=new Date(e.hireDate);return Number.isFinite(d.getTime())&&d>=recentCut;}).length;
      return {school:s,applicantCount,interviewCount,hireCount,activeCount,retiredCount,avgTenure,conversion,recentHires,allApps,allEmps};
    });
    const max={
      applicants:Math.max(1,...rows.map(r=>r.applicantCount)),
      hires:Math.max(1,...rows.map(r=>r.hireCount)),
      active:Math.max(1,...rows.map(r=>r.activeCount)),
      recent:Math.max(1,...rows.map(r=>r.recentHires))
    };
    rows.forEach(r=>{
      const parts={
        volume:r.applicantCount/max.applicants*20,
        hires:r.hireCount/max.hires*25,
        active:r.activeCount/max.active*20,
        conversion:Math.min(r.conversion,100)/100*15,
        tenure:Math.min(r.avgTenure||0,48)/48*10,
        recent:r.recentHires/max.recent*10
      };
      r.score=Math.round(Object.values(parts).reduce((a,b)=>a+b,0)*10)/10;
      r.lowSample=r.applicantCount<3&&r.hireCount<3&&r.activeCount<3;
      r.grade=r.lowSample?'표본 주의':r.score>=70?'우수 후보':r.score>=45?'관찰':'일반';
      r.scoreParts=parts;
    });
    return rows;
  }
  function filteredRows(){
    const q=state.search.trim().toLowerCase();
    let rows=schoolRows().filter(r=>{
      const s=r.school;
      if(state.type!=='all'&&String(typeof normalizeSchoolType==='function'?normalizeSchoolType(s.type):s.type)!==state.type)return false;
      if(q&&!([s.name,...(s.aliases||[])].join(' ').toLowerCase().includes(q)))return false;
      return true;
    });
    const keyMap={score:'score',applicants:'applicantCount',interviews:'interviewCount',hires:'hireCount',active:'activeCount',conversion:'conversion',tenure:'avgTenure'};
    const key=keyMap[state.sort]||'score';
    rows.sort((a,b)=>num(b[key])-num(a[key])||String(a.school.name||'').localeCompare(String(b.school.name||''),'ko'));
    rows.forEach((r,i)=>r.rank=i+1);
    return rows;
  }
  function renderFilters(){
    const years=new Set();
    (applicants||[]).forEach(a=>{const y=yearOf(a.applyDate);if(y)years.add(y)});
    (employees||[]).forEach(e=>{const y=yearOf(e.hireDate);if(y)years.add(y)});
    years.add(todayYear());
    const yearEl=el('schoolAnalyticsYear');
    if(yearEl){yearEl.innerHTML='<option value="all">전체 기간</option>'+[...years].sort().reverse().map(y=>`<option value="${y}">${y}년</option>`).join('');yearEl.value=state.year;}
    const places=[...new Set((applicants||[]).map(a=>String(a.workplace||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
    const wp=el('schoolAnalyticsWorkplace');
    if(wp){wp.innerHTML='<option value="all">전체</option>'+places.map(x=>`<option>${safe(x)}</option>`).join('');wp.value=state.workplace;}
  }
  function renderSummary(rows){
    const sums=rows.reduce((o,r)=>{o.apps+=r.applicantCount;o.interviews+=r.interviewCount;o.hires+=r.hireCount;o.active+=r.activeCount;return o;},{apps:0,interviews:0,hires:0,active:0});
    const conversion=sums.apps?Math.round(sums.hires/sums.apps*1000)/10:0;
    setText('saSchoolCount',rows.length);setText('saApplicantCount',sums.apps);setText('saInterviewCount',sums.interviews);setText('saHireCount',sums.hires);setText('saActiveCount',sums.active);setText('saConversion',conversion+'%');
  }
  function barHtml(label,values,max){
    const total=values.reduce((a,b)=>a+b,0);const width=max?Math.max(3,Math.round(total/max*100)):0;
    return `<div class="sa-bar-row"><div><strong>${safe(label)}</strong><span>지원 ${values[0]} · 면접 ${values[1]} · 입사 ${values[2]}</span></div><div class="sa-bar-track"><i style="width:${width}%"></i></div><b>${total}</b></div>`;
  }
  function renderYearBars(rows){
    const years=new Set();
    rows.forEach(r=>r.allApps.forEach(a=>{const y=yearOf(a.applyDate);if(y)years.add(y)}));
    rows.forEach(r=>r.allEmps.forEach(e=>{const y=yearOf(e.hireDate);if(y)years.add(y)}));
    const ys=[...years].sort().reverse().slice(0,5);
    const data=ys.map(y=>{
      const apps=rows.flatMap(r=>r.allApps).filter(a=>yearOf(a.applyDate)===y);
      const hires=rows.flatMap(r=>r.allEmps).filter(e=>yearOf(e.hireDate)===y).length;
      return [y,[apps.length,apps.filter(isInterview).length,hires]];
    });
    const max=Math.max(1,...data.map(x=>x[1].reduce((a,b)=>a+b,0)));
    el('schoolAnalyticsYearBars').innerHTML=data.length?data.map(([y,v])=>barHtml(y+'년',v,max)).join(''):'<div class="empty">연도별 데이터가 없습니다.</div>';
  }
  function renderWorkplaceBars(rows){
    const apps=rows.flatMap(r=>r.allApps).filter(a=>applicantForYear(a,state.year));
    const map={};apps.forEach(a=>{const k=String(a.workplace||'기타').trim()||'기타';map[k]??=[0,0,0];map[k][0]++;if(isInterview(a))map[k][1]++;if(isApplicantHire(a))map[k][2]++;});
    const data=Object.entries(map).sort((a,b)=>b[1][0]-a[1][0]);const max=Math.max(1,...data.map(x=>x[1].reduce((a,b)=>a+b,0)));
    el('schoolAnalyticsWorkplaceBars').innerHTML=data.length?data.map(([k,v])=>barHtml(k,v,max)).join(''):'<div class="empty">근무지별 데이터가 없습니다.</div>';
  }
  function renderMajorBars(rows){
    const apps=rows.flatMap(r=>r.allApps).filter(a=>applicantForYear(a,state.year));
    const map={};apps.forEach(a=>{const k=String(a.major||'학과 미등록').trim()||'학과 미등록';map[k]??=[0,0,0];map[k][0]++;if(isInterview(a))map[k][1]++;if(isApplicantHire(a))map[k][2]++;});
    const data=Object.entries(map).sort((a,b)=>b[1][0]-a[1][0]).slice(0,10);const max=Math.max(1,...data.map(x=>x[1].reduce((a,b)=>a+b,0)));
    el('schoolAnalyticsMajorBars').innerHTML=data.length?data.map(([k,v])=>barHtml(k,v,max)).join(''):'<div class="empty">학과별 데이터가 없습니다.</div>';
  }
  function gradeClass(g){return g==='우수 후보'?'strong':g==='관찰'?'watch':g==='표본 주의'?'sample':'normal';}
  function renderTable(rows){
    setText('schoolAnalyticsCount',rows.length+'개교');
    const body=el('schoolAnalyticsBody');
    body.innerHTML=rows.length?rows.map(r=>`<tr onclick="openSchoolDetail('${r.school.id}')" tabindex="0"><td>${r.rank}</td><td><button class="link-like">${safe(r.school.name)}</button><small>${safe(r.school.region||'')}</small></td><td>${typeof schoolTypeBadge==='function'?schoolTypeBadge(r.school.type):safe(r.school.type)}</td><td>${r.applicantCount}</td><td>${r.interviewCount}</td><td>${r.hireCount}</td><td>${r.activeCount}</td><td>${r.retiredCount}</td><td><strong>${r.conversion}%</strong></td><td>${r.avgTenure==null?'-':Math.round(r.avgTenure)+'개월'}</td><td>${r.recentHires}</td><td><div class="sa-score"><strong>${r.score}</strong><span><i style="width:${Math.min(100,r.score)}%"></i></span></div></td><td><span class="score-grade ${gradeClass(r.grade)}">${r.grade}</span></td></tr>`).join(''):'<tr><td colspan="13" class="empty">조건에 맞는 학교 성과 데이터가 없습니다.</td></tr>';
  }
  function render(){
    renderFilters();
    const rows=filteredRows();state.rows=rows;
    renderSummary(rows);renderYearBars(rows);renderWorkplaceBars(rows);renderMajorBars(rows);renderTable(rows);
  }
  function reset(){state.year='all';state.type='all';state.workplace='all';state.search='';state.sort='score';['schoolAnalyticsType','schoolAnalyticsWorkplace','schoolAnalyticsSort'].forEach(id=>{const x=el(id);if(x)x.value=id==='schoolAnalyticsSort'?'score':'all'});if(el('schoolAnalyticsSearch'))el('schoolAnalyticsSearch').value='';render();}
  function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function exportCsv(){
    const head=['순위','학교명','지역','구분','지원자','면접자','입사자','재직자','퇴직자','입사전환율','평균근속개월','최근1년입사','핵심학교참고점수','판정'];
    const lines=[head,...state.rows.map(r=>[r.rank,r.school.name,r.school.region,typeof normalizeSchoolType==='function'?normalizeSchoolType(r.school.type):r.school.type,r.applicantCount,r.interviewCount,r.hireCount,r.activeCount,r.retiredCount,r.conversion,r.avgTenure??'',r.recentHires,r.score,r.grade])].map(row=>row.map(csvCell).join(','));
    const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`school_analytics_${state.year==='all'?'all':state.year}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function bind(){
    el('schoolAnalyticsYear')?.addEventListener('change',e=>{state.year=e.target.value;render()});
    el('schoolAnalyticsType')?.addEventListener('change',e=>{state.type=e.target.value;render()});
    el('schoolAnalyticsWorkplace')?.addEventListener('change',e=>{state.workplace=e.target.value;render()});
    el('schoolAnalyticsSearch')?.addEventListener('input',e=>{state.search=e.target.value;render()});
    el('schoolAnalyticsSort')?.addEventListener('change',e=>{state.sort=e.target.value;render()});
    el('btnResetSchoolAnalytics')?.addEventListener('click',reset);
    el('btnSchoolAnalyticsExport')?.addEventListener('click',exportCsv);
  }
  window.renderSchoolAnalytics=render;
  document.addEventListener('DOMContentLoaded',()=>{bind();render();});
})();
