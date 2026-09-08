(function (global) {
  'use strict';

  const PROFILES = {
    'ryzen_7950x_96gb': {
      name: 'Ryzen 9 7950X + 96 GB DDR5',
      cores: 16, threads: 32, ccdCount: 2, l3CacheMb: 64,
      totalRamGb: 96, ramBandwidthGbps: 67, ssdReadGbps: 3.0,
      hasAvx512: true, optimalThreads: 16,
    },
    'ryzen_9800x3d_64gb': {
      name: 'Ryzen 7 9800X3D + 64 GB DDR5',
      cores: 8, threads: 16, ccdCount: 1, l3CacheMb: 96,
      totalRamGb: 64, ramBandwidthGbps: 55, ssdReadGbps: 3.0,
      hasAvx512: false, optimalThreads: 8,
    },
    'i7_1360p_16gb': {
      name: 'Intel i7-1360p + 16 GB DDR5 (laptop, CPU-only)',
      cores: 4, threads: 4, ccdCount: 0, l3CacheMb: 18,
      totalRamGb: 16, ramBandwidthGbps: 50, ssdReadGbps: 3.5,
      hasAvx512: false, optimalThreads: 4, noKvQuant: true,
    },
    'custom': {
      name: 'Custom',
      cores: 16, threads: 32, ccdCount: 1,
      totalRamGb: 64, ramBandwidthGbps: 50, ssdReadGbps: 3.0,
    },
  };

  const DEFAULTS = {
    model: '', model_size_gb: 0, model_type: 'dense', n_gpu_layers: -1,
    threads: 16, threads_batch: -1, n_ctx: 0, n_batch: 2048, n_ubatch: 512,
    flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false,
    cache_type_k: 'f16', cache_type_v: 'f16', mla_attn: 3,
    ser_enabled: false, ser_min: 4, ser_thresh: 0.05,
    hot_expert_budget: 0,
    hot_expert_budget_mult: 0,
    hot_expert_selection: 'default',
    hot_expert_tail_window: 16,
    hot_expert_tail_blend: 0,
    experimental_preset: 'none',
    experimental_preset_link_validated: true,
    prompt_packed_qkv: false,
    prompt_packed_qkv_preset: 'auto',
    prompt_packed_qkv_range: '',
    live_observability: true,
    graph_reuse: true, merge_qkv: false, k_cache_hadamard: false,
    fused_moe_up_gate: true, fused_up_gate: true,
    hostname: '127.0.0.1', port: 8080, n_parallel: 1, api_key: '', n_threads_http: -1,
    seed: -1, n_predict: -1, use_mmap: true, use_mlock: false,
    numa: 'disabled', defrag_thold: -1,
    workload_profile: 'mixed',
    target: 'llama-cli', shell: 'bash',
  };

  const TOGGLE_PARAMS = [
    'flash_attn', 'merge_up_gate_exps', 'graph_reuse',
    'merge_qkv', 'k_cache_hadamard', 'fused_moe_up_gate', 'fused_up_gate',
    'use_mmap', 'use_mlock', 'ser_enabled', 'live_observability',
    'experimental_preset_link_validated', 'prompt_packed_qkv',
  ];

  global.DashboardData = { PROFILES, DEFAULTS, TOGGLE_PARAMS };
})(typeof window !== 'undefined' ? window : this);
