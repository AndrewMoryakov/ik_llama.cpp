// ============================================================
// === MODULE ALIASES (loaded from <script> tags before this file) ===
// ============================================================
// i18n (LANG stays as const, t() is defined as function below)
const { LANG, setCurrentLang } = window.DashboardI18n;
const { HELP, GLOSSARY } = window.DashboardHelp;
const { PROFILES, DEFAULTS, TOGGLE_PARAMS } = window.DashboardData;
const {
  isSwapBound, modelPathContains, getRtrMode, isRtrForcedOn, isRtrEnabled,
  detectModelFamily, isValidatedAutoMoeFamily, getFamilyValidationStatus,
  hasExperimentalKnobs, isExperimentalRuntimeLimited,
  severityLevel, SEVERITY_ICONS,
  RULES, PARAM_APPLICABILITY, PARAM_CONTROL_MAP, WARNING_PARAM_TO_PANE,
} = window.DashboardRules;
const { buildCommandString, buildArgsArray: _buildArgsArray } = window.DashboardCommand;
const { computeOptimalParams } = window.DashboardAutoConfig;



// ============================================================
// === STATE ===
// ============================================================
let currentLang = 'ru';
let currentProfile = null;
let suppressUpdate = false;
let currentWorkspacePane = 'overview';
let currentOptimizationPane = 'validated';


const state = { ...DEFAULTS };

// Proxy for reactivity
const S = new Proxy(state, {
  set(t, k, v) {
    if (t[k] === v) return true;
    const prev = t[k];
    t[k] = v;
    // only forced ON hard-disables mmap in the dashboard model
    if (k === 'repack_tensors' && v === 'on') {
      t.use_mmap = false;
    } else if (k === 'repack_tensors' && prev === 'on' && t.use_mmap === false) {
      t.use_mmap = true;
    }
    // Switch CLI terminal / Chat panel when target changes
    if (k === 'target') updateInteractionPanels();
    if (!suppressUpdate) {
      syncToDOM(k);
      evaluate();
      renderCommand();
      saveState();
      document.dispatchEvent(new CustomEvent('dashboard:state-changed', {
        detail: { key: k, value: v, state: { ...state } }
      }));
    }
    return true;
  }
});

// ============================================================
// === DOM SYNC ===
// ============================================================

function syncToDOM(changedKey) {
  // Sync toggles
  for (const p of TOGGLE_PARAMS) {
    const track = document.getElementById('tog-' + p);
    const label = document.getElementById('tog-label-' + p);
    if (track) {
      track.classList.toggle('on', !!state[p]);
      if (label) label.textContent = state[p] ? 'ON' : 'OFF';
    }
    // mmap forced by rtr
    if (p === 'use_mmap' && isRtrForcedOn(state)) {
      if (track) track.classList.add('disabled');
    } else if (p === 'use_mmap') {
      const track2 = document.getElementById('tog-use_mmap');
      if (track2) track2.classList.remove('disabled');
    }
  }
  const rtrSel = document.getElementById('p-repack_tensors');
  if (rtrSel && rtrSel !== document.activeElement) {
    rtrSel.value = getRtrMode(state);
  }
  if (changedKey && PARAM_CONTROL_MAP[changedKey] && !String(PARAM_CONTROL_MAP[changedKey]).startsWith('tog-')) {
    if (changedKey !== 'experimental_preset') {
      const el = document.getElementById(PARAM_CONTROL_MAP[changedKey]);
      if (el && el !== document.activeElement) el.value = state[changedKey];
    }
  } else {
    for (const [k, id] of Object.entries(PARAM_CONTROL_MAP)) {
      if (String(id).startsWith('tog-')) continue;
      if (k === 'experimental_preset') continue;
      const el = document.getElementById(id);
      if (el && el !== document.activeElement) el.value = state[k];
    }
  }
  // SER inputs enable/disable
  document.getElementById('p-ser_min').disabled = !state.ser_enabled;
  document.getElementById('p-ser_thresh').disabled = !state.ser_enabled;
  const tailWindowInput = document.getElementById('p-hot_expert_tail_window');
  if (tailWindowInput) {
    tailWindowInput.disabled = state.hot_expert_selection !== 'tail-window';
  }
  const packedPresetSelect = document.getElementById('p-prompt_packed_qkv_preset');
  if (packedPresetSelect) {
    packedPresetSelect.disabled = !state.prompt_packed_qkv;
  }
  const packedRangeInput = document.getElementById('p-prompt_packed_qkv_range');
  if (packedRangeInput) {
    packedRangeInput.disabled = !state.prompt_packed_qkv;
  }
  renderExperimentalPresetPicker();
  renderExperimentalPresetHint();
}

function syncAllToDOM() {
  for (const p of TOGGLE_PARAMS) syncToDOM(p);
  syncToDOM(null); // sync all inputs
}

function toggleParam(name) {
  if (name === 'use_mmap' && isRtrForcedOn(state)) return; // locked only for forced ON
  S[name] = !state[name];
  if (name === 'experimental_preset_link_validated' && state.experimental_preset !== 'none' && state.experimental_preset_link_validated) {
    applyExperimentalPreset(state.experimental_preset, { reapplyOnly: true });
  }
}

// ============================================================
// === RULES EVALUATION ===
// ============================================================
function evaluate() {
  const profile = currentProfile || { totalRamGb: 0, ccdCount: 1, cores: 16 };
  const active = [];
  const paramSeverity = {}; // param -> worst severity

  for (const rule of RULES) {
    let triggered = false;
    try { triggered = rule.test(state, profile); } catch(e) {}
    if (triggered) {
      active.push(rule);
      const sev = severityLevel(rule.severity);
      for (const p of rule.params) {
        if (!paramSeverity[p] || sev > severityLevel(paramSeverity[p])) {
          paramSeverity[p] = rule.severity;
        }
      }
    }
  }

  renderWarnings(active);
  renderModelBadges();
  renderDots(paramSeverity);
  renderAdvancedHints();
}


function getWorkspacePaneLabel(pane) {
  if (pane === 'model') return t('sec_model');
  if (pane === 'performance') return t('sec_perf');
  if (pane === 'optimization') return t('sec_opt');
  if (pane === 'server') return t('sec_server');
  if (pane === 'advanced') return t('sec_adv');
  if (pane === 'launch') return t('ws_nav_launch');
  if (pane === 'runtime') return t('ws_nav_runtime');
  return t('ws_nav_overview');
}

function getWorkspacePaneForWarning(rule) {
  const params = Array.isArray(rule.params) ? rule.params : [];
  for (const param of params) {
    if (WARNING_PARAM_TO_PANE[param]) return WARNING_PARAM_TO_PANE[param];
  }
  if (/server|port|host|api/i.test(rule.id)) return 'server';
  return '';
}

function flashElement(el, className = 'focus-target', duration = 3800) {
  if (!el) return;
  el.classList.remove(className);
  void el.offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), duration);
}

function highlightWorkspacePaneButton(pane) {
  if (!pane) return;
  const btn = document.querySelector(`[data-workspace-pane-btn="${pane}"]`);
  flashElement(btn, 'pulse-target', 3800);
}

function jumpToParam(param, paneOverride = '') {
  const pane = paneOverride || WARNING_PARAM_TO_PANE[param] || '';
  if (pane) {
    setWorkspacePane(pane);
    highlightWorkspacePaneButton(pane);
    if (pane === 'optimization') {
      const experimentalParams = new Set([
        'ser_enabled', 'ser_min', 'ser_thresh',
        'hot_expert_budget', 'hot_expert_budget_mult', 'hot_expert_selection', 'hot_expert_tail_window',
        'live_observability', 'experimental_preset', 'experimental_preset_link_validated',
        'merge_qkv', 'prompt_packed_qkv', 'prompt_packed_qkv_preset', 'prompt_packed_qkv_range',
      ]);
      setOptimizationPane(experimentalParams.has(param) ? 'experimental' : 'validated');
    }
  }

  const targetId = PARAM_CONTROL_MAP[param];
  if (!targetId) return;

  setTimeout(() => {
    const raw = document.getElementById(targetId);
    if (!raw) return;
    const container = raw.closest('.param-row') || raw.closest('.profile-field') || raw.closest('.card') || raw;
    container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flashElement(container);
    const focusable = raw.matches('input, select, textarea, button')
      ? raw
      : (raw.closest('button, [tabindex], input, select, textarea') || null);
    if (focusable && typeof focusable.focus === 'function') {
      try {
        focusable.focus({ preventScroll: true });
      } catch (_) {
        focusable.focus();
      }
    }
  }, pane ? 140 : 20);
}

function jumpToOverviewChip(param, paneOverride = '') {
  jumpToParam(param, paneOverride);
}

function pickActionParam(active, pane, fallback = '') {
  for (const rule of active) {
    const params = Array.isArray(rule.params) ? rule.params : [];
    for (const param of params) {
      if ((WARNING_PARAM_TO_PANE[param] || '') === pane) return param;
    }
  }
  return fallback;
}

function renderWarnings(active) {
  const area = document.getElementById('warnings-area');
  area.innerHTML = '';
  // Sort: errors first, then warnings, info, success
  active.sort((a, b) => severityLevel(b.severity) - severityLevel(a.severity));
  for (const rule of active) {
    const div = document.createElement('div');
    div.className = 'warning-banner ' + rule.severity;
    const pane = getWorkspacePaneForWarning(rule);
    if (pane) {
      div.classList.add('navigable');
      div.tabIndex = 0;
      div.setAttribute('role', 'button');
      div.setAttribute('aria-label', `${t('warn_open')} ${getWorkspacePaneLabel(pane)}`);
      div.addEventListener('click', () => {
        const param = (Array.isArray(rule.params) ? rule.params : []).find(p => (WARNING_PARAM_TO_PANE[p] || '') === pane);
        if (param) jumpToParam(param, pane);
        else setWorkspacePane(pane);
      });
      div.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          const param = (Array.isArray(rule.params) ? rule.params : []).find(p => (WARNING_PARAM_TO_PANE[p] || '') === pane);
          if (param) jumpToParam(param, pane);
          else setWorkspacePane(pane);
        }
      });
    }
    const icon = document.createElement('span');
    icon.className = 'warning-icon';
    icon.textContent = SEVERITY_ICONS[rule.severity] || '';
    div.appendChild(icon);
    const body = document.createElement('div');
    body.className = 'warning-body';
    const text = document.createElement('span');
    text.className = 'warning-text';
    let html = '<b>' + rule.id.replace(/_/g, ' ') + ':</b> ' + t(rule.msg);
    if (rule.fix) html += '<br><em>' + t(rule.fix) + '</em>';
    text.innerHTML = html;
    body.appendChild(text);
    div.appendChild(body);
    if (pane) {
      const jump = document.createElement('button');
      jump.className = 'warning-jump';
      jump.type = 'button';
      jump.textContent = `${t('warn_open')} ${getWorkspacePaneLabel(pane)}`;
      jump.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const param = (Array.isArray(rule.params) ? rule.params : []).find(p => (WARNING_PARAM_TO_PANE[p] || '') === pane);
        if (param) jumpToParam(param, pane);
        else setWorkspacePane(pane);
      });
      div.appendChild(jump);
    }
    area.appendChild(div);
  }
  renderOverviewSummary(active);
}

