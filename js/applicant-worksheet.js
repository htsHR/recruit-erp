/* Recruit ERP v11.4.1 — 지원자 워크시트 사용성 마감 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.erpApplicantWorksheet=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';

  const VERSION='11.4.1';
  const SETTINGS_KEY='recruit_erp_applicant_worksheet_view_v1';
  const VIEW_MODES=['normal','worksheet'];
  const WORKPLACES=['all','천안','평택','기타'];
  const FILTERS=['all','todayAction','active','docpass','interview','hire','finished','contact','decision','duplicate','priority','hold','rejected'];
  const SORTS=['recent','applyDesc','applyAsc','interviewAsc','scoreDesc','nameAsc'];
  const PAGE_SIZES=[30,50,100];
  const EDITABLE_FIELDS=['name','phone','email','region','workplace','status','interviewDate','interviewTime','hireDate','source','careerType','dormUse','memo'];
  const COLUMNS=[
    {key:'no',label:'NO',readonly:true,width:58},
    {key:'name',label:'성명',type:'text',width:132},
    {key:'phone',label:'연락처',type:'text',width:140},
    {key:'email',label:'이메일',type:'text',width:190},
    {key:'region',label:'지역',type:'text',width:120},
    {key:'workplace',label:'근무지',type:'select',width:100},
    {key:'status',label:'상태',type:'select',width:120},
    {key:'interviewDate',label:'면접일',type:'date',width:126},
    {key:'interviewTime',label:'면접시간',type:'select',width:105},
    {key:'hireDate',label:'입사일',type:'date',width:126},
    {key:'source',label:'지원경로',type:'text',width:140},
    {key:'careerType',label:'경력구분',type:'select',width:105},
    {key:'dormUse',label:'출근방법',type:'select',width:112},
    {key:'memo',label:'메모',type:'text',width:280}
  ];
  const COLUMN_INDEX=Object.fromEntries(COLUMNS.map((column,index)=>[column.key,index]));
  const EDITABLE_SET=new Set(EDITABLE_FIELDS);

  function text(value){return String(value==null?'':value);}
  function escapeHtml(value){return text(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function deepClone(value){return typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value));}
  function sanitizeSettings(value={}){
    const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    return {
      viewMode:VIEW_MODES.includes(source.viewMode)?source.viewMode:'normal',
      currentWorkplace:WORKPLACES.includes(source.currentWorkplace)?source.currentWorkplace:'all',
      currentFilter:FILTERS.includes(source.currentFilter)?source.currentFilter:'all',
      currentSort:SORTS.includes(source.currentSort)?source.currentSort:'recent',
      hideFinished:source.hideFinished===true,
      applicantPageSize:PAGE_SIZES.includes(Number(source.applicantPageSize))?Number(source.applicantPageSize):30
    };
  }
  function parseClipboard(raw){
    const normalized=text(raw).replace(/\r\n?/g,'\n').replace(/\n$/,'');
    if(!normalized)return [['']];
    const rows=normalized.split('\n').map(line=>line.split('\t'));
    const width=rows[0].length;
    if(!width||rows.some(row=>row.length!==width))throw new Error('붙여넣기 범위는 빈틈 없는 직사각형이어야 합니다.');
    return rows;
  }
  function isIsoDate(value){
    if(!value)return true;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const [year,month,day]=value.split('-').map(Number),date=new Date(Date.UTC(year,month-1,day));
    return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day;
  }
  function isTime(value){return !value||/^([01]\d|2[0-3]):[0-5]\d$/.test(value);}
  function phoneDigits(value){return text(value).replace(/\D/g,'');}
  function formatPhone(value){
    const digits=phoneDigits(value);if(!digits)return text(value).trim();
    if(digits.startsWith('02')){
      if(digits.length===9)return digits.slice(0,2)+'-'+digits.slice(2,5)+'-'+digits.slice(5);
      if(digits.length===10)return digits.slice(0,2)+'-'+digits.slice(2,6)+'-'+digits.slice(6);
      return digits;
    }
    if(digits.length===10)return digits.slice(0,3)+'-'+digits.slice(3,6)+'-'+digits.slice(6);
    if(digits.length===11)return digits.slice(0,3)+'-'+digits.slice(3,7)+'-'+digits.slice(7);
    return digits;
  }
  function looksPhone(value){return /^01[016789]\d{7,8}$/.test(phoneDigits(value));}
  function looksEmail(value){const clean=text(value).trim();return !clean||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);}
  function normalizeValue(field,value,normalizers={}){
    const raw=text(value);
    if(field==='memo')return raw.trim();
    const trimmed=raw.trim();
    if(field==='phone')return typeof normalizers.phone==='function'?text(normalizers.phone(trimmed)):formatPhone(trimmed);
    if(field==='status'&&typeof normalizers.status==='function')return text(normalizers.status(trimmed));
    if(field==='dormUse'&&typeof normalizers.dormUse==='function')return text(normalizers.dormUse(trimmed));
    return trimmed;
  }
  function validateRow(row,optionMap={},validators={}){
    const errors={};
    if(!text(row.name).trim())errors.name='성명은 필수입니다.';
    if(!text(row.phone).trim())errors.phone='연락처는 필수입니다.';
    else if(!(typeof validators.phone==='function'?validators.phone(row.phone):looksPhone(row.phone)))errors.phone='연락처 형식이 올바르지 않습니다.';
    if(text(row.email).trim()&&!(typeof validators.email==='function'?validators.email(row.email):looksEmail(row.email)))errors.email='이메일 형식이 올바르지 않습니다.';
    for(const field of ['interviewDate','hireDate'])if(!isIsoDate(text(row[field])))errors[field]='YYYY-MM-DD 형식의 실제 날짜를 입력하세요.';
    if(!isTime(text(row.interviewTime)))errors.interviewTime='HH:MM 형식의 실제 시간을 입력하세요.';
    for(const field of ['workplace','status','interviewTime','careerType','dormUse']){
      const value=text(row[field]);
      const allowed=optionMap[field];
      if(value&&allowed&&allowed.size&&!allowed.has(value))errors[field]='목록에 있는 값을 선택하세요.';
    }
    const status=text(row.status);
    if(['면접예정','다음면접'].includes(status)&&!row.interviewDate)errors.interviewDate='현재 상태에는 면접일이 필요합니다.';
    if(status==='입사예정'&&!row.hireDate)errors.hireDate='입사예정 상태에는 입사일이 필요합니다.';
    if(row.interviewTime&&!row.interviewDate)errors.interviewTime='면접시간을 입력하려면 면접일이 필요합니다.';
    if(row.applyDate&&row.interviewDate&&row.interviewDate<row.applyDate)errors.interviewDate='면접일은 지원일보다 빠를 수 없습니다.';
    if(row.applyDate&&row.hireDate&&row.hireDate<row.applyDate)errors.hireDate='입사일은 지원일보다 빠를 수 없습니다.';
    if(row.interviewDate&&row.hireDate&&row.hireDate<row.interviewDate)errors.hireDate='입사일은 면접일보다 빠를 수 없습니다.';
    return errors;
  }
  function dirtyToPatches(entries){
    const patches=new Map();
    for(const entry of entries){
      if(!EDITABLE_SET.has(entry?.field))continue;
      if(!patches.has(entry.id))patches.set(entry.id,{});
      patches.get(entry.id)[entry.field]=entry.value;
    }
    return patches;
  }
  function applyPatches(rows,entries,normalizer,now){
    const patches=dirtyToPatches(entries),stamp=now||new Date().toISOString();
    return rows.map(row=>{
      const patch=patches.get(String(row.id));
      if(!patch)return row;
      const candidate={...row,...patch,updatedAt:stamp};
      const normalized=typeof normalizer==='function'?normalizer(candidate):candidate;
      return {...row,...normalized,...patch,updatedAt:stamp};
    });
  }
  function preparePaste({matrix,startRow,startColumn,rows,optionMap={},normalizers={}}){
    if(!Array.isArray(matrix)||!matrix.length||!Array.isArray(rows))throw new Error('붙여넣을 자료가 없습니다.');
    const width=matrix[0].length;
    if(!width||matrix.some(row=>row.length!==width))throw new Error('붙여넣기 범위는 빈틈 없는 직사각형이어야 합니다.');
    if(startRow<0||startColumn<0||startRow+matrix.length>rows.length)throw new Error('현재 페이지 행 범위를 벗어나는 붙여넣기는 할 수 없습니다.');
    if(startColumn+width>COLUMNS.length)throw new Error('현재 페이지 열 범위를 벗어나는 붙여넣기는 할 수 없습니다.');
    for(let column=startColumn;column<startColumn+width;column++)if(!EDITABLE_SET.has(COLUMNS[column].key))throw new Error('읽기 전용 열에는 붙여넣을 수 없습니다.');
    const projected=rows.map(row=>({...row})),changes=[];
    matrix.forEach((values,rowOffset)=>values.forEach((value,columnOffset)=>{
      const rowIndex=startRow+rowOffset,columnIndex=startColumn+columnOffset,field=COLUMNS[columnIndex].key;
      const normalized=normalizeValue(field,value,normalizers);
      projected[rowIndex][field]=normalized;
      changes.push({rowIndex,columnIndex,id:String(rows[rowIndex].id),field,value:normalized});
    }));
    const affected=[...new Set(changes.map(change=>change.rowIndex))];
    const errors=[];
    affected.forEach(rowIndex=>{
      const result=validateRow(projected[rowIndex],optionMap,{phone:normalizers.phoneValid,email:normalizers.emailValid});
      Object.entries(result).forEach(([field,message])=>errors.push({rowIndex,field,message}));
    });
    if(errors.length){const error=new Error(errors[0].message);error.validationErrors=errors;throw error;}
    return {changes,projected};
  }

  function entriesSnapshot(entries){return deepClone(Array.isArray(entries)?entries:[...entries]);}
  function entriesSignature(entries){return entriesSnapshot(entries).sort((a,b)=>(a.id+':'+a.field).localeCompare(b.id+':'+b.field)).map(entry=>[entry.id,entry.field,entry.before,entry.value]);}
  function createHistoryState(){return {undo:[],redo:[]};}
  function recordHistory(history,before,after,label='워크시트 편집'){
    if(JSON.stringify(entriesSignature(before))===JSON.stringify(entriesSignature(after)))return false;
    history.undo.push({label,before:entriesSnapshot(before),after:entriesSnapshot(after)});
    if(history.undo.length>100)history.undo.shift();
    history.redo.length=0;return true;
  }
  function undoHistory(history){
    const action=history.undo.pop();if(!action)return null;
    history.redo.push(action);return entriesSnapshot(action.before);
  }
  function redoHistory(history){
    const action=history.redo.pop();if(!action)return null;
    history.undo.push(action);return entriesSnapshot(action.after);
  }
  function findDuplicates(rows,entries,{digits=phoneDigits,email=value=>text(value).trim().toLowerCase()}={}){
    const patches=dirtyToPatches(entries),projected=rows.map(row=>({...row,...(patches.get(String(row.id))||{})}));
    const changedIds=new Set(entries.filter(entry=>entry.field==='phone'||entry.field==='email').map(entry=>String(entry.id)));
    const found=[],seen=new Set();
    for(const id of changedIds){
      const current=projected.find(row=>String(row.id)===id);if(!current)continue;
      for(const other of projected){
        const otherId=String(other.id);if(otherId===id)continue;
        for(const field of ['phone','email']){
          const left=field==='phone'?digits(current[field]):email(current[field]),right=field==='phone'?digits(other[field]):email(other[field]);
          if(!left||!right||(field==='phone'&&left.length<8)||left!==right)continue;
          const pair=[id,otherId].sort().join('|'),key=pair+'|'+field;if(seen.has(key))continue;
          seen.add(key);found.push({id,otherId,field});
        }
      }
    }
    return found;
  }

  const api={VERSION,SETTINGS_KEY,COLUMNS,EDITABLE_FIELDS,sanitizeSettings,parseClipboard,isIsoDate,isTime,phoneDigits,formatPhone,looksPhone,looksEmail,normalizeValue,validateRow,dirtyToPatches,applyPatches,preparePaste,createHistoryState,recordHistory,undoHistory,redoHistory,findDuplicates,escapeHtml};
  if(!root.document)return api;

  const state={
    viewMode:'normal',dirty:new Map(),errors:new Map(),duplicates:[],duplicatesConfirmed:false,history:createHistoryState(),
    selected:null,anchor:null,editing:null,pageRows:[],pageStart:0,pendingAction:null,bypassGuard:false,
    initialized:false,lastNotice:'',reviewOpen:false
  };
  function dirtyKey(id,field){return `${id}\u0000${field}`;}
  function canRead(){return !root.erpPermissions||root.erpPermissions.has('applicant.read');}
  function canWrite(){return !root.erpPermissions||root.erpPermissions.has('applicant.write');}
  function appRows(){return typeof applicants!=='undefined'&&Array.isArray(applicants)?applicants:[];}
  function findApplicant(id){return appRows().find(row=>String(row.id)===String(id));}
  function currentEntries(){return [...state.dirty.values()].filter(entry=>EDITABLE_SET.has(entry?.field));}
  function dirtyPeople(){return new Set(currentEntries().map(entry=>entry.id)).size;}
  function currentSettings(){
    return sanitizeSettings({viewMode:state.viewMode,currentWorkplace,currentFilter,currentSort,hideFinished,applicantPageSize});
  }
  function persistSettings(){
    try{
      const value=JSON.stringify(currentSettings());
      if(root.localStorage.getItem(SETTINGS_KEY)!==value)root.localStorage.setItem(SETTINGS_KEY,value);
    }catch{}
  }
  function loadSettings(){
    let loaded=sanitizeSettings();
    try{loaded=sanitizeSettings(JSON.parse(root.localStorage.getItem(SETTINGS_KEY)||'{}'));}catch{}
    state.viewMode=loaded.viewMode;
    currentWorkplace=loaded.currentWorkplace;currentFilter=loaded.currentFilter;currentSort=loaded.currentSort;
    hideFinished=loaded.hideFinished;applicantPageSize=loaded.applicantPageSize;
    const sort=root.document.getElementById('sortSelect'),hide=root.document.getElementById('hideFinished');
    if(sort)sort.value=currentSort;if(hide)hide.checked=hideFinished;
    root.document.querySelectorAll('#workplaceTabs [data-workplace]').forEach(button=>button.classList.toggle('active',button.dataset.workplace===currentWorkplace));
    root.document.querySelectorAll('#quickFilters [data-filter]').forEach(button=>button.classList.toggle('active',button.dataset.filter===currentFilter));
  }
  function optionSet(field,rows=appRows()){
    const set=new Set(['']);
    const select=root.document.getElementById(field);
    if(select?.options)[...select.options].forEach(option=>set.add(text(option.value)));
    if(field==='status'&&typeof STATUS_OPTIONS!=='undefined')STATUS_OPTIONS.forEach(value=>set.add(value));
    if(field==='status'&&typeof LEGACY_STATUS_OPTIONS!=='undefined')LEGACY_STATUS_OPTIONS.forEach(value=>set.add(value));
    rows.forEach(row=>{const value=text(row[field]);if(value)set.add(value);});
    return set;
  }
  function optionMap(rows=appRows()){
    return Object.fromEntries(['workplace','status','interviewTime','careerType','dormUse'].map(field=>[field,optionSet(field,rows)]));
  }
  function normalizers(){
    return {
      phone:value=>typeof formatPhoneDisplay==='function'?formatPhoneDisplay(value):formatPhone(value),
      phoneValid:value=>typeof excelPasteLooksPhone==='function'?excelPasteLooksPhone(value):looksPhone(value),
      emailValid:value=>typeof excelPasteLooksEmail==='function'?excelPasteLooksEmail(value):looksEmail(value),
      status:value=>typeof normalizeStatus==='function'?normalizeStatus(value):value,
      dormUse:value=>typeof normalizeDorm==='function'?normalizeDorm(value):value
    };
  }
  function projectedRow(row){
    const result={...row};
    currentEntries().filter(entry=>entry.id===String(row.id)).forEach(entry=>{result[entry.field]=entry.value;});
    return result;
  }
  function recalculateReview(){
    state.errors.clear();
    const options=optionMap(),rules=normalizers();
    const ids=new Set(currentEntries().map(entry=>entry.id));
    ids.forEach(id=>{
      const row=findApplicant(id);if(!row)return;
      const errors=validateRow(projectedRow(row),options,{phone:rules.phoneValid,email:rules.emailValid});
      Object.entries(errors).forEach(([field,message])=>state.errors.set(dirtyKey(id,field),message));
    });
    state.duplicates=findDuplicates(appRows(),currentEntries(),{
      digits:value=>typeof excelPastePhoneDigits==='function'?excelPastePhoneDigits(value):phoneDigits(value),
      email:value=>text(value).trim().toLowerCase()
    });
  }
  function recalculateErrors(){recalculateReview();}
  function replaceDirty(entries){
    state.dirty.clear();
    entriesSnapshot(entries||[]).forEach(entry=>state.dirty.set(dirtyKey(String(entry.id),entry.field),entry));
  }
  function mutateWithHistory(label,mutation){
    const before=currentEntries();mutation();const after=currentEntries();
    const changed=recordHistory(state.history,before,after,label);
    if(changed){state.duplicatesConfirmed=false;recalculateReview();}
    return changed;
  }
  function setDirtyRaw(id,field,value){
    if(!EDITABLE_SET.has(field)||!canWrite())return false;
    const row=findApplicant(id);if(!row)return false;
    const key=dirtyKey(String(id),field),existing=state.dirty.get(key),before=existing?existing.before:text(row[field]);
    const normalized=normalizeValue(field,value,normalizers());
    if(normalized===before)state.dirty.delete(key);
    else state.dirty.set(key,{id:String(id),field,before,value:normalized});
    return true;
  }
  function setDirty(id,field,value,{render=true,record=true,label='셀 편집'}={}){
    if(!EDITABLE_SET.has(field)||!canWrite())return false;
    const changed=record?mutateWithHistory(label,()=>setDirtyRaw(id,field,value)):setDirtyRaw(id,field,value);
    if(!record)recalculateReview();
    if(render)renderWorksheet();
    return changed;
  }
  function undoDirty(){
    if(!canWrite())return false;
    const snapshot=undoHistory(state.history);if(snapshot===null)return false;
    replaceDirty(snapshot);state.duplicatesConfirmed=false;recalculateReview();state.lastNotice='마지막 작업을 실행 취소했습니다.';renderWorksheet();focusSelected();return true;
  }
  function redoDirty(){
    if(!canWrite())return false;
    const snapshot=redoHistory(state.history);if(snapshot===null)return false;
    replaceDirty(snapshot);state.duplicatesConfirmed=false;recalculateReview();state.lastNotice='마지막 작업을 다시 실행했습니다.';renderWorksheet();focusSelected();return true;
  }
  function discardDirty(){
    state.dirty.clear();state.errors.clear();state.duplicates=[];state.duplicatesConfirmed=false;
    state.history.undo.length=0;state.history.redo.length=0;state.editing=null;
    state.lastNotice='변경사항을 취소했습니다.';renderWorksheet();
  }
  function selectionBounds(){
    if(!state.selected)return null;
    const anchor=state.anchor||state.selected;
    return {rowFrom:Math.min(anchor.row,state.selected.row),rowTo:Math.max(anchor.row,state.selected.row),colFrom:Math.min(anchor.col,state.selected.col),colTo:Math.max(anchor.col,state.selected.col)};
  }
  function isSelected(row,col){const bounds=selectionBounds();return !!bounds&&row>=bounds.rowFrom&&row<=bounds.rowTo&&col>=bounds.colFrom&&col<=bounds.colTo;}
  function cellValue(row,column,rowIndex){if(column.key==='no')return state.pageStart+rowIndex+1;return text(row[column.key]);}
  function renderCell(row,column,rowIndex,columnIndex){
    const id=String(row.id),key=dirtyKey(id,column.key),dirty=state.dirty.has(key),error=state.errors.get(key);
    const current=state.selected?.row===rowIndex&&state.selected?.col===columnIndex;
    const readonly=column.readonly||!canWrite(),duplicate=state.duplicates.some(item=>item.id===id&&item.field===column.key);
    const classes=['worksheet-cell',readonly?'is-readonly':'is-editable',dirty?'is-dirty':'',error?'is-error':'',duplicate?'is-duplicate':'',isSelected(rowIndex,columnIndex)?'is-selected':'',current?'is-current':''].filter(Boolean).join(' ');
    const title=error?` title="${escapeHtml(error)}"`:'';
    return `<td class="${classes}" data-row="${rowIndex}" data-col="${columnIndex}" data-field="${column.key}" tabindex="${current?'0':'-1'}"${title}><span>${escapeHtml(cellValue(row,column,rowIndex))||'&nbsp;'}</span></td>`;
  }
  function fieldLabel(field){return COLUMNS.find(column=>column.key===field)?.label||field;}
  function applicantLabel(id){return text(projectedRow(findApplicant(id)||{}).name).trim()||'이름 미입력';}
  function reviewItemHtml(id,field,message,tone){
    return '<button type="button" class="worksheet-review-item '+tone+'" data-worksheet-jump-id="'+escapeHtml(id)+'" data-worksheet-jump-field="'+escapeHtml(field)+'"><strong>'+escapeHtml(applicantLabel(id))+' · '+escapeHtml(fieldLabel(field))+'</strong><span>'+escapeHtml(message)+'</span></button>';
  }
  function enhanceWorksheetUi(host,writable,entries){
    const guide=host.querySelector('.worksheet-guide'),toolbar=root.document.createElement('div');
    toolbar.className='worksheet-history-tools';
    toolbar.innerHTML='<button type="button" class="ghost" id="btnWorksheetUndo" '+(!writable||!state.history.undo.length?'disabled':'')+'>실행 취소</button><button type="button" class="ghost" id="btnWorksheetRedo" '+(!writable||!state.history.redo.length?'disabled':'')+'>다시 실행</button>';
    guide?.appendChild(toolbar);
    const summaries=[];
    if(state.errors.size){
      const items=[...state.errors.entries()].map(([key,message])=>{const split=key.indexOf('\u0000');return reviewItemHtml(key.slice(0,split),key.slice(split+1),message,'is-error');}).join('');
      summaries.push('<section class="worksheet-review-block is-error"><div><strong>수정 필요 '+state.errors.size+'건</strong><span>항목을 누르면 해당 셀로 이동합니다.</span></div><div class="worksheet-review-items">'+items+'</div></section>');
    }
    if(state.duplicates.length){
      const items=state.duplicates.map(item=>{
        const message=fieldLabel(item.field)+'가 '+applicantLabel(item.otherId)+' 지원자와 같습니다. 자동 병합하지 않습니다.';
        return reviewItemHtml(item.id,item.field,message,'is-duplicate');
      }).join('');
      const confirm=state.duplicatesConfirmed?'<span class="worksheet-duplicate-confirmed">확인 완료</span>':'<button type="button" class="ghost" id="btnWorksheetConfirmDuplicates" '+(!writable?'disabled':'')+'>중복 후보를 확인했습니다</button>';
      summaries.push('<section class="worksheet-review-block is-duplicate"><div><strong>중복 후보 '+state.duplicates.length+'건</strong><span>연락처·이메일을 확인한 뒤 명시적으로 확인하세요.</span>'+confirm+'</div><div class="worksheet-review-items">'+items+'</div></section>');
    }
    if(summaries.length){
      const summary=root.document.createElement('div');summary.className='worksheet-review-summary';summary.setAttribute('aria-live','polite');summary.innerHTML=summaries.join('');
      guide?.insertAdjacentElement('afterend',summary);
    }
    const savebar=host.querySelector('.worksheet-savebar'),save=host.querySelector('#btnWorksheetSave');
    if(save)save.disabled=!entries.length||state.errors.size>0||(state.duplicates.length>0&&!state.duplicatesConfirmed)||!writable;
    const count=savebar?.querySelector('strong');if(count)count.textContent='변경 '+entries.length+'건';
    const detail=savebar?.querySelector('span');if(detail&&entries.length)detail.textContent=dirtyPeople()+'명 · 저장 전 임시 변경 · 실행 취소 '+state.history.undo.length+'단계';
    host.querySelector('.worksheet-empty')?.setAttribute('colspan',String(COLUMNS.length));
  }
  function confirmDuplicates(){
    if(!canWrite()){root.erpPermissions?.require?.('applicant.write');return false;}
    if(!state.duplicates.length)return true;
    state.duplicatesConfirmed=true;state.lastNotice='중복 후보를 확인했습니다. 저장 시 자동 병합·삭제하지 않습니다.';renderWorksheet();return true;
  }
  function ensureSelection(){
    if(!state.pageRows.length){state.selected=null;state.anchor=null;return;}
    const row=Math.min(Math.max(0,state.selected?.row||0),state.pageRows.length-1),col=Math.min(Math.max(0,state.selected?.col||0),COLUMNS.length-1);
    state.selected={row,col};if(!state.anchor)state.anchor={...state.selected};
  }
  function syncStickyOffsets(table){
    const headers=table?.querySelectorAll('thead th');if(!headers||headers.length<3)return;
    const noWidth=headers[0].getBoundingClientRect().width,nameWidth=headers[1].getBoundingClientRect().width;
    table.style.setProperty('--worksheet-name-left',`${noWidth}px`);
    table.style.setProperty('--worksheet-phone-left',`${noWidth+nameWidth}px`);
  }
  function renderWorksheet(){
    const host=root.document.getElementById('applicantWorksheet');if(!host||state.viewMode!=='worksheet')return;
    if(!canRead()){host.innerHTML='<div class="worksheet-empty">지원자 조회 권한이 없습니다.</div>';return;}
    const all=typeof filtered==='function'?filtered():appRows();
    const totalPages=Math.max(1,Math.ceil(all.length/applicantPageSize));
    currentApplicantPage=Math.min(Math.max(1,currentApplicantPage),totalPages);
    state.pageStart=(currentApplicantPage-1)*applicantPageSize;
    state.pageRows=all.slice(state.pageStart,state.pageStart+applicantPageSize).map(projectedRow);
    ensureSelection();
    const writable=canWrite(),entries=currentEntries();
    const head=COLUMNS.map(column=>`<th style="width:${column.width}px;min-width:${column.width}px" data-field="${column.key}">${column.label}</th>`).join('');
    const body=state.pageRows.map((row,rowIndex)=>`<tr class="${state.selected?.row===rowIndex?'is-current-row':''} ${entries.some(entry=>entry.id===String(row.id))?'is-dirty-row':''}" data-applicant-id="${escapeHtml(row.id)}">${COLUMNS.map((column,columnIndex)=>renderCell(row,column,rowIndex,columnIndex)).join('')}</tr>`).join('');
    const table=state.pageRows.length?`<table class="applicant-worksheet-table" aria-label="지원자 워크시트"><colgroup>${COLUMNS.map(column=>`<col style="width:${column.width}px">`).join('')}</colgroup><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`:'<div class="worksheet-empty" role="status">현재 조건에 해당하는 지원자가 없습니다.</div>';
    host.innerHTML=`<div class="worksheet-guide"><strong>현재 페이지 워크시트</strong><span>클릭으로 선택하고 Enter 또는 타이핑으로 편집합니다. 붙여넣기는 현재 페이지의 편집 열에서만 가능합니다.</span>${writable?'':'<em>조회 전용 권한에서는 편집·붙여넣기·저장을 사용할 수 없습니다.</em>'}</div><div class="applicant-worksheet-scroll">${table}</div><div class="worksheet-savebar" role="status"><div><strong>변경 ${entries.length}건</strong><span>${entries.length?`${dirtyPeople()}명 · 저장 전 임시 변경`:(state.lastNotice||'저장 전에는 지원자 데이터가 바뀌지 않습니다.')}</span>${state.errors.size?`<em>오류 ${state.errors.size}건을 먼저 확인하세요.</em>`:''}</div><div><button type="button" class="ghost" id="btnWorksheetCancel" ${entries.length&&!writable?'disabled':''}>취소</button><button type="button" class="primary" id="btnWorksheetSave" data-required-permission="applicant.write" ${!entries.length||state.errors.size||!writable?'disabled':''}>저장</button></div></div>`;
    syncStickyOffsets(host.querySelector('.applicant-worksheet-table'));
    enhanceWorksheetUi(host,writable,entries);bindWorksheetHost(host);
    if(typeof renderApplicantPagination==='function')renderApplicantPagination(all.length);
    root.document.querySelector('#applicantPagination')?.classList.add('worksheet-pagination');
    root.erpPermissions?.applyUi?.();
  }
  function bindWorksheetHost(host){
    host.querySelector('#btnWorksheetCancel')?.addEventListener('click',()=>{if(state.dirty.size&&root.confirm('저장하지 않은 워크시트 변경을 취소할까요?'))discardDirty();});
    host.querySelector('#btnWorksheetSave')?.addEventListener('click',()=>openFinalReview());
    host.querySelector('#btnWorksheetUndo')?.addEventListener('click',undoDirty);
    host.querySelector('#btnWorksheetRedo')?.addEventListener('click',redoDirty);
    host.querySelector('#btnWorksheetConfirmDuplicates')?.addEventListener('click',confirmDuplicates);
    host.querySelectorAll('[data-worksheet-jump-id]').forEach(button=>button.addEventListener('click',()=>jumpToReview(button.dataset.worksheetJumpId,button.dataset.worksheetJumpField)));
    host.querySelector('.applicant-worksheet-scroll')?.addEventListener('scroll',()=>{state.editing=null;});
  }
  function focusSelected(){
    root.requestAnimationFrame(()=>{
      const cell=root.document.querySelector(`#applicantWorksheet [data-row="${state.selected?.row}"][data-col="${state.selected?.col}"]`);
      cell?.focus({preventScroll:true});cell?.scrollIntoView({block:'nearest',inline:'nearest'});
    });
  }
  function jumpToReview(id,field){
    const all=typeof filtered==='function'?filtered():appRows(),index=all.findIndex(row=>String(row.id)===String(id)),col=COLUMN_INDEX[field];
    if(index<0||!Number.isInteger(col))return false;
    currentApplicantPage=Math.floor(index/applicantPageSize)+1;state.selected={row:index%applicantPageSize,col};state.anchor={...state.selected};
    renderWorksheet();focusSelected();return true;
  }
  function selectCell(row,col,{extend=false,focus=true}={}){
    if(!state.pageRows.length)return;
    const next={row:Math.min(Math.max(0,row),state.pageRows.length-1),col:Math.min(Math.max(0,col),COLUMNS.length-1)};
    state.selected=next;if(!extend||!state.anchor)state.anchor={...next};
    state.editing=null;renderWorksheet();if(focus)focusSelected();
  }
  function editorOptions(field,current){
    const values=[...optionSet(field)].filter((value,index,array)=>array.indexOf(value)===index);
    if(current&&!values.includes(current))values.unshift(current);
    return values.map(value=>`<option value="${escapeHtml(value)}" ${value===current?'selected':''}>${escapeHtml(value||'선택')}</option>`).join('');
  }
  function startEdit(initial=''){
    if(!state.selected||!canWrite())return;
    const column=COLUMNS[state.selected.col];if(column.readonly)return;
    const row=state.pageRows[state.selected.row],cell=root.document.querySelector(`#applicantWorksheet [data-row="${state.selected.row}"][data-col="${state.selected.col}"]`);if(!row||!cell)return;
    const current=text(row[column.key]),value=initial!==''?initial:current;
    state.editing={row:state.selected.row,col:state.selected.col,id:String(row.id),field:column.key,before:current};
    if(column.type==='select')cell.innerHTML=`<select class="worksheet-editor" aria-label="${escapeHtml(column.label)}">${editorOptions(column.key,current)}</select>`;
    else cell.innerHTML=`<input class="worksheet-editor" type="${column.type==='date'?'date':'text'}" aria-label="${escapeHtml(column.label)}" value="${escapeHtml(value)}">`;
    const editor=cell.querySelector('.worksheet-editor');if(!editor)return;
    if(initial!==''&&column.type!=='select')editor.value=initial;
    editor.focus();if(editor.select&&column.type!=='date')editor.select();
    editor.addEventListener('change',()=>{if(column.type==='select')commitEdit({move:'none'});});
    editor.addEventListener('blur',()=>root.setTimeout(()=>{if(state.editing&&root.document.activeElement!==editor)commitEdit({move:'none'});},0));
  }
  function commitEdit({move='none',cancel=false}={}){
    const editing=state.editing;if(!editing)return;
    const editor=root.document.querySelector(`#applicantWorksheet [data-row="${editing.row}"][data-col="${editing.col}"] .worksheet-editor`);
    const value=editor?.value??editing.before;state.editing=null;
    if(!cancel)setDirty(editing.id,editing.field,value,{render:false});
    let row=editing.row,col=editing.col;
    if(move==='nextRow')row++;
    if(move==='nextCell'){
      const editableIndexes=COLUMNS.map((column,index)=>column.readonly?-1:index).filter(index=>index>=0),position=editableIndexes.indexOf(col);
      if(position<editableIndexes.length-1)col=editableIndexes[position+1];else{row++;col=editableIndexes[0];}
    }
    if(move==='prevCell'){
      const editableIndexes=COLUMNS.map((column,index)=>column.readonly?-1:index).filter(index=>index>=0),position=editableIndexes.indexOf(col);
      if(position>0)col=editableIndexes[position-1];else{row--;col=editableIndexes[editableIndexes.length-1];}
    }
    renderWorksheet();selectCell(row,col,{focus:true});
  }
  function moveSelection(rowDelta,colDelta,extend){
    if(!state.selected)return;selectCell(state.selected.row+rowDelta,state.selected.col+colDelta,{extend});
  }
  function copySelection(event){
    const bounds=selectionBounds();if(!bounds)return;
    const lines=[];
    for(let row=bounds.rowFrom;row<=bounds.rowTo;row++){
      const values=[];for(let col=bounds.colFrom;col<=bounds.colTo;col++)values.push(cellValue(state.pageRows[row],COLUMNS[col],row));
      lines.push(values.join('\t'));
    }
    event.clipboardData?.setData('text/plain',lines.join('\n'));event.preventDefault();
  }
  function pasteSelection(event){
    if(!state.selected||!canWrite())return;
    event.preventDefault();
    try{
      const matrix=parseClipboard(event.clipboardData?.getData('text/plain')||'');
      const result=preparePaste({matrix,startRow:state.selected.row,startColumn:state.selected.col,rows:state.pageRows,optionMap:optionMap(),normalizers:normalizers()});
      const before=currentEntries();result.changes.forEach(change=>setDirtyRaw(change.id,change.field,change.value));
      if(recordHistory(state.history,before,currentEntries(),'직사각형 붙여넣기')){state.duplicatesConfirmed=false;recalculateReview();}
      recalculateErrors();state.lastNotice=`${result.changes.length}개 셀을 임시 변경했습니다.`;renderWorksheet();
      const last=result.changes[result.changes.length-1];state.anchor={row:state.selected.row,col:state.selected.col};state.selected={row:last.rowIndex,col:last.columnIndex};renderWorksheet();focusSelected();
    }catch(error){root.alert(`붙여넣기 취소: ${error.message||'현재 범위에 적용할 수 없습니다.'}`);}
  }
  function handleWorksheetClick(event){
    const cell=event.target.closest('#applicantWorksheet .worksheet-cell');if(!cell||event.target.closest('.worksheet-editor'))return;
    selectCell(Number(cell.dataset.row),Number(cell.dataset.col),{extend:event.shiftKey});
  }
  function handleWorksheetDblClick(event){
    const cell=event.target.closest('#applicantWorksheet .worksheet-cell');if(!cell)return;
    selectCell(Number(cell.dataset.row),Number(cell.dataset.col),{focus:false});startEdit();
  }
  function handleWorksheetKey(event){
    if(!root.document.getElementById('applicantWorksheet')?.contains(event.target))return;
    if(event.target.matches('.worksheet-editor')){
      if(event.key==='Escape'){event.preventDefault();commitEdit({cancel:true});}
      else if(event.key==='Enter'){event.preventDefault();commitEdit({move:'nextRow'});}
      else if(event.key==='Tab'){event.preventDefault();commitEdit({move:event.shiftKey?'prevCell':'nextCell'});}
      return;
    }
    if((event.ctrlKey||event.metaKey)&&!event.altKey){
      const key=event.key.toLowerCase();
      if(key==='z'){event.preventDefault();if(event.shiftKey)redoDirty();else undoDirty();return;}
      if(key==='y'){event.preventDefault();redoDirty();return;}
    }
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='c')return;
    if(event.key==='Enter'){event.preventDefault();startEdit();return;}
    if(event.key==='ArrowUp'){event.preventDefault();moveSelection(-1,0,event.shiftKey);return;}
    if(event.key==='ArrowDown'){event.preventDefault();moveSelection(1,0,event.shiftKey);return;}
    if(event.key==='ArrowLeft'){event.preventDefault();moveSelection(0,-1,event.shiftKey);return;}
    if(event.key==='ArrowRight'){event.preventDefault();moveSelection(0,1,event.shiftKey);return;}
    if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
      const column=COLUMNS[state.selected?.col];if(column&&!column.readonly&&column.type!=='select'){event.preventDefault();startEdit(event.key);}
    }
  }
  function closeFinalReview(){
    const modal=root.document.getElementById('applicantWorksheetReview');if(modal)modal.hidden=true;
    state.reviewOpen=false;
  }
  function openFinalReview(){
    if(!state.dirty.size)return false;
    if(!canWrite()){root.erpPermissions?.require?.('applicant.write');return false;}
    recalculateReview();
    if(state.errors.size){state.lastNotice='오류가 있는 셀은 저장할 수 없습니다.';renderWorksheet();return false;}
    if(state.duplicates.length&&!state.duplicatesConfirmed){state.lastNotice='중복 후보를 확인한 뒤 저장할 수 있습니다.';renderWorksheet();return false;}
    const modal=root.document.getElementById('applicantWorksheetReview');if(!modal)return false;
    const entries=currentEntries(),people=dirtyPeople();
    const summary=modal.querySelector('#applicantWorksheetReviewSummary');
    if(summary)summary.innerHTML='<div><strong>'+people+'</strong><span>변경 인원</span></div><div><strong>'+entries.length+'</strong><span>변경 필드</span></div><div><strong>0</strong><span>오류</span></div><div><strong>'+(state.duplicates.length?(state.duplicatesConfirmed?'확인 완료':'확인 필요'):'없음')+'</strong><span>중복 후보</span></div>';
    modal.hidden=false;state.reviewOpen=true;modal.querySelector('#btnWorksheetReviewConfirm')?.focus();return true;
  }
  function restoreStorage(key,value){try{if(value==null)root.localStorage.removeItem(key);else root.localStorage.setItem(key,value);}catch{}}
  function saveDirty(){
    if(!state.dirty.size)return true;
    if(!canWrite()){root.erpPermissions?.require?.('applicant.write');return false;}
    recalculateErrors();if(state.errors.size){state.lastNotice='오류가 있는 셀은 저장할 수 없습니다.';renderWorksheet();return false;}
    if(state.duplicates.length&&!state.duplicatesConfirmed){state.lastNotice='중복 후보를 확인한 뒤 저장할 수 있습니다.';renderWorksheet();return false;}
    if(!state.reviewOpen)return false;
    const entries=currentEntries(),people=dirtyPeople();
    const snapshot=deepClone(appRows()),storageBefore=root.localStorage.getItem(typeof STORAGE_KEY!=='undefined'?STORAGE_KEY:'recruit_erp_applicants_stable');
    const auditKey=root.erpAudit?.STORAGE_KEY||'recruit_erp_audit_logs_v1',auditBefore=root.localStorage.getItem(auditKey);
    const stamp=new Date().toISOString();
    try{
      applicants=applyPatches(snapshot,entries,row=>typeof normalize==='function'?normalize(row):row,stamp);
      const saved=typeof root.save==='function'?root.save():false;
      if(!saved)throw new Error('SAVE_REJECTED');
      state.dirty.clear();state.errors.clear();state.lastNotice=`${people}명의 변경을 저장했습니다.`;state.editing=null;
      state.duplicates=[];state.duplicatesConfirmed=false;state.history.undo.length=0;state.history.redo.length=0;
      const pending=state.pendingAction;closeFinalReview();renderWorksheet();persistSettings();
      if(pending){closeGuard();pending();}return true;
    }catch(error){
      applicants=snapshot;
      restoreStorage(typeof STORAGE_KEY!=='undefined'?STORAGE_KEY:'recruit_erp_applicants_stable',storageBefore);
      restoreStorage(auditKey,auditBefore);
      root.applicantProgressHistoryRefreshSnapshots?.();
      state.lastNotice='저장에 실패해 상태와 변경값을 저장 전으로 되돌렸습니다.';
      closeFinalReview();renderWorksheet();
      if(error?.message!=='SAVE_REJECTED')root.alert('워크시트 저장을 완료하지 못했습니다. 기존 데이터는 유지되었습니다.');
      return false;
    }
  }
  function ensureUi(){
    const section=root.document.getElementById('applicants');if(!section||root.document.getElementById('applicantWorksheet'))return;
    const header=section.querySelector('.applicant-list-header-row'),metrics=section.querySelector('.applicant-list-header-metrics');
    const toggle=root.document.createElement('div');toggle.className='worksheet-view-toggle';toggle.setAttribute('aria-label','지원자 목록 보기 방식');toggle.innerHTML='<button type="button" id="btnApplicantNormalView">일반보기</button><button type="button" id="btnApplicantWorksheetView">워크시트 보기</button>';
    if(header)header.insertBefore(toggle,metrics||null);
    const normalWrap=section.querySelector('#applicantTbody')?.closest('.table-wrap'),host=root.document.createElement('div');host.id='applicantWorksheet';host.className='applicant-worksheet-shell';host.hidden=true;
    normalWrap?.insertAdjacentElement('afterend',host);
    const modal=root.document.createElement('div');modal.id='applicantWorksheetGuard';modal.className='applicant-worksheet-guard';modal.hidden=true;modal.innerHTML='<div class="applicant-worksheet-guard-backdrop"></div><div class="applicant-worksheet-guard-card" role="dialog" aria-modal="true" aria-labelledby="applicantWorksheetGuardTitle"><h3 id="applicantWorksheetGuardTitle">저장하지 않은 워크시트 변경</h3><p>이동하기 전에 변경사항을 어떻게 처리할까요?</p><div><button type="button" class="primary" id="btnWorksheetGuardSave">변경사항 저장</button><button type="button" class="danger" id="btnWorksheetGuardDiscard">변경 취소</button><button type="button" class="ghost" id="btnWorksheetGuardStay">계속 편집</button></div></div>';
    root.document.body.appendChild(modal);
    const review=root.document.createElement('div');review.id='applicantWorksheetReview';review.className='applicant-worksheet-review';review.hidden=true;
    review.innerHTML='<div class="applicant-worksheet-review-backdrop"></div><div class="applicant-worksheet-review-card" role="dialog" aria-modal="true" aria-labelledby="applicantWorksheetReviewTitle"><span class="eyebrow">FINAL REVIEW</span><h3 id="applicantWorksheetReviewTitle">워크시트 변경 최종 확인</h3><p>아래 범위만 기존 지원자 저장 흐름으로 한 번 저장합니다.</p><div class="applicant-worksheet-review-grid" id="applicantWorksheetReviewSummary"></div><div class="applicant-worksheet-review-actions"><button type="button" class="ghost" id="btnWorksheetReviewCancel">취소</button><button type="button" class="primary" id="btnWorksheetReviewConfirm" data-required-permission="applicant.write">확인 후 저장</button></div></div>';
    root.document.body.appendChild(review);
    toggle.querySelector('#btnApplicantNormalView').addEventListener('click',()=>requestAction(()=>setViewMode('normal'),'일반보기로 이동'));
    toggle.querySelector('#btnApplicantWorksheetView').addEventListener('click',()=>setViewMode('worksheet'));
    modal.querySelector('#btnWorksheetGuardSave').addEventListener('click',openFinalReview);
    modal.querySelector('#btnWorksheetGuardDiscard').addEventListener('click',()=>{discardDirty();const action=state.pendingAction;closeGuard();action?.();});
    modal.querySelector('#btnWorksheetGuardStay').addEventListener('click',closeGuard);
    review.querySelector('#btnWorksheetReviewCancel').addEventListener('click',closeFinalReview);
    review.querySelector('#btnWorksheetReviewConfirm').addEventListener('click',saveDirty);
    review.querySelector('.applicant-worksheet-review-backdrop').addEventListener('click',closeFinalReview);
  }
  function closeGuard(){const modal=root.document.getElementById('applicantWorksheetGuard');if(modal)modal.hidden=true;state.pendingAction=null;}
  function requestAction(action,label='다른 화면으로 이동'){
    if(!state.dirty.size||state.bypassGuard){action();return true;}
    state.pendingAction=()=>{state.bypassGuard=true;try{action();}finally{state.bypassGuard=false;}};
    const modal=root.document.getElementById('applicantWorksheetGuard');if(modal){modal.hidden=false;modal.querySelector('p').textContent=`${label} 전에 변경사항을 저장하거나 취소하세요.`;modal.querySelector('#btnWorksheetGuardSave')?.focus();}
    return false;
  }
  function setViewMode(mode){
    state.viewMode=VIEW_MODES.includes(mode)?mode:'normal';
    const section=root.document.getElementById('applicants'),normalWrap=section?.querySelector('#applicantTbody')?.closest('.table-wrap'),host=root.document.getElementById('applicantWorksheet');
    if(normalWrap)normalWrap.hidden=state.viewMode==='worksheet';if(host)host.hidden=state.viewMode!=='worksheet';
    root.document.getElementById('btnApplicantNormalView')?.classList.toggle('active',state.viewMode==='normal');
    root.document.getElementById('btnApplicantWorksheetView')?.classList.toggle('active',state.viewMode==='worksheet');
    section?.classList.toggle('is-worksheet-mode',state.viewMode==='worksheet');
    persistSettings();if(state.viewMode==='worksheet')renderWorksheet();
  }
  function actionForGuardTarget(target,event){
    const workplace=target.closest('#workplaceTabs [data-workplace]');if(workplace)return {label:'근무지 필터 변경',run:()=>{root.document.querySelectorAll('#workplaceTabs [data-workplace]').forEach(button=>button.classList.toggle('active',button===workplace));currentWorkplace=workplace.dataset.workplace;renderTable();}};
    const filter=target.closest('#quickFilters [data-filter]');if(filter)return {label:'상태 필터 변경',run:()=>{root.document.querySelectorAll('#quickFilters [data-filter]').forEach(button=>button.classList.toggle('active',button===filter));currentFilter=filter.dataset.filter;renderTable();}};
    const pageButton=target.closest('#applicantPagination .applicant-page-btn');if(pageButton){const match=(pageButton.getAttribute('data-erp-handler')||'').match(/goApplicantPage\((\d+)\)/);if(match)return {label:'페이지 이동',run:()=>goApplicantPage(Number(match[1]))};}
    const reset=target.closest('#btnResetFilters');if(reset)return {label:'필터 초기화',run:()=>{resetListFiltersToAll();renderTable();}};
    const other=target.closest('#btnOpenApplicantFilter,#bulkModeButton,#btnStartScreeningWorkbench,#btnStartPhoneInterview');if(other)return {label:'다른 지원자 작업 열기',run:()=>other.click()};
    const nav=target.closest('.nav-btn[data-page],[data-go]');if(nav){const page=nav.dataset.page||nav.dataset.go;if(page&&page!=='applicants')return {label:'다른 화면으로 이동',run:()=>root.setPage(page)};}
    if(event.type==='change'&&target.id==='sortSelect'){const next=target.value;target.value=currentSort;return {label:'정렬 변경',run:()=>{currentSort=next;target.value=next;renderTable();}};}
    if(event.type==='change'&&target.id==='hideFinished'){const next=target.checked;target.checked=hideFinished;return {label:'종료 숨김 변경',run:()=>{hideFinished=next;target.checked=next;renderTable();}};}
    if(event.type==='change'&&target.closest('#applicantPagination')&&target.matches('select')){const next=Number(target.value);target.value=String(applicantPageSize);return {label:'페이지 크기 변경',run:()=>changeApplicantPageSize(next)};}
    if(event.type==='input'&&target.id==='searchInput'){const next=target.value;target.value=currentSearch;return {label:'검색 조건 변경',run:()=>{currentSearch=next;target.value=next;renderTable();}};}
    return null;
  }
  function guardUiEvent(event){
    if(!state.dirty.size||state.bypassGuard||state.viewMode!=='worksheet')return;
    const action=actionForGuardTarget(event.target,event);if(!action)return;
    event.preventDefault();event.stopImmediatePropagation();requestAction(action.run,action.label);
  }
  function installWrappers(){
    const previousRender=root.renderTable;
    if(typeof previousRender==='function'&&!previousRender.__worksheetV114){
      const wrapped=function(){const result=previousRender.apply(this,arguments);persistSettings();setViewMode(state.viewMode);return result;};wrapped.__worksheetV114=true;root.renderTable=wrapped;
    }
    const previousSetPage=root.setPage;
    if(typeof previousSetPage==='function'&&!previousSetPage.__worksheetV114){
      const wrapped=function(page){const active=root.document.querySelector('.page.active')?.id;if(active==='applicants'&&page!=='applicants'&&state.dirty.size&&!state.bypassGuard){requestAction(()=>previousSetPage.apply(this,arguments),'다른 화면으로 이동');return false;}return previousSetPage.apply(this,arguments);};wrapped.__worksheetV114=true;root.setPage=wrapped;
    }
  }
  function init(){
    if(state.initialized)return;state.initialized=true;ensureUi();loadSettings();installWrappers();
    root.document.addEventListener('click',guardUiEvent,true);root.document.addEventListener('change',guardUiEvent,true);root.document.addEventListener('input',guardUiEvent,true);
    root.document.addEventListener('click',handleWorksheetClick);root.document.addEventListener('dblclick',handleWorksheetDblClick);root.document.addEventListener('keydown',handleWorksheetKey);
    root.document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.reviewOpen){event.preventDefault();closeFinalReview();}});
    root.document.addEventListener('copy',event=>{if(root.document.getElementById('applicantWorksheet')?.contains(event.target))copySelection(event);});
    root.document.addEventListener('paste',event=>{if(root.document.getElementById('applicantWorksheet')?.contains(event.target))pasteSelection(event);});
    root.addEventListener('beforeunload',event=>{if(state.dirty.size){event.preventDefault();event.returnValue='';}});
    root.document.addEventListener('erp:permission-change',()=>renderWorksheet());
    setViewMode(state.viewMode);root.renderTable?.();
  }
  api.init=init;api.state=state;api.setViewMode=setViewMode;api.render=renderWorksheet;api.save=openFinalReview;api.discard=discardDirty;api.setDirty=setDirty;api.undo=undoDirty;api.redo=redoDirty;api.confirmDuplicates=confirmDuplicates;
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  return api;
});
