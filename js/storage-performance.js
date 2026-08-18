/* Recruit ERP v11.0.0 storage capacity and IndexedDB safety mirror. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpStoragePerformance=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const VERSION='11.0.0';
  const DB_NAME='recruit-erp-storage-v10-61';
  const DB_VERSION=1;
  const DATASET_STORE='datasets';
  const SNAPSHOT_STORE='snapshots';
  const SNAPSHOT_META_STORE='snapshotMeta';
  const MAX_SNAPSHOTS=5;
  const LOCAL_WARNING_BYTES=4*1024*1024;
  const LOW_REMAINING_BYTES=5*1024*1024;
  const BRIDGE_HEALTH_URL='http://127.0.0.1:17840/health';
  const BRIDGE_SHARED_FOLDER_TEST_URL='http://127.0.0.1:17840/shared-folder-test';
  const BRIDGE_SERVICE='Recruit ERP Bridge';
  const BRIDGE_VERSION='1.0-preview';
  const BRIDGE_TIMEOUT_MS=15000;
  const DATASETS=[
    {key:'recruit_erp_applicants_stable',label:'지원자'},
    {key:'recruit_erp_employees',label:'사원'},
    {key:'recruit_erp_schools',label:'협력학교'},
    {key:'recruit_erp_calendar_events',label:'일정'},
    {key:'recruit_erp_hire_waiting_profiles',label:'입사대기자'},
    {key:'recruit_erp_message_templates',label:'안내문 템플릿'}
  ];
  let dbPromise=null;
  const refreshTimers=new Map();
  let lastStatus={supported:false,lastMirroredAt:'',error:''};
  let lastBridgeResult=null;
  let bridgeTestBusy=false;
  let lastSharedFolderResult=null;
  let sharedFolderTestBusy=false;

  async function probeLocalBridge(fetchImpl=root.fetch){
    if(typeof fetchImpl!=='function')return {ok:false,code:'unsupported'};
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=root.setTimeout?.(()=>controller?.abort(),BRIDGE_TIMEOUT_MS);
    try{
      const response=await fetchImpl(BRIDGE_HEALTH_URL,{
        method:'GET',
        mode:'cors',
        cache:'no-store',
        credentials:'omit',
        headers:{Accept:'application/json'},
        signal:controller?.signal
      });
      if(!response?.ok)return {ok:false,code:'http-error'};
      const body=await response.json();
      const ok=body?.ok===true&&body?.service===BRIDGE_SERVICE&&body?.version===BRIDGE_VERSION;
      return {ok,code:ok?'ok':'invalid-response'};
    }catch{
      return {ok:false,code:controller?.signal.aborted?'timeout':'connection-failed'};
    }finally{
      if(timer!==undefined)root.clearTimeout?.(timer);
    }
  }
  async function probeSharedFolderBridge(fetchImpl=root.fetch){
    if(typeof fetchImpl!=='function')return {ok:false,code:'unsupported',steps:{}};
    const controller=typeof AbortController==='function'?new AbortController():null;
    const timer=root.setTimeout?.(()=>controller?.abort(),BRIDGE_TIMEOUT_MS);
    try{
      const healthResponse=await fetchImpl(BRIDGE_HEALTH_URL,{
        method:'GET',mode:'cors',cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:controller?.signal
      });
      const health=healthResponse?.ok?await healthResponse.json():null;
      if(!health?.bridgeToken)return {ok:false,code:'token-required',steps:{}};
      const response=await fetchImpl(BRIDGE_SHARED_FOLDER_TEST_URL,{
        method:'POST',
        mode:'cors',
        cache:'no-store',
        credentials:'omit',
        headers:{Accept:'application/json','X-ERP-Bridge-Token':health.bridgeToken},
        signal:controller?.signal
      });
      if(!response?.ok)return {ok:false,code:response?.status===409?'test-in-progress':'http-error',steps:{}};
      const body=await response.json();
      if(body?.service!==BRIDGE_SERVICE||body?.version!==BRIDGE_VERSION)return {ok:false,code:'invalid-response',steps:{}};
      const steps=['access','create','write','read','verify','delete'].reduce((result,key)=>({...result,[key]:body?.steps?.[key]===true}),{});
      if(body.ok===true){
        const ok=body.testSizeBytes===100*1024&&Object.values(steps).every(Boolean);
        return {ok,code:ok?'ok':'invalid-response',testSizeBytes:Number(body.testSizeBytes)||0,steps};
      }
      return {ok:false,code:String(body?.code||'shared-folder-test-failed'),testSizeBytes:Number(body?.testSizeBytes)||0,steps};
    }catch{
      return {ok:false,code:controller?.signal.aborted?'timeout':'connection-failed',steps:{}};
    }finally{
      if(timer!==undefined)root.clearTimeout?.(timer);
    }
  }
  function bridgeResultHtml(){
    if(bridgeTestBusy)return '<div class="bridge-test-result is-running" id="bridgeTestResult" role="status" aria-live="polite"><strong>ERP Bridge 연결 확인 중…</strong><span>이 PC의 127.0.0.1:17840 상태만 확인합니다.</span></div>';
    if(!lastBridgeResult)return '<div class="bridge-test-result" id="bridgeTestResult" role="status" aria-live="polite"><strong>아직 테스트하지 않았습니다.</strong><span>먼저 회사 PC에서 ERP Bridge를 실행하세요.</span></div>';
    if(lastBridgeResult.ok)return '<div class="bridge-test-result is-success" id="bridgeTestResult" role="status" aria-live="polite"><strong>✅ ERP Bridge 연결 성공</strong><span>이 PC에서는 로컬 저장 프로그램과 ERP 통신이 가능합니다.</span></div>';
    return '<div class="bridge-test-result is-failure" id="bridgeTestResult" role="alert" aria-live="assertive"><strong>❌ ERP Bridge 연결 실패</strong><span>브라우저 또는 회사 보안정책에 의해 로컬 통신이 차단되었을 수 있습니다.</span></div>';
  }
  async function runLocalBridgeTest(){
    if(!root.erpPermissions?.require?.('storage.manage'))return false;
    if(bridgeTestBusy)return false;
    bridgeTestBusy=true;
    const button=root.document?.getElementById('btnLocalBridgeTest');
    const resultHost=root.document?.getElementById('bridgeTestResult');
    if(button){button.disabled=true;button.textContent='테스트 중…';}
    if(resultHost){resultHost.className='bridge-test-result is-running';resultHost.setAttribute('role','status');resultHost.innerHTML='<strong>ERP Bridge 연결 확인 중…</strong><span>이 PC의 127.0.0.1:17840 상태만 확인합니다.</span>';}
    lastBridgeResult=await probeLocalBridge();
    bridgeTestBusy=false;
    await render();
    return lastBridgeResult.ok;
  }
  function sharedFolderResultHtml(){
    if(sharedFolderTestBusy)return '<div class="bridge-test-result is-running" id="sharedFolderTestResult" role="status" aria-live="polite"><strong>공용폴더 읽기/쓰기 확인 중…</strong><span>약 100KB 가상 테스트 파일을 쓰고, 읽고, 검증한 뒤 삭제합니다.</span></div>';
    if(!lastSharedFolderResult)return '<div class="bridge-test-result" id="sharedFolderTestResult" role="status" aria-live="polite"><strong>아직 테스트하지 않았습니다.</strong><span>RecruitERP_TEST 경로를 인자로 지정해 새 Bridge를 실행하세요.</span></div>';
    if(lastSharedFolderResult.ok){
      const steps=lastSharedFolderResult.steps||{};
      return `<div class="bridge-test-result is-success" id="sharedFolderTestResult" role="status" aria-live="polite"><strong>✅ 공용폴더 읽기/쓰기 성공</strong><span>지원팀 공용폴더를 ERP 데이터 저장소로 사용할 수 있습니다.</span><dl class="bridge-test-steps"><div><dt>테스트 크기</dt><dd>100KB</dd></div><div><dt>쓰기</dt><dd>${steps.write?'성공':'실패'}</dd></div><div><dt>읽기</dt><dd>${steps.read?'성공':'실패'}</dd></div><div><dt>검증</dt><dd>${steps.verify?'성공':'실패'}</dd></div><div><dt>삭제</dt><dd>${steps.delete?'성공':'실패'}</dd></div></dl></div>`;
    }
    const titles={
      FOLDER_ACCESS_FAILED:'❌ 공용폴더 접근 실패',
      FILE_CREATE_DENIED:'❌ 파일 생성 권한 없음',
      FILE_CREATE_FAILED:'❌ 파일 생성 실패',
      FILE_WRITE_FAILED:'❌ 파일 쓰기 실패',
      FILE_READ_FAILED:'❌ 파일 읽기 실패',
      FILE_VERIFY_FAILED:'❌ 파일 검증 실패',
      FILE_DELETE_DENIED:'❌ 파일 삭제 권한 없음',
      FILE_DELETE_FAILED:'❌ 파일 삭제 실패',
      FILE_DELETE_VERIFY_FAILED:'❌ 파일 삭제 확인 실패'
    };
    const connectionCodes=['unsupported','http-error','invalid-response','timeout','connection-failed','test-in-progress'];
    const title=connectionCodes.includes(lastSharedFolderResult.code)?'❌ ERP Bridge 연결 실패':(titles[lastSharedFolderResult.code]||'❌ 공용폴더 테스트 실패');
    const message=connectionCodes.includes(lastSharedFolderResult.code)?'Bridge 실행 상태와 회사 브라우저 보안정책을 확인하세요.':'Bridge 실행 창에서 해당 단계의 Windows 오류를 확인하세요.';
    return `<div class="bridge-test-result is-failure" id="sharedFolderTestResult" role="alert" aria-live="assertive"><strong>${title}</strong><span>${message}</span></div>`;
  }
  async function runSharedFolderBridgeTest(){
    if(!root.erpPermissions?.require?.('storage.manage'))return false;
    if(sharedFolderTestBusy)return false;
    sharedFolderTestBusy=true;
    const button=root.document?.getElementById('btnSharedFolderTest');
    const resultHost=root.document?.getElementById('sharedFolderTestResult');
    if(button){button.disabled=true;button.textContent='테스트 중…';}
    if(resultHost){resultHost.className='bridge-test-result is-running';resultHost.setAttribute('role','status');resultHost.innerHTML='<strong>공용폴더 읽기/쓰기 확인 중…</strong><span>약 100KB 가상 테스트 파일을 쓰고, 읽고, 검증한 뒤 삭제합니다.</span>';}
    lastSharedFolderResult=await probeSharedFolderBridge();
    sharedFolderTestBusy=false;
    await render();
    return lastSharedFolderResult.ok;
  }

  function byteLength(value){
    const text=typeof value==='string'?value:JSON.stringify(value??null);
    if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text).byteLength;
    if(typeof Buffer!=='undefined')return Buffer.byteLength(text,'utf8');
    return unescape(encodeURIComponent(text)).length;
  }
  function formatBytes(bytes){
    const value=Math.max(0,Number(bytes)||0);
    if(value<1024)return `${value} B`;
    if(value<1024*1024)return `${(value/1024).toFixed(1)} KB`;
    if(value<1024*1024*1024)return `${(value/1024/1024).toFixed(1)} MB`;
    return `${(value/1024/1024/1024).toFixed(2)} GB`;
  }
  function shouldWarn({localBytes=0,usage=0,quota=0}={}){
    const remaining=quota>0?quota-usage:Infinity;
    return localBytes>=LOCAL_WARNING_BYTES||(quota>0&&usage/quota>=0.8)||remaining<LOW_REMAINING_BYTES;
  }
  function datasetSummary(rows,label=''){
    const safeRows=Array.isArray(rows)?rows:[];
    return {label,count:safeRows.length,bytes:byteLength(safeRows)};
  }
  function safeParseDataset(raw,dataset){
    const parsed=root.erpSecurity?.parseJson?root.erpSecurity.parseJson(raw):JSON.parse(raw);
    if(!Array.isArray(parsed))throw new Error('INVALID_DATASET');
    root.erpSecurity?.assertSafeTree?.(parsed);
    root.erpSecurity?.validateRowIds?.(parsed,{requireId:false});
    return {key:dataset.key,label:dataset.label,rows:parsed,count:parsed.length,bytes:byteLength(raw),savedAt:new Date().toISOString()};
  }
  function openDb(){
    if(dbPromise)return dbPromise;
    if(!root.indexedDB)return Promise.reject(new Error('INDEXEDDB_UNAVAILABLE'));
    dbPromise=new Promise((resolve,reject)=>{
      const request=root.indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(DATASET_STORE))db.createObjectStore(DATASET_STORE,{keyPath:'key'});
        if(!db.objectStoreNames.contains(SNAPSHOT_STORE)){
          const store=db.createObjectStore(SNAPSHOT_STORE,{keyPath:'id'});
          store.createIndex('createdAt','createdAt');
        }
        if(!db.objectStoreNames.contains(SNAPSHOT_META_STORE))db.createObjectStore(SNAPSHOT_META_STORE,{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(new Error('INDEXEDDB_OPEN_FAILED'));
      request.onblocked=()=>reject(new Error('INDEXEDDB_BLOCKED'));
    }).catch(error=>{dbPromise=null;throw error;});
    return dbPromise;
  }
  async function withStore(name,mode,operation){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(name,mode);
      const store=transaction.objectStore(name);
      let result;
      try{result=operation(store);}catch{reject(new Error('INDEXEDDB_OPERATION_FAILED'));return;}
      transaction.oncomplete=()=>resolve(result?.result);
      transaction.onerror=()=>reject(new Error('INDEXEDDB_TRANSACTION_FAILED'));
      transaction.onabort=()=>reject(new Error('INDEXEDDB_TRANSACTION_ABORTED'));
    });
  }
  async function mirrorDataset(dataset){
    const raw=root.localStorage?.getItem(dataset.key);
    if(raw===null)return {key:dataset.key,label:dataset.label,count:0,bytes:0,skipped:true};
    const record=safeParseDataset(raw,dataset);
    await withStore(DATASET_STORE,'readwrite',store=>store.put(record));
    return {key:record.key,label:record.label,count:record.count,bytes:record.bytes,savedAt:record.savedAt};
  }
  async function mirrorAll(){
    if(!root.indexedDB){lastStatus={supported:false,lastMirroredAt:'',error:'unsupported'};render();return [];}
    try{
      const records=[];
      for(const dataset of DATASETS)records.push(await mirrorDataset(dataset));
      lastStatus={supported:true,lastMirroredAt:new Date().toISOString(),error:''};
      render();
      return records;
    }catch{
      lastStatus={supported:true,lastMirroredAt:lastStatus.lastMirroredAt,error:'mirror_failed'};
      console.warn('IndexedDB 안전 복사 갱신 실패');
      render();
      throw new Error('안전 복사를 갱신하지 못했습니다. 저장공간과 브라우저 설정을 확인해 주세요.');
    }
  }
  async function listSnapshots(){
    if(!root.indexedDB)return [];
    const rows=await withStore(SNAPSHOT_META_STORE,'readonly',store=>store.getAll());
    return (Array.isArray(rows)?rows:[]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  async function saveSnapshot(record){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction([SNAPSHOT_STORE,SNAPSHOT_META_STORE],'readwrite');
      transaction.objectStore(SNAPSHOT_STORE).put(record);
      transaction.objectStore(SNAPSHOT_META_STORE).put({id:record.id,createdAt:record.createdAt,version:record.version,totalCount:record.totalCount,bytes:record.bytes});
      transaction.oncomplete=()=>resolve(true);
      transaction.onerror=()=>reject(new Error('INDEXEDDB_SNAPSHOT_FAILED'));
      transaction.onabort=()=>reject(new Error('INDEXEDDB_SNAPSHOT_ABORTED'));
    });
  }
  async function deleteSnapshot(id){
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction([SNAPSHOT_STORE,SNAPSHOT_META_STORE],'readwrite');
      transaction.objectStore(SNAPSHOT_STORE).delete(id);
      transaction.objectStore(SNAPSHOT_META_STORE).delete(id);
      transaction.oncomplete=()=>resolve(true);
      transaction.onerror=()=>reject(new Error('INDEXEDDB_SNAPSHOT_DELETE_FAILED'));
      transaction.onabort=()=>reject(new Error('INDEXEDDB_SNAPSHOT_DELETE_ABORTED'));
    });
  }
  async function trimSnapshots(){
    const snapshots=await listSnapshots();
    for(const snapshot of snapshots.slice(MAX_SNAPSHOTS))await deleteSnapshot(snapshot.id);
  }
  async function createSnapshot(){
    if(!root.erpPermissions?.require?.('storage.manage'))return false;
    try{
      const datasets=[];
      for(const dataset of DATASETS){
        const raw=root.localStorage?.getItem(dataset.key);
        if(raw===null){datasets.push({key:dataset.key,label:dataset.label,rows:[],count:0,bytes:0});continue;}
        datasets.push(safeParseDataset(raw,dataset));
      }
      const createdAt=new Date().toISOString();
      const record={id:`snapshot-${createdAt}-${Math.random().toString(36).slice(2,8)}`,createdAt,version:VERSION,datasets,totalCount:datasets.reduce((sum,item)=>sum+item.count,0),bytes:datasets.reduce((sum,item)=>sum+item.bytes,0)};
      await saveSnapshot(record);
      await trimSnapshots();
      await mirrorAll();
      render();
      root.alert?.('현재 데이터를 IndexedDB 안전 스냅샷으로 보관했습니다.');
      return true;
    }catch{
      console.warn('IndexedDB 안전 스냅샷 생성 실패');
      root.alert?.('안전 스냅샷을 만들지 못했습니다. ERP 데이터는 변경되지 않았습니다.');
      return false;
    }
  }
  function localUsage(){
    const rows=DATASETS.map(dataset=>{
      const raw=root.localStorage?.getItem(dataset.key)||'[]';
      let count=0;try{const value=JSON.parse(raw);count=Array.isArray(value)?value.length:0;}catch{}
      return {key:dataset.key,label:dataset.label,count,bytes:byteLength(raw)};
    });
    return {rows,bytes:rows.reduce((sum,row)=>sum+row.bytes,0)};
  }
  async function estimateStorage(){
    const local=localUsage();
    let estimate={usage:0,quota:0};
    try{estimate=await root.navigator?.storage?.estimate?.()||estimate;}catch{}
    return {localBytes:local.bytes,rows:local.rows,usage:Number(estimate.usage)||0,quota:Number(estimate.quota)||0,warning:shouldWarn({localBytes:local.bytes,usage:estimate.usage,quota:estimate.quota})};
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function formatTime(value){if(!value)return '아직 없음';const date=new Date(value);return Number.isNaN(date.getTime())?'확인 불가':date.toLocaleString('ko-KR');}
  function loadSharedStorageScript(){
    if(!root.document||root.erpSharedStorage||root.document.querySelector('script[data-erp-shared-storage]'))return;
    const script=root.document.createElement('script');script.src='js/shared-storage.js?v=11.4.1';script.dataset.erpSharedStorage='true';script.addEventListener('load',()=>render());root.document.head.appendChild(script);
  }
  function sharedStoragePanelHtml(){
    const shared=root.erpSharedStorage;const status=shared?.publicState?.()||{phase:'connecting',datasetCounts:{}};
    const local=shared?.primaryLocalCounts?.()||{applicants:0,hireWaitingProfiles:0,employees:0,schools:0,calendarEvents:0,total:0};
    const ready=status.phase==='ready';
    const tone=ready?'is-success':['error','offline','conflict'].includes(status.phase)?'is-failure':'is-running';
    const title=ready?'● 공용 ERP 연결됨':status.phase==='empty'?'공용 ERP 저장소가 비어 있습니다.':status.phase==='needs-confirmation'?'⚠ 공용 저장 승인 필요':status.phase==='conflict'?'⚠ 다른 PC에서 데이터 변경됨':status.phase==='offline'?'⚠ Bridge 실행 필요':'공용 ERP 저장소 확인 중';
    const last=status.savedAt?formatTime(status.savedAt):'아직 없음';
    const actions=[];
    if(status.phase==='empty')actions.push('<button class="primary" id="btnSharedStorageInitialize" type="button">현재 데이터로 공용 저장소 시작</button>');
    if(status.phase==='needs-confirmation'||status.phase==='conflict')actions.push('<button class="primary" id="btnSharedStorageLoad" type="button">공용 저장소 최신 데이터 불러오기</button>');
    if(['offline','error'].includes(status.phase))actions.push('<button class="primary" id="btnSharedStorageRetry" type="button">공용 저장 다시 시도</button>');
    const counts=status.phase==='empty'?local:(status.datasetCounts||{});
    const message=ready?'':(status.message||'지원팀 공용폴더 연결 상태를 확인합니다.');
    return `<div class="panel shared-storage-panel"><div class="bridge-test-result ${tone}" role="status" aria-live="polite"><strong>${escapeHtml(title)}</strong>${message?`<span>${escapeHtml(message)}</span>`:''}${ready?`<small>마지막 저장: ${escapeHtml(last)}</small>`:''}</div>${status.phase==='empty'?`<p>현재 이 PC의 ERP 데이터: 지원자 ${local.applicants||0}명 · 입사대기 ${local.hireWaitingProfiles||0}명 · 사원 ${local.employees||0}명 · 학교 ${local.schools||0}개 · 일정 ${local.calendarEvents||0}건</p>`:''}<div class="storage-actions">${actions.join('')}</div><details class="shared-storage-details"><summary>개발자 진단 정보</summary><dl class="bridge-test-steps"><div><dt>스키마</dt><dd>${escapeHtml(status.schemaVersion??'-')}</dd></div><div><dt>Revision</dt><dd>${escapeHtml(status.revision||0)}</dd></div><div><dt>파일 크기</dt><dd>${formatBytes(status.fileSize||0)}</dd></div><div><dt>업무 데이터</dt><dd>${Object.values(counts).reduce((sum,value)=>sum+(Number(value)||0),0).toLocaleString('ko-KR')}건</dd></div></dl></details></div>`;
  }
  function renderSharedStoragePanel(host){
    host.querySelector('.shared-folder-test-block')?.remove();
    const limit=host.querySelector('.bridge-test-limit');if(limit)limit.textContent='Bridge는 127.0.0.1에서만 동작하며 브라우저가 Windows 경로를 전달하지 않습니다.';
    const panelHost=root.document.createElement('div');panelHost.innerHTML=sharedStoragePanelHtml();
    const target=host.querySelector('.storage-dataset-panel');if(target)target.before(panelHost.firstElementChild);else host.appendChild(panelHost.firstElementChild);
    host.querySelector('#btnSharedStorageInitialize')?.addEventListener('click',()=>root.erpSharedStorage?.initialize?.());
    host.querySelector('#btnSharedStorageLoad')?.addEventListener('click',()=>root.erpSharedStorage?.loadLatest?.());
    host.querySelector('#btnSharedStorageRetry')?.addEventListener('click',()=>root.erpSharedStorage?.retry?.());
  }
  async function render(){
    const host=root.document?.getElementById('storagePerformanceBody');if(!host)return;
    const usage=await estimateStorage();
    let snapshots=[];try{snapshots=await listSnapshots();}catch{}
    const quotaText=usage.quota?`${formatBytes(usage.usage)} / ${formatBytes(usage.quota)}`:'브라우저가 제공하지 않음';
    const warning=usage.warning?'<div class="storage-warning" role="alert"><strong>저장공간을 점검해 주세요.</strong><span>암호화 백업을 만든 뒤 불필요한 브라우저 데이터를 정리하세요.</span></div>':'<div class="storage-ok" role="status"><strong>저장공간 상태 양호</strong><span>현재 확인된 용량 위험이 없습니다.</span></div>';
    const mirrorText=!lastStatus.supported?'이 브라우저에서 지원하지 않음':lastStatus.error?'최근 갱신 실패':formatTime(lastStatus.lastMirroredAt);
    host.innerHTML=`${warning}<div class="storage-metric-grid"><article><span>ERP localStorage</span><strong>${formatBytes(usage.localBytes)}</strong><small>현재 호환 저장소</small></article><article><span>브라우저 전체 사용량</span><strong>${quotaText}</strong><small>브라우저 제공 추정치</small></article><article><span>IndexedDB 안전 복사</span><strong>${escapeHtml(mirrorText)}</strong><small>저장 성공 후 자동 갱신</small></article><article><span>안전 스냅샷</span><strong>${snapshots.length} / ${MAX_SNAPSHOTS}</strong><small>오래된 항목 자동 정리</small></article></div><div class="storage-actions"><button class="ghost" id="btnStorageRefresh" type="button">사용량 다시 확인</button><button class="ghost" id="btnStorageMirror" type="button">안전 복사 갱신</button><button class="primary" id="btnStorageSnapshot" type="button">안전 스냅샷 만들기</button></div><div class="panel bridge-test-panel"><div class="bridge-test-block"><div class="bridge-test-copy"><div><h3>ERP Bridge 연결 진단</h3><p>웹 ERP와 이 PC에서 실행 중인 로컬 프로그램이 통신할 수 있는지 확인합니다.</p></div><button class="ghost" id="btnLocalBridgeTest" type="button" ${bridgeTestBusy?'disabled':''}>${bridgeTestBusy?'테스트 중…':'로컬 Bridge 연결 테스트'}</button></div>${bridgeResultHtml()}</div><div class="bridge-test-block shared-folder-test-block"><div class="bridge-test-copy"><div><h3>지원팀 공용폴더 진단</h3><p>Bridge 시작 때 지정된 RecruitERP_TEST 폴더에 가상 파일 하나만 생성·검증·삭제합니다.</p></div><button class="primary" id="btnSharedFolderTest" type="button" ${sharedFolderTestBusy?'disabled':''}>${sharedFolderTestBusy?'테스트 중…':'공용폴더 읽기/쓰기 테스트'}</button></div>${sharedFolderResultHtml()}</div><small class="bridge-test-limit">브라우저는 폴더 경로를 전달하지 않습니다. 실제 ERP 데이터·개인정보·localStorage·Supabase·DB는 변경하지 않으며 기존 공용폴더 파일도 수정하지 않습니다.</small></div><div class="panel storage-dataset-panel"><div class="panel-head"><div><h3>데이터별 사용량</h3><small>개인정보 내용 없이 건수와 용량만 표시합니다.</small></div></div><div class="storage-dataset-list">${usage.rows.map(row=>`<div><span>${escapeHtml(row.label)}</span><strong>${row.count.toLocaleString('ko-KR')}건</strong><small>${formatBytes(row.bytes)}</small></div>`).join('')}</div></div><div class="panel storage-snapshot-panel"><div class="panel-head"><div><h3>최근 안전 스냅샷</h3><small>최대 ${MAX_SNAPSHOTS}개까지 이 브라우저의 IndexedDB에 보관합니다.</small></div></div>${snapshots.length?`<div class="storage-snapshot-list">${snapshots.map(item=>`<div><span>${escapeHtml(formatTime(item.createdAt))}</span><strong>${Number(item.totalCount||0).toLocaleString('ko-KR')}건</strong><small>${formatBytes(item.bytes)}</small></div>`).join('')}</div>`:'<p class="muted">아직 만든 안전 스냅샷이 없습니다.</p>'}</div><p class="storage-limit-note">IndexedDB 안전 복사는 같은 브라우저 안의 장애 대비 계층이며 외부 백업을 대신하지 않습니다. 중요한 작업 전에는 백업센터에서 암호화 백업을 내려받으세요.</p>`;
    renderSharedStoragePanel(host);
    host.querySelector('#btnStorageRefresh')?.addEventListener('click',()=>render());
    host.querySelector('#btnStorageMirror')?.addEventListener('click',()=>mirrorAll().catch(error=>root.alert?.(error.message)));
    host.querySelector('#btnStorageSnapshot')?.addEventListener('click',()=>createSnapshot());
    host.querySelector('#btnLocalBridgeTest')?.addEventListener('click',()=>runLocalBridgeTest());
    host.querySelector('#btnSharedFolderTest')?.addEventListener('click',()=>runSharedFolderBridgeTest());
  }
  function ensureUi(){
    if(!root.document)return;
    const systemItems=root.document.querySelector('[data-navgroup="system"] .nav-group-items');
    if(systemItems&&!root.document.querySelector('[data-page="storagePerformance"]')){
      const button=root.document.createElement('button');button.className='nav-btn nav-sub';button.type='button';button.dataset.page='storagePerformance';button.dataset.requiredPermission='storage.manage';button.innerHTML='<span class="nav-ico" aria-hidden="true">▤</span><span>저장소·속도</span>';systemItems.appendChild(button);
      button.addEventListener('click',()=>{if(root.erpPermissions?.require?.('storage.manage')){root.setPage?.('storagePerformance');render();}});
    }
    const main=root.document.querySelector('main.main');
    if(main&&!root.document.getElementById('storagePerformance')){
      const section=root.document.createElement('section');section.className='page storage-performance-page';section.id='storagePerformance';section.dataset.requiredPermission='storage.manage';section.innerHTML='<div class="page-intro-card safety-intro-card"><div><h3>저장소·속도 관리</h3><p>대용량 데이터의 안전 복사 상태와 브라우저 저장공간을 개인정보 노출 없이 확인합니다.</p></div><span class="page-intro-badge">v11.0.0 STORAGE</span></div><div id="storagePerformanceBody"></div>';main.appendChild(section);
    }
  }
  function scheduleMirror(event){
    const dataset=DATASETS.find(item=>item.key===event?.detail?.key);if(!dataset)return;
    root.clearTimeout?.(refreshTimers.get(dataset.key));
    const timer=root.setTimeout?.(async()=>{
      refreshTimers.delete(dataset.key);
      try{await mirrorDataset(dataset);lastStatus={supported:true,lastMirroredAt:new Date().toISOString(),error:''};render();}
      catch{lastStatus={supported:true,lastMirroredAt:lastStatus.lastMirroredAt,error:'mirror_failed'};console.warn(`IndexedDB 안전 복사 갱신 실패: ${dataset.label}`);render();}
    },250)||0;
    refreshTimers.set(dataset.key,timer);
  }
  function init(){
    if(!root.document)return;
    loadSharedStorageScript();
    ensureUi();
    const baseSetPage=root.setPage;
    if(typeof baseSetPage==='function')root.setPage=function(page){
      if(page==='storagePerformance'&&!root.erpPermissions?.has?.('storage.manage')){root.erpPermissions?.require?.('storage.manage');return;}
      baseSetPage(page);
      if(page==='storagePerformance'){
        const title=root.document.getElementById('page-title');if(title)title.textContent='저장소·속도';
        const breadcrumb=root.document.querySelector('.topbar-breadcrumb');if(breadcrumb)breadcrumb.textContent='브라우저 저장공간과 IndexedDB 안전 복사 상태를 확인합니다.';
        render();
      }
    };
    root.document.addEventListener('erp:storage-write',scheduleMirror);
    root.document.addEventListener('erp:permission-change',()=>render());
    root.addEventListener?.('pagehide',()=>mirrorAll().catch(()=>{}));
    root.setTimeout?.(()=>mirrorAll().catch(()=>{}),0);
    root.setTimeout?.(()=>render(),0);
  }
  const api={VERSION,DB_NAME,DB_VERSION,DATASET_STORE,SNAPSHOT_STORE,SNAPSHOT_META_STORE,MAX_SNAPSHOTS,LOCAL_WARNING_BYTES,LOW_REMAINING_BYTES,BRIDGE_HEALTH_URL,BRIDGE_SHARED_FOLDER_TEST_URL,BRIDGE_SERVICE,BRIDGE_VERSION,BRIDGE_TIMEOUT_MS,DATASETS,byteLength,formatBytes,shouldWarn,datasetSummary,safeParseDataset,openDb,mirrorDataset,mirrorAll,listSnapshots,saveSnapshot,deleteSnapshot,createSnapshot,probeLocalBridge,probeSharedFolderBridge,runLocalBridgeTest,runSharedFolderBridgeTest,localUsage,estimateStorage,render,ensureUi,init};
  if(root.document)init();
  return api;
});
