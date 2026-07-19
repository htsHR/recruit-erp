/* =========================================================
   v10.8.0 Supabase 연동
   - 브라우저 저장(localStorage)은 그대로 유지 (항상 우선 동작, 오프라인/차단 시에도 안전)
   - window.sb가 연결돼 있으면 추가로 클라우드에도 동기화
   - 실패해도 절대 로컬 동작을 막지 않음 (전부 try/catch로 감쌈)
   ========================================================= */
let applicantEmployeeIdCloudUnsupported=false;
function applicantForCloud(a,legacy=false){
  var row={...a};
  if(legacy){ ['employeeId','failureReason','withdrawalReason','lastContactDate','nextContactDate','progressHistory','lastChangedBy','lastChangedAt'].forEach(function(k){delete row[k];}); }
  return row;
}
function applicantEmployeeIdColumnError(error){
  var msg=String(error&&error.message||error||'').toLowerCase();
  var fields=['employeeid','failurereason','withdrawalreason','lastcontactdate','nextcontactdate','progresshistory','lastchangedby','lastchangedat'];
  return fields.some(function(f){return msg.includes(f);})&&(msg.includes('column')||msg.includes('schema')||msg.includes('not found')||msg.includes('does not exist'));
}

function supabaseSyncAll(list){
  if(!canUseCloud()) return Promise.resolve({skipped:true,count:0});
  var targets=Array.isArray(list)?list.filter(Boolean):[];
  if(!targets.length) return Promise.resolve({skipped:true,count:0});
  var CHUNK_SIZE=250;
  return (async function(){
    var useLegacy=applicantEmployeeIdCloudUnsupported,saved=0;
    for(var start=0;start<targets.length;start+=CHUNK_SIZE){
      var chunk=targets.slice(start,start+CHUNK_SIZE);
      var res=await window.sb.from('applicants').upsert(chunk.map(function(a){return applicantForCloud(a,useLegacy);}));
      if(res&&res.error&&!useLegacy&&applicantEmployeeIdColumnError(res.error)){
        applicantEmployeeIdCloudUnsupported=true;useLegacy=true;
        console.warn('지원자 확장 필드용 Supabase 컬럼이 없어 기존 필드만 클라우드에 저장합니다. v10.46.0 SQL 실행 후 새로고침하면 진행 이력도 동기화됩니다.',res.error.message);
        res=await window.sb.from('applicants').upsert(chunk.map(function(a){return applicantForCloud(a,true);}));
      }
      if(res&&res.error) throw new Error(res.error.message||'지원자 Supabase 저장 실패');
      saved+=chunk.length;
    }
    setCloudSyncStatus('ok');
    return {saved:saved,count:targets.length,legacy:useLegacy};
  })().catch(function(e){console.warn('Supabase 저장 실패(로컬엔 정상 저장됨):',e);setCloudSyncStatus('error');return {error:e,count:targets.length};});
}
function supabaseDeleteOne(id){
  if(!canUseCloud()) return;
  window.sb.from('applicants').delete().eq('id', id).then(function(res){
    if(res && res.error) console.warn('Supabase 삭제 실패(로컬엔 정상 삭제됨):', res.error.message);
  }).catch(function(e){ console.warn('Supabase 삭제 실패(로컬엔 정상 삭제됨):', e); });
}
function supabaseDeleteAll(){
  if(!canUseCloud()) return;
  window.sb.from('applicants').delete().neq('id','__none__').then(function(res){
    if(res && res.error) console.warn('Supabase 전체삭제 실패(로컬엔 정상 삭제됨):', res.error.message);
  }).catch(function(e){ console.warn('Supabase 전체삭제 실패(로컬엔 정상 삭제됨):', e); });
}
/* =========================================================
   v10.9.0 자동 백업 스냅샷
   - 위험한 작업(전체삭제/JSON가져오기) 직전에 자동으로 스냅샷 저장
   - 하루 지나면 자동으로 "일일 스냅샷" 하나 추가 저장
   - 최근 14개까지만 유지(오래된 것은 자동 정리)
   - 전부 실패해도 로컬 동작에는 영향 없음(try/catch)
   ========================================================= */