function renderOverviewSummary(active = []) {
  const hero = document.getElementById('overview-hero-grid');
  const quickline = document.getElementById('overview-quickline');
  const actions = document.getElementById('overview-actions');
  if (!hero || !quickline || !actions) return;

  const profile = currentProfile || { totalRamGb: 0 };
  const family = detectModelFamily(state);
  const validation = getFamilyValidationStatus(state);
  const swap = isSwapBound(state, profile);
  const memState = profile.totalRamGb > 0 && state.model_size_gb > 0
    ? (swap ? 'swap' : (state.model_size_gb > profile.totalRamGb * 0.75 ? 'near' : 'inram'))
    : 'unknown';
  const runtimeState = !serverConnected
    ? 'offline'
    : (interactionReady ? 'ready' : (modelLoadProgress.phase && modelLoadProgress.phase !== 'idle'
      ? 'loading'
      : (document.getElementById('proc-status')?.textContent?.includes('exit') ? 'stopped' : 'idle')));

  const evidenceCtx = {
    state,
    meta: lastModelMeta,
    family,
    modelPath: state.model || '',
    modelType: state.model_type,
    workload: state.workload_profile,
    isSwapBound: swap,
    modelSizeGb: state.model_size_gb || 0,
    hasExperimentalKnobs: hasExperimentalKnobs(state)
  };
  const familySummary = window.IKLLamaEvidenceLayer?.getOverviewFamilySummary?.(
    evidenceCtx,
    currentLang,
    { detectModelFamily, isSwapBound }
  ) || {
    value: family === 'qwen3moe'
      ? t('badge_family_qwen')
      : family === 'gpt-oss'
        ? t('badge_family_gptoss')
        : family === 'minimax'
          ? t('badge_family_minimax')
          : t('ov_family_unknown_value'),
    note: family === 'other'
      ? t('ov_family_unknown_note')
      : (state.model_size_gb > 0 ? `${state.model_size_gb} GB` : (currentLang === 'ru' ? 'Размер модели пока не определён' : 'Model size is not set yet')),
    tone: ''
  };
  const validationSummary = window.IKLLamaEvidenceLayer?.getOverviewValidationSummary?.(
    evidenceCtx,
    currentLang,
    { detectModelFamily, isSwapBound }
  ) || {
    status: validation,
    value: validation === 'validated'
      ? t('ov_validation_validated')
      : validation === 'partial'
        ? t('ov_validation_partial')
        : t('ov_validation_unknown_value'),
    note: validation === 'unknown'
      ? t('ov_validation_unknown_note')
      : (hasExperimentalKnobs(state) ? t('badge_status_exp_knobs') : (currentLang === 'ru' ? 'Без экспериментальных ручек' : 'No experimental knobs active')),
    tone: ''
  };
  const runtimeText = runtimeState === 'offline'
    ? t('ov_runtime_offline')
    : runtimeState === 'ready'
      ? t('ov_runtime_ready')
      : runtimeState === 'loading'
        ? t('ov_runtime_loading')
        : runtimeState === 'stopped'
          ? t('ov_runtime_stopped')
          : t('ov_runtime_idle');
  const memoryText = memState === 'swap'
    ? t('ov_mem_swap')
    : memState === 'near'
      ? t('ov_mem_near')
      : memState === 'inram'
        ? t('ov_mem_inram')
        : t('ov_mem_unknown');

  const familyClass = familySummary.tone || (validation === 'validated' ? 'accent' : validation === 'partial' ? 'warn' : '');
  const memoryClass = memState === 'swap' ? 'error' : memState === 'near' ? 'warn' : memState === 'inram' ? 'accent' : '';
  const warnClass = active.some(r => r.severity === 'error') ? 'error' : active.some(r => r.severity === 'warning') ? 'warn' : 'accent';
  const workloadText = state.workload_profile === 'tg'
    ? t('badge_path_tg')
    : state.workload_profile === 'pp'
      ? t('badge_path_pp')
      : t('badge_path_mixed');
  const threadsBatchText = state.threads_batch === -1 ? t('ov_quick_auto') : String(state.threads_batch);
  const hotBudgetText = (state.hot_expert_budget || 0) > 0
    ? String(state.hot_expert_budget)
    : (currentLang === 'ru' ? '0 / default' : '0 / default');
  const quickChips = [
    { label: t('ov_quick_workload'), value: workloadText, tone: state.workload_profile === 'mixed' ? 'accent' : '', param: 'workload_profile', pane: 'performance' },
    { label: t('ov_quick_threads'), value: `${state.threads} / ${threadsBatchText}`, tone: '', param: 'threads', pane: 'performance' },
    { label: t('ov_quick_rtr'), value: String(state.repack_tensors || 'off').toUpperCase(), tone: state.repack_tensors === 'on' && swap ? 'error' : (state.repack_tensors === 'auto' ? 'accent' : ''), param: 'repack_tensors', pane: 'optimization' },
    { label: t('ov_quick_kv'), value: `${state.cache_type_k}/${state.cache_type_v}`, tone: state.cache_type_k === 'q8_0' ? 'accent' : '', param: 'cache_type_k', pane: 'optimization' },
    { label: t('ov_quick_fa'), value: state.flash_attn ? 'ON' : 'OFF', tone: state.flash_attn ? 'accent' : 'warn', param: 'flash_attn', pane: 'optimization' },
    { label: t('ov_quick_mmap'), value: state.use_mmap ? 'ON' : 'OFF', tone: '', param: 'use_mmap', pane: 'advanced' },
    { label: t('ov_quick_hot'), value: hotBudgetText, tone: (state.hot_expert_budget || 0) > 0 ? 'warn' : '', param: 'hot_expert_budget', pane: 'optimization' },
  ];
  const runtimeHeroButton = interactionReady || runtimeState === 'loading'
    ? `<button class="btn-ghost overview-hero-btn" onclick="setWorkspacePane('runtime')">${t('ov_go_runtime')}</button>`
    : `<button class="btn-ghost overview-hero-btn" onclick="setWorkspacePane('launch')">${t('ov_go_launch')}</button>`;

  hero.innerHTML = `
    <div class="overview-hero-card ${familyClass}">
      <div class="overview-hero-label">${t('ov_family')}</div>
      <div class="overview-hero-value">${familySummary.value}</div>
      <div class="overview-hero-note">${familySummary.note}</div>
      <div class="overview-hero-actions">
        ${!state.model
          ? `<button class="btn-accent overview-hero-btn" onclick="browseModelFile()">${t('ov_browse_model')}</button>`
          : `<button class="btn-ghost overview-hero-btn" onclick="jumpToParam('model', 'model')">${t('ov_go_model')}</button>`}
      </div>
    </div>
    <div class="overview-hero-card ${memoryClass}">
      <div class="overview-hero-label">${t('ov_memory')}</div>
      <div class="overview-hero-value">${memoryText}</div>
      <div class="overview-hero-note">${profile.totalRamGb > 0 ? `${Math.round(profile.totalRamGb)} GB RAM` : (currentLang === 'ru' ? 'RAM профиля неизвестна' : 'Profile RAM is unknown')}</div>
      <div class="overview-hero-actions">
        <button class="btn-ghost overview-hero-btn" onclick="jumpToParam('model_size_gb', 'model')">${t('ov_go_model_size')}</button>
      </div>
    </div>
    <div class="overview-hero-card ${validationSummary.tone || familyClass}">
      <div class="overview-hero-label">${t('ov_validation')}</div>
      <div class="overview-hero-value">${validationSummary.value}</div>
      <div class="overview-hero-note">${validationSummary.note}</div>
      <div class="overview-hero-actions">
        <button class="btn-ghost overview-hero-btn" onclick="jumpToParam('repack_tensors', 'optimization')">${t('ov_go_rtr')}</button>
      </div>
    </div>
    <div class="overview-hero-card ${warnClass}">
      <div class="overview-hero-label">${t('ov_runtime')}</div>
      <div class="overview-hero-value">${runtimeText}</div>
      <div class="overview-hero-note">${t('ov_warn_count')}: ${active.length || t('ov_warn_none')}</div>
      <div class="overview-hero-actions">
        ${runtimeHeroButton}
      </div>
    </div>
  `;

  quickline.innerHTML = `
    <div class="overview-quickline-head">
      <div>
        <div class="overview-quickline-title">${t('ov_profile_title')}</div>
        <div class="overview-quickline-note">${t('ov_profile_note')}</div>
      </div>
    </div>
    <div class="overview-quickline-grid">
      ${quickChips.map(item => `
        <button type="button" class="overview-chip ${item.tone || ''}" onclick="jumpToOverviewChip('${item.param}', '${item.pane}')">
          <span class="overview-chip-label">${item.label}</span>
          <span class="overview-chip-value">${item.value}</span>
        </button>
      `).join('')}
    </div>
  `;

  const actionSeed = window.IKLLamaEvidenceLayer?.getOverviewActions?.(
    {
      ...evidenceCtx,
      interactionReady,
      runtimeState
    },
    currentLang,
    { detectModelFamily, isSwapBound }
  ) || [];
  const actionList = actionSeed.map((item) => {
    const param = item.pane ? pickActionParam(active, item.pane, item.defaultParam || '') : (item.defaultParam || '');
    return { ...item, param };
  });

  actions.innerHTML = `
    <div class="overview-actions-head">
      <div>
        <div class="overview-actions-title">${t('ov_actions_title')}</div>
        <div class="overview-actions-note">${t('ov_actions_note')}</div>
      </div>
    </div>
    <div class="overview-actions-grid">
      ${actionList.map(item => `
        <div class="overview-action">
          <div class="overview-action-top">
            <div class="overview-action-title">${item.title}</div>
          </div>
          <div class="overview-action-body">${item.body}</div>
          <button class="${item.accent ? 'btn-accent' : 'btn-ghost'}" onclick="${item.param ? `jumpToParam('${item.param}', '${item.pane}')` : `setWorkspacePane('${item.pane}')`}">${item.label}</button>
        </div>
      `).join('')}
    </div>
  `;
}

