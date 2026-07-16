/* =========================================================
   v10.11.10 면접 명단표 인쇄
   - 회사 양식(채용 면접 평가표) 그대로 재현
   - 선택 날짜에 면접 잡힌 지원자를 5명 단위로 페이지 구분
   - 이름/성별/생년월일(나이)만 자동 채움, 평가란은 인쇄 후 손으로 기입
   ========================================================= */
function rosterAgeOf(a){
  if(a.age) return a.age;
  const m=String(a.birthYear||'').match(/\d{4}/);
  if(!m) return '';
  return String(new Date().getFullYear()-parseInt(m[0],10));
}
function rosterGenderChar(a){
  if(a.gender==='남자') return '남';
  if(a.gender==='여자') return '여';
  return '';
}
function rosterDateLabel(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  if(Number.isNaN(d.getTime())) return dateStr;
  const days=['일','월','화','수','목','금','토'];
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}(${days[d.getDay()]})`;
}
function rosterRow(no, a){
  if(a){
    const bday=formatBirthDisplay(a.birthYear||'');
    const bdayLine=bday?`${esc(bday)}(${rosterAgeOf(a)})`:'';
    return `<tr class="roster-row-top">
      <td class="roster-no" rowspan="2">${no}</td>
      <td class="roster-name">${esc(a.name||'')} (${rosterGenderChar(a)})</td>
      <td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td>
      <td class="roster-pass" rowspan="2">Y / N</td>
      <td class="roster-opinion" rowspan="2"></td>
    </tr>
    <tr class="roster-row-bottom">
      <td class="roster-name">${bdayLine}</td>
    </tr>`;
  }
  return `<tr class="roster-row-top">
    <td class="roster-no" rowspan="2"></td>
    <td class="roster-name"></td>
    <td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td><td rowspan="2"></td>
    <td class="roster-pass" rowspan="2">Y / N</td>
    <td class="roster-opinion" rowspan="2"></td>
  </tr>
  <tr class="roster-row-bottom">
    <td class="roster-name"></td>
  </tr>`;
}
function buildRosterHtml(dateStr){
  const list=applicants.filter(a=>a.interviewDate===dateStr).sort((a,b)=>(a.interviewTime||'').localeCompare(b.interviewTime||''));
  const numbered=list.map((a,i)=>({no:i+1,a}));
  const pages=[];
  for(let i=0;i<Math.max(numbered.length,1);i+=5){ pages.push(numbered.slice(i,i+5)); }
  const dateLabel=rosterDateLabel(dateStr);
  return pages.map((pageItems,pageIndex)=>{
    const rows=[];
    for(let i=0;i<5;i++){ rows.push(rosterRow(pageItems[i]?pageItems[i].no:'', pageItems[i]?pageItems[i].a:null)); }
    return `<div class="roster-page">
      <p class="roster-company">에이치티솔루션</p>
      <h3 class="roster-title">채용 면접 평가표</h3>
      <div class="roster-oath-box">
        <div class="roster-oath-text">본 평가에 있어 면접관 본인은 면접 응시자에 대한 주관을 배제하고 객관적으로 평가하였음을 밝힙니다.<br/>또한 평가자료, 평가 후 평가결과에 대해 외부로 그 내용을 절대 누설하지 않을 것을 서약합니다.</div>
        <div class="roster-oath-meta"><div class="roster-oath-meta-inner"><div class="roster-oath-line"><span class="roster-oath-label">면접일</span> : ${esc(dateLabel)}</div><div class="roster-oath-line"><span class="roster-oath-label">면접관</span> : ________________ (서명)</div></div></div>
      </div>
      <table class="roster-table">
        <colgroup>
          <col style="width:4.1%"/><col style="width:11.3%"/>
          <col style="width:11.25%"/><col style="width:11.25%"/><col style="width:11.25%"/><col style="width:11.3%"/>
          <col style="width:8.1%"/><col style="width:31.45%"/>
        </colgroup>
        <thead>
          <tr><th rowspan="2">NO</th><th rowspan="2" class="roster-name-head-cell"><div class="roster-name-head"><span class="roster-name-head-text">성명(성별)</span><span class="roster-name-head-divider"></span><span class="roster-name-head-text">생년월일(나이)</span></div></th><th colspan="4">평가항목</th><th rowspan="2">합격여부</th><th rowspan="2">면접의견</th></tr>
          <tr><th>지원동기/준비</th><th>지식/역량</th><th>규범/적극</th><th>태도/인성</th></tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
      <p class="roster-legend">- 평가 등급 : S(탁월), A(우수), B+(보통), B(미흡), C(매우 미흡)</p>
      <p class="roster-legend">- 합격 기준 : 전문대↑(이공계) - 평균 B+ 이상 / 전문대↑(比이공계), 고교 - 평균 A 이상</p>
    </div>`;
  }).join('');
}
function openRosterPrint(){
  const dateStr=$('rosterDate').value;
  if(!dateStr){ alert('명단표를 뽑을 면접 날짜를 먼저 선택해주세요.'); return; }
  const list=applicants.filter(a=>a.interviewDate===dateStr);
  if(!list.length && !confirm('선택하신 날짜에 면접 일정이 등록된 지원자가 없습니다. 빈 양식으로 출력할까요?')) return;
  $('rosterPrintArea').innerHTML=buildRosterHtml(dateStr);
  document.body.classList.add('roster-printing');
  // v10.11.1: innerHTML 반영 직후 바로 print()를 부르면 브라우저가 아직 화면을
  // 다 그리기 전이라 미리보기가 흰 화면으로 뜨는 경우가 있어, 두 번의 화면
  // 갱신(requestAnimationFrame)을 기다린 뒤 인쇄를 실행하도록 안전하게 처리.
  requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ window.print(); }); });
}
window.addEventListener('afterprint', ()=>{ document.body.classList.remove('roster-printing'); });
bind('btnRosterPrint','click', openRosterPrint);
bind('btnCalendarPrev','click',()=>moveCalendarMonth(-1));
bind('btnCalendarNext','click',()=>moveCalendarMonth(1));
bind('btnCalendarToday','click',goCalendarToday);
bind('btnCalendarAdd','click',resetCalendarEventForm);
bind('calendarWorkplaceFilter','change',e=>{ calendarWorkplaceFilter=e.target.value; renderCalendar(); });
bind('calendarEventForm','submit',saveCalendarEventFromForm);
bind('btnCalendarReset','click',resetCalendarEventForm);
bind('btnCalendarDelete','click',()=>deleteCalendarEvent());
bind('btnCalendarPrintRoster','click',()=>{ if(!selectedCalendarDate){ alert('날짜를 먼저 선택해주세요.'); return; } if($('rosterDate')) $('rosterDate').value=selectedCalendarDate; openRosterPrint(); });