function supabaseSnapshotSave(reason){
  if(!canUseCloud() || !applicants.length) return Promise.resolve();
  return window.sb.from('applicant_snapshots').insert({
    reason: reason || '',
    count: applicants.length,
    data: applicants
  }).then(function(res){
    if(res && res.error){ console.warn('스냅샷 저장 실패:', res.error.message); return; }
    supabaseSnapshotCleanup();
  }).catch(function(e){ console.warn('스냅샷 저장 실패:', e); });
}
function supabaseSnapshotCleanup(){
  if(!canUseCloud()) return;
  window.sb.from('applicant_snapshots').select('id,created_at').order('created_at',{ascending:false}).then(function(res){
    if(!res || res.error || !res.data) return;
    var extra = res.data.slice(14);
    if(!extra.length) return;
    var ids = extra.map(function(r){ return r.id; });
    window.sb.from('applicant_snapshots').delete().in('id', ids).then(function(){});
  }).catch(function(){});
}
function supabaseSnapshotDailyCheck(){
  if(!canUseCloud()) return;
  window.sb.from('applicant_snapshots').select('created_at').order('created_at',{ascending:false}).limit(1).then(function(res){
    if(res && res.error) return;
    var last = (res && res.data && res.data[0]) ? res.data[0].created_at : null;
    var need = true;
    if(last){ need = (Date.now() - new Date(last).getTime())/3600000 >= 20; }
    if(need){ supabaseSnapshotSave('일일 자동 백업').then(renderSnapshotList); }
  }).catch(function(){});
}
function renderSnapshotList(){
  var el = $('snapshotList');
  if(!el) return;
  if(!canUseCloud()){ el.innerHTML = '<div class="empty">회사 로컬 모드이거나 로그인되지 않아 클라우드 백업 이력을 사용하지 않습니다.</div>'; return; }
  window.sb.from('applicant_snapshots').select('id,created_at,reason,count').order('created_at',{ascending:false}).limit(14).then(function(res){
    if(!res || res.error || !res.data || !res.data.length){ el.innerHTML = '<div class="empty">아직 저장된 백업 이력이 없습니다. (자동으로 하루 단위로 쌓여요)</div>'; return; }
    el.innerHTML = res.data.map(function(s){
      var dt = new Date(s.created_at);
      var label = dt.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      return '<div class="snapshot-row"><span class="snapshot-time">'+esc(label)+'</span><span class="snapshot-reason">'+esc(s.reason||'')+'</span><span class="snapshot-count">'+s.count+'명</span><button class="mini" onclick="restoreSnapshot('+s.id+')">이 시점으로 복원</button></div>';
    }).join('');
  }).catch(function(){ el.innerHTML = '<div class="empty">백업 이력을 불러오지 못했습니다.</div>'; });
}
function restoreSnapshot(id){
  if(!canUseCloud()) return;
  if(!confirm('이 시점으로 복원하면 현재 데이터('+applicants.length+'명)가 그 시점 데이터로 교체됩니다.\n\n복원 전에 현재 상태도 자동으로 백업해둘게요. 진행할까요?')) return;
  supabaseSnapshotSave('복원 직전 자동 백업').then(function(){
    return window.sb.from('applicant_snapshots').select('data,count,created_at').eq('id', id).single();
  }).then(function(res){
    if(!res || res.error || !res.data){ alert('복원 실패: 스냅샷을 찾을 수 없습니다.'); return; }
    applicants = (res.data.data || []).map(normalize);
    save();
    renderSnapshotList();
    alert('복원 완료: '+applicants.length+'명 ('+new Date(res.data.created_at).toLocaleString('ko-KR')+' 시점)');
  }).catch(function(e){ alert('복원 중 오류가 발생했습니다: '+e); });
}
function supabaseSyncOnLoad(){
  if(!canUseCloud()) return;
  window.sb.from('applicants').select('*').then(function(res){
    if(res && res.error){ console.warn('Supabase 불러오기 실패, 로컬 데이터로 계속 진행:', res.error.message); setCloudSyncStatus('error'); return; }
    setCloudSyncStatus('ok');
    var cloud = (res && res.data) ? res.data.map(normalize) : [];
    var local = applicants;

    // v10.8.1: 무조건 덮어쓰기(위험) -> id 기준 병합(안전)으로 변경
    // 로컬에만 있는 지원자, 클라우드에만 있는 지원자 모두 보존.
    // 같은 id가 양쪽에 있으면 더 최근에 수정된 쪽을 채택.
    var map = {};
    local.forEach(function(a){ map[a.id] = a; });
    cloud.forEach(function(c){
      var l = map[c.id];
      if(!l){ map[c.id] = c; return; }
      var lt = l.updatedAt || l.createdAt || '';
      var ct = c.updatedAt || c.createdAt || '';
      map[c.id] = (ct > lt) ? c : l;
    });
    var merged = Object.keys(map).map(function(k){ return map[k]; });

    var beforeCount = local.length;
    applicants = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
    renderAll();
    // v10.35.1: 병합 직후 자동 재업로드(supabaseSyncAll) 제거.
    // 로드는 이제 읽기 전용 병합 + 화면 렌더만 수행하고, 클라우드에는 아무것도 쓰지 않음.
    // 신규 등록/수정/삭제/JSON 가져오기 등 사용자가 직접 저장을 실행할 때만 업로드됨(save() 등 기존 경로 그대로 유지).
    console.info('Supabase 동기화(병합) 완료: 로컬 ' + beforeCount + '명 + 클라우드 ' + cloud.length + '명 -> 화면에 ' + merged.length + '명 표시 (클라우드에는 다시 쓰지 않음)');
  }).catch(function(e){ console.warn('Supabase 연결 실패, 로컬 데이터로 계속 진행:', e); setCloudSyncStatus('error'); });
}
