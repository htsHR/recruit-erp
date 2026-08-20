/* Recruit ERP v12.0.0 — UX reboot phase 1 (desktop greeting hybrid) */
(function(root){
  'use strict';

  const MANAGER_KEY='recruit_erp_applicant_manager_assignments';
  const NAV_GROUPS=[
    {key:'today',label:'오늘',pages:['home','today']},
    {key:'applicants',label:'지원자',pages:['applicants','form','advancedSearch']},
    {key:'schedule',label:'일정·연락',pages:['calendar','templates']},
    {key:'hr',label:'입사·직원',pages:['onboarding','employees']},
    {key:'schools',label:'학교·채용채널',pages:['schools']},
    {key:'system',label:'분석·관리',pages:['stats','dataHealth','duplicates','backup','permissions','auditHistory','storagePerformance','productionReadiness']}
  ];
  const PAGE_ROUTES={
    home:'#/today',today:'#/today/tasks',applicants:'#/applicants',form:'#/applicants/new',advancedSearch:'#/applicants/search',
    calendar:'#/calendar',templates:'#/contact/templates',onboarding:'#/hire/onboarding',employees:'#/employees',schools:'#/schools',stats:'#/analytics',
    dataHealth:'#/admin/data-health',duplicates:'#/admin/duplicates',backup:'#/admin/backup',permissions:'#/admin/permissions',auditHistory:'#/admin/audit',
    storagePerformance:'#/admin/storage',productionReadiness:'#/admin/readiness'
  };
  const ROUTE_PAGES=Object.fromEntries(Object.entries(PAGE_ROUTES).map(([page,route])=>[route,page]));
  const routing={index:0,suppress:false,reverting:false,initialized:false,currentPage:'home'};
  const menuPreview={openTimer:0,closeTimer:0};
  const PAGE_LABELS={
    home:'업무 홈',today:'처리 목록',applicants:'지원자 목록',form:'지원자 등록',advancedSearch:'상세 검색',
    calendar:'일정 관리',templates:'안내문',onboarding:'입사대기',employees:'사원명부',schools:'학교 관리',stats:'채용 통계',
    dataHealth:'데이터 점검',duplicates:'중복 관리',backup:'백업·복원',permissions:'사용자 권한',auditHistory:'변경 이력',
    storagePerformance:'저장소·속도',productionReadiness:'운영 준비'
  };

  const $=id=>root.document.getElementById(id);
  const rows=()=>typeof applicants!=='undefined'&&Array.isArray(applicants)?applicants:[];
  const text=value=>String(value??'').trim();
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const currentDate=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  function isDesktopShell(){
    const viewportWidth=Math.max(0,Number(root.innerWidth)||0);
    const pixelRatio=Math.max(1,Number(root.devicePixelRatio)||1);
    return viewportWidth>=1280||(viewportWidth>=1000&&viewportWidth*pixelRatio>=1279);
  }
  function syncDesktopShell(){
    root.document.body.classList.toggle('ux12-desktop-shell',isDesktopShell());
  }

  function managerAssignments(){
    try{
      const parsed=JSON.parse(root.localStorage.getItem(MANAGER_KEY)||'{}');
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch{return {};}
  }
  function postingOf(applicant){
    return text(applicant?.jobPosting||applicant?.jobTitle||applicant?.recruitmentTitle||applicant?.postingName||applicant?.positionApplied);
  }
  function managerOf(applicant,map=managerAssignments()){
    return text(applicant?.manager||map[String(applicant?.id)]||map[applicant?.id]);
  }
  function nextActionOf(applicant){
    const status=text(applicant?.status);
    if(applicant?.nextContactDate)return {label:'연락 예정',detail:text(applicant.nextContactDate)};
    if(['면접예정','다음면접'].includes(status))return {label:'면접 준비',detail:text(applicant.interviewDate)||'일정 확인'};
    if(status==='면접완료')return {label:'결과 입력',detail:'판정 확인'};
    if(status==='입사예정')return {label:'입사 확인',detail:text(applicant.hireDate)||'일정 확인'};
    if(status==='부재중')return {label:'재연락',detail:'연락일 지정'};
    if(status==='서류검토')return {label:'서류 검토',detail:'검토 진행'};
    return {label:'진행 확인',detail:status||'상태 미입력'};
  }
  function scheduleOf(applicant){
    if(applicant?.interviewDate)return {label:'면접',value:[applicant.interviewDate,applicant.interviewTime].filter(Boolean).join(' ')};
    if(applicant?.hireDate)return {label:'입사',value:text(applicant.hireDate)};
    if(applicant?.nextContactDate)return {label:'연락',value:text(applicant.nextContactDate)};
    return {label:'일정',value:'미정'};
  }

  function buildNavigation(){
    const nav=root.document.querySelector('.sidebar .nav');
    if(!nav||nav.dataset.ux12Ready==='true')return;
    const buttons=new Map([...nav.querySelectorAll('.nav-btn[data-page]')].map(button=>[button.dataset.page,button]));
    nav.replaceChildren();
    NAV_GROUPS.forEach(groupDefinition=>{
      const group=root.document.createElement('section');
      group.className='nav-group ux12-nav-group';group.dataset.navgroup=groupDefinition.key;
      const heading=root.document.createElement('button');
      heading.type='button';heading.className='nav-group-label ux12-nav-group-label';heading.setAttribute('aria-expanded','true');
      heading.innerHTML=`<span>${escapeHtml(groupDefinition.label)}</span><span aria-hidden="true">⌄</span>`;
      const list=root.document.createElement('div');list.className='nav-group-items';
      groupDefinition.pages.forEach(page=>{
        const button=buttons.get(page);if(!button)return;
        const label=PAGE_LABELS[page]||text(button.textContent);button.title=label;button.setAttribute('aria-label',label);
        list.appendChild(button);buttons.delete(page);
      });
      heading.addEventListener('click',()=>{const collapsed=group.classList.toggle('collapsed');heading.setAttribute('aria-expanded',String(!collapsed));});
      group.append(heading,list);nav.appendChild(group);
    });
    if(buttons.size){
      const fallback=nav.querySelector('[data-navgroup="system"] .nav-group-items');
      buttons.forEach((button,page)=>{const label=PAGE_LABELS[page]||text(button.textContent);button.title=label;button.setAttribute('aria-label',label);fallback?.appendChild(button);});
    }
    nav.dataset.ux12Ready='true';updateActiveNavigation();
  }
  function updateActiveNavigation(){
    root.document.querySelectorAll('.ux12-nav-group').forEach(group=>group.classList.toggle('has-active',Boolean(group.querySelector('.nav-btn.active'))));
  }

  function iconButton(id,label,path){
    const button=root.document.createElement('button');button.id=id;button.type='button';button.className='ux12-top-icon';button.setAttribute('aria-label',label);button.title=label;
    button.innerHTML=`<svg aria-hidden="true" viewBox="0 0 24 24"><path d="${path}"></path></svg>`;return button;
  }
  function buildShell(){
    const main=root.document.querySelector('main.main'),topbar=root.document.querySelector('.topbar'),sidebar=root.document.querySelector('.sidebar');
    if(!main||!topbar||!sidebar||topbar.dataset.ux12Ready==='true')return;
    const titleWrap=topbar.querySelector('.topbar-title-wrap'),actionShell=topbar.querySelector('.topbar-actions-shell'),sidebarToggle=$('sidebarToggle');
    const standardActions=actionShell?.querySelector('.top-actions:not(.form-top-actions)'),formActions=actionShell?.querySelector('.form-top-actions');
    const utilities=actionShell?.querySelector('.topbar-utils');
    const duplicateRegister=standardActions?.querySelector('[data-go="form"]');duplicateRegister?.remove();
    const quickRegister=$('btnQuickApplicantEntry');if(quickRegister)quickRegister.textContent='지원자 등록';

    const context=root.document.createElement('section');context.className='ux12-page-context';context.setAttribute('aria-label','현재 화면');
    const contextActions=root.document.createElement('div');contextActions.className='ux12-page-actions';
    if(titleWrap)context.appendChild(titleWrap);if(standardActions)contextActions.appendChild(standardActions);if(formActions)contextActions.appendChild(formActions);
    context.appendChild(contextActions);main.insertBefore(context,main.querySelector('.page'));

    const left=root.document.createElement('div');left.className='ux12-top-search';
    left.innerHTML='<label class="ux12-global-search"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z"></path></svg><span class="sr-only">전체 검색</span><input id="globalSearchInput" type="search" autocomplete="off" placeholder="지원자·공고·담당자 검색" aria-controls="globalSearchResults" aria-expanded="false"></label><div class="ux12-global-search-results" id="globalSearchResults" role="listbox" hidden></div>';
    const right=root.document.createElement('div');right.className='ux12-top-actions';
    const notice=iconButton('ux12Notifications','오늘 처리 목록','M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4');
    const help=iconButton('ux12Help','도움말','M9.2 9a3 3 0 1 1 4.8 2.4c-1.2.8-2 1.2-2 2.6M12 18h.01');
    const settings=iconButton('ux12Settings','설정','M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.57V20h-3v-.09a1.7 1.7 0 0 0-1.04-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 14.68a1.7 1.7 0 0 0-1.57-1.04H5.3v-3h.09A1.7 1.7 0 0 0 6.96 9.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.62 6a1.7 1.7 0 0 0 1.04-1.57V4.3h3v.09A1.7 1.7 0 0 0 15.7 5.96a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.57 1.04H21v3h-.09A1.7 1.7 0 0 0 19.4 15Z');
    settings.dataset.requiredPermission='storage.manage';
    notice.addEventListener('click',()=>root.setPage?.('today'));settings.addEventListener('click',()=>root.setPage?.('storagePerformance'));
    const syncSettings=()=>{settings.hidden=Boolean(root.erpPermissions&&!root.erpPermissions.has('storage.manage'));};syncSettings();root.document.addEventListener('erp:permission-change',syncSettings);
    const helpPanel=root.document.createElement('div');helpPanel.id='ux12HelpPanel';helpPanel.className='ux12-help-panel';helpPanel.hidden=true;helpPanel.innerHTML='<strong>빠른 사용 안내</strong><p>왼쪽 메뉴에서 업무를 선택하고, 지원자 행을 누르면 빠른 보기가 열립니다.</p><button type="button" class="ghost" id="ux12HelpClose">닫기</button>';
    help.setAttribute('aria-controls','ux12HelpPanel');help.setAttribute('aria-expanded','false');
    help.addEventListener('click',()=>{helpPanel.hidden=!helpPanel.hidden;help.setAttribute('aria-expanded',String(!helpPanel.hidden));if(!helpPanel.hidden)$('ux12HelpClose')?.focus();});
    helpPanel.querySelector('#ux12HelpClose')?.addEventListener('click',()=>{helpPanel.hidden=true;help.setAttribute('aria-expanded','false');help.focus();});
    const user=utilities?.querySelector('#topbarUser');user?.querySelector('#topbarUserMark')?.remove();if(user){user.classList.add('ux12-account');user.setAttribute('aria-label','현재 계정');}
    if(utilities)right.appendChild(utilities);right.append(notice,help,settings,helpPanel);
    topbar.replaceChildren(left,right);topbar.dataset.ux12Ready='true';

    const toggle=sidebarToggle;if(toggle){
      toggle.setAttribute('aria-controls','appSidebar');toggle.setAttribute('aria-expanded','true');
      if(isDesktopShell()){const footer=root.document.createElement('div');footer.className='ux12-sidebar-footer';toggle.classList.add('ux12-pin-button');toggle.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M15 4v5l2 3H7l2-3V4M12 12v8"></path></svg><span class="ux12-collapse-label">메뉴 접기</span>';toggle.setAttribute('aria-pressed','true');footer.appendChild(toggle);sidebar.appendChild(footer);}
      else{toggle.classList.add('ux12-mobile-menu-toggle');left.insertBefore(toggle,left.firstChild);}
      toggle.addEventListener('click',()=>root.requestAnimationFrame(()=>{root.document.body.classList.remove('sidebar-preview-expanded');updateCollapseButton();}));
    }
    sidebar.id='appSidebar';
    bindGlobalSearch();bindSidebarPreview(sidebar);updateCollapseButton();
  }
  function updateCollapseButton(){
    const toggle=$('sidebarToggle'),collapsed=root.document.body.classList.contains('sidebar-collapsed');if(!toggle)return;
    toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-pressed',String(!collapsed));toggle.title=collapsed?'메뉴 확장 상태 고정':'메뉴 고정 해제·접기';const label=toggle.querySelector('.ux12-collapse-label');if(label)label.textContent=collapsed?'메뉴 고정':'메뉴 접기';
  }
  function bindSidebarPreview(sidebar){
    const clearTimers=()=>{root.clearTimeout(menuPreview.openTimer);root.clearTimeout(menuPreview.closeTimer);};
    const scheduleOpen=()=>{
      root.clearTimeout(menuPreview.closeTimer);if(!root.document.body.classList.contains('sidebar-collapsed'))return;
      root.clearTimeout(menuPreview.openTimer);menuPreview.openTimer=root.setTimeout(()=>{if(root.document.body.classList.contains('sidebar-collapsed'))root.document.body.classList.add('sidebar-preview-expanded');},150);
    };
    const scheduleClose=()=>{
      root.clearTimeout(menuPreview.openTimer);root.clearTimeout(menuPreview.closeTimer);menuPreview.closeTimer=root.setTimeout(()=>{
        const pointerInside=sidebar.matches(':hover'),focusInside=sidebar.contains(root.document.activeElement);
        if(!pointerInside&&!focusInside)root.document.body.classList.remove('sidebar-preview-expanded');
      },500);
    };
    sidebar.addEventListener('mouseenter',scheduleOpen);sidebar.addEventListener('mouseleave',scheduleClose);
    sidebar.addEventListener('focusin',scheduleOpen);sidebar.addEventListener('focusout',scheduleClose);
    sidebar.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.document.body.classList.contains('sidebar-preview-expanded')){event.preventDefault();clearTimers();root.document.body.classList.remove('sidebar-preview-expanded');$('sidebarToggle')?.focus();}});
  }

  function searchMatches(query){
    const needle=query.toLocaleLowerCase('ko'),map=managerAssignments();
    return rows().map(applicant=>({applicant,manager:managerOf(applicant,map),posting:postingOf(applicant)})).filter(item=>[
      item.applicant.name,item.applicant.phone,item.applicant.school,item.applicant.status,item.applicant.source,item.manager,item.posting
    ].some(value=>text(value).toLocaleLowerCase('ko').includes(needle))).slice(0,8);
  }
  function bindGlobalSearch(){
    const input=$('globalSearchInput'),host=$('globalSearchResults');if(!input||!host)return;
    const close=()=>{host.hidden=true;host.replaceChildren();input.setAttribute('aria-expanded','false');};
    const openApplicant=id=>{close();input.value='';root.openApplicantQuickDetailFromWorkflow?.(id,input);};
    input.addEventListener('input',()=>{
      const query=text(input.value);if(!query){close();return;}
      const matches=searchMatches(query);host.innerHTML=matches.length?matches.map(({applicant,manager,posting})=>`<button type="button" role="option" data-applicant-id="${escapeHtml(applicant.id)}"><strong>${escapeHtml(applicant.name||'이름 미입력')}</strong><span>${escapeHtml([posting||applicant.status||'상태 미입력',manager&&`담당 ${manager}`].filter(Boolean).join(' · '))}</span></button>`).join(''):'<p>일치하는 지원자가 없습니다.</p>';
      host.hidden=false;input.setAttribute('aria-expanded','true');
    });
    input.addEventListener('keydown',event=>{if(event.key==='Escape'){close();return;}if(event.key==='ArrowDown'){event.preventDefault();host.querySelector('button')?.focus();}if(event.key==='Enter'){const first=host.querySelector('button');if(first){event.preventDefault();openApplicant(first.dataset.applicantId);}}});
    host.addEventListener('click',event=>{const button=event.target.closest('button[data-applicant-id]');if(button)openApplicant(button.dataset.applicantId);});
    host.addEventListener('keydown',event=>{const current=event.target.closest('button');if(!current)return;if(event.key==='Escape'){close();input.focus();}if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();const buttons=[...host.querySelectorAll('button')],index=buttons.indexOf(current),offset=event.key==='ArrowDown'?1:-1;buttons[(index+offset+buttons.length)%buttons.length]?.focus();}});
    root.document.addEventListener('click',event=>{if(!event.target.closest('.ux12-top-search'))close();});
  }

  function rebuildApplicantTable(){
    const table=root.document.querySelector('#applicants .applicant-table');if(!table)return;
    const colgroup=table.querySelector('colgroup'),head=table.querySelector('thead');
    if(colgroup)colgroup.innerHTML='<col class="applicant-col-no"><col class="applicant-col-name"><col class="applicant-col-phone"><col class="applicant-col-posting"><col class="applicant-col-stage"><col class="applicant-col-next"><col class="applicant-col-schedule"><col class="applicant-col-manager"><col class="applicant-col-apply-date"><col class="applicant-col-decision"><col class="applicant-col-actions">';
    if(head)head.innerHTML='<tr><th class="no-head">NO</th><th class="name-head">성명</th><th class="phone-head">연락처</th><th class="posting-head">지원 공고</th><th class="stage-head">현재 단계</th><th class="next-head">다음 조치</th><th class="schedule-head">예정 일정</th><th class="manager-head">담당자</th><th class="apply-date-head">지원일</th><th class="decision-head">판정</th><th class="actions-head">더보기</th></tr>';
  }
  function organizeApplicantFilters(){
    const quick=$('quickFilters'),fixed=quick?.querySelector('.applicant-fixed-presets'),core=quick?.querySelector('.applicant-core-status-filters'),details=quick?.querySelector('.applicant-auxiliary-filters'),row=details?.querySelector('.applicant-auxiliary-filter-row');
    if(!quick||!core||!details||!row||quick.dataset.ux12Organized==='true')return;
    const fragment=root.document.createDocumentFragment(),contact=fixed?.querySelector('[data-filter="contact"]');
    if(contact)fragment.appendChild(contact);
    [...core.children].forEach(button=>fragment.appendChild(button));
    row.insertBefore(fragment,row.firstChild);core.remove();quick.dataset.ux12Organized='true';
  }

  function installHome(){
    const home=$('home'),panels=home?.querySelector('.dashboard-panels');if(!home||home.dataset.ux12Ready==='true')return;
    home.dataset.ux12Ready='true';home.querySelector('.home-dashboard-intro')?.setAttribute('hidden','');
    const priorityPanel=panels?.children[0],recentPanel=panels?.children[1];if(priorityPanel)priorityPanel.classList.add('ux12-priority-panel');
    if(panels&&recentPanel){
      const auxiliary=root.document.createElement('div');auxiliary.className='ux12-home-auxiliary';
      const schedule=root.document.createElement('section');schedule.className='panel ux12-schedule-panel';schedule.innerHTML='<div class="panel-head"><div><h3>오늘 일정</h3><small>면접·입사·중요 일정</small></div><button type="button" class="mini" data-go="calendar">일정 보기</button></div><div id="homeScheduleList" class="ux12-schedule-list"></div>';
      panels.insertBefore(auxiliary,recentPanel);auxiliary.append(schedule,recentPanel);recentPanel.classList.add('ux12-recent-panel');
      schedule.querySelector('[data-go="calendar"]')?.addEventListener('click',()=>root.setPage?.('calendar'));
    }
    const heading=home.querySelector('.section-heading h3');if(heading)heading.textContent='오늘 먼저 처리할 일';
    const copy=home.querySelector('.section-heading p');if(copy)copy.textContent='긴급·오늘 예정·기한 경과 순서로 실제 처리 대상을 보여줍니다.';
  }
  function renderHomeSummary(){
    const host=$('statsGrid');if(!host)return;
    const data=rows(),date=currentDate(),groups=typeof taskGroups==='function'?taskGroups():{overdue:[]};
    const values=[
      ['전체 지원자',data.length,'all'],['오늘 접수',data.filter(row=>text(row.applyDate)===date).length,'today'],
      ['검토 필요',data.filter(row=>text(row.status)==='서류검토').length,'review'],
      ['면접 예정',data.filter(row=>['면접예정','다음면접'].includes(text(row.status))).length,'interview'],
      ['기한 경과',groups.overdue?.length||0,'overdue']
    ];
    host.innerHTML=values.map(([label,value,target])=>`<button type="button" class="ux12-summary-item" data-home-target="${target}"><span>${label}</span><strong>${value}</strong></button>`).join('');
  }
  function renderHomeSchedule(){
    const host=$('homeScheduleList');if(!host)return;
    const items=typeof calendarItemsOn==='function'?calendarItemsOn(currentDate()):[];
    host.innerHTML=items.length?items.slice(0,5).map(item=>`<button type="button" data-go="calendar"><span>${escapeHtml(item.time||item.type||'일정')}</span><strong>${escapeHtml(item.title||item.name||item.type||'일정 확인')}</strong></button>`).join(''):'<div class="ux12-empty-line">오늘 등록된 일정이 없습니다.</div>';
    host.querySelectorAll('[data-go="calendar"]').forEach(button=>button.addEventListener('click',()=>root.setPage?.('calendar')));
  }
  function bindHomeSummary(){
    $('statsGrid')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-home-target]');if(!button)return;const target=button.dataset.homeTarget;
      if(target==='overdue'){root.setPage?.('today');root.setDailyWorkflowFilter?.('overdue');return;}
      if(typeof resetListFiltersToAll==='function')resetListFiltersToAll();
      if(target==='today'){currentSearch=currentDate();if($('searchInput'))$('searchInput').value=currentSearch;}
      if(target==='review')currentFilter='contact';if(target==='interview')currentFilter='interview';
      root.setPage?.('applicants');root.renderTable?.();
    });
  }

  function installTodaySummary(){
    const page=$('today');if(!page||$('ux12TodaySummary'))return;
    const strip=root.document.createElement('div');strip.id='ux12TodaySummary';strip.className='ux12-summary-strip ux12-today-summary';strip.setAttribute('aria-label','오늘 업무 핵심 요약');
    strip.innerHTML='<button type="button" data-daily-filter="all"><span>전체 대상</span><strong id="ux12TodayTotal">0</strong></button><button type="button" data-home-list="today"><span>오늘 접수</span><strong id="ux12TodayReceived">0</strong></button><button type="button" data-daily-filter="screening"><span>검토 필요</span><strong id="ux12TodayReview">0</strong></button><button type="button" data-daily-filter="interviewToday"><span>오늘 면접</span><strong id="ux12TodayInterview">0</strong></button><button type="button" data-daily-filter="overdue"><span>기한 경과</span><strong id="ux12TodayOverdue">0</strong></button>';
    page.querySelector('.daily-automation-summary')?.insertAdjacentElement('beforebegin',strip);
    strip.querySelector('[data-home-list="today"]')?.addEventListener('click',()=>{if(typeof resetListFiltersToAll==='function')resetListFiltersToAll();currentSearch=currentDate();if($('searchInput'))$('searchInput').value=currentSearch;root.setPage?.('applicants');root.renderTable?.();});
  }
  function updateTodaySummary(){
    const data=rows(),date=currentDate(),selection=root.dailyWorkflowSelection?.(),groups=selection?.groups||{};
    const values={ux12TodayTotal:selection?.rows?.length||0,ux12TodayReceived:data.filter(row=>text(row.applyDate)===date).length,ux12TodayReview:groups.screening?.length||0,ux12TodayInterview:groups.interviewToday?.length||0,ux12TodayOverdue:groups.overdue?.length||0};
    Object.entries(values).forEach(([id,value])=>{const element=$(id);if(element)element.textContent=String(value);});
  }

  function renderStageOverview(){
    const host=$('applicantStageOverview');if(!host)return;
    const data=rows(),groups=[
      ['전체',data.length,'all'],['서류 검토',data.filter(row=>['서류검토','부재중'].includes(text(row.status))).length,'contact'],
      ['서류 합격',data.filter(row=>text(row.status)==='서류합격').length,'docpass'],['면접',data.filter(row=>['면접예정','다음면접','면접완료'].includes(text(row.status))).length,'interview'],
      ['입사 예정',data.filter(row=>text(row.status)==='입사예정').length,'hire'],['종료',data.filter(row=>typeof isFinished==='function'&&isFinished(row)).length,'finished']
    ];
    host.innerHTML=`<div class="ux12-stage-heading"><div><h3>채용 단계 보기</h3><p>현재 업무 단계별 인원을 읽기 전용으로 확인합니다.</p></div><span>총 ${data.length}명</span></div><div class="ux12-stage-grid">${groups.map(([label,count,filter])=>`<button type="button" data-stage-filter="${filter}"><span>${label}</span><strong>${count}</strong><small>목록 보기 →</small></button>`).join('')}</div>`;
    host.querySelectorAll('[data-stage-filter]').forEach(button=>button.addEventListener('click',()=>{currentFilter=button.dataset.stageFilter;root.erpApplicantWorksheet?.setViewMode('normal');root.renderTable?.();}));
  }

  function routeForPage(page){return PAGE_ROUTES[page]||`#/${String(page||'today').replace(/[^a-zA-Z0-9_-]/g,'')}`;}
  function activePageId(){
    if($('advancedSearch')?.classList.contains('drawer-open'))return 'advancedSearch';
    return root.document.querySelector('.page.active')?.id||routing.currentPage||'home';
  }
  function syncAdvancedSearchShell(){
    root.document.body.dataset.activePage='advancedSearch';
    const title=$('page-title'),breadcrumb=root.document.querySelector('.topbar-breadcrumb');
    if(title)title.textContent='지원자 상세 검색';
    if(breadcrumb)breadcrumb.textContent='여러 검색조건을 조합하고 자주 쓰는 조건을 저장합니다.';
    root.document.querySelectorAll('.nav-btn').forEach(button=>button.classList.toggle('active',button.dataset.page==='applicants'));
    const topActions=root.document.querySelector('.top-actions:not(.form-top-actions)'),formActions=root.document.querySelector('.form-top-actions');
    if(topActions)topActions.style.display='none';if(formActions)formActions.style.display='none';
    updateActiveNavigation();
  }
  function firstAccessiblePage(){
    for(const page of ['home','today','applicants','calendar','employees','schools'])if(routeCanOpen(page))return page;
    return 'home';
  }
  function routeCanOpen(page){
    if(!root.document.getElementById(page))return false;
    if(page==='advancedSearch')return routeCanOpen('applicants');
    const button=root.document.querySelector(`.nav-btn[data-page="${page}"]`);if(!button)return page==='home';
    if(button.hidden||button.classList.contains('erp-permission-hidden')||button.getAttribute('aria-hidden')==='true')return false;
    return root.getComputedStyle(button).display!=='none';
  }
  function resolveRoute(state=root.history.state){
    const hash=root.location.hash||PAGE_ROUTES.home;
    if(hash==='#/applicants/quick'){
      const quickId=text(state?.quickApplicantId);
      if(routeCanOpen('applicants')&&quickId&&rows().some(row=>String(row?.id)===quickId))return {page:'applicants',route:hash,quickId,known:true};
      if(routeCanOpen('applicants'))return {page:'applicants',route:PAGE_ROUTES.applicants,quickId:'',known:false};
    }
    const page=ROUTE_PAGES[hash];
    if(page&&routeCanOpen(page))return {page,route:hash,quickId:'',known:true};
    const fallback=firstAccessiblePage();return {page:fallback,route:routeForPage(fallback),quickId:'',known:false};
  }
  function replaceCurrentState(extra={}){
    const state={...(root.history.state||{}),erpRoute:root.location.hash||routeForPage(routing.currentPage),erpIndex:routing.index,scrollX:root.scrollX||0,scrollY:root.scrollY||0,...extra};
    root.history.replaceState(state,'',state.erpRoute);return state;
  }
  function rememberScroll(){if(routing.initialized&&root.history.state?.erpRoute)replaceCurrentState();}
  function pushPageRoute(page){
    const route=routeForPage(page);if(root.location.hash===route&&root.history.state?.erpRoute===route)return;
    routing.index+=1;routing.currentPage=page;root.history.pushState({erpRoute:route,erpIndex:routing.index,scrollX:0,scrollY:0},'',route);
    root.requestAnimationFrame(()=>root.scrollTo(0,0));
  }
  function pushQuickRoute(id){
    if(routing.suppress||!id||root.location.hash==='#/applicants/quick')return;
    rememberScroll();routing.index+=1;root.history.pushState({erpRoute:'#/applicants/quick',erpIndex:routing.index,quickApplicantId:String(id),scrollX:root.scrollX||0,scrollY:root.scrollY||0},'','#/applicants/quick');
  }
  function replaceQuickWithList(){
    if(routing.suppress||root.location.hash!=='#/applicants/quick')return;
    root.history.replaceState({erpRoute:PAGE_ROUTES.applicants,erpIndex:routing.index,scrollX:root.scrollX||0,scrollY:root.scrollY||0},'',PAGE_ROUTES.applicants);
  }
  function updateQuickState(id){
    if(routing.suppress||root.location.hash!=='#/applicants/quick'||!id)return;
    replaceCurrentState({erpRoute:'#/applicants/quick',quickApplicantId:String(id)});
  }
  function hasUnsavedChanges(){
    const worksheetDirty=Boolean(root.erpApplicantWorksheet?.state?.dirty?.size);
    const formDirty=typeof root.erpApplicantFormIsDirty==='function'&&root.erpApplicantFormIsDirty();
    return worksheetDirty||formDirty;
  }
  function restoreAfterHistory(targetState){
    const target=resolveRoute(targetState),targetIndex=Number.isFinite(Number(targetState?.erpIndex))?Number(targetState.erpIndex):routing.index;
    if(!target.known)root.history.replaceState({...targetState,erpRoute:target.route,erpIndex:targetIndex,scrollX:0,scrollY:0},'',target.route);
    const active=activePageId();
    routing.suppress=true;
    let result;
    if(active!==target.page)result=root.setPage?.(target.page);
    if(result===false){
      routing.suppress=false;
      const delta=routing.index-targetIndex;
      if(delta){routing.reverting=true;root.history.go(delta);}else root.history.replaceState({...root.history.state,erpRoute:routeForPage(active),erpIndex:routing.index},'',routeForPage(active));
      return false;
    }
    if(target.page==='applicants'){
      if(target.quickId){if(!root.erpApplicantQuickDetail?.isOpen?.())root.openApplicantQuickDetail?.(target.quickId,null);}
      else if(root.erpApplicantQuickDetail?.isOpen?.())root.closeApplicantQuickDetail?.({restoreFocus:false,restoreScroll:false});
    }
    routing.suppress=false;routing.index=targetIndex;routing.currentPage=target.page;
    root.requestAnimationFrame(()=>root.scrollTo(Number(targetState?.scrollX)||0,Number(targetState?.scrollY)||0));
    return true;
  }
  function handleHistory(event){
    if(routing.reverting){routing.reverting=false;routing.index=Number(root.history.state?.erpIndex)||routing.index;return;}
    restoreAfterHistory(event?.state||root.history.state||{});
  }
  function installRouting(){
    if(routing.initialized)return;routing.initialized=true;
    root.addEventListener('popstate',handleHistory);
    root.addEventListener('hashchange',event=>{if(root.history.state?.erpRoute!==root.location.hash)handleHistory(event);});
    root.addEventListener('beforeunload',event=>{if(hasUnsavedChanges()){event.preventDefault();event.returnValue='';}});
    const initial=resolveRoute(root.history.state),initialIndex=Number(root.history.state?.erpIndex)||0;
    routing.index=initialIndex;routing.currentPage=initial.page;
    root.history.replaceState({...(root.history.state||{}),erpRoute:initial.route,erpIndex:initialIndex,scrollX:0,scrollY:0},'',initial.route);
    routing.suppress=true;root.setPage?.(initial.page);
    if(initial.quickId)root.openApplicantQuickDetail?.(initial.quickId,null);
    routing.suppress=false;
  }
  function replaceAdvancedSearchWithList(){
    if(root.location.hash!==PAGE_ROUTES.advancedSearch)return;
    routing.suppress=true;const result=root.setPage?.('applicants');routing.suppress=false;if(result===false)return;
    routing.currentPage='applicants';root.history.replaceState({...(root.history.state||{}),erpRoute:PAGE_ROUTES.applicants,erpIndex:routing.index,scrollX:root.scrollX||0,scrollY:root.scrollY||0},'',PAGE_ROUTES.applicants);updateActiveNavigation();
  }
  function bindAdvancedSearchRouting(){
    const openButton=$('btnOpenApplicantFilter');if(openButton)openButton.onclick=event=>{event.preventDefault();root.setPage?.('advancedSearch');};
    root.document.addEventListener('click',event=>{if(event.target.closest('#btnCloseApplicantFilter,#btnCancelApplicantFilter,#applicantFilterBackdrop,#asRun'))root.setTimeout(replaceAdvancedSearchWithList,0);});
    root.document.addEventListener('keydown',event=>{if(event.key==='Escape'&&root.location.hash===PAGE_ROUTES.advancedSearch)root.setTimeout(replaceAdvancedSearchWithList,0);});
  }

  function installWrappers(){
    const previousStats=root.renderStats;root.renderStats=function(){renderHomeSummary();};root.renderStats.__ux12=true;root.renderStats.previous=previousStats;
    const previousHome=root.renderHomeLists;root.renderHomeLists=function(){const result=previousHome?.apply(this,arguments);renderHomeSchedule();return result;};
    const previousToday=root.renderToday;root.renderToday=function(){const result=previousToday?.apply(this,arguments);updateTodaySummary();return result;};
    const previousPage=root.setPage;root.setPage=function(page){
      const before=activePageId();if(!routing.suppress)rememberScroll();
      const result=previousPage?.apply(this,arguments);
      const after=activePageId();if(after==='advancedSearch')syncAdvancedSearchShell();
      if(page!==before&&after===before)return false;
      if(result!==false&&!routing.suppress&&after!==before)pushPageRoute(after);
      if(result!==false)routing.currentPage=after;
      updateActiveNavigation();root.requestAnimationFrame(()=>{updateActiveNavigation();updateCollapseButton();});return result;
    };
  }

  function auditPhotoFreeShell(){
    $('authUserMark')?.remove();$('topbarUserMark')?.remove();
    root.document.querySelectorAll('.auth-user-avatar,.topbar-user-mark').forEach(element=>element.remove());
  }

  function init(){
    if(root.document.body.dataset.ux12Ready==='true')return;
    root.document.body.dataset.ux12Ready='true';root.document.body.classList.add('ux12-ready');
    syncDesktopShell();root.addEventListener('resize',syncDesktopShell,{passive:true});
    auditPhotoFreeShell();buildNavigation();buildShell();rebuildApplicantTable();organizeApplicantFilters();installHome();installTodaySummary();installWrappers();bindAdvancedSearchRouting();bindHomeSummary();
    root.erpUx12Router={onQuickOpen:pushQuickRoute,onQuickClose:replaceQuickWithList,onQuickChange:updateQuickState,resolveRoute,routeForPage,activePageId,hasUnsavedChanges,state:routing};
    root.erpUx12={managerAssignments,postingOf,managerOf,nextActionOf,scheduleOf,renderStageOverview,renderHomeSummary,updateTodaySummary,router:root.erpUx12Router};
    installRouting();
    root.renderStats?.();root.renderHomeLists?.();root.renderToday?.();root.renderTable?.();updateActiveNavigation();
    root.__erpUx12FirstShownAt=root.performance?.now?.()||Date.now();
    root.performance?.mark?.('erp-ux12-first-shown');
    root.document.documentElement.classList.remove('ux12-booting');
    root.document.dispatchEvent(new CustomEvent('erp:ux12-ready',{detail:{shownAt:root.__erpUx12FirstShownAt}}));
  }

  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(typeof window!=='undefined'?window:globalThis);
