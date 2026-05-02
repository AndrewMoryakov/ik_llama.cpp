(function (global) {
  'use strict';

  // ============================================================
  // === HELPER FUNCTIONS (pure, no DOM, no global state) ===
  // ============================================================
  function isSwapBound(s, p) {
    return p.totalRamGb > 0 && s.model_size_gb > 0 && s.model_size_gb > p.totalRamGb * 0.9;
  }

  function modelPathContains(s, needle) {
    const path = String((s && s.model) || '').toLowerCase();
    return !!needle && path.includes(String(needle).toLowerCase());
  }

  function getRtrMode(s) {
    return s.repack_tensors || 'off';
  }

  function isRtrForcedOn(s) {
    return getRtrMode(s) === 'on';
  }

  function isRtrEnabled(s) {
    return getRtrMode(s) !== 'off';
  }

  function detectModelFamily(s, meta) {
    const arch = String(meta?.architecture || '').toLowerCase();
    const name = String(meta?.name || meta?.basename || s.model || '').toLowerCase();
    if (arch.includes('minimax') || name.includes('minimax')) return 'minimax';
    if (arch.includes('openai') || arch.includes('gpt-oss') || name.includes('gpt-oss')) return 'gpt-oss';
    if (arch.includes('qwen3moe') || (name.includes('qwen3') && name.includes('a3b'))) return 'qwen3moe';
    if (arch.includes('qwen35') || name.includes('qwen3.5') || name.includes('qwen3_5')) return 'qwen35';
    return 'other';
  }

  function isValidatedAutoMoeFamily(s, meta) {
    const family = detectModelFamily(s, meta);
    return s.model_type === 'moe' && (family === 'qwen3moe' || family === 'gpt-oss');
  }

  function getFamilyValidationStatus(s, meta, currentProfile) {
    return global.IKLLamaEvidenceLayer?.getFamilyValidationStatus?.(
      { state: s, meta, family: detectModelFamily(s, meta), modelPath: s.model || '', modelType: s.model_type, workload: s.workload_profile, isSwapBound: isSwapBound(s, currentProfile || {}) },
      { detectModelFamily, isSwapBound }
    ) || 'unknown';
  }

  function hasExperimentalKnobs(s) {
    return !!(
      s.ser_enabled ||
      s.merge_qkv ||
      s.prompt_packed_qkv ||
      (s.experimental_preset && s.experimental_preset !== 'none') ||
      (s.hot_expert_budget || 0) > 0 ||
      (s.hot_expert_budget_mult || 0) > 0 ||
      (s.hot_expert_selection && s.hot_expert_selection !== 'default') ||
      (s.hot_expert_selection === 'tail-window' && (s.hot_expert_tail_window || 0) > 0)
    );
  }

  function severityLevel(s) {
    return { success: 0, info: 1, warning: 2, error: 3 }[s] || 0;
  }

  const SEVERITY_ICONS = { error: '\u26D4', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F', success: '\u2705' };

  // isExperimentalRuntimeLimited needs getSupportBadgeMeta from dashboard.js
  // When used standalone, it returns false (safe default)
  function isExperimentalRuntimeLimited(param, s, p) {
    if (global._dashboardGetSupportBadgeMeta) {
      const meta = global._dashboardGetSupportBadgeMeta(param, s, p);
      if (!meta) return false;
      return meta.className === 'support-limited' || meta.className === 'support-inactive';
    }
    return false;
  }

  const RULES = [
    {
      id: 'rtr_swap', severity: 'error', params: ['repack_tensors'],
      test: (s, p) => getRtrMode(s) === 'on' && isSwapBound(s, p),
      msg: 'w_rtr_swap', fix: 'w_rtr_swap_fix',
    },
    {
      id: 'rtr_auto_moe', severity: 'success', params: ['repack_tensors'],
      test: (s, p) => getRtrMode(s) === 'auto' && isValidatedAutoMoeFamily(s),
      msg: 'w_rtr_auto_moe', fix: 'w_rtr_auto_fix',
    },
    {
      id: 'gptoss_huge_auto', severity: 'info', params: ['repack_tensors'],
      test: (s, p) => detectModelFamily(s) === 'gpt-oss' && isSwapBound(s, p) && getRtrMode(s) === 'auto',
      msg: 'w_gptoss_huge_auto', fix: 'w_gptoss_huge_auto_fix',
    },
    {
      id: 'rtr_off_validated_moe', severity: 'info', params: ['repack_tensors'],
      test: (s, p) => getRtrMode(s) === 'off' && isValidatedAutoMoeFamily(s) && !isSwapBound(s, p),
      msg: 'w_rtr_off_validated_moe',
    },
    {
      id: 'muge_gptoss', severity: 'error', params: ['merge_up_gate_exps'],
      test: (s) => s.merge_up_gate_exps && detectModelFamily(s) === 'gpt-oss',
      msg: 'w_muge_gptoss', fix: 'w_muge_gptoss_fix',
    },
    {
      id: 'muge_swap', severity: 'error', params: ['merge_up_gate_exps'],
      test: (s, p) => s.merge_up_gate_exps && isSwapBound(s, p),
      msg: 'w_muge_swap', fix: 'w_muge_swap_fix',
    },
    {
      id: 'rtr_muge', severity: 'info', params: ['repack_tensors', 'merge_up_gate_exps'],
      test: (s, p) => isRtrEnabled(s) && s.merge_up_gate_exps,
      msg: 'w_rtr_muge',
    },
    {
      id: 'threads_moe', severity: 'warning', params: ['threads'],
      test: (s, p) => s.model_type === 'moe' && s.threads > 16,
      msg: 'w_threads_moe', fix: 'w_threads_moe_fix',
    },
    {
      id: 'ctk_good', severity: 'success', params: ['cache_type_k'],
      test: (s) => s.cache_type_k === 'q8_0',
      msg: 'w_ctk_good',
    },
    {
      id: 'ctv_good', severity: 'success', params: ['cache_type_v'],
      test: (s) => s.cache_type_v === 'q8_0',
      msg: 'w_ctv_good',
    },
    {
      id: 'ser_info', severity: 'info', params: ['ser'],
      test: (s) => s.ser_enabled,
      msg: 'w_ser_info',
    },
    {
      id: 'mqkv_experimental', severity: 'info', params: ['merge_qkv'],
      test: (s) => s.merge_qkv,
      msg: 'w_mqkv_experimental',
    },
    {
      id: 'hot_budget_experimental', severity: 'info', params: ['hot_expert_budget'],
      test: (s) => (s.hot_expert_budget || 0) > 0,
      msg: 'w_hot_budget_experimental',
    },
    {
      id: 'hot_budget_mult_experimental', severity: 'info', params: ['hot_expert_budget_mult'],
      test: (s) => (s.hot_expert_budget_mult || 0) > 0,
      msg: 'w_hot_budget_mult_experimental',
    },
    {
      id: 'hot_budget_family', severity: 'info', params: ['hot_expert_budget'],
      test: (s, p) => (s.hot_expert_budget || 0) > 0 && isExperimentalRuntimeLimited('hot_expert_budget', s, p),
      msg: 'w_hot_budget_family',
    },
    {
      id: 'hot_budget_mult_family', severity: 'info', params: ['hot_expert_budget_mult'],
      test: (s, p) => (s.hot_expert_budget_mult || 0) > 0 && isExperimentalRuntimeLimited('hot_expert_budget_mult', s, p),
      msg: 'w_hot_budget_mult_family',
    },
    {
      id: 'hot_selection_experimental', severity: 'info', params: ['hot_expert_selection', 'hot_expert_tail_window'],
      test: (s) => !!(s.hot_expert_selection && s.hot_expert_selection !== 'default'),
      msg: 'w_hot_selection_experimental',
    },
    {
      id: 'hot_selection_family', severity: 'warning', params: ['hot_expert_selection', 'hot_expert_tail_window'],
      test: (s, p) => !!(s.hot_expert_selection && s.hot_expert_selection !== 'default') && isExperimentalRuntimeLimited('hot_expert_selection', s, p),
      msg: 'w_hot_selection_family',
    },
    {
      id: 'prompt_packed_experimental', severity: 'info', params: ['prompt_packed_qkv', 'prompt_packed_qkv_preset', 'prompt_packed_qkv_range'],
      test: (s) => !!s.prompt_packed_qkv,
      msg: 'w_prompt_packed_experimental',
    },
    {
      id: 'prompt_packed_family', severity: 'warning', params: ['prompt_packed_qkv', 'prompt_packed_qkv_preset', 'prompt_packed_qkv_range'],
      test: (s) => !!s.prompt_packed_qkv && !['qwen3moe', 'gpt-oss'].includes(detectModelFamily(s)),
      msg: 'w_prompt_packed_family',
    },
    {
      id: 'prompt_packed_range', severity: 'info', params: ['prompt_packed_qkv_range'],
      test: (s) => !!s.prompt_packed_qkv && !!String(s.prompt_packed_qkv_range || '').trim(),
      msg: 'w_prompt_packed_range',
    },
    {
      id: 'exp_preset_link', severity: 'info', params: ['experimental_preset', 'experimental_preset_link_validated'],
      test: (s) => !!(s.experimental_preset && s.experimental_preset !== 'none' && s.experimental_preset_link_validated),
      msg: 'w_exp_preset_link',
    },
    {
      id: 'swap_bound', severity: 'warning', params: ['model_size_gb'],
      test: (s, p) => isSwapBound(s, p),
      msg: 'w_swap_bound',
    },
    {
      id: 'fa_off', severity: 'warning', params: ['flash_attn'],
      test: (s) => !s.flash_attn,
      msg: 'w_fa_off',
    },
    {
      id: 'threads_ccd', severity: 'warning', params: ['threads'],
      test: (s, p) => p.ccdCount >= 2 && s.threads <= p.cores / p.ccdCount,
      msg: 'w_threads_ccd', fix: 'w_threads_ccd_fix',
    },
    {
      id: 'rtr_nommap', severity: 'info', params: ['repack_tensors', 'use_mmap'],
      test: (s) => isRtrForcedOn(s),
      msg: 'w_rtr_nommap',
    },
    {
      id: 'qwen35_rtr_on', severity: 'error', params: ['repack_tensors'],
      test: (s) => detectModelFamily(s) === 'qwen35' && getRtrMode(s) === 'on',
      msg: 'w_qwen35_rtr_on', fix: 'w_qwen35_rtr_on_fix',
    },
    {
      id: 'minimax_rtr_on', severity: 'warning', params: ['repack_tensors'],
      test: (s, p) => detectModelFamily(s) === 'minimax' && getRtrMode(s) === 'on' && isSwapBound(s, p),
      msg: 'w_minimax_rtr_on',
    },
    {
      id: 'minimax_rtr_auto', severity: 'info', params: ['repack_tensors'],
      test: (s, p) => detectModelFamily(s) === 'minimax' && getRtrMode(s) === 'auto' && isSwapBound(s, p),
      msg: 'w_minimax_rtr_auto',
    },
    {
      id: 'minimax_hot_budget_hint', severity: 'info', params: ['model_size_gb'],
      test: (s, p) => detectModelFamily(s) === 'minimax' && isSwapBound(s, p) && s.workload_profile !== 'pp',
      msg: 'w_minimax_hot_budget_hint', fix: 'w_minimax_hot_budget_fix',
    },
    {
      id: 'workload_mixed', severity: 'info', params: ['workload_profile'],
      test: (s) => s.workload_profile === 'mixed',
      msg: 'w_workload_mixed',
    },
    {
      id: 'workload_tg', severity: 'info', params: ['workload_profile'],
      test: (s) => s.workload_profile === 'tg',
      msg: 'w_workload_tg',
    },
    {
      id: 'workload_pp', severity: 'info', params: ['workload_profile'],
      test: (s) => s.workload_profile === 'pp',
      msg: 'w_workload_pp',
    },
    {
      id: 'qwen35_moe_knobs', severity: 'warning', params: ['ser_enabled', 'hot_expert_budget', 'merge_up_gate_exps'],
      test: (s) => detectModelFamily(s) === 'qwen35' && (s.ser_enabled || (s.hot_expert_budget || 0) > 0 || s.merge_up_gate_exps),
      msg: 'w_qwen35_moe_knobs',
    },
    {
      id: 'muge_dense', severity: 'info', params: ['merge_up_gate_exps'],
      test: (s) => s.merge_up_gate_exps && s.model_type === 'dense',
      msg: 'w_muge_dense',
    },
    {
      id: 'khad_f16', severity: 'info', params: ['k_cache_hadamard'],
      test: (s) => s.k_cache_hadamard && (s.cache_type_k === 'f16' || s.cache_type_k === 'f32'),
      msg: 'w_khad_f16',
    },
  ];

  const PARAM_APPLICABILITY = {
    model: 'all',
    model_size_gb: 'all',
    model_type: 'all',
    n_gpu_layers: 'all',
    threads: 'all',
    threads_batch: 'all',
    n_ctx: 'all',
    n_batch: 'all',
    n_ubatch: 'all',
    workload_profile: 'all',
    flash_attn: 'all',
    repack_tensors: 'all',
    cache_type_k: 'all',
    cache_type_v: 'all',
    mla_attn: 'mla',
    graph_reuse: 'all',
    hostname: 'all',
    port: 'all',
    n_parallel: 'all',
    api_key: 'all',
    n_threads_http: 'all',
    seed: 'all',
    n_predict: 'all',
    numa: 'all',
    defrag_thold: 'all',
    use_mmap: 'all',
    use_mlock: 'all',
    live_observability: 'all',
    merge_up_gate_exps: 'moe',
    fused_moe_up_gate: 'moe',
    fused_up_gate: 'all',
    ser_enabled: 'moe',
    ser_min: 'moe',
    ser_thresh: 'moe',
    hot_expert_budget: 'moe-huge',
    hot_expert_budget_mult: 'moe-huge',
    hot_expert_selection: 'moe-huge',
    hot_expert_tail_window: 'moe-huge',
    hot_expert_tail_blend: 'moe-huge',
    merge_qkv: 'arch-specific',
    k_cache_hadamard: 'quantized-kv',
    prompt_packed_qkv: 'split-qkv',
    prompt_packed_qkv_preset: 'split-qkv',
    prompt_packed_qkv_range: 'split-qkv',
    experimental_preset: 'all',
    experimental_preset_link_validated: 'all',
  };

  const PARAM_CONTROL_MAP = {
    model: 'p-model',
    model_size_gb: 'p-model_size_gb',
    model_type: 'p-model_type',
    n_gpu_layers: 'p-n_gpu_layers',
    threads: 'p-threads',
    threads_batch: 'p-threads_batch',
    n_ctx: 'p-n_ctx',
    n_batch: 'p-n_batch',
    n_ubatch: 'p-n_ubatch',
    workload_profile: 'p-workload_profile',
    repack_tensors: 'p-repack_tensors',
    cache_type_k: 'p-cache_type_k',
    cache_type_v: 'p-cache_type_v',
    mla_attn: 'p-mla_attn',
    ser_min: 'p-ser_min',
    ser_thresh: 'p-ser_thresh',
    hot_expert_budget: 'p-hot_expert_budget',
    hot_expert_budget_mult: 'p-hot_expert_budget_mult',
    hot_expert_selection: 'p-hot_expert_selection',
    hot_expert_tail_window: 'p-hot_expert_tail_window',
    hot_expert_tail_blend: 'p-hot_expert_tail_blend',
    experimental_preset: 'experimental-preset-picker',
    hostname: 'p-hostname',
    port: 'p-port',
    n_parallel: 'p-n_parallel',
    api_key: 'p-api_key',
    n_threads_http: 'p-n_threads_http',
    seed: 'p-seed',
    n_predict: 'p-n_predict',
    numa: 'p-numa',
    defrag_thold: 'p-defrag_thold',
    target: 'sel-target',
    shell: 'sel-shell',
    flash_attn: 'tog-flash_attn',
    merge_up_gate_exps: 'tog-merge_up_gate_exps',
    graph_reuse: 'tog-graph_reuse',
    merge_qkv: 'tog-merge_qkv',
    k_cache_hadamard: 'tog-k_cache_hadamard',
    fused_moe_up_gate: 'tog-fused_moe_up_gate',
    fused_up_gate: 'tog-fused_up_gate',
    use_mmap: 'tog-use_mmap',
    use_mlock: 'tog-use_mlock',
    ser_enabled: 'tog-ser_enabled',
    live_observability: 'tog-live_observability',
    experimental_preset_link_validated: 'tog-experimental_preset_link_validated',
    prompt_packed_qkv: 'tog-prompt_packed_qkv',
    prompt_packed_qkv_preset: 'p-prompt_packed_qkv_preset',
    prompt_packed_qkv_range: 'p-prompt_packed_qkv_range',
  };

  const WARNING_PARAM_TO_PANE = {
    model: 'model',
    model_size_gb: 'model',
    model_type: 'model',
    n_gpu_layers: 'model',
    workload_profile: 'performance',
    threads: 'performance',
    threads_batch: 'performance',
    n_ctx: 'performance',
    n_batch: 'performance',
    n_ubatch: 'performance',
    repack_tensors: 'optimization',
    merge_up_gate_exps: 'optimization',
    cache_type_k: 'optimization',
    cache_type_v: 'optimization',
    mla_attn: 'optimization',
    ser_enabled: 'optimization',
    ser_min: 'optimization',
    ser_thresh: 'optimization',
    hot_expert_budget: 'optimization',
    hot_expert_budget_mult: 'optimization',
    hot_expert_selection: 'optimization',
    hot_expert_tail_window: 'optimization',
    hot_expert_tail_blend: 'optimization',
    experimental_preset: 'optimization',
    experimental_preset_link_validated: 'optimization',
    graph_reuse: 'optimization',
    merge_qkv: 'optimization',
    k_cache_hadamard: 'optimization',
    fused_moe_up_gate: 'optimization',
    fused_up_gate: 'optimization',
    prompt_packed_qkv: 'optimization',
    prompt_packed_qkv_preset: 'optimization',
    prompt_packed_qkv_range: 'optimization',
    hostname: 'server',
    port: 'server',
    n_parallel: 'server',
    api_key: 'server',
    n_threads_http: 'server',
    flash_attn: 'optimization',
    use_mmap: 'advanced',
    use_mlock: 'advanced',
    numa: 'advanced',
    defrag_thold: 'advanced',
    seed: 'advanced',
    n_predict: 'advanced',
  };

  global.DashboardRules = {
    isSwapBound, modelPathContains, getRtrMode, isRtrForcedOn, isRtrEnabled,
    detectModelFamily, isValidatedAutoMoeFamily, getFamilyValidationStatus,
    hasExperimentalKnobs, isExperimentalRuntimeLimited,
    severityLevel, SEVERITY_ICONS,
    RULES, PARAM_APPLICABILITY, PARAM_CONTROL_MAP, WARNING_PARAM_TO_PANE,
  };
})(typeof window !== 'undefined' ? window : this);
