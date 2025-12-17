const API_BASE = window.localStorage.getItem('kareta-api') || 'http://localhost:8000';

const programList = document.getElementById('program-list');
const programSelect = document.getElementById('program');
const statsGrid = document.getElementById('stats-grid');
const leadForm = document.getElementById('lead-form');
const alertBox = document.getElementById('form-alert');

async function fetchPrograms() {
  try {
    const response = await fetch(`${API_BASE}/programs`);
    if (!response.ok) throw new Error('Ошибка загрузки программ');
    const programs = await response.json();
    renderPrograms(programs);
    populateProgramSelect(programs);
  } catch (error) {
    programList.innerHTML = `
      <div class="card alert-error">
        Не удалось загрузить программы. Проверьте подключение к CRM (${error.message}).
      </div>`;
  }
}

function renderPrograms(programs) {
  if (!programs.length) {
    programList.innerHTML = `
      <div class="card">
        <h3>Программы пока не добавлены</h3>
        <p>Добавьте направления через CRM, чтобы показать их на сайте.</p>
      </div>`;
    return;
  }

  programList.innerHTML = programs
    .map(
      (program) => `
        <div class="card">
          <h3>${program.name}</h3>
          <p>${program.description}</p>
          <p><strong>Продолжительность:</strong> ${program.duration_months} мес.</p>
        </div>`
    )
    .join('');
}

function populateProgramSelect(programs) {
  if (!programs.length) return;
  const options = programs
    .map(
      (program) => `<option value="${program.id}">${program.name}</option>`
    )
    .join('');
  programSelect.insertAdjacentHTML('beforeend', options);
}

async function fetchStats() {
  try {
    const response = await fetch(`${API_BASE}/dashboard/summary`);
    if (!response.ok) throw new Error('Ошибка загрузки статистики');
    const stats = await response.json();
    statsGrid.innerHTML = `
      <div class="stats-item">
        <h3>${stats.students}</h3>
        <p>Студентов</p>
      </div>
      <div class="stats-item">
        <h3>${stats.programs}</h3>
        <p>Программ</p>
      </div>
      <div class="stats-item">
        <h3>${stats.new_leads}</h3>
        <p>Новых заявок</p>
      </div>`;
  } catch (error) {
    console.error(error);
  }
}

function showAlert(type, message) {
  alertBox.hidden = false;
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = message;
}

leadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(leadForm);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') || null,
    notes: formData.get('notes') || null,
    preferred_program_id: formData.get('program') || null,
    source: 'website',
  };

  if (!payload.preferred_program_id) {
    delete payload.preferred_program_id;
  }

  try {
    const response = await fetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Не удалось отправить заявку');
    }

    showAlert('success', 'Спасибо! Мы свяжемся с вами в ближайшее время.');
    leadForm.reset();
  } catch (error) {
    showAlert('error', error.message);
  }
});

fetchPrograms();
fetchStats();
