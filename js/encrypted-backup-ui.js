/* Recruit ERP v11.0.0 encrypted backup user interface. */
(function(root){
  'use strict';
  const core=root.erpEncryptedBackup;let modal=null;let previousFocus=null;let busy=false;let task=null;let sessionEpoch=0;
  const el=id=>root.document.getElementById(id);
  const hasPermission=()=>!root.erpPermissions||root.erpPermissions.require('backup.manage');
  const safeError=error=>{
    if(error?.code==='DECRYPT_FAILED')return '비밀번호가 맞지 않거나 파일이 손상되었습니다.';
    if(error?.code==='UNSAFE_BACKUP')return '복호화된 백업의 안전 검사에 실패했습니다.';
    if(error?.code==='INVALID_ENVELOPE')return '암호화 백업 파일 구조가 올바르지 않습니다.';
    if(error?.code==='FILE_TOO_LARGE')return '백업 파일이 허용 크기를 초과합니다.';
    return '암호화 작업을 완료하지 못했습니다.';
  };
  function clearSensitive(){
    ['encryptedBackupPassword','encryptedBackupConfirm'].forEach(id=>{const input=el(id);if(input)input.value='';});
    if(task?.password)task.password='';
  }
  function supportMessage(){return core?.isSupported()?'이 브라우저에서 Web Crypto 보안 기능을 사용할 수 있습니다.':'이 브라우저는 암호화 백업을 지원하지 않습니다. 최신 Chrome, Edge 또는 Firefox를 사용하세요.';}
  function installPanel(){
    el('bcEncryptedPanel')?.remove();
    const input=el('bcFileInput');if(input)input.accept='.erpbackup,.json,application/json';
    const zone=el('bcDropZone');if(zone){zone.querySelector('strong').textContent='내려받은 JSON 또는 기존 .erpbackup 파일을 선택하세요.';zone.querySelector('span').textContent='JSON은 바로 검사하고, 기존 암호화 파일만 비밀번호로 연 뒤 구조·건수·무결성을 검사합니다.';zone.querySelector('.file-label').firstChild.textContent='백업 파일 선택 및 검사';}
  }
  function installModal(){
    if(el('encryptedBackupDialog'))return;
    modal=root.document.createElement('div');modal.id='encryptedBackupDialog';modal.className='encrypted-backup-modal';modal.hidden=true;
    modal.innerHTML=`<div class="encrypted-backup-dialog" role="dialog" aria-modal="true" aria-labelledby="encryptedBackupTitle" aria-describedby="encryptedBackupDescription"><div class="encrypted-dialog-head"><div><p class="eyebrow">SECURE BACKUP</p><h3 id="encryptedBackupTitle">암호화 백업</h3></div><button class="icon-btn" id="encryptedBackupClose" type="button" aria-label="닫기">×</button></div><p id="encryptedBackupDescription" class="encrypted-dialog-description"></p><div class="encrypted-password-field"><label for="encryptedBackupPassword">비밀번호</label><div class="encrypted-password-control"><input id="encryptedBackupPassword" type="password" minlength="12" autocomplete="new-password" spellcheck="false"/><button class="mini" id="encryptedBackupToggle" type="button" aria-pressed="false">표시</button></div></div><div class="encrypted-password-field" id="encryptedBackupConfirmRow"><label for="encryptedBackupConfirm">비밀번호 확인</label><input id="encryptedBackupConfirm" type="password" minlength="12" autocomplete="new-password" spellcheck="false"/></div><div class="encrypted-password-help" id="encryptedBackupHelp"></div><div class="encrypted-progress" id="encryptedBackupProgress" role="status" aria-live="polite"></div><div class="encrypted-dialog-actions"><button class="ghost" id="encryptedBackupCancel" type="button">취소</button><button class="primary" id="encryptedBackupSubmit" type="button">파일 생성</button></div></div>`;
    root.document.body.appendChild(modal);
    el('encryptedBackupClose').addEventListener('click',()=>closeDialog(true));el('encryptedBackupCancel').addEventListener('click',()=>closeDialog(true));
    el('encryptedBackupToggle').addEventListener('click',()=>{const input=el('encryptedBackupPassword');const show=input.type==='password';input.type=show?'text':'password';el('encryptedBackupConfirm').type=show?'text':'password';el('encryptedBackupToggle').textContent=show?'숨기기':'표시';el('encryptedBackupToggle').setAttribute('aria-pressed',String(show));});
    ['encryptedBackupPassword','encryptedBackupConfirm'].forEach(id=>{el(id).addEventListener('input',renderAssessment);el(id).addEventListener('copy',event=>event.preventDefault());el(id).addEventListener('cut',event=>event.preventDefault());});
    el('encryptedBackupSubmit').addEventListener('click',submit);
    modal.addEventListener('mousedown',event=>{if(event.target===modal)closeDialog(true);});
    modal.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeDialog(true);return;}if(event.key==='Tab')trapTab(event);});
  }
  function trapTab(event){const nodes=[...modal.querySelectorAll('button:not([disabled]),input:not([disabled])')].filter(node=>!node.closest('[hidden]'));if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&root.document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&root.document.activeElement===last){event.preventDefault();first.focus();}}
  function renderAssessment(){
    if(!task)return;const password=el('encryptedBackupPassword').value;const result=core.passwordAssessment(password);const help=el('encryptedBackupHelp');
    if(!password){help.textContent='이 파일을 만들 때 사용한 비밀번호를 입력하세요.';help.className='encrypted-password-help';return result;}
    help.textContent=[...result.errors,...result.warnings].join(' ')||'12자 이상의 긴 문장형 비밀번호를 권장합니다.';help.className=`encrypted-password-help ${result.errors.length?'error':result.warnings.length?'warn':'ok'}`;return result;
  }
  function openDialog(next){
    if(busy)return;installModal();previousFocus=root.document.activeElement;task=next;modal.hidden=false;root.document.body.classList.add('modal-open');
    el('encryptedBackupTitle').textContent='기존 암호화 백업 열기';el('encryptedBackupDescription').textContent='이전에 만든 .erpbackup 파일을 검사하기 위해 당시 비밀번호를 입력하세요.';el('encryptedBackupConfirmRow').hidden=true;el('encryptedBackupSubmit').textContent='비밀번호 확인 후 검사';el('encryptedBackupPassword').autocomplete='current-password';el('encryptedBackupProgress').textContent='';clearSensitive();renderAssessment();setTimeout(()=>el('encryptedBackupPassword').focus(),0);
  }
  function closeDialog(cancelled=false){
    if(!modal||modal.hidden||busy)return;if(cancelled&&task?.kind==='decrypt')root.erpBackupCenter?.recordAudit?.('restore','복원 취소',{encrypted:true,success:false});
    endSession({restoreFocus:true});
  }
  function endSession(options={}){
    sessionEpoch++;clearSensitive();task=null;busy=false;
    if(modal){['encryptedBackupPassword','encryptedBackupConfirm','encryptedBackupToggle','encryptedBackupSubmit','encryptedBackupCancel','encryptedBackupClose'].forEach(id=>{const node=el(id);if(node)node.disabled=false;});modal.querySelector('.encrypted-backup-dialog')?.classList.remove('is-busy');modal.hidden=true;}
    root.document.body.classList.remove('modal-open');const focus=previousFocus;previousFocus=null;if(options.restoreFocus)focus?.focus?.();
  }
  function setBusy(value,message=''){busy=value;['encryptedBackupPassword','encryptedBackupConfirm','encryptedBackupToggle','encryptedBackupSubmit','encryptedBackupCancel','encryptedBackupClose'].forEach(id=>{el(id).disabled=value;});el('encryptedBackupProgress').textContent=message;modal?.querySelector('.encrypted-backup-dialog')?.classList.toggle('is-busy',value);}
  async function submit(){
    if(!task||busy)return;const currentTask=task;const epoch=sessionEpoch;const password=el('encryptedBackupPassword').value;const assessment=core.passwordAssessment(password);if(!assessment.valid){renderAssessment();el('encryptedBackupPassword').focus();return;}
    setBusy(true,'파일을 안전하게 복호화하고 검사하는 중입니다…');
    try{
      const parsed=await core.decryptEnvelope(currentTask.envelope,password);if(epoch!==sessionEpoch)return;root.erpBackupCenter.inspectDecryptedFile(currentTask.file,parsed,password);if(epoch!==sessionEpoch)return;
      setBusy(false,'복호화와 무결성 검사를 완료했습니다.');clearSensitive();setTimeout(()=>closeDialog(false),450);
    }catch(error){if(epoch!==sessionEpoch)return;setBusy(false,'');if(currentTask.kind==='decrypt')root.erpBackupCenter?.recordAudit?.('restore','암호화 백업 파일 검사 실패',{encrypted:true,backupType:'restore',success:false});el('encryptedBackupHelp').textContent=safeError(error);el('encryptedBackupHelp').className='encrypted-password-help error';clearSensitive();el('encryptedBackupPassword').focus();}
  }
  function openExportDialog(type='full'){if(!hasPermission())return null;return root.erpBackupCenter?.exportPlain?.(type)||null;}
  async function inspectFile(file){
    if(!hasPermission())return;if(!core?.isSupported()){root.alert(supportMessage());return;}if(!file)return;
    try{if(file.size>core.MAX_FILE_BYTES)throw new Error('백업 파일이 50MB를 초과합니다.');const envelope=core.parseEnvelope(await file.text());openDialog({kind:'decrypt',file,envelope});}
    catch(error){root.erpBackupCenter?.recordAudit?.('restore','암호화 백업 파일 검사 실패',{encrypted:true,success:false});root.alert(`암호화 백업 파일 검사 실패\n\n${safeError(error)}`);const input=el('bcFileInput');if(input)input.value='';}
  }
  function init(){installPanel();installModal();root.erpPermissions?.applyUi?.();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  root.erpEncryptedBackupUI={openExportDialog,inspectFile,clearSensitive,endSession,closeDialog,__test:{openDialog,renderAssessment,supportMessage}};
})(typeof window!=='undefined'?window:globalThis);
