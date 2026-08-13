/* Recruit ERP shared-folder master storage (company local mode only). */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpSharedStorage=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const VERSION='1.0-preview';
  const BASE_URL='http://127.0.0.1:17840';
  const FORMAT='recruit-erp-shared-storage';
  const SCHEMA_VERSION=1;
  const MAX_REQUEST_BYTES=50*1024*1024;
  const MAX_TREE_DEPTH=12;
  const MAX_TREE_NODES=500000;
  const MAX_STRING_LENGTH=200000;
  const REQUEST_TIMEOUT_MS=30000;
  const BLOCKED_KEYS=new Set(['__proto__','prototype','constructor']);
  const EXCLUDED_FIELD_KEYS=new Set(['residentnumber','password','passphrase','apikey','encryptionkey','accesstoken','refreshtoken','authtoken','sessiontoken','token','secret','filesystemhandle','supabasesession']);
  const SNAPSHOT_KEYS=new Set(['format','schemaVersion','revision','savedAt','datasets']);
  const ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  const RESIDENT_NUMBER_PATTERN=/(?:^|\D)\d{6}-?\d{7}(?:\D|$)/;
  const DATASETS=Object.freeze({
    applicants:{storageKey:'recruit_erp_applicants_stable',kind:'array',idField:'id',requireId:true,maxRows:100000,label:'지원자'},
    hireWaitingProfiles:{storageKey:'recruit_erp_hire_waiting_profiles',kind:'array',idField:'applicantId',requireId:true,maxRows:50000,label:'입사대기'},
    employees:{storageKey:'recruit_erp_employees',kind:'array',idField:'id',requireId:true,maxRows:100000,label:'사원'},
    schools:{storageKey:'recruit_erp_schools',kind:'array',idField:'id',requireId:true,maxRows:20000,label:'학교'},
    calendarEvents:{storageKey:'recruit_erp_calendar_events',kind:'array',idField:'id',requireId:true,maxRows:100000,label:'일정'},
    messageTemplates:{storageKey:'recruit_erp_message_templates',kind:'array',idField:'id',requireId:true,maxRows:10000,label:'안내문'},
    interviewSessions:{storageKey:'recruit_erp_interview_sessions_v1',kind:'array',idField:'id',requireId:true,maxRows:50000,label:'면접'},
    applicantManagerAssignments:{storageKey:'recruit_erp_applicant_manager_assignments',kind:'object',maxRows:100000,label:'담당자 배정'},
    auditLogs:{storageKey:'recruit_erp_audit_logs_v1',kind:'array',idField:'client_event_id',requireId:false,maxRows:100000,label:'변경 이력'},
    sensitiveExportLog:{storageKey:'recruit_erp_sensitive_export_log',kind:'array',idField:'recordId',requireId:false,maxRows:1000,label:'개인정보 내보내기 기록'},
    savedAdvancedSearches:{storageKey:'recruit_erp_saved_advanced_searches',kind:'array',idField:'id',requireId:false,maxRows:1000,label:'저장 검색'},
    schoolWorkforceSavedViews:{storageKey:'recruit_erp_school_workforce_saved_views_v1',kind:'array',idField:'id',requireId:false,maxRows:1000,label:'학교 분석조건'}
  });
  const DATASET_NAMES=Object.freeze(Object.keys(DATASETS));
  const STORAGE_KEY_TO_DATASET=Object.freeze(Object.fromEntries(DATASET_NAMES.map(name=>[DATASETS[name].storageKey,name])));
  const DEFAULT_STATE=Object.freeze({phase:'idle',connected:false,masterExists:false,revision:0,savedAt:'',schemaVersion:null,fileSize:0,datasetCounts:{},backupWarning:false,errorCode:'',message:''});
  let bridgeToken='';
  let state={...DEFAULT_STATE};
  let saveTimer=0;
  let savePromise=null;
  let saveAgain=false;
  let applying=false;
  let failureNotified=false;

  function isPlainObject(value){
    if(!value||Object.prototype.toString.call(value)!=='[object Object]')return false;
    const prototype=Object.getPrototypeOf(value);
    return prototype===Object.prototype||prototype===null;
  }
  function codedError(code){return Object.assign(new Error(code),{code});}
  function byteLength(value){const text=String(value??'');return typeof TextEncoder==='function'?new TextEncoder().encode(text).length:unescape(encodeURIComponent(text)).length;}
  function assertOnlyKeys(value,allowed,code){for(const key of Object.keys(value))if(!allowed.has(key))throw codedError(code);}
  function assertSafeTree(value,depth=0,tracker={nodes:0}){
    if(depth>MAX_TREE_DEPTH)throw codedError('SNAPSHOT_TOO_DEEP');
    tracker.nodes+=1;if(tracker.nodes>MAX_TREE_NODES)throw codedError('SNAPSHOT_TOO_LARGE');
    if(value===null||typeof value==='boolean')return true;
    if(typeof value==='number'){if(!Number.isFinite(value))throw codedError('INVALID_SNAPSHOT_VALUE');return true;}
    if(typeof value==='string'){if(value.length>MAX_STRING_LENGTH)throw codedError('SNAPSHOT_STRING_TOO_LONG');return true;}
    if(Array.isArray(value)){value.forEach(item=>assertSafeTree(item,depth+1,tracker));return true;}
    if(!isPlainObject(value))throw codedError('INVALID_SNAPSHOT_OBJECT');
    for(const key of Object.keys(value)){
      if(key.length>128||BLOCKED_KEYS.has(key))throw codedError('UNSAFE_SNAPSHOT_KEY');
      if(EXCLUDED_FIELD_KEYS.has(key.toLowerCase()))throw codedError('EXCLUDED_SNAPSHOT_FIELD');
      assertSafeTree(value[key],depth+1,tracker);
    }
    return true;
  }
  function validateDataset(name,value){
    const definition=DATASETS[name];if(!definition)throw codedError('UNKNOWN_DATASET');
    if(definition.kind==='object'){
      if(!isPlainObject(value))throw codedError('INVALID_DATASET');
      const entries=Object.entries(value);if(entries.length>definition.maxRows)throw codedError('DATASET_ROW_LIMIT');
      for(const [id,item] of entries){if(!ID_PATTERN.test(id))throw codedError('UNSAFE_ROW_ID');if(typeof item!=='string'&&item!==null&&!isPlainObject(item)&&!Array.isArray(item))throw codedError('INVALID_DATASET');}
      return true;
    }
    if(!Array.isArray(value))throw codedError('INVALID_DATASET');
    if(value.length>definition.maxRows)throw codedError('DATASET_ROW_LIMIT');
    const seen=new Set();
    for(const row of value){
      if(!isPlainObject(row))throw codedError('INVALID_DATASET_ROW');
      const raw=row[definition.idField];
      if(raw===undefined||raw===null||raw===''){if(definition.requireId)throw codedError('MISSING_ROW_ID');continue;}
      const id=String(raw);if(!ID_PATTERN.test(id))throw codedError('UNSAFE_ROW_ID');if(seen.has(id))throw codedError('DUPLICATE_ROW_ID');seen.add(id);
    }
    return true;
  }
  function validateDatasets(datasets){
    if(!isPlainObject(datasets))throw codedError('INVALID_DATASETS');
    assertOnlyKeys(datasets,new Set(DATASET_NAMES),'UNKNOWN_DATASET');
    DATASET_NAMES.forEach(name=>{if(!Object.prototype.hasOwnProperty.call(datasets,name))throw codedError('MISSING_DATASET');validateDataset(name,datasets[name]);});
    return true;
  }
  function validateSnapshot(snapshot){
    if(!isPlainObject(snapshot))throw codedError('INVALID_SNAPSHOT');
    assertOnlyKeys(snapshot,SNAPSHOT_KEYS,'UNKNOWN_SNAPSHOT_FIELD');
    SNAPSHOT_KEYS.forEach(key=>{if(!Object.prototype.hasOwnProperty.call(snapshot,key))throw codedError('MISSING_SNAPSHOT_FIELD');});
    if(snapshot.format!==FORMAT)throw codedError('INVALID_SNAPSHOT_FORMAT');
    if(snapshot.schemaVersion!==SCHEMA_VERSION)throw codedError('UNSUPPORTED_SCHEMA_VERSION');
    if(!Number.isSafeInteger(snapshot.revision)||snapshot.revision<1)throw codedError('INVALID_REVISION');
    if(typeof snapshot.savedAt!=='string'||Number.isNaN(Date.parse(snapshot.savedAt)))throw codedError('INVALID_SAVED_AT');
    assertSafeTree(snapshot);validateDatasets(snapshot.datasets);
    const serialized=JSON.stringify(snapshot);if(byteLength(serialized)>MAX_REQUEST_BYTES)throw codedError('SNAPSHOT_TOO_LARGE');
    if(RESIDENT_NUMBER_PATTERN.test(serialized))throw codedError('RESIDENT_NUMBER_BLOCKED');
    return true;
  }
  function stripResidentNumbers(value,depth=0){
    if(depth>MAX_TREE_DEPTH)throw codedError('SNAPSHOT_TOO_DEEP');
    if(Array.isArray(value))return value.map(item=>stripResidentNumbers(item,depth+1));
    if(isPlainObject(value)){
      const result={};
      for(const [key,item] of Object.entries(value)){
        if(BLOCKED_KEYS.has(key))throw codedError('UNSAFE_SNAPSHOT_KEY');
        if(EXCLUDED_FIELD_KEYS.has(key.toLowerCase()))continue;
        result[key]=stripResidentNumbers(item,depth+1);
      }
      return result;
    }
    return value;
  }
  function emptyFor(definition){return definition.kind==='object'?{}:[];}
  function parseLocalDataset(name,localStorageImpl=root.localStorage){
    const definition=DATASETS[name];
    const raw=localStorageImpl?.getItem?.(definition.storageKey);
    if(raw===null||raw===undefined||raw==='')return emptyFor(definition);
    let value;
    try{value=root.erpSecurity?.parseJson?root.erpSecurity.parseJson(raw):JSON.parse(raw);}catch{throw codedError('LOCAL_DATA_INVALID');}
    value=stripResidentNumbers(value);assertSafeTree(value);validateDataset(name,value);return value;
  }
  function collectDatasets(localStorageImpl=root.localStorage){
    const datasets=Object.fromEntries(DATASET_NAMES.map(name=>[name,parseLocalDataset(name,localStorageImpl)]));
    validateDatasets(datasets);
    const serialized=JSON.stringify(datasets);
    if(RESIDENT_NUMBER_PATTERN.test(serialized))throw codedError('RESIDENT_NUMBER_BLOCKED');
    if(byteLength(serialized)>MAX_REQUEST_BYTES)throw codedError('SNAPSHOT_TOO_LARGE');
    return datasets;
  }
  function datasetCounts(datasets){return Object.fromEntries(DATASET_NAMES.map(name=>[name,Array.isArray(datasets[name])?datasets[name].length:Object.keys(datasets[name]||{}).length]));}
  function primaryLocalCounts(localStorageImpl=root.localStorage){
    const names=['applicants','hireWaitingProfiles','employees','schools','calendarEvents'];
    const counts=Object.fromEntries(names.map(name=>{let count=0;try{const value=parseLocalDataset(name,localStorageImpl);count=Array.isArray(value)?value.length:Object.keys(value).length;}catch{}return [name,count];}));
    return {...counts,total:Object.values(counts).reduce((sum,count)=>sum+count,0)};
  }
  function hasLocalBusinessData(localStorageImpl=root.localStorage){
    return DATASET_NAMES.some(name=>{try{const value=parseLocalDataset(name,localStorageImpl);return Array.isArray(value)?value.length>0:Object.keys(value).length>0;}catch{return true;}});
  }
  function isCompanyMode(){
    try{return typeof root.uxGetOperationEnvironment==='function'?root.uxGetOperationEnvironment()==='company':root.localStorage?.getItem?.('recruit_erp_ui_operation_environment')==='company';}catch{return false;}
  }
  function publicState(){return {...state,datasetCounts:{...(state.datasetCounts||{})}};}
  function updateState(next){
    state={...state,...next};
    try{root.document?.dispatchEvent?.(new root.CustomEvent('erp:shared-storage-state',{detail:publicState()}));}catch{}
    try{root.erpStoragePerformance?.render?.();}catch{}
    try{root.updateStorageNote?.();}catch{}
    return publicState();
  }
  function friendlyMessage(code){
    const messages={
      REVISION_CONFLICT:'다른 PC에서 ERP 데이터가 변경되었습니다. 최신 데이터를 다시 불러온 후 저장해주세요.',
      STORAGE_LOCKED:'다른 PC가 공용 ERP 데이터를 저장하고 있습니다. 잠시 후 다시 시도해주세요.',
      NOT_INITIALIZED:'공용 ERP 저장소가 아직 만들어지지 않았습니다.',
      UNSUPPORTED_SCHEMA_VERSION:'지원하지 않는 공용 ERP 데이터 버전입니다.',
      INVALID_MASTER:'공용 ERP 데이터 파일을 안전하게 읽을 수 없습니다.',
      RESIDENT_NUMBER_BLOCKED:'주민등록번호 형태의 값이 있어 공용폴더 저장을 차단했습니다.',
      TOKEN_REQUIRED:'ERP Bridge 연결 세션이 만료되었습니다.',
      CONNECTION_FAILED:'ERP Bridge 실행 또는 공용폴더 연결을 확인해주세요.'
    };
    return messages[code]||'공용 ERP 저장소를 처리하지 못했습니다. Bridge와 공용폴더 연결을 확인해주세요.';
  }
  async function bridgeRequest(pathname,{method='GET',body,fetchImpl=root.fetch,timeoutMs=REQUEST_TIMEOUT_MS,requireToken=true}={}){
    const url=`${BASE_URL}${pathname}`;
    if(!url.startsWith(`${BASE_URL}/`)||typeof fetchImpl!=='function')throw codedError('CONNECTION_FAILED');
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=root.setTimeout?.(()=>controller?.abort(),timeoutMs);
    try{
      const headers={Accept:'application/json'};
      if(requireToken){if(!bridgeToken)throw codedError('TOKEN_REQUIRED');headers['X-ERP-Bridge-Token']=bridgeToken;}
      const options={method,mode:'cors',cache:'no-store',credentials:'omit',headers,signal:controller?.signal};
      if(body!==undefined){headers['Content-Type']='application/json';const serialized=JSON.stringify(body);if(byteLength(serialized)>MAX_REQUEST_BYTES)throw codedError('SNAPSHOT_TOO_LARGE');options.body=serialized;}
      const response=await fetchImpl(url,options);let payload={};try{payload=await response.json();}catch{}
      if(!response.ok){const error=codedError(String(payload?.code||`HTTP_${response.status}`));error.status=response.status;error.currentRevision=payload?.currentRevision;throw error;}
      return payload;
    }catch(error){
      if(error?.code)throw error;
      throw codedError(controller?.signal?.aborted?'REQUEST_TIMEOUT':'CONNECTION_FAILED');
    }finally{if(timer!==undefined)root.clearTimeout?.(timer);}
  }
  async function openBridgeSession(options={}){
    const health=await bridgeRequest('/health',{...options,requireToken:false});
    if(health?.ok!==true||health?.service!=='Recruit ERP Bridge'||health?.version!==VERSION||typeof health?.bridgeToken!=='string'||health.bridgeToken.length<32)throw codedError('INVALID_BRIDGE_RESPONSE');
    bridgeToken=health.bridgeToken;return health;
  }
  async function getStatus(options={}){return bridgeRequest('/storage/status',options);}
  async function fetchSnapshot(options={}){const result=await bridgeRequest('/storage/snapshot',options);validateSnapshot(result.snapshot);return result.snapshot;}
  function stageSnapshot(snapshot){
    validateSnapshot(snapshot);
    const staged={};
    DATASET_NAMES.forEach(name=>{const value=stripResidentNumbers(snapshot.datasets[name]);validateDataset(name,value);staged[name]=JSON.stringify(value);});
    const combined=JSON.stringify(staged);if(RESIDENT_NUMBER_PATTERN.test(combined))throw codedError('RESIDENT_NUMBER_BLOCKED');return staged;
  }
  function refreshRuntimeFromCache(){
    try{if(typeof applicants!=='undefined')applicants=JSON.parse(root.localStorage.getItem(DATASETS.applicants.storageKey)||'[]');}catch{}
    try{if(typeof hireWaitingProfiles!=='undefined')hireWaitingProfiles=JSON.parse(root.localStorage.getItem(DATASETS.hireWaitingProfiles.storageKey)||'[]');}catch{}
    try{if(typeof employees!=='undefined')employees=JSON.parse(root.localStorage.getItem(DATASETS.employees.storageKey)||'[]');}catch{}
    try{if(typeof schools!=='undefined')schools=JSON.parse(root.localStorage.getItem(DATASETS.schools.storageKey)||'[]');}catch{}
    try{if(typeof calendarEvents!=='undefined')calendarEvents=JSON.parse(root.localStorage.getItem(DATASETS.calendarEvents.storageKey)||'[]');}catch{}
    try{if(typeof messageTemplates!=='undefined')messageTemplates=JSON.parse(root.localStorage.getItem(DATASETS.messageTemplates.storageKey)||'[]');}catch{}
    try{root.renderAll?.();root.renderCalendar?.();root.renderMessageTemplateList?.();}catch{}
  }
  function writeCache(key,value){
    if(typeof root.safeLocalStorageSet==='function')return root.safeLocalStorageSet(key,value,{notify:false});
    try{root.localStorage.setItem(key,value);return true;}catch{return false;}
  }
  function applySnapshot(snapshot,{refresh=true}={}){
    const staged=stageSnapshot(snapshot);const before={};const written=[];applying=true;
    try{
      for(const name of DATASET_NAMES){
        const key=DATASETS[name].storageKey;before[key]=root.localStorage?.getItem?.(key);
        if(!writeCache(key,staged[name]))throw codedError('CACHE_WRITE_FAILED');written.push(key);
      }
    }catch(error){
      for(const key of written.reverse())try{if(before[key]===null||before[key]===undefined)root.localStorage.removeItem(key);else root.localStorage.setItem(key,before[key]);}catch{}
      throw error;
    }finally{applying=false;}
    if(refresh)refreshRuntimeFromCache();
    updateState({phase:'ready',connected:true,masterExists:true,revision:snapshot.revision,savedAt:snapshot.savedAt,schemaVersion:snapshot.schemaVersion,datasetCounts:datasetCounts(snapshot.datasets),errorCode:'',message:'공용 ERP 저장소 정상'});
    return true;
  }
  async function connect({fetchImpl=root.fetch,autoApplyEmpty=true}={}){
    if(!isCompanyMode()){bridgeToken='';return updateState({...DEFAULT_STATE,phase:'disabled',message:'회사 로컬 모드에서 사용합니다.'});}
    updateState({phase:'connecting',connected:false,message:'공용 ERP 저장소 연결 확인 중'});
    try{
      await openBridgeSession({fetchImpl});const status=await getStatus({fetchImpl});
      const base={connected:true,masterExists:!!status.masterExists,revision:Number(status.revision)||0,savedAt:status.savedAt||'',schemaVersion:status.schemaVersion??null,fileSize:Number(status.fileSize)||0,datasetCounts:status.datasetCounts||{},errorCode:''};
      if(!status.masterExists)return updateState({...base,phase:'empty',message:'공용 ERP 저장소가 비어 있습니다.'});
      const snapshot=await fetchSnapshot({fetchImpl});
      if(autoApplyEmpty&&!hasLocalBusinessData()){applySnapshot(snapshot);return publicState();}
      return updateState({...base,phase:'needs-confirmation',message:'공용 ERP 저장소를 확인했습니다. 현재 PC 캐시를 바꾸기 전에 불러오기를 확인해주세요.'});
    }catch(error){bridgeToken='';return updateState({phase:'offline',connected:false,errorCode:error.code||'CONNECTION_FAILED',message:friendlyMessage(error.code)});}
  }
  async function loadLatest(options={}){
    if(!isCompanyMode())return false;
    try{if(!bridgeToken)await openBridgeSession(options);const snapshot=await fetchSnapshot(options);applySnapshot(snapshot);return true;}
    catch(error){updateState({phase:'error',errorCode:error.code||'CONNECTION_FAILED',message:friendlyMessage(error.code)});return false;}
  }
  function canManage(){return root.erpPermissions?.has?.('storage.manage')!==false&&root.erpPermissions?.require?.('storage.manage')!==false;}
  async function initialize(options={}){
    if(!isCompanyMode()||!canManage())return false;
    try{
      if(!bridgeToken)await openBridgeSession(options);const datasets=collectDatasets();
      updateState({phase:'saving',message:'공용 ERP 저장소 생성 중'});
      const result=await bridgeRequest('/storage/initialize',{...options,method:'POST',body:{datasets}});
      const snapshot=result.snapshot;validateSnapshot(snapshot);
      failureNotified=false;updateState({phase:'ready',connected:true,masterExists:true,revision:snapshot.revision,savedAt:snapshot.savedAt,schemaVersion:snapshot.schemaVersion,fileSize:Number(result.fileSize)||0,datasetCounts:result.datasetCounts||datasetCounts(datasets),errorCode:'',message:'공용 ERP 저장소 생성 완료'});
      root.alert?.('✅ 공용 ERP 저장소 생성 완료');return true;
    }catch(error){updateState({phase:'error',errorCode:error.code||'CONNECTION_FAILED',message:friendlyMessage(error.code)});root.alert?.(`⚠ ${friendlyMessage(error.code)}`);return false;}
  }
  async function saveNow({fetchImpl=root.fetch,notify=true}={}){
    if(!isCompanyMode()||applying)return false;
    if(savePromise){saveAgain=true;return savePromise;}
    savePromise=(async()=>{
      try{
        if(!bridgeToken)await openBridgeSession({fetchImpl});
        let expectedRevision=state.revision;
        if(!expectedRevision){const status=await getStatus({fetchImpl});if(!status.masterExists)throw codedError('NOT_INITIALIZED');expectedRevision=status.revision;}
        const datasets=collectDatasets();updateState({phase:'saving',connected:true,message:'공용 ERP 저장소 저장 중'});
        const result=await bridgeRequest('/storage/snapshot',{method:'PUT',body:{expectedRevision,datasets},fetchImpl});
        validateSnapshot(result.snapshot);failureNotified=false;
        updateState({phase:'ready',connected:true,masterExists:true,revision:result.snapshot.revision,savedAt:result.snapshot.savedAt,schemaVersion:result.snapshot.schemaVersion,fileSize:Number(result.fileSize)||0,datasetCounts:result.datasetCounts||datasetCounts(datasets),backupWarning:!!result.backupWarning,errorCode:'',message:result.backupWarning?'저장은 완료됐지만 오래된 백업 정리를 확인해주세요.':'공용 ERP 저장소 정상'});
        return true;
      }catch(error){
        const phase=error.code==='REVISION_CONFLICT'?'conflict':'error';
        updateState({phase,connected:error.code!=='CONNECTION_FAILED',errorCode:error.code||'CONNECTION_FAILED',message:friendlyMessage(error.code)});
        if(notify&&!failureNotified){failureNotified=true;root.alert?.(`⚠ 공용폴더 저장 실패\n현재 PC의 임시 저장 데이터는 남아 있습니다.\n${friendlyMessage(error.code)}`);}return false;
      }finally{
        savePromise=null;
        if(saveAgain){saveAgain=false;root.setTimeout?.(()=>saveNow({fetchImpl,notify}),100);}
      }
    })();
    return savePromise;
  }
  function scheduleSave(event){
    if(applying||!isCompanyMode()||!STORAGE_KEY_TO_DATASET[event?.detail?.key])return false;
    root.clearTimeout?.(saveTimer);updateState({phase:state.masterExists?'pending':state.phase,message:state.masterExists?'공용 ERP 저장 대기 중':state.message});
    saveTimer=root.setTimeout?.(()=>saveNow(),450)||0;return true;
  }
  async function retry(){
    const queued=state.phase==='error'&&state.masterExists;const previousRevision=state.revision;
    const connected=await connect({autoApplyEmpty:false});
    if(!connected.connected)return false;
    if(queued&&connected.revision===previousRevision){failureNotified=false;return saveNow();}
    if(queued&&connected.masterExists&&connected.revision!==previousRevision)return updateState({...connected,phase:'conflict',message:friendlyMessage('REVISION_CONFLICT')});
    return true;
  }
  function statusNote(){
    const phase=state.phase;
    if(phase==='ready')return {title:'공용 ERP 저장소 정상',description:`마지막 저장: ${new Date(state.savedAt).toLocaleString('ko-KR')}`,badge:'SHARED OK',className:'sync-ok-note'};
    if(phase==='saving'||phase==='pending'||phase==='connecting')return {title:'공용 ERP 저장 중',description:'공용폴더 저장 상태를 확인하고 있습니다.',badge:'SHARED SAVING',className:'sync-progress-note'};
    if(phase==='conflict')return {title:'다른 PC에서 데이터 변경됨',description:friendlyMessage('REVISION_CONFLICT'),badge:'SHARED CONFLICT',className:'sync-warn-note'};
    if(phase==='empty')return {title:'공용 ERP 저장소가 비어 있음',description:'현재 데이터로 시작하려면 저장소·속도 화면에서 초기화하세요.',badge:'SHARED EMPTY',className:'sync-warn-note'};
    return {title:'ERP 공용 저장소 연결 안됨',description:state.message||'Bridge 실행과 공용폴더 연결을 확인해주세요.',badge:'SHARED WARN',className:'sync-warn-note'};
  }
  function init(){
    if(!root.document)return;
    root.document.addEventListener('erp:storage-write',scheduleSave);
    root.document.addEventListener('erp:operation-environment-change',()=>{bridgeToken='';root.clearTimeout?.(saveTimer);connect({autoApplyEmpty:true});});
    root.document.addEventListener('erp:permission-change',()=>updateState({}));
    root.addEventListener?.('pagehide',()=>{bridgeToken='';});
    root.setTimeout?.(()=>connect({autoApplyEmpty:true}),0);
  }
  const api={VERSION,BASE_URL,FORMAT,SCHEMA_VERSION,MAX_REQUEST_BYTES,MAX_TREE_DEPTH,MAX_TREE_NODES,MAX_STRING_LENGTH,REQUEST_TIMEOUT_MS,BLOCKED_KEYS,EXCLUDED_FIELD_KEYS,SNAPSHOT_KEYS,ID_PATTERN,RESIDENT_NUMBER_PATTERN,DATASETS,DATASET_NAMES,STORAGE_KEY_TO_DATASET,isPlainObject,assertSafeTree,validateDataset,validateDatasets,validateSnapshot,stripResidentNumbers,parseLocalDataset,collectDatasets,datasetCounts,primaryLocalCounts,hasLocalBusinessData,isCompanyMode,publicState,friendlyMessage,bridgeRequest,openBridgeSession,getStatus,fetchSnapshot,stageSnapshot,applySnapshot,connect,loadLatest,initialize,saveNow,scheduleSave,retry,statusNote,init};
  if(root.document)init();
  return api;
});
