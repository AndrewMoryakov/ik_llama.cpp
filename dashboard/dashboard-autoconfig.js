(function (global) {
  'use strict';

  var Rules = global.DashboardRules;

  function computeOptimalParams(modelInfo, modelSizeGb, profile, currentState, currentLang) {
    var detectModelFamily = Rules.detectModelFamily;
    var isSwapBound = Rules.isSwapBound;

    const totalRam = profile.totalRamGb || 64;
    const cores = profile.cores || 8;
    const ccdCount = profile.ccdCount || 1;
    const isMoE = modelInfo.is_moe;
    const expertCount = modelInfo.expert_count || 0;
    const expertUsed = modelInfo.expert_used_count || 0;
    const swapBound = modelSizeGb > totalRam * 0.9;
    const contextLen = modelInfo.context_length || 0;
    const family = detectModelFamily({ ...(currentState || {}), model_type: isMoE ? 'moe' : 'dense' }, modelInfo);
    const evidenceCtx = {
      state: { ...(currentState || {}), model_type: isMoE ? 'moe' : 'dense' },
      meta: modelInfo,
      family,
      modelPath: (currentState && currentState.model) || '',
      modelType: isMoE ? 'moe' : 'dense',
      workload: 'mixed',
      isSwapBound: swapBound
    };
    const runtimeProfile = global.IKLLamaEvidenceLayer?.resolveRuntimeProfile?.(
      evidenceCtx,
      currentLang || 'ru',
      { detectModelFamily, isSwapBound }
    ) || {
      id: 'fallback',
      defaults: {
        workload_profile: 'mixed',
        flash_attn: true,
        merge_up_gate_exps: false,
        cache_type_k: 'f16',
        cache_type_v: swapBound ? 'q8_0' : 'f16',
        graph_reuse: true
      },
      reasons: []
    };

    const params = {};
    const reasons = [];

    // --- Model type ---
    params.model_type = isMoE ? 'moe' : 'dense';
    if (isMoE) {
      reasons.push({
        param: 'model_type', value: 'MoE',
        ru: `MoE модель: ${expertCount} экспертов, ${expertUsed} активных на токен`,
        en: `MoE model: ${expertCount} experts, ${expertUsed} active per token`,
      });
    } else {
      reasons.push({
        param: 'model_type', value: 'Dense',
        ru: 'Dense модель (без экспертов)',
        en: 'Dense model (no experts)',
      });
    }

    // --- Threads ---
    if (profile.optimalThreads) {
      params.threads = profile.optimalThreads;
      reasons.push({
        param: 'threads', value: params.threads,
        ru: `Аппаратный профиль: оптимальное число потоков -t ${params.threads}`,
        en: `Hardware profile: optimal thread count -t ${params.threads}`,
      });
    } else if (ccdCount >= 2) {
      params.threads = Math.min(cores, 16);
      reasons.push({
        param: 'threads', value: params.threads,
        ru: `Dual-CCD: ${params.threads} потоков (оба CCD, полный L3 кеш)`,
        en: `Dual-CCD: ${params.threads} threads (both CCDs, full L3 cache)`,
      });
    } else {
      params.threads = cores;
      reasons.push({
        param: 'threads', value: params.threads,
        ru: `Single-CCD: ${params.threads} потоков`,
        en: `Single-CCD: ${params.threads} threads`,
      });
    }

    // --- Runtime profile defaults ---
    params.workload_profile = runtimeProfile.defaults.workload_profile;
    params.flash_attn = runtimeProfile.defaults.flash_attn;
    params.merge_up_gate_exps = runtimeProfile.defaults.merge_up_gate_exps;
    params.cache_type_k = runtimeProfile.defaults.cache_type_k;
    params.cache_type_v = runtimeProfile.defaults.cache_type_v;
    params.graph_reuse = runtimeProfile.defaults.graph_reuse;
    runtimeProfile.reasons.forEach((entry) => {
      reasons.push({
        param: entry.param,
        value: entry.value,
        ru: entry.text,
        en: entry.text,
      });
    });

    // --- KV quant not supported on CPU-only builds without GPU backend ---
    if (profile.noKvQuant) {
      if (params.cache_type_k !== 'f16') {
        params.cache_type_k = 'f16';
        reasons.push({
          param: 'cache_type_k', value: 'f16',
          ru: 'ctk f16: CPU-only сборка не поддерживает KV-квантизацию — принудительно f16.',
          en: 'ctk f16: CPU-only build does not support KV quantization — forced to f16.',
        });
      }
      if (params.cache_type_v !== 'f16') {
        params.cache_type_v = 'f16';
        reasons.push({
          param: 'cache_type_v', value: 'f16',
          ru: 'ctv f16: CPU-only сборка не поддерживает KV-квантизацию — принудительно f16.',
          en: 'ctv f16: CPU-only build does not support KV quantization — forced to f16.',
        });
      }
    }

    // --- Runtime Repack ---
    const rtrGuidance = global.IKLLamaEvidenceLayer?.getAutoConfigRtrGuidance?.(
      evidenceCtx,
      currentLang || 'ru',
      { detectModelFamily, isSwapBound }
    );
    // Qwen3.5 hybrid (attention + SSM) — rtr on causes hangs, force off
    if (family === 'qwen35') {
      params.repack_tensors = 'off';
      reasons.push({
        param: 'repack_tensors', value: 'off',
        ru: 'rtr OFF: Qwen3.5 — гибридная архитектура (attention + SSM/Mamba). -rtr on вызывает зависание, используем off.',
        en: 'rtr OFF: Qwen3.5 is a hybrid architecture (attention + SSM/Mamba). -rtr on causes hangs, using off.',
      });
    } else {
      params.repack_tensors = rtrGuidance?.mode || (isMoE ? 'auto' : (swapBound ? 'off' : 'on'));
    }
    if (family !== 'qwen35') {
      (rtrGuidance?.reasons || []).forEach((entry) => {
        reasons.push({
          param: 'repack_tensors',
          value: entry.value,
          ru: entry.text,
          en: entry.text,
        });
      });
    }

    // --- KV Cache context override for huge/long context ---
    if (contextLen > 65536 && params.cache_type_v !== 'q8_0') {
      params.cache_type_v = 'q8_0';
      reasons.push({
        param: 'cache_type_v', value: 'q8_0',
        ru: 'ctv q8_0: очень длинный контекст — дополнительно ужимаем V-cache поверх baseline.',
        en: 'ctv q8_0: very long context — tighten the V-cache further on top of the baseline.'
      });
    }

    // --- Qwen3.5: force dense, no MoE knobs ---
    if (family === 'qwen35') {
      params.model_type = 'dense';
      params.ser_enabled = false;
      params.merge_up_gate_exps = false;
    }

    // --- SER for swap-bound MoE ---
    if (isMoE && swapBound && expertUsed >= 4 && family !== 'qwen35') {
      params.ser_enabled = false;
      params.ser_min = Math.max(2, Math.floor(expertUsed / 2));
      params.ser_thresh = 0.05;
      reasons.push({
        param: 'ser', value: `${params.ser_min},${params.ser_thresh}`,
        ru: `SER остаётся OFF по умолчанию: идея перспективная для huge MoE, но пока это experimental path. Если хотите проверять — начните с ${params.ser_min},${params.ser_thresh}`,
        en: `SER stays OFF by default: the idea is promising for huge MoE, but it is still experimental. If you want to test it, start with ${params.ser_min},${params.ser_thresh}`,
      });
    } else {
      params.ser_enabled = false;
    }

    // --- GPU layers ---
    params.n_gpu_layers = 0;

    // --- mmap ---
    if (params.repack_tensors === 'on') {
      params.use_mmap = false;
    } else {
      params.use_mmap = true;
    }

    // --- Context size suggestion ---
    if (contextLen > 0 && swapBound) {
      params.n_ctx = Math.min(8192, contextLen);
      reasons.push({
        param: 'n_ctx', value: params.n_ctx,
        ru: `Контекст ${params.n_ctx}: swap-bound, ограничиваем для экономии RAM (макс. модели: ${contextLen})`,
        en: `Context ${params.n_ctx}: swap-bound, limited to save RAM (model max: ${contextLen})`,
      });
    }

    // --- Disable live observability for swap-bound models ---
    if (swapBound) {
      params.live_observability = false;
      reasons.push({
        param: 'live_observability', value: false,
        ru: 'Live observability OFF: swap-bound модель, trace-флаги могут вызвать краш из-за дополнительного потребления памяти.',
        en: 'Live observability OFF: swap-bound model, trace flags may cause crashes due to extra memory usage.',
      });
    }

    const hotGuidance = global.IKLLamaEvidenceLayer?.getHotExpertGuidance?.(
      evidenceCtx,
      currentLang || 'ru',
      { detectModelFamily, isSwapBound }
    );
    (hotGuidance?.reasons || []).forEach((entry) => {
      reasons.push({
        param: 'hot_expert_budget',
        value: entry.value,
        ru: entry.text,
        en: entry.text,
      });
    });

    return {
      params,
      reasons,
      summary: {
        is_moe: isMoE,
        is_swap_bound: swapBound,
        expert_count: expertCount,
        expert_used: expertUsed,
        model_name: modelInfo.name || modelInfo.basename || '',
        model_size_gb: modelSizeGb,
        context_length: contextLen,
        architecture: modelInfo.architecture,
      },
    };
  }

  global.DashboardAutoConfig = { computeOptimalParams };
})(typeof window !== 'undefined' ? window : this);
