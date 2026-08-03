/* Recruit ERP v10.61.0 encrypted backup user interface. */
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
    const company=el('bcCompanySection');if(!company||el('bcEncryptedPanel'))return;
    const panel=root.document.createElement('section');panel.id='bcEncryptedPanel';panel.className='backup-section-card encrypted-backup-panel';panel.dataset.requiredPermission='backup.manage';
    panel.innerHTML=`<div class="backup-section-head"><div><p class="eyebrow">AES-GCM · PASSWORD PROTECTED</p><h3>암호화 백업</h3><p>개인정보가 포함된 백업은 비밀번호로 잠가 .erpbackup 파일로 저장합니다.</p></div><span class="backup-section-number">🔒</span></div><div class="encrypted-support ${core?.isSupported()?'ok':'error'}"><strong>${core?.isSupported()?'암호화 기능 사용 가능':'암호화 기능 사용 불가'}</strong><span>${supportMessage()}</span></div><div class="backup-primary-action encrypted-primary"><div><h4>암호화 ERP 전체 백업</h4><p>지원자·학교·사원·일정·입사대기 정보를 하나의 암호화 파일로 보관합니다.</p></div><button class="primary" id="bcEncryptedFull" type="button">암호화 전체 백업</button></div><div class="backup-component-grid encrypted-components"><div class="backup-component-card"><strong>지원자</strong><span>개인정보 보호 백업</span><button class="mini" data-encrypted-backup="applicants" type="button">암호화 다운로드</button></div><div class="backup-component-card"><strong>사원명부</strong><span>개인정보 보호 백업</span><button class="mini" data-encrypted-backup="employees" type="button">암호화 다운로드</button></div><div class="backup-component-card"><strong>협력학교</strong><span>연락처 포함 가능</span><button class="mini" data-encrypted-backup="schools" type="button">암호화 다운로드</button></div><div class="backup-component-card"><strong>입사대기 입력정보</strong><span>암호화 필수 민감정보</span><button class="mini" data-encrypted-backup="hireWaitingProfiles" type="button">암호화 다운로드</button></div></div><ul class="encrypted-backup-guidance"><li>비밀번호는 서버나 브라우저 저장소에 저장되지 않습니다.</li><li>비밀번호를 잊으면 백업을 복구할 수 없습니다.</li><li>회사 승인 저장 위치에만 보관하세요.</li></ul>`;
    company.parentNode.insertBefore(panel,company);
    panel.querySelector('#bcEncryptedFull')?.addEventListener('click',()=>openExportDialog('full'));
    panel.querySelectorAll('[data-encrypted-backup]').forEach(button=>button.addEventListener('click',()=>openExportDialog(button.dataset.encryptedBackup)));
    if(!core?.isSupported())panel.querySelectorAll('button').forEach(button=>button.disabled=true);

    const legacyParts=[company.querySelector('.backup-primary-action'),company.querySelector('.backup-component-grid')].filter(Boolean);
    if(legacyParts.length){const details=root.document.createElement('details');details.className='legacy-backup-details';details.innerHTML='<summary>고급 메뉴 · 이전 평문 JSON 내보내기</summary><div class="legacy-backup-warning"><strong>개인정보 노출 주의</strong><span>평문 JSON은 파일을 열면 내용을 읽을 수 있습니다. 이전 업무 호환이 꼭 필요한 관리자만 사용하세요.</span></div>';legacyParts.forEach(part=>details.appendChild(part));company.appendChild(details);}
    const input=el('bcFileInput');if(input)input.accept='.erpbackup,.json,application/json';
    const zone=el('bcDropZone');if(zone){zone.querySelector('strong').textContent='회사에서 내려받은 .erpbackup 또는 JSON 파일을 선택하세요.';zone.querySelector('span').textContent='암호화 파일은 비밀번호로 복호화한 뒤 기존 구조·건수·무결성 검사를 진행합니다.';zone.querySelector('.file-label').firstChild.textContent='백업 파일 선택 및 검사';}
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
    if(!task)return;const password=el('encryptedBackupPassword').value;const confirmation=task.kind==='export'?el('encryptedBackupConfirm').value:undefined;const result=core.passwordAssessment(password,confirmation);const help=el('encryptedBackupHelp');
    if(task.kind==='decrypt'&&!password){help.textContent='이 파일을 만들 때 사용한 비밀번호를 입력하세요.';help.className='encrypted-password-help';return result;}
    help.textContent=[...result.errors,...result.warnings].join(' ')||'12자 이상의 긴 문장형 비밀번호를 권장합니다.';help.className=`encrypted-password-help ${result.errors.length?'error':result.warnings.length?'warn':'ok'}`;return result;
  }
  function openDialog(next){
    if(busy)return;installModal();previousFocus=root.document.activeElement;task=next;modal.hidden=false;root.document.body.classList.add('modal-open');
    const decrypt=next.kind==='decrypt';el('encryptedBackupTitle').textContent=decrypt?'암호화 백업 복호화':'암호화 백업 비밀번호';el('encryptedBackupDescription').textContent=decrypt?'비밀번호는 이 작업 동안 메모리에서만 사용되며, 복호화 후 기존 백업 검사를 진행합니다.':'비밀번호를 잊으면 복구할 수 없습니다. 회사 승인 저장 위치에 파일과 비밀번호를 분리해 보관하세요.';el('encryptedBackupConfirmRow').hidden=decrypt;el('encryptedBackupSubmit').textContent=decrypt?'복호화 및 검사':'암호화 파일 생성';el('encryptedBackupPassword').autocomplete=decrypt?'current-password':'new-password';el('encryptedBackupProgress').textContent='';clearSensitive();renderAssessment();setTimeout(()=>el('encryptedBackupPassword').focus(),0);
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
    if(!task||busy)return;const currentTask=task;const epoch=sessionEpoch;const password=el('encryptedBackupPassword').value;const assessment=core.passwordAssessment(password,currentTask.kind==='export'?el('encryptedBackupConfirm').value:undefined);if(!assessment.valid){renderAssessment();el('encryptedBackupPassword').focus();return;}
    setBusy(true,currentTask.kind==='decrypt'?'파일을 안전하게 복호화하고 검사하는 중입니다…':'파일을 암호화하는 중입니다…');
    try{
      if(currentTask.kind==='export'){
        await root.erpBackupCenter.exportEncrypted(currentTask.type,password);if(epoch!==sessionEpoch)return;setBusy(false,'암호화 백업 파일 다운로드를 요청했습니다. 저장된 파일을 확인하세요.');clearSensitive();setTimeout(()=>closeDialog(false),700);
      }else{
        const parsed=await core.decryptEnvelope(currentTask.envelope,password);if(epoch!==sessionEpoch)return;root.erpBackupCenter.inspectDecryptedFile(currentTask.file,parsed,password);if(epoch!==sessionEpoch)return;
        setBusy(false,'복호화와 무결성 검사를 완료했습니다.');clearSensitive();setTimeout(()=>closeDialog(false),450);
      }
    }catch(error){if(epoch!==sessionEpoch)return;setBusy(false,'');if(currentTask.kind==='decrypt')root.erpBackupCenter?.recordAudit?.('restore','암호화 백업 파일 검사 실패',{encrypted:true,backupType:'restore',success:false});el('encryptedBackupHelp').textContent=safeError(error);el('encryptedBackupHelp').className='encrypted-password-help error';clearSensitive();el('encryptedBackupPassword').focus();}
  }
  function openExportDialog(type='full'){if(!hasPermission())return;if(!core?.isSupported()){root.alert(supportMessage());return;}openDialog({kind:'export',type});}
  async function inspectFile(file){
    if(!hasPermission())return;if(!core?.isSupported()){root.alert(supportMessage());return;}if(!file)return;
    try{if(file.size>core.MAX_FILE_BYTES)throw new Error('백업 파일이 50MB를 초과합니다.');const envelope=core.parseEnvelope(await file.text());openDialog({kind:'decrypt',file,envelope});}
    catch(error){root.erpBackupCenter?.recordAudit?.('restore','암호화 백업 파일 검사 실패',{encrypted:true,success:false});root.alert(`암호화 백업 파일 검사 실패\n\n${safeError(error)}`);const input=el('bcFileInput');if(input)input.value='';}
  }
  function init(){installPanel();installModal();root.erpPermissions?.applyUi?.();}
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  root.erpEncryptedBackupUI={openExportDialog,inspectFile,clearSensitive,endSession,closeDialog,__test:{openDialog,renderAssessment,supportMessage}};
})(typeof window!=='undefined'?window:globalThis);
