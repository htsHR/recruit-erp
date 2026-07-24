/* Recruit ERP v10.40.29 BACKUP CENTER + JSON TYPE GUARD
 * 회사: 퇴근 전 전체 JSON 다운로드 전용
 * 집: 회사 JSON 검사/비교/병합/전체교체 + 검증된 Supabase 저장 확인
 * 기존 핵심 저장키와 데이터 필드 구조는 변경하지 않습니다.
 */
(function(){
  'use strict';

  const BC_VERSION='10.47.7';
  const BC_FORMAT='recruit-erp-backup';
  const BC_EMPLOYEE_ORG_FORMAT='recruit-erp-employee-org-import';
  const BC_SCHEMA=2;
  const BC_LAST_FULL_KEY='recruit_erp_last_full_backup_at';
  const BC_LAST_SNAPSHOT_KEY='recruit_erp_last_full_backup_snapshot_v2';
  const BC_HISTORY_KEY='recruit_erp_backup_center_history';
  const BC_PENDING_CLOUD_KEY='recruit_erp_backup_pending_cloud_sync';
  const BC_MAX_FILE_BYTES=50*1024*1024;
  const BC_CLOUD_CHUNK=250;
  const BC_CLOUD_PAGE=500;

  const DATASETS=[
    {key:'applicants',label:'지원자',storage:'recruit_erp_applicants_stable',cloudTable:'applicants',critical:true},
    {key:'schools',label:'협력학교',storage:'recruit_erp_schools',cloudTable:'schools',critical:true},
    {key:'employees',label:'사원명부',storage:'recruit_erp_employees',cloudTable:'employees',critical:true},
    {key:'calendarEvents',label:'수동 일정',storage:'recruit_erp_calendar_events',cloudTable:'',critical:false},
    {key:'hireWaitingProfiles',label:'입사대기 입력정보',storage:'recruit_erp_hire_waiting_profiles',cloudTable:'',critical:false,optional:true},
    {key:'messageTemplates',label:'안내문 문구함',storage:'recruit_erp_message_templates',cloudTable:'',critical:false,optional:true}
  ];

  let inspected=null;
  let preflightResult=null;

  const bcEl=id=>document.getElementById(id);
  const safeText=v=>String(v==null?'':v);
  const escHtml=v=>safeText(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const localIso=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().replace('T','_').replace(/:/g,'-').slice(0,19);};
  const formatDate=v=>{if(!v)return '기록 없음';const d=new Date(v);return Number.isNaN(d.getTime())?safeText(v):d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
  const formatBytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  const datasetInfo=key=>DATASETS.find(d=>d.key===key);
  const dateLocalKey=v=>{const d=v?new Date(v):new Date();if(Number.isNaN(d.getTime()))return '';d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10);};
  const todayKey=()=>dateLocalKey();
  const deepClone=v=>JSON.parse(JSON.stringify(v));
  const chunk=(rows,size)=>{const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out;};

  function environment(){
    try{return typeof uxGetOperationEnvironment==='function'?uxGetOperationEnvironment():(localStorage.getItem('recruit_erp_ui_operation_environment')==='company'?'company':'home');}
    catch{return 'home';}
  }
  function environmentLabel(mode){return mode==='company'?'회사 로컬 운영':'집 개발·복원';}
  function isHomeMode(){return environment()!=='company';}
  function assertHomeImport(){
    if(isHomeMode())return true;
    alert('회사 모드에서는 JSON 업로드·검사·병합·전체교체·복원 코드를 실행할 수 없습니다. 집 모드에서 진행하세요.');
    return false;
  }
  function cloudReady(){
    try{return isHomeMode()&&typeof canUseCloud==='function'&&canUseCloud()&&!!window.sb;}
    catch{return false;}
  }
  function currentData(){
    return {
      applicants:Array.isArray(applicants)?applicants:[],
      schools:Array.isArray(schools)?schools:[],
      employees:Array.isArray(employees)?employees:[],
      calendarEvents:Array.isArray(calendarEvents)?calendarEvents:[],
      hireWaitingProfiles:Array.isArray(hireWaitingProfiles)?hireWaitingProfiles:[],
      messageTemplates:Array.isArray(messageTemplates)?messageTemplates:[]
    };
  }
  function countsOf(data){const out={};DATASETS.forEach(d=>out[d.key]=Array.isArray(data&&data[d.key])?data[d.key].length:0);return out;}

  function stableStringify(value){
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
  }
  function hashString(text){
    let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return ('00000000'+(h>>>0).toString(16)).slice(-8);
  }
  function rowIdentity(key,row,index){
    const id=safeText(row&&row.id).trim();
    if(id)return `id:${id}`;
    if(key==='schools')return `school:${safeText(row&&row.name).trim().toLowerCase()||index}`;
    if(key==='employees')return `employee:${safeText(row&&row.empNo).trim()||`${safeText(row&&row.name).trim()}|${safeText(row&&row.hireDate).trim()}`||index}`;
    if(key==='calendarEvents')return `calendar:${safeText(row&&row.title).trim()}|${safeText(row&&row.date).trim()}|${index}`;
    if(key==='hireWaitingProfiles')return `hire-waiting:${safeText(row&&row.applicantId).trim()||index}`;
    if(key==='messageTemplates')return `message-template:${safeText(row&&row.id).trim()||index}`;
    const phone=safeText(row&&row.phone).replace(/\D/g,'');
    const email=safeText(row&&row.email).trim().toLowerCase();
    return `applicant:${phone||email||`${safeText(row&&row.name).trim()}|${safeText(row&&row.birthYear).trim()}|${safeText(row&&row.applyDate).trim()}`||index}`;
  }
  function datasetFingerprint(key,rows){
    const used=new Map();
    const entries=(Array.isArray(rows)?rows:[]).map((row,index)=>{
      let identity=rowIdentity(key,row,index);
      const n=(used.get(identity)||0)+1;used.set(identity,n);if(n>1)identity+=`#${n}`;
      return [identity,hashString(stableStringify(row))];
    }).sort((a,b)=>a[0].localeCompare(b[0]));
    return {count:entries.length,digest:hashString(entries.map(x=>x.join(':')).join('|')),entries};
  }
  function snapshotOf(data,at){
    const datasets={};DATASETS.forEach(d=>datasets[d.key]=datasetFingerprint(d.key,(data&&data[d.key])||[]));
    return {schemaVersion:1,at:at||new Date().toISOString(),counts:countsOf(data),datasets};
  }
  function readLastSnapshot(){
    try{const s=JSON.parse(localStorage.getItem(BC_LAST_SNAPSHOT_KEY)||'null');return s&&s.datasets?s:null;}catch{return null;}
  }
  function compareFingerprints(previous,current){
    if(!previous||!current)return {known:false,added:0,modified:0,removed:0,total:0};
    const p=new Map(Array.isArray(previous.entries)?previous.entries:[]);
    const c=new Map(Array.isArray(current.entries)?current.entries:[]);
    let added=0,modified=0,removed=0;
    c.forEach((sig,id)=>{if(!p.has(id))added++;else if(p.get(id)!==sig)modified++;});
    p.forEach((sig,id)=>{if(!c.has(id))removed++;});
    return {known:true,added,modified,removed,total:added+modified+removed};
  }
  function changesSinceBackup(){
    const previous=readLastSnapshot();
    const now=snapshotOf(currentData());
    const perDataset={};let total=0;
    DATASETS.forEach(d=>{const diff=compareFingerprints(previous&&previous.datasets&&previous.datasets[d.key],now.datasets[d.key]);perDataset[d.key]=diff;total+=diff.total;});
    return {known:!!previous,total,perDataset,lastAt:previous&&previous.at||localStorage.getItem(BC_LAST_FULL_KEY)||''};
  }
  function changeSummaryText(changes){
    if(!changes.known)return '기준 백업 없음';
    if(changes.total===0)return '변경 없음';
    let added=0,modified=0,removed=0;
    Object.values(changes.perDataset).forEach(x=>{added+=x.added;modified+=x.modified;removed+=x.removed;});
    return `추가 ${added} · 수정 ${modified} · 삭제 ${removed}`;
  }

  function downloadFile(name,content,mime='application/json'){
    const blob=new Blob([content],{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function packageFor(keys,reason='manual'){
    const all=currentData();const data={};keys.forEach(k=>data[k]=deepClone(all[k]||[]));
    const integrityDatasets={};keys.forEach(k=>integrityDatasets[k]=datasetFingerprint(k,data[k]).digest);
    const createdAt=new Date().toISOString();
    let excelApplicantIds=[];
    try{excelApplicantIds=keys.includes('applicants')&&typeof window.erpGetExcelApplicantIds==='function'?window.erpGetExcelApplicantIds():[];}catch{excelApplicantIds=[];}
    const pack={
      format:BC_FORMAT,schemaVersion:BC_SCHEMA,appVersion:BC_VERSION,
      backupType:keys.length===DATASETS.length?'full':keys[0],createdAt,
      environment:environment(),environmentLabel:environmentLabel(environment()),reason,
      counts:countsOf(data),metadata:{excelApplicantIds},integrity:{algorithm:'fnv1a32-stable-json',datasets:integrityDatasets},data
    };
    pack.integrity.packageDigest=hashString(keys.slice().sort().map(k=>`${k}:${integrityDatasets[k]}`).join('|'));
    return pack;
  }
  function fileName(type,prefix='recruit_erp'){
    const names={full:'full_backup',applicants:'applicants',schools:'schools',employees:'employees',calendarEvents:'manual_calendar',hireWaitingProfiles:'hire_waiting_profiles',messageTemplates:'message_templates'};
    return `${prefix}_${names[type]||type}_${localIso()}.json`;
  }
  function recordHistory(action,detail){
    let list=[];try{list=JSON.parse(localStorage.getItem(BC_HISTORY_KEY)||'[]');if(!Array.isArray(list))list=[];}catch{list=[];}
    list.unshift({at:new Date().toISOString(),action,detail});
    localStorage.setItem(BC_HISTORY_KEY,JSON.stringify(list.slice(0,20)));
    renderHistory();
  }
  function exportBackup(type,reason='manual'){
    try{
      const keys=type==='full'?DATASETS.map(d=>d.key):[type];
      const pack=packageFor(keys,reason);
      downloadFile(fileName(type),JSON.stringify(pack,null,2));
      if(type==='full'){
        localStorage.setItem(BC_LAST_FULL_KEY,pack.createdAt);
        localStorage.setItem('recruit_erp_last_backup_date',pack.createdAt.slice(0,10));
        localStorage.setItem(BC_LAST_SNAPSHOT_KEY,JSON.stringify(snapshotOf(pack.data,pack.createdAt)));
        preflightResult=null;
      }
      recordHistory(type==='full'?'ERP 전체 백업 다운로드 요청':`${datasetInfo(type)?.label||type} 백업 다운로드 요청`,`${keys.map(k=>`${datasetInfo(k).label} ${pack.counts[k]}건`).join(' · ')} · ${environmentLabel(pack.environment)}`);
      refreshCounts();
      if(type==='full')runPreflight(false);
      if(typeof uxToast==='function')uxToast(type==='full'?'ERP 전체 JSON 다운로드를 요청했습니다. 저장된 파일을 확인하세요.':'선택 데이터 다운로드를 요청했습니다.');
      return pack;
    }catch(err){
      console.error('Backup export error',err);
      alert(`백업 파일 생성 중 오류가 발생했습니다.\n\n${err.message||err}`);
      return null;
    }
  }
  function backupCurrentBeforeChange(reason){
    const pack=packageFor(DATASETS.map(d=>d.key),reason);
    downloadFile(`recruit_erp_safety_before_${localIso()}.json`,JSON.stringify(pack,null,2));
    recordHistory('적용 직전 안전 백업 다운로드 요청',reason);
    return pack;
  }

  function detectLegacyArray(arr){
    const sample=arr.find(x=>x&&typeof x==='object')||{};
    if('applicantId'in sample&&('residentNumber'in sample||'groupName'in sample||'employeeNo'in sample))return 'hireWaitingProfiles';
    if('body'in sample&&'title'in sample&&'category'in sample)return 'messageTemplates';
    if('empNo'in sample||'department'in sample||'leaveDate'in sample)return 'employees';
    if('title'in sample&&'date'in sample&&('importance'in sample||'type'in sample))return 'calendarEvents';
    if('aliases'in sample||'managementStatus'in sample||'mouDate'in sample||'contactPhone'in sample)return 'schools';
    return 'applicants';
  }
  function versionParts(v){return safeText(v).match(/\d+/g)?.slice(0,3).map(Number)||[0,0,0];}
  function compareVersions(a,b){const x=versionParts(a),y=versionParts(b);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)-(y[i]||0);}return 0;}
  function classifyJsonPayload(parsed){
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&parsed.format===BC_EMPLOYEE_ORG_FORMAT&&Array.isArray(parsed.rows)){
      return {
        kind:'employee-org',label:'사원 조직정보 반영용 JSON',route:'사원명부 → 엑셀 조직정보 반영',
        count:parsed.rows.length,summary:'사번·성명과 팀·그룹·제품·파트만 포함된 전용 반영 파일입니다.'
      };
    }
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&parsed.format===BC_FORMAT&&parsed.data&&typeof parsed.data==='object'){
      const keys=DATASETS.filter(d=>Array.isArray(parsed.data[d.key])).map(d=>d.key);
      return {
        kind:DATASETS.filter(d=>!d.optional).every(d=>keys.includes(d.key))?'erp-full':'erp-partial',
        label:DATASETS.filter(d=>!d.optional).every(d=>keys.includes(d.key))?'ERP 전체 백업 JSON':'ERP 부분 백업 JSON',
        route:'백업/내보내기 → 회사 JSON 검사 및 적용',
        count:keys.reduce((sum,key)=>sum+(parsed.data[key]?.length||0),0),
        summary:keys.length?keys.map(key=>`${datasetInfo(key).label} ${parsed.data[key].length}건`).join(' · '):'포함 데이터 없음'
      };
    }
    if(Array.isArray(parsed)){
      const key=detectLegacyArray(parsed);
      const labels={applicants:'지원자 전용 JSON',employees:'사원명부 전용 JSON',schools:'협력학교 전용 JSON',calendarEvents:'수동 일정 전용 JSON',hireWaitingProfiles:'입사대기 입력정보 전용 JSON',messageTemplates:'안내문 문구함 전용 JSON'};
      return {kind:`legacy-${key}`,label:labels[key]||'구형 배열 JSON',route:'백업/내보내기 → 회사 JSON 검사 및 적용',count:parsed.length,summary:`${datasetInfo(key).label} ${parsed.length}건`};
    }
    if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){
      const keys=DATASETS.filter(d=>Array.isArray(parsed[d.key])).map(d=>d.key);
      if(keys.length){
        const only=keys.length===1?keys[0]:'';
        const labels={applicants:'지원자 전용 JSON',employees:'사원명부 전용 JSON',schools:'협력학교 전용 JSON',calendarEvents:'수동 일정 전용 JSON',hireWaitingProfiles:'입사대기 입력정보 전용 JSON',messageTemplates:'안내문 문구함 전용 JSON'};
        return {
          kind:only?`legacy-${only}`:'legacy-mixed',
          label:only?(labels[only]||'구형 데이터 JSON'):'구형 ERP 혼합 JSON',
          route:'백업/내보내기 → 회사 JSON 검사 및 적용',
          count:keys.reduce((sum,key)=>sum+parsed[key].length,0),
          summary:keys.map(key=>`${datasetInfo(key).label} ${parsed[key].length}건`).join(' · ')
        };
      }
      if(Array.isArray(parsed.rows)){
        const key=detectLegacyArray(parsed.rows);
        const labels={applicants:'지원자 전용 JSON',employees:'사원명부 전용 JSON',schools:'협력학교 전용 JSON',calendarEvents:'수동 일정 전용 JSON',hireWaitingProfiles:'입사대기 입력정보 전용 JSON',messageTemplates:'안내문 문구함 전용 JSON'};
        return {kind:`rows-${key}`,label:labels[key]||'행 데이터 JSON',route:'백업/내보내기 → 회사 JSON 검사 및 적용',count:parsed.rows.length,summary:`${datasetInfo(key).label} ${parsed.rows.length}건`};
      }
    }
    return {kind:'unknown',label:'알 수 없는 JSON',route:'파일 생성 메뉴를 확인하세요.',count:0,summary:'지원되는 Recruit ERP 데이터 구조를 찾지 못했습니다.'};
  }
  function canonicalize(parsed){
    const fileType=classifyJsonPayload(parsed);
    const warnings=[];const errors=[];let data={};let meta={};let included=[];let legacy=false;
    if(fileType.kind==='employee-org'){
      const counts=countsOf({});
      return {
        meta:{format:parsed.format,schemaVersion:Number(parsed.schemaVersion||0),appVersion:parsed.appVersion||'확인 불가',backupType:'employee-org',createdAt:parsed.generatedAt||parsed.createdAt||'',environment:'home'},
        data:{},included:[],warnings:[],
        errors:[`이 파일은 ${fileType.label}입니다. ${fileType.route} 메뉴에서 사용하세요.`],
        invalid:{},full:false,legacy:false,counts,valid:false,routeBlocked:true,fileType
      };
    }
    if(Array.isArray(parsed)){
      legacy=true;const key=detectLegacyArray(parsed);data[key]=parsed;included=[key];
      warnings.push(`구형 배열 JSON입니다. ${datasetInfo(key).label} 데이터로만 인식했습니다.`);
      meta={format:'legacy-array',schemaVersion:0,appVersion:'확인 불가',backupType:key,createdAt:'',environment:'unknown'};
    }else if(parsed&&typeof parsed==='object'){
      if(parsed.format===BC_FORMAT&&parsed.data&&typeof parsed.data==='object'){
        meta={format:parsed.format,schemaVersion:Number(parsed.schemaVersion||0),appVersion:parsed.appVersion||'확인 불가',backupType:parsed.backupType||'unknown',createdAt:parsed.createdAt||'',environment:parsed.environment||'unknown',excelApplicantIds:Array.isArray(parsed.metadata?.excelApplicantIds)?parsed.metadata.excelApplicantIds.map(String):[]};
        DATASETS.forEach(d=>{if(Object.prototype.hasOwnProperty.call(parsed.data,d.key)){data[d.key]=parsed.data[d.key];included.push(d.key);}});
      }else{
        legacy=true;
        meta={format:'legacy-object',schemaVersion:0,appVersion:parsed.appVersion||parsed.version||'확인 불가',backupType:'legacy',createdAt:parsed.createdAt||parsed.exportedAt||parsed.backupDate||'',environment:parsed.environment||'unknown'};
        DATASETS.forEach(d=>{if(Object.prototype.hasOwnProperty.call(parsed,d.key)){data[d.key]=parsed[d.key];included.push(d.key);}});
        if(!included.length&&Array.isArray(parsed.rows)){
          const rowKey=detectLegacyArray(parsed.rows);
          data[rowKey]=parsed.rows;included=[rowKey];
        }
        warnings.push('구형 객체 JSON입니다. 포함된 데이터만 가져올 수 있습니다.');
      }
    }else errors.push('JSON 최상위 형식이 올바르지 않습니다.');

    if(!included.length)errors.push('지원자·협력학교·사원명부·수동 일정·입사대기 입력정보 데이터를 찾지 못했습니다.');
    const invalid={};
    included.forEach(k=>{
      if(!Array.isArray(data[k])){errors.push(`${datasetInfo(k).label} 데이터가 배열 형식이 아닙니다.`);invalid[k]=0;return;}
      invalid[k]=data[k].filter(x=>!x||typeof x!=='object'||Array.isArray(x)).length;
      if(invalid[k])errors.push(`${datasetInfo(k).label}에 객체가 아닌 항목 ${invalid[k]}건이 있습니다.`);
    });

    const actualCounts=countsOf(data);
    if(parsed&&parsed.counts&&typeof parsed.counts==='object'){
      included.forEach(k=>{if(Number(parsed.counts[k])!==actualCounts[k])warnings.push(`${datasetInfo(k).label}의 기록된 건수(${Number(parsed.counts[k])||0})와 실제 배열 건수(${actualCounts[k]})가 다릅니다.`);});
    }

    if(parsed&&parsed.integrity&&parsed.integrity.datasets){
      const computed={};included.forEach(k=>computed[k]=datasetFingerprint(k,data[k]).digest);
      included.forEach(k=>{if(parsed.integrity.datasets[k]&&parsed.integrity.datasets[k]!==computed[k])errors.push(`${datasetInfo(k).label} 무결성 값이 일치하지 않습니다. 파일이 변경되었거나 손상됐을 수 있습니다.`);});
      if(parsed.integrity.packageDigest){
        const digest=hashString(included.slice().sort().map(k=>`${k}:${computed[k]}`).join('|'));
        if(digest!==parsed.integrity.packageDigest)errors.push('백업 파일 전체 무결성 값이 일치하지 않습니다.');
      }
    }else if(!legacy){warnings.push('구형 백업 스키마라 무결성 서명이 없습니다. 건수와 내용을 더 꼼꼼히 확인하세요.');}

    if(meta.schemaVersion>BC_SCHEMA)warnings.push('현재 프로그램보다 새로운 백업 스키마입니다. 적용 전 호환성을 확인하세요.');
    if(meta.appVersion!=='확인 불가'&&compareVersions(meta.appVersion,BC_VERSION)>0)warnings.push(`백업 버전(${meta.appVersion})이 현재 프로그램(${BC_VERSION})보다 새롭습니다.`);
    const full=DATASETS.filter(d=>!d.optional).every(d=>included.includes(d.key));
    return {meta,data,included,warnings,errors,invalid,full,legacy,counts:actualCounts,valid:errors.length===0,routeBlocked:false,fileType};
  }

  function datasetDiff(key,currentRows,incomingRows){
    const cur=datasetFingerprint(key,currentRows);const next=datasetFingerprint(key,incomingRows);
    const c=new Map(cur.entries);const n=new Map(next.entries);
    let added=0,changed=0,missing=0,same=0;
    n.forEach((sig,id)=>{if(!c.has(id))added++;else if(c.get(id)!==sig)changed++;else same++;});
    c.forEach((sig,id)=>{if(!n.has(id))missing++;});
    return {added,changed,missing,same,current:cur.count,next:next.count};
  }
  function comparisonRows(canon){
    const now=currentData();
    return DATASETS.map(d=>{
      const has=canon.included.includes(d.key);
      const diff=has?datasetDiff(d.key,now[d.key]||[],canon.data[d.key]||[]):null;
      return {key:d.key,label:d.label,has,diff,current:(now[d.key]||[]).length,next:has?canon.counts[d.key]:null};
    });
  }
  function importRisks(canon){
    const risks=[];const now=countsOf(currentData());
    canon.included.forEach(k=>{
      const info=datasetInfo(k);const next=canon.counts[k];const cur=now[k];
      if(info.critical&&cur>0&&next===0)risks.push({level:'danger',key:k,message:`${info.label} ${cur}건이 0건으로 교체될 수 있습니다.`});
      else if(info.critical&&cur>=20&&next<Math.floor(cur*0.5))risks.push({level:'warning',key:k,message:`${info.label}가 ${cur}건에서 ${next}건으로 절반 이상 감소합니다.`});
    });
    return risks;
  }
  function renderInspection(){
    const box=bcEl('bcInspection');if(!box)return;
    if(!inspected){box.classList.remove('visible');box.innerHTML='';return;}
    const c=inspected.canonical;const rows=comparisonRows(c);const risks=importRisks(c);
    const statusClass=c.errors.length?'error':c.warnings.length?'warn':'ok';
    const statusTitle=c.routeBlocked?'전용 파일 메뉴가 다릅니다':c.errors.length?'파일 적용 불가':c.warnings.length?'파일 검사 완료 · 확인 필요':'파일 검사 완료';
    const messages=[...c.errors,...c.warnings];
    const type=c.fileType||{label:'JSON 파일',summary:'',route:''};
    const compareHtml=c.routeBlocked?`
      <div class="backup-json-route-guard">
        <div class="backup-json-route-icon">↪</div>
        <div><strong>${escHtml(type.label)}</strong><p>${escHtml(type.summary)}</p><span>올바른 위치: ${escHtml(type.route)}</span></div>
      </div>`:`
      ${risks.length?`<div class="backup-risk-list">${risks.map(r=>`<div class="backup-risk ${r.level}"><strong>${r.level==='danger'?'위험':'주의'}</strong><span>${escHtml(r.message)}</span></div>`).join('')}</div>`:''}
      <div class="backup-compare-wrap"><table class="backup-compare-table backup-compare-detailed"><thead><tr><th>데이터</th><th>현재</th><th>파일</th><th>신규</th><th>변경</th><th>파일에 없음</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r.label}</strong></td><td>${r.current}건</td><td>${r.has?`${r.next}건`:'—'}</td><td>${r.has?`${r.diff.added}건`:'—'}</td><td>${r.has?`${r.diff.changed}건`:'—'}</td><td>${r.has?`${r.diff.missing}건`:'—'}</td></tr>`).join('')}</tbody></table></div>
      <div class="backup-apply-explain"><div><strong>병합</strong><span>기존 데이터를 보존하고 신규·최근 수정본을 반영합니다.</span></div><div><strong>전체교체</strong><span>파일에 포함된 데이터 종류만 현재 로컬 데이터와 교체합니다.</span></div><div><strong>전체 ERP 복원</strong><span>네 종류가 모두 들어 있는 전체 백업에서만 가능합니다.</span></div></div>`;
    const actionHtml=c.routeBlocked?`
      <div class="backup-action-bar">
        <button class="primary" id="bcGoEmployeeOrgImport" type="button">사원명부로 이동</button>
        <button class="mini" id="bcClearInspection" type="button">파일 선택 취소</button>
      </div>`:`
      <div class="backup-action-bar">
        <button class="primary" id="bcMergeApply" type="button" ${c.valid?'':'disabled'}>데이터 병합 가져오기</button>
        <button class="ghost" id="bcReplaceApply" type="button" ${c.valid?'':'disabled'}>포함 데이터 전체교체</button>
        <button class="danger" id="bcFullRestore" type="button" ${c.valid&&c.full?'':'disabled'}>전체 ERP 복원</button>
        <button class="mini" id="bcClearInspection" type="button">파일 선택 취소</button>
      </div>`;
    box.innerHTML=`
      <div class="backup-file-summary">
        <div class="backup-file-meta"><span>파일명</span><strong>${escHtml(inspected.file.name)}</strong></div>
        <div class="backup-file-meta"><span>파일 크기</span><strong>${formatBytes(inspected.file.size)}</strong></div>
        <div class="backup-file-meta backup-file-type"><span>파일 유형</span><strong>${escHtml(type.label)}</strong><small>${escHtml(type.summary||'')}</small></div>
        <div class="backup-file-meta"><span>백업 버전</span><strong>${escHtml(c.meta.appVersion)}</strong></div>
        <div class="backup-file-meta"><span>백업 일시</span><strong>${escHtml(formatDate(c.meta.createdAt))}</strong></div>
        <div class="backup-file-meta"><span>생성 환경</span><strong>${escHtml(c.meta.environment==='company'?'회사':c.meta.environment==='home'?'집':'확인 불가')}</strong></div>
      </div>
      <div class="backup-validation-banner ${statusClass}"><strong>${statusTitle}</strong>${messages.length?`<ul>${messages.map(x=>`<li>${escHtml(x)}</li>`).join('')}</ul>`:'<p>파일 구조·배열·건수·무결성 검사를 통과했습니다.</p>'}</div>
      ${compareHtml}
      ${actionHtml}
      <p class="backup-danger-note">${c.routeBlocked?'잘못된 메뉴에서는 병합·전체교체·복원 버튼을 생성하지 않습니다.':'검사 단계에서는 데이터가 바뀌지 않습니다. 적용 직전 현재 ERP 전체 안전 백업 파일을 먼저 다운로드합니다.'}</p>`;
    box.classList.add('visible');
    bcEl('bcMergeApply')?.addEventListener('click',()=>applyImport('merge'));
    bcEl('bcReplaceApply')?.addEventListener('click',()=>applyImport('replace'));
    bcEl('bcFullRestore')?.addEventListener('click',()=>applyImport('restore'));
    bcEl('bcGoEmployeeOrgImport')?.addEventListener('click',()=>{
      clearInspection();
      if(typeof setPage==='function')setPage('employees');
      setTimeout(()=>document.getElementById('btnOpenEmployeeOrgImport')?.focus(),120);
    });
    bcEl('bcClearInspection')?.addEventListener('click',clearInspection);
  }

  function mergeObjects(existing,incoming){
    const out={...existing};Object.keys(incoming||{}).forEach(k=>{const v=incoming[k];if(v!==''&&v!==null&&v!==undefined)out[k]=v;});return out;
  }
  function newer(existing,incoming){const a=safeText(existing.updatedAt||existing.createdAt);const b=safeText(incoming.updatedAt||incoming.createdAt);return b&&(!a||b>=a);}
  function mergeDataset(key,current,incoming){
    const result=current.map(x=>deepClone(x));const index=new Map();
    result.forEach((row,i)=>{let id=safeText(row.id);if(key==='schools'&&!id)id=`name:${safeText(row.name).trim().toLowerCase()}`;if(key==='employees'&&!id)id=`emp:${safeText(row.empNo).trim()}`;if(id)index.set(id,i);});
    let added=0,updated=0,kept=0;
    incoming.forEach(raw=>{
      const row=deepClone(raw);let id=safeText(row.id);if(key==='schools'&&!id)id=`name:${safeText(row.name).trim().toLowerCase()}`;if(key==='employees'&&!id)id=`emp:${safeText(row.empNo).trim()}`;
      const idx=id?index.get(id):undefined;
      if(idx===undefined){result.push(row);if(id)index.set(id,result.length-1);added++;return;}
      const old=result[idx];
      if(key==='schools'){
        const merged=mergeObjects(old,row);merged.aliases=Array.from(new Set([...(Array.isArray(old.aliases)?old.aliases:[]),...(Array.isArray(row.aliases)?row.aliases:[])]));result[idx]=merged;updated++;
      }else if(newer(old,row)){result[idx]=mergeObjects(old,row);updated++;}else kept++;
    });
    return {rows:result,added,updated,kept};
  }
  function normalizeRows(key,rows){
    const valid=(Array.isArray(rows)?rows:[]).filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
    return valid.map(row=>{
      try{
        if(key==='applicants')return typeof normalize==='function'?normalize(row):row;
        if(key==='schools')return typeof normalizeSchool==='function'?normalizeSchool(row):row;
        if(key==='employees')return typeof normalizeEmployee==='function'?normalizeEmployee(row):row;
        if(key==='calendarEvents')return typeof normalizeCalendarEvent==='function'?normalizeCalendarEvent(row):row;
        if(key==='hireWaitingProfiles')return typeof normalizeHireWaitingProfile==='function'?normalizeHireWaitingProfile(row):row;
        if(key==='messageTemplates')return typeof normalizeMessageTemplate==='function'?normalizeMessageTemplate(row):row;
        return row;
      }catch(err){console.warn(`Backup normalize failed: ${key}`,err,row);return null;}
    }).filter(Boolean).filter(row=>{
      if(key==='schools')return !!row.name;
      if(key==='employees')return !!(row.name||row.empNo);
      if(key==='calendarEvents')return !!(row.title&&row.date);
      if(key==='hireWaitingProfiles')return !!row.applicantId;
      if(key==='messageTemplates')return !!(row.title||row.body);
      return true;
    });
  }
  function writeDatasets(next){
    if(Object.prototype.hasOwnProperty.call(next,'applicants')){applicants=normalizeRows('applicants',next.applicants);localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(applicants));}
    if(Object.prototype.hasOwnProperty.call(next,'schools')){schools=normalizeRows('schools',next.schools);localStorage.setItem('recruit_erp_schools',JSON.stringify(schools));}
    if(Object.prototype.hasOwnProperty.call(next,'employees')){employees=normalizeRows('employees',next.employees);localStorage.setItem('recruit_erp_employees',JSON.stringify(employees));}
    if(Object.prototype.hasOwnProperty.call(next,'calendarEvents')){calendarEvents=normalizeRows('calendarEvents',next.calendarEvents);localStorage.setItem('recruit_erp_calendar_events',JSON.stringify(calendarEvents));}
    if(Object.prototype.hasOwnProperty.call(next,'hireWaitingProfiles')){hireWaitingProfiles=normalizeRows('hireWaitingProfiles',next.hireWaitingProfiles);localStorage.setItem('recruit_erp_hire_waiting_profiles',JSON.stringify(hireWaitingProfiles));}
    if(Object.prototype.hasOwnProperty.call(next,'messageTemplates')){messageTemplates=normalizeRows('messageTemplates',next.messageTemplates);localStorage.setItem('recruit_erp_message_templates',JSON.stringify(messageTemplates));if(typeof renderMessageTemplateList==='function')renderMessageTemplateList();}
    if(typeof renderAll==='function')renderAll();
    if(typeof updateStorageNote==='function')updateStorageNote();
    refreshCounts();
    return countsOf(currentData());
  }
  function setPendingCloud(action){
    const state={at:new Date().toISOString(),status:'pending',mode:action.mode==='merge'?'upsert':'exact',importMode:action.mode,included:action.included.slice(),localCounts:countsOf(currentData()),results:[]};
    localStorage.setItem(BC_PENDING_CLOUD_KEY,JSON.stringify(state));renderCloudPanel();
  }
  function readPendingCloud(){try{return JSON.parse(localStorage.getItem(BC_PENDING_CLOUD_KEY)||'null');}catch{return null;}}
  function savePendingCloud(state){localStorage.setItem(BC_PENDING_CLOUD_KEY,JSON.stringify(state));renderCloudPanel();}

  function applyImport(mode){
    if(!assertHomeImport())return;
    if(!inspected)return;
    const c=inspected.canonical;if(!c.valid){alert('검사 오류가 있는 파일은 적용할 수 없습니다.');return;}
    if(mode==='restore'&&!c.full){alert('전체 ERP 복원은 지원자·협력학교·사원명부·수동 일정이 모두 포함된 백업만 가능합니다.');return;}
    const current=countsOf(currentData());const incoming=c.counts;const risks=importRisks(c);
    if(mode==='merge'){
      const summary=c.included.map(k=>`${datasetInfo(k).label}: 현재 ${current[k]}건 / 파일 ${incoming[k]}건`).join('\n');
      if(!confirm(`데이터 병합 가져오기 전 확인\n\n${summary}\n\n기존 데이터는 지우지 않고 같은 ID의 최근 수정본을 반영합니다. 진행할까요?`))return;
      backupCurrentBeforeChange('병합 가져오기 직전');
      const next={};const results=[];const now=currentData();
      c.included.forEach(k=>{const merged=mergeDataset(k,now[k]||[],normalizeRows(k,c.data[k]));next[k]=merged.rows;results.push(`${datasetInfo(k).label}: 신규 ${merged.added} · 갱신 ${merged.updated} · 유지 ${merged.kept}`);});
      const finalCounts=writeDatasets(next);
      if(c.included.includes('applicants')&&typeof window.erpSetExcelApplicantIds==='function'){
        const currentIds=typeof window.erpGetExcelApplicantIds==='function'?window.erpGetExcelApplicantIds():[];
        window.erpSetExcelApplicantIds([...currentIds,...(c.meta.excelApplicantIds||[])]);
      }
      recordHistory('데이터 병합 가져오기',results.join(' / '));
      setPendingCloud({mode,included:c.included});
      alert(`로컬 병합 완료\n\n${results.join('\n')}\n\n현재 브라우저에 반영했습니다. 백업센터의 클라우드 저장 상태에서 Supabase 저장을 확인하세요.`);
      console.info('Backup merge final counts',finalCounts);
    }else{
      const isRestore=mode==='restore';const title=isRestore?'전체 ERP 복원':'포함 데이터 전체교체';const normalPhrase=isRestore?'전체복원':'전체교체';const severe=risks.some(r=>r.level==='danger');const phrase=severe?`위험 ${normalPhrase}`:normalPhrase;
      const keys=isRestore?DATASETS.map(d=>d.key):c.included;
      const targets=keys.map(k=>`${datasetInfo(k).label}: ${current[k]}건 → ${incoming[k]}건`).join('\n');
      if(!confirm(`${title} 전 확인\n\n${targets}\n\n작업 직전에 현재 ERP 전체 안전 백업이 다운로드됩니다.${severe?'\n\n0건 교체 위험이 포함되어 있습니다.':''}`))return;
      const typed=prompt(`정말 진행하려면 아래 문구를 그대로 입력하세요.\n\n${phrase}`);
      if(typed!==phrase){alert('작업이 취소되었습니다.');return;}
      backupCurrentBeforeChange(`${title} 직전`);
      const next={};keys.forEach(k=>next[k]=c.data[k]||[]);
      const finalCounts=writeDatasets(next);
      if(keys.includes('applicants')&&typeof window.erpSetExcelApplicantIds==='function')window.erpSetExcelApplicantIds(c.meta.excelApplicantIds||[]);
      recordHistory(title,targets.replace(/\n/g,' / '));
      setPendingCloud({mode,included:keys});
      alert(`${title} 로컬 적용을 완료했습니다.\n\nSupabase에는 아직 자동 삭제·교체하지 않았습니다. 백업센터의 클라우드 저장 상태에서 전체 일치 저장을 직접 확인하세요.`);
      console.info('Backup replace final counts',finalCounts);
    }
    renderInspection();
  }

  async function inspectFile(file){
    if(!assertHomeImport()){const input=bcEl('bcFileInput');if(input)input.value='';return;}
    clearInspection(false);
    if(!file)return;
    if(file.size>BC_MAX_FILE_BYTES){alert('백업 파일이 50MB를 초과합니다. 파일을 다시 확인해주세요.');return;}
    if(!/\.json$/i.test(file.name||'')){alert('JSON 파일만 검사할 수 있습니다.');return;}
    try{
      const text=await file.text();const parsed=JSON.parse(text);const canonical=canonicalize(parsed);
      inspected={file,parsed,canonical};renderInspection();
      recordHistory('백업 파일 검사',`${file.name} · ${canonical.fileType?.label||canonical.included.map(k=>datasetInfo(k).label).join(', ')} · ${canonical.valid?'적용 가능':'적용 불가'}`);
    }catch(err){inspected=null;renderInspection();alert(`백업 파일 검사 실패\n\n${err.message||err}`);}
  }
  function clearInspection(resetInput=true){inspected=null;renderInspection();if(resetInput&&bcEl('bcFileInput'))bcEl('bcFileInput').value='';}

  function localStorageCheck(){
    try{const key='__recruit_erp_backup_test__';localStorage.setItem(key,'ok');const ok=localStorage.getItem(key)==='ok';localStorage.removeItem(key);return ok;}
    catch{return false;}
  }
  function runPreflight(showToast=true){
    const counts=countsOf(currentData());const changes=changesSinceBackup();const lastAt=changes.lastAt;const lastDay=dateLocalKey(lastAt);
    const storageOk=localStorageCheck();const criticalEmpty=DATASETS.filter(d=>d.critical&&counts[d.key]===0).map(d=>d.label);
    const sameDay=lastDay===todayKey();
    const ready=storageOk&&criticalEmpty.length===0&&!!lastAt&&sameDay&&changes.known&&changes.total===0;
    const items=[
      {ok:storageOk,label:'브라우저 저장소',detail:storageOk?'읽기·쓰기 정상':'저장소 접근 실패'},
      {ok:criticalEmpty.length===0,label:'핵심 데이터',detail:criticalEmpty.length?`${criticalEmpty.join(', ')} 0건 — 데이터 로드 상태 확인`:'지원자·학교·사원 데이터 확인'},
      {ok:!!lastAt,label:'전체 백업 기록',detail:lastAt?formatDate(lastAt):'전체 JSON 다운로드 기록 없음'},
      {ok:sameDay,label:'오늘 백업 여부',detail:sameDay?'오늘 다운로드 요청 기록 있음':'오늘 전체 백업 필요'},
      {ok:changes.known&&changes.total===0,label:'백업 이후 변경',detail:changes.known?changeSummaryText(changes):'비교 기준 백업 없음'}
    ];
    preflightResult={ready,items,counts,changes,at:new Date().toISOString()};
    renderPreflight();refreshCounts();
    if(showToast&&typeof uxToast==='function')uxToast(ready?'퇴근 전 백업 점검: 안전 상태입니다.':'퇴근 전 백업 점검: 전체 JSON 백업이 필요합니다.');
    return preflightResult;
  }
  function renderPreflight(){
    const el=bcEl('bcPreflightResult');if(!el)return;
    if(!preflightResult){el.innerHTML='<div class="backup-preflight-empty">점검 버튼을 눌러 현재 데이터와 백업 상태를 확인하세요.</div>';return;}
    el.innerHTML=`<div class="backup-preflight-head ${preflightResult.ready?'ready':'need'}"><strong>${preflightResult.ready?'퇴근 가능 · 백업 완료 상태':'백업 또는 확인 필요'}</strong><span>${formatDate(preflightResult.at)}</span></div><div class="backup-preflight-list">${preflightResult.items.map(x=>`<div class="backup-preflight-item ${x.ok?'ok':'warn'}"><span class="backup-preflight-mark">${x.ok?'✓':'!'}</span><strong>${escHtml(x.label)}</strong><small>${escHtml(x.detail)}</small></div>`).join('')}</div>`;
  }

  function applyEnvironmentUi(){
    const home=isHomeMode();const importSection=bcEl('bcHomeImportSection');const companySection=bcEl('bcCompanySection');const notice=bcEl('bcModeNotice');
    if(importSection){importSection.hidden=!home;importSection.setAttribute('aria-hidden',String(!home));}
    if(companySection)companySection.classList.toggle('backup-company-active',!home);
    if(notice){
      notice.className=`backup-mode-notice ${home?'home':'company'}`;
      notice.innerHTML=home
        ? '<strong>집 개발·복원 모드</strong><span>회사 JSON을 먼저 검사·비교한 뒤 로컬에 적용합니다. 적용 후 별도 확인 버튼으로 Supabase 저장 결과를 검증합니다.</span>'
        : '<strong>회사 로컬 운영 모드</strong><span>JSON 업로드·검사·복원 코드는 차단됩니다. 퇴근 전 점검 후 ERP 전체 JSON 다운로드만 진행하세요.</span>';
    }
    const title=bcEl('bcCompanyTitle');const desc=bcEl('bcCompanyDescription');const exportTitle=bcEl('bcExportTitle');const exportDesc=bcEl('bcExportDescription');const exportBtn=bcEl('bcExportFull');
    if(title)title.textContent=home?'집 모드 · 현재 ERP 안전 백업':'회사 모드 · 퇴근 전 JSON 다운로드';
    if(desc)desc.textContent=home?'회사 JSON 적용 전후 또는 개발 완료 후 현재 ERP 전체 데이터를 별도 보관하세요.':'회사에서는 업로드·복원하지 않습니다. 업무 종료 후 점검하고 ERP 전체 JSON만 다운로드하세요.';
    if(exportTitle)exportTitle.textContent=home?'현재 ERP 전체 안전 백업':'ERP 전체 백업';
    if(exportDesc)exportDesc.textContent=home?'지원자·협력학교·사원명부·수동 일정·입사대기 입력정보를 현재 상태 그대로 저장합니다. 입사대기 입력정보에는 주민등록번호가 포함될 수 있으므로 백업 파일을 안전하게 보관하세요.':'지원자·협력학교·사원명부·수동 일정·입사대기 입력정보와 백업 버전·일시·환경 정보를 포함합니다. 입사대기 입력정보에는 주민등록번호가 포함될 수 있으므로 백업 파일을 안전하게 보관하세요.';
    if(exportBtn)exportBtn.textContent=home?'현재 ERP 전체 JSON 다운로드':'ERP 전체 JSON 다운로드';
    if(!home){clearInspection();}
    renderCloudPanel();
  }

  function refreshCounts(){
    applyEnvironmentUi();
    const c=countsOf(currentData());const map={applicants:'bcCurrentApplicants',schools:'bcCurrentSchools',employees:'bcCurrentEmployees',calendarEvents:'bcCurrentEvents'};
    Object.keys(map).forEach(k=>{const el=bcEl(map[k]);if(el)el.textContent=`${c[k].toLocaleString()}건`;});
    const env=bcEl('bcCurrentEnvironment');if(env)env.textContent=environment()==='company'?'회사 모드':'집 모드';
    const last=bcEl('bcLastFullBackup');if(last)last.textContent=formatDate(localStorage.getItem(BC_LAST_FULL_KEY));
    const changes=changesSinceBackup();const ch=bcEl('bcChangesSinceBackup');if(ch)ch.textContent=changeSummaryText(changes);
    const readiness=bcEl('bcBackupReadiness');
    if(readiness){const lastDay=dateLocalKey(changes.lastAt);const ready=changes.known&&changes.total===0&&lastDay===todayKey();readiness.textContent=ready?'오늘 백업 완료':'백업 필요';readiness.classList.toggle('is-ready',ready);readiness.classList.toggle('is-needed',!ready);}
  }
  function renderHistory(){
    const el=bcEl('bcHistoryList');if(!el)return;let list=[];try{list=JSON.parse(localStorage.getItem(BC_HISTORY_KEY)||'[]');}catch{}
    if(!Array.isArray(list)||!list.length){el.innerHTML='<div class="backup-empty">이 브라우저의 백업센터 작업 기록이 아직 없습니다.</div>';return;}
    el.innerHTML=list.slice(0,10).map(x=>`<div class="backup-history-row"><time>${escHtml(formatDate(x.at))}</time><strong>${escHtml(x.action)}</strong><span>${escHtml(x.detail||'')}</span></div>`).join('');
  }

  function cloudRowsFor(key,rows,stripLegacy){
    if(key==='applicants')return rows.map(row=>{if(typeof applicantForCloud==='function')return applicantForCloud(row,!!stripLegacy);const copy={...row};if(stripLegacy)delete copy.employeeId;return copy;});
    if(key==='schools'&&stripLegacy)return rows.map(({managementStatus,...rest})=>rest);
    return rows.map(row=>({...row}));
  }
  async function cloudUpsertDataset(info,rows,onProgress){
    const groups=chunk(rows,BC_CLOUD_CHUNK);let done=0;let stripLegacy=false;
    for(let i=0;i<groups.length;i++){
      let payload=cloudRowsFor(info.key,groups[i],stripLegacy);
      let res=await window.sb.from(info.cloudTable).upsert(payload);
      if(res&&res.error&&info.key==='schools'&&safeText(res.error.message).includes('managementStatus')){
        stripLegacy=true;payload=cloudRowsFor(info.key,groups[i],true);res=await window.sb.from(info.cloudTable).upsert(payload);
      }
      if(res&&res.error&&info.key==='applicants'&&typeof applicantEmployeeIdColumnError==='function'&&applicantEmployeeIdColumnError(res.error)){
        stripLegacy=true;if(typeof applicantEmployeeIdCloudUnsupported!=='undefined')applicantEmployeeIdCloudUnsupported=true;payload=cloudRowsFor(info.key,groups[i],true);res=await window.sb.from(info.cloudTable).upsert(payload);
      }
      if(res&&res.error)throw new Error(res.error.message||`${info.label} 저장 실패`);
      done+=groups[i].length;if(onProgress)onProgress(done,rows.length,`${info.label} 저장`);
    }
    return {upserted:done,stripLegacy};
  }
  async function cloudFetchIds(info,onProgress){
    const ids=[];let from=0;
    while(true){
      const res=await window.sb.from(info.cloudTable).select('id').order('id',{ascending:true}).range(from,from+BC_CLOUD_PAGE-1);
      if(res&&res.error)throw new Error(res.error.message||`${info.label} 조회 실패`);
      const rows=(res&&res.data)||[];rows.forEach(x=>{if(x&&x.id!=null)ids.push(String(x.id));});
      if(onProgress)onProgress(ids.length,null,`${info.label} 클라우드 확인`);
      if(rows.length<BC_CLOUD_PAGE)break;from+=BC_CLOUD_PAGE;
      if(from>100000)throw new Error(`${info.label} 클라우드 조회가 비정상적으로 길어 중단했습니다.`);
    }
    return ids;
  }
  async function cloudDeleteIds(info,ids,onProgress){
    let deleted=0;
    for(const group of chunk(ids,BC_CLOUD_CHUNK)){
      const res=await window.sb.from(info.cloudTable).delete().in('id',group);
      if(res&&res.error)throw new Error(res.error.message||`${info.label} 불필요 행 삭제 실패`);
      deleted+=group.length;if(onProgress)onProgress(deleted,ids.length,`${info.label} 추가 행 정리`);
    }
    return deleted;
  }
  async function cloudCount(info){
    const res=await window.sb.from(info.cloudTable).select('id',{count:'exact',head:true});
    if(res&&res.error)throw new Error(res.error.message||`${info.label} 건수 확인 실패`);
    return Number(res&&res.count||0);
  }
  async function syncDataset(info,rows,mode,onProgress){
    const upsert=await cloudUpsertDataset(info,rows,onProgress);
    let deleted=0;
    if(mode==='exact'){
      const cloudIds=await cloudFetchIds(info,onProgress);const localIds=new Set(rows.map(x=>safeText(x&&x.id)).filter(Boolean));
      const extras=cloudIds.filter(id=>!localIds.has(id));
      if(extras.length)deleted=await cloudDeleteIds(info,extras,onProgress);
    }
    const count=await cloudCount(info);
    const ok=mode==='exact'?count===rows.length:count>=rows.length;
    if(!ok)throw new Error(`${info.label} 저장 후 건수 확인 실패: 로컬 ${rows.length}건 / 클라우드 ${count}건`);
    return {status:'ok',key:info.key,label:info.label,upserted:upsert.upserted,deleted,expected:rows.length,cloudCount:count,note:upsert.stripSchoolManagement?'Supabase 구형 스키마로 관리상태 제외 저장':''};
  }
  function cloudProgress(message,percent){
    const text=bcEl('bcCloudProgressText');const bar=bcEl('bcCloudProgressBar');
    if(text)text.textContent=message||'';if(bar)bar.style.width=`${Math.max(0,Math.min(100,percent||0))}%`;
  }
  async function syncPendingToCloud(){
    if(!assertHomeImport())return;
    const pending=readPendingCloud();if(!pending)return;
    if(!cloudReady()){alert('집 모드에서 Supabase 로그인이 완료되어야 저장할 수 있습니다. 왼쪽 아래 Supabase 로그인 후 다시 시도하세요.');renderCloudPanel();return;}
    if(pending.mode==='exact'){
      const phrase='클라우드 전체일치';
      const typed=prompt(`로컬 데이터에 없는 동일 테이블의 클라우드 행은 업로드 성공 후 삭제됩니다.\n현재 로컬 상태가 올바른지 확인하세요.\n\n진행하려면 아래 문구를 입력하세요.\n${phrase}`);
      if(typed!==phrase){alert('클라우드 전체일치 저장을 취소했습니다.');return;}
      if(pending.included.includes('applicants')&&typeof supabaseSnapshotSave==='function'){
        try{await supabaseSnapshotSave('백업센터 클라우드 전체일치 직전');}catch(err){console.warn('Applicant snapshot before exact sync failed',err);}
      }
    }else if(!confirm('현재 로컬 데이터를 Supabase에 병합 저장하고 저장 후 건수를 확인할까요?'))return;

    pending.status='running';pending.results=[];pending.startedAt=new Date().toISOString();savePendingCloud(pending);
    const data=currentData();const targets=pending.included.map(datasetInfo).filter(x=>x&&x.cloudTable);let completed=0;const results=[];
    try{
      for(const info of targets){
        const rows=normalizeRows(info.key,data[info.key]||[]);
        try{
          const result=await syncDataset(info,rows,pending.mode,(done,total,label)=>{
            const within=total?done/Math.max(total,1):0.5;const overall=(completed+within)/Math.max(targets.length,1);
            cloudProgress(`${label} ${total?`${done}/${total}`:done+'건'}`,Math.round(overall*100));
          });
          results.push(result);
        }catch(err){results.push({status:'error',key:info.key,label:info.label,message:err.message||String(err)});}
        completed++;cloudProgress(`${info.label} 처리 완료`,Math.round(completed/Math.max(targets.length,1)*100));
      }
      pending.status=results.some(x=>x.status==='error')?'error':'done';pending.results=results;pending.finishedAt=new Date().toISOString();savePendingCloud(pending);
      if(typeof setCloudSyncStatus==='function')setCloudSyncStatus(pending.status==='done'?'ok':'error');
      const summary=results.map(x=>x.status==='ok'?`${x.label}: ${x.cloudCount}건 확인${x.deleted?` · ${x.deleted}건 정리`:''}`:`${x.label}: 실패 · ${x.message}`).join('\n');
      recordHistory(pending.mode==='exact'?'Supabase 전체일치 저장':'Supabase 병합 저장',summary.replace(/\n/g,' / '));
      alert(`${pending.status==='done'?'Supabase 저장 및 확인 완료':'일부 Supabase 저장 실패'}\n\n${summary}`);
    }catch(err){
      pending.status='error';pending.results=results.concat([{status:'error',key:'system',label:'전체 작업',message:err.message||String(err)}]);pending.finishedAt=new Date().toISOString();savePendingCloud(pending);
      if(typeof setCloudSyncStatus==='function')setCloudSyncStatus('error');
      alert(`Supabase 저장 중 오류가 발생했습니다.\n\n${err.message||err}`);
    }
  }
  function clearCloudState(){localStorage.removeItem(BC_PENDING_CLOUD_KEY);renderCloudPanel();}
  function renderCloudPanel(){
    const panel=bcEl('bcCloudSyncPanel');if(!panel)return;
    if(!isHomeMode()){panel.hidden=true;return;}
    panel.hidden=false;
    const state=readPendingCloud();const status=bcEl('bcCloudSyncStatus');const result=bcEl('bcCloudSyncResult');const btn=bcEl('bcCloudSyncButton');const clear=bcEl('bcCloudSyncClear');
    if(!state){
      if(status)status.innerHTML='<strong>적용 대기 없음</strong><span>회사 JSON을 로컬에 병합하거나 전체교체하면 여기에서 Supabase 저장 여부를 확인합니다.</span>';
      if(result)result.innerHTML='';if(btn){btn.disabled=true;btn.textContent='Supabase 저장할 변경 없음';}if(clear)clear.hidden=true;cloudProgress('',0);return;
    }
    const modeLabel=state.mode==='exact'?'전체 일치 저장':'병합 저장';const ready=cloudReady();
    if(status){
      const statusLabel=state.status==='running'?'저장 진행 중':state.status==='done'?'저장 확인 완료':state.status==='error'?'저장 실패 · 재시도 가능':'로컬 적용 완료 · 클라우드 저장 대기';
      status.innerHTML=`<strong>${statusLabel}</strong><span>${modeLabel} · ${state.included.map(k=>datasetInfo(k)?.label||k).join(', ')} · ${formatDate(state.at)}</span>${!ready?'<small>현재 Supabase 로그인이 확인되지 않습니다.</small>':''}`;
    }
    if(result){result.innerHTML=(state.results||[]).map(x=>x.status==='ok'?`<div class="backup-cloud-result ok"><strong>${escHtml(x.label)}</strong><span>클라우드 ${x.cloudCount}건 확인 · 저장 ${x.upserted}건${x.deleted?` · 추가 행 ${x.deleted}건 정리`:''}${x.note?` · ${escHtml(x.note)}`:''}</span></div>`:`<div class="backup-cloud-result error"><strong>${escHtml(x.label)}</strong><span>${escHtml(x.message||'저장 실패')}</span></div>`).join('');}
    if(btn){btn.disabled=state.status==='running'||!ready;btn.textContent=state.status==='done'?'Supabase 다시 확인 저장':state.status==='error'?'Supabase 저장 재시도':state.mode==='exact'?'Supabase 전체 일치 저장 및 확인':'Supabase 병합 저장 및 확인';}
    if(clear)clear.hidden=state.status==='running';
  }

  function bind(){
    bcEl('bcExportFull')?.addEventListener('click',()=>exportBackup('full'));
    DATASETS.forEach(d=>bcEl(`bcExport-${d.key}`)?.addEventListener('click',()=>exportBackup(d.key)));
    bcEl('bcRunPreflight')?.addEventListener('click',()=>runPreflight(true));
    bcEl('bcFileInput')?.addEventListener('change',e=>inspectFile(e.target.files&&e.target.files[0]));
    bcEl('bcCloudSyncButton')?.addEventListener('click',syncPendingToCloud);
    bcEl('bcCloudSyncClear')?.addEventListener('click',()=>{if(confirm('클라우드 저장 상태 표시를 지울까요? 로컬 데이터와 Supabase 데이터는 변경되지 않습니다.'))clearCloudState();});
    const zone=bcEl('bcDropZone');
    if(zone){
      ['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();if(!isHomeMode())return;zone.classList.add('dragover');}));
      ['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('dragover');}));
      zone.addEventListener('drop',e=>{if(!assertHomeImport())return;inspectFile(e.dataTransfer.files&&e.dataTransfer.files[0]);});
    }
    document.addEventListener('click',e=>{if(e.target.closest('[data-page="backup"], [data-go="backup"], [data-operation-mode]'))setTimeout(()=>{refreshCounts();renderHistory();renderPreflight();renderCloudPanel();},0);});
    window.addEventListener('storage',()=>{refreshCounts();renderHistory();renderCloudPanel();});
  }
  function init(){
    document.documentElement.dataset.erpVersion=BC_VERSION;
    refreshCounts();renderHistory();renderPreflight();renderCloudPanel();bind();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

  window.erpBackupCenter={
    exportFull:()=>exportBackup('full'),safetyBackup:(reason='manual safety backup')=>backupCurrentBeforeChange(reason),inspectFile,runPreflight,syncPendingToCloud,version:BC_VERSION,
    getStatus:()=>({environment:environment(),changes:changesSinceBackup(),pendingCloud:readPendingCloud(),inspection:inspected&&inspected.canonical}),
    __test:{canonicalize,classifyJsonPayload,datasetDiff,snapshotOf,compareFingerprints,packageFor,importRisks}
  };
})();
