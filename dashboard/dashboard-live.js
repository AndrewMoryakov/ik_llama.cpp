(function () {
  const POLL_MS = 1200;

  let pollTimer = null;
  let bridge = null;

  function t(key) {
    if (bridge && typeof bridge.t === 'function') {
      return bridge.t(key);
    }
    return key;
  }

  function apiGet(path) {
    if (bridge && typeof bridge.apiGet === 'function') {
      return bridge.apiGet(path);
    }
    return fetch(path).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function getState() {
    if (bridge && typeof bridge.getState === 'function') {
      return bridge.getState();
    }
    return {};
  }

  function formatMs(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toFixed(1) : '0.0';
  }

  function formatTps(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }

  function esc(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getPhaseLabel(key) {
    if (key === 'prompt') return t('live_phase_prompt');
    if (key === 'first_decode') return t('live_phase_first_decode');
    if (key === 'decode_tail') return t('live_phase_decode_tail');
    return key;
  }

  function getPhaseClass(key) {
    if (key === 'first_decode') return 'first-decode';
    if (key === 'decode_tail') return 'decode-tail';
    return key;
  }

  function renderPhasePanel(phase, meta) {
    const timeline = Array.isArray(phase.timeline) ? phase.timeline : [];
    const hasTimeline = timeline.some(item => Number(item.ms || 0) > 0);
    const summary = [
      { label: t('live_arch'), value: meta.architecture || 'n/a' },
      { label: t('live_trace'), value: meta.traceSummary },
      { label: t('live_phase_current'), value: phase.current || 'idle' },
    ];

    const timelineHtml = hasTimeline
      ? timeline.map(item => {
          const width = Math.max(Number(item.share || 0), Number(item.ms || 0) > 0 ? 2 : 0);
          return `
            <div class="phase-segment">
              <div class="phase-label">${esc(getPhaseLabel(item.key))}</div>
              <div class="phase-bar">
                <div class="phase-fill ${getPhaseClass(item.key)}" style="width:${width}%"></div>
              </div>
              <div class="phase-value">${formatMs(item.ms)} ms</div>
            </div>
          `;
        }).join('')
      : `<div class="live-empty">${esc(t('live_no_phase_data'))}</div>`;

    const promptMs = Number(phase.prompt_ms || 0);
    const firstDecodeMs = Number(phase.first_decode_ms || 0);
    const tailAvgMs = Number(phase.decode_tail_steps || 0) > 0
      ? Number(phase.decode_tail_ms || 0) / Number(phase.decode_tail_steps || 1)
      : 0;
    const compareRows = [
      { label: t('live_phase_prompt'), value: promptMs },
      { label: t('live_phase_first_decode'), value: firstDecodeMs },
      { label: t('live_phase_decode_tail'), value: tailAvgMs },
    ];
    const compareMax = compareRows.reduce((acc, item) => Math.max(acc, item.value), 0);
    const compareHtml = compareMax > 0
      ? `
          <div class="live-history">
            <div class="live-panel-title">${esc(t('live_phase_compare'))}</div>
            <div class="live-empty">${esc(t('live_phase_compare_note'))}</div>
            <div class="stage-compare-list">
              ${compareRows.map(item => `
                <div class="stage-compare-row">
                  <div class="stage-compare-label">${esc(item.label)}</div>
                  <div class="stage-compare-bar">
                    <div class="stage-compare-fill" style="width:${Math.max((item.value / compareMax) * 100, item.value > 0 ? 2 : 0)}%"></div>
                  </div>
                  <div class="stage-compare-value">${formatMs(item.value)} ms</div>
                </div>
              `).join('')}
            </div>
          </div>
        `
      : '';

    const recent = Array.isArray(phase.recent_compact) ? phase.recent_compact : [];
    const recentHtml = recent.length
      ? `
          <div class="live-history">
            <div class="live-panel-title">${esc(t('live_recent_phases'))}</div>
            <table class="live-history-table">
              <thead>
                <tr>
                  <th>${esc(t('live_recent_idx'))}</th>
                  <th>${esc(t('live_phase_current'))}</th>
                  <th>${esc(t('live_recent_total_ms'))}</th>
                </tr>
              </thead>
              <tbody>
                ${recent.map((item, idx) => `
                  <tr>
                    <td class="value">${esc(String(item.token_index ?? idx))}</td>
                    <td>${esc(item.phase || '')}</td>
                    <td class="value">${formatMs(item.total_ms)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      : '';

    return `
      <div class="live-panel">
        <div class="live-panel-title">${esc(t('live_timeline'))}</div>
        <div class="live-summary">
          ${summary.map(item => `
            <div class="live-chip">
              <span>${esc(item.label)}</span>
              <strong>${esc(item.value)}</strong>
            </div>
          `).join('')}
        </div>
        <div class="phase-timeline">${timelineHtml}</div>
        <div class="live-stats">
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_prompt_tokens'))}</div>
            <div class="live-stat-value">${esc(String(phase.prompt_tokens || 0))}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_prompt_ms'))}</div>
            <div class="live-stat-value">${formatMs(phase.prompt_ms)}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_ttft_ms'))}</div>
            <div class="live-stat-value">${formatMs(phase.ttft_ms)}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_decode_tps'))}</div>
            <div class="live-stat-value">${formatTps(phase.avg_decode_tps)}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_last_token_ms'))}</div>
            <div class="live-stat-value">${formatMs(phase.last_token_ms)}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_decode_steps'))}</div>
            <div class="live-stat-value">${esc(String(phase.decode_tail_steps || 0))}</div>
          </div>
        </div>
        ${compareHtml}
        ${recentHtml}
      </div>
    `;
  }

  function renderMoePanel(moe) {
    const trace = moe.latest_trace;
    const selection = moe.hot_selection;
    const topExperts = Array.isArray(moe.top_experts) ? moe.top_experts : [];
    const stages = moe.stages && typeof moe.stages === 'object' ? Object.values(moe.stages) : [];

    let traceHtml = `<div class="live-empty">${esc(t('live_no_moe_data'))}</div>`;
    if (trace || selection) {
      const dispatches = trace
        ? `${trace.locked_dispatches}/${trace.total_dispatches}`
        : selection
          ? `${selection.dispatches}`
          : '0';
      traceHtml = `
        <div class="moe-trace-grid">
          <div class="moe-trace-item">
            <div class="moe-trace-label">${esc(t('live_moe_stage'))}</div>
            <div class="moe-trace-value">${esc(moe.latest_stage || 'n/a')}</div>
          </div>
          <div class="moe-trace-item">
            <div class="moe-trace-label">${esc(t('live_moe_budget'))}</div>
            <div class="moe-trace-value">${esc(String((trace && trace.budget) || (selection && selection.budget) || 0))}</div>
          </div>
          <div class="moe-trace-item">
            <div class="moe-trace-label">${esc(t('live_moe_locked_share'))}</div>
            <div class="moe-trace-value">${trace ? `${formatMs(trace.locked_share)}%` : 'n/a'}</div>
          </div>
          <div class="moe-trace-item">
            <div class="moe-trace-label">${esc(t('live_moe_dispatches'))}</div>
            <div class="moe-trace-value">${esc(dispatches)}</div>
          </div>
        </div>
      `;
    }

    const selectionHtml = selection
      ? `
          <div class="moe-trace-grid">
            <div class="moe-trace-item">
              <div class="moe-trace-label">${esc(t('live_moe_locked_total'))}</div>
              <div class="moe-trace-value">${esc(`${selection.locked}/${selection.total}`)}</div>
            </div>
            <div class="moe-trace-item">
              <div class="moe-trace-label">${esc(t('live_moe_dispatches'))}</div>
              <div class="moe-trace-value">${esc(String(selection.dispatches || 0))}</div>
            </div>
            <div class="moe-trace-item">
              <div class="moe-trace-label">${esc(t('live_moe_budget'))}</div>
              <div class="moe-trace-value">${esc(String(selection.budget || 0))}</div>
            </div>
            <div class="moe-trace-item">
              <div class="moe-trace-label">${esc(t('live_moe_fails'))}</div>
              <div class="moe-trace-value">${esc(String(selection.fails || 0))}</div>
            </div>
          </div>
        `
      : `<div class="live-empty">${esc(t('live_no_moe_data'))}</div>`;

    const maxHits = topExperts.reduce((acc, item) => Math.max(acc, Number(item.hits || 0)), 0);
    const topHtml = topExperts.length
      ? `
          <div class="top-experts-list">
            ${topExperts.map(item => {
              const share = maxHits > 0 ? Math.max((Number(item.hits || 0) / maxHits) * 100, 4) : 0;
              return `
                <div class="top-expert-row">
                  <div class="top-expert-id">e${esc(String(item.expert))}</div>
                  <div class="top-expert-bar"><div class="top-expert-fill" style="width:${share}%"></div></div>
                  <div class="top-expert-hits">${esc(String(item.hits))}</div>
                </div>
              `;
            }).join('')}
          </div>
        `
      : `<div class="live-empty">${esc(t('live_no_moe_data'))}</div>`;

    const stageHistory = Array.isArray(moe.stage_history) ? moe.stage_history.slice(-6) : [];
    const stageHistoryHtml = stageHistory.length
      ? `
          <div class="live-history">
            <div class="live-panel-title">${esc(t('live_recent_stage_history'))}</div>
            <table class="live-history-table">
              <thead>
                <tr>
                  <th>${esc(t('live_moe_stage'))}</th>
                  <th>${esc(t('live_recent_locked_share'))}</th>
                  <th>${esc(t('live_moe_budget'))}</th>
                </tr>
              </thead>
              <tbody>
                ${stageHistory.map(item => `
                  <tr>
                    <td>${esc(item.stage || '')}</td>
                    <td class="value">${formatMs(item.locked_share)}%</td>
                    <td class="value">${esc(String(item.budget || 0))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
      : '';

    const stageCompareHtml = stages.length
      ? `
          <div class="live-history">
            <div class="live-panel-title">${esc(t('live_moe_stage_compare'))}</div>
            <div class="stage-compare-list">
              ${stages.map(item => `
                <div class="stage-compare-row">
                  <div class="stage-compare-label">${esc(item.stage || '')}</div>
                  <div class="stage-compare-bar">
                    <div class="stage-compare-fill" style="width:${Math.max(Number(item.locked_share || 0), Number(item.total_dispatches || 0) > 0 ? 2 : 0)}%"></div>
                  </div>
                  <div class="stage-compare-value">${formatMs(item.locked_share)}%</div>
                </div>
              `).join('')}
            </div>
          </div>
        `
      : '';

    return `
      <div class="live-panel">
        <div class="live-panel-title">${esc(t('live_moe_title'))}</div>
        <div class="moe-grid">
          ${traceHtml}
          <div>
            <div class="live-panel-title">${esc(t('live_moe_selection'))}</div>
            ${selectionHtml}
          </div>
          <div>
            <div class="live-panel-title">${esc(t('live_moe_top_experts'))}</div>
            ${topHtml}
          </div>
          ${stageCompareHtml}
          ${stageHistoryHtml}
        </div>
      </div>
    `;
  }

  function setStatus(running) {
    const el = document.getElementById('live-metrics-status');
    if (!el) return;
    el.textContent = running ? t('live_running') : t('live_idle');
    el.classList.toggle('running', !!running);
  }

  function renderSnapshot(snapshot) {
    const root = document.getElementById('live-metrics-root');
    const card = document.getElementById('live-metrics-card');
    if (!root || !card) return;

    card.classList.add('visible');
    setStatus(snapshot.running);

    const state = getState();
    if (!state.live_observability) {
      root.innerHTML = `<div class="live-panel"><div class="live-empty">${esc(t('live_disabled'))}</div></div>`;
      return;
    }

    const phase = snapshot.phase || {};
    const moe = snapshot.moe || {};
    const trace = snapshot.trace || {};
    const traceSummary = [
      trace.pg_enabled ? `PG/${trace.pg_decode_window || 0}` : null,
      trace.hot_enabled ? 'HOT' : null,
    ].filter(Boolean).join(' + ') || 'off';

    root.innerHTML = `
      <div class="live-grid cols-2">
        ${renderPhasePanel(phase, {
          architecture: snapshot.architecture || '',
          traceSummary,
        })}
        ${renderMoePanel(moe)}
      </div>
    `;
  }

  async function poll() {
    try {
      const snapshot = await apiGet('/api/live-metrics');
      renderSnapshot(snapshot);
    } catch (err) {
      const root = document.getElementById('live-metrics-root');
      if (root) {
        root.innerHTML = `<div class="live-panel"><div class="live-empty">${esc(t('live_waiting'))}</div></div>`;
      }
    }
  }

  function startPolling() {
    if (pollTimer) return;
    poll();
    pollTimer = window.setInterval(poll, POLL_MS);
  }

  function init() {
    bridge = window.DashboardBridge || null;
    renderSnapshot({
      running: false,
      architecture: '',
      trace: {},
      phase: { current: 'idle', timeline: [] },
      moe: {},
    });
    startPolling();
  }

  document.addEventListener('dashboard:bridge-ready', init, { once: true });
  document.addEventListener('dashboard:state-changed', () => poll());
  document.addEventListener('dashboard:lang-changed', () => poll());

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (window.DashboardBridge) {
      init();
    }
  }
})();
