/* ===== CONSOLIDATED SOURCE: advanced-bulk-v10.38.4.js ===== */
(()=>{
'use strict';
const SAVED_KEY='recruit_erp_saved_advanced_searches';
const MANAGER_KEY='recruit_erp_applicant_manager_assignments';
const selected=new Set(); let advancedResults=[]; let bulkMode=false;
const el=id=>document.getElementById(id); const q=(s,r=document)=>r.querySelector(s); const qa=(s,r=document)=>[...r.querySelectorAll(s)];
const safe=s=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const managers=()=>{try{return JSON.parse(localStorage.getItem(MANAGER_KEY)||'{}')}catch{return {}}};
const saveManagers=x=>localStorage.setItem(MANAGER_KEY,JSON.stringify(x));
const uniq=a=>[...new Set(a.filter(Boolean).map(x=>String(x).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko'));
function dl(name,text,type='text/plain;charset=utf-8'){const b=new Blob(['\ufeff'+text],{type});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function dateOK(v,from,to){if(from&&(!v||v<from))return false;if(to&&(!v||v>to))return false;return true}
function hydrateOptions(){
 const fill=(id,vals)=>{const s=el(id);if(!s)return;const cur=s.value;s.innerHTML='<option value="all">전체</option>'+vals.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');if([...s.options].some(o=>o.value===cur))s.value=cur};
 fill('asStatus',typeof STATUS_OPTIONS!=='undefined'?STATUS_OPTIONS:uniq(applicants.map(a=>a.status))); fill('asWorkplace',uniq(applicants.map(a=>a.workplace))); fill('asSchool',uniq(applicants.map(a=>a.school))); fill('asManager',uniq(Object.values(managers())));
}
const fields=['ApplyFrom','ApplyTo','InterviewFrom','InterviewTo','HireFrom','HireTo','Status','Workplace','School','Manager','Contact','Dorm','Keyword'];
function criteria(){const o={};fields.forEach(k=>o[k]=el('as'+k)?.value||'');return o}
function setCriteria(o={}){fields.forEach(k=>{const x=el('as'+k);if(x)x.value=o[k]??(x.tagName==='SELECT'?'all':'')});updateConditionCount()}
function updateConditionCount(){const c=criteria();const n=Object.entries(c).filter(([k,v])=>v&&v!=='all').length; if(el('asConditionCount'))el('asConditionCount').textContent=`${n}개 조건`}
function runSearch(){
 const c=criteria(), ms=managers(), kw=c.Keyword.toLowerCase();
 advancedResults=applicants.filter(a=>dateOK(a.applyDate,c.ApplyFrom,c.ApplyTo)&&dateOK(a.interviewDate,c.InterviewFrom,c.InterviewTo)&&dateOK(a.hireDate,c.HireFrom,c.HireTo))
 .filter(a=>c.Status==='all'||a.status===c.Status).filter(a=>c.Workplace==='all'||a.workplace===c.Workplace).filter(a=>c.School==='all'||a.school===c.School).filter(a=>c.Manager==='all'||ms[a.id]===c.Manager)
 .filter(a=>c.Contact==='all'||(c.Contact==='needed'&&['미연락','부재중'].includes(a.status))||(c.Contact==='done'&&!['미연락','부재중'].includes(a.status))||(c.Contact==='missing'&&!String(a.phone||'').trim()))
 .filter(a=>c.Dorm==='all'||(c.Dorm==='pending'&&['미확인','확인필요'].includes(typeof dormLabel==='function'?dormLabel(a):a.dormUse))||(c.Dorm!=='pending'&&(typeof dormLabel==='function'?dormLabel(a):a.dormUse)===c.Dorm))
 .filter(a=>!kw||[a.name,a.phone,a.school,a.workplace,a.status,ms[a.id]].join(' ').toLowerCase().includes(kw)); window.__erpAdvancedFilterIds=advancedResults.map(a=>a.id); renderAdvanced(); if(typeof renderTable==='function')renderTable();
}
function renderAdvanced(){const ms=managers();const summary=el('asSummary'),list=el('asResultList');if(!summary||!list){updateBulkDock();return;}summary.textContent=`총 ${advancedResults.length}명 · 선택 ${[...selected].filter(id=>advancedResults.some(a=>a.id===id)).length}명`;list.innerHTML=advancedResults.length?advancedResults.map(a=>`<label class="advanced-result-item ${selected.has(a.id)?'selected':''}"><input type="checkbox" data-advanced-id="${a.id}" ${selected.has(a.id)?'checked':''}><span class="advanced-result-copy"><strong>${safe(a.name||'이름없음')} · ${safe(a.status||'')}</strong><small>${safe(a.phone||'연락처 없음')} · ${safe(a.school||'학교 미입력')} · ${safe(a.workplace||'근무지 미입력')}</small></span><span class="advanced-result-meta">지원 ${safe(a.applyDate||'-')}<br>면접 ${safe(a.interviewDate||'-')}<br>${ms[a.id]?`담당 ${safe(ms[a.id])}`:'담당자 미지정'}</span></label>`).join(''):'<div class="empty">조건에 맞는 지원자가 없습니다.</div>';updateBulkDock()}
function saved(){try{return JSON.parse(localStorage.getItem(SAVED_KEY)||'[]')}catch{return []}}
function renderSaved(){const target=el('asSavedList');if(!target)return;target.innerHTML=saved().map((x,i)=>`<span class="saved-search-chip"><button data-load-search="${i}">${safe(x.name)}</button><button title="삭제" data-delete-search="${i}">×</button></span>`).join('')||'<span class="muted">저장된 검색조건이 없습니다.</span>'}
function saveCurrent(){const name=el('asSavedName').value.trim();if(!name)return alert('검색조건 이름을 입력해주세요.');const arr=saved();arr.unshift({name,criteria:criteria(),createdAt:new Date().toISOString()});localStorage.setItem(SAVED_KEY,JSON.stringify(arr.slice(0,20)));el('asSavedName').value='';renderSaved()}
function selectedApplicants(){return applicants.filter(a=>selected.has(a.id))}
function updateBulkDock(){const rows=selectedApplicants(),dock=el('bulkDock');el('bulkSelectedCount').textContent=rows.length;el('bulkSelectedNames').textContent=rows.slice(0,5).map(a=>a.name||'이름없음').join(', ')+(rows.length>5?` 외 ${rows.length-5}명`:'');dock.classList.toggle('show',rows.length>0);dock.setAttribute('aria-hidden',rows.length?'false':'true');decorateRows()}
function decorateRows(){
 qa('#applicantTbody tr.applicant-row').forEach(tr=>{
  const onclick=tr.getAttribute('onclick')||'';
  const m=onclick.match(/viewApplicant\('([^']+)'\)/);
  if(!m)return;
  const id=m[1];
  const td=tr.querySelector('td.no-cell')||tr.firstElementChild;
  if(!td)return;
  if(bulkMode){
   if(!td.dataset.originalHtml)td.dataset.originalHtml=td.innerHTML;
   td.classList.add('bulk-select-cell');
   td.innerHTML=`<input class="bulk-row-checkbox" type="checkbox" data-bulk-id="${id}" ${selected.has(id)?'checked':''} aria-label="${safe(tr.querySelector('.name-button')?.textContent||'지원자')} 선택">`;
  }else if(td.classList.contains('bulk-select-cell')){
   td.innerHTML=td.dataset.originalHtml||'';
   delete td.dataset.originalHtml;
   td.classList.remove('bulk-select-cell');
  }
  tr.classList.toggle('bulk-selection-mode',bulkMode);
 });
 const th=q('#applicants table thead tr');
 if(th){
  const first=th.firstElementChild;
  if(first){
   if(bulkMode){
    if(!first.dataset.originalText)first.dataset.originalText=first.textContent;
    first.classList.add('bulk-head-cell');
    first.textContent='선택';
   }else if(first.classList.contains('bulk-head-cell')){
    first.textContent=first.dataset.originalText||'NO';
    delete first.dataset.originalText;
    first.classList.remove('bulk-head-cell');
   }
  }
 }
 const btn=el('bulkModeButton');
 if(btn){btn.classList.toggle('active',bulkMode);btn.textContent=bulkMode?'선택 종료':'선택'}
}
function ensureBulkToggle(){ decorateRows(); }
function toggleBulkMode(){bulkMode=!bulkMode;if(!bulkMode){selected.clear();updateBulkDock()}decorateRows()}
function openBulk(){const rows=selectedApplicants();if(!rows.length)return alert('지원자를 먼저 선택해주세요.');el('bulkTargetSummary').innerHTML=`<strong>처리 대상 ${rows.length}명</strong><br>${safe(rows.map(a=>a.name||'이름없음').join(', '))}`;el('bulkModal').classList.add('open');el('bulkModal').setAttribute('aria-hidden','false');syncBulkValue();previewBulk()}
function closeBulk(){el('bulkModal').classList.remove('open');el('bulkModal').setAttribute('aria-hidden','true');el('bulkConfirmCheck').checked=false;el('bulkApply').disabled=true}
function syncBulkValue(){const f=el('bulkField').value,sel=el('bulkValueSelect'),inp=el('bulkValueInput');let vals=[];if(f==='status')vals=typeof STATUS_OPTIONS!=='undefined'?STATUS_OPTIONS:uniq(applicants.map(a=>a.status));if(f==='workplace')vals=uniq(applicants.map(a=>a.workplace));sel.style.display=f==='manager'?'none':'';inp.style.display=f==='manager'?'':'none';if(f!=='manager')sel.innerHTML=vals.map(v=>`<option value="${safe(v)}">${safe(v)}</option>`).join('');previewBulk()}
function bulkValue(){return el('bulkField').value==='manager'?el('bulkValueInput').value.trim():el('bulkValueSelect').value}
function previewBulk(){const f=el('bulkField').value,v=bulkValue(),labels={status:'상태',manager:'담당자',workplace:'근무지'};el('bulkPreview').innerHTML=`<strong>${selected.size}명 대상</strong><p>${labels[f]}를 <b>${safe(v||'값 미입력')}</b>(으)로 변경합니다.</p><small>실행 전 대상 인원과 변경 내용을 다시 확인하세요.</small>`}
function applyBulk(){const rows=selectedApplicants(),f=el('bulkField').value,v=bulkValue();if(!rows.length||!v)return alert('대상과 변경 값을 확인해주세요.');if(!el('bulkConfirmCheck').checked)return;if(!confirm(`${rows.length}명의 ${f==='status'?'상태':f==='manager'?'담당자':'근무지'}를 "${v}"(으)로 변경할까요?`))return;if(f==='manager'){const ms=managers();rows.forEach(a=>ms[a.id]=v);saveManagers(ms)}else{applicants=applicants.map(a=>selected.has(a.id)?{...a,[f]:v,updatedAt:new Date().toISOString()}:a);save()}closeBulk();hydrateOptions();runSearch();alert(`${rows.length}명 일괄 변경을 완료했습니다.`)}
function csv(){const rows=selectedApplicants(),ms=managers();const cols=['성명','연락처','상태','근무지','학교','지원일','면접일','입사일','담당자'];const lines=[cols.join(','),...rows.map(a=>[a.name,a.phone,a.status,a.workplace,a.school,a.applyDate,a.interviewDate,a.hireDate,ms[a.id]||''].map(v=>'"'+String(v||'').replaceAll('"','""')+'"').join(','))];dl(`지원자_선택_${rows.length}명_${new Date().toISOString().slice(0,10)}.csv`,lines.join('\n'),'text/csv;charset=utf-8')}
function printRows(){const rows=selectedApplicants(),ms=managers();const w=open('','_blank');w.document.write(`<html><head><title>선택 지원자</title><style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px;font-size:12px}h2{margin:0 0 16px}</style></head><body><h2>선택 지원자 ${rows.length}명</h2><table><thead><tr><th>성명</th><th>상태</th><th>연락처</th><th>근무지</th><th>학교</th><th>면접일</th><th>담당자</th></tr></thead><tbody>${rows.map(a=>`<tr><td>${safe(a.name)}</td><td>${safe(a.status)}</td><td>${safe(a.phone)}</td><td>${safe(a.workplace)}</td><td>${safe(a.school)}</td><td>${safe(a.interviewDate)}</td><td>${safe(ms[a.id]||'')}</td></tr>`).join('')}</tbody></table></body></html>`);w.document.close();w.print()}
function messages(){const rows=selectedApplicants();const text=rows.map(a=>{let body='';if(['면접예정','다음면접'].includes(a.status))body=`안녕하세요, ${a.name}님. 에이치티솔루션 채용 담당자입니다. ${a.workplace||'지원 근무지'} 면접 일정은 ${[a.interviewDate,a.interviewTime].filter(Boolean).join(' ')||'협의 예정'}입니다. 확인 후 회신 부탁드립니다.`;else if(a.status==='입사예정')body=`안녕하세요, ${a.name}님. ${a.workplace||'지원 근무지'} 입사 예정일은 ${a.hireDate||'협의된 날짜'}입니다. 출근 관련 안내를 확인해 주세요.`;else body=`안녕하세요, ${a.name}님. 에이치티솔루션 채용 담당자입니다. 지원해주신 내용과 관련하여 연락드립니다. 확인 후 회신 부탁드립니다.`;return `[${a.name} · ${a.phone||'연락처 없음'}]\n${body}`}).join('\n\n------------------------------\n\n');dl(`지원자_안내문_${rows.length}명_${new Date().toISOString().slice(0,10)}.txt`,text)}
function bind(){
 hydrateOptions();renderSaved();ensureBulkToggle();updateConditionCount(); el('bulkModeButton')?.addEventListener('click',toggleBulkMode);
 qa('#advancedSearch input,#advancedSearch select').forEach(x=>x.addEventListener('change',updateConditionCount)); const asRun=el('asRun'),asReset=el('asReset'),asSave=el('asSave');if(asRun)asRun.onclick=runSearch;if(asReset)asReset.onclick=()=>{setCriteria({});advancedResults=[];window.__erpAdvancedFilterIds=null;renderAdvanced();if(typeof renderTable==='function')renderTable()};if(asSave)asSave.onclick=saveCurrent;
 el('asSavedList').onclick=e=>{const l=e.target.closest('[data-load-search]'),d=e.target.closest('[data-delete-search]');const arr=saved();if(l){setCriteria(arr[+l.dataset.loadSearch].criteria);runSearch()}if(d){arr.splice(+d.dataset.deleteSearch,1);localStorage.setItem(SAVED_KEY,JSON.stringify(arr));renderSaved()}};
 const asResultList=el('asResultList');
 if(asResultList)asResultList.onchange=e=>{const c=e.target.closest('[data-advanced-id]');if(!c)return;c.checked?selected.add(c.dataset.advancedId):selected.delete(c.dataset.advancedId);renderAdvanced()};
 const asSelectAll=el('asSelectAll');if(asSelectAll)asSelectAll.onclick=()=>{advancedResults.forEach(a=>selected.add(a.id));renderAdvanced()};
 const asGoBulk=el('asGoBulk');if(asGoBulk)asGoBulk.onclick=openBulk;
 document.addEventListener('change',e=>{const c=e.target.closest('[data-bulk-id]');if(!c)return;c.checked?selected.add(c.dataset.bulkId):selected.delete(c.dataset.bulkId);updateBulkDock()});
 const bulkClear=el('bulkClear');if(bulkClear)bulkClear.onclick=()=>{selected.clear();renderAdvanced();updateBulkDock()};
 const bulkOpen=el('bulkOpen');if(bulkOpen)bulkOpen.onclick=openBulk;
 const bulkClose=el('bulkClose'),bulkBackdrop=el('bulkBackdrop');if(bulkClose)bulkClose.onclick=closeBulk;if(bulkBackdrop)bulkBackdrop.onclick=closeBulk;
 qa('[data-bulk-tab]').forEach(b=>b.onclick=()=>{qa('[data-bulk-tab]').forEach(x=>x.classList.toggle('active',x===b));qa('[data-bulk-pane]').forEach(p=>p.classList.toggle('active',p.dataset.bulkPane===b.dataset.bulkTab))});
 const bulkField=el('bulkField'),bulkValueSelect=el('bulkValueSelect'),bulkValueInput=el('bulkValueInput'),bulkConfirmCheck=el('bulkConfirmCheck'),bulkApply=el('bulkApply'),bulkCsv=el('bulkCsv'),bulkPrint=el('bulkPrint'),bulkMessages=el('bulkMessages');
 if(bulkField)bulkField.onchange=syncBulkValue;if(bulkValueSelect)bulkValueSelect.onchange=previewBulk;if(bulkValueInput)bulkValueInput.oninput=previewBulk;if(bulkConfirmCheck)bulkConfirmCheck.onchange=()=>{if(bulkApply)bulkApply.disabled=!bulkConfirmCheck.checked};if(bulkApply)bulkApply.onclick=applyBulk;if(bulkCsv)bulkCsv.onclick=csv;if(bulkPrint)bulkPrint.onclick=printRows;if(bulkMessages)bulkMessages.onclick=messages;
 const oldRender=window.renderTable;window.renderTable=function(){oldRender.apply(this,arguments);setTimeout(decorateRows)};const oldAll=window.renderAll;if(oldAll)window.renderAll=function(){oldAll.apply(this,arguments);setTimeout(()=>{hydrateOptions();decorateRows()})};
 const oldSet=window.setPage;window.setPage=function(page){oldSet(page);if(page==='advancedSearch'){hydrateOptions();renderSaved();runSearch()}};
 setTimeout(()=>{ensureBulkToggle();decorateRows()},100);
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind):bind();
})();

;

