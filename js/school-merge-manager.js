/* Recruit ERP v10.40.29 SCHOOL_EXACT_AUTO_LINK
 * 기준 학교 ID를 유지하고 사용자가 선택한 통합 대상 학교의 연결만 안전하게 이동합니다.
 * 자동 병합·자동 선택·자동 삭제를 수행하지 않습니다.
 */
(function(){
'use strict';
let schoolMergeBusy=false;
let schoolMergeSelectedGroup='';
const byId=id=>document.getElementById(id);
const mergeCompact=v=>String(v||'').trim().toLowerCase().replace(/[\s\-_.·(),]/g,'');
const mergeEsc=v=>String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const dateValue=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
const latestDate=(a,b)=>[dateValue(a),dateValue(b)].filter(Boolean).sort().slice(-1)[0]||'';
const earliestDate=(a,b)=>[dateValue(a),dateValue(b)].filter(Boolean).sort()[0]||'';
function distinctText(a,b,sourceName){
  const x=String(a||'').trim(),y=String(b||'').trim();
  if(!y||x===y)return x;
  if(!x)return y;
  return `${x}\n[통합: ${sourceName}] ${y}`;
}
function schoolMergeGroups(){
  const exact=new Map(),compact=new Map();
  (Array.isArray(schools)?schools:[]).forEach(s=>{
    const name=String(s.name||'').trim(); if(!name)return;
    const e=name.toLowerCase(),c=mergeCompact(name);
    if(!exact.has(e))exact.set(e,[]);exact.get(e).push(s);
    if(c){if(!compact.has(c))compact.set(c,[]);compact.get(c).push(s);}
  });
  const groups=[];const seen=new Set();
  exact.forEach(list=>{if(list.length>1){const key=list.map(s=>s.id).sort().join('|');seen.add(key);groups.push({key,type:'동일 학교명',schools:list});}});
  compact.forEach(list=>{
    const names=new Set(list.map(s=>String(s.name||'').trim()));
    if(list.length<2||names.size<2)return;
    const key=list.map(s=>s.id).sort().join('|');if(seen.has(key))return;
    seen.add(key);groups.push({key,type:'표기 차이',schools:list});
  });
  return groups.sort((a,b)=>a.schools[0].name.localeCompare(b.schools[0].name,'ko'));
}
function schoolOptionHtml(selected){
  return '<option value="">학교 선택</option>'+[...schools].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ko')).map(s=>`<option value="${mergeEsc(s.id)}" ${String(s.id)===String(selected)?'selected':''}>${mergeEsc(s.name)}</option>`).join('');
}
function fillSchoolMergeSelects(targetId='',sourceId=''){
  const target=byId('schoolMergeTarget'),source=byId('schoolMergeSource');
  if(target)target.innerHTML=schoolOptionHtml(targetId);
  if(source)source.innerHTML=schoolOptionHtml(sourceId);
}
function countLinks(id){
  return {applicants:applicants.filter(a=>String(a.schoolId||'')===String(id)).length,employees:employees.filter(e=>String(e.schoolId||'')===String(id)).length};
}
function valueText(v){return String(v||'').trim()||'-';}
function renderSchoolMergeCandidates(){
  const list=byId('schoolMergeCandidateList');if(!list)return;
  const q=mergeCompact(byId('schoolMergeSearch')?.value);
  const groups=schoolMergeGroups().filter(g=>!q||g.schools.some(s=>mergeCompact(s.name).includes(q)));
  const count=byId('schoolMergeCandidateCount');if(count)count.textContent=`${groups.length}그룹`;
  list.innerHTML=groups.length?groups.map(g=>{
    const names=g.schools.map(s=>s.name).join(' / ');
    const links=g.schools.reduce((acc,s)=>{const c=countLinks(s.id);acc.a+=c.applicants;acc.e+=c.employees;return acc;},{a:0,e:0});
    return `<button type="button" class="school-merge-candidate ${schoolMergeSelectedGroup===g.key?'active':''}" data-school-merge-group="${mergeEsc(g.key)}"><strong>${mergeEsc(names)}</strong><span>${g.type} · 지원자 ${links.a}명 · 사원 ${links.e}명</span></button>`;
  }).join(''):'<div class="empty">현재 조건에서 중복 의심 학교가 없습니다. 아래 선택창에서는 모든 학교를 직접 비교할 수 있습니다.</div>';
  list.querySelectorAll('[data-school-merge-group]').forEach(btn=>btn.addEventListener('click',()=>{
    const group=groups.find(g=>g.key===btn.dataset.schoolMergeGroup);if(!group)return;
    schoolMergeSelectedGroup=group.key;
    fillSchoolMergeSelects(group.schools[0].id,group.schools[1].id);
    renderSchoolMergeCandidates();renderSchoolMergePreview();
  }));
}
function compareRow(label,target,source,result){return `<div class="school-merge-compare-row"><div>${mergeEsc(label)}</div><div>${mergeEsc(valueText(target))}</div><div>${mergeEsc(valueText(source))}</div><div>${mergeEsc(valueText(result))}</div></div>`;}
function mergedSchoolPreview(target,source){
  const aliases=[...(target.aliases||[]),source.name,...(source.aliases||[])].map(x=>String(x||'').trim()).filter(Boolean).filter((x,i,a)=>a.findIndex(y=>y.toLowerCase()===x.toLowerCase())===i&&x.toLowerCase()!==String(target.name||'').toLowerCase());
  return {
    ...target,id:target.id,name:target.name,
    type:target.type||source.type||'',region:target.region||source.region||'',
    contact:target.contact||source.contact||'',contactPhone:target.contactPhone||source.contactPhone||'',
    mouDate:earliestDate(target.mouDate,source.mouDate),managementStatus:target.managementStatus||source.managementStatus||'',
    lastContactDate:latestDate(target.lastContactDate,source.lastContactDate),nextContactDate:latestDate(target.nextContactDate,source.nextContactDate),
    lastRequestNote:distinctText(target.lastRequestNote,source.lastRequestNote,source.name),notes:distinctText(target.notes,source.notes,source.name),
    aliases,hrStats:target.hrStats||source.hrStats||null,updatedAt:new Date().toISOString()
  };
}
function renderSchoolMergePreview(){
  const target=schools.find(s=>String(s.id)===String(byId('schoolMergeTarget')?.value));
  const source=schools.find(s=>String(s.id)===String(byId('schoolMergeSource')?.value));
  const preview=byId('schoolMergePreview'),validation=byId('schoolMergeValidation'),apply=byId('btnApplySchoolMerge'),confirmBox=byId('schoolMergeConfirm'),summary=byId('schoolMergeSelectionSummary');
  if(confirmBox)confirmBox.checked=false;
  if(!target||!source){if(preview)preview.innerHTML='<div class="empty">기준 학교와 통합 대상 학교를 선택해 주세요.</div>';if(validation)validation.innerHTML='';if(apply)apply.disabled=true;if(summary)summary.textContent='선택된 학교 없음';return;}
  if(String(target.id)===String(source.id)){if(validation)validation.innerHTML='<div class="warn">같은 학교를 기준 학교와 통합 대상으로 동시에 선택할 수 없습니다.</div>';if(preview)preview.innerHTML='';if(apply)apply.disabled=true;if(summary)summary.textContent='서로 다른 학교를 선택하세요.';return;}
  const tc=countLinks(target.id),sc=countLinks(source.id),merged=mergedSchoolPreview(target,source);
  if(validation)validation.innerHTML=`<div class="ok">기준 학교 ID <strong>${mergeEsc(target.id)}</strong>는 유지되고 통합 대상 ID <strong>${mergeEsc(source.id)}</strong>는 통합 완료 후 삭제됩니다.</div>`;
  if(summary)summary.textContent=`${target.name} ← ${source.name}`;
  if(preview)preview.innerHTML=`<div class="school-merge-summary-grid"><div class="school-merge-summary-card"><span>이동할 지원자</span><strong>${sc.applicants}명</strong></div><div class="school-merge-summary-card"><span>이동할 사원</span><strong>${sc.employees}명</strong></div><div class="school-merge-summary-card"><span>기준 학교 기존 연결</span><strong>${tc.applicants+tc.employees}명</strong></div><div class="school-merge-summary-card"><span>통합 후 연결 합계</span><strong>${tc.applicants+tc.employees+sc.applicants+sc.employees}명</strong></div></div><div class="school-merge-compare"><div class="school-merge-compare-row"><div>항목</div><div>기준 학교</div><div>통합 대상</div><div>통합 결과</div></div>${compareRow('학교명',target.name,source.name,merged.name)}${compareRow('지역/주소',target.address||target.region,source.address||source.region,merged.address||merged.region)}${compareRow('학교 구분',target.type,source.type,merged.type)}${compareRow('MOU 체결일',target.mouDate,source.mouDate,merged.mouDate)}${compareRow('담당자',target.contact,source.contact,merged.contact)}${compareRow('연락처',target.contactPhone,source.contactPhone,merged.contactPhone)}${compareRow('관리상태',target.managementStatus,source.managementStatus,merged.managementStatus)}${compareRow('최근 관리일',target.lastContactDate,source.lastContactDate,merged.lastContactDate)}${compareRow('다음 연락일',target.nextContactDate,source.nextContactDate,merged.nextContactDate)}${compareRow('관리 메모',target.lastRequestNote||target.notes,source.lastRequestNote||source.notes,merged.lastRequestNote||merged.notes)}</div><div class="school-merge-result-note">기준 학교에 이미 값이 있으면 그 값을 우선 유지합니다. 비어 있는 항목만 통합 대상 값으로 보완하고, 별칭과 서로 다른 메모는 함께 보존합니다.</div>`;
  if(apply)apply.disabled=true;
}
function schoolMergeSafetyBackup(){
  if(window.erpBackupCenter&&typeof window.erpBackupCenter.safetyBackup==='function')return window.erpBackupCenter.safetyBackup('중복 학교 통합 직전');
  if(window.erpBackupCenter&&typeof window.erpBackupCenter.exportFull==='function')return window.erpBackupCenter.exportFull();
  const payload={format:'recruit-erp-backup',appVersion:'10.40.29',createdAt:new Date().toISOString(),reason:'중복 학교 통합 직전',applicants,schools,employees,calendarEvents};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Recruit_ERP_학교통합전_안전백업_${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return payload;
}
async function applySchoolMerge(){
  if(schoolMergeBusy)return;
  const target=schools.find(s=>String(s.id)===String(byId('schoolMergeTarget')?.value));
  const source=schools.find(s=>String(s.id)===String(byId('schoolMergeSource')?.value));
  if(!target||!source||target.id===source.id){alert('기준 학교와 통합 대상 학교를 올바르게 선택해 주세요.');return;}
  if(!byId('schoolMergeConfirm')?.checked){alert('통합 내용을 확인한 뒤 확인 항목을 체크해 주세요.');return;}
  const sourceLinks=countLinks(source.id);
  if(!confirm(`“${source.name}”을(를) “${target.name}”으로 통합할까요?\n\n지원자 ${sourceLinks.applicants}명 · 사원 ${sourceLinks.employees}명의 schoolId가 이동합니다.\n통합 대상 학교 레코드는 삭제되며, 기준 학교 ID는 유지됩니다.`))return;
  schoolMergeBusy=true;const btn=byId('btnApplySchoolMerge');if(btn){btn.disabled=true;btn.textContent='통합 중...';}
  try{
    schoolMergeSafetyBackup();
    const merged=mergedSchoolPreview(target,source);
    applicants=applicants.map(a=>String(a.schoolId||'')===String(source.id)?{...a,schoolId:target.id,school:target.name}:a);
    employees=employees.map(e=>String(e.schoolId||'')===String(source.id)?{...e,schoolId:target.id,school:target.name}:e);
    schools=schools.filter(s=>String(s.id)!==String(source.id)).map(s=>String(s.id)===String(target.id)?normalizeSchool(merged):s);
    localStorage.setItem(STORAGE_KEY,JSON.stringify(applicants));
    localStorage.setItem(EMPLOYEES_KEY,JSON.stringify(employees));
    localStorage.setItem(SCHOOLS_KEY,JSON.stringify(schools));
    if(typeof supabaseSyncAll==='function')supabaseSyncAll(applicants);
    if(typeof supabaseSyncEmployees==='function')supabaseSyncEmployees(employees);
    if(typeof supabaseSyncSchools==='function')supabaseSyncSchools(schools);
    if(typeof supabaseDeleteSchool==='function')supabaseDeleteSchool(source.id);
    populateSchoolDatalist();renderSchoolManage();renderSchools();renderTable();renderEmployees();
    closeSchoolMergeManager();
    if(typeof uxToast==='function')uxToast(`${source.name}을(를) ${target.name}으로 통합했습니다.`);else alert('학교 통합이 완료되었습니다.');
  }catch(e){console.error('학교 통합 실패',e);alert(`학교 통합 중 오류가 발생했습니다.\n${e.message||e}`);}finally{schoolMergeBusy=false;if(btn){btn.textContent='안전백업 후 통합';}}
}
function openSchoolMergeManager(targetId='',sourceId=''){
  const modal=byId('schoolMergeModal');if(!modal)return;
  fillSchoolMergeSelects(targetId,sourceId);schoolMergeSelectedGroup='';
  modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');
  renderSchoolMergeCandidates();renderSchoolMergePreview();
}
function closeSchoolMergeManager(){const modal=byId('schoolMergeModal');if(!modal)return;modal.classList.remove('show');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');schoolMergeSelectedGroup='';}
function initSchoolMergeManager(){
  byId('btnOpenSchoolMergeManager')?.addEventListener('click',()=>openSchoolMergeManager());
  byId('btnCloseSchoolMerge')?.addEventListener('click',closeSchoolMergeManager);byId('btnCancelSchoolMerge')?.addEventListener('click',closeSchoolMergeManager);byId('schoolMergeBackdrop')?.addEventListener('click',closeSchoolMergeManager);
  byId('schoolMergeSearch')?.addEventListener('input',renderSchoolMergeCandidates);
  byId('schoolMergeTarget')?.addEventListener('change',renderSchoolMergePreview);byId('schoolMergeSource')?.addEventListener('change',renderSchoolMergePreview);
  byId('btnSwapSchoolMerge')?.addEventListener('click',()=>{const t=byId('schoolMergeTarget'),s=byId('schoolMergeSource');if(!t||!s)return;const v=t.value;t.value=s.value;s.value=v;renderSchoolMergePreview();});
  byId('schoolMergeConfirm')?.addEventListener('change',e=>{const target=byId('schoolMergeTarget')?.value,source=byId('schoolMergeSource')?.value;byId('btnApplySchoolMerge').disabled=!(e.target.checked&&target&&source&&target!==source);});
  byId('btnApplySchoolMerge')?.addEventListener('click',applySchoolMerge);
}
window.openSchoolMergeManager=openSchoolMergeManager;window.closeSchoolMergeManager=closeSchoolMergeManager;window.schoolMergeGroups=schoolMergeGroups;window.applySchoolMerge=applySchoolMerge;
initSchoolMergeManager();
})();