function renderModelBadges() {
  const el = document.getElementById('model-badges');
  if (!el) return;
  const layer = window.IKLLamaEvidenceLayer;
  const badges = layer?.getModelBadges?.(
    buildEvidenceContext(state, currentProfile),
    currentLang,
    { detectModelFamily, isSwapBound, hasExperimentalKnobs }
  ) || [];

  el.innerHTML = badges.map((badge) => `
    <span class="model-badge ${badge.className || 'family-generic'}" title="${escapeHtml(badge.title || '')}">${escapeHtml(badge.label || '')}</span>
  `).join('');
}

function renderDots(paramSeverity) {
  // Reset all dots
  document.querySelectorAll('.param-label .dot').forEach(d => {
    d.className = 'dot';
  });
  const colorMap = { error: 'red', warning: 'yellow', success: 'green', info: '' };
  for (const [param, sev] of Object.entries(paramSeverity)) {
    const dot = document.getElementById('dot-' + param);
    if (dot && colorMap[sev]) {
      dot.className = 'dot visible ' + colorMap[sev];
    }
  }
}

// Data-driven evidence layer overrides.
// These declarations intentionally shadow the legacy semantic helpers above,
// so dashboard rendering uses the registry from evidence-layer.js as the
// primary source of truth while keeping the old block as an inert fallback.
function buildEvidenceContext(s = state, p = currentProfile) {
  return {
    state: s,
    profile: p,
    family: detectModelFamily(s),
    modelPath: s.model || '',
    modelType: s.model_type,
    workload: s.workload_profile,
    isSwapBound: isSwapBound(s, p || currentProfile || {}),
  };
}

function getApplicabilityMeta(kind) {
  const layer = window.IKLLamaEvidenceLayer;
  const entry = layer?.APPLICABILITY_META?.[kind] || layer?.APPLICABILITY_META?.all;
  if (!entry) {
    return { label: currentLang === 'ru' ? 'Все' : 'All', className: 'app-all', title: '' };
  }
  return {
    label: currentLang === 'ru' ? entry.labelRu : entry.labelEn,
    className: entry.className,
    title: currentLang === 'ru' ? entry.titleRu : entry.titleEn,
  };
}

function getExperimentalApplicabilityKind(param) {
  const layer = window.IKLLamaEvidenceLayer;
  return layer?.EXPERIMENTAL_KNOB_EVIDENCE?.[param]?.applicability || PARAM_APPLICABILITY[param] || 'all';
}

function getSupportBadgeMeta(param, s = state, p = currentProfile) {
  return window.IKLLamaEvidenceLayer?.getRuntimeSupportBadge?.(
    param,
    buildEvidenceContext(s, p),
    currentLang,
    { detectModelFamily, isSwapBound }
  ) || null;
}

// Wire getSupportBadgeMeta into DashboardRules for isExperimentalRuntimeLimited
window._dashboardGetSupportBadgeMeta = getSupportBadgeMeta;

function getValidationBadgeMeta(param, s = state, p = currentProfile) {
  return window.IKLLamaEvidenceLayer?.getValidationBadge?.(
    param,
    buildEvidenceContext(s, p),
    currentLang,
    { detectModelFamily, isSwapBound }
  ) || null;
}

function getConfidenceBadgeMeta(param, s = state, p = currentProfile) {
  return window.IKLLamaEvidenceLayer?.getConfidenceBadge?.(
    param,
    buildEvidenceContext(s, p),
    currentLang,
    { detectModelFamily, isSwapBound }
  ) || null;
}

function listExperimentalPresets() {
  return window.IKLLamaEvidenceLayer?.listExperimentalPresets?.() || [];
}

function getExperimentalPresetConfig(preset, s = state) {
  const cfg = window.IKLLamaEvidenceLayer?.getPresetEvidence?.(
    preset,
    buildEvidenceContext(s, currentProfile),
    currentLang,
    t,
    { detectModelFamily, isSwapBound }
  );
  if (cfg) return cfg;
  return {
    id: 'none',
    titleText: currentLang === 'ru' ? 'Manual / off' : 'Manual / off',
    description: t('exp_preset_none'),
    note: '',
    risk: 'low',
    scope: 'generic',
    riskLabel: currentLang === 'ru' ? 'Риск: низкий' : 'Risk: low',
    scopeLabel: 'Generic',
    testedOn: [],
    confidenceBadge: null,
    experimental: {},
    validated: {},
  };
}

function experimentalPresetScopeLabel(scope) {
  return window.IKLLamaEvidenceLayer?.getPresetScopeLabel?.(scope, currentLang)
    || (scope === 'moe' ? 'MoE' : scope === 'dense' ? 'Dense' : 'Generic');
}

function experimentalPresetRiskLabel(risk) {
  return window.IKLLamaEvidenceLayer?.getPresetRiskLabel?.(risk, currentLang)
    || (currentLang === 'ru' ? 'Риск: низкий' : 'Risk: low');
}

function renderExperimentalPresetPicker() {
  const root = document.getElementById('experimental-preset-picker');
  const hiddenSelect = document.getElementById('p-experimental_preset');
  if (!root || !hiddenSelect) return;

  const presets = listExperimentalPresets();

  hiddenSelect.innerHTML = presets
    .map(([id]) => {
      const cfg = getExperimentalPresetConfig(id, state);
      return `<option value="${id}">${cfg.titleText}</option>`;
    })
    .join('');
  hiddenSelect.value = state.experimental_preset || 'none';

  const selectedId = state.experimental_preset || 'none';
  const selected = getExperimentalPresetConfig(selectedId, state);
  const pickerKicker = currentLang === 'ru' ? 'Выбери исследовательский bundle' : 'Choose a research bundle';
  const pickerHint = currentLang === 'ru'
    ? 'Безопасный baseline не меняется сам по себе. Этот control только собирает воспроизводимый A/B-старт.'
    : 'The safe baseline does not change by itself. This control only builds a reproducible A/B starting point.';

  const options = presets.map(([id]) => {
    const cfgResolved = getExperimentalPresetConfig(id, state);
    const active = id === selectedId ? 'active' : '';
    const confidenceChip = cfgResolved.confidenceBadge
      ? `<span class="preset-chip ${cfgResolved.confidenceBadge.className}">${cfgResolved.confidenceBadge.label}</span>`
      : '';
    return `
      <button type="button" class="exp-preset-option ${active}" onclick="selectExperimentalPreset('${id.replace(/'/g, "\\'")}')">
        <div class="exp-preset-option-title-row">
          <div class="exp-preset-option-title">${cfgResolved.titleText}</div>
          <div class="exp-preset-option-meta">
            <span class="preset-chip risk-${cfgResolved.risk}">${experimentalPresetRiskLabel(cfgResolved.risk)}</span>
            <span class="preset-chip scope-${cfgResolved.scope}">${experimentalPresetScopeLabel(cfgResolved.scope)}</span>
            ${confidenceChip}
          </div>
        </div>
        <div class="exp-preset-option-desc">${cfgResolved.description}</div>
      </button>
    `;
  }).join('');

  const selectedConfidenceChip = selected.confidenceBadge
    ? `<span class="preset-chip ${selected.confidenceBadge.className}">${selected.confidenceBadge.label}</span>`
    : '';

  const wasOpen = root.querySelector('details')?.hasAttribute('open') || false;
  root.innerHTML = `
    <details class="exp-preset-dropdown"${wasOpen ? ' open' : ''}>
      <summary>
        <div class="exp-preset-summary">
          <div class="exp-preset-summary-kicker">${pickerKicker}</div>
          <div class="exp-preset-summary-top">
            <div class="exp-preset-summary-title">${selected.titleText}</div>
            <div class="exp-preset-summary-meta">
              <span class="preset-chip risk-${selected.risk}">${experimentalPresetRiskLabel(selected.risk)}</span>
              <span class="preset-chip scope-${selected.scope}">${experimentalPresetScopeLabel(selected.scope)}</span>
              ${selectedConfidenceChip}
            </div>
          </div>
          <div class="exp-preset-summary-desc">${selected.description}</div>
          <div class="exp-preset-summary-desc">${pickerHint}</div>
        </div>
      </summary>
      <div class="exp-preset-menu">${options}</div>
    </details>
  `;
}

function renderExperimentalPresetHint() {
  const el = document.getElementById('experimental-preset-hint');
  if (!el) return;
  const preset = state.experimental_preset || 'none';
  const cfg = getExperimentalPresetConfig(preset, state);
  const linkLabel = state.experimental_preset_link_validated
    ? (currentLang === 'ru' ? 'Связка с проверенными: ON' : 'Validated link: ON')
    : (currentLang === 'ru' ? 'Связка с проверенными: OFF' : 'Validated link: OFF');
  const testedOnLine = cfg.testedOn?.length
    ? `<div class="experimental-preset-hint-line"><span class="model-badge family-generic">${currentLang === 'ru' ? 'Tested on' : 'Tested on'}: ${cfg.testedOn.join(', ')}</span></div>`
    : '';
  const confidenceLine = cfg.confidenceBadge
    ? `<span class="preset-chip ${cfg.confidenceBadge.className}">${cfg.confidenceBadge.label}</span>`
    : '';
  el.innerHTML = `
    <div class="experimental-intro-title">${cfg.titleText}</div>
    <div class="experimental-intro-body">${cfg.description}${cfg.note}</div>
    <div class="experimental-preset-hint-line">
      <span class="preset-chip risk-${cfg.risk}">${experimentalPresetRiskLabel(cfg.risk)}</span>
      <span class="preset-chip scope-${cfg.scope}">${experimentalPresetScopeLabel(cfg.scope)}</span>
      ${confidenceLine}
      <span class="model-badge family-generic">${linkLabel}</span>
    </div>
    ${testedOnLine}
  `;
}

function applyExperimentalPreset(preset, options = {}) {
  const nextPreset = preset || 'none';
  const cfg = getExperimentalPresetConfig(nextPreset, state);
  suppressUpdate = true;
  state.experimental_preset = nextPreset;
  Object.assign(state, cfg.experimental || {});
  if (state.experimental_preset_link_validated) {
    Object.assign(state, cfg.validated || {});
  }
  suppressUpdate = false;
  syncAllToDOM();
  evaluate();
  renderCommand();
  saveState();
  if (!options.reapplyOnly) {
    setOptimizationPane('experimental');
  }
}

function selectExperimentalPreset(id) {
  applyExperimentalPreset(id);
  // Close the dropdown after selection
  const details = document.querySelector('#experimental-preset-picker details');
  if (details) details.removeAttribute('open');
}

