(function () {
  const POLL_MS = 1200;

  let pollTimer = null;
  let replayTimer = null;
  let bridge = null;

  const replayState = {
    mode: 'live',
    view: 'learn',
    runs: [],
    selectedRun: '',
    data: null,
    frameIndex: 0,
    playing: false,
    speed: 1,
  };

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

  function setStatus(text, running) {
    const el = document.getElementById('live-metrics-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('running', !!running);
  }

  function renderToolbar() {
    const el = document.getElementById('live-metrics-toolbar');
    if (!el) return;

    const runOptions = replayState.runs.length
      ? replayState.runs.map(run => `
          <option value="${esc(run.id)}" ${run.id === replayState.selectedRun ? 'selected' : ''}>
            ${esc(run.name)}${run.trace_like ? '' : ' · no-trace'}
          </option>
        `).join('')
      : `<option value="">${esc(t('live_replay_no_runs'))}</option>`;

    const frameCount = replayState.data && Array.isArray(replayState.data.frames)
      ? replayState.data.frames.length
      : 0;
    const canReplay = replayState.mode === 'replay' && frameCount > 0;

    el.innerHTML = `
      <div class="live-toolbar-row">
        <label class="live-toolbar-group">
          <span>${esc(t('live_mode'))}</span>
          <select id="live-mode-select" class="live-toolbar-select">
            <option value="live" ${replayState.mode === 'live' ? 'selected' : ''}>${esc(t('live_mode_live'))}</option>
            <option value="replay" ${replayState.mode === 'replay' ? 'selected' : ''}>${esc(t('live_mode_replay'))}</option>
          </select>
        </label>
        <label class="live-toolbar-group">
          <span>${esc(t('live_view'))}</span>
          <select id="live-view-select" class="live-toolbar-select">
            <option value="learn" ${replayState.view === 'learn' ? 'selected' : ''}>${esc(t('live_view_learn'))}</option>
            <option value="inspect" ${replayState.view === 'inspect' ? 'selected' : ''}>${esc(t('live_view_inspect'))}</option>
          </select>
        </label>
        <label class="live-toolbar-group live-toolbar-grow">
          <span>${esc(t('live_replay_run'))}</span>
          <select id="live-replay-run" class="live-toolbar-select" ${replayState.mode !== 'replay' ? 'disabled' : ''}>
            ${runOptions}
          </select>
        </label>
        <button class="btn-ghost live-toolbar-btn" id="live-replay-reload" ${replayState.mode !== 'replay' ? 'disabled' : ''}>
          ${esc(t('live_replay_reload'))}
        </button>
      </div>
      <div class="live-toolbar-row">
        <button class="btn-ghost live-toolbar-btn" id="live-replay-play" ${canReplay ? '' : 'disabled'}>
          ${esc(replayState.playing ? t('live_replay_pause') : t('live_replay_play'))}
        </button>
        <label class="live-toolbar-group live-toolbar-slider">
          <span>${esc(t('live_replay_step'))}</span>
          <input type="range" id="live-replay-slider" min="0" max="${Math.max(frameCount - 1, 0)}" value="${Math.min(replayState.frameIndex, Math.max(frameCount - 1, 0))}" ${canReplay ? '' : 'disabled'}>
        </label>
        <label class="live-toolbar-group">
          <span>${esc(t('live_replay_speed'))}</span>
          <select id="live-replay-speed" class="live-toolbar-select" ${replayState.mode !== 'replay' ? 'disabled' : ''}>
            <option value="0.5" ${replayState.speed === 0.5 ? 'selected' : ''}>0.5x</option>
            <option value="1" ${replayState.speed === 1 ? 'selected' : ''}>1x</option>
            <option value="2" ${replayState.speed === 2 ? 'selected' : ''}>2x</option>
            <option value="4" ${replayState.speed === 4 ? 'selected' : ''}>4x</option>
          </select>
        </label>
        <div class="live-chip">
          <span>${esc(t('live_replay_frames'))}</span>
          <strong>${frameCount}</strong>
        </div>
      </div>
    `;

    const modeSelect = document.getElementById('live-mode-select');
    const runSelect = document.getElementById('live-replay-run');
    const viewSelect = document.getElementById('live-view-select');
    const reloadBtn = document.getElementById('live-replay-reload');
    const playBtn = document.getElementById('live-replay-play');
    const slider = document.getElementById('live-replay-slider');
    const speedSelect = document.getElementById('live-replay-speed');

    if (modeSelect) {
      modeSelect.onchange = async (e) => {
        replayState.mode = e.target.value || 'live';
        stopReplay();
        if (replayState.mode === 'replay') {
          await ensureReplayRuns();
          if (!replayState.selectedRun && replayState.runs.length) {
            const preferred = replayState.runs.find(r => r.trace_like) || replayState.runs[0];
            replayState.selectedRun = preferred.id;
          }
          if (replayState.selectedRun) {
            await loadReplayData(replayState.selectedRun);
          } else {
            renderToolbar();
            renderEmptyReplay();
          }
        } else {
          renderToolbar();
          await poll();
        }
      };
    }

    if (runSelect) {
      runSelect.onchange = async (e) => {
        replayState.selectedRun = e.target.value || '';
        stopReplay();
        await loadReplayData(replayState.selectedRun);
      };
    }

    if (viewSelect) {
      viewSelect.onchange = (e) => {
        replayState.view = e.target.value || 'learn';
        if (replayState.mode === 'replay') {
          renderReplayFrame();
        } else {
          poll();
        }
      };
    }

    if (reloadBtn) {
      reloadBtn.onclick = async () => {
        await ensureReplayRuns(true);
        renderToolbar();
      };
    }

    if (playBtn) {
      playBtn.onclick = () => toggleReplay();
    }

    if (slider) {
      slider.oninput = (e) => {
        stopReplay();
        replayState.frameIndex = Number(e.target.value || 0);
        renderReplayFrame();
      };
    }

    if (speedSelect) {
      speedSelect.onchange = (e) => {
        replayState.speed = Number(e.target.value || 1) || 1;
        if (replayState.playing) {
          startReplay();
        }
      };
    }
  }

  function getLearnPhaseText(phase) {
    const current = phase && phase.current;
    if (current === 'prompt') return t('live_learn_phase_text_prompt');
    if (current === 'first_decode') return t('live_learn_phase_text_first_decode');
    if (current === 'decode') return t('live_learn_phase_text_decode');
    return t('live_learn_phase_text_idle');
  }

  function renderLearnPanel(phase, moe) {
    const latestStage = moe && moe.latest_stage ? String(moe.latest_stage) : '';
    const topExperts = Array.isArray(moe && moe.top_experts) ? moe.top_experts : [];
    const topText = topExperts.length
      ? topExperts.slice(0, 3).map(item => `e${item.expert}=${item.hits}`).join(', ')
      : '';
    const moeText = latestStage
      ? `${t('live_learn_moe_text')} ${latestStage ? `Текущий stage: ${latestStage}.` : ''}${topText ? ` Top experts: ${topText}.` : ''}`
      : t('live_learn_moe_none');

    return `
      <div class="live-grid cols-2">
        <div class="live-panel live-learn-panel">
          <div class="live-panel-title">${esc(t('live_learn_phase_title'))}</div>
          <div class="live-learn-text">${esc(getLearnPhaseText(phase))}</div>
          <div class="live-learn-note">${esc(t('live_learn_prompt_decode'))}</div>
        </div>
        <div class="live-panel live-learn-panel">
          <div class="live-panel-title">${esc(t('live_learn_moe_title'))}</div>
          <div class="live-learn-text">${esc(moeText)}</div>
        </div>
      </div>
    `;
  }

  function renderPhasePanel(phase, meta) {
    const timeline = Array.isArray(phase.timeline) ? phase.timeline : [];
    const hasTimeline = timeline.some(item => Number(item.ms || 0) > 0);
    const summary = [
      { label: t('live_arch'), value: meta.architecture || 'n/a' },
      { label: t('live_trace'), value: meta.traceSummary },
      { label: t('live_phase_current'), value: phase.current || 'idle' },
    ];

    if (meta.source) {
      summary.push({ label: t('live_replay_source'), value: meta.source });
    }
    if (meta.eventLabel) {
      summary.push({ label: t('live_replay_event'), value: meta.eventLabel });
    }

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
    const showInspect = meta.view === 'inspect';
    const compareHtml = showInspect && compareMax > 0
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
    const recentHtml = showInspect && recent.length
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
    const showInspect = replayState.view === 'inspect';
    const stageHistoryHtml = showInspect && stageHistory.length
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

    const stageCompareHtml = showInspect && stages.length
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

  function renderSnapshot(snapshot, options = {}) {
    const root = document.getElementById('live-metrics-root');
    const card = document.getElementById('live-metrics-card');
    if (!root || !card) return;

    card.classList.add('visible');

    const state = getState();
    const isReplay = options.mode === 'replay';

    if (!isReplay && !state.live_observability) {
      setStatus(t('live_idle'), false);
      root.innerHTML = `<div class="live-panel"><div class="live-empty">${esc(t('live_disabled'))}</div></div>`;
      return;
    }

    setStatus(options.statusText || (snapshot.running ? t('live_running') : t('live_idle')), !!snapshot.running);

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
          source: options.source || '',
          eventLabel: options.eventLabel || '',
          view: replayState.view,
        })}
        ${renderMoePanel(moe)}
      </div>
    `;

    if (replayState.view === 'learn') {
      root.innerHTML += renderLearnPanel(phase, moe);
    }
  }

  function renderEmptyReplay(messageKey = 'live_replay_no_runs') {
    const root = document.getElementById('live-metrics-root');
    if (!root) return;
    setStatus(t('live_idle'), false);
    root.innerHTML = `<div class="live-panel"><div class="live-empty">${esc(t(messageKey))}</div></div>`;
  }

  function frameEventLabel(frame) {
    const event = frame && frame.event;
    if (!event) return '';
    if (event.kind === 'phase') return `${event.phase || 'phase'} · ${formatMs(event.total_ms)} ms`;
    if (event.kind === 'moe_stage') return `${event.stage || 'moe'} · ${formatMs(event.locked_share)}%`;
    if (event.kind === 'hot_selection') return `hot selection · budget ${event.budget || 0}`;
    return event.kind || '';
  }

  function renderReplayFrame() {
    renderToolbar();
    if (!replayState.data) {
      renderEmptyReplay();
      return;
    }

    const frames = Array.isArray(replayState.data.frames) ? replayState.data.frames : [];
    if (!frames.length) {
      renderSnapshot(replayState.data.final_snapshot || {
        running: false,
        architecture: '',
        trace: {},
        phase: { current: 'idle', timeline: [] },
        moe: {},
      }, {
        mode: 'replay',
        statusText: t('live_mode_replay'),
        source: replayState.selectedRun || t('live_replay_latest'),
      });
      const root = document.getElementById('live-metrics-root');
      if (root) {
        root.innerHTML += `<div class="live-panel"><div class="live-empty">${esc(t('live_replay_no_trace'))}</div></div>`;
      }
      return;
    }

    const idx = Math.max(0, Math.min(replayState.frameIndex, frames.length - 1));
    const frame = frames[idx];
    renderSnapshot(frame.snapshot, {
      mode: 'replay',
      statusText: replayState.playing ? `${t('live_mode_replay')} · ${t('live_running')}` : t('live_mode_replay'),
      source: replayState.selectedRun || t('live_replay_latest'),
      eventLabel: frameEventLabel(frame),
    });
  }

  function stopReplay() {
    if (replayTimer) {
      window.clearInterval(replayTimer);
      replayTimer = null;
    }
    replayState.playing = false;
  }

  function startReplay() {
    stopReplay();
    if (!replayState.data || !Array.isArray(replayState.data.frames) || !replayState.data.frames.length) {
      renderReplayFrame();
      return;
    }
    replayState.playing = true;
    renderReplayFrame();
    const interval = Math.max(180, Math.round(900 / Math.max(replayState.speed, 0.25)));
    replayTimer = window.setInterval(() => {
      const maxIndex = replayState.data.frames.length - 1;
      if (replayState.frameIndex >= maxIndex) {
        stopReplay();
        renderSnapshot(replayState.data.frames[maxIndex].snapshot, {
          mode: 'replay',
          statusText: t('live_replay_finished'),
          source: replayState.selectedRun || t('live_replay_latest'),
          eventLabel: frameEventLabel(replayState.data.frames[maxIndex]),
        });
        renderToolbar();
        return;
      }
      replayState.frameIndex += 1;
      renderReplayFrame();
    }, interval);
  }

  function toggleReplay() {
    if (replayState.playing) {
      stopReplay();
      renderReplayFrame();
    } else {
      startReplay();
    }
  }

  async function ensureReplayRuns(force = false) {
    if (replayState.runs.length && !force) return replayState.runs;
    const data = await apiGet('/api/replay-runs');
    replayState.runs = Array.isArray(data.runs) ? data.runs : [];
    if (!replayState.selectedRun && replayState.runs.length) {
      const preferred = replayState.runs.find(r => r.trace_like) || replayState.runs[0];
      replayState.selectedRun = preferred.id;
    }
    return replayState.runs;
  }

  async function loadReplayData(runId) {
    replayState.data = null;
    replayState.frameIndex = 0;
    if (!runId) {
      renderToolbar();
      renderEmptyReplay();
      return;
    }
    const data = await apiGet(`/api/replay-metrics?run=${encodeURIComponent(runId)}`);
    replayState.data = data;
    replayState.selectedRun = runId;
    renderReplayFrame();
  }

  async function poll() {
    if (replayState.mode === 'replay') return;
    try {
      const snapshot = await apiGet('/api/live-metrics');
      renderToolbar();
      renderSnapshot(snapshot, {
        mode: 'live',
        statusText: snapshot.running ? t('live_running') : t('live_idle'),
      });
    } catch (err) {
      renderToolbar();
      const root = document.getElementById('live-metrics-root');
      if (root) {
        setStatus(t('live_idle'), false);
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
    renderToolbar();
    renderSnapshot({
      running: false,
      architecture: '',
      trace: {},
      phase: { current: 'idle', timeline: [] },
      moe: {},
    }, {
      mode: 'live',
      statusText: t('live_idle'),
    });
    startPolling();
  }

  document.addEventListener('dashboard:bridge-ready', init, { once: true });
  document.addEventListener('dashboard:state-changed', () => {
    if (replayState.mode === 'replay') {
      renderToolbar();
      renderReplayFrame();
    } else {
      poll();
    }
  });
  document.addEventListener('dashboard:lang-changed', () => {
    renderToolbar();
    if (replayState.mode === 'replay') {
      renderReplayFrame();
    } else {
      poll();
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (window.DashboardBridge) {
      init();
    }
  }
})();
