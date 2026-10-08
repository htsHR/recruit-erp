'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');

const root=path.resolve(__dirname,'..');
const port=4183;
const baseUrl=`http://127.0.0.1:${port}`;
const outputDir=process.env.UI_SCREENSHOT_DIR||path.join(root,'artifacts','ui-v12.7.1');
fs.mkdirSync(outputDir,{recursive:true});
const executableCandidates=[process.env.ERP_CHROMIUM_EXECUTABLE,...(process.platform==='win32'
  ?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
  :['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'])].filter(Boolean);
const executablePath=executableCandidates.find(file=>fs.existsSync(file));
if(!executablePath)throw new Error('자동 UI 검사에 사용할 Chrome/Chromium을 찾지 못했습니다.');

const fakeApplicants=[
  {id:'11111111-1111-4111-8111-111111111111',name:'가상지원자1',phone:'010-0000-0001',applyDate:'2026-08-01',workplace:'천안',status:'서류검토',school:'가상대학교',createdAt:'2026-08-01T01:00:00.000Z'},
  {id:'22222222-2222-4222-8222-222222222222',name:'가상지원자2',phone:'010-0000-0002',applyDate:'2026-08-02',workplace:'평택',status:'면접예정',interviewDate:'2099-08-02',interviewTime:'10:00',createdAt:'2026-08-02T01:00:00.000Z'},
  {id:'33333333-3333-4333-8333-333333333333',name:'가상지원자3',phone:'010-0000-0003',applyDate:'2026-08-03',workplace:'천안',status:'입사예정',hireDate:'2099-08-06',createdAt:'2026-08-03T01:00:00.000Z'},
  ...Array.from({length:6},(_,index)=>({
    id:`synthetic-roster-browser-${index+1}`,name:`가상면접자${index+1}`,phone:`010-0000-10${String(index+1).padStart(2,'0')}`,applyDate:'2099-09-01',workplace:index%2?'평택':'천안',gender:index%2?'여자':'남자',birthYear:'2000-01-01',age:'26',status:'면접예정',interviewDate:'2099-09-03',interviewTime:`${String(9+Math.floor(index/2)).padStart(2,'0')}:${index%2?'30':'00'}`,createdAt:`2099-09-01T00:00:0${index}.000Z`
  }))
];
const server=spawn(process.execPath,[path.join(__dirname,'serve-static.js')],{cwd:root,env:{...process.env,ERP_TEST_PORT:String(port)},stdio:['ignore','pipe','pipe']});
const waitForServer=()=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('로컬 UI 서버 시작 시간 초과')),5000);
  server.stdout.on('data',data=>{if(String(data).includes(baseUrl)){clearTimeout(timer);resolve();}});
  server.once('exit',code=>{clearTimeout(timer);reject(new Error(`로컬 UI 서버 종료: ${code}`));});
});