function renderAdvancedHints() {
  const el = document.getElementById('advanced-hints');
  if (!el) return;

  const profile = currentProfile || { totalRamGb: 0 };
  const family = detectModelFamily(state);
  const minimaxHint = family === 'minimax' && isSwapBound(state, profile);

  if (!minimaxHint) {
    el.innerHTML = '';
    el.classList.remove('visible');
    return;
  }

  el.innerHTML = `
    <div class="advanced-hint">
      <div class="advanced-hint-title">MiniMax</div>
      <div class="advanced-hint-body">${t('note_minimax_hot_budget')}</div>
      <div class="advanced-hint-body" style="margin-top:8px">${currentLang === 'ru' ? 'Если хотите проверять новую MoE-locality идею, начните с Hot Expert Selection = tail-window и Tail Window = 16. Это исследовательский режим, не validated default.' : 'If you want to test the new MoE locality idea, start with Hot Expert Selection = tail-window and Tail Window = 16. This is a research mode, not a validated default.'}</div>
    </div>
  `;
  el.classList.add('visible');
}



// ============================================================
// === COMMAND GENERATION ===
// ============================================================
function renderCommand() {
  const cmd = buildCommandString(state, serverInfo);
  document.getElementById('command-output').textContent = cmd;
}

// ============================================================
// === PROFILES ===
// ============================================================
function initProfiles() {
  const sel = document.getElementById('sel-profile');
  sel.innerHTML = '';
  for (const [k, v] of Object.entries(PROFILES)) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = v.name;
    sel.appendChild(opt);
  }
  sel.value = 'ryzen_7950x_96gb';
  applyProfile('ryzen_7950x_96gb');
}

function applyProfile(id) {
  const p = PROFILES[id];
  if (!p) return;
  currentProfile = { ...p };
  document.getElementById('profile-editor').classList.toggle('visible', id === 'custom');
  if (id === 'custom') {
    // Read custom values from editor
    updateCustomProfile();
  }
  evaluate();
  renderCommand();
  saveState();
}

function updateCustomProfile() {
  if (!currentProfile) currentProfile = {};
  currentProfile.cores = +document.getElementById('pe-cores').value || 16;
  currentProfile.threads = +document.getElementById('pe-threads').value || 32;
  currentProfile.ccdCount = +document.getElementById('pe-ccds').value || 1;
  currentProfile.totalRamGb = +document.getElementById('pe-ram').value || 64;
  currentProfile.ssdReadGbps = +document.getElementById('pe-ssd').value || 3.0;
  currentProfile.ramBandwidthGbps = +document.getElementById('pe-bandwidth').value || 50;
  evaluate();
  renderCommand();
}

// ============================================================
// === PRESETS ===
// ============================================================
function initPresets() {
  const sel = document.getElementById('sel-preset');
  const presets = window.IKLLamaEvidenceLayer?.listStandardPresets?.(currentLang) || [];
  sel.innerHTML = '<option value="">-- ' + t('preset_header') + ' --</option>';
  for (const preset of presets) {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.titleText + ' \u2014 ' + preset.description;
    sel.appendChild(opt);
  }
}

function applyPreset(id) {
  if (!id) return;
  const preset = window.IKLLamaEvidenceLayer?.getStandardPreset?.(id);
  if (!preset) return;
  suppressUpdate = true;
  for (const [k, v] of Object.entries(preset.values)) {
    state[k] = v;
  }
  suppressUpdate = false;
  syncAllToDOM();
  evaluate();
  renderCommand();
  saveState();
  updateInteractionPanels();
  // Reset preset selector
  document.getElementById('sel-preset').value = '';
  toast(currentLang === 'ru' ? 'Пресет применён!' : 'Preset applied!');
}

// ============================================================
// === i18n ===
// ============================================================
function t(key) {
  return (LANG[currentLang] && LANG[currentLang][key]) || key;
}

function setLang(lang) {
  currentLang = lang;
  setCurrentLang(lang); // sync module i18n state
  document.getElementById('btn-lang-ru').classList.toggle('active', lang === 'ru');
  document.getElementById('btn-lang-en').classList.toggle('active', lang === 'en');
  document.documentElement.lang = lang;
  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (LANG[lang][key]) el.textContent = LANG[lang][key];
  });
  initPresets();
  renderExperimentalPresetPicker();
  renderExperimentalPresetHint();
  evaluate();
  renderCommand();
  saveState();
  document.dispatchEvent(new CustomEvent('dashboard:lang-changed', {
    detail: { lang: currentLang }
  }));
}

// ============================================================
// === PERSISTENCE ===
// ============================================================
function saveState() {
  try {
    const data = {
      state: { ...state },
      lang: currentLang,
      profileId: document.getElementById('sel-profile').value,
      customProfile: document.getElementById('sel-profile').value === 'custom' ? {
        cores: +document.getElementById('pe-cores').value,
        threads: +document.getElementById('pe-threads').value,
        ccdCount: +document.getElementById('pe-ccds').value,
        totalRamGb: +document.getElementById('pe-ram').value,
        ssdReadGbps: +document.getElementById('pe-ssd').value,
        ramBandwidthGbps: +document.getElementById('pe-bandwidth').value,
      } : null,
    };
    localStorage.setItem('ik_llama_dashboard', JSON.stringify(data));
  } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('ik_llama_dashboard');
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.lang) currentLang = data.lang;
    if (data.state) {
      suppressUpdate = true;
      for (const [k, v] of Object.entries(data.state)) {
        if (k in DEFAULTS) state[k] = v;
      }
      if (typeof state.repack_tensors === 'boolean') {
        state.repack_tensors = state.repack_tensors ? 'on' : 'off';
      }
      suppressUpdate = false;
    }
    if (data.profileId) {
      document.getElementById('sel-profile').value = data.profileId;
      if (data.profileId === 'custom' && data.customProfile) {
        if (data.customProfile.cores) document.getElementById('pe-cores').value = data.customProfile.cores;
        if (data.customProfile.threads) document.getElementById('pe-threads').value = data.customProfile.threads;
        if (data.customProfile.ccdCount) document.getElementById('pe-ccds').value = data.customProfile.ccdCount;
        if (data.customProfile.totalRamGb) document.getElementById('pe-ram').value = data.customProfile.totalRamGb;
        if (data.customProfile.ssdReadGbps) document.getElementById('pe-ssd').value = data.customProfile.ssdReadGbps;
        if (data.customProfile.ramBandwidthGbps) document.getElementById('pe-bandwidth').value = data.customProfile.ramBandwidthGbps;
      }
      applyProfile(data.profileId);
    }
    return true;
  } catch(e) { return false; }
}

// ============================================================
// === EXPORT / IMPORT ===
// ============================================================
function exportConfig() {
  const config = {
    version: 1,
    timestamp: new Date().toISOString(),
    profile: document.getElementById('sel-profile').value,
    params: {},
  };
  for (const [k, v] of Object.entries(state)) {
    if (v !== DEFAULTS[k]) config.params[k] = v;
  }
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ik_llama_config.json';
  a.click();
  URL.revokeObjectURL(url);
  toast(t('toast_exported'));
}

