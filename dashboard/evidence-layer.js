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
    hot_expert_tail_blend: { id: 'hot_expert_tail_blend', applicability: 'moe-huge', runtimeSupport: 'generic-moe-hot-expert-path', validation: 'research', risk: 'low', failureModeRu: 'Неудачный blend factor может не улучшить hot-set selection по сравнению с hard reset.', failureModeEn: 'A suboptimal blend factor may not improve hot-set selection compared to hard reset.', testedOn: [] },
    merge_qkv: { id: 'merge_qkv', applicability: 'arch-specific', runtimeSupport: 'arch-sensitive', validation: 'research', risk: 'medium', failureModeRu: 'Слабый или отрицательный win из-за неудачного attention/layout path.', failureModeEn: 'Weak or negative win due to an unfavorable attention/layout path.', testedOn: [] },
    prompt_packed_qkv: { id: 'prompt_packed_qkv', applicability: 'split-qkv', runtimeSupport: 'split-qkv-generic-auto-family-first', validation: 'partial', risk: 'high', failureModeRu: 'Дополнительная RAM, более долгий load/startup, и на части families prompt-side gain без strong mixed-path value.', failureModeEn: 'Extra RAM, longer load/startup, and on some families prompt-side gain without strong mixed-path value.', testedOn: ['gpt-oss-120b', 'gpt-oss-20b', 'Qwen3-30B-A3B'] },
    prompt_packed_qkv_preset: { id: 'prompt_packed_qkv_preset', applicability: 'split-qkv', runtimeSupport: 'split-qkv-generic-auto-family-first', validation: 'partial', risk: 'high', failureModeRu: 'Неподходящий preset или family mismatch.', failureModeEn: 'Suboptimal preset or family mismatch.', testedOn: ['gpt-oss-120b', 'gpt-oss-20b', 'Qwen3-30B-A3B'] },
    prompt_packed_qkv_range: { id: 'prompt_packed_qkv_range', applicability: 'split-qkv', runtimeSupport: 'split-qkv-generic-auto-family-first', validation: 'research', risk: 'high', failureModeRu: 'Ручной диапазон может ухудшить RAM/load time или не дать useful prompt win.', failureModeEn: 'A manual range may hurt RAM/load time or fail to provide a useful prompt win.', testedOn: [] },
    live_observability: { id: 'live_observability', applicability: 'all', runtimeSupport: 'dashboard-only', validation: 'helper', risk: 'low', failureModeRu: 'Лишний trace noise, если нужен максимально чистый benchmark.', failureModeEn: 'Extra trace noise when you want the cleanest possible benchmark.', testedOn: [] },
    experimental_preset: { id: 'experimental_preset', applicability: 'all', runtimeSupport: 'helper', validation: 'helper', risk: 'low', failureModeRu: 'Может включить bundle, который пользователь не до конца понимает.', failureModeEn: 'May enable a bundle that the user does not fully understand.', testedOn: [] },
    experimental_preset_link_validated: { id: 'experimental_preset_link_validated', applicability: 'all', runtimeSupport: 'helper', validation: 'helper', risk: 'low', failureModeRu: 'Пресет может перестроить validated baseline шире, чем ожидал пользователь.', failureModeEn: 'A preset may modify the validated baseline more broadly than the user expected.', testedOn: [] },
    n_cpu_moe: { id: 'n_cpu_moe', applicability: 'moe', runtimeSupport: 'universal', validation: 'research', risk: 'medium', failureModeRu: 'Слишком большое значение оставит мало MoE-слоёв на GPU/быстром пути; слишком маленькое не разгрузит CPU. Локально (CPU-only) обычно ставится в полное число MoE-слоёв или 0 — нет рычага без gpu offload.', failureModeEn: 'Too large a value leaves few MoE layers on GPU/fast path; too small does not offload to CPU. On CPU-only setups it is usually set to all-MoE-layers or 0 — there is little leverage without GPU offload.', testedOn: [] },
    defer_experts: { id: 'defer_experts', applicability: 'moe-huge', runtimeSupport: 'universal', validation: 'research', risk: 'medium', failureModeRu: 'Может задержать первый dispatch экспертов и менять время load vs. first-token, без подтверждённого выигрыша на нашем CPU-only Zen4 baseline.', failureModeEn: 'May delay first expert dispatch and shift load vs. first-token timing without a confirmed win on our CPU-only Zen4 baseline.', testedOn: [] },
    dry_run: { id: 'dry_run', applicability: 'all', runtimeSupport: 'helper', validation: 'helper', risk: 'low', failureModeRu: 'Только валидирует загрузку модели, не запускает inference. Ошибки сценариев нужно ловить отдельно.', failureModeEn: 'Only validates that the model loads; does not run inference. Scenario errors must be caught separately.', testedOn: [] },
    minilog: { id: 'minilog', applicability: 'all', runtimeSupport: 'helper', validation: 'helper', risk: 'low', failureModeRu: 'Минимизирует log-spam на server-side. Может скрыть важные warnings — для diagnostic-сценариев лучше оставить выключенным.', failureModeEn: 'Minimizes log spam on server side. May hide useful warnings — keep disabled for diagnostic scenarios.', testedOn: [] },
    rtr_auto_v2: { id: 'rtr_auto_v2', applicability: 'all', runtimeSupport: 'load-time-policy', validation: 'partial', risk: 'low', failureModeRu: 'Probe failure или OS-query failure в safety-first режиме отключают repack с WARN; на dense моделях NOT_APPLICABLE без побочных эффектов. Riск минимален — флаг локально-only, default unchanged.', failureModeEn: 'Probe failure or OS-query failure in safety-first mode disable repack with a WARN; on dense models NOT_APPLICABLE has no side effects. Risk is minimal — flag is local-only and default behavior is unchanged.', testedOn: ['Qwen3-30B-A3B', 'gpt-oss-20b', 'gpt-oss-120b', 'Qwen3.5-27B', 'Qwen3.5-397B-A17B', 'MiniMax M2.5 Tapered-RAM'] }
  };

  const EXPERIMENTAL_PRESET_EVIDENCE = {
    none: { id: 'none', title: { ru: 'Manual / off', en: 'Manual / off' }, descKey: 'exp_preset_none', risk: 'low', scope: 'generic', familyHint: [], testedOn: [], validation: 'helper', confidence: { fallback: 'helper' }, experimental: {}, validated: {} },
    'minimax-mixed-locality': { id: 'minimax-mixed-locality', title: { ru: 'MiniMax mixed locality', en: 'MiniMax mixed locality' }, descKey: 'exp_preset_minimax', risk: 'medium', scope: 'moe', familyHint: ['minimax'], testedOn: ['MiniMax M2.5'], validation: 'partial', confidence: { fallback: 'medium' }, experimental: { hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'tail-window', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { workload_profile: 'mixed', flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false } },
    'minimax-locality-aggressive': { id: 'minimax-locality-aggressive', title: { ru: 'MiniMax locality aggressive', en: 'MiniMax locality aggressive' }, desc: { ru: 'Более рискованный вариант для huge MiniMax: сохраняет tail-window selection, но дополнительно поднимает Hot Expert Budget до 24. Теоретически может лучше удерживать ранний decode, но длинные прогоны не подтвердили это как новый default.', en: 'A riskier huge-MiniMax variant: keeps tail-window selection and also raises Hot Expert Budget to 24. It may hold early decode better in theory, but longer runs did not validate it as a new default.' }, risk: 'high', scope: 'moe', familyHint: ['minimax'], testedOn: ['MiniMax M2.5'], validation: 'research', confidence: { fallback: 'low' }, experimental: { hot_expert_budget: 24, hot_expert_budget_mult: 0, hot_expert_selection: 'tail-window', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { workload_profile: 'mixed', flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false } },
    'minimax-tapered-ram-hot': { id: 'minimax-tapered-ram-hot', title: { ru: 'Tapered-RAM hot experts', en: 'Tapered-RAM hot experts' }, desc: { ru: 'Для кастомного кванта Tapered-RAM (~91 GiB): модель на границе in-RAM, поэтому hot expert budget может реально помочь — удерживаем 16 экспертов горячими, tail-window=16 для стабильного decode. SER выключен, rtr=off (repack может увеличить потребление за границу RAM).', en: 'For custom Tapered-RAM quant (~91 GiB): model is on the edge of fitting in RAM, so hot expert budget may genuinely help — keep 16 experts hot, tail-window=16 for stable decode. SER off, rtr=off (repack may push memory over the RAM limit).' }, risk: 'medium', scope: 'moe', familyHint: ['minimax'], testedOn: ['MiniMax M2.5 Tapered-RAM'], validation: 'research', confidence: { fallback: 'low' }, experimental: { hot_expert_budget: 16, hot_expert_budget_mult: 0, hot_expert_selection: 'tail-window', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { workload_profile: 'mixed', flash_attn: true, repack_tensors: 'off', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', n_ctx: 4096 } },
    'minimax-tapered-ram-ser': { id: 'minimax-tapered-ram-ser', title: { ru: 'Tapered-RAM SER + hot', en: 'Tapered-RAM SER + hot' }, desc: { ru: 'Таpered-RAM с SER: обрезаем экспертов с весом <5% (min 4 останутся), hot budget 16, tail-window 16. Потенциально быстрее за счёт меньшего I/O, но риск потери качества. Сравнивать поштучно с safe baseline и hot-only пресетом.', en: 'Tapered-RAM with SER: prune experts below 5% weight (min 4 remain), hot budget 16, tail-window 16. Potentially faster via less I/O, but quality risk. Compare one-knob-at-a-time against safe baseline and hot-only preset.' }, risk: 'high', scope: 'moe', familyHint: ['minimax'], testedOn: ['MiniMax M2.5 Tapered-RAM'], validation: 'research', confidence: { fallback: 'none' }, experimental: { hot_expert_budget: 16, hot_expert_budget_mult: 0, hot_expert_selection: 'tail-window', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: true, ser_min: 4, ser_thresh: 0.05 }, validated: { workload_profile: 'mixed', flash_attn: true, repack_tensors: 'off', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', n_ctx: 4096 } },
    'qwen-prompt-packed': { id: 'qwen-prompt-packed', title: { ru: 'Qwen prompt-packed', en: 'Qwen prompt-packed' }, descKey: 'exp_preset_qwen', risk: 'high', scope: 'moe', familyHint: ['qwen3moe'], testedOn: ['Qwen3-30B-A3B'], validation: 'partial', confidence: { fallback: 'low' }, experimental: { hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: true, prompt_packed_qkv_preset: 'front-half', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { flash_attn: true, graph_reuse: true, repack_tensors: 'auto' } },
    'gptoss-prompt-packed': { id: 'gptoss-prompt-packed', title: { ru: 'gpt-oss prompt-packed', en: 'gpt-oss prompt-packed' }, descKey: 'exp_preset_gptoss', risk: 'medium', scope: 'moe', familyHint: ['gpt-oss'], testedOn: ['gpt-oss-120b', 'gpt-oss-20b'], validation: 'validated', confidence: { entries: [{ selector: { family: 'gpt-oss', modelSizeTag: '120b' }, level: 'medium' }, { selector: { family: 'gpt-oss', modelSizeTag: '20b' }, level: 'low' }], fallback: 'none' }, experimental: { hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: true, prompt_packed_qkv_preset: 'back-half', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { flash_attn: true, graph_reuse: true, repack_tensors: 'auto' } },
    'gptoss120b-optimized': { id: 'gptoss120b-optimized', title: { ru: 'gpt-oss-120b all-in', en: 'gpt-oss-120b all-in' }, desc: { ru: 'Лучший известный конфиг для gpt-oss-120b: ctk q4_0 (+14.5% PP, подтверждено r=5) + prompt-packed back-half (+3.45% PP, 0% регрессия TG). Суммарный выигрыш по PP ≈ +18%. Доп. RAM на packed-матрицы (~270 MiB). Не применять к gpt-oss-20b — там packed даёт слабый mixed-path signal.', en: 'Best-known config for gpt-oss-120b: ctk q4_0 (+14.5% PP, confirmed r=5) + prompt-packed back-half (+3.45% PP, 0% TG regression). Combined PP gain ≈ +18%. Extra RAM for packed matrices (~270 MiB). Do not apply to gpt-oss-20b — packed has weak mixed-path signal there.' }, risk: 'high', scope: 'moe-huge', familyHint: ['gpt-oss'], testedOn: ['gpt-oss-120b'], validation: 'validated', confidence: { entries: [{ selector: { family: 'gpt-oss', modelSizeTag: '120b' }, level: 'high' }], fallback: 'none' }, experimental: { hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, merge_qkv: false, prompt_packed_qkv: true, prompt_packed_qkv_preset: 'back-half', prompt_packed_qkv_range: '', ser_enabled: false }, validated: { flash_attn: true, graph_reuse: true, repack_tensors: 'auto', cache_type_k: 'q4_0', cache_type_v: 'q8_0' } },
    'attention-merge-qkv': { id: 'attention-merge-qkv', title: { ru: 'Attention merge-qkv', en: 'Attention merge-qkv' }, descKey: 'exp_preset_merge_qkv', risk: 'medium', scope: 'generic', familyHint: ['qwen3moe', 'gpt-oss', 'other'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { merge_qkv: true, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '' }, validated: { flash_attn: true, graph_reuse: true } },
    'huge-moe-ser-light': { id: 'huge-moe-ser-light', title: { ru: 'Huge MoE SER light', en: 'Huge MoE SER light' }, desc: { ru: 'Мягкий router-side эксперимент для больших MoE: включает SER с min=4 и threshold=0.05. Идея — отрезать очень слабых экспертов и уменьшить I/O, не делая pruning слишком агрессивным.', en: 'A mild router-side experiment for large MoE: enables SER with min=4 and threshold=0.05. The goal is to prune very weak experts and reduce I/O without making pruning too aggressive.' }, risk: 'medium', scope: 'moe', familyHint: ['minimax', 'qwen3moe', 'gpt-oss'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { ser_enabled: true, ser_min: 4, ser_thresh: 0.05, hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '' }, validated: { flash_attn: true, merge_up_gate_exps: false } },
    'huge-moe-ser-aggressive': { id: 'huge-moe-ser-aggressive', title: { ru: 'Huge MoE SER aggressive', en: 'Huge MoE SER aggressive' }, desc: { ru: 'Более рискованный router-side bundle для больших MoE: SER с min=3 и threshold=0.10. Теоретически может сильнее разгрузить I/O, но риск потери качества и нестабильности решения роутера выше.', en: 'A more aggressive router-side bundle for large MoE: SER with min=3 and threshold=0.10. It may reduce I/O further in theory, but quality loss and routing instability risk are higher.' }, risk: 'high', scope: 'moe', familyHint: ['minimax', 'qwen3moe', 'gpt-oss'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { ser_enabled: true, ser_min: 3, ser_thresh: 0.10, hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '' }, validated: { flash_attn: true, merge_up_gate_exps: false } },
    'dense-attention-locality': { id: 'dense-attention-locality', title: { ru: 'Dense attention locality', en: 'Dense attention locality' }, desc: { ru: 'Универсальный attention-side эксперимент для dense и mixed семей: Merge QKV + Flash Attention + Graph Reuse. Не требует MoE-логики и подходит как мягкий baseline experiment для неизвестных dense моделей.', en: 'A generic attention-side experiment for dense and mixed families: Merge QKV + Flash Attention + Graph Reuse. It does not rely on MoE logic and can serve as a mild baseline experiment for unknown dense models.' }, risk: 'low', scope: 'dense', familyHint: ['other'], testedOn: [], validation: 'research', confidence: { fallback: 'none' }, experimental: { merge_qkv: true, prompt_packed_qkv: false, prompt_packed_qkv_preset: 'auto', prompt_packed_qkv_range: '', ser_enabled: false, hot_expert_budget: 0, hot_expert_budget_mult: 0, hot_expert_selection: 'default', hot_expert_tail_window: 16 }, validated: { flash_attn: true, graph_reuse: true } }
  };

  const STANDARD_PRESET_EVIDENCE = {
    moe_in_ram: {
      id: 'moe_in_ram',
      title: { ru: 'MoE (в RAM)', en: 'MoE (In-RAM)' },
      description: { ru: 'Qwen3-30B-A3B, gpt-oss-20b и похожие in-RAM / near-RAM MoE. rtr=auto даёт +15.6% PP / +5.4% TG vs rtr=off на Zen4 (Qwen3-30B Q4_K_M r=5, 2026-05-05).', en: 'Qwen3-30B-A3B, gpt-oss-20b, and similar in-RAM / near-RAM MoE. rtr=auto gives +15.6% PP / +5.4% TG vs rtr=off on Zen4 (Qwen3-30B Q4_K_M r=5, 2026-05-05).' },
      applicability: 'moe',
      validation: 'validated',
      confidence: 'medium',
      values: { threads: 16, flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', model_type: 'moe' }
    },
    gptoss_huge_throughput: {
      id: 'gptoss_huge_throughput',
      title: { ru: 'gpt-oss-120b (throughput)', en: 'gpt-oss-120b (Throughput)' },
      description: { ru: 'gpt-oss-120b: ctk q4_0 подтверждён (+14.5% PP, нейтральный TG, bench r=5).', en: 'gpt-oss-120b: ctk q4_0 confirmed (+14.5% PP, neutral TG, bench r=5).' },
      applicability: 'moe-huge',
      validation: 'validated',
      confidence: 'high',
      values: { threads: 16, flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false, cache_type_k: 'q4_0', cache_type_v: 'q8_0', model_type: 'moe', workload_profile: 'mixed' }
    },
    qwen3moe_30b: {
      id: 'qwen3moe_30b',
      title: { ru: 'Qwen3-30B-A3B', en: 'Qwen3-30B-A3B' },
      description: { ru: 'Qwen3-30B-A3B: оптимальный baseline, TG стабилен при любой длине ответа. rtr=auto подтверждён +15.6% PP / +5.4% TG vs rtr=off (r=5, 2026-05-05).', en: 'Qwen3-30B-A3B: optimal baseline, TG is stable at any output length. rtr=auto confirmed +15.6% PP / +5.4% TG vs rtr=off (r=5, 2026-05-05).' },
      applicability: 'moe',
      validation: 'validated',
      confidence: 'high',
      values: { threads: 16, flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', model_type: 'moe', workload_profile: 'mixed' }
    },
    minimax_huge_safe: {
      id: 'minimax_huge_safe',
      title: { ru: 'MiniMax huge (safe baseline)', en: 'MiniMax huge (safe baseline)' },
      description: { ru: 'MiniMax M2.5 UD-Q5 и другие huge-кванты (>100 GiB): консервативный OFF-baseline для явно swap-bound моделей. Forced rtr=1 на 89.6 GiB модели = 213.8 sec cold load penalty (vs ~30 sec для off/auto-disable, 2026-05-05). v2 auto-policy при включении даёт тот же DISABLE.', en: 'MiniMax M2.5 UD-Q5 and other huge quants (>100 GiB): conservative OFF baseline for clearly swap-bound models. Forced rtr=1 on a 89.6 GiB model costs 213.8 sec cold load (vs ~30 sec for off/auto-disable, 2026-05-05). v2 auto-policy reaches the same DISABLE when enabled.' },
      applicability: 'moe-huge',
      validation: 'partial',
      confidence: 'medium',
      values: { threads: 16, flash_attn: true, repack_tensors: 'off', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', model_type: 'moe', workload_profile: 'mixed', n_ctx: 4096 }
    },
    minimax_tapered_ram: {
      id: 'minimax_tapered_ram',
      title: { ru: 'MiniMax Tapered-RAM (~91 GiB)', en: 'MiniMax Tapered-RAM (~91 GiB)' },
      description: { ru: 'Кастомный квант Tapered-RAM: почти влезает в 96 GB RAM при малом контексте. Безопасный baseline. v2 auto-policy с available memory (~78-88 GiB) корректно DISABLE на этой модели; rtr=auto+v2 эквивалентен rtr=off, без 3.5 min cold-load penalty от forced rtr=1 (2026-05-05).', en: 'Custom Tapered-RAM quant: nearly fits in 96 GB RAM with small context. Safe baseline. v2 auto-policy using available memory (~78-88 GiB) correctly DISABLEs on this model; rtr=auto+v2 is equivalent to rtr=off, without the 3.5 min cold-load penalty of forced rtr=1 (2026-05-05).' },
      applicability: 'moe-huge',
      validation: 'partial',
      confidence: 'medium',
      values: { threads: 16, flash_attn: true, repack_tensors: 'off', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', model_type: 'moe', workload_profile: 'mixed', n_ctx: 4096 }
    },
    minimax_tapered_ram_experimental: {
      id: 'minimax_tapered_ram_experimental',
      title: { ru: 'MiniMax Tapered-RAM (experimental)', en: 'MiniMax Tapered-RAM (experimental)' },
      description: { ru: 'Tapered-RAM с экспериментальными knobs: rtr=auto, hot experts, SER. Сравнивать с safe baseline поштучно.', en: 'Tapered-RAM with experimental knobs: rtr=auto, hot experts, SER. Compare against safe baseline one knob at a time.' },
      applicability: 'moe-huge',
      validation: 'experimental',
      confidence: 'low',
      values: { threads: 16, flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', model_type: 'moe', workload_profile: 'mixed', n_ctx: 4096, ser_enabled: true, ser_min: 4, ser_thresh: 0.05, hot_expert_budget: 16 }
    },
    dense_in_ram: {
      id: 'dense_in_ram',
      title: { ru: 'Dense (в RAM)', en: 'Dense (In-RAM)' },
      description: { ru: 'Llama-3, Phi-4 и другие dense-модели, уверенно помещающиеся в RAM.', en: 'Llama-3, Phi-4, and other dense models that fit in RAM.' },
      applicability: 'dense',
      validation: 'validated',
      confidence: 'medium',
      values: { threads: 16, flash_attn: true, repack_tensors: 'on', merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'f16', model_type: 'dense' }
    },
    laptop_raptor_lake_16gb: {
      id: 'laptop_raptor_lake_16gb',
      title: { ru: 'Ноутбук (i7-1360p, 16 GB)', en: 'Laptop (i7-1360p, 16 GB)' },
      description: { ru: 'i7-1360p Raptor Lake mobile, 16 GB RAM, CPU-only. AVX-VNNI без AVX-512. Winning -t 4 (только P-cores). VNNI repack: +52% TG / +5% PP vs без repacking. MoE DISABLE порог: 14.1 ГБ (90% от total RAM). Не использовать -ctk q8_0 — CPU-only builds не поддерживают. Sweep 2026-05-21: t4 PP=20.8/TG=4.6, t8 PP=17.6/TG=3.5, t12 PP=8.3/TG=2.0. phi-4 14B: PP=10.4/TG=1.6. Термальный throttle при sustained load — использовать -r 1. Подробнее: project_docs/hardware/RAPTOR_LAKE_LAPTOP.md', en: 'i7-1360p Raptor Lake mobile, 16 GB RAM, CPU-only. AVX-VNNI without AVX-512. Winning -t 4 (P-cores only). VNNI repack: +52% TG / +5% PP vs no-repack. MoE DISABLE threshold: 14.1 GB (90% of total RAM). Do not use -ctk q8_0 — CPU-only builds do not support KV quant. Sweep 2026-05-21: t4 PP=20.8/TG=4.6, t8 PP=17.6/TG=3.5, t12 PP=8.3/TG=2.0. phi-4 14B: PP=10.4/TG=1.6. Thermal throttle under sustained load — use -r 1. Details: project_docs/hardware/RAPTOR_LAKE_LAPTOP.md' },
      applicability: 'all',
      validation: 'validated',
      confidence: 'high',
      values: { threads: 4, flash_attn: true, repack_tensors: 'auto', merge_up_gate_exps: false, cache_type_k: 'f16', cache_type_v: 'f16', model_type: 'mixed' }
    },
    server_prod: {
      id: 'server_prod',
      title: { ru: 'Сервер (Production)', en: 'Server (Production)' },
      description: { ru: 'llama-server с параллельными слотами и безопасным стартовым baseline.', en: 'llama-server with parallel slots and a safe starting baseline.' },
      applicability: 'all',
      validation: 'validated',
      confidence: 'medium',
      values: { threads: 16, flash_attn: true, repack_tensors: 'on', cache_type_k: 'q8_0', cache_type_v: 'f16', n_parallel: 4, hostname: '0.0.0.0', model_type: 'dense', target: 'llama-server' }
    },
    max_context: {
      id: 'max_context',
      title: { ru: 'Макс. контекст', en: 'Max Context' },
      description: { ru: 'Контекст-ориентированный preset с квантованным KV-кешем.', en: 'Context-oriented preset with a quantized KV cache.' },
      applicability: 'quantized-kv',
      validation: 'partial',
      confidence: 'low',
      values: { flash_attn: true, cache_type_k: 'q8_0', cache_type_v: 'q4_0', n_ctx: 131072 }
    }
  };

  const FAMILY_VALIDATION_EVIDENCE = {
    qwen3moe: {
      status: 'validated',
      noteRu: 'Для Qwen3MoE уже есть подтвержденная линия baseline/runtime guidance.',
      noteEn: 'Qwen3MoE already has a validated baseline/runtime guidance line.'
    },
    'gpt-oss': {
      status: 'validated',
      noteRu: 'Для gpt-oss есть validated baseline, но practical confidence по отдельным knobs уже различается между 20b и 120b.',
      noteEn: 'gpt-oss has a validated baseline, but practical confidence for individual knobs already differs between 20b and 120b.'
    },
    minimax: {
      status: 'partial',
      noteRu: 'MiniMax имеет подтвержденную huge-MoE линию, но часть runtime guidance все еще research/partial.',
      noteEn: 'MiniMax has a confirmed huge-MoE line, but part of its runtime guidance is still research/partial.'
    },
    qwen35: {
      status: 'partial',
      noteRu: 'Qwen3.5 — dense гибрид (attention + SSM). rtr off обязателен, MoE-knobs не применимы.',
      noteEn: 'Qwen3.5 is a dense hybrid (attention + SSM). rtr off is required, MoE knobs are not applicable.'
    },
    other: {
      status: 'unknown',
      noteRu: 'Для этой family пока нет validated product line. Используйте class-level guidance и отдельный A/B.',
      noteEn: 'This family does not yet have a validated product line. Use class-level guidance and a separate A/B.'
    }
  };

  const FAMILY_OVERVIEW_META = {
    qwen3moe: {
      valueRu: 'Qwen3MoE',
      valueEn: 'Qwen3MoE',
      noteRu: 'Для этой family уже есть подтвержденная baseline/runtime линия.',
      noteEn: 'This family already has a validated baseline/runtime line.'
    },
    'gpt-oss': {
      valueRu: 'gpt-oss',
      valueEn: 'gpt-oss',
      noteRu: 'Для gpt-oss есть подтвержденный baseline, но practical value отдельных knobs уже различается между 20b и 120b.',
      noteEn: 'gpt-oss has a validated baseline, but the practical value of individual knobs already differs between 20b and 120b.'
    },
    minimax: {
      valueRu: 'MiniMax M2.5',
      valueEn: 'MiniMax M2.5',
      noteRu: 'Huge-MoE линия подтверждена, но часть runtime guidance все еще остается research/partial.',
      noteEn: 'The huge-MoE line is confirmed, but part of the runtime guidance is still research/partial.'
    },
    qwen35: {
      valueRu: 'Qwen3.5',
      valueEn: 'Qwen3.5',
      noteRu: 'Dense гибридная модель (attention + SSM/Mamba). Используйте rtr off, MoE-knobs не применимы.',
      noteEn: 'Dense hybrid model (attention + SSM/Mamba). Use rtr off, MoE knobs are not applicable.'
    },
    other: {
      valueRu: 'Не определено',
      valueEn: 'Not detected',
      noteRu: 'Семейство пока не определено. Выберите GGUF и дайте dashboard прочитать путь и размер модели.',
      noteEn: 'The family is not detected yet. Pick a GGUF and let the dashboard read model path and size first.'
    }
  };

  const OVERVIEW_VALIDATION_META = {
    validated: {
      valueRu: 'Подтверждено',
      valueEn: 'Validated'
    },
    partial: {
      valueRu: 'Частично',
      valueEn: 'Partial'
    },
    unknown: {
      valueRu: 'Нет validated-линии',
      valueEn: 'No validated line'
    }
  };

  const MODEL_BADGE_META = {
    family: {
      qwen3moe: { labelRu: 'Семейство: Qwen3MoE', labelEn: 'Family: Qwen3MoE', className: 'family-qwen' },
      'gpt-oss': { labelRu: 'Семейство: gpt-oss', labelEn: 'Family: gpt-oss', className: 'family-gptoss' },
      minimax: { labelRu: 'Семейство: MiniMax M2.5', labelEn: 'Family: MiniMax M2.5', className: 'family-minimax' },
      qwen35: { labelRu: 'Семейство: Qwen3.5', labelEn: 'Family: Qwen3.5', className: 'family-qwen' },
      other: { labelRu: 'Семейство: Не определено', labelEn: 'Family: Not detected', className: 'family-generic' }
    },
    path: {
      inram: { labelRu: 'Путь: in-RAM профиль', labelEn: 'Path: in-RAM profile', className: 'family-generic' },
      swap: { labelRu: 'Путь: swap-bound профиль', labelEn: 'Path: swap-bound profile', className: 'family-generic' }
    },
    workload: {
      tg: { labelRu: 'TG-only фокус', labelEn: 'TG-only focus', className: 'family-generic' },
      pp: { labelRu: 'PP фокус', labelEn: 'PP focus', className: 'family-generic' },
      mixed: { labelRu: 'mixed-path важен', labelEn: 'mixed-path matters', className: 'family-generic' }
    },
    status: {
      validated: { labelRu: 'Статус: validated baseline', labelEn: 'Status: validated baseline', className: 'status-validated' },
      partial: { labelRu: 'Статус: research / partial', labelEn: 'Status: research / partial', className: 'status-partial' },
      unknown: { labelRu: 'Статус: unknown family', labelEn: 'Status: unknown family', className: 'status-unknown' }
    },
    experimental: {
      active: { labelRu: 'experimental knobs active', labelEn: 'experimental knobs active', className: 'status-experimental' }
    }
  };

  const OVERVIEW_ACTIONS = {
    model: {
      titleRu: 'Проверьте модель',
      titleEn: 'Check the model',
      bodyRu: 'Уточните путь, размер и family detection. От этого зависит весь остальной профиль.',
      bodyEn: 'Confirm path, size, and family detection. Everything else depends on that.',
      labelRu: 'К модели',
      labelEn: 'Go to model',
      pane: 'model',
      defaultParam: 'model',
      accent: false
    },
    performance: {
      titleRu: 'Сведите performance baseline',
      titleEn: 'Lock the performance baseline',
      bodyRu: 'Проверьте workload, потоки, контекст и batching до тонкой оптимизации.',
      bodyEn: 'Check workload, threads, context, and batching before fine-grained optimization.',
      labelRu: 'К потокам',
      labelEn: 'Go to threads',
      pane: 'performance',
      defaultParam: 'threads',
      accent: false
    },
    optimization: {
      titleRu: 'Сверьте runtime policy',
      titleEn: 'Review runtime policy',
      bodyRu: 'Сравните RTR, KV cache и MoE knobs с текущими validated выводами.',
      bodyEn: 'Compare RTR, KV cache, and MoE knobs against the current validated conclusions.',
      labelRu: 'К RTR',
      labelEn: 'Go to RTR',
      pane: 'optimization',
      defaultParam: 'repack_tensors',
      accent: false
    },
    launch: {
      titleRu: 'Соберите и запустите команду',
      titleEn: 'Build and launch',
      bodyRu: 'Проверьте сгенерированную команду, затем стартуйте процесс из рабочего launch-pane.',
      bodyEn: 'Review the generated command, then start the process from the launch pane.',
      labelRu: 'К запуску',
      labelEn: 'Go to launch',
      pane: 'launch',
      defaultParam: '',
      accent: true
    },
    runtime: {
      titleRu: 'Следите за runtime',
      titleEn: 'Watch runtime',
      bodyRu: 'После запуска переходите в Runtime: там интерактивные панели, логи и live observability.',
      bodyEn: 'After launch, move to Runtime for interactive panels, logs, and live observability.',
      labelRu: 'К Runtime',
      labelEn: 'Go to runtime',
      pane: 'runtime',
      defaultParam: '',
      accent: true
    }
  };

  const AUTOCONFIG_RTR_POLICIES = [
    {
      id: 'minimax-swap',
      matches: (ctx) => ctx.family === 'minimax' && ctx.isSwapBound,
      mode: 'off',
      reasons: {
        ru: [
          { value: 'OFF', text: 'rtr OFF: MiniMax в swap-bound режиме всё ещё самый консервативный старт, особенно если вас интересует TG-only.' },
          { value: 'AUTO?', text: 'Для mixed path у MiniMax уже есть подтвержденный смысл отдельно сравнивать AUTO: после фикса policy bug он больше не считается заведомо плохим.' }
        ],
        en: [
          { value: 'OFF', text: 'rtr OFF: MiniMax in swap-bound mode still has the most conservative starting point, especially if TG-only is what matters.' },
          { value: 'AUTO?', text: 'For MiniMax mixed path there is now a confirmed reason to compare against AUTO separately: after the policy fix it is no longer assumed bad.' }
        ]
      }
    },
    {
      id: 'gptoss-huge',
      matches: (ctx) => ctx.family === 'gpt-oss' && ctx.isSwapBound,
      mode: 'auto',
      reasons: {
        ru: [
          { value: 'AUTO', text: 'rtr AUTO: для huge gpt-oss это текущий throughput-first старт, но cold-start и load time будут заметно дороже, чем у OFF.' }
        ],
        en: [
          { value: 'AUTO', text: 'rtr AUTO: for huge gpt-oss this is the current throughput-first starting point, but cold-start and load time will be noticeably worse than OFF.' }
        ]
      }
    },
    {
      id: 'validated-moe',
      matches: (ctx) => ctx.family === 'qwen3moe' || ctx.family === 'gpt-oss',
      mode: 'auto',
      reasons: {
        ru: [
          { value: 'AUTO', text: 'rtr AUTO: текущий лучший общий старт для Qwen3MoE/gpt-oss на Zen4; mixed path нужно оценивать отдельно от TG.' }
        ],
        en: [
          { value: 'AUTO', text: 'rtr AUTO: current best general starting point for Qwen3MoE/gpt-oss on Zen4; mixed path must be judged separately from TG.' }
        ]
      }
    },
    {
      id: 'generic-moe-swap',
      matches: (ctx) => ctx.modelType === 'moe' && ctx.isSwapBound,
      mode: 'off',
      reasons: {
        ru: [
          { value: 'OFF', text: 'rtr OFF: для неизвестной swap-bound MoE безопаснее начать консервативно и потом отдельно проверить AUTO.' }
        ],
        en: [
          { value: 'OFF', text: 'rtr OFF: for an unknown swap-bound MoE it is safer to start conservatively and test AUTO separately later.' }
        ]
      }
    },
    {
      id: 'generic-moe-inram',
      matches: (ctx) => ctx.modelType === 'moe',
      mode: 'auto',
      reasons: {
        ru: [
          { value: 'AUTO', text: 'rtr AUTO: это ближайший текущий baseline для in-RAM MoE, но если семейство невалидированное — подтверждайте отдельным бенчем.' }
        ],
        en: [
          { value: 'AUTO', text: 'rtr AUTO: this is the closest current baseline for in-RAM MoE, but if the family is not validated yet, confirm it with a separate benchmark.' }
        ]
      }
    },
    {
      id: 'qwen35-hybrid',
      matches: (ctx) => ctx.family === 'qwen35',
      mode: 'off',
      reasons: {
        ru: [
          { value: 'OFF', text: 'rtr OFF: Qwen3.5 — гибридная архитектура (attention + SSM/Mamba). -rtr on вызывает зависание.' }
        ],
        en: [
          { value: 'OFF', text: 'rtr OFF: Qwen3.5 is a hybrid architecture (attention + SSM/Mamba). -rtr on causes hangs.' }
        ]
      }
    },
    {
      id: 'generic-dense-swap',
      matches: (ctx) => ctx.isSwapBound,
      mode: 'off',
      reasons: {
        ru: [
          { value: 'OFF', text: `rtr OFF: swap-bound dense-модель. Не форсируем repack на большой модели.` }
        ],
        en: [
          { value: 'OFF', text: 'rtr OFF: swap-bound dense model. Do not force repack on a large model.' }
        ]
      }
    },
    {
      id: 'generic-dense-inram',
      matches: () => true,
      mode: 'on',
      reasons: {
        ru: [
          { value: 'ON', text: 'rtr ON: плотная модель помещается в RAM, можно форсировать repack ради CPU locality.' }
        ],
        en: [
          { value: 'ON', text: 'rtr ON: a dense model fits in RAM, so forcing repack is reasonable for CPU locality.' }
        ]
      }
    }
  ];

  const HOT_EXPERT_GUIDANCE = [
    {
      id: 'minimax-swap',
      matches: (ctx) => ctx.family === 'minimax' && ctx.isSwapBound,
      recommendation: { budget: 0, budgetMult: 0, selection: 'default' },
      reasons: {
        ru: [
          { value: '0 / runtime default', text: 'Hot experts: первый более длинный controlled rtr=off run не подтвердил новый MiniMax default выше legacy 16. Для обычного запуска оставляйте 0 и не переопределяйте runtime default.' }
        ],
        en: [
          { value: '0 / runtime default', text: 'Hot experts: the first longer controlled rtr=off run did not confirm a new MiniMax default above the legacy 16 budget. For normal use, leave this at 0 and do not override the runtime default.' }
        ]
      }
    }
  ];

  const RUNTIME_PROFILE_EVIDENCE = [
    {
      id: 'qwen3moe-baseline',
      matches: (ctx) => ctx.family === 'qwen3moe' && !ctx.isSwapBound,
      titleRu: 'Qwen3MoE baseline',
      titleEn: 'Qwen3MoE baseline',
      defaults: { workload_profile: 'mixed', flash_attn: true, merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', graph_reuse: true },
      reasons: {
        ru: [
          { param: 'workload_profile', value: 'mixed', text: 'Профиль mixed: для Qwen3MoE current guidance строится вокруг prompt+generation, а не вокруг TG-only.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: для Qwen3MoE это current validated baseline.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: сильного validated upside для этого baseline нет.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: current baseline для экономии KV-памяти без заметной деградации.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: подтверждено нейтральным по скорости на Zen4 (2026-03-06). Экономит ~50% V-cache без деградации.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: оставляем включенным как базовый runtime path.' }
        ],
        en: [
          { param: 'workload_profile', value: 'mixed', text: 'Mixed workload: current Qwen3MoE guidance is built around prompt+generation rather than TG-only.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: this is the current validated baseline for Qwen3MoE.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: there is no strong validated upside for this baseline.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: current baseline to save KV memory without a noticeable regression.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: confirmed neutral in Zen4 benchmarks (2026-03-06). Saves ~50% V-cache with no regression.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: keep it enabled as the default runtime path.' }
        ]
      }
    },
    {
      id: 'gptoss20b-baseline',
      matches: (ctx) => ctx.family === 'gpt-oss' && getModelSizeTag(ctx) === '20b',
      titleRu: 'gpt-oss-20b throughput',
      titleEn: 'gpt-oss-20b throughput',
      defaults: { workload_profile: 'mixed', flash_attn: true, merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', graph_reuse: true },
      reasons: {
        ru: [
          { param: 'workload_profile', value: 'mixed', text: 'Профиль mixed: для gpt-oss-20b current baseline оценивается по prompt+generation, а не только по TG.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current validated baseline для gpt-oss-20b.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: на gpt-oss MXFP4 флаг -muge вызывает краш. Никогда не включать для этой family.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: оптимально для gpt-oss-20b MXFP4. Свип q5_1/q5_0/q4_1/q4_0 не дал улучшения PP/TG (bench r=3, 2026-03-06). ctk q4_0 дополнительно крашит llama-cli в интерактивном режиме.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: подтверждено нейтральным по скорости на Zen4 (2026-03-06). Экономит ~50% V-cache без деградации.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: оставляем включенным как базовый runtime path.' }
        ],
        en: [
          { param: 'workload_profile', value: 'mixed', text: 'Mixed workload: the current gpt-oss-20b baseline is judged by prompt+generation, not TG alone.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current validated baseline for gpt-oss-20b.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: -muge crashes on gpt-oss MXFP4 (exit 127, all commits). Never enable for this family.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: optimal for gpt-oss-20b MXFP4. Full sweep (q5_1/q5_0/q4_1/q4_0) showed no PP/TG improvement (bench r=3, 2026-03-06). ctk q4_0 also crashes llama-cli in interactive mode.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: confirmed neutral in Zen4 benchmarks (2026-03-06). Saves ~50% V-cache with no regression.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: keep it enabled as the default runtime path.' }
        ]
      }
    },
    {
      id: 'gptoss120b-throughput',
      matches: (ctx) => ctx.family === 'gpt-oss' && getModelSizeTag(ctx) === '120b',
      titleRu: 'gpt-oss-120b throughput-first',
      titleEn: 'gpt-oss-120b throughput-first',
      defaults: { workload_profile: 'mixed', flash_attn: true, merge_up_gate_exps: false, cache_type_k: 'q4_0', cache_type_v: 'q8_0', graph_reuse: true },
      reasons: {
        ru: [
          { param: 'workload_profile', value: 'mixed', text: 'Профиль mixed: именно здесь сейчас видна practical value для huge gpt-oss.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: оставляем как throughput baseline.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: current throughput-first baseline не опирается на этот knob.' },
          { param: 'cache_type_k', value: 'q4_0', text: 'ctk q4_0: подтверждено +14.5% PP512 при нейтральном TG vs q8_0 (bench 2026-03-06, r=5).' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: на 120b экономия V-cache уже practically useful.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: оставляем включенным как baseline runtime path.' }
        ],
        en: [
          { param: 'workload_profile', value: 'mixed', text: 'Mixed workload: this is where practical value is currently visible for huge gpt-oss.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: keep it as the throughput baseline.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: the current throughput-first baseline does not rely on this knob.' },
          { param: 'cache_type_k', value: 'q4_0', text: 'ctk q4_0: confirmed +14.5% PP512 with neutral TG vs q8_0 (bench 2026-03-06, r=5).' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: V-cache savings are already practically useful on 120b.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: keep it enabled as the baseline runtime path.' }
        ]
      }
    },
    {
      id: 'minimax-safe',
      matches: (ctx) => ctx.family === 'minimax',
      titleRu: 'MiniMax safe baseline',
      titleEn: 'MiniMax safe baseline',
      defaults: { workload_profile: 'mixed', flash_attn: true, merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', graph_reuse: true },
      reasons: {
        ru: [
          { param: 'workload_profile', value: 'mixed', text: 'Профиль mixed: MiniMax нужно оценивать по real prompt+generation, а не только по TG.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current safe baseline для MiniMax.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: huge-MoE baseline остается консервативным.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: huge-model baseline требует экономии KV.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: для MiniMax это safer huge-model baseline.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: оставляем включенным как baseline runtime path.' }
        ],
        en: [
          { param: 'workload_profile', value: 'mixed', text: 'Mixed workload: MiniMax should be judged by real prompt+generation rather than TG only.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current safe baseline for MiniMax.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: the huge-MoE baseline remains conservative.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: the huge-model baseline needs KV savings.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: this is a safer huge-model baseline for MiniMax.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: keep it enabled as the baseline runtime path.' }
        ]
      }
    },
    {
      id: 'generic-moe',
      matches: (ctx) => ctx.modelType === 'moe',
      titleRu: 'Generic MoE baseline',
      titleEn: 'Generic MoE baseline',
      defaults: { workload_profile: 'mixed', flash_attn: true, merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'q8_0', graph_reuse: true },
      reasons: {
        ru: [
          { param: 'workload_profile', value: 'mixed', text: 'Профиль mixed: это safest current starting point для неизвестной MoE family.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current generic MoE baseline.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: пока не предполагаем validated upside на неизвестной family.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: current generic KV baseline for MoE.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: conservative MoE baseline for memory efficiency.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: оставляем включенным как generic runtime baseline.' }
        ],
        en: [
          { param: 'workload_profile', value: 'mixed', text: 'Mixed workload: this is the safest current starting point for an unknown MoE family.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current generic MoE baseline.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: do not assume a validated upside on an unknown family yet.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: current generic KV baseline for MoE.' },
          { param: 'cache_type_v', value: 'q8_0', text: 'ctv q8_0: conservative MoE baseline for memory efficiency.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: keep it enabled as the generic runtime baseline.' }
        ]
      }
    },
    {
      id: 'qwen35-baseline',
      matches: (ctx) => ctx.family === 'qwen35',
      titleRu: 'Qwen3.5 dense-hybrid baseline',
      titleEn: 'Qwen3.5 dense-hybrid baseline',
      defaults: { workload_profile: 'mixed', flash_attn: true, merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'f16', graph_reuse: true },
      reasons: {
        ru: [
          { param: 'workload_profile', value: 'mixed', text: 'Профиль mixed: generic baseline для Qwen3.5.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: baseline для dense-hybrid.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: Qwen3.5 — dense модель, экспертов нет.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: baseline для KV-cache.' },
          { param: 'cache_type_v', value: 'f16', text: 'ctv f16: V-cache без агрессивной компрессии.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: включен как baseline.' }
        ],
        en: [
          { param: 'workload_profile', value: 'mixed', text: 'Mixed workload: generic baseline for Qwen3.5.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: baseline for dense-hybrid.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: Qwen3.5 is a dense model, no experts.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: baseline for KV cache.' },
          { param: 'cache_type_v', value: 'f16', text: 'ctv f16: V-cache without aggressive compression.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: enabled as baseline.' }
        ]
      }
    },
    {
      id: 'generic-dense',
      matches: () => true,
      titleRu: 'Generic dense baseline',
      titleEn: 'Generic dense baseline',
      defaults: { workload_profile: 'mixed', flash_attn: true, merge_up_gate_exps: false, cache_type_k: 'q8_0', cache_type_v: 'f16', graph_reuse: true },
      reasons: {
        ru: [
          { param: 'workload_profile', value: 'mixed', text: 'Профиль mixed: generic user-facing baseline.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current dense baseline.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: dense-моделям этот knob не нужен.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: practical dense baseline for KV.' },
          { param: 'cache_type_v', value: 'f16', text: 'ctv f16: V-cache не урезаем агрессивно без причины.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: держим включенным как baseline runtime path.' }
        ],
        en: [
          { param: 'workload_profile', value: 'mixed', text: 'Mixed workload: generic user-facing baseline.' },
          { param: 'flash_attn', value: 'ON', text: 'Flash Attention: current dense baseline.' },
          { param: 'merge_up_gate_exps', value: 'OFF', text: 'muge OFF: dense models do not need this knob.' },
          { param: 'cache_type_k', value: 'q8_0', text: 'ctk q8_0: practical dense baseline for KV.' },
          { param: 'cache_type_v', value: 'f16', text: 'ctv f16: do not reduce the V-cache aggressively without a reason.' },
          { param: 'graph_reuse', value: 'ON', text: 'Graph Reuse: keep it enabled as the baseline runtime path.' }
        ]
      }
    }
  ];

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
    const hasExperimentalKnobs = typeof ctx.hasExperimentalKnobs === 'boolean'
      ? ctx.hasExperimentalKnobs
      : (helpers.hasExperimentalKnobs ? helpers.hasExperimentalKnobs(ctx.state || {}) : false);
    return { ...ctx, family, modelPath, modelType, workload, isSwapBound, hasExperimentalKnobs };
  }

  function getModelBadges(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const familyMeta = MODEL_BADGE_META.family[ctx.family] || MODEL_BADGE_META.family.other;
    const pathMeta = ctx.isSwapBound ? MODEL_BADGE_META.path.swap : MODEL_BADGE_META.path.inram;
    const workloadMeta = MODEL_BADGE_META.workload[ctx.workload] || MODEL_BADGE_META.workload.mixed;
    const validationStatus = getFamilyValidationStatus(ctx, helpers);
    const statusMeta = MODEL_BADGE_META.status[validationStatus] || MODEL_BADGE_META.status.unknown;
    const familyNote = getFamilyValidationNote(ctx, lang, helpers);

    const badges = [
      {
        id: 'family',
        label: lang === 'ru' ? familyMeta.labelRu : familyMeta.labelEn,
        className: familyMeta.className,
        title: familyNote
      },
      {
        id: 'path',
        label: lang === 'ru' ? pathMeta.labelRu : pathMeta.labelEn,
        className: pathMeta.className,
        title: ctx.isSwapBound
          ? (lang === 'ru' ? 'Текущий memory regime ближе к swap-bound сценарию.' : 'The current memory regime is closer to a swap-bound scenario.')
          : (lang === 'ru' ? 'Текущий memory regime ближе к in-RAM сценарию.' : 'The current memory regime is closer to an in-RAM scenario.')
      },
      {
        id: 'workload',
        label: lang === 'ru' ? workloadMeta.labelRu : workloadMeta.labelEn,
        className: workloadMeta.className,
        title: ctx.workload === 'tg'
          ? (lang === 'ru' ? 'Текущий workload ориентирован на decode-only скорость.' : 'The current workload is focused on decode-only speed.')
          : ctx.workload === 'pp'
            ? (lang === 'ru' ? 'Текущий workload ориентирован на prompt processing.' : 'The current workload is focused on prompt processing.')
            : (lang === 'ru' ? 'Текущий workload оценивает mixed prompt + generation path.' : 'The current workload evaluates the mixed prompt + generation path.')
      },
      {
        id: 'status',
        label: lang === 'ru' ? statusMeta.labelRu : statusMeta.labelEn,
        className: statusMeta.className,
        title: familyNote
      }
    ];

    if (ctx.hasExperimentalKnobs) {
      const expMeta = MODEL_BADGE_META.experimental.active;
      badges.push({
        id: 'experimental',
        label: lang === 'ru' ? expMeta.labelRu : expMeta.labelEn,
        className: expMeta.className,
        title: lang === 'ru'
          ? 'В текущем профиле активны экспериментальные ручки. Сравнивайте их с validated baseline.'
          : 'The current profile has experimental knobs enabled. Compare them against the validated baseline.'
      });
    }

    return badges;
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
      if (family === 'gpt-oss' && modelSizeTag === '120b') { level = 'high'; titleRu = 'Tested on: gpt-oss-120b. Подтверждено: +3.45% prompt (pg512,128), 0% регрессия decode. Back-half preset validated.'; titleEn = 'Tested on: gpt-oss-120b. Confirmed: +3.45% prompt (pg512,128), 0% decode regression. Back-half preset validated.'; }
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

  function getFamilyValidationStatus(rawCtx, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    return (FAMILY_VALIDATION_EVIDENCE[ctx.family] || FAMILY_VALIDATION_EVIDENCE.other).status;
  }

  function getFamilyValidationNote(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const entry = FAMILY_VALIDATION_EVIDENCE[ctx.family] || FAMILY_VALIDATION_EVIDENCE.other;
    return lang === 'ru' ? entry.noteRu : entry.noteEn;
  }

  function getOverviewFamilySummary(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const meta = FAMILY_OVERVIEW_META[ctx.family] || FAMILY_OVERVIEW_META.other;
    if (ctx.family === 'other') {
      if (ctx.modelSizeGb > 0) {
        return {
          value: lang === 'ru' ? meta.valueRu : meta.valueEn,
          note: `${ctx.modelSizeGb} GB`,
          tone: ''
        };
      }
      return {
        value: lang === 'ru' ? meta.valueRu : meta.valueEn,
        note: lang === 'ru' ? meta.noteRu : meta.noteEn,
        tone: ''
      };
    }
    return {
      value: lang === 'ru' ? meta.valueRu : meta.valueEn,
      note: lang === 'ru' ? meta.noteRu : meta.noteEn,
      tone: getFamilyValidationStatus(ctx, helpers) === 'validated' ? 'accent' : 'warn'
    };
  }

  function getOverviewValidationSummary(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const status = getFamilyValidationStatus(ctx, helpers);
    const meta = OVERVIEW_VALIDATION_META[status] || OVERVIEW_VALIDATION_META.unknown;
    let note = '';
    if (status === 'unknown') {
      note = lang === 'ru'
        ? 'Для этой модели еще нет подтвержденной линии. Проверьте family detection и сравните базовый runtime-профиль вручную.'
        : 'This model has no validated line yet. Confirm family detection and compare the baseline runtime profile manually.';
    } else if (status === 'validated' || status === 'partial') {
      note = getFamilyValidationNote(ctx, lang, helpers);
      if (ctx.hasExperimentalKnobs) {
        note += lang === 'ru'
          ? ' Экспериментальные ручки активны.'
          : ' Experimental knobs are active.';
      }
    }
    return {
      status,
      value: lang === 'ru' ? meta.valueRu : meta.valueEn,
      note,
      tone: status === 'validated' ? 'accent' : status === 'partial' ? 'warn' : ''
    };
  }

  function getOverviewActions(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const runtimeKey = (ctx.interactionReady || ctx.runtimeState === 'loading') ? 'runtime' : 'launch';
    return ['model', 'performance', 'optimization', runtimeKey].map((id) => {
      const item = OVERVIEW_ACTIONS[id];
      return {
        id,
        title: lang === 'ru' ? item.titleRu : item.titleEn,
        body: lang === 'ru' ? item.bodyRu : item.bodyEn,
        label: lang === 'ru' ? item.labelRu : item.labelEn,
        pane: item.pane,
        defaultParam: item.defaultParam || '',
        accent: item.accent
      };
    });
  }

  function getAutoConfigRtrGuidance(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const policy = AUTOCONFIG_RTR_POLICIES.find((item) => item.matches(ctx)) || AUTOCONFIG_RTR_POLICIES[AUTOCONFIG_RTR_POLICIES.length - 1];
    const reasons = (lang === 'ru' ? policy.reasons.ru : policy.reasons.en).map((entry) => ({ value: entry.value, text: entry.text }));
    return { id: policy.id, mode: policy.mode, reasons };
  }

  function getHotExpertGuidance(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const policy = HOT_EXPERT_GUIDANCE.find((item) => item.matches(ctx));
    if (!policy) return null;
    return {
      id: policy.id,
      recommendation: policy.recommendation,
      reasons: (lang === 'ru' ? policy.reasons.ru : policy.reasons.en).map((entry) => ({ value: entry.value, text: entry.text }))
    };
  }

  function resolveRuntimeProfile(rawCtx, lang, helpers) {
    const ctx = buildContext(rawCtx || {}, helpers || {});
    const profile = RUNTIME_PROFILE_EVIDENCE.find((item) => item.matches(ctx)) || RUNTIME_PROFILE_EVIDENCE[RUNTIME_PROFILE_EVIDENCE.length - 1];
    const reasons = (lang === 'ru' ? profile.reasons.ru : profile.reasons.en).map((entry) => ({ param: entry.param, value: entry.value, text: entry.text }));
    return {
      id: profile.id,
      title: lang === 'ru' ? profile.titleRu : profile.titleEn,
      defaults: { ...profile.defaults },
      reasons
    };
  }

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

  function listStandardPresets(lang) {
    return Object.entries(STANDARD_PRESET_EVIDENCE).map(([id, cfg]) => ({
      id,
      titleText: lang === 'ru' ? cfg.title.ru : cfg.title.en,
      description: lang === 'ru' ? cfg.description.ru : cfg.description.en,
      applicability: localize(APPLICABILITY_META[cfg.applicability] || APPLICABILITY_META.all, lang),
      validation: localize(VALIDATION_META[cfg.validation] || VALIDATION_META.validated, lang),
      confidence: {
        level: cfg.confidence,
        ...(CONFIDENCE_META[cfg.confidence]
          ? {
              label: lang === 'ru' ? CONFIDENCE_META[cfg.confidence].labelRu : CONFIDENCE_META[cfg.confidence].labelEn,
              className: CONFIDENCE_META[cfg.confidence].className
            }
          : {})
      },
      values: { ...cfg.values }
    }));
  }

  function getStandardPreset(id) {
    return STANDARD_PRESET_EVIDENCE[id] || null;
  }

  global.IKLLamaEvidenceLayer = {
    APPLICABILITY_META, RUNTIME_SUPPORT_META, VALIDATION_META, CONFIDENCE_META, RISK_META,
    EXPERIMENTAL_KNOB_EVIDENCE, EXPERIMENTAL_PRESET_EVIDENCE, STANDARD_PRESET_EVIDENCE, FAMILY_VALIDATION_EVIDENCE,
    getKnobEvidence, getPresetEvidence, getApplicabilityBadge, getRuntimeSupportBadge, getValidationBadge, getConfidenceBadge,
    listTestedOn, explainFailureMode, listExperimentalPresets, listStandardPresets, getStandardPreset, getPresetRiskLabel, getPresetScopeLabel,
    getFamilyValidationStatus, getFamilyValidationNote, getOverviewFamilySummary, getOverviewValidationSummary, getOverviewActions, getModelBadges,
    getAutoConfigRtrGuidance, getHotExpertGuidance, resolveRuntimeProfile
  };
})(window);
