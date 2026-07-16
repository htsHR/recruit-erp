/* ===== CONSOLIDATED SOURCE: backup-center-v10.38.0.js ===== */
/* Recruit ERP v10.38.0 BACKUP_CENTER
 * localStorage Master 환경용 전체/부분 백업, 검사, 비교, 병합, 전체교체, 전체복원
 * 기존 핵심 저장키와 데이터 필드 구조는 변경하지 않습니다.
 */
(function(){
  'use strict';
  const BC_VERSION='10.38.0';
  const BC_FORMAT='recruit-erp-backup';
  const BC_SCHEMA=1;
  const BC_LAST_FULL_KEY='recruit_erp_last_full_backup_at';
  const BC_HISTORY_KEY='recruit_erp_backup_center_history';
  const BC_MAX_FILE_BYTES=50*1024*1024;
  const DATASETS=[
    {key:'applicants',label:'지원자',storage:'recruit_erp_applicants_stable'},
    {key:'schools',label:'협력학교',storage:'recruit_erp_schools'},
    {key:'employees',label:'사원명부',storage:'recruit_erp_employees'},
    {key:'calendarEvents',label:'수동 일정',storage:'recruit_erp_calendar_events'}
  ];
  let inspected=null;
  const bcEl=id=>document.getElementById(id);
  const safeText=v=>String(v==null?'':v);
  const escHtml=v=>safeText(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const localIso=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().replace('T','_').replace(/:/g,'-').slice(0,19);};
  const formatDate=v=>{if(!v)return '기록 없음';const d=new Date(v);return Number.isNaN(d.getTime())?safeText(v):d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
  const formatBytes=n=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(1)} MB`;
  function environment(){
    try{return typeof uxGetOperationEnvironment==='function'?uxGetOperationEnvironment():(localStorage.getItem('recruit_erp_ui_operation_environment')==='company'?'company':'home');}
    catch{return 'home';}
  }
  function environmentLabel(mode){return mode==='company'?'회사 로컬 운영':'집 개발·복원';}
  function isHomeMode(){return environment()!=='company';}
  function assertHomeImport(){if(isHomeMode())return true;alert('회사 모드에서는 JSON 업로드·병합·전체교체·복원을 사용할 수 없습니다. 집 모드에서 진행하세요.');return false;}
  function currentData(){return {applicants:Array.isArray(applicants)?applicants:[],schools:Array.isArray(schools)?schools:[],employees:Array.isArray(employees)?employees:[],calendarEvents:Array.isArray(calendarEvents)?calendarEvents:[]};}
  function countsOf(data){const out={};DATASETS.forEach(d=>out[d.key]=Array.isArray(data[d.key])?data[d.key].length:0);return out;}
  function deepClone(v){return JSON.parse(JSON.stringify(v));}
  function downloadFile(name,content,mime='application/json'){
    const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function packageFor(keys,reason='manual'){
    const all=currentData();const data={};keys.forEach(k=>data[k]=deepClone(all[k]||[]));
    return {format:BC_FORMAT,schemaVersion:BC_SCHEMA,appVersion:BC_VERSION,backupType:keys.length===DATASETS.length?'full':keys[0],createdAt:new Date().toISOString(),environment:environment(),environmentLabel:environmentLabel(environment()),reason,counts:countsOf(data),data};
  }
  function fileName(type,prefix='recruit_erp'){
    const names={full:'full_backup',applicants:'applicants',schools:'schools',employees:'employees',calendarEvents:'manual_calendar'};
    return `${prefix}_${names[type]||type}_${localIso()}.json`;
  }
  function recordHistory(action,detail){
    let list=[];try{list=JSON.parse(localStorage.getItem(BC_HISTORY_KEY)||'[]');if(!Array.isArray(list))list=[];}catch{list=[];}
    list.unshift({at:new Date().toISOString(),action,detail});localStorage.setItem(BC_HISTORY_KEY,JSON.stringify(list.slice(0,12)));renderHistory();
  }
  function exportBackup(type,reason='manual'){
    const keys=type==='full'?DATASETS.map(d=>d.key):[type];
    const pack=packageFor(keys,reason);downloadFile(fileName(type),JSON.stringify(pack,null,2));
    if(type==='full'){
      localStorage.setItem(BC_LAST_FULL_KEY,pack.createdAt);
      localStorage.setItem('recruit_erp_last_backup_date',pack.createdAt.slice(0,10));
    }
    recordHistory(type==='full'?'ERP 전체 백업':`${DATASETS.find(d=>d.key===type)?.label||type} 백업`,`${keys.map(k=>`${DATASETS.find(d=>d.key===k).label} ${pack.counts[k]}건`).join(' · ')} · ${environmentLabel(pack.environment)}`);
    refreshCounts();
    if(typeof uxToast==='function')uxToast(type==='full'?'ERP 전체 백업을 다운로드했습니다.':'선택 데이터를 백업했습니다.');
  }
  function backupCurrentBeforeChange(reason){
    const pack=packageFor(DATASETS.map(d=>d.key),reason);downloadFile(`recruit_erp_safety_before_${localIso()}.json`,JSON.stringify(pack,null,2));
    recordHistory('안전 백업 자동 생성',reason);
  }
  function detectLegacyArray(arr){
    const sample=arr.find(x=>x&&typeof x==='object')||{};
    if('empNo'in sample||'department'in sample||'leaveDate'in sample)return 'employees';
    if('title'in sample&&'date'in sample&&('importance'in sample||'type'in sample))return 'calendarEvents';
    if('aliases'in sample||'managementStatus'in sample||'mouDate'in sample||'contactPhone'in sample)return 'schools';
    return 'applicants';
  }
  function canonicalize(parsed){
    const warnings=[];let data={};let meta={};let included=[];let legacy=false;
    if(Array.isArray(parsed)){
      legacy=true;const key=detectLegacyArray(parsed);data[key]=parsed;included=[key];warnings.push(`구형 배열 JSON으로 감지했습니다. ${DATASETS.find(d=>d.key===key).label} 데이터로 검사합니다.`);
      meta={format:'legacy-array',schemaVersion:0,appVersion:'확인 불가',backupType:key,createdAt:'',environment:'unknown'};
    }else if(parsed&&typeof parsed==='object'){
      if(parsed.format===BC_FORMAT&&parsed.data&&typeof parsed.data==='object'){
        meta={format:parsed.format,schemaVersion:parsed.schemaVersion||0,appVersion:parsed.appVersion||'확인 불가',backupType:parsed.backupType||'unknown',createdAt:parsed.createdAt||'',environment:parsed.environment||'unknown'};
        DATASETS.forEach(d=>{if(Object.prototype.hasOwnProperty.call(parsed.data,d.key)){data[d.key]=parsed.data[d.key];included.push(d.key);}});
      }else{
        legacy=true;meta={format:'legacy-object',schemaVersion:0,appVersion:parsed.appVersion||parsed.version||'확인 불가',backupType:'legacy',createdAt:parsed.createdAt||parsed.exportedAt||parsed.backupDate||'',environment:parsed.environment||'unknown'};
        DATASETS.forEach(d=>{if(Object.prototype.hasOwnProperty.call(parsed,d.key)){data[d.key]=parsed[d.key];included.push(d.key);}});
        if(!included.length&&Array.isArray(parsed.rows)){data.applicants=parsed.rows;included=['applicants'];}
        warnings.push('구형 객체 JSON으로 감지했습니다. 포함된 데이터만 가져올 수 있습니다.');
      }
    }else throw new Error('JSON 최상위 형식이 올바르지 않습니다.');
    if(!included.length)throw new Error('지원자·협력학교·사원명부·수동 일정 데이터를 찾지 못했습니다.');
    included.forEach(k=>{if(!Array.isArray(data[k]))throw new Error(`${DATASETS.find(d=>d.key===k).label} 데이터가 배열 형식이 아닙니다.`);});
    const invalid={};included.forEach(k=>{invalid[k]=data[k].filter(x=>!x||typeof x!=='object'||Array.isArray(x)).length;if(invalid[k])warnings.push(`${DATASETS.find(d=>d.key===k).label}에 객체가 아닌 항목 ${invalid[k]}건이 있습니다.`);});
    const full=DATASETS.every(d=>included.includes(d.key));
    if(meta.schemaVersion>BC_SCHEMA)warnings.push('현재 프로그램보다 새로운 백업 스키마입니다. 적용 전 내용을 확인하세요.');
    return {meta,data,included,warnings,invalid,full,legacy,counts:countsOf(data)};
  }
  function comparisonRows(canon){
    const cur=countsOf(currentData());
    return DATASETS.map(d=>{const has=canon.included.includes(d.key);const next=has?canon.counts[d.key]:null;const delta=has?next-cur[d.key]:null;return {key:d.key,label:d.label,current:cur[d.key],next,delta,has};});
  }
  function deltaText(row){if(!row.has)return '<span class="backup-not-included">파일에 없음</span>';if(row.delta===0)return '변동 없음';return `<span class="backup-delta ${row.delta>0?'up':'down'}">${row.delta>0?'+':''}${row.delta}건</span>`;}
  function renderInspection(){
    const box=bcEl('bcInspection');if(!box)return;
    if(!inspected){box.classList.remove('visible');box.innerHTML='';return;}
    const c=inspected.canonical;const invalidTotal=Object.values(c.invalid).reduce((a,b)=>a+b,0);const valid=!invalidTotal;
    const warnings=c.warnings.length?c.warnings.join(' '):'백업 파일의 기본 구조와 배열 형식을 확인했습니다.';
    const rows=comparisonRows(c);
    box.innerHTML=`
      <div class="backup-file-summary">
        <div class="backup-file-meta"><span>파일명</span><strong>${escHtml(inspected.file.name)}</strong></div>
        <div class="backup-file-meta"><span>파일 크기</span><strong>${formatBytes(inspected.file.size)}</strong></div>
        <div class="backup-file-meta"><span>백업 버전</span><strong>${escHtml(c.meta.appVersion)}</strong></div>
        <div class="backup-file-meta"><span>백업 일시</span><strong>${escHtml(formatDate(c.meta.createdAt))}</strong></div>
        <div class="backup-file-meta"><span>생성 환경</span><strong>${escHtml(c.meta.environment==='company'?'회사':c.meta.environment==='home'?'집':'확인 불가')}</strong></div>
      </div>
      <div class="backup-validation-banner ${valid?(c.warnings.length?'warn':'ok'):'error'}"><strong>${valid?'파일 검사 완료':'파일 검사 경고'}</strong><br>${escHtml(warnings)}</div>
      <div class="backup-compare-wrap"><table class="backup-compare-table"><thead><tr><th>데이터</th><th>현재 브라우저</th><th>백업 파일</th><th>차이</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r.label}</strong></td><td>${r.current}건</td><td>${r.has?`${r.next}건`:'—'}</td><td>${deltaText(r)}</td></tr>`).join('')}</tbody></table></div>
      <div class="backup-action-bar">
        <button class="primary" id="bcMergeApply" type="button" ${valid?'':'disabled'}>데이터 병합 가져오기</button>
        <button class="ghost" id="bcReplaceApply" type="button" ${valid?'':'disabled'}>포함 데이터 전체교체</button>
        <button class="danger" id="bcFullRestore" type="button" ${valid&&c.full?'':'disabled'}>전체 ERP 복원</button>
        <button class="mini" id="bcClearInspection" type="button">파일 선택 취소</button>
      </div>
      <p class="backup-danger-note">병합은 기존 데이터를 보존하면서 같은 ID의 최근 수정본을 반영합니다. 전체교체는 파일에 포함된 항목을 현재 브라우저 데이터와 바꿉니다. 전체 ERP 복원은 네 종류의 데이터가 모두 포함된 파일에서만 사용할 수 있습니다.</p>`;
    box.classList.add('visible');
    bcEl('bcMergeApply')?.addEventListener('click',()=>applyImport('merge'));
    bcEl('bcReplaceApply')?.addEventListener('click',()=>applyImport('replace'));
    bcEl('bcFullRestore')?.addEventListener('click',()=>applyImport('restore'));
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
      let row=deepClone(raw);let id=safeText(row.id);if(key==='schools'&&!id)id=`name:${safeText(row.name).trim().toLowerCase()}`;if(key==='employees'&&!id)id=`emp:${safeText(row.empNo).trim()}`;
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
    const valid=rows.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
    if(key==='applicants')return valid.map(normalize);
    if(key==='schools')return valid.map(normalizeSchool).filter(x=>x.name);
    if(key==='employees')return valid.map(normalizeEmployee).filter(x=>x.name||x.empNo);
    if(key==='calendarEvents')return valid.map(normalizeCalendarEvent).filter(x=>x.title&&x.date);
    return valid;
  }
  function writeDatasets(next){
    if(Object.prototype.hasOwnProperty.call(next,'applicants')){applicants=normalizeRows('applicants',next.applicants);localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(applicants));}
    if(Object.prototype.hasOwnProperty.call(next,'schools')){schools=normalizeRows('schools',next.schools);localStorage.setItem('recruit_erp_schools',JSON.stringify(schools));}
    if(Object.prototype.hasOwnProperty.call(next,'employees')){employees=normalizeRows('employees',next.employees);localStorage.setItem('recruit_erp_employees',JSON.stringify(employees));}
    if(Object.prototype.hasOwnProperty.call(next,'calendarEvents')){calendarEvents=normalizeRows('calendarEvents',next.calendarEvents);localStorage.setItem('recruit_erp_calendar_events',JSON.stringify(calendarEvents));}
    if(typeof renderAll==='function')renderAll();
    if(typeof updateStorageNote==='function')updateStorageNote();
    refreshCounts();
  }
  function applyImport(mode){
    if(!assertHomeImport())return;
    if(!inspected)return;const c=inspected.canonical;
    if(mode==='restore'&&!c.full){alert('전체 ERP 복원은 지원자·협력학교·사원명부·수동 일정이 모두 포함된 백업만 가능합니다.');return;}
    const current=countsOf(currentData());const incoming=c.counts;
    if(mode==='merge'){
      const summary=c.included.map(k=>`${DATASETS.find(d=>d.key===k).label}: 현재 ${current[k]}건 + 파일 ${incoming[k]}건`).join('\n');
      if(!confirm(`데이터 병합 가져오기 전 확인\n\n${summary}\n\n기존 데이터는 지우지 않고 같은 ID는 최근 수정본을 반영합니다. 진행할까요?`))return;
      backupCurrentBeforeChange('병합 가져오기 직전');
      const next={};const results=[];const now=currentData();
      c.included.forEach(k=>{const merged=mergeDataset(k,now[k]||[],normalizeRows(k,c.data[k]));next[k]=merged.rows;results.push(`${DATASETS.find(d=>d.key===k).label}: 신규 ${merged.added} · 갱신 ${merged.updated} · 유지 ${merged.kept}`);});
      writeDatasets(next);recordHistory('데이터 병합 가져오기',results.join(' / '));alert(`병합 완료\n\n${results.join('\n')}`);
    }else{
      const isRestore=mode==='restore';const title=isRestore?'전체 ERP 복원':'포함 데이터 전체교체';const phrase=isRestore?'전체복원':'전체교체';
      const targets=(isRestore?DATASETS.map(d=>d.key):c.included).map(k=>`${DATASETS.find(d=>d.key===k).label}: ${current[k]}건 → ${incoming[k]}건`).join('\n');
      if(!confirm(`${title} 전 확인\n\n${targets}\n\n작업 직전에 현재 ERP 전체 안전 백업이 자동 다운로드됩니다.`))return;
      const typed=prompt(`정말 진행하려면 아래 문구를 그대로 입력하세요.\n\n${phrase}`);if(typed!==phrase){alert('작업이 취소되었습니다.');return;}
      backupCurrentBeforeChange(`${title} 직전`);
      const next={};(isRestore?DATASETS.map(d=>d.key):c.included).forEach(k=>next[k]=c.data[k]||[]);
      writeDatasets(next);recordHistory(title,targets.replace(/\n/g,' / '));alert(`${title}이 완료되었습니다.`);
    }
    renderInspection();
  }
  async function inspectFile(file){
    if(!assertHomeImport()){const input=bcEl('bcFileInput');if(input)input.value='';return;}
    clearInspection(false);
    if(!file)return;if(file.size>BC_MAX_FILE_BYTES){alert('백업 파일이 50MB를 초과합니다. 파일을 다시 확인해주세요.');return;}
    try{const text=await file.text();const parsed=JSON.parse(text);const canonical=canonicalize(parsed);inspected={file,parsed,canonical};renderInspection();recordHistory('백업 파일 검사',`${file.name} · ${canonical.included.map(k=>DATASETS.find(d=>d.key===k).label).join(', ')}`);}
    catch(err){inspected=null;renderInspection();alert(`백업 파일 검사 실패\n\n${err.message||err}`);}
  }
  function clearInspection(resetInput=true){inspected=null;renderInspection();if(resetInput&&bcEl('bcFileInput'))bcEl('bcFileInput').value='';}
  function applyEnvironmentUi(){
    const home=isHomeMode();
    const importSection=bcEl('bcHomeImportSection');
    const companySection=bcEl('bcCompanySection');
    const notice=bcEl('bcModeNotice');
    if(importSection){importSection.hidden=!home;importSection.setAttribute('aria-hidden',String(!home));}
    if(companySection)companySection.classList.toggle('backup-company-active',!home);
    if(notice){
      notice.className=`backup-mode-notice ${home?'home':'company'}`;
      notice.innerHTML=home
        ? '<strong>집 개발·복원 모드</strong><span>회사에서 내려받은 JSON을 검사한 뒤 병합 또는 전체교체하고, 완료 후 Supabase 저장 상태를 확인하세요.</span>'
        : '<strong>회사 로컬 운영 모드</strong><span>퇴근 전 ERP 전체 JSON을 다운로드하세요. 회사에서는 JSON 업로드·복원 기능이 숨겨집니다.</span>';
    }
    if(!home)clearInspection();
  }
  function refreshCounts(){
    applyEnvironmentUi();
    const c=countsOf(currentData());const map={applicants:'bcCurrentApplicants',schools:'bcCurrentSchools',employees:'bcCurrentEmployees',calendarEvents:'bcCurrentEvents'};
    Object.keys(map).forEach(k=>{const el=bcEl(map[k]);if(el)el.textContent=`${c[k].toLocaleString()}건`;});
    const env=bcEl('bcCurrentEnvironment');if(env)env.textContent=environment()==='company'?'회사 모드':'집 모드';
    const last=bcEl('bcLastFullBackup');if(last)last.textContent=formatDate(localStorage.getItem(BC_LAST_FULL_KEY));
  }
  function renderHistory(){
    const el=bcEl('bcHistoryList');if(!el)return;let list=[];try{list=JSON.parse(localStorage.getItem(BC_HISTORY_KEY)||'[]');}catch{}
    if(!Array.isArray(list)||!list.length){el.innerHTML='<div class="backup-empty">이 브라우저의 백업센터 작업 기록이 아직 없습니다.</div>';return;}
    el.innerHTML=list.slice(0,8).map(x=>`<div class="backup-history-row"><time>${escHtml(formatDate(x.at))}</time><strong>${escHtml(x.action)}</strong><span>${escHtml(x.detail||'')}</span></div>`).join('');
  }
  function bind(){
    bcEl('bcExportFull')?.addEventListener('click',()=>exportBackup('full'));
    DATASETS.forEach(d=>bcEl(`bcExport-${d.key}`)?.addEventListener('click',()=>exportBackup(d.key)));
    bcEl('bcFileInput')?.addEventListener('change',e=>inspectFile(e.target.files&&e.target.files[0]));
    const zone=bcEl('bcDropZone');if(zone){['dragenter','dragover'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add('dragover');}));['dragleave','drop'].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove('dragover');}));zone.addEventListener('drop',e=>inspectFile(e.dataTransfer.files&&e.dataTransfer.files[0]));}
    document.addEventListener('click',e=>{if(e.target.closest('[data-page="backup"], [data-go="backup"], [data-operation-mode]'))setTimeout(()=>{refreshCounts();renderHistory();},0);});
    window.addEventListener('storage',()=>{refreshCounts();renderHistory();});
  }
  function init(){document.documentElement.dataset.erpVersion=BC_VERSION;refreshCounts();renderHistory();bind();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  window.erpBackupCenter={exportFull:()=>exportBackup('full'),inspectFile,version:BC_VERSION};
})();

;

