/* Recruit ERP v10.45.0 SCHOOL_REPORT_PACK */
(function(){
  const $r=id=>document.getElementById(id);
  const safe=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const state={type:'performance',start:'',end:'',schoolType:'all',region:'all',search:'',privacy:true,onlyWithData:false,rows:[]};
  const labels={performance:'학교별 채용 실적',contact:'최근 접촉 현황',request:'추천 요청 현황',pending:'미회신 학교',mou:'MOU 현황',stale:'장기 미접촉 학교',core:'핵심학교 목록'};
  function d(v){const x=new Date(v);return Number.isFinite(x.getTime())?x:null;}
  function inRange(v){if(!v)return false;const x=d(v);if(!x)return false;const s=state.start?d(state.start):null,e=state.end?d(state.end+'T23:59:59'):null;return (!s||x>=s)&&(!e||x<=e);}
  function daysSince(v){const x=d(v);if(!x)return null;const now=new Date();now.setHours(0,0,0,0);x.setHours(0,0,0,0);return Math.floor((now-x)/86400000);}
  function schoolApps(s){return (Array.isArray(applicants)?applicants:[]).filter(a=>String(a.schoolId||'')===String(s.id));}
  function schoolEmps(s){return (Array.isArray(employees)?employees:[]).filter(e=>String(e.schoolId||'')===String(s.id));}
  function appDate(a){return a.applyDate||a.createdAt||'';}
  function empHireDate(e){return e.hireDate||e.startDate||e.createdAt||'';}
  function isInterview(a){const st=typeof normalizeStatus==='function'?normalizeStatus(a.status):String(a.status||'');return !!a.interviewDate||['면접완료','다음면접','입사예정','출근'].includes(st);}
  function isHire(a){const st=typeof normalizeStatus==='function'?normalizeStatus(a.status):String(a.status||'');return !!a.hireDate||['입사예정','출근'].includes(st);}
  function isActive(e){return ['재직','재직중','휴직'].includes(String(e.status||'').trim());}
  function isRetired(e){return ['퇴사','퇴직'].includes(String(e.status||'').trim());}
  function tenure(e){const s=d(empHireDate(e));if(!s)return null;let end=new Date();if(isRetired(e)&&e.leaveDate){const x=d(e.leaveDate);if(x)end=x;}return Math.max(0,(end.getFullYear()-s.getFullYear())*12+end.getMonth()-s.getMonth());}
  function latestActivity(s){const list=(Array.isArray(s.activities)?s.activities:[]).filter(a=>!state.start&&!state.end||inRange(a.date||a.createdAt));return [...list].sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0]||null;}
  function requests(s){return (Array.isArray(s.recommendationRequests)?s.recommendationRequests:[]).filter(r=>!state.start&&!state.end||inRange(r.requestDate||r.createdAt));}
  function scoreRows(base){
    const max={apps:Math.max(1,...base.map(r=>r.applicants)),hires:Math.max(1,...base.map(r=>r.hires)),active:Math.max(1,...base.map(r=>r.active)),recent:Math.max(1,...base.map(r=>r.recentHires))};
    base.forEach(r=>{r.score=Math.round(((r.applicants/max.apps*20)+(r.hires/max.hires*25)+(r.active/max.active*20)+(Math.min(r.conversion,100)/100*15)+(Math.min(r.avgTenure||0,48)/48*10)+(r.recentHires/max.recent*10))*10)/10;r.grade=r.score>=70?'우수 후보':r.score>=45?'관찰':'일반';});
  }
  function baseRows(){
    const recentCut=new Date();recentCut.setFullYear(recentCut.getFullYear()-1);
    const rows=(Array.isArray(schools)?schools:[]).map(s=>{
      const allA=schoolApps(s),allE=schoolEmps(s);
      const aa=(!state.start&&!state.end)?allA:allA.filter(a=>inRange(appDate(a)));
      const ee=(!state.start&&!state.end)?allE:allE.filter(e=>inRange(empHireDate(e)));
      const hires=Math.max(aa.filter(isHire).length,ee.length);
      const ten=allE.map(tenure).filter(x=>x!==null);
      const last=typeof schoolLastManagedDate==='function'?schoolLastManagedDate(s):(s.lastContactDate||s.updatedAt||s.createdAt||'');
      return {school:s,apps:allA,emps:allE,applicants:aa.length,interviews:aa.filter(isInterview).length,hires,active:allE.filter(isActive).length,retired:allE.filter(isRetired).length,conversion:aa.length?Math.round(Math.min(hires,aa.length)/aa.length*1000)/10:0,avgTenure:ten.length?Math.round(ten.reduce((a,b)=>a+b,0)/ten.length*10)/10:null,recentHires:allE.filter(e=>{const x=d(empHireDate(e));return x&&x>=recentCut;}).length,lastContact:last,daysInactive:daysSince(last),activity:latestActivity(s),requests:requests(s),mou:s.mouInfo||{},contact:s.contact||((s.contacts||[]).find(c=>c.primary)||s.contacts?.[0]||{}).name||'',phone:s.contactPhone||((s.contacts||[]).find(c=>c.primary)||s.contacts?.[0]||{}).phone||''};
    });
    scoreRows(rows);return rows;
  }
  function filterSchools(rows){const q=state.search.trim().toLowerCase();return rows.filter(r=>{const s=r.school;if(state.schoolType!=='all'&&(typeof normalizeSchoolType==='function'?normalizeSchoolType(s.type):s.type)!==state.schoolType)return false;if(state.region!=='all'&&String(s.region||'')!==state.region)return false;if(q&&![s.name,...(s.aliases||[])].join(' ').toLowerCase().includes(q))return false;return true;});}
  function reportRows(){let rows=filterSchools(baseRows());
    if(state.type==='performance') rows=rows.filter(r=>!state.onlyWithData||r.applicants+r.hires+r.active+r.retired>0).sort((a,b)=>b.hires-a.hires||b.applicants-a.applicants);
    if(state.type==='contact') rows=rows.filter(r=>r.activity||r.lastContact).sort((a,b)=>String(b.activity?.date||b.lastContact||'').localeCompare(String(a.activity?.date||a.lastContact||'')));
    if(state.type==='request') rows=rows.filter(r=>r.requests.length).flatMap(r=>r.requests.map(x=>({...r,request:x}))).sort((a,b)=>String(b.request.requestDate||'').localeCompare(String(a.request.requestDate||'')));
    if(state.type==='pending') rows=rows.filter(r=>r.requests.some(x=>['요청','진행중','미회신'].includes(String(x.status||'')))).map(r=>({...r,request:[...r.requests].sort((a,b)=>String(b.requestDate||'').localeCompare(String(a.requestDate||'')))[0]}));
    if(state.type==='mou') rows=rows.filter(r=>r.mou.status||r.mou.signedDate||r.school.mouDate).sort((a,b)=>String(a.mou.expireDate||'9999').localeCompare(String(b.mou.expireDate||'9999')));
    if(state.type==='stale') rows=rows.filter(r=>r.daysInactive===null||r.daysInactive>=90).sort((a,b)=>(b.daysInactive??99999)-(a.daysInactive??99999));
    if(state.type==='core') rows=rows.filter(r=>r.score>=45).sort((a,b)=>b.score-a.score);
    state.rows=rows;return rows;
  }
  const schemas={
    performance:[['학교명',r=>r.school.name],['지역',r=>r.school.region||'-'],['구분',r=>typeof normalizeSchoolType==='function'?normalizeSchoolType(r.school.type):r.school.type],['지원자',r=>r.applicants],['면접자',r=>r.interviews],['입사자',r=>r.hires],['재직자',r=>r.active],['퇴직자',r=>r.retired],['입사 전환율',r=>r.conversion+'%'],['평균 근속',r=>r.avgTenure==null?'-':Math.round(r.avgTenure)+'개월'],['최근 1년 입사',r=>r.recentHires]],
    contact:[['학교명',r=>r.school.name],['지역',r=>r.school.region||'-'],['최근 접촉일',r=>(r.activity?.date||r.lastContact||'-').slice(0,10)],['활동 유형',r=>r.activity?.type||'관리기록'],['내용',r=>r.activity?.note||r.school.lastRequestNote||'-'],['담당자',r=>state.privacy?'제외':r.contact||'-'],['연락처',r=>state.privacy?'제외':r.phone||'-']],
    request:[['학교명',r=>r.school.name],['요청일',r=>r.request.requestDate||'-'],['상태',r=>r.request.status||'-'],['대상 학과',r=>r.request.department||'-'],['근무지',r=>r.request.workplace||'-'],['요청 인원',r=>r.request.requestCount||0],['추천 인원',r=>r.request.recommendedCount||0],['메모',r=>r.request.note||'-']],
    pending:[['학교명',r=>r.school.name],['지역',r=>r.school.region||'-'],['요청일',r=>r.request?.requestDate||'-'],['상태',r=>r.request?.status||'미회신'],['요청 내용',r=>r.request?.note||r.school.lastRequestNote||'-'],['다음 연락일',r=>r.school.nextContactDate||'-'],['담당자',r=>state.privacy?'제외':r.contact||'-']],
    mou:[['학교명',r=>r.school.name],['지역',r=>r.school.region||'-'],['협약 상태',r=>r.mou.status||(r.school.mouDate?'체결':'-')],['협약 유형',r=>r.mou.type||'-'],['체결일',r=>r.mou.signedDate||r.school.mouDate||'-'],['만료일',r=>r.mou.expireDate||'-'],['담당 부서',r=>r.mou.department||'-'],['내부 담당자',r=>state.privacy?'제외':r.mou.owner||'-']],
    stale:[['학교명',r=>r.school.name],['지역',r=>r.school.region||'-'],['관리상태',r=>r.school.managementStatus||'미지정'],['최근 관리일',r=>(r.lastContact||'-').slice(0,10)],['미접촉 기간',r=>r.daysInactive==null?'이력 없음':r.daysInactive+'일'],['지원자',r=>r.apps.length],['재직자',r=>r.active],['담당자',r=>state.privacy?'제외':r.contact||'-']],
    core:[['순위',(_,i)=>i+1],['학교명',r=>r.school.name],['지역',r=>r.school.region||'-'],['지원자',r=>r.applicants],['입사자',r=>r.hires],['재직자',r=>r.active],['전환율',r=>r.conversion+'%'],['평균 근속',r=>r.avgTenure==null?'-':Math.round(r.avgTenure)+'개월'],['최근 1년 입사',r=>r.recentHires],['참고점수',r=>r.score],['판정',r=>r.grade]]
  };
  function schema(){return schemas[state.type]||schemas.performance;}
  function renderSummary(rows){const el=$r('schoolReportSummary');if(!el)return;let cards=[];if(state.type==='performance'||state.type==='core'){cards=[['학교',new Set(rows.map(r=>r.school.id)).size+'개교'],['지원자',rows.reduce((a,r)=>a+r.applicants,0)+'명'],['입사자',rows.reduce((a,r)=>a+r.hires,0)+'명'],['재직자',rows.reduce((a,r)=>a+r.active,0)+'명']];}else cards=[['조회 결과',rows.length+'건'],['대상 학교',new Set(rows.map(r=>r.school.id)).size+'개교'],['시작일',state.start||'전체'],['종료일',state.end||'전체']];el.innerHTML=cards.map(([a,b])=>`<div><span>${safe(a)}</span><strong>${safe(b)}</strong></div>`).join('');}
  function render(){state.type=$r('schoolReportType')?.value||state.type;state.start=$r('schoolReportStart')?.value||'';state.end=$r('schoolReportEnd')?.value||'';state.schoolType=$r('schoolReportSchoolType')?.value||'all';state.region=$r('schoolReportRegion')?.value||'all';state.search=$r('schoolReportSearch')?.value||'';state.privacy=!!$r('schoolReportPrivacy')?.checked;state.onlyWithData=!!$r('schoolReportOnlyWithData')?.checked;fillRegions();const rows=reportRows(),cols=schema();$r('schoolReportTitle').textContent=labels[state.type]+' 보고서';$r('schoolReportRange').textContent=state.start||state.end?`${state.start||'처음'} ~ ${state.end||'현재'}`:'전체 기간';$r('schoolReportCount').textContent=rows.length+(state.type==='request'?'건':'개');$r('schoolReportHead').innerHTML='<tr>'+cols.map(c=>`<th>${safe(c[0])}</th>`).join('')+'</tr>';$r('schoolReportBody').innerHTML=rows.length?rows.map((r,i)=>'<tr>'+cols.map(c=>`<td>${safe(c[1](r,i))}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${cols.length}" class="empty">조건에 맞는 보고서 데이터가 없습니다.</td></tr>`;renderSummary(rows);}
  function fillRegions(){const el=$r('schoolReportRegion');if(!el)return;const current=state.region;const rs=[...new Set((schools||[]).map(s=>String(s.region||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));el.innerHTML='<option value="all">전체</option>'+rs.map(x=>`<option value="${safe(x)}">${safe(x)}</option>`).join('');el.value=rs.includes(current)?current:'all';}
  function exportRows(){return [schema().map(c=>c[0]),...state.rows.map((r,i)=>schema().map(c=>c[1](r,i)))];}
  function csv(){const lines=exportRows().map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');downloadFile(`학교보고서_${state.type}_${new Date().toISOString().slice(0,10)}.csv`,'\ufeff'+lines,'text/csv;charset=utf-8');}
  function excel(){const rows=exportRows();const table='<table border="1">'+rows.map((r,i)=>'<tr>'+r.map(v=>`<${i?'td':'th'}>${safe(v)}</${i?'td':'th'}>`).join('')+'</tr>').join('')+'</table>';downloadFile(`학교보고서_${state.type}_${new Date().toISOString().slice(0,10)}.xls`,'\ufeff<html><head><meta charset="utf-8"></head><body>'+table+'</body></html>','application/vnd.ms-excel;charset=utf-8');}
  function downloadFile(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function printReport(){const cols=schema();const rows=state.rows;const area=$r('schoolReportPrintArea');area.innerHTML=`<div class="sr-print-head"><h1>${safe(labels[state.type])} 보고서</h1><p>기간: ${safe(state.start||'전체')} ~ ${safe(state.end||'전체')} · 출력일 ${new Date().toLocaleDateString('ko-KR')}</p><p>${state.privacy?'개인정보 제외':'담당자 정보 포함'}</p></div><table><thead><tr>${cols.map(c=>`<th>${safe(c[0])}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr>${cols.map(c=>`<td>${safe(c[1](r,i))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;window.print();}
  function reset(){const now=new Date(),start=new Date();start.setFullYear(now.getFullYear()-1);$r('schoolReportType').value='performance';$r('schoolReportStart').value=start.toISOString().slice(0,10);$r('schoolReportEnd').value=now.toISOString().slice(0,10);$r('schoolReportSchoolType').value='all';$r('schoolReportRegion').value='all';$r('schoolReportSearch').value='';$r('schoolReportPrivacy').checked=true;$r('schoolReportOnlyWithData').checked=false;render();}
  function init(){const now=new Date(),start=new Date();start.setFullYear(now.getFullYear()-1);if($r('schoolReportStart')&&!$r('schoolReportStart').value)$r('schoolReportStart').value=start.toISOString().slice(0,10);if($r('schoolReportEnd')&&!$r('schoolReportEnd').value)$r('schoolReportEnd').value=now.toISOString().slice(0,10);['schoolReportType','schoolReportStart','schoolReportEnd','schoolReportSchoolType','schoolReportRegion','schoolReportSearch','schoolReportPrivacy','schoolReportOnlyWithData'].forEach(id=>$r(id)?.addEventListener(id==='schoolReportSearch'?'input':'change',render));$r('btnSchoolReportRun')?.addEventListener('click',render);$r('btnSchoolReportReset')?.addEventListener('click',reset);$r('btnSchoolReportCsv')?.addEventListener('click',csv);$r('btnSchoolReportExcel')?.addEventListener('click',excel);$r('btnSchoolReportPrint')?.addEventListener('click',printReport);render();}
  window.renderSchoolReport=render;
  document.addEventListener('DOMContentLoaded',init);
})();
