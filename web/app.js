const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const api = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

const when = (ts) => {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

let state = null;

async function boot() {
  const session = await api('/api/session');
  if (session.authRequired && !session.authed) {
    $('#login').hidden = false;
    return;
  }
  $('#login').hidden = true;
  $('#app').hidden = false;
  await refresh();
  setInterval(refresh, 20000);
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#login-error');
  err.hidden = true;
  try {
    await api('/api/login', { method: 'POST', body: { password: $('#password').value } });
    location.reload();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  }
});

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

async function refresh() {
  try {
    state = await api('/api/state');
  } catch (ex) {
    if (/401/.test(ex.message)) return location.reload();
    console.error(ex);
    return;
  }

  $('#owner').textContent = `${state.owner.name} · ${state.owner.email}`;
  $('#autonomy-pill').textContent =
    { auto_routine: 'auto-sends routine mail', draft_all: 'drafts only', auto_all: 'auto-sends everything' }[
      state.policy.autonomy
    ] ?? state.policy.autonomy;

  const banner = $('#banner');
  if (state.policy.outreachEnabled && !state.policy.postalAddressSet) {
    banner.hidden = false;
    banner.textContent =
      'Outreach is enabled but POSTAL_ADDRESS is not set in .env. Commercial email legally requires a physical postal address, so campaign sends will be refused until you add one.';
  } else {
    banner.hidden = true;
  }

  renderStats();
  renderQueue();
  renderActivity();
  renderCampaigns();
}

function renderStats() {
  const s = state.stats;
  const items = [
    [s.pending, 'awaiting your review'],
    [s.autoSent24h, 'auto-sent (24h)'],
    [s.sent24h, 'total sent (24h)'],
    [s.outreach24h, 'outreach sent (24h)'],
    [s.contacts, 'contacts'],
    [s.suppressed, 'unsubscribed'],
  ];
  $('#stats').innerHTML = items
    .map(([n, label]) => `<div class="stat"><b>${n}</b><span>${esc(label)}</span></div>`)
    .join('');
  $('#queue-count').textContent = s.pending;
}

function renderQueue() {
  const root = $('#queue');
  root.innerHTML = '';

  if (!state.pending.length) {
    root.innerHTML = `<div class="empty"><strong>Nothing waiting</strong>
      Everything the agent has seen was either sent automatically or didn't need a reply.</div>`;
    return;
  }

  const tpl = $('#draft-template');
  for (const d of state.pending) {
    const node = tpl.content.cloneNode(true);
    const card = $('.draft', node);
    card.dataset.id = d.id;

    $('[data-field="kind"]', card).textContent = d.kind;
    $('[data-field="category"]', card).textContent = d.category || '—';
    $('[data-field="category"]', card).hidden = !d.category;
    const conf = $('[data-field="confidence"]', card);
    if (d.confidence == null) conf.hidden = true;
    else conf.textContent = `confidence ${Number(d.confidence).toFixed(2)}`;

    $('[data-field="created"]', card).textContent = when(d.created_at);
    $('[data-field="to"]', card).textContent = d.contact_email;
    $('[data-field="reason"]', card).textContent = d.decision_reason || '';
    $('[data-field="subject"]', card).value = d.subject;
    $('[data-field="body"]', card).value = d.body;

    const flags = JSON.parse(d.risk_flags || '[]');
    $('[data-field="flags"]', card).innerHTML = flags
      .map((f) => `<span class="flag">${esc(f)}</span>`)
      .join('');

    const assumptions = JSON.parse(d.assumptions || '[]');
    if (assumptions.length) {
      const box = $('[data-field="assumptions"]', card);
      box.hidden = false;
      box.innerHTML =
        '<strong>The draft assumed:</strong><ul>' +
        assumptions.map((a) => `<li>${esc(a)}</li>`).join('') +
        '</ul>';
    }

    root.appendChild(node);
  }
}

$('#queue').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const card = btn.closest('.draft');
  const id = card.dataset.id;
  const status = $('.status', card);
  const buttons = $$('button', card);

  const subject = $('[data-field="subject"]', card).value;
  const body = $('[data-field="body"]', card).value;

  buttons.forEach((b) => (b.disabled = true));
  status.textContent = '';

  try {
    if (btn.dataset.action === 'reject') {
      await api(`/api/drafts/${id}/reject`, { method: 'POST', body: {} });
      card.remove();
      refresh();
      return;
    }

    await api(`/api/drafts/${id}`, { method: 'PUT', body: { subject, body } });

    if (btn.dataset.action === 'save') {
      status.textContent = 'Saved.';
      buttons.forEach((b) => (b.disabled = false));
      return;
    }

    await api(`/api/drafts/${id}/approve`, { method: 'POST', body: {} });
    card.remove();
    refresh();
  } catch (ex) {
    status.textContent = ex.message;
    buttons.forEach((b) => (b.disabled = false));
  }
});

