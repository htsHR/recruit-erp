/* Recruit ERP v10.41.2 SCHOOL_MANAGEMENT_UI_UNIFICATION */
(function(){
  let coreSchoolId='';
  let coreTab='activity';
  const nowIso=()=>new Date().toISOString();
  const safe=(v)=>typeof esc==='function'?esc(v):String(v||'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  function current(){return schools.find(s=>s.id===coreSchoolId)||null;}
  function ensure(s){s.memoHistory=Array.isArray(s.memoHistory)?s.memoHistory:[];s.contacts=Array.isArray(s.contacts)?s.contacts:[];s.activities=Array.isArray(s.activities)?s.activities:[];return s;}
  function latestActivity(s){return [...ensure(s).activities].sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')))[0]||null;}
  function primaryContact(s){const list=ensure(s).contacts;return list.find(c=>c.primary)||list[0]||{name:s.contact||'',phone:s.contactPhone||'',department:'',email:''};}
  function contactCards(list){
    return list.length?list.map(c=>`<article class="school-core-item-card"><div><strong>${safe(c.name||'이름 미등록')}${c.primary?' <em>주 담당자</em>':''}</strong><span>${safe(c.department||'부서 미등록')}</span><small>${safe([c.phone,c.email].filter(Boolean).join(' · ')||'연락처 미등록')}</small></div><button class="ghost danger-soft" onclick="removeSchoolCoreItem('contacts','${c.id}')">삭제</button></article>`).join(''):'<div class="school-core-empty">등록된 담당자가 없습니다.</div>';
  }
  function activityCards(list){
    return list.length?list.map(a=>`<article class="school-core-timeline-item"><div class="school-core-timeline-date"><strong>${safe((a.date||a.createdAt||'').slice(0,10))}</strong><span>${safe(a.type||'활동')}</span></div><div class="school-core-timeline-content"><p>${safe(a.note||'-')}</p>${a.nextDate?`<small>다음 연락 예정 ${safe(a.nextDate)}</small>`:''}</div><button class="ghost danger-soft" onclick="removeSchoolCoreItem('activities','${a.id}')">삭제</button></article>`).join(''):'<div class="school-core-empty">등록된 활동 이력이 없습니다.</div>';
  }
  function memoCards(list){
    return list.length?list.map(m=>`<article class="school-core-item-card ${m.important?'important':''}"><div><strong>${m.important?'중요 메모':'메모'}</strong><span>${safe((m.createdAt||'').slice(0,16).replace('T',' '))}</span><small>${safe(m.text||'-')}</small></div><button class="ghost danger-soft" onclick="removeSchoolCoreItem('memoHistory','${m.id}')">삭제</button></article>`).join(''):'<div class="school-core-empty">등록된 메모가 없습니다.</div>';
  }
  function renderTab(s,contacts,activities,memo){
    if(coreTab==='contact') return `<div class="school-core-entry-card"><div class="school-core-entry-title"><div><span>CONTACT</span><h4>담당자 추가</h4></div><p>주 담당자를 지정하면 학교 목록과 상세 화면에 우선 표시됩니다.</p></div><div class="school-core-form contacts"><input id="scContactName" placeholder="담당자명"><input id="scContactDept" placeholder="부서·학과"><input id="scContactPhone" placeholder="연락처"><input id="scContactEmail" placeholder="이메일"><label><input id="scContactPrimary" type="checkbox"> 주 담당자</label><button class="primary" onclick="addSchoolCoreContact()">담당자 추가</button></div></div><div class="school-core-content-list">${contactCards(contacts)}</div>`;
    if(coreTab==='memo') return `<div class="school-core-entry-card"><div class="school-core-entry-title"><div><span>MEMO</span><h4>메모 추가</h4></div><p>기존 메모를 덮어쓰지 않고 시간순으로 누적합니다.</p></div><div class="school-core-form memo"><input id="scMemoText" placeholder="메모 내용을 입력하세요"><label><input id="scMemoImportant" type="checkbox"> 중요 메모</label><button class="primary" onclick="addSchoolCoreMemo()">메모 추가</button></div></div><div class="school-core-content-list">${memoCards(memo)}</div>`;
    return `<div class="school-core-entry-card"><div class="school-core-entry-title"><div><span>ACTIVITY</span><h4>활동 기록</h4></div><p>전화·이메일·방문·추천 요청과 다음 연락일을 함께 기록합니다.</p></div><div class="school-core-form activity"><input id="scActivityDate" type="date" value="${new Date().toISOString().slice(0,10)}"><select id="scActivityType"><option>전화</option><option>이메일</option><option>방문</option><option>추천 요청</option><option>설명회</option><option>협약</option><option>기타</option></select><input id="scActivityNote" placeholder="활동 내용"><input id="scActivityNext" type="date" title="다음 연락 예정일"><button class="primary" onclick="addSchoolCoreActivity()">활동 기록</button></div></div><div class="school-core-timeline">${activityCards(activities)}</div>`;
  }
  window.openSchoolManagementCore=function(id){coreSchoolId=id;coreTab='activity';renderCore();const modal=document.getElementById('schoolCoreModal');modal?.classList.add('show');modal?.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');};
  window.closeSchoolManagementCore=function(){const modal=document.getElementById('schoolCoreModal');modal?.classList.remove('show');modal?.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');coreSchoolId='';};
  window.setSchoolCoreTab=function(tab){coreTab=tab||'activity';renderCore();};
  function renderCore(){
    const s=current(); if(!s)return; ensure(s);
    const body=document.getElementById('schoolCoreBody');if(!body)return;
    document.getElementById('schoolCoreTitle').textContent=s.name+' · 관계관리';
    const memo=[...s.memoHistory].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    const contacts=[...s.contacts].sort((a,b)=>(b.primary?1:0)-(a.primary?1:0));
    const activities=[...s.activities].sort((a,b)=>String(b.date||b.createdAt||'').localeCompare(String(a.date||a.createdAt||'')));
    const pc=primaryContact(s),la=latestActivity(s);
    body.innerHTML=`
      <section class="school-core-overview">
        <div class="school-core-school-identity"><span class="school-core-label">RELATIONSHIP SUMMARY</span><h4>${safe(s.name)}</h4><p>${safe([s.region,typeof schoolTypeGroupDetail==='function'?schoolTypeGroupDetail(s.type):s.type,typeof schoolManagementStatusLabel==='function'?schoolManagementStatusLabel(s.managementStatus):s.managementStatus].filter(Boolean).join(' · ')||'학교 기본정보')}</p></div>
        <div class="school-core-overview-actions"><button class="ghost" onclick="closeSchoolManagementCore();openSchoolDetail('${s.id}')">학교 상세</button><button class="ghost" onclick="closeSchoolManagementCore();editSchoolPrompt('${s.id}')">기본정보 수정</button></div>
      </section>
      <div class="school-core-kpis school-core-kpis-v10412">
        <div><span>주 담당자</span><strong>${safe(pc.name||'미등록')}</strong><small>${safe(pc.phone||pc.department||'연락처 없음')}</small></div>
        <div><span>활동 이력</span><strong>${activities.length}건</strong><small>${la?safe((la.date||la.createdAt||'').slice(0,10)):'최근 활동 없음'}</small></div>
        <div><span>메모</span><strong>${memo.length}건</strong><small>중요 ${memo.filter(x=>x.important).length}건</small></div>
        <div><span>다음 연락</span><strong>${safe(s.nextContactDate||'-')}</strong><small>${s.nextContactDate?'예정일 등록':'예정일 미등록'}</small></div>
      </div>
      <div class="school-core-workspace">
        <div class="school-core-tabs">
          <button type="button" class="${coreTab==='activity'?'active':''}" onclick="setSchoolCoreTab('activity')">활동 이력 <span>${activities.length}</span></button>
          <button type="button" class="${coreTab==='memo'?'active':''}" onclick="setSchoolCoreTab('memo')">메모 <span>${memo.length}</span></button>
          <button type="button" class="${coreTab==='contact'?'active':''}" onclick="setSchoolCoreTab('contact')">담당자 <span>${contacts.length}</span></button>
        </div>
        <div class="school-core-tab-content">${renderTab(s,contacts,activities,memo)}</div>
      </div>`;
  }
  window.addSchoolCoreContact=function(){const s=current();if(!s)return;ensure(s);const name=document.getElementById('scContactName')?.value.trim();if(!name){alert('담당자명을 입력해주세요.');return;}const primary=document.getElementById('scContactPrimary')?.checked;if(primary)s.contacts.forEach(c=>c.primary=false);s.contacts.unshift({id:uid(),name,department:document.getElementById('scContactDept')?.value.trim()||'',phone:document.getElementById('scContactPhone')?.value.trim()||'',email:document.getElementById('scContactEmail')?.value.trim()||'',primary,createdAt:nowIso()});if(primary||!s.contact){s.contact=name;s.contactPhone=document.getElementById('scContactPhone')?.value.trim()||'';}s.updatedAt=nowIso();saveSchools();renderCore();};
  window.addSchoolCoreActivity=function(){const s=current();if(!s)return;ensure(s);const note=document.getElementById('scActivityNote')?.value.trim();if(!note){alert('활동 내용을 입력해주세요.');return;}const date=document.getElementById('scActivityDate')?.value||new Date().toISOString().slice(0,10);const nextDate=document.getElementById('scActivityNext')?.value||'';s.activities.unshift({id:uid(),date,type:document.getElementById('scActivityType')?.value||'기타',note,nextDate,createdAt:nowIso()});s.lastContactDate=date;if(nextDate)s.nextContactDate=nextDate;if(String(document.getElementById('scActivityType')?.value||'').includes('추천'))s.lastRequestNote=note;s.updatedAt=nowIso();saveSchools();renderCore();};
  window.addSchoolCoreMemo=function(){const s=current();if(!s)return;ensure(s);const text=document.getElementById('scMemoText')?.value.trim();if(!text){alert('메모 내용을 입력해주세요.');return;}s.memoHistory.unshift({id:uid(),text,important:!!document.getElementById('scMemoImportant')?.checked,createdAt:nowIso()});s.updatedAt=nowIso();saveSchools();renderCore();};
  window.removeSchoolCoreItem=function(key,id){const s=current();if(!s||!confirm('이 항목을 삭제할까요?'))return;ensure(s);s[key]=s[key].filter(x=>x.id!==id);s.updatedAt=nowIso();saveSchools();renderCore();};
  const original=window.renderSchoolDetail;
  if(typeof original==='function')window.renderSchoolDetail=function(){original();const s=schools.find(x=>x.id===schoolDetailCurrentId);const body=document.getElementById('schoolDetailBody');if(!s||!body)return;ensure(s);const la=latestActivity(s);body.insertAdjacentHTML('beforeend',`<section class="summary-card school-detail-section school-core-summary school-core-summary-v10412"><div class="school-detail-section-head"><div><span class="school-section-kicker">RELATIONSHIP</span><h4>관계관리 현황</h4><p>담당자·활동·메모 이력을 한 곳에서 관리합니다.</p></div><button class="primary" onclick="openSchoolManagementCore('${s.id}')">관계관리 열기</button></div><div class="school-core-summary-grid"><div><span>담당자</span><strong>${s.contacts.length}명</strong><small>주 담당자 ${safe(primaryContact(s).name||'미등록')}</small></div><div><span>활동이력</span><strong>${s.activities.length}건</strong><small>${safe(la?(la.type||'활동'):'최근 활동 없음')}</small></div><div><span>메모</span><strong>${s.memoHistory.length}건</strong><small>중요 ${s.memoHistory.filter(x=>x.important).length}건</small></div><div><span>최근활동</span><strong>${safe(la?(la.date||la.createdAt||'').slice(0,10):'-')}</strong><small>다음 연락 ${safe(s.nextContactDate||'-')}</small></div></div></section>`);};
})();
