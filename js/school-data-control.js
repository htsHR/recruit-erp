/* Recruit ERP v10.44.0 SCHOOL_DATA_CONTROL_PACK */
(function(){
  const state={category:'all',severity:'all',search:'',issues:[]};
  const $c=id=>document.getElementById(id);
  const norm=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,'').replace(/[()（）·ㆍ.,_-]/g,'');
  const schoolNameKey=v=>norm(v).replace(/전문대학교$/,'전문대').replace(/대학교$/,'대');
  const escSafe=v=>typeof esc==='function'?esc(v):String(v||'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const fmt=v=>v?String(v).slice(0,10):'-';
  const daysSince=v=>{if(!v)return null;const d=new Date(v);if(!Number.isFinite(d.getTime()))return null;return Math.floor((Date.now()-d.getTime())/86400000)};
  const appList=()=>typeof applicants!=='undefined'?applicants:[];
  const employeeList=()=>typeof employees!=='undefined'?employees:[];
  const schoolListNow=()=>typeof schools!=='undefined'?schools:[];
  const categoryLabels={duplicate:'중복 학교 후보',alias:'학교명·별칭 충돌',region:'지역 불일치',type:'학교 구분 불일치',unlinkedApplicant:'미연결 지원자',unlinkedEmployee:'미연결 사원',invalidApplicant:'잘못된 지원자 schoolId',invalidEmployee:'잘못된 사원 schoolId',missingContact:'담당자 누락',phone:'연락처 오류',stale:'장기 미사용 학교'};
  const severityLabels={critical:'긴급',warning:'주의',info:'확인'};
  function linkedCounts(id){return {applicants:appList().filter(x=>x.schoolId===id).length,employees:employeeList().filter(x=>x.schoolId===id).length};}
  function exactSchoolByText(text){
    const key=norm(text); if(!key)return null;
    const list=schoolListNow().filter(s=>norm(s.name)===key||(Array.isArray(s.aliases)&&s.aliases.some(a=>norm(a)===key)));
    return list.length===1?list[0]:null;
  }
  function add(out,issue){out.push({id:'sc_'+out.length+'_'+Date.now(),...issue});}
  function buildIssues(){
    const out=[]; const schoolList=schoolListNow(); const schoolIds=new Set(schoolList.map(s=>String(s.id)));
    const grouped=new Map();
    schoolList.forEach(s=>{const k=schoolNameKey(s.name);if(!k)return;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(s)});
    grouped.forEach(group=>{if(group.length<2)return;for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
      const a=group[i],b=group[j],ca=linkedCounts(a.id),cb=linkedCounts(b.id);
      add(out,{category:'duplicate',severity:'critical',target:`${a.name} ↔ ${b.name}`,detail:'정규화된 학교명이 동일합니다.',links:`지원자 ${ca.applicants+cb.applicants}명 · 사원 ${ca.employees+cb.employees}명`,recommend:'두 학교를 비교한 뒤 기준 학교 ID로 안전 통합',schoolId:a.id,otherSchoolId:b.id});
      if(String(a.region||'').trim()&&String(b.region||'').trim()&&a.region!==b.region)add(out,{category:'region',severity:'warning',target:`${a.name} ↔ ${b.name}`,detail:`동일·유사 학교명의 지역이 다릅니다: ${a.region} / ${b.region}`,links:`지원자 ${ca.applicants+cb.applicants}명 · 사원 ${ca.employees+cb.employees}명`,recommend:'캠퍼스 구분 또는 잘못된 지역 입력 여부 확인',schoolId:a.id,otherSchoolId:b.id});
      const ta=typeof normalizeSchoolType==='function'?normalizeSchoolType(a.type):a.type; const tb=typeof normalizeSchoolType==='function'?normalizeSchoolType(b.type):b.type;
      if(ta&&tb&&ta!==tb)add(out,{category:'type',severity:'warning',target:`${a.name} ↔ ${b.name}`,detail:`학교 구분이 다릅니다: ${ta} / ${tb}`,links:`지원자 ${ca.applicants+cb.applicants}명 · 사원 ${ca.employees+cb.employees}명`,recommend:'표준 학교 구분을 확인하고 잘못된 항목 수정',schoolId:a.id,otherSchoolId:b.id});
    }});
    const tokenMap=new Map();
    schoolList.forEach(s=>{
      [{kind:'학교명',value:s.name},...(Array.isArray(s.aliases)?s.aliases.map(value=>({kind:'별칭',value})):[])].forEach(t=>{const k=norm(t.value);if(!k)return;if(!tokenMap.has(k))tokenMap.set(k,[]);tokenMap.get(k).push({school:s,kind:t.kind,value:t.value})});
    });
    tokenMap.forEach(items=>{
      const ids=[...new Set(items.map(x=>x.school.id))]; if(ids.length<2)return;
      const names=[...new Set(items.map(x=>`${x.school.name}(${x.kind}: ${x.value})`))];
      add(out,{category:'alias',severity:'critical',target:names.join(' ↔ '),detail:'같은 학교명 또는 별칭이 서로 다른 학교에 등록되어 있습니다.',links:ids.map(id=>{const c=linkedCounts(id);return `${(schoolList.find(s=>s.id===id)||{}).name}: 지원 ${c.applicants} / 사원 ${c.employees}`}).join(' · '),recommend:'별칭 충돌을 해소한 뒤 연결 검토',schoolId:ids[0],otherSchoolId:ids[1]});
    });
    appList().forEach(a=>{
      const text=String(a.school||'').trim(); const sid=String(a.schoolId||'').trim();
      if(sid&&!schoolIds.has(sid)) add(out,{category:'invalidApplicant',severity:'critical',target:a.name||'이름 없음',detail:`존재하지 않는 schoolId 참조: ${sid}`,links:`입력 학교명: ${text||'-'}`,recommend:'잘못된 참조 해제 후 정확한 학교 재연결',entityType:'applicant',entityId:a.id,invalidSchoolId:sid});
      else if(!sid&&text){const match=exactSchoolByText(text);add(out,{category:'unlinkedApplicant',severity:match?'warning':'info',target:a.name||'이름 없음',detail:`학교명은 있으나 schoolId가 없습니다: ${text}`,links:match?`정확 일치 후보: ${match.name}`:'정확 일치 후보 없음',recommend:match?'확실한 학교 연결 기능으로 검토 후 연결':'학교 등록 또는 별칭 확인',entityType:'applicant',entityId:a.id,matchSchoolId:match?.id||''});}
    });
    employeeList().forEach(e=>{
      const text=String(e.school||'').trim(); const sid=String(e.schoolId||'').trim();
      if(sid&&!schoolIds.has(sid)) add(out,{category:'invalidEmployee',severity:'critical',target:e.name||'이름 없음',detail:`존재하지 않는 schoolId 참조: ${sid}`,links:`입력 학교명: ${text||'-'}`,recommend:'잘못된 참조 해제 후 정확한 학교 재연결',entityType:'employee',entityId:e.id,invalidSchoolId:sid});
      else if(!sid&&text){const match=exactSchoolByText(text);add(out,{category:'unlinkedEmployee',severity:match?'warning':'info',target:e.name||'이름 없음',detail:`학교명은 있으나 schoolId가 없습니다: ${text}`,links:match?`정확 일치 후보: ${match.name}`:'정확 일치 후보 없음',recommend:match?'확실한 학교 연결 기능으로 검토 후 연결':'학교 등록 또는 별칭 확인',entityType:'employee',entityId:e.id,matchSchoolId:match?.id||''});}
    });
    schoolList.forEach(s=>{
      const c=linkedCounts(s.id); const contactName=String(s.contact||'').trim()||(Array.isArray(s.contacts)&&s.contacts.some(x=>String(x?.name||'').trim()));
      if(!contactName)add(out,{category:'missingContact',severity:'warning',target:s.name,detail:'학교 담당자가 등록되지 않았습니다.',links:`지원자 ${c.applicants}명 · 사원 ${c.employees}명`,recommend:'학교 상세 또는 관계관리에서 주 담당자 등록',schoolId:s.id});
      const phones=[s.contactPhone,...(Array.isArray(s.contacts)?s.contacts.map(x=>x?.phone):[])].filter(Boolean);
      phones.forEach(phone=>{const digits=String(phone).replace(/\D/g,'');if(digits.length<9||digits.length>11)add(out,{category:'phone',severity:'warning',target:s.name,detail:`연락처 형식 확인 필요: ${phone}`,links:`담당자 ${s.contact||'미등록'}`,recommend:'전화번호를 9~11자리 숫자 기준으로 확인',schoolId:s.id});});
      const last=typeof schoolLastManagedDate==='function'?schoolLastManagedDate(s):(s.updatedAt||s.createdAt||''); const age=daysSince(last);
      if(c.applicants===0&&c.employees===0&&(age===null||age>=365))add(out,{category:'stale',severity:'info',target:s.name,detail:age===null?'관리 이력과 연결 데이터가 없습니다.':`최근 관리 후 ${age}일 경과했고 연결 데이터가 없습니다.`,links:'지원자 0명 · 사원 0명',recommend:'실제 사용 여부 확인 후 유지·정리 판단',schoolId:s.id});
    });
    return out;
  }
  function filtered(){const q=state.search.toLowerCase();return state.issues.filter(x=>(state.category==='all'||x.category===state.category)&&(state.severity==='all'||x.severity===state.severity)&&(!q||[x.target,x.detail,x.links,x.recommend,categoryLabels[x.category]].join(' ').toLowerCase().includes(q)));}
  function actionHtml(i){
    if(i.category==='duplicate'||i.category==='region'||i.category==='type'||i.category==='alias')return `<button class="mini" data-sc-action="merge" data-id="${i.id}">병합 비교</button>`;
    if(i.category==='invalidApplicant'||i.category==='invalidEmployee')return `<button class="danger mini" data-sc-action="clear-invalid" data-id="${i.id}">잘못된 참조 해제</button>`;
    if(i.category==='unlinkedApplicant'||i.category==='unlinkedEmployee')return `<button class="mini" data-sc-action="link" data-id="${i.id}">연결 검토</button>`;
    if(i.schoolId)return `<button class="mini" data-sc-action="detail" data-id="${i.id}">학교 상세</button>`;
    return '-';
  }
  function render(){
    state.issues=buildIssues(); const rows=filtered();
    const cats={};state.issues.forEach(x=>cats[x.category]=(cats[x.category]||0)+1);
    const kpi=$c('schoolControlKpis');if(kpi)kpi.innerHTML=[['critical','긴급',state.issues.filter(x=>x.severity==='critical').length],['warning','주의',state.issues.filter(x=>x.severity==='warning').length],['info','확인',state.issues.filter(x=>x.severity==='info').length],['all','전체 문제',state.issues.length]].map(([cls,label,n])=>`<button type="button" class="school-control-kpi ${cls}" data-sc-severity="${cls==='all'?'all':cls}"><span>${label}</span><strong>${n}</strong><small>클릭하여 필터</small></button>`).join('');
    const category=$c('schoolControlCategory');if(category){const current=state.category;category.innerHTML='<option value="all">전체 유형</option>'+Object.entries(categoryLabels).map(([k,v])=>`<option value="${k}">${v} (${cats[k]||0})</option>`).join('');category.value=current;}
    const summary=$c('schoolControlSummary');if(summary)summary.innerHTML=Object.entries(cats).filter(([,n])=>n).map(([k,n])=>`<button type="button" data-sc-category="${k}"><span>${categoryLabels[k]}</span><strong>${n}</strong></button>`).join('');
    if($c('schoolControlCount'))$c('schoolControlCount').textContent=`${rows.length}건 / 전체 ${state.issues.length}건`;
    const body=$c('schoolControlBody');if(body)body.innerHTML=rows.length?rows.map(i=>`<tr><td><span class="school-control-severity ${i.severity}">${severityLabels[i.severity]}</span></td><td>${escSafe(categoryLabels[i.category])}</td><td><strong>${escSafe(i.target)}</strong></td><td>${escSafe(i.detail)}</td><td>${escSafe(i.links||'-')}</td><td>${escSafe(i.recommend||'-')}</td><td class="row-actions">${actionHtml(i)}</td></tr>`).join(''):'<tr><td colspan="7" class="empty"><strong>조건에 맞는 문제가 없습니다.</strong><span>현재 필터 기준으로 점검 항목이 발견되지 않았습니다.</span></td></tr>';
  }
  function safetyBackup(reason){
    if(window.erpBackupCenter&&typeof window.erpBackupCenter.safetyBackup==='function')return window.erpBackupCenter.safetyBackup(reason);
    const payload={format:'recruit-erp-full-safety-backup',appVersion:'10.44.0',createdAt:new Date().toISOString(),reason,applicants:appList(),schools:schoolListNow(),employees:employeeList(),calendarEvents:typeof calendarEvents!=='undefined'?calendarEvents:[]};
    if(typeof download==='function')download(`Recruit_ERP_학교데이터변경전_안전백업_${typeof today==='function'?today():new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),'application/json;charset=utf-8');
    return payload;
  }
  function clearInvalid(issue){
    if(!issue||!confirm(`${issue.target}의 잘못된 schoolId 참조를 해제할까요?\n\n변경 전 전체 ERP 안전백업이 자동 생성됩니다.`))return;
    safetyBackup('학교 데이터 관리 - 잘못된 schoolId 참조 해제');
    if(issue.entityType==='applicant')applicants=applicants.map(x=>x.id===issue.entityId?{...x,schoolId:''}:x);
    else employees=employees.map(x=>x.id===issue.entityId?{...x,schoolId:''}:x);
    localStorage.setItem(issue.entityType==='applicant'?STORAGE_KEY:EMPLOYEES_KEY,JSON.stringify(issue.entityType==='applicant'?applicants:employees));
    if(issue.entityType==='applicant'&&typeof save==='function')save(); else if(issue.entityType==='employee'&&typeof saveEmployees==='function')saveEmployees(employees);
    render(); if(typeof uxToast==='function')uxToast('잘못된 학교 참조를 해제했습니다.');
  }
  function exportCsv(){
    const rows=filtered();const headers=['심각도','점검 유형','대상','문제 내용','연결 현황','권장 조치'];const csv=[headers,...rows.map(i=>[severityLabels[i.severity],categoryLabels[i.category],i.target,i.detail,i.links||'',i.recommend||''])].map(r=>r.map(v=>'"'+String(v||'').replace(/"/g,'""')+'"').join(',')).join('\r\n');
    if(typeof download==='function')download(`학교_데이터점검_${new Date().toISOString().slice(0,10)}.csv`, '\ufeff'+csv,'text/csv;charset=utf-8');
  }
  function onClick(e){
    const sev=e.target.closest('[data-sc-severity]');if(sev){state.severity=sev.dataset.scSeverity;if($c('schoolControlSeverity'))$c('schoolControlSeverity').value=state.severity;render();return;}
    const cat=e.target.closest('[data-sc-category]');if(cat){state.category=cat.dataset.scCategory;if($c('schoolControlCategory'))$c('schoolControlCategory').value=state.category;render();return;}
    const btn=e.target.closest('[data-sc-action]');if(!btn)return;const issue=state.issues.find(x=>x.id===btn.dataset.id);if(!issue)return;
    if(btn.dataset.scAction==='merge'){if(typeof openSchoolMergeManager==='function')openSchoolMergeManager(issue.schoolId||'',issue.otherSchoolId||'');}
    else if(btn.dataset.scAction==='clear-invalid')clearInvalid(issue);
    else if(btn.dataset.scAction==='link'){if(typeof openSchoolAutoLink==='function')openSchoolAutoLink();}
    else if(btn.dataset.scAction==='detail'){if(typeof openSchoolDetail==='function')openSchoolDetail(issue.schoolId);}
  }
  function init(){
    $c('schoolControlCategory')?.addEventListener('change',e=>{state.category=e.target.value;render()});
    $c('schoolControlSeverity')?.addEventListener('change',e=>{state.severity=e.target.value;render()});
    $c('schoolControlSearch')?.addEventListener('input',e=>{state.search=e.target.value;render()});
    $c('btnSchoolControlRefresh')?.addEventListener('click',render);
    $c('btnSchoolControlExport')?.addEventListener('click',exportCsv);
    $c('schoolControlView')?.addEventListener('click',onClick);
  }
  window.renderSchoolDataControl=render;
  document.addEventListener('DOMContentLoaded',init);
})();
