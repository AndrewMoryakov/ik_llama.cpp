(function (global) {
  'use strict';

  const APPLICABILITY_META = {
    all: { labelRu: 'Все', labelEn: 'All', className: 'app-all', titleRu: 'Универсальный параметр: теоретически применим к любым моделям.', titleEn: 'Universal parameter: theoretically applicable to any model.' },
    dense: { labelRu: 'Dense', labelEn: 'Dense', className: 'app-dense', titleRu: 'Имеет смысл для dense-моделей и связанных attention/runtime путей.', titleEn: 'Meaningful for dense models and related attention/runtime paths.' },
    moe: { labelRu: 'MoE', labelEn: 'MoE', className: 'app-moe', titleRu: 'Имеет смысл прежде всего для mixture-of-experts моделей.', titleEn: 'Primarily meaningful for mixture-of-experts models.' },
    'moe-huge': { labelRu: 'MoE / huge-MoE', labelEn: 'MoE / huge-MoE', className: 'app-moe-huge', titleRu: 'По механике параметр относится к MoE locality, особенно на больших swap-bound MoE. Это не означает одинаковую validation или одинаковый runtime support на всех семействах.', titleEn: 'Mechanically this belongs to MoE locality, especially on large swap-bound MoE. That does not imply equal validation or equal runtime support across all families.' },
    mla: { labelRu: 'MLA / DeepSeek', labelEn: 'MLA / DeepSeek', className: 'app-mla', titleRu: 'Имеет смысл только для семейств, где реально используется MLA-путь.', titleEn: 'Only meaningful for families that actually use the MLA path.' },
    'split-qkv': { labelRu: 'Split-QKV', labelEn: 'Split-QKV', className: 'app-split-qkv', titleRu: 'Имеет смысл для архитектур с раздельными Q/K/V проекциями и совместимым prompt-packing path.', titleEn: 'Meaningful for architectures with separate Q/K/V projections and a compatible prompt-packing path.' },
    'arch-specific': { labelRu: 'Арх.-завис.', labelEn: 'Arch-specific', className: 'app-arch', titleRu: 'Параметр не универсален: его смысл зависит от конкретной attention-архитектуры модели.', titleEn: 'This parameter is not universal: its meaning depends on the concrete attention architecture.' },
    'quantized-kv': { labelRu: 'Квант. KV', labelEn: 'Quantized KV', className: 'app-kv', titleRu: 'Имеет смысл в первую очередь вместе с квантованным KV cache.', titleEn: 'Mainly meaningful together with a quantized KV cache.' },
    helper: { labelRu: 'Helper', labelEn: 'Helper', className: 'app-helper', titleRu: 'Вспомогательный инструментальный слой, не runtime-механизм модели.', titleEn: 'Helper/tooling layer, not a model runtime mechanism.' }
  };

  const RUNTIME_SUPPORT_META = {
    universal: { labelRu: 'Runtime: ok', labelEn: 'Runtime: ok', className: 'support-enabled', titleRu: 'Текущий runtime-path поддерживает этот knob широко.', titleEn: 'The current runtime path supports this knob broadly.' },
    'generic-moe-hot-expert-path': { labelRu: 'Runtime: MoE path', labelEn: 'Runtime: MoE path', className: 'support-enabled', titleRu: 'Текущий runtime-path поддерживает этот knob на generic MoE hot-expert path, но validation еще неравномерна.', titleEn: 'The current runtime path supports this knob on the generic MoE hot-expert path, but validation is still uneven.' },
    'split-qkv-generic-auto-family-first': { labelRu: 'Runtime: split-QKV', labelEn: 'Runtime: split-QKV', className: 'support-enabled', titleRu: 'Manual runtime-path уже может работать на совместимых split-QKV моделях, но auto-policy и strongest support все еще family-first.', titleEn: 'The manual runtime path can already work on compatible split-QKV models, but auto-policy and strongest support are still family-first.' },
    'family-first': { labelRu: 'Runtime: family-first', labelEn: 'Runtime: family-first', className: 'support-limited', titleRu: 'Path завязан на конкретные family-пути runtime.', titleEn: 'This path is tied to specific family runtime branches.' },
    'arch-sensitive': { labelRu: 'Runtime: чувствит.', labelEn: 'Runtime: sensitive', className: 'support-limited', titleRu: 'Код принимает этот knob широко, но его effect и execution path зависят от attention-архитектуры.', titleEn: 'The code accepts this knob broadly, but its effect and execution path depend on the attention architecture.' },
    helper: { labelRu: 'Runtime: helper', labelEn: 'Runtime: helper', className: 'support-helper', titleRu: 'Это helper-control dashboard, а не отдельный runtime path модели.', titleEn: 'This is a dashboard helper control, not a separate model runtime path.' },
    'dashboard-only': { labelRu: 'Runtime: UI', labelEn: 'Runtime: UI', className: 'support-dashboard', titleRu: 'Это не runtime optimization knob модели, а dashboard-side observability/tooling.', titleEn: 'This is not a model runtime optimization knob but dashboard-side observability/tooling.' },
    inactive: { labelRu: 'Runtime: n/a', labelEn: 'Runtime: n/a', className: 'support-inactive', titleRu: 'Для текущего класса моделей этот knob не имеет meaningful runtime path.', titleEn: 'This knob does not have a meaningful runtime path for the current model class.' }
  };

  const VALIDATION_META = {
    validated: { labelRu: 'Проверка: есть', labelEn: 'Signal: validated', className: 'validation-validated', titleRu: 'Есть достаточный benchmark-backed сигнал для текущей family/regime.', titleEn: 'There is sufficient benchmark-backed signal for the current family/regime.' },
    partial: { labelRu: 'Проверка: частично', labelEn: 'Signal: partial', className: 'validation-partial', titleRu: 'Есть benchmark-backed signal, но недостаточно для promoted default.', titleEn: 'There is benchmark-backed signal, but not enough for a promoted default.' },
    research: { labelRu: 'Проверка: research', labelEn: 'Signal: research', className: 'validation-research', titleRu: 'По этому knob пока нет достаточно сильной benchmark-backed validation.', titleEn: 'This knob does not yet have strong enough benchmark-backed validation.' },
    helper: { labelRu: 'Проверка: helper', labelEn: 'Signal: helper', className: 'validation-helper', titleRu: 'Это helper/tooling слой. Для него важна usability, а не benchmark validation в runtime-смысле.', titleEn: 'This is a helper/tooling layer. Usability matters here rather than runtime-style benchmark validation.' }
  };

  const CONFIDENCE_META = {
    high: { labelRu: 'Увер.: высокая', labelEn: 'Conf.: high', className: 'confidence-high' },
    medium: { labelRu: 'Увер.: средняя', labelEn: 'Conf.: medium', className: 'confidence-medium' },
    low: { labelRu: 'Увер.: низкая', labelEn: 'Conf.: low', className: 'confidence-low' },
    none: { labelRu: 'Увер.: нет', labelEn: 'Conf.: none', className: 'confidence-none' },
    helper: { labelRu: 'Увер.: helper', labelEn: 'Conf.: helper', className: 'confidence-helper' }
  };

  const RISK_META = {
    low: { labelRu: 'Риск: низкий', labelEn: 'Risk: low' },
    medium: { labelRu: 'Риск: средний', labelEn: 'Risk: medium' },
    high: { labelRu: 'Риск: высокий', labelEn: 'Risk: high' }
  };

  const EXPERIMENTAL_KNOB_EVIDENCE = {
    ser_enabled: { id: 'ser_enabled', applicability: 'moe', runtimeSupport: 'universal', validation: 'research', risk: 'medium', failureModeRu: 'Может не дать win, а при неудачном пороге менять router-side behavior без практической пользы.', failureModeEn: 'May provide no win and change router-side behavior without practical value if thresholds are poor.', testedOn: [] },
    ser_min: { id: 'ser_min', applicability: 'moe', runtimeSupport: 'universal', validation: 'research', risk: 'medium', failureModeRu: 'Слишком низкий или высокий порог может сделать pruning бессмысленным.', failureModeEn: 'Too low or too high a threshold can make pruning meaningless.', testedOn: [] },
    ser_thresh: { id: 'ser_thresh', applicability: 'moe', runtimeSupport: 'universal', validation: 'research', risk: 'medium', failureModeRu: 'Неудачный threshold может урезать полезных экспертов без ощутимого выигрыша.', failureModeEn: 'A poor threshold may prune useful experts without a measurable gain.', testedOn: [] },
    hot_expert_budget: { id: 'hot_expert_budget', applicability: 'moe-huge', runtimeSupport: 'generic-moe-hot-expert-path', validation: 'partial', risk: 'medium', failureModeRu: 'Лишнее давление на RAM или удержание неправильного hot set.', failureModeEn: 'Extra RAM pressure or holding the wrong hot set.', testedOn: ['MiniMax M2.5'] },
    hot_expert_budget_mult: { id: 'hot_expert_budget_mult', applicability: 'moe-huge', runtimeSupport: 'generic-moe-hot-expert-path', validation: 'research', risk: 'medium', failureModeRu: 'Слишком агрессивный множитель может раздуть hot set и увеличить RAM pressure без устойчивой пользы.', failureModeEn: 'An overly aggressive multiplier may bloat the hot set and increase RAM pressure without stable benefit.', testedOn: [] },
    hot_expert_selection: { id: 'hot_expert_selection', applicability: 'moe-huge', runtimeSupport: 'generic-moe-hot-expert-path', validation: 'partial', risk: 'medium', failureModeRu: 'Signal может оказаться шумным или вводящим в заблуждение вне validated workloads.', failureModeEn: 'The signal may be noisy or misleading outside validated workloads.', testedOn: ['MiniMax M2.5', 'gpt-oss-20b'] },
    hot_expert_tail_window: { id: 'hot_expert_tail_window', applicability: 'moe-huge', runtimeSupport: 'generic-moe-hot-expert-path', validation: 'partial', risk: 'medium', failureModeRu: 'Неподходящее окно может не помочь или дать маленький регресс.', failureModeEn: 'An unsuitable tail window may not help or may cause a small regression.', testedOn: ['MiniMax M2.5', 'gpt-oss-20b'] },
    merge_qkv: { id: 'merge_qkv', applicability: 'arch-specific', runtimeSupport: 'arch-sensitive', validation: 'research', risk: 'medium', failureModeRu: 'Слабый или отрицательный win из-за неудачного attention/layout path.', failureModeEn: 'Weak or negative win due to an unfavorable attention/layout path.', testedOn: [] },
    prompt_packed_qkv: { id: 'prompt_packed_qkv', applicability: 'split-qkv', runtimeSupport: 'split-qkv-generic-auto-family-first', validation: 'partial', risk: 'high', failureModeRu: 'Дополнительная RAM, более долгий load/startup, и на части families prompt-side gain без strong mixed-path value.', failureModeEn: 'Extra RAM, longer load/startup, and on some families prompt-side gain without strong mixed-path value.', testedOn: ['gpt-oss-120b', 'gpt-oss-20b', 'Qwen3-30B-A3B'] },
    prompt_packed_qkv_preset: { id: 'prompt_packed_qkv_preset', applicability: 'split-qkv', runtimeSupport: 'split-qkv-generic-auto-family-first', validation: 'partial', risk: 'high', failureModeRu: 'Неподходящий preset или family mismatch.', failureModeEn: 'Suboptimal preset or family mismatch.', testedOn: ['gpt-oss-120b', 'gpt-oss-20b', 'Qwen3-30B-A3B'] },
    prompt_packed_qkv_range: { id: 'prompt_packed_qkv_range', applicability: 'split-qkv', runtimeSupport: 'split-qkv-generic-auto-family-first', validation: 'research', risk: 'high', failureModeRu: 'Ручной диапазон может ухудшить RAM/load time или не дать useful prompt win.', failureModeEn: 'A manual range may hurt RAM/load time or fail to provide a useful prompt win.', testedOn: [] },
    live_observability: { id: 'live_observability', applicability: 'all', runtimeSupport: 'dashboard-only', validation: 'helper', risk: 'low', failureModeRu: 'Лишний trace noise, если нужен максимально чистый benchmark.', failureModeEn: 'Extra trace noise when you want the cleanest possible benchmark.', testedOn: [] },
    experimental_preset: { id: 'experimental_preset', applicability: 'all', runtimeSupport: 'helper', validation: 'helper', risk: 'low', failureModeRu: 'Может включить bundle, который пользователь не до конца понимает.', failureModeEn: 'May enable a bundle that the user does not fully understand.', testedOn: [] },
    experimental_preset_link_validated: { id: 'experimental_preset_link_validated', applicability: 'all', runtimeSupport: 'helper', validation: 'helper', risk: 'low', failureModeRu: 'Пресет может перестроить validated baseline шире, чем ожидал пользователь.', failureModeEn: 'A preset may modify the validated baseline more broadly than the user expected.', testedOn: [] }
  };

  const EXPERIMENTAL_PRESET_EVIDENCE = {
    none: { id: 'none', title: { ru: 'Manual / off', en: 'Manual / off' }, descKey: 'exp_preset_none', risk: 'low', scope: 'generic', familyHint: [], testedOn: [], validation: 'helper', confidence: { fallback: 'helper' }, experimental: {}, validated: {} },
    'minimax-mixed-locality': { id: 'minimax-mixed-locality', title: { ru: 'MiniMax mixed locality', en: 'MiniMax mixed locality' }, descKey: 'exp_preset_minimax', risk: 'medium', scope: 'moe', familyHint: ['minimax'], testedOn: ['MiniMax M2.5'], validation: 'partial', confidence: { fallback: 'medium' }, experimental: { hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'tail-window', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { workload_profile: 'mixed', flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false } },
    'minimax-locality-aggressive': { id: 'minimax-locality-aggressive', title: { ru: 'MiniMax locality aggressive', en: 'MiniMax locality aggressive' }, desc: { ru: 'Более рискованный вариант для huge MiniMax: сохраняет tail-window selection, но дополнительно поднимает Hot Expert Budget до 24. Теоретически может лучше удерживать ранний decode, но длинные прогоны не подтвердили это как новый default.', en: 'A riskier huge-MiniMax variant: keeps tail-window selection and also raises Hot Expert Budget to 24. It may hold early decode better in theory, but longer runs did not validate it as a new default.' }, risk: 'high', scope: 'moe', familyHint: ['minimax'], testedOn: ['MiniMax M2.5'], validation: 'research', confidence: { fallback: 'low' }, experimental: { hot_expert_budget: 24, hot_expert_budget_mult: 0, hot_expert_selection: 'tail-window', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { workload_profile: 'mixed', flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false } },
    'qwen-prompt-packed': { id: 'qwen-prompt-packed', title: { ru: 'Qwen prompt-packed', en: 'Qwen prompt-packed' }, descKey: 'exp_preset_qwen', risk: 'high', scope: 'moe', familyHint: ['qwen3moe'], testedOn: ['Qwen3-30B-A3B'], validation: 'partial', confidence: { fallback: 'low' }, experimental: { hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: true, prompt_packed_qkv_preset: 'front-half', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { flash_attn: true, graph_reuse: true, repack_tensors: 'auto' } },
    'gptoss-prompt-packed': { id: 'gptoss-prompt-packed', title: { ru: 'gpt-oss prompt-packed', en: 'gpt-oss prompt-packed' }, descKey: 'exp_preset_gptoss', risk: 'high', scope: 'moe', familyHint: ['gpt-oss'], testedOn: ['gpt-oss-120b', 'gpt-oss-20b'], validation: 'partial', confidence: { entries: [{ selector: { family: 'gpt-oss', modelSizeTag: '120b' }, level: 'high' }, { selector: { family: 'gpt-oss', modelSizeTag: '20b' }, level: 'low' }], fallback: 'none' }, experimental: { hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: true, prompt_packed_qkv_preset: 'back-half', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { flash_attn: true, graph_reuse: true, repack_tensors: 'auto' } },
    'attention-merge-qkv': { id: 'attention-merge-qkv', title: { ru: 'Attention merge-qkv', en: 'Attention merge-qkv' }, descKey: 'exp_preset_merge_qkv', risk: 'medium', scope: 'generic', familyHint: ['qwen3moe', 'gpt-oss', 'other'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { merge_qkv: true, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '' }, validated: { flash_attn: true, graph_reuse: true } },
    'huge-moe-ser-light': { id: 'huge-moe-ser-light', title: { ru: 'Huge MoE SER light', en: 'Huge MoE SER light' }, desc: { ru: 'Мягкий router-side эксперимент для больших MoE: включает SER с min=4 и threshold=0.05. Идея — отрезать очень слабых экспертов и уменьшить I/O, не делая pruning слишком агрессивным.', en: 'A mild router-side experiment for large MoE: enables SER with min=4 and threshold=0.05. The goal is to prune very weak experts and reduce I/O without making pruning too aggressive.' }, risk: 'medium', scope: 'moe', familyHint: ['minimax', 'qwen3moe', 'gpt-oss'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { ser_enabled: true, ser_min: 4, ser_thresh: 0.05, hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '' }, validated: { flash_attn: true, merge_up_gate_exps: false } },
    'huge-moe-ser-aggressive': { id: 'huge-moe-ser-aggressive', title: { ru: 'Huge MoE SER aggressive', en: 'Huge MoE SER aggressive' }, desc: { ru: 'Более рискованный router-side bundle для больших MoE: SER с min=3 и threshold=0.10. Теоретически может сильнее разгрузить I/O, но риск потери качества и нестабильности решения роутера выше.', en: 'A more aggressive router-side bundle for large MoE: SER with min=3 and threshold=0.10. It may reduce I/O further in theory, but quality loss and routing instability risk are higher.' }, risk: 'high', scope: 'moe', familyHint: ['minimax', 'qwen3moe', 'gpt-oss'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { ser_enabled: true, ser_min: 3, ser_thresh: 0.10, hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '' }, validated: { flash_attn: true, merge_up_gate_exps: false } },
    'dense-attention-locality': { id: 'dense-attention-locality', title: { ru: 'Dense attention locality', en: 'Dense attention locality' }, desc: { ru: 'Универсальный attention-side эксперимент для dense и mixed семей: Merge QKV + Flash Attention + Graph Reuse. Не требует MoE-логики и подходит как мягкий baseline experiment для неизвестных dense моделей.', en: 'A generic attention-side experiment for dense and mixed families: Merge QKV + Flash Attention + Graph Reuse. It does not rely on MoE logic and can serve as a mild baseline experiment for unknown dense models.' }, risk: 'low', scope: 'dense', familyHint: ['other'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { merge_qkv: true, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: false, hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16 }, validated: { flash_attn: true, graph_reuse: true } }
  };

  function getModelSizeTag(ctx) {
    const path = String(ctx.modelPath || '').toLowerCase();
    if (path.includes('120b')) return '120b';
    if (path.includes('20b')) return '20b';
    if (path.includes('30b')) return '30b';
    if (path.includes('7b')) return '7b';
    return '';
  }

  function matchesSelector(selector, ctx) {
    if (!selector) return true;
    if (selector.family && selector.family !== ctx.family) return false;
    if (selector.modelSizeTag && selector.modelSizeTag !== getModelSizeTag(ctx)) return false;
    return true;
  }

  function localize(meta, lang) {
    if (!meta) return null;
    return { label: lang === 'ru' ? meta.labelRu : meta.labelEn, className: meta.className, title: lang === 'ru' ? meta.titleRu : meta.titleEn };
  }

  function buildContext(ctx, helpers) {
    const family = ctx.family || (helpers.detectModelFamily ? helpers.detectModelFamily(ctx.state || {}, ctx.meta) : 'other');
    const modelPath = ctx.modelPath || (ctx.state && ctx.state.model) || '';
    const modelType = ctx.modelType || (ctx.state && ctx.state.model_type) || 'dense';
    const workload = ctx.workload || (ctx.state && ctx.state.workload_profile) || 'mixed';
    const isSwapBound = typeof ctx.isSwapBound === 'boolean' ? ctx.isSwapBound : (helpers.isSwapBound ? helpers.isSwapBound(ctx.state || {}, ctx.profile || {}) : false);
    return { ...ctx, family, modelPath, modelType, workload, isSwapBound };
  }

  function getApplicabilityBadge(paramId, rawCtx, lang) {
    const entry = EXPERIMENTAL_KNOB_EVIDENCE[paramId];
    return localize(APPLICABILITY_META[(entry && entry.applicability) || 'all'] || APPLICABILITY_META.all, lang);
  }

  function getRuntimeSupportBadge(paramId, rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const entry = EXPERIMENTAL_KNOB_EVIDENCE[paramId];
    if (!entry) return null;
    if (entry.runtimeSupport === 'generic-moe-hot-expert-path' && ctx.modelType !== 'moe') return localize(RUNTIME_SUPPORT_META.inactive, lang);
    return localize(RUNTIME_SUPPORT_META[entry.runtimeSupport] || RUNTIME_SUPPORT_META.universal, lang);
  }

  function getValidationBadge(paramId, rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const family = ctx.family;
    const modelSizeTag = getModelSizeTag(ctx);
    if (paramId === 'hot_expert_budget') return localize(family === 'minimax' ? VALIDATION_META.partial : VALIDATION_META.research, lang);
    if (paramId === 'hot_expert_selection' || paramId === 'hot_expert_tail_window') return localize((family === 'minimax' || family === 'gpt-oss') ? VALIDATION_META.partial : VALIDATION_META.research, lang);
    if (paramId === 'prompt_packed_qkv' || paramId === 'prompt_packed_qkv_preset' || paramId === 'prompt_packed_qkv_range') {
      if (family === 'gpt-oss' && modelSizeTag === '120b') return localize(VALIDATION_META.validated, lang);
      if (family === 'gpt-oss' || family === 'qwen3moe') return localize(VALIDATION_META.partial, lang);
      return localize(VALIDATION_META.research, lang);
    }
    const entry = EXPERIMENTAL_KNOB_EVIDENCE[paramId];
    return localize(VALIDATION_META[(entry && entry.validation) || 'research'] || VALIDATION_META.research, lang);
  }

  function getConfidenceBadge(paramId, rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const family = ctx.family;
    const modelSizeTag = getModelSizeTag(ctx);
    let level = 'none';
    let titleRu = '';
    let titleEn = '';
    if (paramId === 'hot_expert_budget' || paramId === 'hot_expert_selection' || paramId === 'hot_expert_tail_window') {
      if (family === 'minimax') { level = 'medium'; titleRu = 'Tested on: MiniMax. Есть benchmark-backed signal, но этого еще недостаточно для promoted default.'; titleEn = 'Tested on: MiniMax. There is benchmark-backed signal, but not enough yet for a promoted default.'; }
      else if (family === 'gpt-oss') { level = 'low'; titleRu = 'Tested on: gpt-oss-20b. Signal положительный, но слабый и пока не baseline-changing.'; titleEn = 'Tested on: gpt-oss-20b. The signal is positive but weak and not baseline-changing yet.'; }
      else { level = 'none'; titleRu = 'Tested on: MiniMax, gpt-oss-20b. Для остальных MoE это пока открытая research territory.'; titleEn = 'Tested on: MiniMax, gpt-oss-20b. For other MoE families this is still open research territory.'; }
    } else if (paramId === 'prompt_packed_qkv' || paramId === 'prompt_packed_qkv_preset' || paramId === 'prompt_packed_qkv_range') {
      if (family === 'gpt-oss' && modelSizeTag === '120b') { level = 'high'; titleRu = 'Tested on: gpt-oss-120b. Это strongest practical signal в current Phase 3.'; titleEn = 'Tested on: gpt-oss-120b. This is the strongest practical signal in current Phase 3.'; }
      else if (family === 'gpt-oss') { level = 'low'; titleRu = 'Tested on: gpt-oss-20b. Prompt-side gain подтвержден, но mixed-path practical value почти нейтральна.'; titleEn = 'Tested on: gpt-oss-20b. Prompt-side gain is confirmed, but mixed-path practical value is close to neutral.'; }
      else if (family === 'qwen3moe') { level = 'low'; titleRu = 'Tested on: Qwen3-30B-A3B. Prompt-side gain подтвержден, но mixed-path practical value слабая.'; titleEn = 'Tested on: Qwen3-30B-A3B. Prompt-side gain is confirmed, but mixed-path practical value remains weak.'; }
      else { level = 'none'; titleRu = 'Tested on: gpt-oss-120b, gpt-oss-20b, Qwen3-30B-A3B. Для остальных split-QKV моделей уверенность пока не заявляется.'; titleEn = 'Tested on: gpt-oss-120b, gpt-oss-20b, Qwen3-30B-A3B. Confidence is not claimed yet for other split-QKV models.'; }
    } else {
      const entry = EXPERIMENTAL_KNOB_EVIDENCE[paramId];
      if (entry && entry.validation === 'helper') { level = 'helper'; titleRu = 'Helper/tooling control. Здесь важна usability, а не benchmark confidence.'; titleEn = 'Helper/tooling control. Usability matters here more than benchmark confidence.'; }
      else if (entry && entry.validation === 'research') { level = 'none'; titleRu = 'Для этого knob пока нет достаточно сильного practical signal.'; titleEn = 'There is not yet a strong enough practical signal for this knob.'; }
    }
    const meta = CONFIDENCE_META[level] || CONFIDENCE_META.none;
    return { label: lang === 'ru' ? meta.labelRu : meta.labelEn, className: meta.className, title: lang === 'ru' ? titleRu : titleEn };
  }

  function listTestedOn(paramId) { return (EXPERIMENTAL_KNOB_EVIDENCE[paramId] && EXPERIMENTAL_KNOB_EVIDENCE[paramId].testedOn) || []; }
  function explainFailureMode(paramId, lang) { const entry = EXPERIMENTAL_KNOB_EVIDENCE[paramId]; return entry ? (lang === 'ru' ? entry.failureModeRu : entry.failureModeEn) : ''; }

  function getKnobEvidence(paramId, rawCtx, lang, helpers) {
    const entry = EXPERIMENTAL_KNOB_EVIDENCE[paramId];
    if (!entry) return null;
    return {
      id: entry.id,
      applicability: getApplicabilityBadge(paramId, rawCtx, lang, helpers),
      runtimeSupport: getRuntimeSupportBadge(paramId, rawCtx, lang, helpers),
      validation: getValidationBadge(paramId, rawCtx, lang, helpers),
      confidence: getConfidenceBadge(paramId, rawCtx, lang, helpers),
      risk: { level: entry.risk, label: lang === 'ru' ? RISK_META[entry.risk].labelRu : RISK_META[entry.risk].labelEn },
      testedOn: listTestedOn(paramId),
      failureMode: explainFailureMode(paramId, lang)
    };
  }

  function getExperimentalPresetDescription(cfg, lang, translate) {
    if (cfg.desc) return lang === 'ru' ? cfg.desc.ru : cfg.desc.en;
    if (cfg.descKey && typeof translate === 'function') return translate(cfg.descKey);
    return '';
  }
  function getPresetScopeLabel(scope, lang) { if (scope === 'moe') return 'MoE'; if (scope === 'dense') return 'Dense'; return 'Generic'; }
  function getPresetRiskLabel(risk, lang) { return lang === 'ru' ? RISK_META[risk].labelRu : RISK_META[risk].labelEn; }
  function getPresetConfidenceLevel(cfg, rawCtx, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const entries = (cfg.confidence && cfg.confidence.entries) || [];
    for (const entry of entries) if (matchesSelector(entry.selector, ctx)) return entry.level;
    return (cfg.confidence && cfg.confidence.fallback) || 'none';
  }
  function getPresetEvidence(presetId, rawCtx, lang, translate, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const cfg = EXPERIMENTAL_PRESET_EVIDENCE[presetId] || EXPERIMENTAL_PRESET_EVIDENCE.none;
    const familyNote = cfg.familyHint.length && !cfg.familyHint.includes(ctx.family)
      ? (lang === 'ru'
        ? ` Этот пресет рассчитан прежде всего на ${cfg.familyHint.join(', ')}.`
        : ` This preset is tuned primarily for ${cfg.familyHint.join(', ')}.`)
      : '';
    const confidenceLevel = getPresetConfidenceLevel(cfg, ctx, helpers || {});
    return {
      ...cfg,
      titleText: lang === 'ru' ? cfg.title.ru : cfg.title.en,
      description: getExperimentalPresetDescription(cfg, lang, translate),
      note: familyNote,
      scopeLabel: getPresetScopeLabel(cfg.scope, lang),
      riskLabel: getPresetRiskLabel(cfg.risk, lang),
      confidenceLevel,
      confidenceBadge: CONFIDENCE_META[confidenceLevel] ? { label: lang === 'ru' ? CONFIDENCE_META[confidenceLevel].labelRu : CONFIDENCE_META[confidenceLevel].labelEn, className: CONFIDENCE_META[confidenceLevel].className } : null
    };
  }
  function listExperimentalPresets() { return Object.entries(EXPERIMENTAL_PRESET_EVIDENCE); }

  global.IKLLamaEvidenceLayer = {
    APPLICABILITY_META, RUNTIME_SUPPORT_META, VALIDATION_META, CONFIDENCE_META, RISK_META,
    EXPERIMENTAL_KNOB_EVIDENCE, EXPERIMENTAL_PRESET_EVIDENCE,
    getKnobEvidence, getPresetEvidence, getApplicabilityBadge, getRuntimeSupportBadge, getValidationBadge, getConfidenceBadge,
    listTestedOn, explainFailureMode, listExperimentalPresets, getPresetRiskLabel, getPresetScopeLabel
  };
})(window);
