/* Recruit ERP v10.61.0 screen, import, and declarative event security */
(function(root){
  'use strict';

  const VERSION='10.61.0';
  const MAX_IMPORT_BYTES=50*1024*1024;
  const MAX_IMPORT_ROWS=10000;
  const ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);
  const ALLOWED_ACTIONS=new Set([
    'openApplicantQuickLog','closeApplicantQuickLog','saveApplicantQuickLog','editApplicant','setPage',
    'dismissScheduleReminder','goApplicantPage','changeApplicantPageSize','clearApplicantSchoolFilter',
    'viewApplicant','updateApplicantStatus','deleteApplicant','resetAndRenderList','selectCalendarDate',
    'toggleCalendarInterviewSelectAll','openCalendarBulkDecision','toggleCalendarInterviewSelection',
    'editCalendarEvent','deleteCalendarEvent','restoreSnapshot','openEmployeeLinkedApplicant',
    'closeEmployeeDetail','openSchoolDetail','goEmployeePage','resetEmployeeFilters','openEmployeeDetail',
    'openEmployeeStatusManager','editEmployeePrompt','closeEmployeeStatusAudit','removeSchoolCoreItem',
    'saveSchoolMouInfo','addSchoolCoreContact','addSchoolCoreMemo','addSchoolRecommendationRequest',
    'addSchoolDepartment','addSchoolCoreActivity','closeSchoolManagementCore','editSchoolPrompt',
    'setSchoolCoreTab','openSchoolManagementCore','viewSchoolEmployees','viewSchoolApplicants',
    'acceptSchoolHint','dismissSchoolHintFor','mergeUnmatchedText','createSchoolFromText',
    'setSchoolManageSort','setSchoolManagePage','resetSchoolManageFilters','selectSchoolManage',
    'linkApplicantToEmployee','dismissApplicantEmployeeLink','dailyRunApplicantAction',
    'applyCalendarBulkDecision','closeCalendarBulkDecisionModal','closeSchoolDetail'
  ]);

  function escapeAttribute(value){
    return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function isPlainObject(value){
    if(!value||Object.prototype.toString.call(value)!=='[object Object]')return false;
    const proto=Object.getPrototypeOf(value);return proto===Object.prototype||proto===null;
  }
  function isValidId(value){
    if(value===null||value===undefined)return false;
    return ID_PATTERN.test(String(value));
  }
  function assertSafeTree(value,path='root',depth=0,state={nodes:0}){
    if(depth>12)throw new Error(`${path}: 데이터 구조가 너무 깊습니다.`);
    state.nodes++;if(state.nodes>250000)throw new Error('가져오기 데이터가 너무 큽니다.');
    if(value===null||['string','number','boolean'].includes(typeof value))return true;
    if(Array.isArray(value)){value.forEach((item,index)=>assertSafeTree(item,`${path}[${index}]`,depth+1,state));return true;}
    if(!isPlainObject(value))throw new Error(`${path}: 허용되지 않는 데이터 형식입니다.`);
    Object.keys(value).forEach(key=>{
      if(BLOCKED_KEYS.has(key))throw new Error(`${path}: 위험한 속성 이름이 포함되어 있습니다.`);
      assertSafeTree(value[key],`${path}.${key}`,depth+1,state);
    });
    return true;
  }
  function validateRowIds(rows,options={}){
    const requireId=!!options.requireId;
    rows.forEach((row,index)=>{
      if(!isPlainObject(row))throw new Error(`${index+1}번째 항목이 올바른 객체가 아닙니다.`);
      const raw=row.id;
      if((raw===undefined||raw===null||raw==='')&&!requireId)return;
      if(!isValidId(raw))throw new Error(`${index+1}번째 항목의 ID 형식이 안전하지 않습니다.`);
    });
  }
  function validateBackupPayload(parsed,options={}){
    assertSafeTree(parsed);
    const datasetKeys=Array.isArray(options.datasetKeys)?options.datasetKeys:[];
    const collections=[];const seen=new Set();
    const add=rows=>{if(Array.isArray(rows)&&!seen.has(rows)){seen.add(rows);collections.push(rows);}};
    add(parsed);
    if(isPlainObject(parsed)){
      add(parsed.rows);
      datasetKeys.forEach(key=>add(parsed[key]));
      if(isPlainObject(parsed.data))datasetKeys.forEach(key=>add(parsed.data[key]));
    }
    collections.forEach(rows=>validateRowIds(rows,{requireId:false}));
    return true;
  }
  function parseJson(raw,options={}){
    const text=String(raw??'');
    if(!text.trim())throw new Error('JSON 파일이 비어 있습니다.');
    if(new Blob([text]).size>(options.maxBytes||MAX_IMPORT_BYTES))throw new Error('JSON 파일이 허용 크기를 초과했습니다.');
    let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('JSON 문법이 올바르지 않습니다.');}
    assertSafeTree(parsed);
    return parsed;
  }
  function parseImportJson(raw,options={}){
    const parsed=parseJson(raw,options);
    const collection=options.collection;
    const rows=Array.isArray(parsed)?parsed:(collection&&isPlainObject(parsed)&&Array.isArray(parsed[collection])?parsed[collection]:null);
    if(!rows)throw new Error(options.formatMessage||'예상한 JSON 자료 목록을 찾지 못했습니다.');
    if(!rows.length&&!options.allowEmpty)throw new Error('가져올 자료가 없습니다.');
    if(rows.length>(options.maxRows||MAX_IMPORT_ROWS))throw new Error(`한 번에 ${options.maxRows||MAX_IMPORT_ROWS}건까지만 가져올 수 있습니다.`);
    validateRowIds(rows,{requireId:options.requireId});
    return {parsed,rows};
  }
  function actionAttrs(name,args=[],options={}){
    if(!ALLOWED_ACTIONS.has(name))throw new Error(`허용되지 않은 화면 동작: ${name}`);
    const attrs=[`data-erp-action="${escapeAttribute(name)}"`,`data-erp-args="${escapeAttribute(JSON.stringify(args))}"`];
    if(options.event)attrs.push(`data-erp-event="${escapeAttribute(options.event)}"`);
    if(options.useValue)attrs.push('data-erp-use-value="true"');
    if(options.useChecked)attrs.push('data-erp-use-checked="true"');
    if(options.stop)attrs.push('data-erp-stop="true"');
    if(options.keyboard)attrs.push('data-erp-keyboard="true"');
    if(options.before){if(!ALLOWED_ACTIONS.has(options.before))throw new Error('허용되지 않은 선행 동작입니다.');attrs.push(`data-erp-before="${escapeAttribute(options.before)}"`);}
    if(options.after){if(!ALLOWED_ACTIONS.has(options.after))throw new Error('허용되지 않은 후행 동작입니다.');attrs.push(`data-erp-after="${escapeAttribute(options.after)}"`);}
    return attrs.join(' ');
  }
  function actionArgs(element){
    try{const value=JSON.parse(element?.dataset?.erpArgs||'[]');return Array.isArray(value)?value:[];}catch{return [];}
  }
  function callAllowed(name,args){
    if(!ALLOWED_ACTIONS.has(name))return false;
    const fn=root[name];if(typeof fn!=='function')return false;
    fn(...args);return true;
  }
  function splitLegacyArgs(source,element){
    const args=[];let token='',quote='',escaped=false;
    function push(){
      const raw=token.trim();token='';
      if(!raw)return;
      if((raw[0]==="'"&&raw.at(-1)==="'")||(raw[0]==='"'&&raw.at(-1)==='"')){
        args.push(raw.slice(1,-1).replace(/\\(['"\\])/g,'$1'));return;
      }
      if(raw==='this.value'){args.push(element.value);return;}
      if(raw==='this.checked'){args.push(!!element.checked);return;}
      if(raw==='true'||raw==='false'){args.push(raw==='true');return;}
      if(raw==='null'){args.push(null);return;}
      if(/^-?\d+(?:\.\d+)?$/.test(raw)){args.push(Number(raw));return;}
      throw new Error('허용되지 않은 화면 동작 인수입니다.');
    }
    for(const char of source){
      if(escaped){token+=char;escaped=false;continue;}
      if(char==='\\'){token+=char;escaped=true;continue;}
      if(quote){token+=char;if(char===quote)quote='';continue;}
      if(char==="'"||char==='"'){token+=char;quote=char;continue;}
      if(char===','){push();continue;}token+=char;
    }
    push();return args;
  }
  function invokeLegacy(element,event,attribute='data-erp-handler'){
    const source=String(element?.getAttribute?.(attribute)||'');if(!source)return false;
    if(source.includes('event.stopPropagation()'))event.stopPropagation();
    if(source.includes("currentSchoolFilterId=''"))callAllowed('clearApplicantSchoolFilter',[]);
    let called=false,index=0;
    while(index<source.length){
      const match=/[A-Za-z_$][\w$]*/.exec(source.slice(index));if(!match)break;
      const name=match[0],nameStart=index+match.index;let cursor=nameStart+name.length;
      while(/\s/.test(source[cursor]||''))cursor++;
      if(source[cursor]!=='('){index=cursor+1;continue;}
      let depth=1,quote='',escaped=false,end=cursor+1;
      for(;end<source.length;end++){
        const char=source[end];
        if(escaped){escaped=false;continue;}
        if(char==='\\'){escaped=true;continue;}
        if(quote){if(char===quote)quote='';continue;}
        if(char==="'"||char==='"'){quote=char;continue;}
        if(char==='(')depth++;else if(char===')'&&--depth===0)break;
      }
      if(depth!==0)break;
      if(ALLOWED_ACTIONS.has(name)){
        try{called=callAllowed(name,splitLegacyArgs(source.slice(cursor+1,end),element))||called;}catch(error){console.warn('차단된 화면 동작:',error);}
      }
      index=end+1;
    }
    return called;
  }
  function invoke(element,event){
    if(!element||!ALLOWED_ACTIONS.has(element.dataset.erpAction))return false;
    if(element.dataset.erpStop==='true')event.stopPropagation();
    const args=actionArgs(element);
    if(element.dataset.erpUseValue==='true')args.push(element.value);
    if(element.dataset.erpUseChecked==='true')args.push(!!element.checked);
    if(element.dataset.erpBefore)callAllowed(element.dataset.erpBefore,[]);
    const called=callAllowed(element.dataset.erpAction,args);
    if(element.dataset.erpAfter)callAllowed(element.dataset.erpAfter,[]);
    return called;
  }
  function isNestedInteractive(target,actionElement){
    const control=target.closest?.('button,a,input,select,textarea,label,summary,details');
    return !!control&&!actionElement.matches('button,a,input,select,textarea,label,summary,details');
  }
  if(root.document){
    root.document.addEventListener('click',event=>{
      const element=event.target.closest?.('[data-erp-action]:not([data-erp-event="change"])');
      if(element&&!isNestedInteractive(event.target,element)){invoke(element,event);return;}
      const legacy=event.target.closest?.('[data-erp-handler]');
      if(legacy&&!isNestedInteractive(event.target,legacy))invokeLegacy(legacy,event);
    });
    root.document.addEventListener('change',event=>{
      const element=event.target.closest?.('[data-erp-action][data-erp-event="change"]');
      if(element){invoke(element,event);return;}
      const legacy=event.target.closest?.('[data-erp-change-handler]');if(legacy)invokeLegacy(legacy,event,'data-erp-change-handler');
    });
    root.document.addEventListener('keydown',event=>{
      if(!['Enter',' '].includes(event.key))return;
      const element=event.target.closest?.('[data-erp-action][data-erp-keyboard="true"]');
      if(element&&!element.matches('button,a,input,select,textarea')){event.preventDefault();invoke(element,event);return;}
      const legacy=event.target.closest?.('[data-erp-handler][data-erp-key-handler]');
      if(legacy&&!legacy.matches('button,a,input,select,textarea')){event.preventDefault();invokeLegacy(legacy,event);}
    });
  }

  const api={VERSION,MAX_IMPORT_BYTES,MAX_IMPORT_ROWS,ID_PATTERN,ALLOWED_ACTIONS,escapeAttribute,isPlainObject,isValidId,assertSafeTree,validateRowIds,validateBackupPayload,parseJson,parseImportJson,actionAttrs,actionArgs,splitLegacyArgs,invokeLegacy};
  root.erpSecurity=api;root.erpAction=actionAttrs;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
