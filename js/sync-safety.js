/* Recruit ERP v10.54.0 cloud sync conflict and retry safety */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.erpSyncSafety=api;api.init();}
})(typeof window!=='undefined'?window:null,function(root){
  'use strict';

  const VERSION='10.54.0';
  const BASE_KEY='recruit_erp_cloud_sync_bases_v1053';
  const PENDING_KEY='recruit_erp_cloud_sync_pending_v1053';
  const CONFLICT_KEY='recruit_erp_cloud_sync_conflicts_v1053';
  const MAX_CONFLICTS=50;
  const DATASET_LABELS={applicants:'지원자',employees:'사원',schools:'학교'};
  const registrations={};
  const activeUploads={};

  function canonical(value){
    if(value===null||value===undefined)return value===undefined?null:value;
    if(Array.isArray(value))return value.map(canonical);
    if(typeof value!=='object')return value;
    return Object.keys(value).sort().reduce((out,key)=>{
      if(key==='updatedAt')return out;
      out[key]=canonical(value[key]);return out;
    },{});
  }
  function stableStringify(value){return JSON.stringify(canonical(value));}
  function hashText(text){
    let hash=2166136261;
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(16).padStart(8,'0');
  }
  function fingerprint(record){return hashText(stableStringify(record||{}));}
  function timestamp(record){
    const raw=record&&(record.updatedAt||record.createdAt)||'';
    const time=Date.parse(raw);return Number.isFinite(time)?time:0;
  }
  function dedupeRows(rows){
    const map=new Map();
    (Array.isArray(rows)?rows:[]).filter(row=>row&&row.id!==undefined&&row.id!==null).forEach(row=>map.set(String(row.id),row));
    return [...map.values()];
  }
  function mergeDataset(localRows,cloudRows,baseFingerprints={}){
    const local=dedupeRows(localRows),cloud=dedupeRows(cloudRows),cloudMap=new Map(cloud.map(row=>[String(row.id),row]));
    const rows=[],conflicts=[],nextBase={...(baseFingerprints||{})},seen=new Set();
    local.forEach(localRow=>{
      const id=String(localRow.id),cloudRow=cloudMap.get(id);seen.add(id);
      if(!cloudRow){rows.push(localRow);return;}
      const localFp=fingerprint(localRow),cloudFp=fingerprint(cloudRow),baseFp=nextBase[id]||'';
      nextBase[id]=cloudFp;
      if(localFp===cloudFp){rows.push(timestamp(cloudRow)>timestamp(localRow)?cloudRow:localRow);return;}
      if(baseFp){
        const localChanged=localFp!==baseFp,cloudChanged=cloudFp!==baseFp;
        if(localChanged&&cloudChanged){conflicts.push({id,local:localRow,cloud:cloudRow});rows.push(localRow);return;}
        if(cloudChanged&&!localChanged){rows.push(cloudRow);return;}
        if(localChanged&&!cloudChanged){rows.push(localRow);return;}
      }
      const localTime=timestamp(localRow),cloudTime=timestamp(cloudRow);
      if(cloudTime>localTime){rows.push(cloudRow);return;}
      if(localTime>cloudTime){rows.push(localRow);return;}
      conflicts.push({id,local:localRow,cloud:cloudRow});rows.push(localRow);
    });
    cloud.forEach(cloudRow=>{
      const id=String(cloudRow.id);if(seen.has(id))return;
      rows.push(cloudRow);nextBase[id]=fingerprint(cloudRow);
    });
    return {rows,conflicts,baseFingerprints:nextBase};
  }
  function mergePendingIds(current,dataset,rows){
    const state=current&&typeof current==='object'?JSON.parse(JSON.stringify(current)):{};
    const ids=new Set(Array.isArray(state[dataset])?state[dataset].map(String):[]);
    dedupeRows(rows).forEach(row=>ids.add(String(row.id)));
    state[dataset]=[...ids].slice(-2000);return state;
  }

  function read(key,fallback){
    if(!root||!root.localStorage)return fallback;
    try{const value=JSON.parse(root.localStorage.getItem(key)||'null');return value===null?fallback:value;}catch{return fallback;}
  }
  function write(key,value){
    if(!root||!root.localStorage)return false;
    const serialized=JSON.stringify(value);
    if(root.erpSafety&&typeof root.erpSafety.safeLocalStorageSet==='function')return root.erpSafety.safeLocalStorageSet(key,serialized,{notify:false});
    try{root.localStorage.setItem(key,serialized);return true;}catch(error){console.warn('동기화 안전정보 저장 실패:',error);return false;}
  }
  function readBases(){const value=read(BASE_KEY,{});return value&&typeof value==='object'?value:{};}
  function readPending(){const value=read(PENDING_KEY,{});return value&&typeof value==='object'?value:{};}
  function readConflicts(){const value=read(CONFLICT_KEY,[]);return Array.isArray(value)?value:[];}
  function recordLabel(record){return String(record?.name||record?.empNo||record?.id||'이름 없음');}
  function mergeAndTrack(dataset,localRows,cloudRows){
    const allBases=readBases(),result=mergeDataset(localRows,cloudRows,allBases[dataset]||{});
    allBases[dataset]=result.baseFingerprints;write(BASE_KEY,allBases);
    if(result.conflicts.length){
      const incoming=result.conflicts.map(item=>({...item,dataset,label:recordLabel(item.local||item.cloud),detectedAt:new Date().toISOString()}));
      const incomingKeys=new Set(incoming.map(item=>`${item.dataset}:${item.id}`));
      const existing=readConflicts().filter(item=>!incomingKeys.has(`${item.dataset}:${item.id}`));
      write(CONFLICT_KEY,[...incoming,...existing].slice(0,MAX_CONFLICTS));
    }
    notifyState();
    return {...result,conflicts:result.conflicts.map(item=>({...item,dataset}))};
  }
  function queuePending(dataset,rows){write(PENDING_KEY,mergePendingIds(readPending(),dataset,rows));notifyState();}
  function pendingCount(){return Object.values(readPending()).reduce((sum,ids)=>sum+(Array.isArray(ids)?ids.length:0),0);}
  function removePending(dataset,rows){
    const state=readPending(),done=new Set(dedupeRows(rows).map(row=>String(row.id)));
    state[dataset]=(Array.isArray(state[dataset])?state[dataset]:[]).filter(id=>!done.has(String(id)));
    if(!state[dataset].length)delete state[dataset];write(PENDING_KEY,state);
  }
  function markUploaded(dataset,rows){
    const bases=readBases();bases[dataset]=bases[dataset]||{};
    dedupeRows(rows).forEach(row=>{bases[dataset][String(row.id)]=fingerprint(row);});
    write(BASE_KEY,bases);removePending(dataset,rows);notifyState();
  }
  function registerDataset(dataset,config){registrations[dataset]=config||{};}
  async function runUpload(dataset,rows,worker){
    const targets=dedupeRows(rows);if(!targets.length)return {skipped:true,count:0};
    if(activeUploads[dataset]){queuePending(dataset,targets);return {queued:true,count:targets.length};}
    activeUploads[dataset]=true;let succeeded=false;
    try{
      const result=await worker(targets);
      if(result&&result.error)throw result.error;
      markUploaded(dataset,targets);succeeded=true;
      if(typeof root?.setCloudSyncStatus==='function')root.setCloudSyncStatus('ok');
      return result||{saved:targets.length,count:targets.length};
    }catch(error){
      queuePending(dataset,targets);
      if(typeof root?.setCloudSyncStatus==='function')root.setCloudSyncStatus('error');
      console.warn(`${DATASET_LABELS[dataset]||dataset} 클라우드 저장 실패 — 자동 재시도 대기열에 보관:`,error);
      return {error,count:targets.length,pending:true};
    }finally{
      activeUploads[dataset]=false;notifyState();
      if(succeeded){const pending=readPending()[dataset];if(Array.isArray(pending)&&pending.length)root.setTimeout(()=>retryDataset(dataset),0);}
    }
  }
  async function retryDataset(dataset){
    const config=registrations[dataset],ids=readPending()[dataset];
    if(!config||!Array.isArray(ids)||!ids.length)return {skipped:true,count:0};
    if(typeof root?.canUseCloud==='function'&&!root.canUseCloud())return {skipped:true,count:ids.length};
    const wanted=new Set(ids.map(String)),rows=dedupeRows(config.getRows?.()||[]).filter(row=>wanted.has(String(row.id)));
    if(!rows.length){const state=readPending();delete state[dataset];write(PENDING_KEY,state);notifyState();return {skipped:true,count:0};}
    return config.upload(rows);
  }
  async function retryAll(){
    const datasets=Object.keys(readPending());
    const results=[];for(const dataset of datasets)results.push(await retryDataset(dataset));
    notifyState();return results;
  }
  function updateBase(dataset,row){const bases=readBases();bases[dataset]=bases[dataset]||{};bases[dataset][String(row.id)]=fingerprint(row);write(BASE_KEY,bases);}

  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function dateLabel(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toLocaleString('ko-KR'):'시간 기록 없음';}
  function ensureModal(){
    if(!root?.document?.body||root.document.getElementById('syncConflictModal'))return;
    const modal=root.document.createElement('div');modal.id='syncConflictModal';modal.className='sync-conflict-modal';modal.hidden=true;
    modal.innerHTML='<div class="sync-conflict-backdrop"></div><section class="sync-conflict-card" role="dialog" aria-modal="true" aria-labelledby="syncConflictTitle"><div class="sync-conflict-head"><div><p>SYNC CONFLICT CENTER</p><h2 id="syncConflictTitle">클라우드 충돌 확인</h2><span>두 곳에서 모두 바뀐 항목만 표시합니다. 선택하기 전에는 이 브라우저 값을 유지합니다.</span></div><button class="ghost" id="btnCloseSyncConflicts" type="button">닫기</button></div><div class="sync-conflict-list" id="syncConflictList"></div><div class="sync-conflict-footer"><span id="syncConflictSelection">선택된 항목 없음</span><button class="primary" id="btnApplySyncConflicts" type="button">선택 결과 적용</button></div></section>';
    root.document.body.appendChild(modal);
    modal.querySelector('.sync-conflict-backdrop').addEventListener('click',closeConflicts);
    root.document.getElementById('btnCloseSyncConflicts').addEventListener('click',closeConflicts);
    root.document.getElementById('btnApplySyncConflicts').addEventListener('click',applyConflictChoices);
    root.document.getElementById('syncConflictList').addEventListener('change',updateConflictSelection);
  }
  function openConflicts(){ensureModal();renderConflicts();const modal=root.document.getElementById('syncConflictModal');if(modal){modal.hidden=false;root.document.getElementById('btnCloseSyncConflicts')?.focus();}}
  function closeConflicts(){const modal=root?.document?.getElementById('syncConflictModal');if(modal)modal.hidden=true;}
  function renderConflicts(){
    const list=root.document.getElementById('syncConflictList'),items=readConflicts();if(!list)return;
    list.innerHTML=items.length?items.map((item,index)=>`<article class="sync-conflict-row"><div><strong>${escapeHtml(DATASET_LABELS[item.dataset]||item.dataset)} · ${escapeHtml(item.label||item.id)}</strong><span>이 브라우저 수정: ${escapeHtml(dateLabel(item.local?.updatedAt||item.local?.createdAt))}</span><span>클라우드 수정: ${escapeHtml(dateLabel(item.cloud?.updatedAt||item.cloud?.createdAt))}</span></div><label>사용할 정보<select data-sync-conflict-choice="${index}"><option value="">선택 필요</option><option value="local">이 브라우저 정보</option><option value="cloud">클라우드 정보</option></select></label></article>`).join(''):'<div class="empty">확인할 동기화 충돌이 없습니다.</div>';
    updateConflictSelection();
  }
  function updateConflictSelection(){
    const count=[...root.document.querySelectorAll('[data-sync-conflict-choice]')].filter(select=>select.value).length;
    const label=root.document.getElementById('syncConflictSelection');if(label)label.textContent=count?`${count}건 선택`:'선택된 항목 없음';
  }
  async function applyConflictChoices(){
    const items=readConflicts(),choices=[...root.document.querySelectorAll('[data-sync-conflict-choice]')]
      .map(select=>({index:Number(select.dataset.syncConflictChoice),choice:select.value})).filter(item=>item.choice&&items[item.index]);
    if(!choices.length){root.alert('사용할 정보를 한 건 이상 선택해주세요.');return;}
    const resolved=new Set(),uploads=[];
    for(const dataset of [...new Set(choices.map(item=>items[item.index].dataset))]){
      const config=registrations[dataset];if(!config)continue;
      const selected=choices.filter(choice=>items[choice.index].dataset===dataset),byId=new Map(dedupeRows(config.getRows?.()||[]).map(row=>[String(row.id),row]));
      const localUploads=[];
      selected.forEach(({index,choice})=>{
        const conflict=items[index],chosen=choice==='cloud'?conflict.cloud:conflict.local,row=config.normalize?config.normalize(chosen):chosen;
        byId.set(String(conflict.id),row);resolved.add(index);
        if(choice==='cloud')updateBase(dataset,row);else localUploads.push(row);
      });
      const next=[...byId.values()],storageKey=typeof config.storageKey==='function'?config.storageKey():config.storageKey;
      if(!write(storageKey,next)){selected.forEach(({index})=>resolved.delete(index));continue;}
      config.setRows?.(next);config.render?.();
      if(localUploads.length)uploads.push(config.upload(localUploads));
    }
    write(CONFLICT_KEY,items.filter((_,index)=>!resolved.has(index)));
    await Promise.all(uploads);renderConflicts();notifyState();
    if(resolved.size)root.alert(`동기화 충돌 ${resolved.size}건의 선택 결과를 적용했습니다.`);
  }
  function decorateStatus(element){
    if(!element||!root?.document)return;
    element.querySelector('.sync-safety-actions')?.remove();
    const pending=pendingCount(),conflicts=readConflicts().length;if(!pending&&!conflicts)return;
    const box=root.document.createElement('div');box.className='sync-safety-actions';
    box.innerHTML=`<span>${pending?`전송 대기 ${pending}건`:''}${pending&&conflicts?' · ':''}${conflicts?`충돌 확인 ${conflicts}건`:''}</span>${pending?'<button type="button" data-sync-retry>다시 시도</button>':''}${conflicts?'<button type="button" data-sync-conflicts>충돌 확인</button>':''}`;
    box.querySelector('[data-sync-retry]')?.addEventListener('click',retryAll);
    box.querySelector('[data-sync-conflicts]')?.addEventListener('click',openConflicts);
    element.appendChild(box);
  }
  function notifyState(){if(typeof root?.updateStorageNote==='function')root.updateStorageNote();}
  function init(){
    if(!root?.document)return;
    const ready=()=>{ensureModal();root.addEventListener('online',retryAll);};
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  }

  return {VERSION,BASE_KEY,PENDING_KEY,CONFLICT_KEY,MAX_CONFLICTS,stableStringify,fingerprint,timestamp,dedupeRows,mergeDataset,mergePendingIds,mergeAndTrack,queuePending,pendingCount,markUploaded,registerDataset,runUpload,retryDataset,retryAll,readConflicts,decorateStatus,openConflicts,init};
});
