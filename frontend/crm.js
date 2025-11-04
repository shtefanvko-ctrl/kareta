const apiInput = document.getElementById('api-url');
const programForm = document.getElementById('program-form');
const leadQuickForm = document.getElementById('lead-quick-form');
const leadTable = document.getElementById('lead-table');
const studentTable = document.getElementById('student-table');
const leadProgramSelect = document.getElementById('lead-program-select');
const sideAlert = document.getElementById('side-alert');

const API_KEY = 'kareta-api';

function getApiBase() {
  return apiInput.value || window.localStorage.getItem(API_KEY) || 'http://localhost:8000';
}

function setApiBase(value) {
  if (!value) return;
  window.localStorage.setItem(API_KEY, value);
  apiInput.value = value;
}

apiInput.addEventListener('change', () => {
  setApiBase(apiInput.value);
  refreshData();
});

setApiBase(window.localStorage.getItem(API_KEY));

function showSideAlert(type, message) {
  sideAlert.hidden = false;
  sideAlert.className = `alert alert-${type}`;
  sideAlert.textContent = message;
  setTimeout(() => {
    sideAlert.hidden = true;
  }, 4000);
}

async function fetchJson(endpoint, options = {}) {
  const response = await fetch(`${getApiBase()}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function loadPrograms() {
  try {
    const programs = await fetchJson('/programs');
    leadProgramSelect.innerHTML = '<option value="">Выберите программу</option>';
    programs.forEach((program) => {
      const option = document.createElement('option');
      option.value = program.id;
      option.textContent = program.name;
      leadProgramSelect.append(option);
    });
  } catch (error) {
    showSideAlert('error', `Программы: ${error.message}`);
  }
}

async function loadLeads() {
  try {
    const leads = await fetchJson('/leads');
    if (!leads.length) {
      leadTable.innerHTML = '<tr><td colspan="5">Заявки не найдены</td></tr>';
      return;
    }
    leadTable.innerHTML = leads
      .map((lead) => `
        <tr>
          <td>
            <strong>${lead.name}</strong><br />
            <span class="muted">${new Date(lead.created_at).toLocaleString('ru-RU')}</span>
          </td>
          <td>
            <div>${lead.email}</div>
            <div>${lead.phone || '—'}</div>
          </td>
          <td>${lead.preferred_program_id ? `#${lead.preferred_program_id}` : 'Не выбрана'}</td>
          <td>
            <span class="status status-${lead.status.replace(/\s/g, '-').toLowerCase()}">
              ${lead.status}
            </span>
          </td>
          <td>
            <button data-action="mark" data-id="${lead.id}" data-status="in-progress" class="btn" style="padding:0.4rem 1rem;">В работе</button>
            <button data-action="convert" data-id="${lead.id}" class="btn" style="padding:0.4rem 1rem;background:#22c55e;">Конвертировать</button>
          </td>
        </tr>`)
      .join('');
  } catch (error) {
    leadTable.innerHTML = `<tr><td colspan="5">Ошибка загрузки заявок: ${error.message}</td></tr>`;
  }
}

async function loadStudents() {
  try {
    const students = await fetchJson('/students');
    if (!students.length) {
      studentTable.innerHTML = '<tr><td colspan="5">Студенты не найдены</td></tr>';
      return;
    }
    studentTable.innerHTML = students
      .map((student) => `
        <tr>
          <td>${student.last_name} ${student.first_name}</td>
          <td>${student.email}</td>
          <td>${student.phone}</td>
          <td>${student.program?.name || '—'}</td>
          <td>${student.status}</td>
        </tr>`)
      .join('');
  } catch (error) {
    studentTable.innerHTML = `<tr><td colspan="5">Ошибка загрузки студентов: ${error.message}</td></tr>`;
  }
}

async function refreshData() {
  await Promise.all([loadPrograms(), loadLeads(), loadStudents()]);
}

programForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(programForm);
  const payload = Object.fromEntries(formData.entries());
  payload.duration_months = Number(payload.duration_months);
  try {
    await fetchJson('/programs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showSideAlert('success', 'Программа добавлена');
    programForm.reset();
    await refreshData();
  } catch (error) {
    showSideAlert('error', `Ошибка: ${error.message}`);
  }
});

leadQuickForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(leadQuickForm);
  const payload = Object.fromEntries(formData.entries());
  if (!payload.preferred_program_id) {
    delete payload.preferred_program_id;
  }
  payload.source = 'admissions desk';
  try {
    await fetchJson('/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showSideAlert('success', 'Заявка создана');
    leadQuickForm.reset();
    await refreshData();
  } catch (error) {
    showSideAlert('error', `Ошибка: ${error.message}`);
  }
});

leadTable.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  if (action === 'mark') {
    const status = button.dataset.status;
    try {
      await fetchJson(`/leads/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      await refreshData();
    } catch (error) {
      showSideAlert('error', `Ошибка изменения статуса: ${error.message}`);
    }
  }
  if (action === 'convert') {
    const leadRow = button.closest('tr');
    const nameCell = leadRow.querySelector('td strong').textContent.trim();
    const [firstName = nameCell, ...rest] = nameCell.split(/\s+/);
    const lastName = rest.length ? rest.join(' ') : nameCell;
    const programCell = leadRow.children[2].textContent.trim();
    const programId = programCell.startsWith('#') ? Number(programCell.slice(1)) : null;
    if (!programId) {
      showSideAlert('error', 'Укажите программу в заявке перед конвертацией');
      return;
    }
    try {
      await fetchJson(`/leads/${id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: leadRow.children[1].children[0].textContent,
          phone: leadRow.children[1].children[1].textContent,
          program_id: programId,
          status: 'enrolled',
        }),
      });
      showSideAlert('success', 'Заявка конвертирована в студента');
      await refreshData();
    } catch (error) {
      showSideAlert('error', `Ошибка конвертации: ${error.message}`);
    }
  }
});

refreshData();