function importConfig(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const config = JSON.parse(e.target.result);
      if (config.params) {
        suppressUpdate = true;
        // Reset to defaults first
        for (const [k, v] of Object.entries(DEFAULTS)) state[k] = v;
        // Apply imported values
        for (const [k, v] of Object.entries(config.params)) {
          if (k in DEFAULTS) state[k] = v;
        }
        if (typeof state.repack_tensors === 'boolean') {
          state.repack_tensors = state.repack_tensors ? 'on' : 'off';
        }
        suppressUpdate = false;
        syncAllToDOM();
        evaluate();
        renderCommand();
        saveState();
        updateInteractionPanels();
        toast(t('toast_imported'));
      }
    } catch(err) {
      toast('Error: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // reset file input
}

function resetAll() {
  suppressUpdate = true;
  for (const [k, v] of Object.entries(DEFAULTS)) state[k] = v;
  suppressUpdate = false;
  syncAllToDOM();
  evaluate();
  renderCommand();
  saveState();
  updateInteractionPanels();
  toast(t('toast_reset'));
}

// ============================================================
// === CLIPBOARD ===
// ============================================================
function copyCommand() {
  const text = document.getElementById('command-output').textContent;
  navigator.clipboard.writeText(text).then(() => {
    toast(t('toast_copied'));
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast(t('toast_copied'));
  });
}

// ============================================================
// === TOAST ===
// ============================================================
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ============================================================
// === SERVER API INTEGRATION ===
// ============================================================
const API_BASE = window.location.origin;
let serverConnected = false;
let serverInfo = null;
let outputPollTimer = null;
let statusPollTimer = null;
let lastOutputOffset = 0;
let pollInFlight = false;

async function apiGet(path) {
  const r = await fetch(API_BASE + path);
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function checkServer() {
  try {
    serverInfo = await apiGet('/api/system-info');
    serverConnected = true;
    document.getElementById('server-dot').className = 'status-dot connected';
    document.getElementById('server-status-text').textContent = t('srv_online');
    // Show system info
    const info = [];
    if (serverInfo.cpu_name && serverInfo.cpu_name !== 'unknown') info.push(serverInfo.cpu_name);
    if (serverInfo.physical_cores) info.push(serverInfo.physical_cores + ' cores');
    if (serverInfo.total_ram_gb) info.push(serverInfo.total_ram_gb + ' GB RAM');
    if (serverInfo.os) info.push(serverInfo.os);
    document.getElementById('sys-info').textContent = info.join(' | ');
    // Auto-populate profile RAM if available
    if (serverInfo.total_ram_gb && currentProfile) {
      const peRam = document.getElementById('pe-ram');
      if (peRam && document.getElementById('sel-profile').value === 'custom') {
        peRam.value = serverInfo.total_ram_gb;
        updateCustomProfile();
      }
    }
    // Adapt shell dropdown to server OS
    adaptShellForOS(serverInfo.os);
    // Enable launch button
    document.getElementById('btn-launch').style.opacity = '1';
    // Check if process is already running
    await checkProcessStatus();
    evaluate();
  } catch(e) {
    serverConnected = false;
    document.getElementById('server-dot').className = 'status-dot disconnected';
    document.getElementById('server-status-text').textContent = t('srv_offline');
    document.getElementById('sys-info').textContent = '';
    document.getElementById('btn-launch').style.opacity = '0.4';
    evaluate();
  }
}

function adaptShellForOS(osName) {
  const sel = document.getElementById('sel-shell');
  if (!sel) return;
  if (osName === 'Linux' || osName === 'Darwin') {
    // On Linux/macOS: default to Bash, hide PowerShell option
    for (const opt of sel.options) {
      if (opt.value === 'powershell') opt.style.display = 'none';
    }
    if (state.shell === 'powershell') {
      S.shell = 'bash';
      sel.value = 'bash';
    }
    // Rename "Bash / CMD" to just "Bash"
    for (const opt of sel.options) {
      if (opt.value === 'bash') opt.textContent = 'Bash';
    }
  } else {
    // On Windows: show all options
    for (const opt of sel.options) {
      opt.style.display = '';
    }
  }
}

// Model path input — auto-detect file size via server
let fileInfoTimer = null;
function onModelPathInput(value) {
  S.model = value;
  clearTimeout(fileInfoTimer);
  if (!serverConnected || !value.trim()) {
    document.getElementById('auto-size-label').textContent = '';
    return;
  }
  fileInfoTimer = setTimeout(async () => {
    try {
      const info = await apiPost('/api/file-info', { path: value.trim() });
      if (info.size_gb && !info.error) {
        applyFileInfo(info);
      } else if (info.error) {
        document.getElementById('auto-size-label').textContent = '';
      }
    } catch(e) {}
  }, 500);
}

// ============================================================
// === AUTO-CONFIGURATION ENGINE ===
// ============================================================
let lastModelMeta = null;

async function autoConfigureFromModel() {
  if (!serverConnected) { toast(t('srv_offline')); return; }
  const modelPath = state.model.trim();
  if (!modelPath) { toast(t('auto_no_model')); return; }

  const btn = document.getElementById('btn-auto');
  btn.disabled = true;
  btn.textContent = '...';

  try {
    // 1. Get file info (size + split detection)
    const fileInfo = await apiPost('/api/file-info', { path: modelPath });
    if (fileInfo && !fileInfo.error) {
      applyFileInfo(fileInfo);
    }

    // 2. Read GGUF metadata
    toast(t('auto_reading'));
    const metaResult = await apiPost('/api/model-meta', { path: modelPath });
    if (metaResult.error) {
      toast('Metadata error: ' + metaResult.error);
      btn.disabled = false;
      btn.textContent = t('btn_auto');
      return;
    }
    lastModelMeta = metaResult.info;

    // 3. Compute optimal parameters
    const profile = currentProfile || { totalRamGb: 96, cores: 16, ccdCount: 2 };
    const computed = computeOptimalParams(lastModelMeta, state.model_size_gb, profile, state, currentLang);

    // 4. Apply
    suppressUpdate = true;
    for (const [k, v] of Object.entries(computed.params)) {
      state[k] = v;
    }
    suppressUpdate = false;
    syncAllToDOM();
    evaluate();
    renderCommand();
    saveState();

    // 5. Show summary
    showAutoConfigSummary(computed);
    toast(t('auto_applied'));
  } catch(e) {
    toast('Auto-config error: ' + e.message);
  }

  btn.disabled = false;
  btn.textContent = t('btn_auto');
}


function showAutoConfigSummary(computed) {
  const s = computed.summary;
  const reasons = computed.reasons;
  const area = document.getElementById('warnings-area');

  // Add auto-config summary as a special banner at the top
  const existing = document.getElementById('auto-config-summary');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'auto-config-summary';
  div.className = 'warning-banner info';
  div.style.borderLeftColor = 'var(--accent)';
  div.style.background = 'rgba(108,158,255,0.08)';

  const isRu = currentLang === 'ru';
  let html = '<span class="warning-icon">&#9881;&#65039;</span><span class="warning-text">';
  html += `<b>${isRu ? 'Авто-конфигурация' : 'Auto-configured'}:</b> `;
  html += `${s.model_name || s.architecture} `;
  html += s.is_moe
    ? `(MoE ${s.expert_count}x${s.expert_used})`
    : '(Dense)';
  html += ` &mdash; ${s.model_size_gb} ${isRu ? 'ГБ' : 'GB'}`;
  if (s.is_swap_bound) {
    html += ` <b style="color:var(--warning)">[swap-bound]</b>`;
  } else {
    html += ` <b style="color:var(--success)">[in-RAM]</b>`;
  }
  html += '<br>';
  for (const r of reasons) {
    html += `<span style="color:var(--text-muted)">• ${isRu ? r.ru : r.en}</span><br>`;
  }
  html += '</span>';
  div.innerHTML = html;
  area.insertBefore(div, area.firstChild);
}

// Apply file info from server (handles split models)
function applyFileInfo(info) {
  if (!info || info.error) return;
  S.model_size_gb = info.size_gb;
  document.getElementById('p-model_size_gb').value = info.size_gb;

  let lbl = '';
  if (info.split && info.split.is_split) {
    const sp = info.split;
    const foundStr = sp.all_found
      ? `${sp.total_parts}/${sp.total_parts}`
      : `${sp.found_parts}/${sp.total_parts}`;
    lbl = currentLang === 'ru'
      ? `(split: ${foundStr} частей, итого ${sp.total_size_gb} ГБ)`
      : `(split: ${foundStr} parts, total ${sp.total_size_gb} GB)`;
    if (!sp.all_found) {
      const missing = sp.parts.filter(p => p.missing).map(p => p.name);
      lbl += currentLang === 'ru'
        ? ` — не найдены: ${missing.join(', ')}`
        : ` — missing: ${missing.join(', ')}`;
    }
  } else {
    lbl = currentLang === 'ru'
      ? `(авто: ${info.size_gb} ГБ — ${info.name})`
      : `(auto: ${info.size_gb} GB — ${info.name})`;
  }
  document.getElementById('auto-size-label').textContent = lbl;
  evaluate();
  renderCommand();
}

// Browse for model file via native OS dialog
async function browseModelFile() {
  if (!serverConnected) {
    toast(t('srv_offline'));
    return;
  }
  // Use current model path's directory as initial dir
  let initDir = '';
  const cur = state.model.trim();
  if (cur) {
    initDir = cur.replace(/[\\/][^\\/]+$/, '');
  }
  try {
    const btn = document.getElementById('btn-browse');
    btn.disabled = true;
    btn.textContent = '...';
    const result = await apiPost('/api/browse', { initial_dir: initDir });
    btn.disabled = false;
    btn.innerHTML = '&#128194;';
    if (result.cancelled) return;
    if (result.error) { toast(result.error); return; }
    if (result.path) {
      document.getElementById('p-model').value = result.path;
      S.model = result.path;
      applyFileInfo(result);
      document.getElementById('model-browser').classList.remove('visible');
    }
  } catch(e) {
    document.getElementById('btn-browse').disabled = false;
    document.getElementById('btn-browse').innerHTML = '&#128194;';
    toast('Browse error: ' + e.message);
  }
}

// Scan models directory
async function scanModelsFromPath() {
  if (!serverConnected) {
    toast(t('srv_offline'));
    return;
  }
  let path = state.model.trim();
  if (!path) {
    toast(t('scan_no_path'));
    return;
  }
  // If path looks like a file, use its parent directory
  if (path.match(/\.(gguf|bin)$/i)) {
    path = path.replace(/[\\/][^\\/]+$/, '');
  }
  try {
    const result = await apiPost('/api/scan-models', { directory: path, max_depth: 2 });
    const browser = document.getElementById('model-browser');
    browser.innerHTML = '';
    if (result.error) {
      toast(result.error);
      browser.classList.remove('visible');
      return;
    }
    if (!result.models || result.models.length === 0) {
      toast(t('scan_empty'));
      browser.classList.remove('visible');
      return;
    }
    for (const m of result.models) {
      const div = document.createElement('div');
      div.className = 'model-item';
      div.innerHTML = `<span class="model-name">${escHtml(m.name)}</span><span class="model-size">${m.size_gb} GB</span>`;
      div.onclick = () => selectScannedModel(m);
      browser.appendChild(div);
    }
    browser.classList.add('visible');
  } catch(e) {
    toast('Scan error: ' + e.message);
  }
}

async function selectScannedModel(m) {
  document.getElementById('p-model').value = m.path;
  S.model = m.path;
  document.getElementById('model-browser').classList.remove('visible');
  // Re-query file-info for full split detection
  if (serverConnected) {
    try {
      const info = await apiPost('/api/file-info', { path: m.path });
      if (info && !info.error) { applyFileInfo(info); return; }
    } catch(e) {}
  }
  // Fallback: use scan size
  S.model_size_gb = m.size_gb;
  document.getElementById('p-model_size_gb').value = m.size_gb;
  document.getElementById('auto-size-label').textContent = '';
  evaluate();
  renderCommand();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Launch process
async function launchProcess() {
  if (!state.model) {
    toast(t('launch_no_model'));
    return;
  }
  if (!serverConnected) {
    toast(t('srv_offline'));
    return;
  }
  // Build args array from current state
  const args = buildArgsArray();
  const isCli = state.target === 'llama-cli';
  try {
    const result = await apiPost('/api/launch', { args, terminal: isCli });
    if (result.ok) {
      toast(result.message);
      setWorkspacePane('runtime');
      autoConfigureRuntimePanels(true);
      resetModelLoadProgress();
      clearProcOutput();
      clearChat();
      clearCliTerminal();
      setChatReady(false);
      applyRuntimePanels();
      startOutputPolling();
      if (isCli) {
        // CLI terminal mode: show log message that interactive session is in external terminal
        appendCliLine(t('cli_ext_session'), 'system');
      }
    } else {
      toast(result.message || result.error);
    }
  } catch(e) {
    toast('Launch error: ' + e.message);
  }
}

function buildArgsArray() {
  return _buildArgsArray(state);
}

async function stopProcess() {
  if (!serverConnected) return;
  try {
    const result = await apiPost('/api/stop', {});
    toast(result.message);
    stopOutputPolling();
    chatStreaming = false;
    await checkProcessStatus();
  } catch(e) {
    toast('Stop error: ' + e.message);
  }
}

function showProcessPanel(show) {
  runtimePanels.process = !!show;
  applyRuntimePanels();
}

function startOutputPolling() {
  lastOutputOffset = 0;
  stopOutputPolling();
  pollOutput();
  outputPollTimer = setInterval(pollOutput, 800);
  statusPollTimer = setInterval(checkProcessStatus, 2000);
}

function stopOutputPolling() {
  clearInterval(outputPollTimer);
  clearInterval(statusPollTimer);
  outputPollTimer = null;
  statusPollTimer = null;
}

// ── Loading progress tracking ──
const modelLoadProgress = {
  phase: 'idle',  // idle | loading_meta | loading_tensors | init_context | ready | error
  pct: 0,
  detail: '',
  dotCount: 0,
  totalTensors: 0,
  loadedTensors: 0,
  startTime: 0,
};

function resetModelLoadProgress() {
  modelLoadProgress.phase = 'idle';
  modelLoadProgress.pct = 0;
  modelLoadProgress.detail = '';
  modelLoadProgress.dotCount = 0;
  modelLoadProgress.totalTensors = 0;
  modelLoadProgress.loadedTensors = 0;
  modelLoadProgress.startTime = Date.now();
}

function parseOutputForProgress(line) {
  // Model metadata loaded
  if (/llama_model_load:.*loaded meta data/i.test(line)) {
    const m = line.match(/(\d+)\s+tensors/);
    if (m) modelLoadProgress.totalTensors = parseInt(m[1]);
    modelLoadProgress.phase = 'loading_meta';
    modelLoadProgress.pct = 5;
    modelLoadProgress.detail = line.trim();
  }
  // Tensor loading started
  else if (/llm_load_tensors:/i.test(line) && /loading/i.test(line)) {
    modelLoadProgress.phase = 'loading_tensors';
    modelLoadProgress.pct = 10;
    modelLoadProgress.detail = line.trim();
  }
  // Buffer size info (indicates progress through tensor loading)
  else if (/buffer size\s*=/i.test(line) || /CPU_Mapped buffer/i.test(line)) {
    modelLoadProgress.phase = 'loading_tensors';
    if (modelLoadProgress.pct < 50) modelLoadProgress.pct = Math.min(modelLoadProgress.pct + 10, 50);
    modelLoadProgress.detail = line.trim();
  }
  // Progress dots (llama.cpp outputs dots during loading: "......")
  else if (/^\.*\.{3,}/.test(line.trim())) {
    modelLoadProgress.dotCount += line.trim().length;
    if (modelLoadProgress.totalTensors > 0) {
      // Rough estimate: dots ~ tensors loaded
      modelLoadProgress.pct = Math.min(10 + Math.round((modelLoadProgress.dotCount / modelLoadProgress.totalTensors) * 80), 90);
    } else {
      modelLoadProgress.pct = Math.min(modelLoadProgress.pct + 5, 85);
    }
    modelLoadProgress.phase = 'loading_tensors';
  }
  // Percentage in output (some builds output "XX%")
  else if (/(\d{1,3})\s*%/.test(line)) {
    const m = line.match(/(\d{1,3})\s*%/);
    if (m) {
      const p = parseInt(m[1]);
      if (p > 0 && p <= 100) {
        modelLoadProgress.pct = p;
        modelLoadProgress.phase = 'loading_tensors';
      }
    }
  }
  // Context init
  else if (/llama_new_context_with_model/i.test(line)) {
    modelLoadProgress.phase = 'init_context';
    modelLoadProgress.pct = 92;
    modelLoadProgress.detail = line.trim();
  }
  // KV cache allocated
  else if (/KV.*cache.*type/i.test(line) || /kv_self/i.test(line)) {
    if (modelLoadProgress.phase === 'init_context') {
      modelLoadProgress.pct = 95;
    }
  }
  // rtr repack
  else if (/repacking tensors/i.test(line) || /repack/i.test(line) && /runtime/i.test(line)) {
    modelLoadProgress.phase = 'init_context';
    modelLoadProgress.pct = 85;
    modelLoadProgress.detail = currentLang === 'ru' ? 'Перепаковка тензоров (rtr)...' : 'Repacking tensors (rtr)...';
  }
  // VirtualLock / swap-bound init
  else if (/VirtualLock|mlock.*shared|locking.*tensor/i.test(line)) {
    modelLoadProgress.pct = Math.max(modelLoadProgress.pct, 90);
    modelLoadProgress.detail = line.trim();
  }
  // Ready — interactive mode or server slots
  else if (/interactive mode|all slots are idle|server listening|waiting for/i.test(line)) {
    modelLoadProgress.phase = 'ready';
    modelLoadProgress.pct = 100;
    modelLoadProgress.detail = '';
    setChatReady(true);
  }
  // Error detection
  else if (/error:|failed|abort|GGML_ASSERT/i.test(line) && !/error_bg/i.test(line)) {
    modelLoadProgress.phase = 'error';
    modelLoadProgress.detail = line.trim();
  }
  // Init from model (early loading phase)
  else if (/llama_init_from_model/i.test(line)) {
    modelLoadProgress.phase = 'loading_tensors';
    if (modelLoadProgress.pct < 10) modelLoadProgress.pct = 10;
  }
  // Warm up phase
  else if (/warm up/i.test(line) || /warming/i.test(line)) {
    modelLoadProgress.pct = 97;
    modelLoadProgress.detail = currentLang === 'ru' ? 'Прогрев...' : 'Warming up...';
  }
}

function updateLoadProgressUI() {
  const container = document.getElementById('load-progress');
  const phaseEl = document.getElementById('load-phase');
  const pctEl = document.getElementById('load-pct');
  const fillEl = document.getElementById('load-bar-fill');
  const detailEl = document.getElementById('load-detail');

  if (!container) return;

  const isRu = currentLang === 'ru';

  if (modelLoadProgress.phase === 'idle') {
    container.classList.remove('active');
    return;
  }

  container.classList.add('active');

  // Phase text
  const phaseTexts = {
    loading_meta:    isRu ? 'Загрузка метаданных модели...' : 'Loading model metadata...',
    loading_tensors: isRu ? 'Загрузка тензоров...' : 'Loading tensors...',
    init_context:    isRu ? 'Инициализация контекста...' : 'Initializing context...',
    ready:           isRu ? 'Модель загружена' : 'Model loaded',
    error:           isRu ? 'Ошибка' : 'Error',
  };
  phaseEl.textContent = phaseTexts[modelLoadProgress.phase] || '';

  // Percentage
  if (modelLoadProgress.pct > 0) {
    pctEl.textContent = modelLoadProgress.pct + '%';
    fillEl.style.width = modelLoadProgress.pct + '%';
    fillEl.classList.remove('indeterminate');
  } else {
    pctEl.textContent = '';
    fillEl.classList.add('indeterminate');
  }

  // Done state
  if (modelLoadProgress.phase === 'ready') {
    fillEl.classList.add('done');
    fillEl.style.width = '100%';
    pctEl.textContent = '100%';
    const elapsed = ((Date.now() - modelLoadProgress.startTime) / 1000).toFixed(1);
    detailEl.textContent = (isRu ? 'Загружено за ' : 'Loaded in ') + elapsed + 's';
    // Auto-hide after 5s
    setTimeout(() => {
      container.classList.remove('active');
    }, 5000);
  } else if (modelLoadProgress.phase === 'error') {
    fillEl.style.width = modelLoadProgress.pct + '%';
    fillEl.style.background = 'var(--error)';
    detailEl.textContent = modelLoadProgress.detail;
  } else {
    fillEl.classList.remove('done');
    fillEl.style.background = '';
    // Elapsed time
    const elapsed = ((Date.now() - modelLoadProgress.startTime) / 1000).toFixed(0);
    const elapsedStr = elapsed + 's';
    detailEl.textContent = modelLoadProgress.detail ? modelLoadProgress.detail.substring(0, 80) : elapsedStr;
  }
}

async function pollOutput() {
  if (!serverConnected || pollInFlight) return;
  pollInFlight = true;
  try {
    const data = await apiGet('/api/output?offset=' + lastOutputOffset);
    if (data.lines && data.lines.length > 0) {
      const el = document.getElementById('proc-output');
      for (const line of data.lines) {
        parseOutputForProgress(line);
      }
      el.textContent += data.lines.join('\n') + '\n';
      lastOutputOffset += data.lines.length;
      el.scrollTop = el.scrollHeight;
      updateLoadProgressUI();

      // Feed loading logs into the console panel (visible for both modes)
      for (const line of data.lines) {
        if (line.trim()) {
          appendCliLine(line, 'output');
        }
      }
    }
  } catch(e) {}
  pollInFlight = false;
}

async function checkProcessStatus() {
  if (!serverConnected) return;
  try {
    const s = await apiGet('/api/status');
    const statusEl = document.getElementById('proc-status');
    const uptimeEl = document.getElementById('proc-uptime');
    const btnLaunch = document.getElementById('btn-launch');
    const btnStop = document.getElementById('btn-stop');
    const btnStop2 = document.getElementById('btn-stop2');

    if (s.running) {
      statusEl.className = 'proc-status running';
      // Show phase-aware status text
      if (modelLoadProgress.phase && modelLoadProgress.phase !== 'idle' && modelLoadProgress.phase !== 'ready') {
        const isRu = currentLang === 'ru';
        const loadingText = isRu ? 'загрузка ' + modelLoadProgress.pct + '%' : 'loading ' + modelLoadProgress.pct + '%';
        statusEl.textContent = loadingText;
        statusEl.className = 'proc-status loading';
      } else {
        statusEl.textContent = t('proc_running');
        // If phase is ready, ensure chat is enabled
        if (modelLoadProgress.phase === 'ready' && !interactionReady) {
          setChatReady(true);
        }
      }
      uptimeEl.textContent = s.uptime_s ? formatUptime(s.uptime_s) : '';
      btnLaunch.classList.add('hidden');
      btnStop.classList.remove('hidden');
      if (btnStop2) btnStop2.classList.remove('hidden');
      showProcessPanel(true);
      if (!outputPollTimer) startOutputPolling();
    } else {
      statusEl.className = 'proc-status ' + (s.exit_code !== null ? 'stopped' : 'idle');
      statusEl.textContent = s.exit_code !== null
        ? t('proc_stopped') + ' (exit ' + s.exit_code + ')'
        : t('proc_idle');
      uptimeEl.textContent = '';
      btnLaunch.classList.remove('hidden');
      btnStop.classList.add('hidden');
      if (btnStop2) btnStop2.classList.add('hidden');
      // Reset load state and chat when process stops
      if (modelLoadProgress.phase !== 'idle') {
        modelLoadProgress.phase = 'idle';
        updateLoadProgressUI();
      }
      setChatReady(false);
      if (outputPollTimer) {
        await pollOutput();
        stopOutputPolling();
      }
    }
    evaluate();
  } catch(e) {}
}

function formatUptime(s) {
  if (s < 60) return Math.round(s) + 's';
  if (s < 3600) return Math.floor(s/60) + 'm ' + Math.round(s%60) + 's';
  return Math.floor(s/3600) + 'h ' + Math.floor((s%3600)/60) + 'm';
}

function clearProcOutput() {
  document.getElementById('proc-output').textContent = '';
  lastOutputOffset = 0;
}

// ============================================================
// === EXTENDED HELP SYSTEM ===
// ============================================================
function toggleHelp(paramId) {
  const pop = document.getElementById('help-pop-' + paramId);
  if (!pop) return;
  const isOpen = pop.classList.contains('open');
  // Close all open popovers
  document.querySelectorAll('.help-popover.open').forEach(p => p.classList.remove('open'));
  if (!isOpen) {
    // Update content for current language
    const content = HELP[paramId];
    if (content) {
      pop.innerHTML = content[currentLang] || content.en || '';
    }
    pop.classList.add('open');
  }
}

function injectHelpButtons() {
  // For every param that has help content, inject ? button and popover div
  for (const paramId of Object.keys(HELP)) {
    // Find param-desc with matching data-i18n
    // Try multiple strategies to find the right param-row
    let row = null;

    // Strategy 1: find by toggle id
    const tog = document.getElementById('tog-' + paramId);
    if (tog) row = tog.closest('.param-row');

    // Strategy 2: find by input id
    if (!row) {
      const inp = document.getElementById('p-' + paramId);
      if (inp) row = inp.closest('.param-row');
    }

    // Strategy 3: find by dot id
    if (!row) {
      const dot = document.getElementById('dot-' + paramId);
      if (dot) row = dot.closest('.param-row');
    }

    // Strategy 4: for "ser", find by toggle ser_enabled
    if (!row && paramId === 'ser') {
      const tog2 = document.getElementById('tog-ser_enabled');
      if (tog2) row = tog2.closest('.param-row');
    }

    if (!row) continue;

    // Check if already injected
    if (row.querySelector('.help-btn')) continue;

    // Inject ? button into param-label
    const label = row.querySelector('.param-label');
    if (label) {
      const btn = document.createElement('button');
      btn.className = 'help-btn';
      btn.textContent = '?';
      btn.onclick = (e) => { e.stopPropagation(); toggleHelp(paramId); };
      label.appendChild(btn);
    }

    // Inject popover div at end of row
    const pop = document.createElement('div');
    pop.className = 'help-popover';
    pop.id = 'help-pop-' + paramId;
    row.appendChild(pop);
  }
}

// ============================================================
// === GLOSSARY ===
// ============================================================
function toggleGlossary() {
  const overlay = document.getElementById('glossary-overlay');
  const isOpen = overlay.classList.contains('open');
  if (isOpen) {
    overlay.classList.remove('open');
  } else {
    renderGlossary('');
    overlay.classList.add('open');
    document.getElementById('glossary-filter').value = '';
    document.getElementById('glossary-filter').focus();
    document.getElementById('glossary-title').textContent = t('glossary_title');
    document.getElementById('glossary-filter').placeholder = t('glossary_search');
  }
}

function renderGlossary(filter) {
  const body = document.getElementById('glossary-body');
  const lang = currentLang;
  const f = filter.toLowerCase();
  let html = '';
  let currentCat = '';

  for (const item of GLOSSARY) {
    // Category header
    if (item.cat) {
      const catText = item.cat[lang] || item.cat.en;
      if (f && !catText.toLowerCase().includes(f)
          && !(item.term[lang]||'').toLowerCase().includes(f)
          && !(item.def[lang]||'').toLowerCase().includes(f)) {
        // Check if any item in this category matches
        // (we'll handle this by just not filtering categories)
      }
      currentCat = catText;
    }

    const term = item.term[lang] || item.term.en;
    const def = item.def[lang] || item.def.en;

    // Filter
    if (f && !term.toLowerCase().includes(f) && !def.toLowerCase().replace(/<[^>]*>/g,'').toLowerCase().includes(f)) {
      continue;
    }

    // Render category if changed
    if (currentCat) {
      html += `<div class="glossary-category">${currentCat}</div>`;
      currentCat = ''; // Only render once
    }

    html += `<div class="glossary-item">
      <div class="glossary-term">${term}</div>
      <div class="glossary-def">${def}</div>
    </div>`;
  }

  if (!html) {
    html = `<div style="text-align:center;color:var(--text-muted);padding:20px;">${lang === 'ru' ? 'Ничего не найдено' : 'Nothing found'}</div>`;
  }
  body.innerHTML = html;
}

function filterGlossary(value) {
  renderGlossary(value);
}

// ============================================================
// === INTERACTION PANELS (CLI Terminal + Server Chat) ===
// ============================================================

let interactionReady = false;
let workspaceRailCollapsed = false;
let runtimeSideCollapsed = false;
const runtimePanels = {
  cli: true,
  chat: true,
  process: true,
};

function autoConfigureRuntimePanels(force = false) {
  const isCli = state.target === 'llama-cli';
  const next = isCli
    ? { cli: true, chat: false, process: false }
    : { cli: false, chat: true, process: true };
  if (force || !interactionReady) {
    runtimePanels.cli = next.cli;
    runtimePanels.chat = next.chat;
    runtimePanels.process = next.process;
  }
}

function updateRuntimeDock() {
  const isCli = state.target === 'llama-cli';
  const modeVisibility = { cli: true, chat: !isCli, process: !isCli };
  const map = {
    cli: document.getElementById('runtime-dock-cli'),
    chat: document.getElementById('runtime-dock-chat'),
    process: document.getElementById('runtime-dock-process'),
  };
  for (const [key, btn] of Object.entries(map)) {
    if (!btn) continue;
    btn.classList.toggle('active', !!runtimePanels[key] && !!modeVisibility[key]);
    btn.classList.toggle('hidden-by-mode', !modeVisibility[key]);
    btn.disabled = !modeVisibility[key];
  }
  const collapseBtn = document.getElementById('runtime-dock-collapse');
  if (collapseBtn) {
    collapseBtn.textContent = t(runtimeSideCollapsed ? 'runtime_dock_show_side' : 'runtime_dock_hide_side');
  }
}

function syncRuntimeSideLayout() {
  const grid = document.querySelector('.dash-runtime-grid');
  if (!grid) return;
  grid.classList.toggle('side-collapsed', !!runtimeSideCollapsed);
}

function applyRuntimePanels() {
  const isCli = state.target === 'llama-cli';
  const cliEl = document.getElementById('cli-terminal');
  const chatEl = document.getElementById('chat-panel');
  const processEl = document.getElementById('process-panel');
  if (cliEl) cliEl.classList.toggle('active', !!runtimePanels.cli);
  if (chatEl) chatEl.classList.toggle('active', !isCli && !!runtimePanels.chat);
  if (processEl) processEl.classList.toggle('visible', !isCli && !!runtimePanels.process);
  syncRuntimeSideLayout();
  updateRuntimeDock();
}

function toggleRuntimePanel(name) {
  if (!(name in runtimePanels)) return;
  const isCli = state.target === 'llama-cli';
  if (isCli && (name === 'chat' || name === 'process')) return;
  runtimePanels[name] = !runtimePanels[name];
  applyRuntimePanels();
}

function toggleRuntimeSide(force) {
  runtimeSideCollapsed = typeof force === 'boolean' ? force : !runtimeSideCollapsed;
  localStorage.setItem('ik_dash_runtime_side_collapsed', runtimeSideCollapsed ? '1' : '0');
  applyRuntimePanels();
}

function updateInteractionPanels() {
  const isCli = state.target === 'llama-cli';
  autoConfigureRuntimePanels();
  applyRuntimePanels();

  // Update terminal label based on mode
  const termLabel = document.querySelector('#cli-terminal .terminal-label');
  if (termLabel) {
    if (isCli) {
      termLabel.textContent = t('cli_terminal_label');
    } else {
      termLabel.textContent = t('console_label');
    }
  }

  // Hide input line — console is always a log viewer
  const cliInputLine = document.querySelector('#cli-terminal .cli-input-line');
  if (cliInputLine) {
    cliInputLine.style.display = 'none';
  }
}

function setChatReady(ready) {
  if (ready && interactionReady) return;  // Already in desired state, avoid duplicate messages
  interactionReady = ready;
  const isCli = state.target === 'llama-cli';

  // Console is always a log viewer — show status messages there
  if (ready && isCli) {
    appendCliLine(t('cli_ext_ready'), 'system');
  }

  // Server chat input controls
  const sendBtn = document.getElementById('chat-send');
  const isServer = state.target === 'llama-server';
  if (sendBtn) sendBtn.disabled = !(ready && isServer) || chatStreaming;
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.disabled = !(ready && isServer);
    chatInput.placeholder = ready
      ? t('chat_placeholder_ready')
      : t('chat_placeholder_waiting');
  }
}


// ────────────────────────────────────────────
// ── CLI TERMINAL (llama-cli mode) ──
// ────────────────────────────────────────────
const cliHistory = [];
let cliHistoryIdx = -1;
let chatStreaming = false;

function appendCliLine(text, type) {
  const output = document.getElementById('cli-output');
  if (!output) return;
  // Hide welcome
  const welcome = document.getElementById('cli-welcome');
  if (welcome) welcome.style.display = 'none';

  const line = document.createElement('span');
  line.className = 'cli-line ' + (type || 'output');
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

function clearCliTerminal() {
  const output = document.getElementById('cli-output');
  if (!output) return;
  const isCli = state.target === 'llama-cli';
  const welcomeText = isCli ? t('cli_welcome') : t('console_label');
  output.innerHTML = `<span class="cli-line system" id="cli-welcome" data-i18n="cli_welcome">${welcomeText}</span>`;
}

function cliKeyDown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const input = document.getElementById('cli-input');
    const text = input.value;
    if (!text.trim() || !interactionReady) return;
    input.value = '';
    cliHistory.push(text);
    cliHistoryIdx = cliHistory.length;
    sendCliInput(text);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cliHistoryIdx > 0) {
      cliHistoryIdx--;
      e.target.value = cliHistory[cliHistoryIdx];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (cliHistoryIdx < cliHistory.length - 1) {
      cliHistoryIdx++;
      e.target.value = cliHistory[cliHistoryIdx];
    } else {
      cliHistoryIdx = cliHistory.length;
      e.target.value = '';
    }
  }
}

let cliStreamingEl = null;

async function sendCliInput(text) {
  const input = document.getElementById('cli-input');

  // Show user input in terminal
  appendCliLine('> ' + text, 'input');
  input.disabled = true;
  chatStreaming = true;

  // Add to shared conversation history (used by API)
  chatMessages.push({ role: 'user', content: text });

  const port = state.port || 8080;
  const host = state.hostname || '127.0.0.1';
  const url = `http://${host}:${port}/v1/chat/completions`;

  const apiMessages = chatMessages.map(m => ({ role: m.role, content: m.content }));

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (state.api_key) headers['Authorization'] = 'Bearer ' + state.api_key;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: apiMessages, stream: true }),
    });

    if (!response.ok) {
      const err = await response.text();
      appendCliLine('[Error ' + response.status + ']: ' + err, 'error');
      chatMessages.pop(); // remove failed user message
      chatStreaming = false;
      input.disabled = false;
      input.focus();
      return;
    }

    // Stream SSE response into terminal
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';
    let visibleResponse = '';

    // Create a streaming output element
    const output = document.getElementById('cli-output');
    const welcome = document.getElementById('cli-welcome');
    if (welcome) welcome.style.display = 'none';
    cliStreamingEl = document.createElement('span');
    cliStreamingEl.className = 'cli-line output';
    output.appendChild(cliStreamingEl);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            // Strip <think>...</think> blocks for terminal display
            visibleResponse = stripThinkBlocks(fullResponse);
            cliStreamingEl.textContent = visibleResponse;
            output.scrollTop = output.scrollHeight;
          }
        } catch(e) {}
      }
    }

    // Finalize
    cliStreamingEl = null;
    chatMessages.push({ role: 'assistant', content: fullResponse, rawContent: fullResponse });

  } catch(e) {
    appendCliLine('[Connection error]: ' + e.message, 'error');
    chatMessages.pop();
  }

  chatStreaming = false;
  input.disabled = false;
  input.focus();
}

