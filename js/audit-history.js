/* Recruit ERP v12.5.0 append-only local audit engine (no history UI). */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpAudit=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const VERSION='12.5.0';
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
  function uid(){return root.crypto?.randomUUID?.()||('audit_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12));}
  function asArray(value){return Array.isArray(value)?value:[];}
  function clone(value){try{return JSON.parse(JSON.stringify(value));}catch{return [];}}
  function readJson(key,fallback){try{const value=JSON.parse(root.localStorage?.getItem(key)||'null');return value==null?fallback:value;}catch{return fallback;}}
  function readLocal(){return asArray(readJson(STORAGE_KEY,[]));}
  function writeLocal(rows){
    try{
      const value=JSON.stringify(rows.slice(0,MAX_LOCAL_RECORDS));
      return typeof root.safeLocalStorageSet==='function'?root.safeLocalStorageSet(STORAGE_KEY,value,{notify:false}):(root.localStorage?.setItem(STORAGE_KEY,value),true);
    }catch(error){console.warn('변경 이력을 로컬에 저장하지 못했습니다.',error);return false;}
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
    return Array.from(new Set([...Object.keys(before||{}),...Object.keys(after||{})])).filter(key=>!ignored.has(key)&&JSON.stringify(before?.[key])!==JSON.stringify(after?.[key]));
  }
  function makeRecord({entityType,entityId,entityLabel:label,action,fields=[],before={},after={},reason='',metadata={}}){
    const who=actor();
    const beforeValues={},afterValues={};
    fields.forEach(field=>{beforeValues[field]=valueSummary(field,before?.[field]);afterValues[field]=valueSummary(field,after?.[field]);});
    return {client_event_id:uid(),occurred_at:new Date().toISOString(),actor_user_id:who.userId,actor_label:who.label,actor_role:who.role,entity_type:entityType,entity_id:String(entityId||''),entity_label:label||DATASETS[entityType]?.label||'기록',action,changed_fields:fields,before_values:beforeValues,after_values:afterValues,reason:scrubText(reason),source:who.source,app_version:VERSION,metadata};
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
      return [makeRecord({entityType,entityId:context.entityId||'',entityLabel:context.entityLabel||DATASETS[entityType]?.label,action:context.action||'batch',fields:['createdCount','updatedCount','deletedCount'],before:{createdCount:0,updatedCount:0,deletedCount:0},after:{createdCount:created.length,updatedCount:updated.length,deletedCount:deleted.length},reason:context.reason,metadata:{...context.metadata,created:created.length,updated:updated.length,deleted:deleted.length}})];
    }
    return [
      ...created.map(row=>makeRecord({entityType,entityId:row.id,entityLabel:entityLabel(entityType,row),action:context.action||'create',fields:changedKeys({},row),after:row,reason:context.reason,metadata:context.metadata})),
      ...updated.map(item=>makeRecord({entityType,entityId:item.after.id,entityLabel:entityLabel(entityType,item.after),action:context.action||'update',fields:item.fields,before:item.before,after:item.after,reason:context.reason,metadata:context.metadata})),
      ...deleted.map(row=>makeRecord({entityType,entityId:row.id,entityLabel:entityLabel(entityType,row),action:context.action||'delete',fields:[],before:row,reason:context.reason,metadata:context.metadata}))
    ];
  }
  function append(records){const valid=asArray(records).filter(Boolean);if(!valid.length)return [];return writeLocal([...valid,...readLocal()])?valid:[];}
  function commitSave(entityType,beforeRows,afterRows){const context=pendingContext[entityType]||{};clearNextContext(entityType);return append(buildDatasetRecords(entityType,beforeRows,afterRows,context));}
  function recordEvent(event){return append([makeRecord(event||{})]);}
  async function loadHistory(){return readLocal();}
  function renderPage(){return null;}
  function init(){return null;}
  const api={VERSION,STORAGE_KEY,MAX_LOCAL_RECORDS,DATASETS,SAFE_FIELDS,scrubText,maskName,maskEmail,valueSummary,capture,setNextContext,clearNextContext,buildDatasetRecords,commitSave,recordEvent,readLocal,loadHistory,renderPage,init};
  return api;
});
