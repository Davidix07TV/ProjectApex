const API_BASE = 'https://api.openf1.org/v1';

const sessionNameEl = document.getElementById('sessionName');
const sessionDateEl = document.getElementById('sessionDate');
const driverCountEl = document.getElementById('driverCount');
const teamCountEl = document.getElementById('teamCount');
const lastUpdatedEl = document.getElementById('lastUpdated');
const leaderboardBody = document.getElementById('leaderboardBody');
const driversGrid = document.getElementById('driversGrid');
const refreshBtn = document.getElementById('refreshBtn');
const cardTemplate = document.getElementById('driverCardTemplate');

const fmtDate = (value) =>
  new Date(value).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

async function fetchJson(endpoint, params = {}) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Errore API ${response.status} su ${endpoint}`);
  }

  return response.json();
}

function renderDrivers(drivers) {
  driversGrid.innerHTML = '';

  drivers.forEach((driver) => {
    const node = cardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.driver-number').textContent = `#${driver.driver_number ?? '—'}`;
    node.querySelector('.driver-code').textContent = driver.name_acronym ?? 'N/A';
    node.querySelector('.driver-name').textContent =
      `${driver.first_name ?? ''} ${driver.last_name ?? ''}`.trim() || 'Pilota';
    node.querySelector('.driver-team').textContent = driver.team_name ?? 'Team sconosciuto';
    node.querySelector('.driver-country').textContent = driver.country_code ?? 'Nazione n/d';
    driversGrid.appendChild(node);
  });
}

function renderLeaderboard(drivers, positions, intervals) {
  const byNumber = new Map(drivers.map((d) => [d.driver_number, d]));
  const intervalByNumber = new Map(intervals.map((i) => [i.driver_number, i.gap_to_leader]));

  const latestPositionByDriver = new Map();
  positions.forEach((pos) => {
    const prev = latestPositionByDriver.get(pos.driver_number);
    if (!prev || new Date(pos.date) > new Date(prev.date)) {
      latestPositionByDriver.set(pos.driver_number, pos);
    }
  });

  const rows = [...latestPositionByDriver.values()].sort((a, b) => a.position - b.position);

  leaderboardBody.innerHTML = rows
    .map((row) => {
      const driver = byNumber.get(row.driver_number);
      const fullName = driver
        ? `${driver.first_name ?? ''} ${driver.last_name ?? ''}`.trim()
        : 'Pilota sconosciuto';
      return `
        <tr>
          <td>${row.position}</td>
          <td>${fullName}</td>
          <td>${driver?.team_name ?? 'n/d'}</td>
          <td>#${row.driver_number}</td>
          <td>${intervalByNumber.get(row.driver_number) ?? '-'}</td>
        </tr>
      `;
    })
    .join('');
}

function renderError(message) {
  leaderboardBody.innerHTML = `<tr><td colspan="5"><p class="error">${message}</p></td></tr>`;
  driversGrid.innerHTML = `<p class="error">${message}</p>`;
}

async function loadDashboard() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = 'Aggiornamento...';

  try {
    const sessions = await fetchJson('sessions', { year: new Date().getFullYear() });
    const latestSession = sessions.sort((a, b) => new Date(b.date_end) - new Date(a.date_end))[0];

    if (!latestSession) {
      throw new Error('Nessuna sessione trovata per questa stagione.');
    }

    const [drivers, positions, intervals] = await Promise.all([
      fetchJson('drivers', { session_key: latestSession.session_key }),
      fetchJson('position', { session_key: latestSession.session_key }),
      fetchJson('intervals', { session_key: latestSession.session_key })
    ]);

    const uniqDrivers = Array.from(
      new Map(drivers.map((d) => [`${d.driver_number}-${d.team_name}`, d])).values()
    );

    sessionNameEl.textContent = `${latestSession.meeting_name} • ${latestSession.session_name}`;
    sessionDateEl.textContent = fmtDate(latestSession.date_start);
    driverCountEl.textContent = uniqDrivers.length;
    teamCountEl.textContent = new Set(uniqDrivers.map((d) => d.team_name)).size;
    lastUpdatedEl.textContent = new Date().toLocaleTimeString('it-IT');

    renderDrivers(uniqDrivers.sort((a, b) => a.driver_number - b.driver_number));
    renderLeaderboard(uniqDrivers, positions, intervals);
  } catch (error) {
    renderError(error.message);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Aggiorna dati';
  }
}

refreshBtn.addEventListener('click', loadDashboard);
loadDashboard();