function renderActivity() {
  const rows = state.recent;
  const root = $('#activity');
  if (!rows.length) {
    root.innerHTML = `<div class="empty"><strong>No activity yet</strong>Nothing has been sent or discarded.</div>`;
    return;
  }
  root.innerHTML = `<div class="card"><div class="table-wrap"><table>
    <thead><tr><th>When</th><th>Status</th><th>Kind</th><th>To</th><th>Subject</th><th>Why</th></tr></thead>
    <tbody>${rows
      .map(
        (r) => `<tr>
      <td>${when(r.sent_at || r.created_at)}</td>
      <td>${esc(r.status)}</td>
      <td>${esc(r.kind)}</td>
      <td class="wrap">${esc(r.contact_email)}</td>
      <td class="wrap">${esc(r.subject)}</td>
      <td class="wrap">${esc(r.error || r.decision_reason || '')}</td>
    </tr>`,
      )
      .join('')}</tbody></table></div></div>`;
}

function renderCampaigns() {
  const root = $('#campaigns');
  if (!state.campaigns.length) {
    root.innerHTML = `<div class="empty"><strong>No campaigns</strong>
      Create one above, then paste in the people you want to reach.</div>`;
    return;
  }

  root.innerHTML = state.campaigns
    .map(
      (c) => `<div class="card" data-campaign="${c.id}">
      <div class="campaign-head">
        <h2>${esc(c.name)}</h2>
        <div>
          <span class="pill">${esc(c.status)}</span>
          ${
            c.status === 'running'
              ? `<button class="ghost" data-campaign-action="paused">Pause</button>`
              : `<button class="primary" data-campaign-action="running">Start sending</button>`
          }
        </div>
      </div>
      <p class="muted" style="margin:.2rem 0 0;font-size:.85rem">${esc(c.goal)}</p>
      <div class="campaign-stats">
        <span><strong>${c.total}</strong> targets</span>
        <span><strong>${c.queued}</strong> queued</span>
        <span><strong>${c.replied}</strong> replied</span>
      </div>
      <label class="field">Add contacts — one per line as <code>email, name, company, note</code>
        <textarea rows="4" data-targets placeholder="ada@studio.co, Ada Obi, Studio Co, met at DesignWeek"></textarea>
      </label>
      <button class="ghost" data-campaign-action="add-targets">Add to campaign</button>
      <span class="status" data-campaign-status></span>
    </div>`,
    )
    .join('');
}

$('#campaigns').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-campaign-action]');
  if (!btn) return;
  const card = btn.closest('[data-campaign]');
  const id = card.dataset.campaign;
  const status = $('[data-campaign-status]', card);
  const action = btn.dataset.campaignAction;
  btn.disabled = true;
  status.textContent = '';

  try {
    if (action === 'add-targets') {
      const raw = $('[data-targets]', card).value;
      const contacts = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [email, name, company, ...note] = line.split(',').map((p) => p.trim());
          return { email, name, company, notes: note.join(', ') || undefined };
        })
        .filter((c) => c.email);

      if (!contacts.length) throw new Error('No contacts found in that text.');
      const result = await api(`/api/campaigns/${id}/targets`, { method: 'POST', body: { contacts } });
      status.textContent =
        `Added ${result.added}.` + (result.skipped.length ? ` Skipped: ${result.skipped.join('; ')}` : '');
      $('[data-targets]', card).value = '';
    } else {
      await api(`/api/campaigns/${id}/status`, { method: 'POST', body: { status: action } });
    }
    await refresh();
  } catch (ex) {
    status.textContent = ex.message;
  } finally {
    btn.disabled = false;
  }
});

$('#campaign-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('/api/campaigns', { method: 'POST', body: data });
    form.reset();
    await refresh();
  } catch (ex) {
    alert(ex.message);
  }
});

$('#run-now').addEventListener('click', async (e) => {
  const btn = e.target;
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Checking…';
  try {
    const { result } = await api('/api/run-now', { method: 'POST', body: {} });
    btn.textContent = result?.skipped ? result.skipped.slice(0, 40) : 'Done';
    await refresh();
  } catch (ex) {
    btn.textContent = ex.message.slice(0, 40);
  } finally {
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 2500);
  }
});

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    $$('.panel').forEach((p) => p.classList.toggle('active', p.id === `tab-${tab.dataset.tab}`));
  });
});

boot();