function stripThinkBlocks(text) {
  // Remove complete <think>...</think> blocks
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  // If still inside an open <think> tag, remove from <think> to end
  const openIdx = result.indexOf('<think>');
  if (openIdx !== -1) {
    result = result.substring(0, openIdx);
  }
  return result.trim();
}

// ────────────────────────────────────────────
// ── SERVER CHAT (llama-server mode) ──
// ────────────────────────────────────────────
const chatMessages = [];  // {role: 'user'|'assistant', content: string, rawContent: string}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function addChatMessage(role, content) {
  chatMessages.push({ role, content, rawContent: content });
  renderChatMessages();
}

function clearChat() {
  chatMessages.length = 0;
  chatStreaming = false;
  renderChatMessages();
}

function chatKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

// ── Thinking block parser ──
function parseThinkingContent(fullText) {
  // Returns array of segments: { type: 'text'|'thinking', content, isActive }
  const segments = [];
  let remaining = fullText;
  let hasActiveThinking = false;

  while (remaining.length > 0) {
    const thinkStart = remaining.indexOf('<think>');

    if (thinkStart === -1) {
      // No more think blocks
      if (remaining.trim()) {
        segments.push({ type: 'text', content: remaining });
      }
      break;
    }

    // Text before think block
    if (thinkStart > 0) {
      const before = remaining.substring(0, thinkStart);
      if (before.trim()) {
        segments.push({ type: 'text', content: before });
      }
    }

    const thinkEnd = remaining.indexOf('</think>', thinkStart + 7);
    if (thinkEnd === -1) {
      // Still thinking (no closing tag yet)
      const thinkContent = remaining.substring(thinkStart + 7);
      segments.push({ type: 'thinking', content: thinkContent, isActive: true });
      hasActiveThinking = true;
      break;
    }

    // Complete think block
    const thinkContent = remaining.substring(thinkStart + 7, thinkEnd);
    segments.push({ type: 'thinking', content: thinkContent, isActive: false });
    remaining = remaining.substring(thinkEnd + 8);
  }

  return { segments, hasActiveThinking };
}