(async()=>{
  let browser;
  try{
    await waitForServer();
    browser=await chromium.launch({headless:true,executablePath,args:['--no-sandbox']});
    for(const viewport of [{name:'wide',width:1920,height:1080},{name:'desktop',width:1366,height:768},{name:'laptop',width:1024,height:768},{name:'tablet',width:768,height:1024},{name:'mobile',width:390,height:844}]){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});
      const page=await context.newPage();
      await page.addInitScript(()=>{
        Object.defineProperty(window,'print',{configurable:true,writable:true,value:()=>{window.__rosterPrintCalls=(window.__rosterPrintCalls||0)+1;}});
        window.__rosterPrintCalls=0;window.__rosterPrintStubInstalled=true;window.__rosterPrintLifecycle=[];
        window.addEventListener('beforeprint',()=>window.__rosterPrintLifecycle.push({event:'beforeprint',active:document.body?.classList.contains('roster-printing')}),true);
        window.addEventListener('afterprint',()=>window.__rosterPrintLifecycle.push({event:'afterprint',active:document.body?.classList.contains('roster-printing')}),true);
      });
      const errors=[];
      let rosterPrivacyConfirm='';
      let backupPrivacyConfirm='';
      let excelBatchConfirm='';
      page.on('pageerror',error=>errors.push(`pageerror: ${error.message}`));
      page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`);});
      page.on('dialog',dialog=>{
        if(/지원자 명단 인쇄/.test(dialog.message())){rosterPrivacyConfirm=dialog.message();return dialog.accept();}
        if(/JSON 백업/.test(dialog.message())){backupPrivacyConfirm=dialog.message();return dialog.accept();}
        if(/엑셀 붙여넣기 내용을 적용할까요/.test(dialog.message())){excelBatchConfirm=dialog.message();return dialog.accept();}
        return dialog.dismiss();
      });
      await page.goto(baseUrl,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.body?.classList.contains('ux12-ready'));
      assert.equal(await page.locator('.page.active').getAttribute('id'),'applicants',`${viewport.name}: 바로 지원자 목록으로 진입`);
      await page.evaluate(rows=>{
        localStorage.setItem('recruit_erp_data_epoch','v12.0.2-reset-1');
        localStorage.setItem('recruit_erp_applicants_stable',JSON.stringify(rows));
        localStorage.setItem('recruit_erp_schools',JSON.stringify([{id:'legacy-school',name:'보존학교'}]));
        localStorage.setItem('recruit_erp_employees',JSON.stringify([{id:'legacy-employee',name:'보존사원'}]));
        localStorage.setItem('recruit_erp_hire_waiting_profiles',JSON.stringify([{id:'legacy-waiting-profile',applicantId:'legacy-applicant',groupName:'보존그룹',unknownField:'원문 유지'}]));
      },fakeApplicants);
      await page.reload({waitUntil:'networkidle'});
      await page.waitForFunction(()=>document.body?.classList.contains('ux12-ready'));
      assert.deepEqual(await page.evaluate(()=>({stored:JSON.parse(localStorage.getItem('recruit_erp_applicants_stable')||'[]').length,loaded:applicants.length})),{stored:fakeApplicants.length,loaded:fakeApplicants.length},`${viewport.name}: 기존 지원자 데이터 복원`);
      assert.equal(await page.evaluate(()=>document.body.innerText.trim().length>0),true,`${viewport.name}: 빈 화면`);
      assert.equal(await page.locator('.nav-btn').count(),5,`${viewport.name}: 메뉴는 5개여야 합니다.`);
      assert.deepEqual(await page.locator('section.page').evaluateAll(nodes=>nodes.map(node=>node.id)),['home','applicants','form','today','hireWaiting','calendar','backup']);
      assert.equal(await page.locator('#stats,#schools,#employees,#templates,#advancedSearch,#dataHealth,#duplicates,#permissions,#auditHistory,#onboarding,#storagePerformance,#productionReadiness').count(),0);
      const originalBusinessData=await page.evaluate(()=>['recruit_erp_applicants_stable','recruit_erp_schools','recruit_erp_employees'].map(key=>localStorage.getItem(key)));
      for(const target of ['home','applicants','hireWaiting','calendar','backup']){
        if(viewport.width<=1020){
          await page.locator('#sidebarToggle').click();
          await page.waitForFunction(()=>document.body.classList.contains('sidebar-mobile-open'));
        }
        await page.locator(`.nav-btn[data-page="${target}"]`).click();
        await page.waitForFunction(id=>document.querySelector('.page.active')?.id===id,target);
        if(viewport.width<=1020){
          assert.equal(await page.evaluate(()=>document.body.classList.contains('sidebar-mobile-open')),false,`${viewport.name}: 메뉴 선택 뒤 사이드바 닫기`);
          await page.waitForFunction(()=>document.querySelector('.sidebar')?.getBoundingClientRect().right<=1);
        }
        await page.screenshot({path:path.join(outputDir,`${viewport.name}-${target}.png`),fullPage:true});
      }
      assert.deepEqual(await page.evaluate(()=>['recruit_erp_applicants_stable','recruit_erp_schools','recruit_erp_employees'].map(key=>localStorage.getItem(key))),originalBusinessData,`${viewport.name}: 화면 이동은 업무 자료를 변경하지 않음`);
      if(viewport.name==='desktop'){
        await page.evaluate(()=>window.setPage('hireWaiting'));
        const waitingBefore=await page.evaluate(()=>localStorage.getItem('recruit_erp_hire_waiting_profiles'));
        const waitingHeaders=await page.evaluate(()=>window.erpHireWaiting.COLUMNS.map(column=>column.label));
        const waitingRows=[
          ['1','0000123','입사대기','2099-10-12','가상근무지','','남','가상그룹','가상제품','가상파트','가상대기1','가상직급','000000-0000000','2000-01-02','25','fake@example.com','대졸','가상대학교','가상학과','01000000001','가상지역','기숙사','180cm / 75kg · 기숙사 희망 / 지원팀 확인'],
          ['2','0000124','입사대기','2099-10-12','가상근무지','','여','','','','가상대기2','가상직급','000000-0000000','2001-02-03','24','=HYPERLINK("https://example.invalid")','','','','01000000002','','출퇴근','지원팀 확인, 2026/10/12 회신']
        ];
        const waitingText=[waitingHeaders,...waitingRows].map(row=>row.map(value=>value.includes('"')?`"${value.replaceAll('"','""')}"`:value).join('\t')).join('\n');
        await page.locator('#hwPasteRaw').evaluate((node,raw)=>{const clipboard=new DataTransfer();clipboard.setData('text/plain',raw);node.dispatchEvent(new ClipboardEvent('paste',{clipboardData:clipboard,bubbles:true,cancelable:true}));},waitingText);
        assert.equal(await page.locator('#hwTableBody tr').count(),2,'입사대기 Excel 행을 표시');
        const sheetAppearance=await page.evaluate(()=>{
          const th=document.querySelector('#hwTableHead th'),status=document.querySelector('#hwTableBody tr td:nth-child(3)'),name=document.querySelector('#hwTableBody tr:nth-child(2) td:nth-child(11)');
          return {header:getComputedStyle(th).backgroundColor,headerColor:getComputedStyle(th).color,fontSize:getComputedStyle(th).fontSize,status:getComputedStyle(status).backgroundColor,name:getComputedStyle(name).backgroundColor,nameWidth:name.getBoundingClientRect().width};
        });
        assert.equal(sheetAppearance.header,'rgb(255, 192, 0)','화면 제목도 원본 주황색');
        assert.equal(sheetAppearance.headerColor,'rgb(0, 0, 0)');assert.ok(Math.abs(parseFloat(sheetAppearance.fontSize)-40/3)<0.1,'제목은 원본 10pt');
        assert.equal(sheetAppearance.status,'rgb(146, 208, 80)','원본 연락상태 초록색');assert.equal(sheetAppearance.name,'rgb(255, 255, 0)','원본 강조 색상');
        assert.ok(Math.abs(sheetAppearance.nameWidth-53)<1,'화면도 성명 열의 원본 너비 유지');
        assert.equal(await page.locator('#hwPastePanel').getAttribute('open'),null,'붙여넣으면 표와 아래 다운로드 버튼으로 바로 이동');
        assert.match(await page.locator('#hwCount').innerText(),/2명 · 저장 전/);
        assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_hire_waiting_profiles')),waitingBefore,'미리보기는 기존 명단을 저장하지 않음');
        assert.equal(await page.locator('#hireWaiting').innerText().then(value=>value.includes('000000-0000000')),false,'주민등록번호 원문은 화면에 표시하지 않음');
        const extractSheet=buffer=>{
          let offset=0;
          while(buffer.readUInt32LE(offset)===0x04034b50){
            const method=buffer.readUInt16LE(offset+8),size=buffer.readUInt32LE(offset+18),nameLength=buffer.readUInt16LE(offset+26),extraLength=buffer.readUInt16LE(offset+28);
            const name=buffer.subarray(offset+30,offset+30+nameLength).toString(),start=offset+30+nameLength+extraLength;
            const body=buffer.subarray(start,start+size);
            if(name==='xl/worksheets/sheet1.xml')return method===8?require('node:zlib').inflateRawSync(body).toString():body.toString();
            offset=start+size;
          }
          throw new Error('XLSX 워크시트가 없습니다.');
        };
        for(const preset of ['assignment','health-support','final','all']){
          const selector=preset==='all'?'#hwDownloadAll':`[data-waiting-download="${preset}"]`;
          const download=await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]).then(([file])=>file);
          assert.equal(download.suggestedFilename(),'입사대기자명단(99.10.12).xlsx','모든 부서는 날짜만 포함한 동일한 XLSX 파일 이름');
          const file=path.join(outputDir,`synthetic-waiting-${preset}.xlsx`);await download.saveAs(file);
          const buffer=fs.readFileSync(file);assert.equal(buffer.readUInt32LE(0),0x04034b50,'실제 XLSX 다운로드');
          const sheetXml=extractSheet(buffer);
          const matrix=await page.evaluate(xml=>{
            const document=new DOMParser().parseFromString(xml,'application/xml');
            if(document.querySelector('parsererror'))throw new Error('XLSX XML 오류');
            return [...document.querySelectorAll('sheetData > row')].map(row=>[...row.querySelectorAll('c')].map(cell=>cell.querySelector('t')?.textContent??cell.querySelector('v')?.textContent??''));
          },sheetXml);
          const headers=matrix[0];
          assert.equal(headers.includes('직 급'),preset==='all',`${preset}: 원본 제목 및 직급 다운로드 규칙`);
          assert.equal(headers.includes('성  명'),true,'원본 성명 제목의 띄어쓰기 보존');
          assert.equal(headers.includes('주민등록번호'),['health-support','all'].includes(preset),`${preset}: 주민등록번호 다운로드 규칙`);
          assert.equal(headers.length,preset==='all'?23:preset==='health-support'?22:21);
          assert.equal(matrix[1][headers.indexOf('사원번호')],'0000123');assert.equal(matrix[1][headers.indexOf('연락처')],'01000000001');
          assert.equal(matrix[1][headers.indexOf('비고')],preset==='final'?'기숙사 희망 / 지원팀 확인':waitingRows[0][22]);
          assert.equal(matrix[2][headers.indexOf('비고')],waitingRows[1][22]);
          assert.doesNotMatch(sheetXml,/<f>/,'수식처럼 보이는 텍스트를 실행하지 않음');
          assert.equal(buffer.includes(Buffer.from('가상직급')),preset==='all','제외한 값은 숨긴 시트에도 남지 않음');
          assert.equal(buffer.includes(Buffer.from('180cm')),preset!=='final','최종명단 키·몸무게는 파일 패키지에서 삭제');
        }
        assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_hire_waiting_profiles')),waitingBefore,'4가지 다운로드 후에도 원본 업무 저장소는 그대로');
        await page.locator('#hwSaveRoster').click();
        assert.equal(await page.locator('#hwSaveRoster').isDisabled(),true);
        let savedWaiting=await page.evaluate(()=>JSON.parse(localStorage.getItem('recruit_erp_hire_waiting_profiles')));
        assert.equal(savedWaiting.length,2);assert.deepEqual(savedWaiting[0],JSON.parse(waitingBefore)[0]);assert.deepEqual(savedWaiting[1].rows,waitingRows);
        await page.locator('#hwDepartmentPanel > summary').click();
        await page.locator('#hwDepartmentName').fill('가상추가부서');await page.locator('#hwClearColumns').click();
        await page.locator('#hwColumnOptions input[value="name"]').check();await page.locator('#hwColumnOptions input[value="phone"]').check();
        await page.locator('#hwDepartmentForm button[type="submit"]').click();
        try{await page.getByRole('button',{name:'가상추가부서',exact:true}).waitFor({state:'visible',timeout:5000});}
        catch{throw new Error(`추가 부서 저장 실패: ${JSON.stringify(await page.evaluate(()=>({feedback:document.querySelector('#hwFeedback').textContent,name:document.querySelector('#hwDepartmentName').value,checked:document.querySelectorAll('#hwColumnOptions input:checked').length,buttons:[...document.querySelectorAll('#hwDownloadButtons button')].map(button=>button.textContent)})))}`);}
        assert.equal(await page.getByRole('button',{name:'가상추가부서',exact:true}).isVisible(),true,'추가 부서 버튼을 저장 후 바로 표시');
        const savedKey=await page.evaluate(()=>localStorage.getItem('recruit_erp_hire_waiting_profiles'));
        await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.body?.classList.contains('ux12-ready'));
        assert.equal(await page.locator('.page.active').getAttribute('id'),'hireWaiting','입사대기 주소 직접 진입');
        assert.equal(await page.locator('#hwTableBody tr').count(),2,'다시 열면 저장된 명단 표시');
        assert.equal(await page.locator('#hwPastePanel').getAttribute('open'),null,'저장된 명단을 열 때 붙여넣기는 접어 둠');
        assert.equal(await page.getByRole('button',{name:'가상추가부서',exact:true}).isVisible(),true,'추가 부서 설정 유지');
        assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_hire_waiting_profiles')),savedKey,'새로고침으로 저장 자료를 변경하지 않음');
        const customDownload=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'가상추가부서',exact:true}).click()]).then(([file])=>file);
        const customXml=extractSheet(fs.readFileSync(await customDownload.path()));
        assert.equal(customDownload.suggestedFilename(),'입사대기자명단(99.10.12).xlsx','추가 부서 파일명도 동일한 형식');
        assert.match(customXml,/성  명/);assert.match(customXml,/연락처/);assert.doesNotMatch(customXml,/주민등록번호|사원번호|가상직급|180cm/,'추가 부서는 선택한 두 열만 포함');
        const backupRoundTrip=await page.evaluate(()=>{
          const rows=window.erpBackupCenter.__test.packageFor(['hireWaitingProfiles'],'synthetic waiting verification').data.hireWaitingProfiles;
          return JSON.stringify(window.erpBackupCenter.__test.normalizeRows('hireWaitingProfiles',rows))===JSON.stringify(rows);
        });
        assert.equal(backupRoundTrip,true,'전체 백업·복원은 명단과 부서 설정, 기존 프로필을 보존');
        await page.screenshot({path:path.join(outputDir,'desktop-hire-waiting-filled.png'),fullPage:true});
        await page.evaluate(()=>window.erpPermissions.useLocal('','viewer'));
        assert.equal(await page.locator('#hwDownloadAll').isDisabled(),true,'조회 전용 다운로드 차단');
        const denied=await page.evaluate(raw=>[window.erpHireWaiting.stagePaste(raw),window.erpHireWaiting.saveRoster(),window.erpHireWaiting.download('health-support'),window.erpHireWaiting.openDepartment(),window.erpHireWaiting.saveDepartment(),window.erpHireWaiting.deleteDepartment()],waitingText);
        assert.deepEqual(denied,[false,false,false,false,false,false],'조회 전용의 직접 함수 호출 차단');
        assert.equal(await page.evaluate(()=>localStorage.getItem('recruit_erp_hire_waiting_profiles')),savedKey);
        await page.evaluate(()=>{window.erpPermissions.useLocal();window.setPage('applicants');});
      }
      await page.evaluate(()=>window.setPage('form'));
      assert.equal(await page.locator('.page.active').getAttribute('id'),'form');
      await page.evaluate(()=>window.setPage('today'));
      assert.equal(await page.locator('.page.active').getAttribute('id'),'today');
      await page.evaluate(()=>window.setPage('applicants'));
      assert.equal(await page.locator('#applicantTbody tr.applicant-row').count(),fakeApplicants.length);
      if(viewport.width<=767){
        const phoneRect=await page.locator('#applicantTbody .phone-cell').first().boundingBox();
        assert.ok(phoneRect&&phoneRect.height>0&&phoneRect.x>=0&&phoneRect.x+phoneRect.width<=viewport.width,`${viewport.name}: 연락처가 카드 안에 보여야 합니다.`);
      }
      await page.locator('#btnListExcelRowPaste').click();
      await page.waitForFunction(()=>document.querySelector('.page.active')?.id==='form'&&document.querySelector('#excelRowPasteModal')?.classList.contains('show'));
      assert.equal(await page.locator('#excelPasteRaw').isVisible(),true,`${viewport.name}: 엑셀 붙여넣기 창 표시`);
      const pasteRows=[
        ['NO','지원날짜','연락상태','면접날짜','시간','입사날짜','지원경로','지원구분','성별','지원파트','성명','이메일','학력구분','학교','학과','연락처','나이','생년월일','지역','경력','자격증','비고'],
        ['1','2026-09-01','서류검토','','','','사람인','신입','남','천안','가상붙여넣기1','paste1@example.com','대졸','가상대학교','반도체과','010-1234-5001','26','2000-01-01','천안','','','출퇴근'],
        ['2','2026-09-01','서류검토','','','','잡코리아','경력','여','평택','가상붙여넣기2','paste2@example.com','전졸','가상전문대','전자과','010-1234-5002','27','1999-01-01','평택','가상회사 PM','','기숙사']
      ].map(row=>row.join('\t')).join('\n');
      await page.locator('#excelPasteRaw').fill(pasteRows);
      await page.locator('#btnParseExcelRow').click();
      assert.equal(await page.locator('#excelPasteBatch').isVisible(),true,`${viewport.name}: 여러 행 검토 화면 표시`);
      assert.match(await page.locator('#excelBatchCounts').innerText(),/신규\s*2/,`${viewport.name}: 여러 행 신규 분류`);
      if(viewport.name==='desktop'){
        const excelSafetyDownload=await Promise.all([
          page.waitForEvent('download'),
          page.locator('#btnRegisterExcelBatch').click()
        ]).then(([download])=>download);
        assert.match(excelBatchConfirm,/적용 직전 전체 ERP 안전백업 파일을 생성합니다/,'desktop: 엑셀 적용 전 안전백업 안내');
        assert.match(excelSafetyDownload.suggestedFilename(),/^recruit_erp_safety_before_.*\.json$/,'desktop: 엑셀 등록 안전백업은 비밀번호 없는 JSON이어야 합니다.');
        assert.equal(await page.locator('#encryptedBackupDialog').isVisible(),false,'desktop: 엑셀 등록이 비밀번호 창을 열면 안 됩니다.');
      }
      await page.locator('#btnCloseExcelRowPaste').click();
      if(viewport.name==='desktop'){
        await page.evaluate(()=>window.setPage('backup'));
        const fullJsonDownload=await Promise.all([
          page.waitForEvent('download'),
          page.locator('#bcExportFull').click()
        ]).then(([download])=>download);
        assert.match(backupPrivacyConfirm,/ERP 전체 JSON 백업/,'desktop: 전체 JSON 개인정보 저장 위치 확인');
        assert.match(fullJsonDownload.suggestedFilename(),/^recruit_erp_full_backup_.*\.json$/,'desktop: 전체 백업은 비밀번호 없이 JSON으로 내려받아야 합니다.');
        assert.equal(await page.locator('#encryptedBackupDialog').isVisible(),false,'desktop: 전체 백업이 비밀번호 창을 열면 안 됩니다.');

        const applicantBackupDownload=await Promise.all([
          page.waitForEvent('download'),
          page.locator('#bcExport-applicants').click()
        ]).then(([download])=>download);
        assert.match(backupPrivacyConfirm,/ERP 부분 JSON 백업/,'desktop: 부분 JSON 개인정보 저장 위치 확인');
        assert.match(applicantBackupDownload.suggestedFilename(),/^recruit_erp_applicants_.*\.json$/,'desktop: 지원자 부분 백업은 비밀번호 없이 JSON으로 내려받아야 합니다.');
        assert.equal(await page.locator('#encryptedBackupDialog').isVisible(),false,'desktop: 지원자 부분 백업이 비밀번호 창을 열면 안 됩니다.');

        const backupKeys=['recruit_erp_applicants_stable','recruit_erp_schools','recruit_erp_employees','recruit_erp_calendar_events','recruit_erp_hire_waiting_profiles','recruit_erp_message_templates'];
        const beforeInspection=await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),backupKeys);
        const fullBackupBytes=fs.readFileSync(await fullJsonDownload.path());
        await page.locator('#bcFileInput').setInputFiles({name:'synthetic-full-backup.json',mimeType:'application/json',buffer:fullBackupBytes});
        await page.waitForFunction(()=>window.erpBackupCenter?.getStatus().inspection?.valid===true);
        assert.match(await page.locator('#bcInspection').innerText(),/복원 가능/,'desktop: 정상 JSON 백업은 간단한 복원 상태 표시');
        assert.equal(await page.locator('#bcMergeApply').isVisible(),true,'desktop: 합치기는 바로 사용');
        assert.equal(await page.locator('#bcReplaceApply').isVisible(),false,'desktop: 교체는 다른 복원 방법에서 사용');
        assert.equal(await page.locator('.backup-file-details').getAttribute('open'),null,'desktop: 상세 비교는 접어 둠');
        assert.deepEqual(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),backupKeys),beforeInspection,'desktop: 파일 검사로 업무 자료를 변경하지 않음');
        await page.locator('#bcClearInspection').click();

        const damagedBackup=JSON.parse(fullBackupBytes.toString());damagedBackup.integrity.packageDigest='synthetic-damaged-digest';
        await page.locator('#bcFileInput').setInputFiles({name:'synthetic-damaged-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(damagedBackup))});
        await page.waitForFunction(()=>window.erpBackupCenter?.getStatus().inspection?.valid===false);
        assert.equal(await page.locator('#bcMergeApply').isDisabled(),true,'desktop: 손상된 파일의 합치기 차단');
        await page.locator('.backup-restore-options > summary').click();
        assert.equal(await page.locator('#bcReplaceApply').isDisabled(),true,'desktop: 손상된 파일의 교체 차단');
        assert.equal(await page.locator('#bcFullRestore').isDisabled(),true,'desktop: 손상된 파일의 전체 복원 차단');
        assert.deepEqual(await page.evaluate(keys=>keys.map(key=>localStorage.getItem(key)),backupKeys),beforeInspection,'desktop: 손상된 파일 검사로 업무 자료를 변경하지 않음');
        await page.locator('#bcClearInspection').click();
        await page.screenshot({path:path.join(outputDir,'desktop-backup-history.png'),fullPage:true});

        const rosterDate='2099-09-03';
        await page.evaluate(date=>{
          window.__rosterPrintCalls=0;
          window.setPage('today');
          document.querySelector('#rosterDate').value=date;
        },rosterDate);
        assert.equal(await page.evaluate(()=>window.__rosterPrintStubInstalled),true,'desktop: 브라우저 print 대체가 페이지 로드 전에 준비되어야 합니다.');
        assert.equal(await page.evaluate(date=>rosterApplicantsOn(date).length,rosterDate),6,'desktop: 인쇄 대상 합성 지원자는 6명이어야 합니다.');
        await page.locator('#btnRosterPrint').click();
        assert.match(rosterPrivacyConfirm,/지원자 명단 인쇄/,'desktop: 개인정보 인쇄 확인을 거쳐야 합니다.');
        const rosterClickState=await page.evaluate(()=>({calls:window.__rosterPrintCalls,date:document.querySelector('#rosterDate')?.value||'',eligible:rosterApplicantsOn(document.querySelector('#rosterDate')?.value||'').length,active:window.erpRosterOrderEditor.__test.printState.active,pages:document.querySelectorAll('#rosterPrintArea .roster-page').length,buttonDisabled:document.querySelector('#btnRosterPrint')?.disabled===true}));
        console.log('desktop roster print click state:',JSON.stringify(rosterClickState));
        assert.equal(rosterClickState.calls,1,`desktop: 명단표 버튼은 print를 한 번 호출해야 합니다. ${JSON.stringify(rosterClickState)}`);
        await page.evaluate(()=>{const state=window.erpRosterOrderEditor.__test.printState;if(state.cleanupTimer){clearTimeout(state.cleanupTimer);state.cleanupTimer=0;}});
        assert.equal(await page.locator('#rosterPrintArea .roster-page').count(),2,'desktop: 6명은 2페이지여야 합니다.');
        assert.deepEqual(await page.locator('#rosterPrintArea').evaluate(node=>{const style=getComputedStyle(node);return{display:style.display,position:style.position,visibility:style.visibility};}),{display:'block',position:'fixed',visibility:'hidden'},'desktop: 인쇄 전에 화면 밖에서 레이아웃을 계산해야 합니다.');
        assert.equal(await page.evaluate(()=>openRosterPrint()),false,'desktop: 인쇄 중 중복 요청은 거부해야 합니다.');
        assert.equal(await page.evaluate(()=>window.__rosterPrintCalls),1,'desktop: 중복 요청으로 print가 추가 호출되면 안 됩니다.');
        await page.emulateMedia({media:'print'});
        assert.deepEqual(await page.locator('#rosterPrintArea').evaluate(node=>{const style=getComputedStyle(node);return{display:style.display,position:style.position,visibility:style.visibility};}),{display:'block',position:'static',visibility:'visible'},'desktop: 인쇄 미디어에서는 평가표를 표시해야 합니다.');
        assert.equal(await page.locator('.app-shell').evaluate(node=>getComputedStyle(node).display),'none','desktop: 인쇄에는 앱 화면이 섞이면 안 됩니다.');
        const rosterPrePdfState=await page.evaluate(()=>{const area=document.querySelector('#rosterPrintArea'),first=area?.querySelector('.roster-page'),areaStyle=getComputedStyle(area),firstStyle=getComputedStyle(first),areaRect=area.getBoundingClientRect(),firstRect=first.getBoundingClientRect();return{area:{display:areaStyle.display,visibility:areaStyle.visibility,opacity:areaStyle.opacity,width:areaRect.width,height:areaRect.height,offsetWidth:area.offsetWidth,offsetHeight:area.offsetHeight},first:{display:firstStyle.display,visibility:firstStyle.visibility,opacity:firstStyle.opacity,width:firstRect.width,height:firstRect.height,offsetWidth:first.offsetWidth,offsetHeight:first.offsetHeight}};});
        console.log('desktop roster pre-pdf state:',JSON.stringify(rosterPrePdfState));
        assert.ok(rosterPrePdfState.area.width>0&&rosterPrePdfState.area.height>0&&rosterPrePdfState.first.width>0&&rosterPrePdfState.first.height>0,'desktop: PDF 생성 전에 명단표 레이아웃 크기가 있어야 합니다.');
        const rosterPdfPath=path.join(outputDir,'desktop-roster-print-6.pdf');
        await page.pdf({path:rosterPdfPath,landscape:true,printBackground:true,preferCSSPageSize:true});
        const rosterPdfSize=fs.statSync(rosterPdfPath).size;
        const rosterPhysicalPages=(fs.readFileSync(rosterPdfPath).toString('latin1').match(/\/Type \/Page\b/g)||[]).length;
        const rosterPdfState=await page.evaluate(()=>{const area=document.querySelector('#rosterPrintArea'),page=area?.querySelector('.roster-page'),style=area?getComputedStyle(area):null,rect=area?.getBoundingClientRect(),pageRect=page?.getBoundingClientRect();return{lifecycle:window.__rosterPrintLifecycle,active:document.body.classList.contains('roster-printing'),text:area?.innerText.length||0,display:style?.display,visibility:style?.visibility,rect:rect&&{width:rect.width,height:rect.height},pageRect:pageRect&&{width:pageRect.width,height:pageRect.height}};});
        console.log('desktop roster print pdf state:',JSON.stringify({size:rosterPdfSize,physicalPages:rosterPhysicalPages,...rosterPdfState}));
        assert.ok(rosterPdfSize>15000,'desktop: 실제 인쇄 PDF가 비어 있으면 안 됩니다.');
        assert.equal(rosterPhysicalPages,2,'desktop: 6명 평가표는 실제 PDF에서도 2장이어야 합니다.');
        await page.emulateMedia({media:'screen'});
        await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
        assert.equal(await page.evaluate(()=>document.body.classList.contains('roster-printing')),false,'desktop: 인쇄 완료 뒤 상태를 정리해야 합니다.');
        assert.equal(await page.locator('#btnRosterPrint').isEnabled(),true,'desktop: 인쇄 완료 뒤 버튼을 복구해야 합니다.');
      }
      const overflow=await page.evaluate(()=>({body:document.body.scrollWidth-document.body.clientWidth,html:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
      assert.ok(overflow.body<=1&&overflow.html<=1,`${viewport.name}: 가로 넘침 ${JSON.stringify(overflow)}`);
      assert.deepEqual(errors,[],`${viewport.name}: 브라우저 오류 ${errors.join(' | ')}`);
      await context.close();
    }
    console.log('ui-visual-layout.js: 핵심 5메뉴·7화면·입사대기 XLSX/저장/권한·데스크톱/모바일·콘솔 오류 0건 확인 완료');
  }finally{
    if(browser)await browser.close();
    if(!server.killed)server.kill('SIGTERM');
  }
})().catch(error=>{console.error(error);if(!server.killed)server.kill('SIGTERM');process.exitCode=1;});
