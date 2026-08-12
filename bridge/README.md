# Recruit ERP Bridge PoC

이 프로그램은 ERP Preview와 회사 PC의 로컬 프로그램이 통신 가능한지만 확인합니다.

- `127.0.0.1:17840`에만 연결됩니다.
- 지정한 ERP Preview Origin 하나만 CORS로 허용합니다.
- `GET /health` 외의 기능이 없습니다.
- 파일, ERP 데이터, localStorage, Supabase 및 DB에 접근하지 않습니다.

## Windows 실행

Node.js 20 이상이 설치된 PC에서 명령 프롬프트를 열고 다음처럼 실행합니다.

```text
bridge\start-erp-bridge.cmd https://YOUR-PREVIEW.vercel.app
```

주소에는 경로 없이 현재 테스트할 Preview의 정확한 Origin을 입력해야 합니다. 테스트가 끝나면 창에서 `Ctrl+C`를 눌러 종료합니다.