function renderMessageContent(rawContent, isStreaming) {
  const { segments, hasActiveThinking } = parseThinkingContent(rawContent);

  if (segments.length === 0) {
    return isStreaming ? '<span class="think-shimmer"></span>' : '';
  }

  // If content is entirely within a thinking block (no response text yet)
  const hasTextContent = segments.some(s => s.type === 'text' && s.content.trim());

  let html = '';
  for (const seg of segments) {
    if (seg.type === 'thinking') {
      const isActive = seg.isActive;
      const label = currentLang === 'ru'
        ? (isActive ? 'Размышляет' : 'Размышление')
        : (isActive ? 'Thinking' : 'Thought');
      const shimmer = isActive ? ' <span class="think-shimmer"></span>' : '';
      // Open by default while active, collapsed when done
      html += `<details class="think-block${isActive ? ' active' : ''}"${isActive ? ' open' : ''}>`;
      html += `<summary>${label}${shimmer}</summary>`;
      html += `<div class="think-content">${escapeHtml(seg.content)}</div>`;
      html += `</details>`;
    } else {
      html += escapeHtml(seg.content);
    }
  }

  return html;
}

function renderChatMessages() {
  const el = document.getElementById('chat-messages');
  if (!el) return;

  if (chatMessages.length === 0) {
    el.innerHTML = `<div class="chat-empty" id="chat-empty" data-i18n="chat_empty">${t('chat_empty')}</div>`;
    return;
  }

  let html = '';
  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    const isLast = i === chatMessages.length - 1;
    const isStreamingMsg = isLast && chatStreaming && msg.role === 'assistant';

    if (msg.role === 'user') {
      html += `<div class="chat-msg user">${escapeHtml(msg.content)}</div>`;
    } else {
      // Assistant message with thinking support
      const rendered = renderMessageContent(msg.rawContent || msg.content, isStreamingMsg);
      html += `<div class="chat-msg assistant">${rendered}</div>`;
    }
  }
  el.innerHTML = html;
  el.scrollTop = el.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !interactionReady || chatStreaming) return;

  input.value = '';
  addChatMessage('user', text);
  await sendChatViaServer(text);
}

