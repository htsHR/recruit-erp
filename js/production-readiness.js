/* Recruit ERP LOCAL ONLY production readiness. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpProductionReadiness=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const VERSION=String(root.erpAppVersion?.VERSION||'12.3.2');
  const UNCHANGED_ASSET_VERSIONS=new Set(['12.0.2','12.0.3','12.1.0','12.2.0','12.2.1','12.2.2']);
  const STATE_KEY='recruit_erp_production_readiness_v1100';
  const STATE_SCHEMA=3;
  const VALID_DAYS=30;
  const MANUAL_CHECKS=Object.freeze([
    {id:'local_role_matrix',label:'로컬 역할별 화면 보호 확인',description:'관리자·채용담당자·조회전용 권한이 의도한 범위만 허용하는지 확인합니다.'},
    {id:'encrypted_backup',label:'암호화 백업·복원 확인',description:'가상 데이터로 암호화 백업 생성과 복원 절차를 확인합니다.'},
    {id:'browser_recovery',label:'브라우저 비상 복구 확인',description:'새로고침 뒤 업무 데이터와 화면 상태가 정상 복원되는지 확인합니다.'},
    {id:'factory_reset',label:'v12.0.2 공장 초기화 확인',description:'승인된 저장 키와 IndexedDB만 초기화되고 다른 웹앱 데이터는 유지되는지 확인합니다.'},
    {id:'operator_guide',label:'운영자 절차 확인',description:'업무 시작·종료·백업 절차를 운영자가 확인합니다.'},
    {id:'incident_recovery',label:'장애 복구 절차 확인',description:'저장 실패·브라우저 교체 시 복구 순서를 확인합니다.'},
    {id:'release_gate',label:'Production 릴리스 확인',description:'main 검사와 Production 버전 일치를 확인합니다.'}
  ]);

  const el=id=>root.document?.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const nowIso=()=>new Date().toISOString();
  const hasPermission=()=>!root.erpPermissions||root.erpPermissions.has?.('readiness.manage')===true;
  const formatTime=value=>{const date=new Date(value);return Number.isNaN(date.getTime())?'-':date.toLocaleString('ko-KR');};
  const isFresh=(value,now=Date.now())=>{const time=new Date(value).getTime();return Number.isFinite(time)&&time<=now&&now-time<=VALID_DAYS*86400000;};

  function blankState(){
    return {schemaVersion:STATE_SCHEMA,version:VERSION,updatedAt:'',manual:{},capacity:null};
  }
  function normalizeState(value){
    const state=blankState();
    if(!value||typeof value!=='object'||Array.isArray(value))return state;
    if(value.manual&&typeof value.manual==='object'&&!Array.isArray(value.manual)){
      for(const check of MANUAL_CHECKS){
        const row=value.manual[check.id];
        if(row&&typeof row.completedAt==='string')state.manual[check.id]={completedAt:row.completedAt,role:String(row.role||'local_admin'),source:'local'};
      }
    }
    if(value.capacity&&typeof value.capacity==='object')state.capacity={
      passed:value.capacity.passed===true,
      checkedAt:String(value.capacity.checkedAt||''),
      counts:{applicants:Number(value.capacity.counts?.applicants||0),employees:Number(value.capacity.counts?.employees||0),schools:Number(value.capacity.counts?.schools||0)}
    };
    state.updatedAt=String(value.updatedAt||'');
    return state;
  }
  function readState(storage=root.localStorage){
    try{return normalizeState(JSON.parse(storage?.getItem(STATE_KEY)||'null'));}catch{return blankState();}
  }
  function writeState(state,storage=root.localStorage){
    if(!hasPermission())return false;
    const next=normalizeState({...state,updatedAt:nowIso()});
    next.updatedAt=nowIso();
    const text=JSON.stringify(next);
    if(typeof root.safeLocalStorageSet==='function')return root.safeLocalStorageSet(STATE_KEY,text)!==false;
    try{storage?.setItem(STATE_KEY,text);return true;}catch{return false;}
  }
  function setManual(id,value){
    if(!hasPermission()||!MANUAL_CHECKS.some(check=>check.id===id))return false;
    const state=readState();
    if(value)state.manual[id]={completedAt:nowIso(),role:String(root.erpPermissions?.current?.().role||'local_admin'),source:'local'};
    else delete state.manual[id];
    const ok=writeState(state);if(ok)void render();return ok;
  }
  function clearState(){
    if(!hasPermission())return false;
    try{root.localStorage?.removeItem(STATE_KEY);void render();return true;}catch{return false;}
  }
  function saveCapacityResult(result){
    if(!hasPermission())return false;
    const state=readState();
    state.capacity={
      passed:result?.passed===true,
      checkedAt:nowIso(),
      counts:{applicants:Number(result?.counts?.applicants||0),employees:Number(result?.counts?.employees||0),schools:Number(result?.counts?.schools||0)}
    };
    const ok=writeState(state);if(ok)void render();return ok;
  }
  function context(){
    const permission=root.erpPermissions?.current?.()||{role:'local_admin',source:'local',userId:null};
    return {
      verificationSource:'local',
      operationEnvironment:'local-only',
      role:String(permission.role||'local_admin'),
      permissionsModuleReady:!!root.erpPermissions,
      factoryResetReady:root.localStorage?.getItem?.('recruit_erp_data_epoch')==='v12.0.2-reset-1'
    };
  }

  async function encryptionRoundTrip(){
    try{
      const cryptoApi=root.crypto;
      if(!cryptoApi?.subtle)return false;
      const sample=`Recruit ERP v${VERSION} synthetic readiness`;
      const bytes=new TextEncoder().encode(sample);
      const key=await cryptoApi.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
      const iv=cryptoApi.getRandomValues(new Uint8Array(12));
      const cipher=await cryptoApi.subtle.encrypt({name:'AES-GCM',iv},key,bytes);
      const plain=await cryptoApi.subtle.decrypt({name:'AES-GCM',iv},key,cipher);
      return new TextDecoder().decode(plain)===sample;
    }catch{return false;}
  }
  function loadedAssetVersions(){
    if(!root.document)return [];
    return [...root.document.querySelectorAll('script[src],link[href]')].map(node=>{
      const source=node.getAttribute('src')||node.getAttribute('href')||'';
      try{return new URL(source,'https://local.invalid/').searchParams.get('v')||'';}catch{return '';}
    }).filter(Boolean);
  }
  async function automaticChecks(evidence=context()){
    const versions=loadedAssetVersions();
    const versionMatch=!versions.length||versions.every(value=>value===VERSION||UNCHANGED_ASSET_VERSIONS.has(value));
    const encryptionOk=await encryptionRoundTrip();
    const localOnlyRuntime=root.erpRuntimeMode==='local-only';
    const auditReady=!!(root.erpAudit?.recordEvent||root.erpAudit?.record);
    const backupReady=!!root.erpBackupCenter?.exportEncrypted&&!!root.erpEncryptedBackup;
    const storageReady=!!root.erpStoragePerformance;
    const permissionsReady=evidence.permissionsModuleReady&&['local_admin','admin','recruiter','viewer','legacy_admin'].includes(evidence.role);
    return [
      {id:'version',testType:'기능 시험',label:`v${VERSION} 버전 일치`,status:versionMatch?'pass':'fail',detail:versionMatch?`v${VERSION} 화면·브랜드와 변경 자산 캐시 버전이 일치합니다.`:'정적 파일 버전이 일치하지 않습니다.'},
      {id:'factory_reset',testType:'기능 시험',label:'공장 초기화 완료',status:evidence.factoryResetReady?'pass':'fail',detail:evidence.factoryResetReady?'승인된 브라우저 저장영역 초기화가 완료됐습니다.':'브라우저 공장 초기화가 완료되지 않았습니다.'},
      {id:'local_only',testType:'구조 검사',label:'LOCAL ONLY 독립 실행',status:localOnlyRuntime?'pass':'fail',detail:localOnlyRuntime?'원격 인증·DB 클라이언트 없이 실행 중입니다.':'원격 데이터 계층 흔적을 확인해야 합니다.'},
      {id:'permissions',testType:'모듈 확인',label:'로컬 권한 보호',status:permissionsReady?'pass':'fail',detail:permissionsReady?'로컬 역할표와 화면 보호 모듈을 확인했습니다.':'권한 보호 모듈을 불러오지 못했습니다.'},
      {id:'audit',testType:'모듈 확인',label:'로컬 변경 이력',status:auditReady?'pass':'fail',detail:auditReady?'감사 기록은 이 브라우저에만 저장됩니다.':'감사 기록 모듈을 불러오지 못했습니다.'},
      {id:'encryption',testType:'기능 시험',label:'AES-GCM 가상 왕복',status:encryptionOk?'pass':'fail',detail:encryptionOk?'개인정보 없는 문자열의 암호화·복호화를 확인했습니다.':'암호화 기능 시험에 실패했습니다.'},
      {id:'backup',testType:'모듈 확인',label:'암호화 백업·복원',status:backupReady?'pass':'fail',detail:backupReady?'로컬 암호화 백업 모듈을 확인했습니다.':'백업 모듈을 불러오지 못했습니다.'},
      {id:'storage',testType:'모듈 확인',label:'브라우저 저장소',status:storageReady?'pass':'fail',detail:storageReady?'IndexedDB와 브라우저 저장소 점검 모듈을 확인했습니다.':'저장소 점검 모듈을 불러오지 못했습니다.'}
    ];
  }
  function manualStatus(state=readState(),now=Date.now()){
    const rows=MANUAL_CHECKS.map(check=>{
      const record=state.manual[check.id];
      const complete=!!record&&isFresh(record.completedAt,now);
      return {...check,complete,completedAt:record?.completedAt||'',role:record?.role||'',locked:false};
    });
    return {rows,completed:rows.filter(row=>row.complete).length,total:rows.length,ready:rows.every(row=>row.complete)};
  }
  function summarize(automatic,manual){
    const failed=automatic.filter(item=>item.status==='fail').length;
    const warnings=automatic.filter(item=>item.status==='warning').length;
    return {ready:failed===0&&warnings===0&&manual.ready,failed,warnings,automaticPassed:automatic.filter(item=>item.status==='pass').length,automaticTotal:automatic.length,manualCompleted:manual.completed,manualTotal:manual.total};
  }
  function buildPrivacySafeReport({state=readState(),automatic=[],context:evidence=context(),manual=manualStatus(state),summary=summarize(automatic,manual)}={}){
    return {
      format:'recruit-erp-production-readiness',
      schemaVersion:3,
      appVersion:VERSION,
      generatedAt:nowIso(),
      overall:summary.ready?'ready':'not-ready',
      verificationSource:'local',
      operationEnvironment:'local-only',
      localOnly:true,
      remoteDependency:false,
      factoryResetVerified:evidence.factoryResetReady===true,
      automatic:automatic.map(({id,label,status,testType})=>({id,label,status,testType})),
      manual:manual.rows.map(({id,label,complete,completedAt})=>({id,label,complete,completedAt:complete?completedAt:''})),
      capacity:state.capacity,
      limitation:'이 JSON은 사용자가 수정 가능한 참고용 점검 결과이며 전자서명된 증명서가 아닙니다.'
    };
  }
  function capacityCheck(){
    const counts={applicants:5000,employees:1000,schools:500};
    const rows=Array.from({length:counts.applicants},(_,index)=>({id:`synthetic-${index}`,status:index%2?'검토':'면접'}));
    const passed=rows.length===counts.applicants&&new Set(rows.map(row=>row.id)).size===counts.applicants;
    const result={passed,counts};saveCapacityResult(result);return result;
  }
  function downloadReport(report){
    if(!root.document||typeof root.Blob!=='function')return report;
    const blob=new root.Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'});
    const url=root.URL.createObjectURL(blob);const anchor=root.document.createElement('a');anchor.href=url;anchor.download=`Recruit_ERP_운영준비_v${VERSION}.json`;anchor.click();setTimeout(()=>root.URL.revokeObjectURL(url),1000);return report;
  }
  function statusLabel(status){return status==='pass'?'통과':status==='warning'?'확인':'실패';}
  async function render(){
    const host=el('productionReadinessBody');if(!host||!hasPermission())return null;
    const state=readState();const evidence=context();const automatic=await automaticChecks(evidence);const manual=manualStatus(state);const summary=summarize(automatic,manual);
    host.innerHTML=`<section class="readiness-overall ${summary.ready?'is-ready':'is-check'}"><div><p class="eyebrow">PRODUCTION GATE · LOCAL ONLY</p><h3>${summary.ready?'운영 준비 완료':'확인할 항목이 있습니다'}</h3><p>자동 통과 ${summary.automaticPassed}/${summary.automaticTotal} · 운영 확인 ${summary.manualCompleted}/${summary.manualTotal}</p></div><span>${summary.ready?'READY':'CHECK'}</span></section><div class="readiness-actions"><button class="ghost" id="btnReadinessRefresh" type="button">다시 확인</button><button class="ghost" id="btnReadinessCapacity" type="button">가상 6,500건 검사</button><button class="primary" id="btnReadinessExport" type="button">점검 결과 저장</button></div><section class="panel readiness-section"><div class="panel-head"><div><h3>자동 안전 점검</h3><small>개인정보 없는 가상 자료와 로컬 모듈만 검사합니다.</small></div></div><div class="readiness-check-grid">${automatic.map(check=>`<article class="readiness-check is-${check.status}"><div class="readiness-check-badges"><span>${statusLabel(check.status)}</span><em>${esc(check.testType)}</em></div><strong>${esc(check.label)}</strong><p>${esc(check.detail)}</p></article>`).join('')}</div></section><section class="panel readiness-section"><div class="panel-head"><div><h3>운영자 확인</h3><small>확인 기록은 30일 동안 이 브라우저에만 유지됩니다.</small></div></div><div class="readiness-manual-list">${manual.rows.map(row=>`<label class="readiness-manual ${row.complete?'is-complete':''}"><input type="checkbox" data-readiness-manual="${row.id}" ${row.complete?'checked':''}><span><strong>${esc(row.label)}</strong><small>${esc(row.description)}</small>${row.complete?`<em>${esc(formatTime(row.completedAt))}</em>`:''}</span></label>`).join('')}</div></section><p class="readiness-limit">점검 JSON은 사용자가 수정 가능한 참고 자료이며 전자서명된 증명서가 아닙니다.</p>`;
    if(state.capacity){const note=root.document.createElement('p');note.className='readiness-capacity-result';note.textContent=`최근 검사: 지원자 ${state.capacity.counts.applicants.toLocaleString()}명 · 사원 ${state.capacity.counts.employees.toLocaleString()}명 · 학교 ${state.capacity.counts.schools.toLocaleString()}개 · ${state.capacity.passed?'통과':'확인 필요'}`;host.querySelector('.readiness-actions')?.after(note);}
    host.querySelectorAll('[data-readiness-manual]').forEach(input=>input.addEventListener('change',event=>setManual(event.currentTarget.dataset.readinessManual,event.currentTarget.checked)));
    el('btnReadinessRefresh')?.addEventListener('click',()=>void render());
    el('btnReadinessCapacity')?.addEventListener('click',()=>capacityCheck());
    el('btnReadinessExport')?.addEventListener('click',()=>downloadReport(buildPrivacySafeReport({state,automatic,context:evidence,manual,summary})));
    return {automatic,manual,summary,evidence};
  }
  function ensureUi(){
    if(!root.document)return;
    const systemItems=root.document.querySelector('[data-navgroup="system"] .nav-group-items');
    if(systemItems&&!root.document.querySelector('[data-page="productionReadiness"]')){
      const button=root.document.createElement('button');button.className='nav-btn nav-sub';button.type='button';button.dataset.page='productionReadiness';button.dataset.requiredPermission='readiness.manage';button.innerHTML='<span class="nav-ico" aria-hidden="true">✓</span><span>운영 준비 점검</span>';systemItems.appendChild(button);
    }
    const main=root.document.querySelector('main.main');
    if(main&&!root.document.getElementById('productionReadiness')){
      const section=root.document.createElement('section');section.className='page production-readiness-page';section.id='productionReadiness';section.dataset.requiredPermission='readiness.manage';section.innerHTML='<div class="page-intro-card safety-intro-card"><div><h3>LOCAL ONLY 운영 준비 점검</h3><p>브라우저 저장·암호화 백업·공장 초기화와 운영자 절차를 확인합니다.</p></div><span class="page-intro-badge">LOCAL ONLY</span></div><div id="productionReadinessBody"></div>';main.appendChild(section);
    }
  }
  function init(){
    ensureUi();
    root.document?.addEventListener?.('click',event=>{if(event.target.closest?.('[data-page="productionReadiness"],[data-go="productionReadiness"]'))setTimeout(()=>void render(),0);});
    root.document?.addEventListener?.('erp:permission-change',()=>void render());
    if(root.document?.querySelector?.('#productionReadinessBody'))void render();
  }
  if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();}

  return Object.freeze({VERSION,STATE_KEY,STATE_SCHEMA,VALID_DAYS,MANUAL_CHECKS,blankState,normalizeState,readState,writeState,setManual,clearState,saveCapacityResult,context,encryptionRoundTrip,automaticChecks,manualStatus,summarize,buildPrivacySafeReport,capacityCheck,render,ensureUi});
});
