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
  const SHARED_FOLDER_NAME='RecruitERP_TEST';
  const SHARED_FOLDER_TEST_FILE='recruit_erp_test.txt';
  const SHARED_FOLDER_TEST_CONTENT='Recruit ERP shared folder test';
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
  let lastSharedFolderResult=null;
  let sharedFolderTestBusy=false;

  function isNotFoundError(error){
    return error?.name==='NotFoundError'||error?.code==='ENOENT';
  }
  async function sharedFolderTestFileExists(directoryHandle){
    try{
      await directoryHandle.getFileHandle(SHARED_FOLDER_TEST_FILE,{create:false});
      return true;
    }catch(error){
      if(isNotFoundError(error))return false;
      throw error;
    }
  }
  async function probeSharedFolder(picker=root.showDirectoryPicker){
    if(typeof picker!=='function')return {ok:false,code:'unsupported'};
    let directoryHandle=null;
    let writable=null;
    let created=false;
    let verified=false;
    let removed=false;
    let code='';
    try{
      directoryHandle=await picker({mode:'readwrite'});
      if(!directoryHandle||directoryHandle.name!==SHARED_FOLDER_NAME){code='wrong-folder';}
      else if(typeof directoryHandle.getFileHandle!=='function'||typeof directoryHandle.removeEntry!=='function'){code='invalid-handle';}
      else if(await sharedFolderTestFileExists(directoryHandle)){code='test-file-exists';}
      else{
        const fileHandle=await directoryHandle.getFileHandle(SHARED_FOLDER_TEST_FILE,{create:true});
        created=true;
        writable=await fileHandle.createWritable();
        await writable.write(SHARED_FOLDER_TEST_CONTENT);
        await writable.close();
        writable=null;
        const file=await fileHandle.getFile();
        verified=await file.text()===SHARED_FOLDER_TEST_CONTENT;
        if(!verified)code='content-mismatch';
      }
    }catch(error){
      code=error?.name==='AbortError'?'cancelled':'access-failed';
    }finally{
      if(writable&&typeof writable.abort==='function'){
        try{await writable.abort();}catch{}
      }
      if(created&&directoryHandle){
        try{await directoryHandle.removeEntry(SHARED_FOLDER_TEST_FILE);removed=true;}
        catch{code='cleanup-failed';}
      }
    }
    return {ok:created&&verified&&removed&&!code,code:code||'ok'};
  }
  function sharedFolderResultHtml(){
    if(sharedFolderTestBusy)return '<div class="shared-folder-test-result is-running" id="sharedFolderTestResult" role="status" aria-live="polite"><strong>공용폴더 읽기/쓰기 확인 중…</strong><span>테스트 파일을 만든 뒤 즉시 읽고 삭제합니다.</span></div>';
    if(!lastSharedFolderResult)return '<div class="shared-folder-test-result" id="sharedFolderTestResult" role="status" aria-live="polite"><strong>아직 테스트하지 않았습니다.</strong><span>회사 공용폴더 안의 RecruitERP_TEST 폴더를 선택하세요.</span></div>';
    if(lastSharedFolderResult.ok)return '<div class="shared-folder-test-result is-success" id="sharedFolderTestResult" role="status" aria-live="polite"><strong>✅ 공용폴더 읽기/쓰기 사용 가능</strong><span>ERP_DATA 저장소로 사용할 수 있습니다.</span></div>';
    return '<div class="shared-folder-test-result is-failure" id="sharedFolderTestResult" role="alert" aria-live="assertive"><strong>❌ 공용폴더 접근 또는 쓰기가 차단되어 있습니다.</strong><span>회사 보안정책/브라우저 정책 확인이 필요합니다.</span></div>';
  }
  async function runSharedFolderTest(){
    if(!root.erpPermissions?.require?.('storage.manage'))return false;
    if(sharedFolderTestBusy)return false;
    sharedFolderTestBusy=true;
    const button=root.document?.getElementById('btnSharedFolderTest');
    const resultHost=root.document?.getElementById('sharedFolderTestResult');
    if(button){button.disabled=true;button.textContent='테스트 중…';}
    if(resultHost){resultHost.className='shared-folder-test-result is-running';resultHost.setAttribute('role','status');resultHost.innerHTML='<strong>공용폴더 읽기/쓰기 확인 중…</strong><span>테스트 파일을 만든 뒤 즉시 읽고 삭제합니다.</span>';}
    const probePromise=probeSharedFolder();
    lastSharedFolderResult=await probePromise;
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
  async function render(){
    const host=root.document?.getElementById('storagePerformanceBody');if(!host)return;
    const usage=await estimateStorage();
    let snapshots=[];try{snapshots=await listSnapshots();}catch{}
    const quotaText=usage.quota?`${formatBytes(usage.usage)} / ${formatBytes(usage.quota)}`:'브라우저가 제공하지 않음';
    const warning=usage.warning?'<div class="storage-warning" role="alert"><strong>저장공간을 점검해 주세요.</strong><span>암호화 백업을 만든 뒤 불필요한 브라우저 데이터를 정리하세요.</span></div>':'<div class="storage-ok" role="status"><strong>저장공간 상태 양호</strong><span>현재 확인된 용량 위험이 없습니다.</span></div>';
    const mirrorText=!lastStatus.supported?'이 브라우저에서 지원하지 않음':lastStatus.error?'최근 갱신 실패':formatTime(lastStatus.lastMirroredAt);
    host.innerHTML=`${warning}<div class="storage-metric-grid"><article><span>ERP localStorage</span><strong>${formatBytes(usage.localBytes)}</strong><small>현재 호환 저장소</small></article><article><span>브라우저 전체 사용량</span><strong>${quotaText}</strong><small>브라우저 제공 추정치</small></article><article><span>IndexedDB 안전 복사</span><strong>${escapeHtml(mirrorText)}</strong><small>저장 성공 후 자동 갱신</small></article><article><span>안전 스냅샷</span><strong>${snapshots.length} / ${MAX_SNAPSHOTS}</strong><small>오래된 항목 자동 정리</small></article></div><div class="storage-actions"><button class="ghost" id="btnStorageRefresh" type="button">사용량 다시 확인</button><button class="ghost" id="btnStorageMirror" type="button">안전 복사 갱신</button><button class="primary" id="btnStorageSnapshot" type="button">안전 스냅샷 만들기</button></div><div class="panel shared-folder-test-panel"><div class="shared-folder-test-copy"><div><h3>회사 공용폴더 저장 진단</h3><p>회사 공용폴더 안에 미리 만든 <strong>RecruitERP_TEST</strong> 폴더를 선택하세요. 기존 파일은 열거나 수정하지 않습니다.</p></div><button class="primary" id="btnSharedFolderTest" type="button" ${sharedFolderTestBusy?'disabled':''}>${sharedFolderTestBusy?'테스트 중…':'공용폴더 저장 테스트'}</button></div>${sharedFolderResultHtml()}<small class="shared-folder-test-limit">실제 ERP 데이터, localStorage, Supabase 및 DB는 사용하거나 변경하지 않습니다. 테스트 파일 하나만 생성·확인·삭제합니다.</small></div><div class="panel storage-dataset-panel"><div class="panel-head"><div><h3>데이터별 사용량</h3><small>개인정보 내용 없이 건수와 용량만 표시합니다.</small></div></div><div class="storage-dataset-list">${usage.rows.map(row=>`<div><span>${escapeHtml(row.label)}</span><strong>${row.count.toLocaleString('ko-KR')}건</strong><small>${formatBytes(row.bytes)}</small></div>`).join('')}</div></div><div class="panel storage-snapshot-panel"><div class="panel-head"><div><h3>최근 안전 스냅샷</h3><small>최대 ${MAX_SNAPSHOTS}개까지 이 브라우저의 IndexedDB에 보관합니다.</small></div></div>${snapshots.length?`<div class="storage-snapshot-list">${snapshots.map(item=>`<div><span>${escapeHtml(formatTime(item.createdAt))}</span><strong>${Number(item.totalCount||0).toLocaleString('ko-KR')}건</strong><small>${formatBytes(item.bytes)}</small></div>`).join('')}</div>`:'<p class="muted">아직 만든 안전 스냅샷이 없습니다.</p>'}</div><p class="storage-limit-note">IndexedDB 안전 복사는 같은 브라우저 안의 장애 대비 계층이며 외부 백업을 대신하지 않습니다. 중요한 작업 전에는 백업센터에서 암호화 백업을 내려받으세요.</p>`;
    host.querySelector('#btnStorageRefresh')?.addEventListener('click',()=>render());
    host.querySelector('#btnStorageMirror')?.addEventListener('click',()=>mirrorAll().catch(error=>root.alert?.(error.message)));
    host.querySelector('#btnStorageSnapshot')?.addEventListener('click',()=>createSnapshot());
    host.querySelector('#btnSharedFolderTest')?.addEventListener('click',()=>runSharedFolderTest());
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
  const api={VERSION,DB_NAME,DB_VERSION,DATASET_STORE,SNAPSHOT_STORE,SNAPSHOT_META_STORE,MAX_SNAPSHOTS,LOCAL_WARNING_BYTES,LOW_REMAINING_BYTES,SHARED_FOLDER_NAME,SHARED_FOLDER_TEST_FILE,SHARED_FOLDER_TEST_CONTENT,DATASETS,byteLength,formatBytes,shouldWarn,datasetSummary,safeParseDataset,openDb,mirrorDataset,mirrorAll,listSnapshots,saveSnapshot,deleteSnapshot,createSnapshot,sharedFolderTestFileExists,probeSharedFolder,runSharedFolderTest,localUsage,estimateStorage,render,ensureUi,init};
  if(root.document)init();
  return api;
});
