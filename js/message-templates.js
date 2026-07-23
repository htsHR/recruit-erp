/* ===== v10.46.8.1 MESSAGE LIBRARY ===== */
function normalizeMessageTemplate(raw){
  const row=raw&&typeof raw==='object'?raw:{};
  return {id:String(row.id||uid()),title:String(row.title||'').trim(),category:String(row.category||'기타').trim()||'기타',body:String(row.body||row.text||''),favorite:!!row.favorite,createdAt:row.createdAt||new Date().toISOString(),updatedAt:row.updatedAt||''};
}
function loadMessageTemplates(){
  try{const parsed=JSON.parse(localStorage.getItem(MESSAGE_TEMPLATES_KEY)||'[]');return Array.isArray(parsed)?parsed.map(normalizeMessageTemplate).filter(x=>x.title||x.body):[];}catch(err){console.warn('문구함 로드 실패:',err);return [];}
}
function saveMessageTemplates(){
  try{localStorage.setItem(MESSAGE_TEMPLATES_KEY,JSON.stringify(messageTemplates.map(normalizeMessageTemplate)));return true;}catch(err){console.error('문구함 저장 실패:',err);return false;}
}
let messageTemplateCurrentId='';
let messageTemplateSearch='';
function messageTemplateEl(id){return document.getElementById(id);}
function messageTemplateSelected(){return messageTemplates.find(x=>String(x.id)===String(messageTemplateCurrentId))||null;}
function messageTemplateCount(){const body=messageTemplateEl('messageTemplateBody')?.value||'';const bytes=[...body].reduce((n,ch)=>n+(ch.charCodeAt(0)>127?2:1),0);if(messageTemplateEl('messageTemplateCharCount'))messageTemplateEl('messageTemplateCharCount').textContent=`${body.length}자 · 약 ${bytes}byte`;}
function renderMessageTemplateList(){
  const host=messageTemplateEl('messageTemplateList');if(!host)return;
  const q=messageTemplateSearch.trim().toLowerCase();
  const rows=[...messageTemplates].filter(x=>!q||`${x.title} ${x.category} ${x.body}`.toLowerCase().includes(q)).sort((a,b)=>Number(b.favorite)-Number(a.favorite)||(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  host.innerHTML=rows.length?rows.map(x=>`<button type="button" class="message-library-item ${String(x.id)===String(messageTemplateCurrentId)?'active':''}" data-message-template-id="${esc(x.id)}"><span class="message-library-item-head"><strong>${esc(x.title||'제목 없음')}</strong>${x.favorite?'<em>자주 사용</em>':''}</span><small>${esc(x.category||'기타')}</small><p>${esc(String(x.body||'').replace(/\s+/g,' ').slice(0,78))||'내용 없음'}</p></button>`).join(''):'<div class="message-library-empty">저장된 문구가 없습니다.<br>오른쪽에서 첫 문구를 작성해 저장하세요.</div>';
  host.querySelectorAll('[data-message-template-id]').forEach(btn=>btn.addEventListener('click',()=>openMessageTemplate(btn.dataset.messageTemplateId)));
  const count=messageTemplateEl('messageTemplateListCount');if(count)count.textContent=`${rows.length}개`;
}
function clearMessageTemplateEditor(){
  messageTemplateCurrentId='';
  if(messageTemplateEl('messageTemplateTitle'))messageTemplateEl('messageTemplateTitle').value='';
  if(messageTemplateEl('messageTemplateCategory'))messageTemplateEl('messageTemplateCategory').value='면접 안내';
  if(messageTemplateEl('messageTemplateBody'))messageTemplateEl('messageTemplateBody').value='';
  if(messageTemplateEl('messageTemplateFavorite'))messageTemplateEl('messageTemplateFavorite').checked=false;
  if(messageTemplateEl('btnDeleteMessageTemplate'))messageTemplateEl('btnDeleteMessageTemplate').disabled=true;
  if(messageTemplateEl('messageTemplateEditorMode'))messageTemplateEl('messageTemplateEditorMode').textContent='새 문구';
  messageTemplateCount();renderMessageTemplateList();messageTemplateEl('messageTemplateTitle')?.focus();
}
function openMessageTemplate(id){
  const row=messageTemplates.find(x=>String(x.id)===String(id));if(!row)return;
  messageTemplateCurrentId=String(row.id);
  messageTemplateEl('messageTemplateTitle').value=row.title||'';
  messageTemplateEl('messageTemplateCategory').value=row.category||'기타';
  messageTemplateEl('messageTemplateBody').value=row.body||'';
  messageTemplateEl('messageTemplateFavorite').checked=!!row.favorite;
  messageTemplateEl('btnDeleteMessageTemplate').disabled=false;
  messageTemplateEl('messageTemplateEditorMode').textContent='문구 수정';
  messageTemplateCount();renderMessageTemplateList();
}
function saveMessageTemplateFromEditor(){
  const title=String(messageTemplateEl('messageTemplateTitle')?.value||'').trim();
  const body=String(messageTemplateEl('messageTemplateBody')?.value||'').trim();
  const category=String(messageTemplateEl('messageTemplateCategory')?.value||'기타').trim();
  const favorite=!!messageTemplateEl('messageTemplateFavorite')?.checked;
  if(!title){alert('문구 제목을 입력해주세요.');messageTemplateEl('messageTemplateTitle')?.focus();return;}
  if(!body){alert('복사할 문자 내용을 입력해주세요.');messageTemplateEl('messageTemplateBody')?.focus();return;}
  const now=new Date().toISOString(),old=messageTemplateSelected();
  const next=normalizeMessageTemplate({id:old?.id||uid(),title,category,body,favorite,createdAt:old?.createdAt||now,updatedAt:now});
  messageTemplates=old?messageTemplates.map(x=>String(x.id)===String(old.id)?next:x):[next,...messageTemplates];
  if(!saveMessageTemplates()){alert('브라우저 저장공간에 문구를 저장하지 못했습니다.');return;}
  messageTemplateCurrentId=next.id;renderMessageTemplateList();openMessageTemplate(next.id);
  if(typeof uxToast==='function')uxToast(old?'문구를 수정했습니다.':'새 문구를 저장했습니다.');
}
async function copyMessageTemplate(){
  const body=String(messageTemplateEl('messageTemplateBody')?.value||'');if(!body.trim()){alert('복사할 문구가 없습니다.');return;}
  try{await navigator.clipboard.writeText(body);if(typeof uxToast==='function')uxToast('문구를 복사했습니다. 알리고에 붙여넣으세요.');}
  catch{messageTemplateEl('messageTemplateBody')?.select();document.execCommand?.('copy');if(typeof uxToast==='function')uxToast('문구를 선택했습니다. Ctrl+C로 복사해주세요.','warn');}
}
function deleteMessageTemplate(){
  const row=messageTemplateSelected();if(!row)return;
  if(!confirm(`“${row.title}” 문구를 삭제할까요?`))return;
  messageTemplates=messageTemplates.filter(x=>String(x.id)!==String(row.id));saveMessageTemplates();clearMessageTemplateEditor();if(typeof uxToast==='function')uxToast('문구를 삭제했습니다.');
}
function initMessageTemplateLibrary(){
  messageTemplates=loadMessageTemplates();
  messageTemplateEl('btnNewMessageTemplate')?.addEventListener('click',clearMessageTemplateEditor);
  messageTemplateEl('btnSaveMessageTemplate')?.addEventListener('click',saveMessageTemplateFromEditor);
  messageTemplateEl('btnCopyMessageTemplate')?.addEventListener('click',copyMessageTemplate);
  messageTemplateEl('btnDeleteMessageTemplate')?.addEventListener('click',deleteMessageTemplate);
  messageTemplateEl('messageTemplateSearch')?.addEventListener('input',e=>{messageTemplateSearch=e.target.value;renderMessageTemplateList();});
  messageTemplateEl('messageTemplateBody')?.addEventListener('input',messageTemplateCount);
  renderMessageTemplateList();messageTemplateCount();
  if(messageTemplates.length)openMessageTemplate(messageTemplates[0].id);else clearMessageTemplateEditor();
}
window.normalizeMessageTemplate=normalizeMessageTemplate;
window.loadMessageTemplates=loadMessageTemplates;
window.renderMessageTemplateList=renderMessageTemplateList;
initMessageTemplateLibrary();
