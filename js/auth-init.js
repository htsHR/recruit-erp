/* =========================================================
   v10.10.0 로그인(Supabase Auth)
   - 클라우드 미연결(window.sb 없음) 시에는 로그인 화면 자체를 안 띄움 (지금까지처럼 로컬만 사용)
   - 클라우드 연결됐는데 로그인 안 된 상태면 로그인 화면 표시
   - "로그인 없이 계속"을 누르면 로컬 데이터는 그대로 쓰되 클라우드 동기화는 시도하지 않음
   ========================================================= */
function showLoginOverlay(msg){
  var ov=$('loginOverlay');
  if(ov) ov.style.display='flex';
  if($('loginError')) $('loginError').textContent = msg || '';
}
function hideLoginOverlay(){ var ov=$('loginOverlay'); if(ov) ov.style.display='none'; }
function updateAuthNote(email){
  var note=$('authNote');
  var loggedIn=$('authLoggedIn');
  var loggedOut=$('authLoggedOut');
  if(note) note.style.display='flex';
  if(email){
    if(loggedIn) loggedIn.style.display='flex';
    if(loggedOut) loggedOut.style.display='none';
    if($('authEmailText')) $('authEmailText').textContent=email;
  } else {
    if(loggedIn) loggedIn.style.display='none';
    if(loggedOut) loggedOut.style.display='flex';
  }
  var topbarUser=$('topbarUser');
  if(topbarUser){
    if(email){
      topbarUser.style.display='flex';
      if($('topbarUserEmail')) $('topbarUserEmail').textContent=email;
      const userInitials=String(email||'HT').split('@')[0].replace(/[^a-zA-Z0-9가-힣]/g,'').slice(0,2).toUpperCase() || 'HT';
      if($('topbarUserMark')) $('topbarUserMark').textContent=userInitials;
      if($('authUserMark')) $('authUserMark').textContent=userInitials;
    } else {
      topbarUser.style.display='none';
    }
  }
}
function afterLoginSuccess(email){
  cloudAuthenticated = true;
  hideLoginOverlay();
  updateAuthNote(email);
  supabaseSyncOnLoad();
  supabaseSchoolsSyncOnLoad();
  supabaseEmployeesSyncOnLoad();
  renderSnapshotList();
  supabaseSnapshotDailyCheck();
}
function initAuth(){
  if(!window.sb) return;
  if(isCompanyLocalMode()){ cloudAuthenticated=false; hideLoginOverlay(); updateAuthNote(null); cloudSyncStatus='unknown'; updateStorageNote(); return; }
  window.sb.auth.getSession().then(function(res){
    var session = res && res.data ? res.data.session : null;
    if(session && session.user){ afterLoginSuccess(session.user.email); }
    else { cloudAuthenticated=false; showLoginOverlay(); updateAuthNote(null); }
  }).catch(function(){ showLoginOverlay(); });
}
function doLogin(){
  if(!window.sb) return;
  var email=($('loginEmail').value||'').trim();
  var pw=$('loginPassword').value||'';
  if(!email || !pw){ showLoginOverlay('이메일과 비밀번호를 입력해주세요.'); return; }
  showLoginOverlay('로그인 중...');
  window.sb.auth.signInWithPassword({email:email, password:pw}).then(function(res){
    if(res.error){ showLoginOverlay('로그인 실패: '+res.error.message); return; }
    afterLoginSuccess(res.data.user.email);
  }).catch(function(){ showLoginOverlay('로그인 중 오류가 발생했습니다.'); });
}
function doLogout(){
  if(!window.sb) return;
  window.sb.auth.signOut().then(function(){
    cloudAuthenticated=false;
    updateAuthNote(null);
    cloudSyncStatus='unknown';
    updateStorageNote();
    showLoginOverlay();
  });
}
function handleOperationEnvironmentChange(mode){
  if(mode === 'company'){
    cloudAuthenticated=false;
    hideLoginOverlay();
    updateAuthNote(null);
    cloudSyncStatus='unknown';
    updateStorageNote();
    renderSnapshotList();
    return;
  }
  initAuth();
}
window.erpHandleOperationEnvironmentChange = handleOperationEnvironmentChange;

bind('btnOpenLogin','click', ()=>{ if(!window.sb){ alert('Supabase 설정을 찾을 수 없습니다.'); return; } showLoginOverlay(); });
bind('btnLogin','click', doLogin);
bind('btnLoginSkip','click', ()=>{ cloudAuthenticated=false; hideLoginOverlay(); updateAuthNote(null); cloudSyncStatus='unknown'; updateStorageNote(); });
bind('btnLogout','click', doLogout);
bind('loginPassword','keydown', e=>{ if(e.key==='Enter') doLogin(); });

try{ resetForm(); resetCalendarEventForm(); renderAll(); updateStorageNote(); initAuth(); if($('rosterDate') && !$('rosterDate').value) $('rosterDate').value = today(); }catch(e){ console.error('Recruit ERP render error', e); alert('화면 표시 중 오류가 발생했습니다. app.js 교체 상태를 확인해주세요.'); }
