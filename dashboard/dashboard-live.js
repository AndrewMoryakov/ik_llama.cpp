(function () {
  const POLL_MS = 1200;

  let pollTimer = null;
  let replayTimer = null;
  let bridge = null;
  let toolbarSignature = '';

  const replayState = {
    mode: 'live',
    view: 'learn',
    stage: 'flow',
    inspector: 'guide',
    inspectorHidden: localStorage.getItem('ik_dash_live_inspector_hidden') === '1',
    runs: [],
    replayFilter: 'curated',
    selectedRun: '',
    data: null,
    frameIndex: 0,
    playing: false,
    speed: 1,
  };

  function classifyReplayRun(run) {
    const id = String((run && (run.id || run.name)) || '').toLowerCase();
    let family = 'generic';
    if (id.includes('minimax')) family = 'minimax';
    else if (id.includes('gptoss') || id.includes('gpt-oss')) family = 'gptoss';
    else if (id.includes('qwen')) family = 'qwen';

    const curated = /minimax_cli_layer_trace|pg_window_trace|minimax_quick_verify|qwen|gptoss|gpt-oss/.test(id);
    const demoType = id.includes('layer_trace')
      ? 'layer-trace'
      : id.includes('window_trace')
        ? 'window-trace'
        : id.includes('quick_verify')
          ? 'quick-check'
          : 'trace';

    return {
      ...run,
      family,
      curated,
      demoType,
    };
  }

  function getFilteredRuns() {
    const filter = replayState.replayFilter || 'curated';
    if (filter === 'all') return replayState.runs;
    if (filter === 'curated') return replayState.runs.filter(run => run.curated);
    if (filter === 'trace') return replayState.runs.filter(run => run.trace_like);
    return replayState.runs.filter(run => run.family === filter);
  }

  function getReplayRunDescription(run) {
    if (!run) {
      return {
        title: t('live_replay_desc_none_title'),
        body: t('live_replay_desc_none_body'),
      };
    }

    const key = `${run.family}:${run.demoType}`;
    const map = {
      'minimax:layer-trace': {
        title: t('live_replay_desc_minimax_layer_title'),
        body: t('live_replay_desc_minimax_layer_body'),
      },
      'minimax:quick-check': {
        title: t('live_replay_desc_minimax_quick_title'),
        body: t('live_replay_desc_minimax_quick_body'),
      },
      'gptoss:trace': {
        title: t('live_replay_desc_gptoss_title'),
        body: t('live_replay_desc_gptoss_body'),
      },
      'qwen:trace': {
        title: t('live_replay_desc_qwen_title'),
        body: t('live_replay_desc_qwen_body'),
      },
      'qwen:window-trace': {
        title: t('live_replay_desc_qwen_window_title'),
        body: t('live_replay_desc_qwen_window_body'),
      },
    };

    return map[key] || {
      title: t('live_replay_desc_generic_title'),
      body: t('live_replay_desc_generic_body'),
    };
  }

  function getReplayTelemetryKind(data) {
    const snapshot = data && data.final_snapshot ? data.final_snapshot : null;
    const moe = snapshot && snapshot.moe ? snapshot.moe : {};
    const layerRows = Array.isArray(moe.expert_layer_matrix) ? moe.expert_layer_matrix.length : 0;
    const frameCount = Array.isArray(data && data.frames) ? data.frames.length : 0;
    if (layerRows > 0) return 'layer_expert';
    if (frameCount > 0) return 'phase_trace';
    return 'no_trace';
  }

  function getReplayQuickPicks() {
    return replayState.runs.filter(run => run.curated).slice(0, 6);
  }

  function getReplayScenarios() {
    const minimax = replayState.runs.find(run => run.id.includes('minimax_cli_layer_trace'))
      || replayState.runs.find(run => run.family === 'minimax' && run.curated)
      || null;
    const qwen = replayState.runs.find(run => run.id.includes('qwen') && run.trace_like)
      || replayState.runs.find(run => run.family === 'qwen' && run.curated)
      || null;
    const gptoss = replayState.runs.find(run => run.id.includes('gptoss') && run.trace_like)
      || replayState.runs.find(run => run.family === 'gptoss' && run.curated)
      || null;

    return [
      minimax ? {
        key: 'minimax',
        run: minimax,
        title: t('live_scenario_minimax_title'),
        body: t('live_scenario_minimax_body'),
      } : null,
      qwen ? {
        key: 'qwen',
        run: qwen,
        title: t('live_scenario_qwen_title'),
        body: t('live_scenario_qwen_body'),
      } : null,
      gptoss ? {
        key: 'gptoss',
        run: gptoss,
        title: t('live_scenario_gptoss_title'),
        body: t('live_scenario_gptoss_body'),
      } : null,
    ].filter(Boolean);
  }

  function getPreferredLayerTraceDemo() {
    return replayState.runs.find(run => String(run.id || '').includes('minimax_cli_layer_trace'))
      || replayState.runs.find(run => String(run.id || '').includes('layer_trace'))
      || replayState.runs.find(run => run.curated && run.trace_like)
      || null;
  }

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

  function getToolbarSignature() {
    const frameCount = replayState.data && Array.isArray(replayState.data.frames)
      ? replayState.data.frames.length
      : 0;
    const runsSig = replayState.runs.map(run => `${run.id}:${run.trace_like ? '1' : '0'}`).join('|');
    const lang = bridge && typeof bridge.getLang === 'function' ? bridge.getLang() : '';
    return [
      lang,
      replayState.mode,
      replayState.view,
      replayState.stage,
      replayState.inspector,
      replayState.selectedRun,
      replayState.playing ? '1' : '0',
      String(replayState.speed),
      String(frameCount),
      runsSig,
    ].join('::');
  }

  function syncToolbarState() {
    const frameCount = replayState.data && Array.isArray(replayState.data.frames)
      ? replayState.data.frames.length
      : 0;
    const canReplay = replayState.mode === 'replay' && frameCount > 0;
    const maxIndex = Math.max(frameCount - 1, 0);
    const currentIndex = Math.min(replayState.frameIndex, maxIndex);

    const modeSelect = document.getElementById('live-mode-select');
    const viewSelect = document.getElementById('live-view-select');
    const runSelect = document.getElementById('live-replay-run');
    const filterSelect = document.getElementById('live-replay-filter');
    const reloadBtn = document.getElementById('live-replay-reload');
    const playBtn = document.getElementById('live-replay-play');
    const slider = document.getElementById('live-replay-slider');
    const speedSelect = document.getElementById('live-replay-speed');
    const framesValue = document.getElementById('live-replay-frames');
    const demoChip = document.getElementById('live-replay-demo-chip');

    if (modeSelect) modeSelect.value = replayState.mode;
    if (viewSelect) viewSelect.value = replayState.view;
    if (runSelect) {
      runSelect.disabled = replayState.mode !== 'replay';
      if (replayState.selectedRun) {
        runSelect.value = replayState.selectedRun;
      }
    }
    if (filterSelect) {
      filterSelect.disabled = replayState.mode !== 'replay';
      filterSelect.value = replayState.replayFilter || 'curated';
    }
    if (reloadBtn) reloadBtn.disabled = replayState.mode !== 'replay';
    if (playBtn) {
      playBtn.disabled = !canReplay;
      playBtn.textContent = replayState.playing ? t('live_replay_pause') : t('live_replay_play');
    }
    if (slider) {
      slider.disabled = !canReplay;
      slider.max = String(maxIndex);
      slider.value = String(currentIndex);
    }
    if (speedSelect) {
      speedSelect.disabled = replayState.mode !== 'replay';
      speedSelect.value = String(replayState.speed);
    }
    if (framesValue) {
      framesValue.textContent = String(frameCount);
    }
    if (demoChip) {
      const run = replayState.runs.find(item => item.id === replayState.selectedRun);
      demoChip.innerHTML = run
        ? `<span>${esc(t('live_replay_demo'))}</span><strong>${esc(run.curated ? `${t(`live_family_${run.family}`)} · ${run.demoType}` : t('live_replay_generic'))}</strong>`
        : `<span>${esc(t('live_replay_demo'))}</span><strong>${esc(t('live_replay_generic'))}</strong>`;
    }
  }

  function renderToolbar(force = false) {
    const el = document.getElementById('live-metrics-toolbar');
    if (!el) return;

    const signature = getToolbarSignature();
    if (!force && toolbarSignature === signature && el.childElementCount > 0) {
      syncToolbarState();
      return;
    }

    const visibleRuns = getFilteredRuns();
    const runOptions = visibleRuns.length
      ? visibleRuns.map(run => `
          <option value="${esc(run.id)}" ${run.id === replayState.selectedRun ? 'selected' : ''}>
            ${esc(run.name)}${run.curated ? ' · curated' : ''}${run.trace_like ? '' : ' · no-trace'}
          </option>
        `).join('')
      : `<option value="">${esc(t('live_replay_no_runs'))}</option>`;

    const frameCount = replayState.data && Array.isArray(replayState.data.frames)
      ? replayState.data.frames.length
      : 0;
    const canReplay = replayState.mode === 'replay' && frameCount > 0;

    el.innerHTML = `
      <div class="live-toolbar-shell ${replayState.mode === 'replay' ? 'replay-transport' : ''}">
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
        <label class="live-toolbar-group">
          <span>${esc(t('live_replay_filter'))}</span>
          <select id="live-replay-filter" class="live-toolbar-select" ${replayState.mode !== 'replay' ? 'disabled' : ''}>
            <option value="curated" ${replayState.replayFilter === 'curated' ? 'selected' : ''}>${esc(t('live_replay_filter_curated'))}</option>
            <option value="all" ${replayState.replayFilter === 'all' ? 'selected' : ''}>${esc(t('live_replay_filter_all'))}</option>
            <option value="trace" ${replayState.replayFilter === 'trace' ? 'selected' : ''}>${esc(t('live_replay_filter_trace'))}</option>
            <option value="minimax" ${replayState.replayFilter === 'minimax' ? 'selected' : ''}>${esc(t('live_family_minimax'))}</option>
            <option value="gptoss" ${replayState.replayFilter === 'gptoss' ? 'selected' : ''}>${esc(t('live_family_gptoss'))}</option>
            <option value="qwen" ${replayState.replayFilter === 'qwen' ? 'selected' : ''}>${esc(t('live_family_qwen'))}</option>
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
          <strong id="live-replay-frames">${frameCount}</strong>
        </div>
        ${replayState.mode === 'replay' ? `<div class="live-chip" id="live-replay-demo-chip"></div>` : ''}
      </div>
    `;

    toolbarSignature = signature;

    const modeSelect = document.getElementById('live-mode-select');
    const runSelect = document.getElementById('live-replay-run');
    const filterSelect = document.getElementById('live-replay-filter');
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
            renderToolbar(true);
            renderEmptyReplay();
          }
        } else {
          renderToolbar(true);
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

    if (filterSelect) {
      filterSelect.onchange = async (e) => {
        replayState.replayFilter = e.target.value || 'curated';
        const visible = getFilteredRuns();
        if (!visible.find(run => run.id === replayState.selectedRun)) {
          const preferred = visible.find(r => r.curated && r.trace_like) || visible.find(r => r.trace_like) || visible[0] || null;
          replayState.selectedRun = preferred ? preferred.id : '';
        }
        stopReplay();
        renderToolbar(true);
        if (replayState.mode === 'replay' && replayState.selectedRun) {
          await loadReplayData(replayState.selectedRun);
        } else if (replayState.mode === 'replay') {
          renderEmptyReplay();
        }
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
        renderToolbar(true);
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

    document.querySelectorAll('[data-replay-pick]').forEach(btn => {
      btn.onclick = async () => {
        const runId = btn.getAttribute('data-replay-pick') || '';
        if (!runId) return;
        replayState.mode = 'replay';
        replayState.selectedRun = runId;
        stopReplay();
        await loadReplayData(runId);
      };
    });

    syncToolbarState();
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
    const compare = moe && moe.prompt_decode_compare && typeof moe.prompt_decode_compare === 'object'
      ? moe.prompt_decode_compare
      : { prompt: [], decode: [] };
    const stability = moe && moe.stability && typeof moe.stability === 'object'
      ? moe.stability
      : { label: 'n/a', score: 0 };
    const topText = topExperts.length
      ? topExperts.slice(0, 3).map(item => `e${item.expert}=${item.hits}`).join(', ')
      : '';
    const promptSet = new Set((compare.prompt || []).map(item => Number(item.expert)));
    const decodeSet = new Set((compare.decode || []).map(item => Number(item.expert)));
    const overlap = Array.from(promptSet).filter(expert => decodeSet.has(expert)).slice(0, 4);
    const overlapText = overlap.length
      ? `${t('live_learn_overlap_prefix')} ${overlap.map(expert => `e${expert}`).join(', ')}.`
      : t('live_learn_overlap_none');
    const stabilityText = stability.label && stability.label !== 'n/a'
      ? `${t('live_learn_stability_prefix')} ${t(`live_moe_stability_${stability.label}`)} (${formatMs(stability.score)}%).`
      : t('live_learn_stability_none');
    const moeText = latestStage
      ? `${t('live_learn_moe_text')} ${latestStage ? `${t('live_learn_stage_prefix')} ${latestStage}.` : ''}${topText ? ` ${t('live_learn_top_prefix')} ${topText}.` : ''} ${overlapText} ${stabilityText}`
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
          <div class="live-summary live-summary-tight">
            <div class="live-chip">
              <span>${esc(t('live_moe_stability_label'))}</span>
              <strong>${esc(stability.label && stability.label !== 'n/a' ? t(`live_moe_stability_${stability.label}`) : 'n/a')}</strong>
            </div>
            <div class="live-chip">
              <span>${esc(t('live_moe_stability_score'))}</span>
              <strong>${esc(stability.label && stability.label !== 'n/a' ? `${formatMs(stability.score)}%` : 'n/a')}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getExecutionFlowModel(phase, moe, meta) {
    const current = String((phase && phase.current) || 'idle');
    const latestStage = String((moe && moe.latest_stage) || '');
    const hasMoe = !!(
      (moe && moe.latest_trace) ||
      (Array.isArray(moe && moe.top_experts) && moe.top_experts.length) ||
      (Array.isArray(moe && moe.expert_layer_matrix) && moe.expert_layer_matrix.length) ||
      (Array.isArray(moe && moe.expert_stage_matrix) && moe.expert_stage_matrix.length)
    );

    const nodes = [
      { id: 'input', label: t('live_flow_node_input'), state: 'idle' },
      { id: 'shared', label: t('live_flow_node_shared'), state: 'idle' },
      { id: 'router', label: t('live_flow_node_router'), state: hasMoe ? 'idle' : 'disabled' },
      { id: 'experts', label: t('live_flow_node_experts'), state: hasMoe ? 'idle' : 'disabled' },
      { id: 'decode', label: t('live_flow_node_decode'), state: 'idle' },
    ];

    const active = new Set();
    let pathLabel = t('live_flow_path_idle');
    let note = t('live_flow_note_idle');

    if (current === 'prompt') {
      active.add('input');
      active.add('shared');
      if (hasMoe) {
        active.add('router');
        active.add('experts');
      }
      pathLabel = t('live_flow_path_prompt');
      note = t('live_flow_note_prompt');
    } else if (current === 'first_decode') {
      active.add('shared');
      if (hasMoe) {
        active.add('router');
        active.add('experts');
      }
      active.add('decode');
      pathLabel = t('live_flow_path_first_decode');
      note = t('live_flow_note_first_decode');
    } else if (current === 'decode') {
      active.add('shared');
      if (hasMoe) {
        active.add('router');
        active.add('experts');
      }
      active.add('decode');
      pathLabel = t('live_flow_path_decode');
      note = t('live_flow_note_decode');
    }

    nodes.forEach((node) => {
      if (node.state === 'disabled') return;
      node.state = active.has(node.id) ? 'active' : 'inactive';
    });

    return {
      nodes,
      pathLabel,
      note,
      hasMoe,
      latestStage,
      architecture: String((meta && meta.architecture) || ''),
    };
  }

  function renderExecutionFlow(phase, moe, meta) {
    const model = getExecutionFlowModel(phase, moe, meta);
    const nodesHtml = model.nodes.map((node, idx) => {
      const nodeLink = node.id === 'input'
        ? 'prompt'
        : node.id === 'router'
          ? 'router'
          : node.id === 'experts'
            ? 'experts'
            : node.id === 'decode'
              ? 'decode'
              : '';
      const nodeHtml = `
        <div class="flow-node flow-node-${node.state}" ${nodeLink ? `data-runtime-link="${esc(nodeLink)}"` : ''} title="${esc(t('live_flow_node_hint'))}: ${esc(node.label)}">
          <div class="flow-node-label">${esc(node.label)}</div>
        </div>
      `;
      if (idx === model.nodes.length - 1) {
        return nodeHtml;
      }
      return `
        ${nodeHtml}
        <div class="flow-arrow ${node.state === 'active' ? 'flow-arrow-active' : ''}" aria-hidden="true" title="${esc(t('live_flow_arrow_hint'))}">
          <span></span>
        </div>
      `;
    }).join('');

    return `
      <div class="live-panel flow-panel">
        <div class="live-panel-title">${esc(t('live_flow_title'))}</div>
        <div class="live-summary live-summary-tight">
          <div class="live-chip">
            <span>${esc(t('live_phase_current'))}</span>
            <strong ${phase && phase.current === 'prompt' ? 'data-runtime-link="prompt"' : ((phase && (phase.current === 'first_decode' || phase.current === 'decode')) ? 'data-runtime-link="decode"' : '')}>${esc(phase && phase.current ? phase.current : 'idle')}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_flow_path'))}</span>
            <strong>${esc(model.pathLabel)}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_arch'))}</span>
            <strong>${esc(model.architecture || 'n/a')}</strong>
          </div>
          ${model.latestStage ? `
            <div class="live-chip">
              <span>${esc(t('live_moe_stage'))}</span>
              <strong>${esc(model.latestStage)}</strong>
            </div>
          ` : ''}
        </div>
        <div class="live-empty">${esc(t('live_flow_note'))}</div>
        <div class="flow-diagram">
          ${nodesHtml}
        </div>
        <div class="live-learn-note">${esc(model.note)}</div>
      </div>
    `;
  }

  function renderTokenJourney(phase, moe) {
    const current = String((phase && phase.current) || 'idle');
    const latestStage = String((moe && moe.latest_stage) || '');
    const recent = Array.isArray(phase && phase.recent_compact) ? phase.recent_compact : [];
    const last = recent.length ? recent[recent.length - 1] : null;
    const tokenLabel = current === 'prompt'
      ? t('live_token_prompt_batch')
      : current === 'first_decode'
        ? t('live_token_first')
        : current === 'decode'
          ? t('live_token_decode')
          : t('live_token_idle');
    const position = current === 'prompt' ? '12%' : current === 'first_decode' ? '72%' : current === 'decode' ? '92%' : '2%';
    const note = current === 'prompt'
      ? t('live_token_note_prompt')
      : current === 'first_decode'
        ? t('live_token_note_first')
        : current === 'decode'
          ? t('live_token_note_decode')
          : t('live_token_note_idle');

    return `
      <div class="live-panel">
        <div class="live-panel-title">${esc(t('live_token_title'))}</div>
        <div class="live-summary live-summary-tight">
          <div class="live-chip">
            <span>${esc(t('live_token_kind'))}</span>
            <strong>${esc(tokenLabel)}</strong>
          </div>
          ${last ? `
            <div class="live-chip">
              <span>${esc(t('live_replay_event'))}</span>
              <strong>${esc(last.phase || current || 'idle')}</strong>
            </div>
          ` : ''}
          ${latestStage ? `
            <div class="live-chip">
              <span>${esc(t('live_moe_stage'))}</span>
              <strong>${esc(latestStage)}</strong>
            </div>
          ` : ''}
        </div>
        <div class="token-journey-track">
          <div class="token-journey-line" title="${esc(t('live_token_line_hint'))}"></div>
          <div class="token-journey-stops">
            <span data-runtime-link="prompt" title="${esc(t('live_token_stop_input_hint'))}">Input</span>
            <span data-runtime-link="router" title="${esc(t('live_token_stop_router_hint'))}">Router</span>
            <span data-runtime-link="experts" title="${esc(t('live_token_stop_experts_hint'))}">Experts</span>
            <span data-runtime-link="decode" title="${esc(t('live_token_stop_decode_hint'))}">Decode</span>
          </div>
          <div class="token-journey-token" ${current === 'prompt' ? 'data-runtime-link="prompt"' : ((current === 'first_decode' || current === 'decode') ? 'data-runtime-link="decode"' : '')} style="left:${position}" title="${esc(note)}">
            <span>${esc(t('live_token_chip'))}</span>
          </div>
        </div>
        <div class="live-learn-note">${esc(note)}</div>
      </div>
    `;
  }

  function getMemoryRegime(state, snapshot, moe) {
    const profile = state && state.__profile ? state.__profile : null;
    const system = state && state.__system ? state.__system : null;
    const modelSize = Number(state && state.model_size_gb || 0);
    const totalRam = Number(
      (profile && profile.totalRamGb) ||
      (system && system.total_ram_gb) ||
      0
    );
    const availableRam = Number((system && system.available_ram_gb) || 0);
    const ratio = totalRam > 0 && modelSize > 0 ? modelSize / totalRam : 0;

    let regime = 'unknown';
    if (ratio > 0) {
      if (ratio > 0.9) regime = 'swap_bound';
      else if (ratio > 0.7) regime = 'near_ram';
      else regime = 'in_ram';
    }

    const latestTrace = moe && moe.latest_trace ? moe.latest_trace : null;
    const selection = moe && moe.hot_selection ? moe.hot_selection : null;
    const latestStage = String((moe && moe.latest_stage) || '');
    const latestLockedShare = latestTrace ? Number(latestTrace.locked_share || 0) : null;

    let note = t('live_mem_note_unknown');
    if (regime === 'swap_bound') {
      note = t('live_mem_note_swap');
    } else if (regime === 'near_ram') {
      note = t('live_mem_note_near');
    } else if (regime === 'in_ram') {
      note = t('live_mem_note_inram');
    }

    if (selection && selection.budget > 0) {
      note += ` ${t('live_mem_note_hot_budget')} ${selection.budget}.`;
    }
    if (latestStage) {
      note += ` ${t('live_mem_note_stage')} ${latestStage}.`;
    }
    if (latestLockedShare !== null) {
      note += ` ${t('live_mem_note_locked_share')} ${formatMs(latestLockedShare)}%.`;
    }

    return {
      regime,
      modelSize,
      totalRam,
      availableRam,
      ratio,
      latestStage,
      latestLockedShare,
      hotBudget: selection ? Number(selection.budget || 0) : 0,
      note,
    };
  }

  function renderMemoryPanel(state, snapshot, moe) {
    const mem = getMemoryRegime(state, snapshot, moe);
    const ratioPct = mem.ratio > 0 ? `${formatMs(mem.ratio * 100)}%` : 'n/a';
    const regimeLabel = mem.regime === 'swap_bound'
      ? t('live_mem_regime_swap')
      : mem.regime === 'near_ram'
        ? t('live_mem_regime_near')
        : mem.regime === 'in_ram'
          ? t('live_mem_regime_inram')
          : t('live_mem_regime_unknown');

    return `
      <div class="live-panel memory-panel">
        <div class="live-panel-title">${esc(t('live_mem_title'))}</div>
        <div class="live-summary live-summary-tight">
          <div class="live-chip">
            <span>${esc(t('live_mem_regime'))}</span>
            <strong>${esc(regimeLabel)}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_mem_model'))}</span>
            <strong>${esc(mem.modelSize > 0 ? `${formatMs(mem.modelSize)} GB` : 'n/a')}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_mem_ram'))}</span>
            <strong>${esc(mem.totalRam > 0 ? `${formatMs(mem.totalRam)} GB` : 'n/a')}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_mem_ratio'))}</span>
            <strong>${esc(ratioPct)}</strong>
          </div>
          ${mem.availableRam > 0 ? `
            <div class="live-chip">
              <span>${esc(t('live_mem_available'))}</span>
              <strong>${esc(`${formatMs(mem.availableRam)} GB`)}</strong>
            </div>
          ` : ''}
        </div>
        <div class="memory-meter">
          <div class="memory-meter-bar">
            <div class="memory-meter-fill memory-meter-${esc(mem.regime)}" style="width:${mem.ratio > 0 ? Math.min(mem.ratio * 100, 100) : 0}%"></div>
          </div>
          <div class="memory-meter-labels">
            <span>0%</span>
            <span>70%</span>
            <span>90%</span>
            <span>100%+</span>
          </div>
        </div>
        <div class="live-summary live-summary-tight">
          ${mem.hotBudget > 0 ? `
            <div class="live-chip">
              <span>${esc(t('live_moe_budget'))}</span>
              <strong>${esc(String(mem.hotBudget))}</strong>
            </div>
          ` : ''}
          ${mem.latestLockedShare !== null ? `
            <div class="live-chip">
              <span>${esc(t('live_moe_locked_share'))}</span>
              <strong>${esc(`${formatMs(mem.latestLockedShare)}%`)}</strong>
            </div>
          ` : ''}
          ${mem.latestStage ? `
            <div class="live-chip">
              <span>${esc(t('live_moe_stage'))}</span>
              <strong>${esc(mem.latestStage)}</strong>
            </div>
          ` : ''}
        </div>
        <div class="live-learn-note">${esc(mem.note)}</div>
      </div>
    `;
  }

  function renderMinimaxMemoryStory(state, snapshot, moe) {
    const arch = String((snapshot && snapshot.architecture) || '');
    if (!/minimax/i.test(arch)) {
      return '';
    }

    const mem = getMemoryRegime(state, snapshot, moe);
    const latestTrace = moe && moe.latest_trace ? moe.latest_trace : null;
    const lockedShare = latestTrace ? Number(latestTrace.locked_share || 0) : 0;
    const sharedState = mem.regime === 'swap_bound' ? 'active' : mem.regime === 'near_ram' ? 'warm' : 'steady';
    const hotState = mem.hotBudget > 0 || lockedShare > 0 ? 'active' : 'warm';
    const coldState = mem.regime === 'swap_bound' ? 'active' : 'inactive';

    return `
      <div class="live-panel memory-story-panel">
        <div class="live-panel-title">${esc(t('live_minimax_story_title'))}</div>
        <div class="live-empty">${esc(t('live_minimax_story_note'))}</div>
        <div class="memory-story-grid">
          <div class="memory-story-node memory-story-${sharedState}">
            <div class="memory-story-label" title="${esc(t('live_minimax_story_shared_note'))}">${esc(t('live_minimax_story_shared'))}</div>
            <div class="memory-story-text">${esc(t('live_minimax_story_shared_note'))}</div>
          </div>
          <div class="memory-story-arrow"></div>
          <div class="memory-story-node memory-story-${hotState}">
            <div class="memory-story-label" title="${esc(t('live_minimax_story_hot_note'))}">${esc(t('live_minimax_story_hot'))}</div>
            <div class="memory-story-text">${esc(mem.hotBudget > 0 ? `${t('live_moe_budget')}: ${mem.hotBudget}. ${t('live_moe_locked_share')}: ${formatMs(lockedShare)}%.` : t('live_minimax_story_hot_note'))}</div>
          </div>
          <div class="memory-story-arrow"></div>
          <div class="memory-story-node memory-story-${coldState}">
            <div class="memory-story-label" title="${esc(t('live_minimax_story_cold_note'))}">${esc(t('live_minimax_story_cold'))}</div>
            <div class="memory-story-text">${esc(t('live_minimax_story_cold_note'))}</div>
          </div>
        </div>
      </div>
      </div>
    `;
  }

  function renderOnboardingStrip(snapshot, options = {}) {
    const isReplay = options.mode === 'replay';
    const learn = replayState.view === 'learn';
    const arch = String((snapshot && snapshot.architecture) || '');
    const isMiniMax = /minimax/i.test(arch);
    const telemetryKind = getReplayTelemetryKind(replayState.data);

    let title = t('live_onboard_title');
    let body = t('live_onboard_body_live');
    const chips = [];

    if (isReplay) {
      title = t('live_onboard_title_replay');
      body = t('live_onboard_body_replay');
      chips.push({ k: t('live_onboard_chip_mode'), v: t('live_mode_replay') });
      chips.push({ k: t('live_onboard_chip_view'), v: learn ? t('live_view_learn') : t('live_view_inspect') });
      chips.push({ k: t('live_onboard_chip_telemetry'), v: t(`live_replay_telemetry_${telemetryKind}`) });
    } else {
      chips.push({ k: t('live_onboard_chip_mode'), v: t('live_mode_live') });
      chips.push({ k: t('live_onboard_chip_view'), v: learn ? t('live_view_learn') : t('live_view_inspect') });
      chips.push({ k: t('live_onboard_chip_trace'), v: snapshot && snapshot.trace && (snapshot.trace.pg_enabled || snapshot.trace.hot_enabled) ? t('live_running') : t('live_idle') });
    }

    const steps = [];
    if (isReplay && telemetryKind === 'layer_expert') {
      steps.push(t('live_onboard_step_layer_heatmap'));
      steps.push(t('live_onboard_step_prompt_decode'));
      if (isMiniMax) steps.push(t('live_onboard_step_minimax_memory'));
    } else if (isReplay) {
      steps.push(t('live_onboard_step_replay_flow'));
      steps.push(t('live_onboard_step_try_layer_demo'));
      steps.push(t('live_onboard_step_switch_inspect'));
    } else if (learn) {
      steps.push(t('live_onboard_step_watch_flow'));
      steps.push(t('live_onboard_step_compare_prompt_decode'));
      steps.push(t('live_onboard_step_switch_replay'));
    } else {
      steps.push(t('live_onboard_step_inspect_heatmap'));
      steps.push(t('live_onboard_step_inspect_stage'));
      steps.push(t('live_onboard_step_use_curated_replay'));
    }

    return `
      <div class="live-panel onboarding-strip">
        <div class="onboarding-strip-head">
          <div class="live-panel-title">${esc(title)}</div>
          <div class="live-summary live-summary-tight">
            ${chips.map(item => `
              <div class="live-chip">
                <span>${esc(item.k)}</span>
                <strong>${esc(item.v)}</strong>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="live-learn-text">${esc(body)}</div>
        <div class="onboarding-strip-steps">
          ${steps.map((step, idx) => `
            <div class="onboarding-step">
              <div class="onboarding-step-num">${idx + 1}</div>
              <div class="onboarding-step-text">${esc(step)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderWorkspaceShell(snapshot, phase, moe, options = {}) {
    const stage = replayState.stage || 'flow';
    const inspector = replayState.inspector || 'guide';
    const meta = {
      architecture: snapshot.architecture || '',
      traceSummary: [
        snapshot.trace && snapshot.trace.pg_enabled ? `PG/${snapshot.trace.pg_decode_window || 0}` : null,
        snapshot.trace && snapshot.trace.hot_enabled ? 'HOT' : null,
      ].filter(Boolean).join(' + ') || 'off',
      source: options.source || '',
      eventLabel: options.eventLabel || '',
      view: replayState.view,
    };

    let mainHtml = '';
    if (stage === 'heatmap') {
      mainHtml = renderMoePanel(moe, 'heatmap');
    } else if (stage === 'compare') {
      mainHtml = renderMoePanel(moe, 'compare');
    } else {
      mainHtml = `
        <div class="workspace-stack">
          ${renderExecutionFlow(phase, moe, { architecture: snapshot.architecture || '' })}
          ${renderTokenJourney(phase, moe)}
        </div>
      `;
    }

    let inspectorHtml = '';
    if (inspector === 'memory') {
      inspectorHtml = `
        <div class="workspace-stack">
          ${renderMemoryPanel(getState(), snapshot, moe)}
          ${renderMinimaxMemoryStory(getState(), snapshot, moe)}
        </div>
      `;
    } else if (inspector === 'phase') {
      inspectorHtml = renderPhasePanel(phase, meta);
    } else if (inspector === 'moe') {
      inspectorHtml = renderMoePanel(moe, 'overview');
    } else {
      inspectorHtml = `
        <div class="workspace-stack">
          ${options.mode === 'replay' ? renderReplayDescription() : ''}
          ${replayState.view === 'learn' ? renderLearnPanel(phase, moe) : renderPhasePanel(phase, meta)}
        </div>
      `;
    }

    return `
      <div class="workspace-shell">
        <div class="workspace-nav">
          <div class="workspace-nav-group">
            <div class="workspace-nav-label">${esc(t('live_workspace_main'))}</div>
            <div class="workspace-tabs">
              <button type="button" class="workspace-tab ${stage === 'flow' ? 'active' : ''}" data-live-stage="flow">${esc(t('live_workspace_stage_flow'))}</button>
              <button type="button" class="workspace-tab ${stage === 'heatmap' ? 'active' : ''}" data-live-stage="heatmap">${esc(t('live_workspace_stage_heatmap'))}</button>
              <button type="button" class="workspace-tab ${stage === 'compare' ? 'active' : ''}" data-live-stage="compare">${esc(t('live_workspace_stage_compare'))}</button>
            </div>
          </div>
          <div class="workspace-nav-group">
            <div class="workspace-nav-label">${esc(t('live_workspace_side'))}</div>
            <div class="workspace-tabs">
              <button type="button" class="workspace-tab ${inspector === 'guide' ? 'active' : ''}" data-live-inspector="guide">${esc(t('live_workspace_inspector_guide'))}</button>
              <button type="button" class="workspace-tab ${inspector === 'phase' ? 'active' : ''}" data-live-inspector="phase">${esc(t('live_workspace_inspector_phase'))}</button>
              <button type="button" class="workspace-tab ${inspector === 'moe' ? 'active' : ''}" data-live-inspector="moe">${esc(t('live_workspace_inspector_moe'))}</button>
              <button type="button" class="workspace-tab ${inspector === 'memory' ? 'active' : ''}" data-live-inspector="memory">${esc(t('live_workspace_inspector_memory'))}</button>
              <button type="button" class="workspace-tab workspace-toggle" data-live-inspector-toggle="1">${esc(t(replayState.inspectorHidden ? 'live_workspace_show_inspector' : 'live_workspace_hide_inspector'))}</button>
            </div>
          </div>
        </div>
        <div class="workspace-body ${replayState.inspectorHidden ? 'inspector-collapsed' : ''}">
          <div class="workspace-main">
            ${mainHtml}
          </div>
          <aside class="workspace-side">
            ${inspectorHtml}
          </aside>
        </div>
      </div>
    `;
  }

  function bindWorkspaceEvents() {
    document.querySelectorAll('[data-live-stage]').forEach(btn => {
      btn.onclick = () => {
        replayState.stage = btn.getAttribute('data-live-stage') || 'flow';
        if (replayState.mode === 'replay') {
          renderReplayFrame();
        } else {
          poll();
        }
      };
    });

    document.querySelectorAll('[data-live-inspector]').forEach(btn => {
      btn.onclick = () => {
        replayState.inspector = btn.getAttribute('data-live-inspector') || 'guide';
        replayState.inspectorHidden = false;
        localStorage.setItem('ik_dash_live_inspector_hidden', '0');
        if (replayState.mode === 'replay') {
          renderReplayFrame();
        } else {
          poll();
        }
      };
    });

    document.querySelectorAll('[data-live-inspector-toggle]').forEach(btn => {
      btn.onclick = () => {
        replayState.inspectorHidden = !replayState.inspectorHidden;
        localStorage.setItem('ik_dash_live_inspector_hidden', replayState.inspectorHidden ? '1' : '0');
        if (replayState.mode === 'replay') {
          renderReplayFrame();
        } else {
          poll();
        }
      };
    });

    bindReplayPickButtons();
    bindRuntimeLinkEvents();
  }

  function bindReplayPickButtons() {
    document.querySelectorAll('[data-replay-pick]').forEach(btn => {
      btn.onclick = async () => {
        const runId = btn.getAttribute('data-replay-pick') || '';
        if (!runId) return;
        replayState.mode = 'replay';
        replayState.selectedRun = runId;
        stopReplay();
        await loadReplayData(runId);
      };
    });
  }

  function bindRuntimeLinkEvents() {
    const groups = {};
    document.querySelectorAll('[data-runtime-link]').forEach(el => {
      const key = el.getAttribute('data-runtime-link') || '';
      if (!key) return;
      if (!groups[key]) groups[key] = [];
      groups[key].push(el);
    });

    const clearActive = () => {
      document.querySelectorAll('.runtime-link-active').forEach(el => el.classList.remove('runtime-link-active'));
    };

    Object.entries(groups).forEach(([key, els]) => {
      const activate = () => {
        clearActive();
        els.forEach(el => el.classList.add('runtime-link-active'));
        if (key === 'prompt' || key === 'decode') {
          document.querySelectorAll('[data-runtime-link="compare"]').forEach(el => el.classList.add('runtime-link-active'));
        }
      };
      const deactivate = () => clearActive();
      els.forEach(el => {
        el.addEventListener('mouseenter', activate);
        el.addEventListener('mouseleave', deactivate);
        el.addEventListener('focus', activate);
        el.addEventListener('blur', deactivate);
      });
    });
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
            <div class="live-stat-label">${esc(t('live_current_tps'))}</div>
            <div class="live-stat-value" style="font-size:1.1em;font-weight:bold">${formatTps(phase.current_decode_tps)}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_decode_tps'))}</div>
            <div class="live-stat-value">${formatTps(phase.avg_decode_tps)}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_min_tps'))}</div>
            <div class="live-stat-value">${formatTps(phase.min_decode_tps)}</div>
          </div>
          <div class="live-stat">
            <div class="live-stat-label">${esc(t('live_max_tps'))}</div>
            <div class="live-stat-value">${formatTps(phase.max_decode_tps)}</div>
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

  function renderMoePanel(moe, focus = 'all') {
    const trace = moe.latest_trace;
    const selection = moe.hot_selection;
    const topExperts = Array.isArray(moe.top_experts) ? moe.top_experts : [];
    const stages = moe.stages && typeof moe.stages === 'object' ? Object.values(moe.stages) : [];
    const stageMatrix = Array.isArray(moe.expert_stage_matrix) ? moe.expert_stage_matrix : [];
    const layerMatrix = Array.isArray(moe.expert_layer_matrix) ? moe.expert_layer_matrix : [];
    const expertTotals = Array.isArray(moe.expert_totals) ? moe.expert_totals : [];
    const compare = moe.prompt_decode_compare && typeof moe.prompt_decode_compare === 'object'
      ? moe.prompt_decode_compare
      : { prompt: [], decode: [] };
    const stability = moe.stability && typeof moe.stability === 'object'
      ? moe.stability
      : { label: 'n/a', score: 0 };
    const promptExpertsSet = new Set((compare.prompt || []).map(item => Number(item.expert)));
    const decodeExpertsSet = new Set((compare.decode || []).map(item => Number(item.expert)));
    const compareOverlapCount = Array.from(promptExpertsSet).filter(expert => decodeExpertsSet.has(expert)).length;

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

    const heatmapExperts = expertTotals.slice(0, 8);
    const heatmapRows = layerMatrix.length
      ? layerMatrix.map(row => ({ label: `L${row.layer}`, experts: row.experts || [], title: `layer ${row.layer}` }))
      : stageMatrix.map(row => ({ label: row.stage || '', experts: row.experts || [], title: row.stage || '' }));
    const heatmapMax = Math.max(
      ...heatmapRows.flatMap(row => (row.experts || []).map(item => Number(item.hits || 0))),
      0
    );
    const layerTraceDemo = getPreferredLayerTraceDemo();
    const heatmapHtml = showInspect
      ? `
          <div class="live-history">
            <div class="live-panel-title">${esc(t('live_moe_heatmap'))}</div>
            <div class="live-empty">${esc(heatmapRows.length && heatmapExperts.length ? t('live_moe_heatmap_note') : t('live_moe_heatmap_empty_note'))}</div>
            ${heatmapRows.length && heatmapExperts.length ? `
              <div class="live-summary live-summary-tight">
                <div class="live-chip">
                  <span>${esc(t('live_moe_heatmap_rows'))}</span>
                  <strong>${esc(String(heatmapRows.length))}</strong>
                </div>
                <div class="live-chip">
                  <span>${esc(t('live_moe_heatmap_cols'))}</span>
                  <strong>${esc(String(heatmapExperts.length))}</strong>
                </div>
                <div class="live-chip">
                  <span>${esc(t('live_moe_heatmap_peak'))}</span>
                  <strong>${esc(heatmapExperts[0] ? `e${heatmapExperts[0].expert}` : 'n/a')}</strong>
                </div>
                <div class="live-chip">
                  <span>${esc(t('live_moe_heatmap_axis'))}</span>
                  <strong>${esc(layerMatrix.length ? t('live_moe_layer') : t('live_moe_stage'))}</strong>
                </div>
              </div>
              <div class="heatmap-legend">
                <span class="heatmap-legend-label">${esc(t('live_moe_heatmap_legend'))}</span>
                <div class="heatmap-legend-bar" aria-hidden="true"></div>
                <div class="heatmap-legend-scale">
                  <span>${esc(t('live_moe_heatmap_low'))}</span>
                  <span>${esc(t('live_moe_heatmap_high'))}</span>
                </div>
              </div>
              <div class="expert-heatmap">
                <div class="expert-heatmap-header">
                  <div class="expert-heatmap-corner">${esc(layerMatrix.length ? t('live_moe_layer') : t('live_moe_stage'))}</div>
                  ${heatmapExperts.map(item => `<div class="expert-heatmap-col">e${esc(String(item.expert))}</div>`).join('')}
                </div>
                ${heatmapRows.map(row => {
                  const rowMap = new Map((row.experts || []).map(item => [Number(item.expert), Number(item.hits || 0)]));
                  return `
                    <div class="expert-heatmap-row">
                      <div class="expert-heatmap-stage">${esc(row.label || '')}</div>
                      ${heatmapExperts.map(item => {
                        const hits = rowMap.get(Number(item.expert)) || 0;
                        const intensity = heatmapMax > 0 ? Math.max((hits / heatmapMax) * 100, hits > 0 ? 12 : 0) : 0;
                        return `
                          <div class="expert-heatmap-cell" title="${esc(`${row.title || row.label || ''} / e${item.expert} = ${hits}`)}">
                            <div class="expert-heatmap-fill" style="opacity:${(intensity / 100).toFixed(3)}"></div>
                            <span>${hits > 0 ? esc(String(hits)) : ''}</span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="live-summary live-summary-tight">
                <div class="live-chip">
                  <span>${esc(t('live_replay_telemetry'))}</span>
                  <strong>${esc(t(`live_replay_telemetry_${getReplayTelemetryKind(replayState.data)}`))}</strong>
                </div>
              </div>
              ${layerTraceDemo ? `
                <div class="replay-quick-picks">
                  <div class="replay-quick-picks-label">${esc(t('live_replay_quick_picks'))}</div>
                  <div class="replay-quick-picks-row">
                    <button type="button" class="live-chip replay-pick-btn" data-replay-pick="${esc(layerTraceDemo.id)}">
                      <span>${esc(t('live_moe_heatmap_open_demo'))}</span>
                      <strong>${esc(layerTraceDemo.demoType)}</strong>
                    </button>
                  </div>
                </div>
              ` : ''}
            `}
          </div>
        `
      : '';


    const renderExpertCompareList = (items) => {
      const top = Array.isArray(items) ? items.slice(0, 5) : [];
      if (!top.length) {
        return `<div class="live-empty">${esc(t('live_no_moe_data'))}</div>`;
      }
      const maxHits = Math.max(...top.map(item => Number(item.hits || 0)), 0);
      return `
        <div class="top-experts-list">
          ${top.map(item => {
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
      `;
    };

    const compareHtml = showInspect && ((compare.prompt && compare.prompt.length) || (compare.decode && compare.decode.length))
      ? `
          <div class="live-history" data-runtime-link="compare">
            <div class="live-panel-title">${esc(t('live_moe_prompt_decode_compare'))}</div>
            <div class="live-summary live-summary-tight">
              <div class="live-chip" data-runtime-link="compare">
                <span>${esc(t('live_moe_overlap_count'))}</span>
                <strong>${esc(String(compareOverlapCount))}</strong>
              </div>
              <div class="live-chip" data-runtime-link="compare">
                <span>${esc(t('live_moe_overlap_hint'))}</span>
                <strong>${esc(stability.label && stability.label !== 'n/a' ? t(`live_moe_stability_${stability.label}`) : 'n/a')}</strong>
              </div>
            </div>
            <div class="expert-compare-grid">
              <div>
                <div class="live-panel-title" data-runtime-link="prompt">${esc(t('live_phase_prompt'))}</div>
                ${renderExpertCompareList(compare.prompt)}
              </div>
              <div>
                <div class="live-panel-title" data-runtime-link="decode">${esc(t('live_phase_decode_tail'))}</div>
                ${renderExpertCompareList(compare.decode)}
              </div>
            </div>
          </div>
        `
      : '';

    const stabilityHtml = showInspect && stability.label && stability.label !== 'n/a'
      ? `
          <div class="live-history">
            <div class="live-panel-title">${esc(t('live_moe_stability'))}</div>
            <div class="live-empty">${esc(t('live_moe_stability_note'))}</div>
            <div class="live-summary">
              <div class="live-chip">
                <span>${esc(t('live_moe_stability_label'))}</span>
                <strong>${esc(t(`live_moe_stability_${stability.label}`))}</strong>
              </div>
              <div class="live-chip">
                <span>${esc(t('live_moe_stability_score'))}</span>
                <strong>${esc(formatMs(stability.score))}%</strong>
              </div>
            </div>
          </div>
        `
      : '';

    if (focus === 'heatmap') {
      return `
        <div class="workspace-stack">
          ${heatmapHtml || `<div class="live-panel"><div class="live-empty">${esc(t('live_no_moe_data'))}</div></div>`}
          ${stageCompareHtml}
        </div>
      `;
    }

    if (focus === 'compare') {
      return `
        <div class="workspace-stack">
          ${compareHtml || `<div class="live-panel"><div class="live-empty">${esc(t('live_no_moe_data'))}</div></div>`}
          ${stabilityHtml}
        </div>
      `;
    }

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
          ${heatmapHtml}
          ${compareHtml}
          ${stabilityHtml}
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
    root.innerHTML = `
      ${renderOnboardingStrip(snapshot, options)}
      ${renderWorkspaceShell(snapshot, phase, moe, {
        mode: options.mode || 'live',
        source: options.source || '',
        eventLabel: options.eventLabel || '',
      })}
    `;
    bindWorkspaceEvents();
  }

  function renderEmptyReplay(messageKey = 'live_replay_no_runs') {
    const root = document.getElementById('live-metrics-root');
    if (!root) return;
    setStatus(t('live_idle'), false);
    const quickPicks = getReplayQuickPicks();
    const scenarios = getReplayScenarios();
    root.innerHTML = `
      <div class="live-panel">
        <div class="live-panel-title">${esc(t('live_replay_overview_title'))}</div>
        <div class="live-empty">${esc(t(messageKey))}</div>
        <div class="live-learn-note">${esc(t('live_replay_overview_note'))}</div>
        ${scenarios.length ? `
          <div class="replay-scenarios">
            <div class="replay-quick-picks-label">${esc(t('live_replay_scenarios'))}</div>
            <div class="replay-overview-grid">
              ${scenarios.map(item => `
                <button type="button" class="replay-overview-card replay-scenario-card" data-replay-pick="${esc(item.run.id)}">
                  <div class="replay-overview-head">
                    <span class="live-chip"><span>${esc(t(`live_family_${item.run.family}`))}</span><strong>${esc(item.run.demoType)}</strong></span>
                  </div>
                  <div class="replay-overview-title">${esc(item.title)}</div>
                  <div class="replay-overview-text">${esc(item.body)}</div>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
        ${quickPicks.length ? `
          <div class="replay-overview-grid">
            ${quickPicks.map(item => {
              const desc = getReplayRunDescription(item);
              return `
                <button type="button" class="replay-overview-card" data-replay-pick="${esc(item.id)}">
                  <div class="replay-overview-head">
                    <span class="live-chip"><span>${esc(t(`live_family_${item.family}`))}</span><strong>${esc(item.demoType)}</strong></span>
                  </div>
                  <div class="replay-overview-title">${esc(desc.title)}</div>
                  <div class="replay-overview-text">${esc(desc.body)}</div>
                </button>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    `;
    document.querySelectorAll('[data-replay-pick]').forEach(btn => {
      btn.onclick = async () => {
        const runId = btn.getAttribute('data-replay-pick') || '';
        if (!runId) return;
        replayState.mode = 'replay';
        replayState.selectedRun = runId;
        stopReplay();
        await loadReplayData(runId);
      };
    });
  }

  function renderReplayDescription() {
    if (replayState.mode !== 'replay') return '';
    const run = replayState.runs.find(item => item.id === replayState.selectedRun);
    const desc = getReplayRunDescription(run);
    const telemetryKind = getReplayTelemetryKind(replayState.data);
    const quickPicks = getReplayQuickPicks();
    if (!run) {
      return `
        <div class="live-panel replay-desc-panel">
          <div class="live-panel-title">${esc(desc.title)}</div>
          <div class="live-empty">${esc(desc.body)}</div>
          ${quickPicks.length ? `
            <div class="replay-quick-picks">
              <div class="replay-quick-picks-label">${esc(t('live_replay_quick_picks'))}</div>
              <div class="replay-quick-picks-row">
                ${quickPicks.map(item => `
                  <button type="button" class="live-chip replay-pick-btn" data-replay-pick="${esc(item.id)}">
                    <span>${esc(t(`live_family_${item.family}`))}</span>
                    <strong>${esc(item.demoType)}</strong>
                  </button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="live-panel replay-desc-panel">
        <div class="live-panel-title">${esc(desc.title)}</div>
        <div class="live-summary live-summary-tight">
          <div class="live-chip">
            <span>${esc(t('live_replay_demo'))}</span>
            <strong>${esc(run.curated ? t('live_replay_filter_curated') : t('live_replay_generic'))}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_family_label'))}</span>
            <strong>${esc(t(`live_family_${run.family}`))}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_replay_type'))}</span>
            <strong>${esc(run.demoType)}</strong>
          </div>
          <div class="live-chip">
            <span>${esc(t('live_replay_telemetry'))}</span>
            <strong>${esc(t(`live_replay_telemetry_${telemetryKind}`))}</strong>
          </div>
        </div>
        <div class="live-learn-text">${esc(desc.body)}</div>
        ${quickPicks.length ? `
          <div class="replay-quick-picks">
            <div class="replay-quick-picks-label">${esc(t('live_replay_quick_picks'))}</div>
            <div class="replay-quick-picks-row">
              ${quickPicks.map(item => `
                <button type="button" class="live-chip replay-pick-btn ${item.id === run.id ? 'active' : ''}" data-replay-pick="${esc(item.id)}">
                  <span>${esc(t(`live_family_${item.family}`))}</span>
                  <strong>${esc(item.demoType)}</strong>
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
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
    const runs = Array.isArray(data.runs) ? data.runs : [];
    replayState.runs = runs.map(classifyReplayRun).sort((a, b) => {
      if (a.curated !== b.curated) return a.curated ? -1 : 1;
      if (a.trace_like !== b.trace_like) return a.trace_like ? -1 : 1;
      return Number(b.last_modified_ts || 0) - Number(a.last_modified_ts || 0);
    });
    if (!replayState.selectedRun && replayState.runs.length) {
      const preferred = replayState.runs.find(r => r.curated && r.trace_like) || replayState.runs.find(r => r.trace_like) || replayState.runs[0];
      replayState.selectedRun = preferred.id;
    }
    return replayState.runs;
  }

  async function loadReplayData(runId) {
    replayState.data = null;
    replayState.frameIndex = 0;
    if (!runId) {
      renderToolbar(true);
      renderEmptyReplay();
      return;
    }
    const data = await apiGet(`/api/replay-metrics?run=${encodeURIComponent(runId)}`);
    replayState.data = data;
    replayState.selectedRun = runId;
    renderToolbar(true);
    renderReplayFrame();
  }

  async function poll() {
    if (replayState.mode === 'replay') return;
    try {
      const serverPort = (window.state && window.state.port) || 8080;
      const serverHost = (window.state && window.state.hostname) || '127.0.0.1';
      const snapshot = await apiGet(`/api/live-metrics?server_port=${serverPort}&server_host=${serverHost}`);
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
    renderToolbar(true);
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
    renderToolbar(true);
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
