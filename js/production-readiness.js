/* Recruit ERP v11.0.0 production readiness center.
 * Stores only checklist identifiers, timestamps, roles, and synthetic test totals.
 */
(function(root,factory){
  const versionSource=typeof module==='object'&&module.exports?require('./app-version.js'):root.erpAppVersion;
  const api=factory(root,versionSource);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpProductionReadiness=api;
})(typeof window!=='undefined'?window:globalThis,function(root,versionSource){
  'use strict';

  const VERSION=String(versionSource?.VERSION||'').trim();
  if(!/^\d+\.\d+\.\d+$/.test(VERSION))throw new Error('Recruit ERP 현재 버전 소스를 확인할 수 없습니다.');
  const STATE_KEY='recruit_erp_production_readiness_v1100';
  const STATE_SCHEMA_VERSION=2;
  const MAX_CHECK_AGE_MS=30*24*60*60*1000;
  const OPERATION_ENV_KEY='recruit_erp_ui_operation_environment';
  const CLOUD_ADMIN_MESSAGE='Supabase 관리자 계정으로 로그인한 상태에서만 확인할 수 있습니다.';
  const FREE_PLAN_LIMITATION_TEXT='Supabase Free 요금제 사용으로 Leaked Password Protection은 미사용. 해당 제한을 인지한 상태로 운영한다.';
  const KNOWN_LIMITATIONS=[{id:'leaked_credential_protection',category:'supabase-plan',description:FREE_PLAN_LIMITATION_TEXT}];
  const CLOUD_ADMIN_CHECKS=new Set(['roles_rls']);
  const MANUAL_CHECKS=[
    {id:'roles_rls',label:'권한·RLS 실제 계정 점검',description:'v11 보안 migration 적용, 관리자·채용담당자·조회전용 역할표, Supabase Security Advisor 결과를 모두 확인합니다.',requiresCloudAdmin:true},
    {id:'leaked_credential_protection',label:'유출 비밀번호 보호 · 알려진 요금제 제한',description:FREE_PLAN_LIMITATION_TEXT,knownLimitation:true},
    {id:'encrypted_restore',label:'암호화 백업·복원 훈련',description:'실제 운영 자료가 아닌 가상 자료로 .erpbackup 생성, 다른 빈 브라우저 복원, 비밀번호 분리 보관까지 확인합니다.'},
    {id:'delete_recovery',label:'삭제 재생성 방지 훈련',description:'PC A 오프라인 삭제 후 연결 복구와 PC B 동기화에서 삭제한 지원자가 다시 나타나지 않는지 확인합니다.'},
    {id:'export_audit',label:'개인정보 내보내기·변경 이력 점검',description:'일반·민감 내보내기 권한, CSV 방어, 내보내기 감사기록과 민감정보 마스킹을 확인합니다.'},
    {id:'operator_guide',label:'운영자 설명서 확인',description:'일일 시작·종료, 계정, 백업, 동기화, 온보딩 절차를 실제 담당자가 따라 해봅니다.'},
    {id:'incident_drill',label:'장애 복구 모의훈련',description:'저장 실패·동기화 충돌·브라우저 손실·배포 장애별 중단 기준과 복구 순서를 담당자와 함께 연습합니다.'}
  ];
  let renderSequence=0;
  let encryptionProbe={checkedAt:0,result:false,promise:null};

  function emptyState(){
    return {schemaVersion:STATE_SCHEMA_VERSION,version:VERSION,updatedAt:'',manual:{},capacity:null};
  }
  function isFresh(value,now=Date.now()){
    const time=new Date(value||'').getTime();
    return Number.isFinite(time)&&time<=now&&now-time<=MAX_CHECK_AGE_MS;
  }
  function sanitizeState(value){
    const input=value&&typeof value==='object'?value:{};
    const state=emptyState();
    if(input.schemaVersion!==STATE_SCHEMA_VERSION||input.version!==VERSION)return state;
    state.updatedAt=typeof input.updatedAt==='string'?input.updatedAt:'';
    for(const check of MANUAL_CHECKS){
      const row=input.manual?.[check.id];
      if(row&&typeof row==='object'&&typeof row.completedAt==='string'){
        state.manual[check.id]={completedAt:row.completedAt,role:['admin','local_admin','legacy_admin'].includes(row.role)?row.role:'admin',source:row.source==='cloud'?'cloud':'local'};
      }
    }
    const capacity=input.capacity;
    if(capacity&&typeof capacity==='object'){
      state.capacity={
        completedAt:typeof capacity.completedAt==='string'?capacity.completedAt:'',
        durationMs:Math.max(0,Math.round(Number(capacity.durationMs)||0)),
        passed:capacity.passed===true,
        counts:{
          applicants:Math.max(0,Math.round(Number(capacity.counts?.applicants)||0)),
          employees:Math.max(0,Math.round(Number(capacity.counts?.employees)||0)),
          schools:Math.max(0,Math.round(Number(capacity.counts?.schools)||0))
        }
      };
    }
    return state;
  }
  function readState(){
    try{return sanitizeState(JSON.parse(root.localStorage?.getItem(STATE_KEY)||'{}'));}
    catch{return emptyState();}
  }
  function writeState(next){
    const state=sanitizeState({...next,schemaVersion:STATE_SCHEMA_VERSION,version:VERSION,updatedAt:new Date().toISOString()});
    const serialized=JSON.stringify(state);
    const saved=root.erpSafety?.safeLocalStorageSet
      ?root.erpSafety.safeLocalStorageSet(STATE_KEY,serialized,{notify:false})
      :(()=>{try{root.localStorage?.setItem(STATE_KEY,serialized);return true;}catch{return false;}})();
    if(!saved)root.alert?.('운영 준비 확인 내용을 저장하지 못했습니다. 체크 상태는 바뀌지 않았습니다.');
    return saved?state:null;
  }
  function operationEnvironment(){
    const displayed=root.document?.documentElement?.dataset?.operationEnvironment;
    if(displayed==='company'||displayed==='home')return displayed;
    try{return root.localStorage?.getItem(OPERATION_ENV_KEY)==='company'?'company':'home';}catch{return 'home';}
  }
  function runtimeContext(overrides={}){
    const permission=overrides.permission||root.erpPermissions?.current?.()||{};
    const environment=overrides.operationEnvironment||operationEnvironment();
    const permissionsModuleReady=typeof root.erpPermissions?.current==='function'&&typeof root.erpPermissions?.has==='function'&&typeof root.erpPermissions?.require==='function';
    const supabaseClientReady=!!root.sb?.auth&&typeof root.sb.auth.getSession==='function';
    let cloudUsable=false;
    try{cloudUsable=environment==='home'&&supabaseClientReady&&typeof root.canUseCloud==='function'&&root.canUseCloud()===true;}catch{}
    const source=permission.source==='cloud'&&cloudUsable&&!!permission.userId?'cloud':'local';
    const cloudAdminEligible=permissionsModuleReady&&source==='cloud'&&permission.role==='admin'&&!!permission.userId;
    return {
      role:permission.role||'viewer',permissionSource:permission.source||'local',userIdPresent:!!permission.userId,
      verificationSource:source,operationEnvironment:environment,permissionsModuleReady,supabaseClientReady,
      supabaseLoggedIn:cloudUsable,cloudUsable,cloudAdminEligible
    };
  }
  function requireReadinessPermission(notify=true){
    if(typeof root.erpPermissions?.require==='function')return root.erpPermissions.require('readiness.manage',{notify});
    if(notify)root.alert?.('운영 준비 점검 권한을 확인할 수 없습니다.');
    return false;
  }
  function setManual(id,completed){
    const check=MANUAL_CHECKS.find(item=>item.id===id);
    if(!check||check.knownLimitation)return null;
    if(!requireReadinessPermission())return null;
    const context=runtimeContext();
    if(CLOUD_ADMIN_CHECKS.has(id)&&!context.cloudAdminEligible){root.alert?.(CLOUD_ADMIN_MESSAGE);return null;}
    const before=readState(),manual={...before.manual};
    if(completed)manual[id]={completedAt:new Date().toISOString(),role:context.role,source:context.verificationSource};else delete manual[id];
    return writeState({...before,manual});
  }
  function clearState(){
    if(!requireReadinessPermission())return false;
    try{root.localStorage?.removeItem(STATE_KEY);return true;}catch{return false;}
  }
  function manualStatus(state=readState(),now=Date.now(),context=runtimeContext()){
    const rows=MANUAL_CHECKS.map(check=>{
      const record=state.manual?.[check.id];
      const knownLimitation=check.knownLimitation===true;
      const locked=knownLimitation||(!!check.requiresCloudAdmin&&!context.cloudAdminEligible);
      const validCloudRecord=!check.requiresCloudAdmin||(record?.role==='admin'&&record?.source==='cloud'&&context.cloudAdminEligible);
      const complete=!knownLimitation&&!!record&&isFresh(record.completedAt,now)&&validCloudRecord;
      const lockMessage=knownLimitation?'':locked?CLOUD_ADMIN_MESSAGE:'';
      return {...check,knownLimitation,locked,lockMessage,complete,completedAt:complete?record.completedAt:'',role:complete?record.role:''};
    });
    const requiredRows=rows.filter(row=>!row.knownLimitation);
    return {rows,completed:requiredRows.filter(row=>row.complete).length,total:requiredRows.length,ready:requiredRows.every(row=>row.complete),knownLimitations:rows.filter(row=>row.knownLimitation).length};
  }

  function syntheticRows(prefix,count,extra){
    return Array.from({length:count},(_,index)=>({
      id:`${prefix}-${String(index+1).padStart(6,'0')}`,
      name:`가상성능자료-${index+1}`,
      status:index%5===0?'입사예정':'서류검토',
      workplace:index%2?'천안':'평택',
      ...extra(index)
    }));
  }
  function runSyntheticCapacityCheck(options={}){
    const applicantCount=Number(options.applicants)||5000;
    const employeeCount=Number(options.employees)||1000;
    const schoolCount=Number(options.schools)||500;
    const started=Date.now();
    const applicants=syntheticRows('virtual-applicant',applicantCount,index=>({phone:`010-0000-${String(index%10000).padStart(4,'0')}`,hireDate:'2026-08-10'}));
    const employees=syntheticRows('virtual-employee',employeeCount,index=>({empNo:`V-${String(index+1).padStart(6,'0')}`}));
    const schools=syntheticRows('virtual-school',schoolCount,index=>({region:index%3?'충남':'경기'}));
    const employeeNumbers=new Set(employees.map(row=>row.empNo));
    const activeApplicants=applicants.filter(row=>row.status!=='종료').sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    const regionalSchools=schools.filter(row=>row.region==='충남').sort((a,b)=>a.name.localeCompare(b.name,'ko'));
    const durationMs=Date.now()-started;
    const valid=activeApplicants.length===applicantCount&&employeeNumbers.size===employeeCount&&regionalSchools.length>0;
    return {
      completedAt:new Date().toISOString(),
      durationMs,
      passed:valid&&durationMs<3000,
      counts:{applicants:applicantCount,employees:employeeCount,schools:schoolCount}
    };
  }
  function saveCapacityResult(result){
    if(!requireReadinessPermission())return null;
    const before=readState();
    return writeState({...before,capacity:result});
  }

  function evaluateVersionEvidence(evidence={},expectedVersion=VERSION){
    const expected=String(expectedVersion||'').trim(),tag=`v${expected}`,mismatches=[];
    const title=String(evidence.title||''),brand=String(evidence.brand||'');
    if(!title.includes(tag))mismatches.push(`화면 제목이 ${tag}이 아닙니다.`);
    if(!brand.includes(tag))mismatches.push(`브랜드 표기가 ${tag}이 아닙니다.`);
    const assets=Array.isArray(evidence.assets)?evidence.assets:[];
    for(const asset of assets){
      const resource=String(asset?.resource||'정적 파일'),version=String(asset?.version||'');
      if(version!==expected)mismatches.push(`${resource} 버전이 ${version||'없음'}입니다.`);
    }
    if(!assets.length)mismatches.push('검사할 정적 파일 버전이 없습니다.');
    return {
      ready:mismatches.length===0,
      detail:mismatches.length?`버전 불일치: ${mismatches.join(' ')}`:`${tag} 화면·브랜드·정적 파일 버전이 일치합니다.`,
      mismatches
    };
  }

  function collectStaticVersionEvidence(doc=root.document){
    if(!doc)return {title:'',brand:'',assets:[]};
    const assets=[...doc.querySelectorAll('script[src],link[rel="stylesheet"][href]')].flatMap(node=>{
      const resource=node.getAttribute('src')||node.getAttribute('href')||'';
      if(!resource||/^(?:https?:)?\/\//i.test(resource))return [];
      let version='';
      try{version=new URL(resource,'http://127.0.0.1/').searchParams.get('v')||'';}catch{}
      return [{resource:resource.split('?')[0],version}];
    });
    return {title:doc.title||'',brand:doc.querySelector('.brand-copy p')?.textContent||'',assets};
  }

  function buildAutomaticChecks(evidence={}){
    const queues=Number(evidence.savePending||0)+Number(evidence.deletePending||0)+Number(evidence.conflicts||0);
    return [
      {id:'version',testType:'기능 시험',label:'화면·파일 버전',status:evidence.versionReady?'pass':'fail',detail:evidence.versionDetail||`${VERSION} 버전 일치 여부를 확인할 수 없습니다.`},
      {id:'security',testType:'모듈 확인',label:'입력·화면 보안',status:evidence.securityModuleReady&&evidence.privacyModuleReady?'pass':'fail',detail:evidence.securityModuleReady&&evidence.privacyModuleReady?'안전 트리·ID·화면 잠금 모듈이 모두 있습니다.':'erpPrivacySecurity 또는 필수 입력 보안 모듈이 없습니다.'},
      {id:'encrypted_backup',testType:'기능 시험',label:'암호화 백업',status:evidence.encryptedBackupModuleReady&&evidence.encryptionRoundTripReady?'pass':'fail',detail:evidence.encryptedBackupModuleReady&&evidence.encryptionRoundTripReady?'가상 문자열 AES-GCM 암호화·복호화 round-trip을 통과했습니다.':evidence.encryptedBackupModuleReady?'AES-GCM 실제 기능 시험에 실패했습니다.':'erpEncryptedBackup 모듈이 없습니다.'},
      {id:'permissions',testType:'기능 시험',label:'화면 권한 엔진',status:evidence.permissionsModuleReady&&evidence.permissionsReady?'pass':'fail',detail:evidence.permissionsModuleReady&&evidence.permissionsReady?'Supabase cloud admin 계정과 화면 보호를 확인했습니다.':evidence.permissionsModuleReady?'현재 계정은 cloud admin 운영 조건을 충족하지 않습니다.':'erpPermissions 모듈이 없습니다.'},
      {id:'audit',testType:'모듈 확인',label:'변경 이력 보호',status:evidence.auditModuleReady?'pass':'fail',detail:evidence.auditModuleReady?'민감정보 마스킹 감사기록 모듈이 있습니다.':'erpAudit 모듈이 없습니다.'},
      {id:'sync_queue',testType:'기능 시험',label:'저장·삭제·충돌 대기',status:!evidence.syncModuleReady||!evidence.syncProbeReady?'fail':queues===0?'pass':'fail',detail:!evidence.syncModuleReady?'erpSyncSafety 모듈이 없어 대기 건수를 확인할 수 없습니다.':!evidence.syncProbeReady?'동기화 대기 건수 기능 시험에 실패했습니다.':queues===0?'미처리 동기화 작업이 없습니다.':`확인할 동기화 작업 ${queues}건이 남아 있습니다.`},
      {id:'storage',testType:'기능 시험',label:'브라우저 저장공간',status:!evidence.storageModuleReady||!evidence.storageProbeReady||evidence.storageWarning?'fail':'pass',detail:!evidence.storageModuleReady?'erpStoragePerformance 모듈이 없어 저장공간을 확인할 수 없습니다.':!evidence.storageProbeReady?'저장공간 실제 기능 시험에 실패했습니다.':evidence.storageWarning?'저장공간 경고가 있습니다. 암호화 백업 후 정리하세요.':'저장공간 실제 기능 시험에서 확인된 위험이 없습니다.'},
      {id:'capacity',testType:'기능 시험',label:'가상 6,500건 성능',status:evidence.capacityPassed&&evidence.capacityFresh?'pass':'warn',detail:evidence.capacityPassed&&evidence.capacityFresh?`최근 검사 ${Number(evidence.capacityDurationMs||0).toLocaleString('ko-KR')}ms`:'30일 안에 가상 6,500건 검사를 실행하세요.'}
    ];
  }
  function summarize(automatic,manual,context={}){
    const failed=automatic.filter(check=>check.status==='fail').length;
    const warnings=automatic.filter(check=>check.status==='warn').length;
    const automaticPassed=automatic.filter(check=>check.status==='pass').length;
    const cloudVerified=context.verificationSource==='cloud'&&context.cloudAdminEligible===true;
    return {ready:failed===0&&warnings===0&&manual.ready&&cloudVerified,cloudVerified,failed,warnings,automaticPassed,automaticTotal:automatic.length,manualCompleted:manual.completed,manualTotal:manual.total};
  }
  async function runEncryptionRoundTrip(force=false){
    const now=Date.now();
    if(!force&&encryptionProbe.promise)return encryptionProbe.promise;
    if(!force&&now-encryptionProbe.checkedAt<5*60*1000)return encryptionProbe.result;
    const task=(async()=>{
      const api=root.erpEncryptedBackup;
      if(!api||typeof api.isSupported!=='function'||typeof api.encryptObject!=='function'||typeof api.decryptEnvelope!=='function'||!api.isSupported())return false;
      try{
        const sample={type:'production-readiness-probe',appVersion:VERSION,value:'가상 운영 준비 암호화 확인'};
        const password='가상 운영 준비 기능 시험 전용 비밀번호 2026';
        const envelope=await api.encryptObject(sample,password,{iterations:Number(api.MIN_ITERATIONS)||100000,appVersion:VERSION});
        const restored=await api.decryptEnvelope(envelope,password);
        return restored?.type===sample.type&&restored?.appVersion===VERSION&&restored?.value===sample.value;
      }catch{return false;}
    })();
    encryptionProbe.promise=task;
    try{encryptionProbe.result=await task;encryptionProbe.checkedAt=Date.now();return encryptionProbe.result;}
    finally{encryptionProbe.promise=null;}
  }
  async function collectRuntimeEvidence(state=readState()){
    const context=runtimeContext();
    const storageModuleReady=typeof root.erpStoragePerformance?.estimateStorage==='function';
    let storageWarning=true,storageProbeReady=false;
    if(storageModuleReady)try{const result=await root.erpStoragePerformance.estimateStorage();storageProbeReady=!!result&&typeof result.warning==='boolean';storageWarning=storageProbeReady?result.warning:true;}catch{}
    const syncModuleReady=typeof root.erpSyncSafety?.pendingCount==='function'&&typeof root.erpSyncSafety?.pendingDeleteCount==='function'&&typeof root.erpSyncSafety?.readConflicts==='function';
    let savePending=0,deletePending=0,conflicts=0,syncProbeReady=false;
    if(syncModuleReady)try{
      savePending=Number(root.erpSyncSafety.pendingCount());deletePending=Number(root.erpSyncSafety.pendingDeleteCount());
      const conflictRows=root.erpSyncSafety.readConflicts();conflicts=Array.isArray(conflictRows)?conflictRows.length:NaN;
      syncProbeReady=[savePending,deletePending,conflicts].every(value=>Number.isFinite(value)&&value>=0);
    }catch{}
    const encryptedBackupModuleReady=typeof root.erpEncryptedBackup?.isSupported==='function'&&typeof root.erpEncryptedBackup?.encryptObject==='function'&&typeof root.erpEncryptedBackup?.decryptEnvelope==='function';
    const encryptionRoundTripReady=encryptedBackupModuleReady?await runEncryptionRoundTrip():false;
    const privacyModuleReady=typeof root.erpPrivacySecurity?.lock==='function';
    const auditModuleReady=typeof root.erpAudit?.recordEvent==='function'&&typeof root.erpAudit?.scrubText==='function';
    const securityModuleReady=typeof root.erpSecurity?.assertSafeTree==='function'&&typeof root.erpSecurity?.validateRowIds==='function';
    const capacity=state.capacity;
    const versionResult=evaluateVersionEvidence(collectStaticVersionEvidence());
    return {
      ...context,
      versionReady:versionResult.ready,versionDetail:versionResult.detail,
      securityModuleReady,privacyModuleReady,encryptedBackupModuleReady,encryptionRoundTripReady,
      permissionsReady:context.cloudAdminEligible,auditModuleReady,syncModuleReady,syncProbeReady,
      storageModuleReady,storageProbeReady,savePending,deletePending,conflicts,storageWarning,
      capacityPassed:capacity?.passed===true,
      capacityFresh:isFresh(capacity?.completedAt),
      capacityDurationMs:capacity?.durationMs||0
    };
  }
  function buildPrivacySafeReport({state=readState(),automatic=[],context=runtimeContext(),manual=manualStatus(state,Date.now(),context),summary=summarize(automatic,manual,context)}={}){
    const safeState=sanitizeState(state);
    const source=context.verificationSource==='cloud'?'cloud':'local';
    const rolesRow=manual.rows.find(row=>row.id==='roles_rls');
    const rolesVerified=source==='cloud'&&context.cloudAdminEligible===true&&rolesRow?.complete===true;
    return {
      format:'recruit-erp-production-readiness',
      schemaVersion:STATE_SCHEMA_VERSION,
      appVersion:VERSION,
      createdAt:new Date().toISOString(),
      verificationSource:source,
      operationEnvironment:context.operationEnvironment==='company'?'company':'home',
      migrationVerified:rolesVerified,
      securityAdvisorVerified:rolesVerified,
      roleMatrixVerified:rolesVerified,
      overall:summary.ready&&source==='cloud'&&context.cloudAdminEligible===true?'ready':'not-ready',
      automatic:automatic.map(check=>({id:check.id,testType:check.testType,status:check.status,detail:check.detail})),
      manual:manual.rows.map(row=>({id:row.id,complete:row.complete,knownLimitation:row.knownLimitation===true,completedAt:row.completedAt||'',role:row.role||''})),
      knownLimitations:KNOWN_LIMITATIONS.map(item=>({...item})),
      capacity:safeState.capacity?{completedAt:safeState.capacity.completedAt,durationMs:safeState.capacity.durationMs,passed:safeState.capacity.passed,counts:{...safeState.capacity.counts}}:null,
      privacy:'이 보고서는 이름·연락처·주소·주민등록번호·메모·원본 업무 데이터를 포함하지 않습니다.',
      limitation:'이 JSON은 사용자가 수정할 수 있는 참고용 점검 결과이며 전자서명된 증명서가 아닙니다.'
    };
  }
  function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function formatTime(value){
    if(!value)return '미확인';
    const date=new Date(value);return Number.isNaN(date.getTime())?'확인 불가':date.toLocaleString('ko-KR');
  }
  function downloadReport(report){
    if(!root.document||!root.URL||!root.Blob)return false;
    const blob=new root.Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'});
    const url=root.URL.createObjectURL(blob),link=root.document.createElement('a');
    link.href=url;link.download=`recruit-erp-readiness-v${VERSION}-${new Date().toISOString().slice(0,10)}.json`;
    root.document.body.appendChild(link);link.click();link.remove();root.URL.revokeObjectURL(url);return true;
  }
  function statusLabel(status){return status==='pass'?'통과':status==='fail'?'조치 필요':'확인 필요';}
  async function render(){
    const host=root.document?.getElementById('productionReadinessBody');if(!host)return;
    const sequence=++renderSequence,state=readState(),evidence=await collectRuntimeEvidence(state);
    if(sequence!==renderSequence)return;
    const manual=manualStatus(state,Date.now(),evidence),automatic=buildAutomaticChecks(evidence),summary=summarize(automatic,manual,evidence);
    const overallClass=summary.ready?'is-ready':'is-not-ready';
    const overallTitle=summary.ready?'운영 준비 완료':'아직 운영 확인이 필요합니다';
    const sourceLabel=evidence.verificationSource==='cloud'?'클라우드 검증':'로컬 참고용';
    host.innerHTML=`<section class="readiness-overall ${overallClass}"><div><p class="eyebrow">PRODUCTION GATE · ${sourceLabel}</p><h3>${overallTitle}</h3><p>자동 통과 ${summary.automaticPassed}/${summary.automaticTotal} · 운영 확인 ${summary.manualCompleted}/${summary.manualTotal} · 환경 ${escapeHtml(evidence.operationEnvironment)}</p></div><span>${summary.ready?'READY':'CHECK'}</span></section><div class="readiness-actions"><button class="ghost" id="btnReadinessRefresh" type="button">다시 확인</button><button class="ghost" id="btnReadinessCapacity" type="button">가상 6,500건 검사</button><button class="primary" id="btnReadinessExport" type="button">점검 결과 저장</button></div><section class="panel readiness-section"><div class="panel-head"><div><h3>자동 안전 점검</h3><small>모듈 존재 확인과 가상 자료를 사용한 실제 기능 시험을 구분합니다. 개인정보 원문은 읽거나 표시하지 않습니다.</small></div></div><div class="readiness-check-grid">${automatic.map(check=>`<article class="readiness-check is-${check.status}"><div class="readiness-check-badges"><span>${statusLabel(check.status)}</span><em>${escapeHtml(check.testType)}</em></div><strong>${escapeHtml(check.label)}</strong><p>${escapeHtml(check.detail)}</p></article>`).join('')}</div></section><section class="panel readiness-section"><div class="panel-head"><div><h3>운영자 확인</h3><small>필수 확인은 30일 동안 유효합니다. 알려진 요금제 제한은 READY 차단 항목에서 제외합니다.</small></div></div><div class="readiness-manual-list">${manual.rows.map(row=>`<label class="readiness-manual ${row.complete?'is-complete':''} ${row.locked?'is-locked':''} ${row.knownLimitation?'is-known-limitation':''}"><input type="checkbox" data-readiness-manual="${row.id}" ${row.complete?'checked':''} ${row.locked?'disabled':''}><span><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(row.description)}</small>${row.locked&&row.lockMessage?`<em class="readiness-lock-message">${escapeHtml(row.lockMessage)}</em>`:row.complete?`<em>${escapeHtml(formatTime(row.completedAt))} · ${escapeHtml(row.role)}</em>`:''}</span></label>`).join('')}</div></section><section class="panel readiness-docs"><div><h3>운영 문서</h3><p>업무 시작·종료부터 장애 복구와 릴리스 판정까지 순서대로 확인할 수 있습니다.</p></div><div><a class="ghost button-link" href="docs/OPERATOR_GUIDE_v11.0.0.md" target="_blank" rel="noopener">운영자 설명서</a><a class="ghost button-link" href="docs/INCIDENT_RECOVERY_v11.0.0.md" target="_blank" rel="noopener">장애 복구 절차</a><a class="ghost button-link" href="docs/RELEASE_READINESS_v11.0.0.md" target="_blank" rel="noopener">릴리스 점검표</a></div></section><p class="readiness-limit">브라우저 자동 점검은 실제 Supabase 계정별 RLS, 외부 백업 보관, 다른 PC의 삭제 동기화를 대신하지 않습니다. 점검 JSON은 사용자가 수정 가능한 참고 자료이며 전자서명된 증명서가 아닙니다.</p>`;
    host.querySelector('#btnReadinessRefresh')?.addEventListener('click',()=>render());
    host.querySelector('#btnReadinessCapacity')?.addEventListener('click',event=>{
      const button=event.currentTarget;button.disabled=true;button.textContent='가상 자료 검사 중…';
      root.setTimeout?.(()=>{const result=runSyntheticCapacityCheck();saveCapacityResult(result);render();},20);
    });
    host.querySelector('#btnReadinessExport')?.addEventListener('click',()=>downloadReport(buildPrivacySafeReport({state,automatic,context:evidence,manual,summary})));
    host.querySelectorAll('[data-readiness-manual]').forEach(input=>input.addEventListener('change',()=>{
      const saved=setManual(input.dataset.readinessManual,input.checked);
      if(!saved)input.checked=!input.checked;
      render();
    }));
  }
  function ensureUi(){
    if(!root.document)return;
    const systemItems=root.document.querySelector('[data-navgroup="system"] .nav-group-items');
    if(systemItems&&!root.document.querySelector('[data-page="productionReadiness"]')){
      const button=root.document.createElement('button');button.className='nav-btn nav-sub';button.type='button';button.dataset.page='productionReadiness';button.dataset.requiredPermission='readiness.manage';button.innerHTML='<span class="nav-ico" aria-hidden="true">✓</span><span>운영 준비 점검</span>';systemItems.appendChild(button);
      button.addEventListener('click',()=>{if(root.erpPermissions?.require?.('readiness.manage')){root.setPage?.('productionReadiness');render();}});
    }
    const main=root.document.querySelector('main.main');
    if(main&&!root.document.getElementById('productionReadiness')){
      const section=root.document.createElement('section');section.className='page production-readiness-page';section.id='productionReadiness';section.dataset.requiredPermission='readiness.manage';section.innerHTML='<div class="page-intro-card safety-intro-card"><div><h3>실제 운영 준비 점검</h3><p>자동 안전장치와 사람이 직접 확인해야 하는 운영 훈련을 한 화면에서 구분합니다.</p></div><span class="page-intro-badge">운영 준비</span></div><div id="productionReadinessBody"></div>';main.appendChild(section);
    }
  }
  function init(){
    if(!root.document)return;
    ensureUi();
    const baseSetPage=root.setPage;
    if(typeof baseSetPage==='function')root.setPage=function(page){
      if(page==='productionReadiness'&&!root.erpPermissions?.has?.('readiness.manage')){root.erpPermissions?.require?.('readiness.manage');return false;}
      const result=baseSetPage(page);if(result===false)return false;
      if(page==='productionReadiness'){
        const title=root.document.getElementById('page-title');if(title)title.textContent='운영 준비 점검';
        const breadcrumb=root.document.querySelector('.topbar-breadcrumb');if(breadcrumb)breadcrumb.textContent='자동검사와 운영 모의훈련을 모두 통과해야 READY가 됩니다.';
        render();
      }
      return result;
    };
    root.document.addEventListener('erp:permission-change',()=>render());
    root.document.addEventListener('erp:operation-environment-change',()=>render());
    root.document.addEventListener('erp:auth-logout',()=>render());
    root.document.addEventListener('erp:storage-write',event=>{if(event.detail?.key!==STATE_KEY&&root.document.body.dataset.activePage==='productionReadiness')render();});
    root.setTimeout?.(()=>render(),0);
  }

  const api={VERSION,STATE_KEY,STATE_SCHEMA_VERSION,MAX_CHECK_AGE_MS,OPERATION_ENV_KEY,CLOUD_ADMIN_MESSAGE,FREE_PLAN_LIMITATION_TEXT,KNOWN_LIMITATIONS,CLOUD_ADMIN_CHECKS,MANUAL_CHECKS,emptyState,isFresh,sanitizeState,readState,operationEnvironment,runtimeContext,requireReadinessPermission,setManual,clearState,manualStatus,runSyntheticCapacityCheck,saveCapacityResult,evaluateVersionEvidence,collectStaticVersionEvidence,buildAutomaticChecks,summarize,runEncryptionRoundTrip,collectRuntimeEvidence,buildPrivacySafeReport,downloadReport,render,ensureUi,init};
  if(root.document)init();
  return api;
});
