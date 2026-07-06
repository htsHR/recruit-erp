const STORAGE_KEY = 'recruit_erp_vercel_v1_applicants';
let applicants = loadApplicants();
let currentView = 'home';
let currentWorkplaceTab = 'all';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return 'a_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function loadApplicants() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (error) {
    console.warn(error);
    return [];
  }
}

function saveApplicants() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applicants));
  renderAll();
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function setView(view) {
  currentView = view;
  $$('.view').forEach((el) => el.classList.remove('active'));
  $(`#${view}View`).classList.add('active');
  $$('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));

  const meta = {
    home: ['홈', '오늘 확인할 지원자와 요약을 봅니다.'],
    list: ['지원자 목록', '천안/평택 분리, 검색, 수정이 가능합니다.'],
    form: ['지원자 입력', '엑셀 한 줄을 작성하듯 지원자 정보를 입력합니다.'],
    backup: ['백업/내보내기', 'CSV 다운로드와 JSON 백업을 관리합니다.']
  }[view];
  $('#pageTitle').textContent = meta[0];
  $('#pageSubTitle').textContent = meta[1];
}

function normalizeWorkplace(value) {
  if (!value) return '기타';
  if (value.includes('천안')) return '천안';
  if (value.includes('평택')) return '평택';
  return '기타';
}

function statusClass(status) {
  return `badge status-${status || '미연락'}`;
}

function fitText(score) {
  const n = Number(score || 0);
  if (n >= 80) return '상';
  if (n >= 60) return '중';
  if (n > 0) return '하';
  return '-';
}

function renderStats() {
  $('#statTotal').textContent = applicants.length;
  $('#statCheonan').textContent = applicants.filter(a => normalizeWorkplace(a.workplace) === '천안').length;
  $('#statPyeongtaek').textContent = applicants.filter(a => normalizeWorkplace(a.workplace) === '평택').length;
  $('#statNeedContact').textContent = applicants.filter(a => ['미연락', '부재중'].includes(a.contactStatus)).length;
}

function renderTodo() {
  const todo = applicants
    .filter(a => ['미연락', '부재중', '면접예정', '입사예정'].includes(a.contactStatus))
    .sort((a, b) => (a.interviewDate || '9999-12-31').localeCompare(b.interviewDate || '9999-12-31'))
    .slice(0, 8);

  const box = $('#todoList');
  if (!todo.length) {
    box.innerHTML = '<div class="empty-state show">오늘 우선 확인할 지원자가 없습니다.</div>';
    return;
  }

  box.innerHTML = todo.map(a => `
    <div class="person-card">
      <div>
        <strong>${escapeHtml(a.name || '이름없음')} · ${escapeHtml(a.workplace || '-')}</strong>
        <small>${escapeHtml(a.phone || '-')} / 면접: ${escapeHtml(a.interviewDate || '미정')} ${escapeHtml(a.interviewTime || '')}</small>
      </div>
      <span class="${statusClass(a.contactStatus)}">${escapeHtml(a.contactStatus || '미연락')}</span>
    </div>
  `).join('');
}

function getFilteredApplicants() {
  const keyword = ($('#searchInput')?.value || '').trim().toLowerCase();
  const workplaceFilter = $('#workplaceFilter')?.value || 'all';
  const statusFilter = $('#statusFilter')?.value || 'all';

  return applicants.filter(a => {
    const workplace = normalizeWorkplace(a.workplace);
    const targetWorkplace = currentWorkplaceTab !== 'all' ? currentWorkplaceTab : workplaceFilter;
    if (targetWorkplace !== 'all' && workplace !== targetWorkplace) return false;
    if (statusFilter !== 'all' && a.contactStatus !== statusFilter) return false;
    if (keyword) {
      const haystack = [a.name, a.phone, a.email, a.school, a.major, a.certs, a.career, a.memo, a.review].join(' ').toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

function renderTable() {
  const rows = getFilteredApplicants();
  const tbody = $('#applicantTbody');
  $('#emptyList').classList.toggle('show', rows.length === 0);

  tbody.innerHTML = rows.map((a, index) => `
    <tr data-id="${a.id}">
      <td>${index + 1}</td>
      <td>${escapeHtml(a.applyDate || '')}</td>
      <td><span class="${statusClass(a.contactStatus)}">${escapeHtml(a.contactStatus || '미연락')}</span></td>
      <td>${escapeHtml(a.workplace || '')}</td>
      <td><strong>${escapeHtml(a.name || '')}</strong></td>
      <td>${escapeHtml(a.phone || '')}</td>
      <td>${escapeHtml(a.school || '')}</td>
      <td>${escapeHtml(a.major || '')}</td>
      <td>${escapeHtml(a.certs || '')}</td>
      <td>${escapeHtml(a.score || '')} ${a.score ? '(' + fitText(a.score) + ')' : ''}</td>
      <td>${escapeHtml([a.interviewDate, a.interviewTime].filter(Boolean).join(' '))}</td>
      <td>${escapeHtml(a.memo || '')}</td>
      <td>
        <div class="table-actions">
          <button class="mini-btn edit" data-action="inlineEdit">수정</button>
          <button class="mini-btn" data-action="detail">상세</button>
          <button class="mini-btn delete" data-action="delete">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderAll() {
  renderStats();
  renderTodo();
  renderTable();
}

function applicantFromForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    id: data.id || uid(),
    applyDate: data.applyDate || today(),
    contactStatus: data.contactStatus || '미연락',
    interviewDate: data.interviewDate || '',
    interviewTime: data.interviewTime || '',
    joinDate: data.joinDate || '',
    source: data.source || '',
    workplace: data.workplace || '천안',
    name: data.name || '',
    phone: data.phone || '',
    email: data.email || '',
    birth: data.birth || '',
    region: data.region || '',
    school: data.school || '',
    education: data.education || '',
    major: data.major || '',
    gpa: data.gpa || '',
    career: data.career || '',
    certs: data.certs || '',
    commute: data.commute || '',
    score: data.score || '',
    memo: data.memo || '',
    review: data.review || '',
    updatedAt: new Date().toISOString()
  };
}

function fillForm(applicant) {
  const form = $('#applicantForm');
  const fields = Object.keys(applicantFromForm(form));
  fields.forEach(key => {
    if (form.elements[key]) form.elements[key].value = applicant?.[key] || '';
  });
  $('#formTitle').textContent = applicant?.id ? '지원자 수정' : '지원자 입력';
  $('#deleteCurrentBtn').style.display = applicant?.id ? 'inline-flex' : 'none';
}

function resetForm() {
  $('#applicantForm').reset();
  $('#applicantForm').elements.applyDate.value = today();
  $('#applicantForm').elements.workplace.value = '천안';
  $('#applicantForm').elements.contactStatus.value = '미연락';
  $('#applicantForm').elements.id.value = '';
  $('#formTitle').textContent = '지원자 입력';
  $('#deleteCurrentBtn').style.display = 'none';
}

function upsertApplicant(applicant) {
  const existingIndex = applicants.findIndex(a => a.id === applicant.id);
  if (existingIndex >= 0) applicants[existingIndex] = applicant;
  else applicants.unshift(applicant);
  saveApplicants();
}

function deleteApplicant(id) {
  const target = applicants.find(a => a.id === id);
  if (!target) return;
  if (!confirm(`${target.name || '지원자'} 정보를 삭제할까요?`)) return;
  applicants = applicants.filter(a => a.id !== id);
  saveApplicants();
  toast('삭제했습니다.');
  resetForm();
}

function inlineEditRow(tr) {
  const id = tr.dataset.id;
  const a = applicants.find(item => item.id === id);
  if (!a) return;

  tr.innerHTML = `
    <td>*</td>
    <td><input class="inline-input" data-field="applyDate" value="${escapeAttr(a.applyDate || '')}" type="date"></td>
    <td><select class="inline-input" data-field="contactStatus">${statusOptions(a.contactStatus)}</select></td>
    <td><select class="inline-input" data-field="workplace">${workplaceOptions(a.workplace)}</select></td>
    <td><input class="inline-input" data-field="name" value="${escapeAttr(a.name || '')}"></td>
    <td><input class="inline-input" data-field="phone" value="${escapeAttr(a.phone || '')}"></td>
    <td><input class="inline-input" data-field="school" value="${escapeAttr(a.school || '')}"></td>
    <td><input class="inline-input" data-field="major" value="${escapeAttr(a.major || '')}"></td>
    <td><input class="inline-input" data-field="certs" value="${escapeAttr(a.certs || '')}"></td>
    <td><input class="inline-input" data-field="score" value="${escapeAttr(a.score || '')}" type="number" min="0" max="100"></td>
    <td><input class="inline-input" data-field="interviewDate" value="${escapeAttr(a.interviewDate || '')}" type="date"></td>
    <td><input class="inline-input" data-field="memo" value="${escapeAttr(a.memo || '')}"></td>
    <td>
      <div class="table-actions">
        <button class="mini-btn edit" data-action="inlineSave">저장</button>
        <button class="mini-btn" data-action="cancel">취소</button>
      </div>
    </td>
  `;
}

function inlineSaveRow(tr) {
  const id = tr.dataset.id;
  const idx = applicants.findIndex(item => item.id === id);
  if (idx < 0) return;
  const updated = { ...applicants[idx] };
  tr.querySelectorAll('[data-field]').forEach(input => {
    updated[input.dataset.field] = input.value;
  });
  updated.updatedAt = new Date().toISOString();
  applicants[idx] = updated;
  saveApplicants();
  toast('수정했습니다.');
}

function statusOptions(selected) {
  return ['미연락','연락완료','부재중','문자발송','면접예정','면접완료','입사예정','보류','불합격']
    .map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
}

function workplaceOptions(selected) {
  return ['천안','평택','기타']
    .map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${v}</option>`).join('');
}

function addSampleData() {
  if (applicants.length && !confirm('샘플 데이터를 추가할까요? 기존 데이터는 유지됩니다.')) return;
  const sample = [
    { name: '김샘플', workplace: '천안', phone: '010-0000-0001', school: '한국폴리텍', major: '반도체장비설계', certs: '전기기능사, 설비보전기능사', score: 82, contactStatus: '미연락', memo: 'PM 직무 적합도 높음' },
    { name: '이평택', workplace: '평택', phone: '010-0000-0002', school: '연암공과대학교', major: '전기전자', certs: '컴퓨터응용밀링기능사', score: 68, contactStatus: '면접예정', interviewDate: today(), interviewTime: '14:00', memo: '면접 안내 필요' },
    { name: '박보류', workplace: '천안', phone: '010-0000-0003', school: '남서울대학교', major: '산업경영공학', certs: '지게차운전기능사', score: 55, contactStatus: '보류', memo: '경력 추가 확인 필요' }
  ].map(item => ({
    id: uid(), applyDate: today(), email: '', birth: '', region: '', education: '', gpa: '', career: '', commute: '', review: '', joinDate: '', source: '샘플', interviewDate: '', interviewTime: '', ...item
  }));
  applicants = [...sample, ...applicants];
  saveApplicants();
  toast('샘플 데이터를 추가했습니다.');
}

function exportCsv() {
  const headers = ['NO','지원날짜','연락상태','면접날짜','면접시간','입사날짜','지원경로','지원근무지','성명','연락처','이메일','생년월일','지역','학교','최종학력','학과','학점','경력','자격증','출퇴근여부','점수','상담내용','검토의견'];
  const rows = applicants.map((a, i) => [
    i + 1, a.applyDate, a.contactStatus, a.interviewDate, a.interviewTime, a.joinDate, a.source, a.workplace, a.name, a.phone, a.email, a.birth, a.region, a.school, a.education, a.major, a.gpa, a.career, a.certs, a.commute, a.score, a.memo, a.review
  ]);
  const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  downloadFile('\uFEFF' + csv, `지원자목록_${today()}.csv`, 'text/csv;charset=utf-8');
}

function exportJson() {
  downloadFile(JSON.stringify(applicants, null, 2), `지원자백업_${today()}.json`, 'application/json');
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('array expected');
      if (!confirm(`${data.length}건의 백업 데이터를 가져올까요? 현재 데이터는 덮어쓰기 됩니다.`)) return;
      applicants = data;
      saveApplicants();
      toast('백업을 가져왔습니다.');
    } catch (error) {
      alert('JSON 백업 파일을 읽지 못했습니다.');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('\n', ' ');
}

function wireEvents() {
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
  $('#newBtn').addEventListener('click', () => { resetForm(); setView('form'); });
  $('#sampleBtn').addEventListener('click', addSampleData);
  $('#resetFormBtn').addEventListener('click', resetForm);
  $('#deleteCurrentBtn').addEventListener('click', () => {
    const id = $('#applicantForm').elements.id.value;
    if (id) deleteApplicant(id);
  });

  $('#quickForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    upsertApplicant({
      id: uid(), applyDate: today(), contactStatus: data.contactStatus || '미연락', workplace: data.workplace || '천안', name: data.name, phone: data.phone || '', email: '', birth: '', region: '', school: '', education: '', major: '', gpa: '', career: '', certs: '', commute: '', score: '', memo: '', review: '', source: '', interviewDate: '', interviewTime: '', joinDate: '', updatedAt: new Date().toISOString()
    });
    e.currentTarget.reset();
    toast('빠른 등록 완료');
  });

  $('#applicantForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const applicant = applicantFromForm(e.currentTarget);
    const dup = applicants.find(a => a.id !== applicant.id && applicant.phone && a.phone === applicant.phone);
    if (dup && !confirm(`같은 연락처의 지원자가 있습니다.\n기존: ${dup.name}\n그래도 저장할까요?`)) return;
    upsertApplicant(applicant);
    toast('저장했습니다.');
    setView('list');
  });

  ['searchInput','workplaceFilter','statusFilter'].forEach(id => {
    $(`#${id}`).addEventListener('input', renderTable);
    $(`#${id}`).addEventListener('change', renderTable);
  });

  $$('.segment').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWorkplaceTab = btn.dataset.workplaceTab;
      $$('.segment').forEach(el => el.classList.toggle('active', el === btn));
      renderTable();
    });
  });

  $('#applicantTbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    const id = tr.dataset.id;
    const action = btn.dataset.action;
    if (action === 'inlineEdit') inlineEditRow(tr);
    if (action === 'inlineSave') inlineSaveRow(tr);
    if (action === 'cancel') renderTable();
    if (action === 'delete') deleteApplicant(id);
    if (action === 'detail') {
      const applicant = applicants.find(a => a.id === id);
      fillForm(applicant);
      setView('form');
    }
  });

  $('[data-filter-shortcut="needContact"]').addEventListener('click', () => {
    setView('list');
    $('#statusFilter').value = '미연락';
    renderTable();
  });

  $('#exportCsvBtn').addEventListener('click', exportCsv);
  $('#exportJsonBtn').addEventListener('click', exportJson);
  $('#importJsonInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importJson(file);
    e.target.value = '';
  });
  $('#clearAllBtn').addEventListener('click', () => {
    if (!confirm('전체 지원자 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    applicants = [];
    saveApplicants();
    toast('전체 데이터를 삭제했습니다.');
  });
}

resetForm();
wireEvents();
renderAll();
