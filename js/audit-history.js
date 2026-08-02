/* Recruit ERP v10.59.0 AUDIT HISTORY
 * Audit records are append-only. Sensitive values are summarized, never copied verbatim.
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpAudit=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const VERSION='10.59.0';
  const STORAGE_KEY='recruit_erp_audit_logs_v1';
  const MAX_LOCAL_RECORDS=2000;
  const DATASETS={
    applicant:{key:'recruit_erp_applicants_stable',label:'지원자'},
    employee:{key:'recruit_erp_employees',label:'사원'},
    school:{key:'recruit_erp_schools',label:'협력학교'},
    schedule:{key:'recruit_erp_calendar_events',label:'일정'}
  };
  const SAFE_FIELDS=new Set([
    'status','workplace','manager','team','department','groupName','product','part','rank','position','role',
    'recruitType','recruitChannel','managementStatus','type','importance','date','time','interviewDate','interviewTime',
    'hireDate','joinDate','resignDate','returnDate','promotionDate','finalDecision','dorm','education','careerType',
    'schoolId','applicantId','employeeId','updatedAt'
  ]);
  const SENSITIVE_KEY=/(name|phone|mobile|email|address|resident|rrn|ssn|birth|password|secret|token|bank|account|salary|memo|note|reason|consult|content|title|description|history)/i;
  let pendingContext={};
  let cloudSyncing=false;
  let pageRows=[];
  let auditPage=1;
  const AUDIT_PAGE_SIZE=20;
  const auditFilters={type:'all',action:'all',query:''};

  function uid(){return root.crypto?.randomUUID?.()||('audit_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12));}
  function asArray(value){return Array.isArray(value)?value:[];}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch(_){return [];}}
  function readJson(key,fallback){try{const value=JSON.parse(root.localStorage?.getItem(key)||'null');return value==null?fallback:value;}catch(_){return fallback;}}
  function readLocal(){return asArray(readJson(STORAGE_KEY,[]));}
  function writeLocal(rows){
    try{root.localStorage?.setItem(STORAGE_KEY,JSON.stringify(rows.slice(0,MAX_LOCAL_RECORDS)));return true;}
    catch(error){console.warn('변경 이력을 로컬에 저장하지 못했습니다.',error);return false;}
  }
  function scrubText(value){
    return String(value==null?'':value)
      .replace(/\b\d{6}\s*-?\s*[1-4]\d{6}\b/g,'[주민등록번호 숨김]')
      .replace(/\b01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}\b/g,'[전화번호 숨김]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일 숨김]')
      .slice(0,300);
  }
  function maskName(value){const text=String(value||'').trim();if(!text)return '-';if(text.length===1)return '*';return text[0]+'*'.repeat(Math.min(3,text.length-1));}
  function maskEmail(value){const text=String(value||'').trim();const at=text.indexOf('@');if(at<1)return text?maskName(text):'-';return maskName(text.slice(0,at))+'@'+text.slice(at+1);}
  function valueSummary(field,value){
    if(value==null||value==='')return '비어 있음';
    if(SENSITIVE_KEY.test(field))return '개인정보/내용 변경됨';
    if(Array.isArray(value))return `항목 ${value.length}개`;
    if(typeof value==='object')return '복합정보 변경됨';
    if(SAFE_FIELDS.has(field))return scrubText(value).slice(0,120);
    if(typeof value==='boolean'||typeof value==='number')return String(value);
    return '값 변경됨';
  }
  function actor(){
    const current=root.erpPermissions?.current?.()||{};
    const email=String(current.email||'').trim();
    return {userId:current.userId||null,label:email?maskEmail(email):(current.source==='local'?'로컬 관리자':'알 수 없음'),role:current.role||'viewer',source:current.source||'local'};
  }
  function entityLabel(type,row){
    if(type==='school')return scrubText(row?.name||row?.schoolName||'협력학교').slice(0,80);
    if(type==='schedule')return '일정';
    return maskName(row?.name||DATASETS[type]?.label||'기록');
  }
  function changedKeys(before,after){
    const ignored=new Set(['createdAt']);
    return Array.from(new Set([...Object.keys(before||{}),...Object.keys(after||{})]))
      .filter(key=>!ignored.has(key)&&JSON.stringify(before?.[key])!==JSON.stringify(after?.[key]));
  }
  function makeRecord({entityType,entityId,entityLabel:label,action,fields=[],before={},after={},reason='',metadata={}}){
    const who=actor();
    const beforeValues={},afterValues={};
    fields.forEach(field=>{beforeValues[field]=valueSummary(field,before?.[field]);afterValues[field]=valueSummary(field,after?.[field]);});
    return {
      client_event_id:uid(),occurred_at:new Date().toISOString(),actor_user_id:who.userId,actor_label:who.label,actor_role:who.role,
      entity_type:entityType,entity_id:String(entityId||''),entity_label:label||DATASETS[entityType]?.label||'기록',action,
      changed_fields:fields,before_values:beforeValues,after_values:afterValues,reason:scrubText(reason),source:who.source,
      app_version:VERSION,metadata,cloud_synced:false
    };
  }
  function capture(entityType){const dataset=DATASETS[entityType];return dataset?clone(asArray(readJson(dataset.key,[]))):[];}
  function setNextContext(entityType,context){pendingContext[entityType]={...(context||{})};}
  function clearNextContext(entityType){delete pendingContext[entityType];}
  function buildDatasetRecords(entityType,beforeRows,afterRows,context={}){
    const beforeMap=new Map(asArray(beforeRows).map(row=>[String(row?.id||''),row]));
    const afterMap=new Map(asArray(afterRows).map(row=>[String(row?.id||''),row]));
    const created=[],updated=[],deleted=[];
    afterMap.forEach((row,id)=>{if(!beforeMap.has(id))created.push(row);else{const fields=changedKeys(beforeMap.get(id),row);if(fields.length)updated.push({before:beforeMap.get(id),after:row,fields});}});
    beforeMap.forEach((row,id)=>{if(!afterMap.has(id))deleted.push(row);});
    if(context.batchSummary||created.length+updated.length+deleted.length>100){
      return [makeRecord({entityType,entityId:context.entityId||'',entityLabel:context.entityLabel||DATASETS[entityType]?.label,action:context.action||'batch',
        fields:['createdCount','updatedCount','deletedCount'],before:{createdCount:0,updatedCount:0,deletedCount:0},
        after:{createdCount:created.length,updatedCount:updated.length,deletedCount:deleted.length},reason:context.reason,
        metadata:{...context.metadata,created:created.length,updated:updated.length,deleted:deleted.length}})];
    }
    return [
      ...created.map(row=>makeRecord({entityType,entityId:row.id,entityLabel:entityLabel(entityType,row),action:context.action||'create',fields:changedKeys({},row),after:row,reason:context.reason,metadata:context.metadata})),
      ...updated.map(item=>makeRecord({entityType,entityId:item.after.id,entityLabel:entityLabel(entityType,item.after),action:context.action||'update',fields:item.fields,before:item.before,after:item.after,reason:context.reason,metadata:context.metadata})),
      ...deleted.map(row=>makeRecord({entityType,entityId:row.id,entityLabel:entityLabel(entityType,row),action:context.action||'delete',fields:[],before:row,reason:context.reason,metadata:context.metadata}))
    ];
  }
  function append(records){
    const valid=asArray(records).filter(Boolean);if(!valid.length)return [];
    if(!writeLocal([...valid,...readLocal()]))return [];
    syncCloud();renderPage();return valid;
  }
  function commitSave(entityType,beforeRows,afterRows){const context=pendingContext[entityType]||{};clearNextContext(entityType);return append(buildDatasetRecords(entityType,beforeRows,afterRows,context));}
  function recordEvent(event){return append([makeRecord(event||{})]);}
  function cloudEligible(){const current=root.erpPermissions?.current?.()||{};return !!(root.sb&&current.source==='cloud'&&current.userId);}
  async function syncCloud(){
    if(cloudSyncing||!cloudEligible())return;const pending=readLocal().filter(row=>!row.cloud_synced).slice(-500);if(!pending.length)return;
    cloudSyncing=true;
    try{
      for(let start=0;start<pending.length;start+=100){
        const batch=pending.slice(start,start+100);const payload=batch.map(({cloud_synced,...row})=>row);
        const response=await root.sb.from('audit_logs').upsert(payload,{onConflict:'client_event_id',ignoreDuplicates:true});
        if(response?.error)throw response.error;
        const ids=new Set(batch.map(row=>row.client_event_id));writeLocal(readLocal().map(row=>ids.has(row.client_event_id)?{...row,cloud_synced:true}:row));
      }
    }catch(error){console.warn('변경 이력 클라우드 동기화 실패:',error);}
    finally{cloudSyncing=false;renderPage();}
  }
  async function loadCloud(){
    if(!cloudEligible()||!root.erpPermissions?.has?.('audit.read')){pageRows=readLocal();renderPage();return pageRows;}
    const response=await root.sb.from('audit_logs').select('client_event_id,occurred_at,actor_label,actor_role,entity_type,entity_id,entity_label,action,changed_fields,before_values,after_values,reason,source,app_version,metadata').order('occurred_at',{ascending:false}).order('id',{ascending:false}).limit(200);
    if(response?.error)throw response.error;pageRows=asArray(response.data);renderPage();return pageRows;
  }
  function actionLabel(value){return ({create:'등록',update:'수정',delete:'삭제',restore:'복원',export:'내보내기',role_change:'권한 변경',batch:'일괄 변경'})[value]||value||'-';}
  function typeLabel(value){return DATASETS[value]?.label||({system:'시스템',export:'내보내기',user:'사용자'})[value]||value||'-';}
  function ensureUi(){
    if(!root.document)return;
    const systemItems=root.document.querySelector('[data-navgroup="system"] .nav-group-items');
    if(systemItems&&!root.document.querySelector('[data-page="auditHistory"]')){
      const button=root.document.createElement('button');button.className='nav-btn nav-sub';button.type='button';button.dataset.page='auditHistory';button.dataset.requiredPermission='audit.read';
      const icon=root.document.createElement('span');icon.className='nav-ico';icon.setAttribute('aria-hidden','true');icon.textContent='🧾';
      const label=root.document.createElement('span');label.textContent='변경 이력';button.append(icon,label);systemItems.appendChild(button);
      button.addEventListener('click',()=>{root.setPage?.('auditHistory');setTimeout(()=>loadCloud().catch(error=>console.warn('변경 이력 조회 실패:',error)),0);});
    }
    const main=root.document.querySelector('main.main');
    if(main&&!root.document.getElementById('auditHistory')){
      const section=root.document.createElement('section');section.className='page audit-page';section.id='auditHistory';
      section.innerHTML='<div class="page-intro-card safety-intro-card"><div><h3>변경 이력</h3><p>누가 언제 무엇을 바꿨는지 확인합니다. 민감한 값은 기록하지 않습니다.</p></div><button class="ghost" id="btnAuditRefresh" type="button">새로고침</button></div><div id="auditPageBody" class="audit-page-shell"></div>';
      main.appendChild(section);section.querySelector('#btnAuditRefresh')?.addEventListener('click',()=>loadCloud().catch(error=>root.alert?.('변경 이력을 불러오지 못했습니다: '+(error.message||error))));
    }
  }
  function renderPage(){
    const host=root.document?.getElementById('auditPageBody');if(!host)return;
    if(!root.erpPermissions?.has?.('audit.read')){host.textContent='관리자만 변경 이력을 볼 수 있습니다.';return;}
    const rows=pageRows.length?pageRows:readLocal();host.replaceChildren();
    const controls=root.document.createElement('div');controls.className='audit-controls';controls.innerHTML='<label>대상<select id="auditTypeFilter"><option value="all">전체</option><option value="applicant">지원자</option><option value="employee">사원</option><option value="school">협력학교</option><option value="schedule">일정</option><option value="user">사용자</option></select></label><label>작업<select id="auditActionFilter"><option value="all">전체</option><option value="create">등록</option><option value="update">수정</option><option value="delete">삭제</option><option value="restore">복원</option><option value="export">내보내기</option><option value="role_change">권한 변경</option><option value="batch">일괄 변경</option></select></label><label class="audit-search-label">검색<input id="auditSearch" placeholder="사용자·대상·변경 항목 검색"></label>';
    controls.querySelector('#auditTypeFilter').value=auditFilters.type;controls.querySelector('#auditActionFilter').value=auditFilters.action;controls.querySelector('#auditSearch').value=auditFilters.query;
    controls.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{auditFilters.type=controls.querySelector('#auditTypeFilter').value;auditFilters.action=controls.querySelector('#auditActionFilter').value;auditPage=1;renderPage();}));
    controls.querySelector('#auditSearch').addEventListener('change',event=>{auditFilters.query=event.target.value.trim();auditPage=1;renderPage();});
    const query=auditFilters.query.toLowerCase();const filtered=rows.filter(row=>(auditFilters.type==='all'||row.entity_type===auditFilters.type)&&(auditFilters.action==='all'||row.action===auditFilters.action)&&(!query||[row.actor_label,row.entity_label,row.action,...asArray(row.changed_fields)].join(' ').toLowerCase().includes(query)));
    const totalPages=Math.max(1,Math.ceil(filtered.length/AUDIT_PAGE_SIZE));auditPage=Math.min(auditPage,totalPages);const visible=filtered.slice((auditPage-1)*AUDIT_PAGE_SIZE,auditPage*AUDIT_PAGE_SIZE);
    const summary=root.document.createElement('div');summary.className='audit-summary';summary.textContent=`검색 결과 ${filtered.length}건 · 민감정보 원문 미기록`;
    const wrap=root.document.createElement('div');wrap.className='audit-table-wrap';const table=root.document.createElement('table');table.className='audit-table';
    const labels=['일시','사용자','대상','작업','변경 항목','사유','상세'];const thead=root.document.createElement('thead'),headRow=root.document.createElement('tr');labels.forEach(text=>{const th=root.document.createElement('th');th.textContent=text;headRow.appendChild(th);});thead.appendChild(headRow);table.appendChild(thead);
    const tbody=root.document.createElement('tbody');visible.forEach(row=>{const tr=root.document.createElement('tr');const fields=[new Date(row.occurred_at).toLocaleString('ko-KR'),row.actor_label||'-',`${typeLabel(row.entity_type)} · ${row.entity_label||'-'}`,actionLabel(row.action),asArray(row.changed_fields).join(', ')||'-',row.reason||'-'];fields.forEach((value,index)=>{const td=root.document.createElement('td');td.dataset.label=labels[index];td.textContent=String(value);tr.appendChild(td);});const detailTd=root.document.createElement('td');detailTd.dataset.label='상세';const details=root.document.createElement('details');details.className='audit-detail';const summaryEl=root.document.createElement('summary');summaryEl.textContent='안전 요약 보기';const body=root.document.createElement('div');body.className='audit-detail-body';const changed=asArray(row.changed_fields);if(!changed.length)body.textContent='변경 항목 상세 없음';else changed.forEach(field=>{const line=root.document.createElement('p'),strong=root.document.createElement('strong'),span=root.document.createElement('span');strong.textContent=field;span.textContent=`${row.before_values?.[field]||'비어 있음'} → ${row.after_values?.[field]||'비어 있음'}`;line.append(strong,span);body.appendChild(line);});details.append(summaryEl,body);detailTd.appendChild(details);tr.appendChild(detailTd);tbody.appendChild(tr);});
    if(!visible.length){const tr=root.document.createElement('tr'),td=root.document.createElement('td');td.colSpan=7;td.textContent='조건에 맞는 변경 이력이 없습니다.';tr.appendChild(td);tbody.appendChild(tr);}table.appendChild(tbody);wrap.appendChild(table);
    const pager=root.document.createElement('div');pager.className='audit-pagination';const prev=root.document.createElement('button'),next=root.document.createElement('button'),label=root.document.createElement('span');prev.type=next.type='button';prev.className=next.className='ghost';prev.textContent='이전';next.textContent='다음';prev.disabled=auditPage<=1;next.disabled=auditPage>=totalPages;label.textContent=`${auditPage} / ${totalPages} 페이지`;prev.addEventListener('click',()=>{auditPage-=1;renderPage();});next.addEventListener('click',()=>{auditPage+=1;renderPage();});pager.append(prev,label,next);host.append(controls,summary,wrap,pager);
  }
  function init(){if(!root.document)return;ensureUi();root.document.addEventListener('erp:permission-change',()=>{ensureUi();syncCloud();renderPage();});root.addEventListener?.('online',syncCloud);syncCloud();renderPage();}
  const api={VERSION,STORAGE_KEY,MAX_LOCAL_RECORDS,DATASETS,SAFE_FIELDS,scrubText,maskName,maskEmail,valueSummary,capture,setNextContext,clearNextContext,buildDatasetRecords,commitSave,recordEvent,readLocal,syncCloud,loadCloud,renderPage,init};
  if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}
  return api;
});