async function sendChatViaServer(text) {
  chatStreaming = true;
  addChatMessage('assistant', '');
  updateSendButton();

  const port = state.port || 8080;
  const host = state.hostname || '127.0.0.1';
  const url = `http://${host}:${port}/v1/chat/completions`;

  // Build messages for API (exclude the empty assistant message)
  const apiMessages = chatMessages
    .slice(0, -1)
    .filter(m => m.content)
    .map(m => ({ role: m.role, content: m.content }));

  try {
    const chatHeaders = { 'Content-Type': 'application/json' };
    if (state.api_key) chatHeaders['Authorization'] = 'Bearer ' + state.api_key;
    const response = await fetch(url, {
      method: 'POST',
      headers: chatHeaders,
      body: JSON.stringify({
        messages: apiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      chatMessages[chatMessages.length - 1].content = `[Error ${response.status}]: ${err}`;
      chatMessages[chatMessages.length - 1].rawContent = chatMessages[chatMessages.length - 1].content;
      chatStreaming = false;
      renderChatMessages();
      updateSendButton();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            const lastMsg = chatMessages[chatMessages.length - 1];
            lastMsg.rawContent = fullResponse;
            // Store content without think tags for history
            lastMsg.content = fullResponse.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || fullResponse;
            renderChatMessages();
          }
        } catch(e) {}
      }
    }

    chatStreaming = false;
    renderChatMessages();
    updateSendButton();

  } catch(e) {
    chatMessages[chatMessages.length - 1].content = `[Connection error]: ${e.message}`;
    chatMessages[chatMessages.length - 1].rawContent = chatMessages[chatMessages.length - 1].content;
    chatStreaming = false;
    renderChatMessages();
    updateSendButton();
  }
}

function updateSendButton() {
  const sendBtn = document.getElementById('chat-send');
  if (sendBtn) sendBtn.disabled = !interactionReady || chatStreaming;
}

// ============================================================
// === THEME ===
// ============================================================
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ik_dash_theme', next);
}

function restoreTheme() {
  const saved = localStorage.getItem('ik_dash_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  }
}

function syncWorkspacePane() {
  document.querySelectorAll('[data-workspace-pane-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-workspace-pane-btn') === currentWorkspacePane);
  });
  document.querySelectorAll('[data-workspace-pane]').forEach(pane => {
    pane.classList.toggle('active', pane.getAttribute('data-workspace-pane') === currentWorkspacePane);
  });
}

function syncWorkspaceRail() {
  const shell = document.getElementById('dash-workspace-shell');
  if (!shell) return;
  shell.classList.toggle('rail-collapsed', workspaceRailCollapsed && window.innerWidth > 1180);
}

function syncOptimizationPane() {
  document.querySelectorAll('[data-opt-pane-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-opt-pane-btn') === currentOptimizationPane);
  });
  document.querySelectorAll('[data-opt-pane]').forEach(pane => {
    pane.classList.toggle('active', pane.getAttribute('data-opt-pane') === currentOptimizationPane);
  });
}

function setOptimizationPane(pane) {
  currentOptimizationPane = pane || 'validated';
  localStorage.setItem('ik_dash_opt_pane', currentOptimizationPane);
  syncOptimizationPane();
}

function setWorkspacePane(pane) {
  currentWorkspacePane = pane || 'overview';
  localStorage.setItem('ik_dash_workspace_pane', currentWorkspacePane);
  syncWorkspacePane();
  toggleWorkspaceNav(false);
}

function toggleWorkspaceNav(force) {
  const shell = document.getElementById('dash-workspace-shell');
  if (!shell) return;
  const next = typeof force === 'boolean' ? force : !shell.classList.contains('nav-open');
  shell.classList.toggle('nav-open', next);
}

function toggleWorkspaceRail(force) {
  if (window.innerWidth <= 1180) {
    toggleWorkspaceNav(typeof force === 'boolean' ? force : undefined);
    return;
  }
  workspaceRailCollapsed = typeof force === 'boolean' ? force : !workspaceRailCollapsed;
  localStorage.setItem('ik_dash_workspace_rail_collapsed', workspaceRailCollapsed ? '1' : '0');
  syncWorkspaceRail();
}

function initWorkspaceNavigation() {
  const saved = localStorage.getItem('ik_dash_workspace_pane');
  if (saved) {
    currentWorkspacePane = saved;
  }
  const savedOptPane = localStorage.getItem('ik_dash_opt_pane');
  if (savedOptPane) {
    currentOptimizationPane = savedOptPane;
  }
  workspaceRailCollapsed = localStorage.getItem('ik_dash_workspace_rail_collapsed') === '1';
  runtimeSideCollapsed = localStorage.getItem('ik_dash_runtime_side_collapsed') === '1';
  syncWorkspacePane();
  syncOptimizationPane();
  syncWorkspaceRail();
  syncRuntimeSideLayout();
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1180) {
      toggleWorkspaceNav(false);
    }
    syncWorkspaceRail();
  });
}

// ============================================================
// === INIT ===
// ============================================================
function init() {
  restoreTheme();
  initProfiles();
  const loaded = loadState();
  if (!loaded) {
    applyProfile('ryzen_7950x_96gb');
  }
  setLang(currentLang);
  initWorkspaceNavigation();
  syncAllToDOM();
  evaluate();
  renderCommand();
  injectHelpButtons();
  // Show correct interaction panel based on target
  updateInteractionPanels();
  // Try connecting to dashboard server
  checkServer();
  // Periodic server check
  setInterval(checkServer, 10000);
  window.DashboardBridge = {
    apiGet,
    t,
    getLang: () => currentLang,
    getState: () => ({
      ...state,
      __profile: currentProfile ? { ...currentProfile } : null,
      __system: serverInfo ? { ...serverInfo } : null,
    }),
  };
  document.dispatchEvent(new CustomEvent('dashboard:bridge-ready'));
}

document.addEventListener('DOMContentLoaded', init);
