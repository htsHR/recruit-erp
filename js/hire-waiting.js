/* Personal waiting-list workflow. Excel input and outgoing files stay in this browser. */
(function(root,factory){
  'use strict';
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpHireWaiting=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const COLUMNS=[
    {key:'no',label:'NO',type:'number',width:8},
    {key:'employeeNo',label:'사원번호',width:14},
    {key:'contactStatus',label:'연락상태',width:14},
    {key:'hireDate',label:'입사날짜',type:'date',width:14},
    {key:'workplace',label:'근무지',width:14},
    {key:'pmtc',label:'PMTC 입과 대상',width:21},
    {key:'gender',label:'성별',width:9},
    {key:'group',label:'그룹',width:14},
    {key:'product',label:'제품',width:14},
    {key:'part',label:'파트',width:14},
    {key:'name',label:'성명',width:12},
    {key:'grade',label:'직급',width:9},
    {key:'residentNumber',label:'주민등록번호',width:19},
    {key:'birthDate',label:'생년월일',type:'date',width:14},
    {key:'age',label:'(만)나이',type:'number',width:10},
    {key:'email',label:'이메일',width:28},
    {key:'education',label:'최종학력',width:13},
    {key:'school',label:'학교',width:18},
    {key:'major',label:'학과',width:18},
    {key:'phone',label:'연락처',width:18},
    {key:'region',label:'지역(시)',width:14},
    {key:'commute',label:'통근방법',width:14},
    {key:'memo',label:'비고',width:48}
  ];
  const PRESETS=[
    {id:'assignment',name:'부서배정',excluded:['residentNumber','grade'],removeMeasurements:false},
    {id:'health-support',name:'안전보건·지원팀',excluded:['grade'],removeMeasurements:false},
    {id:'final',name:'최종명단',excluded:['grade','residentNumber'],removeMeasurements:true}
  ];
  const SHEET_KIND='waiting-sheet-v1',SETTINGS_KIND='waiting-exports-v1';
  const NAME_INDEX=10,MEMO_INDEX=22,RESIDENT_INDEX=12,MAX_ROWS=5000;
  const state={stage:null,selectedId:'',page:0,error:'',pasteBlocked:false,settingsBaseline:'',ready:false};
  const $=id=>root.document?.getElementById(id);
  const text=value=>String(value??'');
  const escapeHtml=value=>text(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const compact=value=>text(value).replace(/[\s()（）]/g,'').toLocaleLowerCase('ko');
  const headerMap=new Map(COLUMNS.map((column,index)=>[compact(column.label),index]));
  for(const [label,index] of Object.entries({'번호':0,'순번':0,'사번':1,'입사일':3,'PMTC':5,'이름':10,'성  명':10,'직 급':11,'나이':14,'전공':18,'전화번호':19,'지역':20,'출근방법':21,'메모':22}))headerMap.set(compact(label),index);
  function parseGrid(raw){
    if(text(raw).length>5000000)throw new Error('붙여넣은 내용이 너무 커요. 나누어 붙여넣어주세요.');
    const source=text(raw).replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
    const grid=[];let row=[],value='',quoted=false;
    for(let index=0;index<source.length;index++){
      const char=source[index];
      if(char==='"'){
        if(quoted&&source[index+1]==='"'){value+='"';index++;}
        else if(quoted)quoted=false;
        else if(value==='')quoted=true;
        else value+=char;
      }else if(!quoted&&(char==='\t'||char==='\n')){
        row.push(value);value='';if(char==='\n'){grid.push(row);row=[];}
      }else value+=char;
    }
    if(quoted)throw new Error('따옴표가 닫히지 않은 셀이 있어요. 엑셀에서 다시 복사해주세요.');
    row.push(value);grid.push(row);
    return grid.filter(cells=>cells.some(cell=>cell.trim()));
  }
  function parsePaste(raw){
    const grid=parseGrid(raw);if(!grid.length)throw new Error('엑셀 명단을 붙여넣어주세요.');
    const first=grid[0],matched=first.map(cell=>headerMap.get(compact(cell)));
    const hasHeader=matched.includes(NAME_INDEX)&&matched.filter(index=>index!==undefined).length>=2;
    let indexes=COLUMNS.map((_,index)=>index),data=grid;
    if(hasHeader){
      while(first.length&&first[first.length-1]==='')first.pop();
      indexes=first.map(cell=>headerMap.get(compact(cell)));
      if(indexes.some(index=>index===undefined))throw new Error('양식에 없는 제목이 있어요. 원본 제목 줄을 확인해주세요.');
      if(new Set(indexes).size!==indexes.length)throw new Error('같은 제목이 두 번 들어 있어요.');
      data=grid.slice(1);
    }else if(first.length!==COLUMNS.length)throw new Error('제목 줄부터 복사해주세요. 데이터만 붙일 때는 원본의 23열이 필요해요.');
    const rows=[];
    for(let index=0;index<data.length;index++){
      const cells=data[index];
      if(cells.length>indexes.length&&cells.slice(indexes.length).some(cell=>cell.trim()))throw new Error(`${index+1}번째 행의 열 수를 확인해주세요.`);
      if(!hasHeader&&cells.length<indexes.length)throw new Error(`${index+1}번째 행은 원본 23열을 모두 복사해주세요.`);
      if(cells.some(cell=>cell.length>32767))throw new Error(`${index+1}번째 행에 너무 긴 셀이 있어요.`);
      const values=Array(COLUMNS.length).fill('');indexes.forEach((column,col)=>values[column]=cells[col]??'');
      if(!values.slice(1).some(cell=>cell.trim()))continue;
      if(!values[NAME_INDEX].trim())throw new Error(`${index+1}번째 행의 성명이 비어 있어요.`);
      rows.push(values);if(rows.length>MAX_ROWS)throw new Error('한 번에 5,000명까지 붙여넣을 수 있어요.');
    }
    if(!rows.length)throw new Error('제목 아래에 명단을 함께 붙여넣어주세요.');
    return rows;
  }
  function removeBodyMeasurements(value){
    const number='\\d{2,3}(?:\\.\\d+)?',weight='\\d{1,3}(?:\\.\\d+)?';
    const pair=`${number}\\s*(?:cm|㎝)\\s*(?:[/·•,;|]|\\s)\\s*${weight}\\s*(?:kg|㎏)(?![a-z])`;
    const combined=`(?:키|신장)\\s*[/·•,]\\s*(?:몸무게|체중)\\s*[:：=]?\\s*${number}\\s*(?:cm|㎝)?\\s*[/·•,]\\s*${weight}\\s*(?:kg|㎏)?`;
    const labelledHeight=`(?:키|신장)\\s*[:：=]?\\s*${number}\\s*(?:cm|㎝|센티(?:미터)?)?`;
    const labelledWeight=`(?:몸무게|체중)\\s*[:：=]?\\s*${weight}\\s*(?:kg|㎏|킬로(?:그램)?)?`;
    const patterns=[`[（(]\\s*(?:${pair}|${combined})\\s*[)）]`,combined,pair,labelledHeight,labelledWeight];
    let result=text(value);
    for(const pattern of patterns){
      const regex=new RegExp(pattern,'giu');let match;
      while((match=regex.exec(result))){
        let start=match.index,end=start+match[0].length;
        const before=result.slice(0,start),after=result.slice(end);
        if(!before.trim()){start=0;end+=(after.match(/^[\s/·•,;|:：-]*/)?.[0].length||0);}
        else if(!after.trim()){end=result.length;start-=(before.match(/[\s/·•,;|:：-]*$/)?.[0].length||0);}
        else if(/[/·•,;|]\s*$/.test(before)&&/^\s*[/·•,;|]/.test(after))end+=(after.match(/^[\s/·•,;|]*/)?.[0].length||0);
        result=result.slice(0,start)+result.slice(end);regex.lastIndex=start;
      }
    }
    return result;
  }
  function selectedColumns(profile){
    const allowed=Array.isArray(profile?.columns)?new Set(profile.columns):null,excluded=new Set(profile?.excluded||[]);
    return COLUMNS.map((column,index)=>({column,index})).filter(({column})=>(!allowed||allowed.has(column.key))&&!excluded.has(column.key));
  }
  function buildExport(rows,profile){
    const selected=selectedColumns(profile);
    if(!selected.length)throw new Error('다운로드할 열을 선택해주세요.');
    return {columns:selected.map(({column})=>({...column})),rows:rows.map(row=>selected.map(({index})=>index===MEMO_INDEX&&profile?.removeMeasurements?removeBodyMeasurements(row[index]):text(row[index])))};
  }
  function records(){return typeof hireWaitingProfiles!=='undefined'&&Array.isArray(hireWaitingProfiles)?hireWaitingProfiles:[];}
  function sheets(){return records().filter(record=>record?.kind===SHEET_KIND&&Array.isArray(record.rows));}
  function settings(){return records().find(record=>record?.kind===SETTINGS_KIND)||null;}
  function customProfiles(){const profiles=settings()?.customExports;return (Array.isArray(profiles)?profiles:[]).filter(profile=>profile&&/^[a-zA-Z0-9._:-]+$/.test(text(profile.id))&&profile.name&&Array.isArray(profile.columns)&&selectedColumns(profile).length);}
  function currentSheet(){const saved=sheets();return saved.find(record=>record.id===state.selectedId)||saved[saved.length-1]||null;}
  function currentRows(){return state.stage||currentSheet()?.rows||[];}
  function requirePermission(permission){return !root.erpPermissions||root.erpPermissions.require(permission);}
  function allowed(permission){return !root.erpPermissions||root.erpPermissions.has(permission);}
  function feedback(message,error=false){state.error=error?message:'';const node=$('hwFeedback');if(node){node.textContent=message;node.classList.toggle('is-error',error);}}
  function writeRecord(record,replaceId='',baseline=null){
    const key=typeof HIRE_WAITING_PROFILES_KEY!=='undefined'?HIRE_WAITING_PROFILES_KEY:'recruit_erp_hire_waiting_profiles';
    let next;
    try{
      const raw=root.localStorage.getItem(key);const parsed=raw?JSON.parse(raw):[];
      next=Array.isArray(parsed)?parsed:Array.isArray(parsed?.rows)?parsed.rows:null;
      if(!next)throw new Error('저장된 입사대기 자료의 형식을 확인해주세요.');
      const position=replaceId?next.findIndex(item=>item.id===replaceId):-1;
      if(replaceId&&JSON.stringify(position<0?null:next[position])!==baseline)throw new Error('다른 창에서 설정이 바뀌었어요. 다시 열어주세요.');
      next=JSON.parse(JSON.stringify(next));
      if(position>=0)next[position]=record;else next.push(record);
      if(typeof safeLocalStorageSet!=='function'||safeLocalStorageSet(key,JSON.stringify(next))!==true)return false;
      hireWaitingProfiles=next;
      return true;
    }catch(error){feedback(error.message||'저장하지 못했어요. 입력 내용은 그대로 남아 있어요.',true);return false;}
  }
  function stagePaste(raw){
    if(!requirePermission('applicant.write'))return false;
    try{state.stage=parsePaste(raw);state.page=0;state.error='';state.pasteBlocked=false;if($('hwPasteRaw'))$('hwPasteRaw').value='';if($('hwPastePanel'))$('hwPastePanel').open=false;feedback('');render();return true;}
    catch(error){state.pasteBlocked=true;feedback(error.message,true);renderActions();return false;}
  }
  function cancelPaste(){state.stage=null;state.page=0;state.error='';state.pasteBlocked=false;if($('hwPasteRaw'))$('hwPasteRaw').value='';feedback('');render();}
  function saveRoster(){
    if(!requirePermission('applicant.write')||!state.stage?.length||state.pasteBlocked)return false;
    const id=typeof uid==='function'?uid():root.crypto.randomUUID();
    const record={id,applicantId:`excel-list:${id}`,groupName:'입사대기자 명단',kind:SHEET_KIND,rows:state.stage.map(row=>row.slice()),createdAt:new Date().toISOString()};
    if(!writeRecord(record))return false;
    state.selectedId=id;state.stage=null;feedback('저장했어요.');render();return true;
  }
  function fileDate(rows){
    const dates=new Set(rows.map(row=>root.erpLocalXlsx?.dateValue(row[3])?.iso).filter(Boolean));
    return dates.size===1?[...dates][0]:typeof today==='function'?today():new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
  }
  function download(profileId){
    if(!requirePermission('export.standard')||state.pasteBlocked)return false;
    const rows=currentRows();if(!rows.length){feedback('명단을 먼저 붙여넣어주세요.',true);return false;}
    const profile=profileId==='all'?{id:'all',name:'전체'}:[...PRESETS,...customProfiles()].find(item=>item.id===profileId);
    if(!profile){feedback('다운로드 설정을 찾지 못했어요.',true);return false;}
    try{
      const prepared=buildExport(rows,profile),blob=root.erpLocalXlsx.blob(prepared.columns,prepared.rows);
      const url=root.URL.createObjectURL(blob),link=root.document.createElement('a');
      link.href=url;link.download=`입사대기자명단_${fileDate(rows)}_${profile.name.replace(/[\\/:*?"<>|]/g,'_')}.xlsx`;root.document.body.appendChild(link);
      try{link.click();}finally{link.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),30000);}
      feedback(`${profile.name} 파일을 받았어요.`);return true;
    }catch{feedback('파일을 만들지 못했어요. 다시 시도해주세요.',true);return false;}
  }
  function openDepartment(id=''){
    if(!requirePermission('applicant.write'))return false;
    const profile=customProfiles().find(item=>item.id===id);
    state.settingsBaseline=JSON.stringify(settings());
    $('hwDepartmentId').value=profile?.id||'';$('hwDepartmentName').value=profile?.name||'';$('hwRemoveMeasurements').checked=!!profile?.removeMeasurements;
    const keys=new Set(profile?.columns||COLUMNS.map(column=>column.key));
    $('hwColumnOptions').querySelectorAll('input').forEach(input=>input.checked=keys.has(input.value));
    $('hwDeleteDepartment').hidden=!profile;$('hwDepartmentPanel').open=true;$('hwDepartmentName').focus();return true;
  }
  function saveDepartment(){
    if(!requirePermission('applicant.write'))return false;
    const name=$('hwDepartmentName').value.trim(),id=$('hwDepartmentId').value||`department:${typeof uid==='function'?uid():root.crypto.randomUUID()}`;
    const columns=[...$('hwColumnOptions').querySelectorAll('input:checked')].map(input=>input.value);
    if(!name||name.length>40){feedback('부서 이름을 40자 이내로 입력해주세요.',true);return false;}
    if(!columns.length){feedback('보낼 열을 한 개 이상 선택해주세요.',true);return false;}
    const custom=customProfiles();if([...PRESETS,...custom].some(profile=>profile.id!==id&&profile.name===name)){feedback('같은 이름의 버튼이 이미 있어요.',true);return false;}
    const before=settings(),record={...(before||{}),id:before?.id||'waiting-exports-v1',applicantId:before?.applicantId||'excel-exports:settings',groupName:'입사대기 다운로드 설정',kind:SETTINGS_KIND,customExports:[...custom.filter(profile=>profile.id!==id),{id,name,columns,removeMeasurements:$('hwRemoveMeasurements').checked}],updatedAt:new Date().toISOString()};
    if(!writeRecord(record,record.id,state.settingsBaseline))return false;
    $('hwDepartmentPanel').open=false;state.error='';feedback('버튼을 저장했어요.');renderActions();return true;
  }
  function deleteDepartment(){
    if(!requirePermission('applicant.write'))return false;
    const id=$('hwDepartmentId').value,before=settings();if(!id||!before)return false;
    if(!root.confirm('이 다운로드 버튼을 삭제할까요?'))return false;
    const record={...before,customExports:customProfiles().filter(profile=>profile.id!==id),updatedAt:new Date().toISOString()};
    if(!writeRecord(record,record.id,state.settingsBaseline))return false;
    $('hwDepartmentPanel').open=false;feedback('버튼을 삭제했어요.');renderActions();return true;
  }
  function renderActions(){
    if(!$('hwDownloadButtons'))return;
    const canDownload=currentRows().length>0&&!state.pasteBlocked&&allowed('export.standard');
    const profiles=[...PRESETS,...customProfiles()];
    $('hwDownloadButtons').innerHTML=profiles.map(profile=>`<button type="button" class="primary" data-waiting-download="${escapeHtml(profile.id)}" data-required-permission="export.standard" ${canDownload?'':'disabled'}>${escapeHtml(profile.name)}</button>`).join('');
    $('hwDownloadAll').disabled=!canDownload;
    $('hwSaveRoster').disabled=!state.stage?.length||state.pasteBlocked||!allowed('applicant.write');
    $('hwCancelPaste').hidden=!state.stage&&!state.pasteBlocked;
    $('hwCustomProfiles').innerHTML=customProfiles().map(profile=>`<button type="button" class="ghost" data-waiting-edit="${escapeHtml(profile.id)}">${escapeHtml(profile.name)} 수정</button>`).join('');
  }
  function render(){
    if(!state.ready||!$('hireWaiting'))return;
    const saved=sheets(),current=currentSheet(),rows=currentRows();
    $('hwSavedList').innerHTML=saved.map(record=>`<option value="${escapeHtml(record.id)}">${escapeHtml(fileDate(record.rows))} · ${record.rows.length}명 · ${escapeHtml(new Date(record.createdAt).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}))}</option>`).reverse().join('');
    $('hwSavedList').value=current?.id||'';$('hwSavedList').disabled=!!state.stage;$('hwSavedListLabel').hidden=!saved.length;
    $('hwCount').textContent=`${rows.length}명${state.stage?' · 저장 전':''}`;
    $('hwTableBlock').hidden=!rows.length;
    if(!rows.length)$('hwPastePanel').open=true;
    const maxPage=Math.max(0,Math.ceil(rows.length/100)-1);state.page=Math.min(state.page,maxPage);
    const pageRows=rows.slice(state.page*100,state.page*100+100);
    $('hwTableBody').innerHTML=pageRows.map(row=>`<tr>${COLUMNS.map((column,index)=>`<td class="${index===NAME_INDEX?'hw-name':index===RESIDENT_INDEX?'hw-sensitive':''}">${index===RESIDENT_INDEX?(row[index]?'입력됨':''):escapeHtml(row[index])}</td>`).join('')}</tr>`).join('');
    $('hwPagination').hidden=rows.length<=100;$('hwPageLabel').textContent=`${state.page+1} / ${maxPage+1}`;$('hwPreviousPage').disabled=state.page===0;$('hwNextPage').disabled=state.page===maxPage;
    renderActions();
  }
  function init(){
    if(!$('hireWaiting'))return;
    $('hwTableHead').innerHTML=`<tr>${COLUMNS.map(column=>`<th scope="col">${escapeHtml(column.label)}</th>`).join('')}</tr>`;
    $('hwColumnOptions').innerHTML=COLUMNS.map(column=>`<label><input type="checkbox" value="${escapeHtml(column.key)}" checked>${escapeHtml(column.label)}</label>`).join('');
    $('hwPasteRaw').addEventListener('paste',event=>{if(!allowed('applicant.write')){event.preventDefault();return;}const raw=event.clipboardData?.getData('text/plain');if(raw){event.preventDefault();if(!stagePaste(raw)){$('hwPasteRaw').value=raw;$('hwPastePanel').open=true;}}});
    $('hwPasteRaw').addEventListener('input',()=>{state.pasteBlocked=!!$('hwPasteRaw').value;feedback(state.pasteBlocked?'표 불러오기를 눌러주세요.':'');renderActions();});
    $('hwLoadPaste').addEventListener('click',()=>stagePaste($('hwPasteRaw').value));
    $('hwSaveRoster').addEventListener('click',saveRoster);$('hwCancelPaste').addEventListener('click',cancelPaste);$('hwDownloadAll').addEventListener('click',()=>download('all'));
    $('hwDownloadButtons').addEventListener('click',event=>{const button=event.target.closest('[data-waiting-download]');if(button)download(button.dataset.waitingDownload);});
    $('hwSavedList').addEventListener('change',()=>{if(!state.stage){state.selectedId=$('hwSavedList').value;state.page=0;state.error='';feedback('');render();}});
    $('hwPreviousPage').addEventListener('click',()=>{state.page--;render();});$('hwNextPage').addEventListener('click',()=>{state.page++;render();});
    $('hwAddDepartment').addEventListener('click',()=>openDepartment());
    $('hwDepartmentPanel').querySelector('summary').addEventListener('click',event=>{event.preventDefault();if($('hwDepartmentPanel').open)$('hwDepartmentPanel').open=false;else openDepartment();});
    $('hwDepartmentForm').addEventListener('submit',event=>{event.preventDefault();saveDepartment();});$('hwDeleteDepartment').addEventListener('click',deleteDepartment);
    $('hwCustomProfiles').addEventListener('click',event=>{const button=event.target.closest('[data-waiting-edit]');if(button)openDepartment(button.dataset.waitingEdit);});
    $('hwSelectAllColumns').addEventListener('click',()=>$('hwColumnOptions').querySelectorAll('input').forEach(input=>input.checked=true));
    $('hwClearColumns').addEventListener('click',()=>$('hwColumnOptions').querySelectorAll('input').forEach(input=>input.checked=false));
    root.document.addEventListener('erp:permission-change',render);
    if(currentRows().length)$('hwPastePanel').open=false;
    state.ready=true;render();
  }
  const api={COLUMNS,PRESETS,parsePaste,removeBodyMeasurements,buildExport,stagePaste,saveRoster,download,render,isDirty:()=>!!state.stage||state.pasteBlocked,openDepartment,saveDepartment,deleteDepartment};
  if(root.document)Promise.resolve(root.erpRuntimeReady).then(result=>{if(result?.ok)init();});
  return api;
});
