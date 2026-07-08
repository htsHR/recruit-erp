// Supabase 접속 설정
// 1) Supabase 프로젝트 생성 후 Project Settings -> API 에서
//    "Project URL" 과 "anon public" 키를 복사해서 아래 두 줄에 붙여넣으세요.
// 2) 이 파일만 GitHub에 다시 올리면 바로 반영됩니다. (app.js 조각들은 안 건드려도 돼요)
window.SUPABASE_URL = 'https://yqijxkdmcpmvifkbamnr.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_76ZnnpWmk6oNVIEffXEOLw_ahXUlleU';

(function(){
  try {
    if (window.SUPABASE_URL.indexOf('YOUR_SUPABASE_URL') !== -1) {
      console.info('Supabase 연동 대기 중: supabase_config.js에 URL/키를 아직 입력하지 않았습니다. 브라우저 저장만 사용됩니다.');
      return;
    }
    window.sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  } catch (e) {
    console.warn('Supabase 클라이언트 초기화 실패, 브라우저 저장만 사용됩니다:', e);
  }
})();
