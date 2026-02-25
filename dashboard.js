// ============================================================
// === i18n STRINGS ===
// ============================================================
const LANG = {
  ru: {
    sec_model: 'Модель', sec_perf: 'Производительность', sec_opt: 'Оптимизации',
    sec_server: 'Сервер', sec_adv: 'Дополнительно',
    p_model: 'Путь к модели', d_model: 'Путь к GGUF-файлу. Split-модели (00001-of-NNNNN) определяются автоматически',
    p_model_size: 'Размер модели (ГБ)', d_model_size: 'Суммарный размер всех частей. Ключевой параметр: если модель > 90% RAM — она swap-bound, и нужны другие настройки',
    p_model_type: 'Тип модели', d_model_type: 'Dense — все веса активны всегда (Llama, Phi, Gemma). MoE — только часть экспертов активна на токен (MiniMax, DeepSeek, Qwen3-MoE). Определяется автоматически при чтении GGUF',
    p_ngl: 'GPU слои', d_ngl: 'Количество слоёв, размещаемых на GPU. -1 = авто (все что влезут), 0 = только CPU. Для CPU-only систем ставьте 0',
    p_threads: 'Потоки', d_threads: 'Потоки вычислений при генерации (TG). На dual-CCD (7950X): 16 оптимально — оба CCD дают 64 МБ L3. Больше 16 на MoE вредит (-7..12%)',
    p_threads_batch: 'Потоки (batch)', d_threads_batch: 'Потоки для обработки промта (PP). -1 = как -t. Отдельное значение полезно если PP и TG по-разному масштабируются',
    p_ctx: 'Размер контекста', d_ctx: 'Контекстное окно (токены). 0 = из метаданных модели. Каждый токен в KV-кеше занимает память — для swap-bound лучше ограничить (напр. 8192)',
    p_batch: 'Batch size', d_batch: 'Логический batch для PP. Больше = быстрее обработка промта, но больше памяти. По умолчанию 2048, минимум 32',
    p_ubatch: 'Micro-batch size', d_ubatch: 'Физический batch — сколько токенов реально обрабатываются за раз. Должен быть <= batch size. По умолчанию 512',
    p_fa: 'Flash Attention', d_fa: 'Оптимизированное ядро внимания: меньше памяти, выше скорость. Нет причин выключать — всегда держите ON',
    p_rtr: 'Runtime Repack', d_rtr: 'Перепаковка весов для оптимального доступа к L1D-кешу. Ускоряет in-RAM модели. Автоматически отключает mmap. Для swap-bound: КАТАСТРОФА (-46..60% TG) — увеличивает working set',
    p_muge: 'Merge Up+Gate Experts', d_muge: 'Слияние ffn_up + ffn_gate экспертов в единый тензор. Влияет только на MoE модели. Для swap-bound: -46% TG (удваивает contiguous allocation)',
    p_ctk: 'Тип KV Cache K', d_ctk: 'Квантизация ключей в KV-кеше. q8_0 — лучший выбор: экономит 50% памяти кеша при 0% потере скорости и качества. Для макс. контекста можно q4_0',
    p_ctv: 'Тип KV Cache V', d_ctv: 'Квантизация значений в KV-кеше. Можно агрессивнее чем K — качество менее чувствительно. q4_0 для максимального контекстного окна',
    p_mla: 'Режим MLA', d_mla: 'Multi-head Latent Attention — режим работы KV-кеша для моделей, поддерживающих MLA (DeepSeek и т.п.). 3 = автовыбор оптимального',
    p_ser: 'Smart Expert Reduction', d_ser: 'Роутер отбрасывает экспертов с весом ниже threshold, гарантируя минимум min_experts. Вместо фиксированных 8 — переменное число 4-8. Снижает swap I/O на ~25-30%',
    ser_min: 'мин. экспертов:', ser_thresh: 'порог:',
    p_gr: 'Graph Reuse', d_gr: 'Переиспользование графа вычислений между токенами. Экономит время на построение графа. Выключать только для отладки',
    p_mqkv: 'Merge QKV', d_mqkv: 'Слияние Q, K, V в один тензор для attention. Улучшает локальность данных при вычислениях внимания',
    p_khad: 'K-Cache Hadamard', d_khad: 'Преобразование Адамара для K-кеша. Уменьшает ошибку квантизации. Полезно ТОЛЬКО с квантизированным кешем (q8_0, q4_0). Бессмысленно с f16/f32',
    p_fmoe: 'Fused MoE', d_fmoe: 'Объединённая операция up*gate для MoE моделей. Уменьшает число kernel launches. По умолчанию ON — отключать не рекомендуется',
    p_fug: 'Fused Up*Gate', d_fug: 'Объединённая операция up*unary(gate) для FFN. Меньше kernel-вызовов = быстрее. По умолчанию ON',
    p_host: 'Хост', p_port: 'Порт', p_np: 'Параллельные слоты', d_np: 'Сколько запросов обрабатываются одновременно. Каждый слот = отдельный KV-кеш, потребляет доп. память',
    p_apikey: 'API ключ', p_thttp: 'HTTP потоки', d_thttp: 'Потоки для обработки HTTP запросов (не вычислений). -1 = авто. Обычно не нужно менять',
    p_seed: 'Seed', d_seed: 'Зерно генератора случайных чисел. -1 = случайное. Фиксированный seed для воспроизводимых результатов',
    p_predict: 'Макс. токенов', d_predict: 'Максимум токенов на генерацию. -1 = без ограничений. Полезно для бенчмарков (-n 128) или ограничения длины ответа',
    p_mmap: 'Memory-mapped I/O (mmap)', d_mmap: 'Загрузка модели через отображение файла в память. OS подгружает страницы по необходимости. Автоматически OFF при -rtr (repack требует полную копию в RAM)',
    p_mlock: 'mlock', d_mlock: 'Блокировка всей модели в RAM — запрещает OS вытеснять страницы в swap. На Windows требует SeLockMemoryPrivilege',
    p_numa: 'Стратегия NUMA', d_numa: 'Размещение памяти по NUMA-нодам. Для single-socket (AM5): disabled оптимально. Бенчмарки показали что distribute/isolate вредят на Zen4',
    p_defrag: 'Порог дефрагментации', d_defrag: 'KV-кеш фрагментируется при удалении токенов. Дефрагментация компактифицирует его. -1 = выключено. 0.1 = мягкая, 0.01 = агрессивная',
    cmd_title: 'Сгенерированная команда',
    btn_copy: 'Копировать', btn_export: 'Экспорт JSON', btn_import: 'Импорт JSON', btn_reset: 'Сброс',
    pe_cores: 'Ядра CPU (физ.)', pe_threads: 'Потоки CPU (лог.)', pe_ccds: 'Число CCD',
    pe_ram: 'RAM (ГБ)', pe_ssd: 'SSD чтение (ГБ/с)', pe_bandwidth: 'Пропускная способность RAM (ГБ/с)',
    toast_copied: 'Скопировано!', toast_exported: 'Конфиг экспортирован!',
    toast_imported: 'Конфиг импортирован!', toast_reset: 'Сброшено!',
    btn_launch: 'Запустить', btn_stop: 'Остановить', btn_clear: 'Очистить',
    proc_title: 'Вывод процесса', proc_idle: 'не запущен', proc_running: 'работает', proc_stopped: 'остановлен',
    srv_online: 'Dashboard-сервер: подключён', srv_offline: 'Dashboard-сервер: не подключён (запустите dashboard_server.py)',
    scan_no_path: 'Введите путь к модели или директории', scan_empty: 'GGUF-файлы не найдены',
    btn_auto: 'Авто-конфигурация', auto_applied: 'Параметры подобраны автоматически',
    auto_no_model: 'Сначала выберите модель',
    auto_reading: 'Чтение метаданных модели...',
    btn_glossary: '? Словарь терминов',
    glossary_title: 'Словарь терминов',
    glossary_search: 'Поиск...',
    // warnings
    w_rtr_swap: 'Runtime Repack + swap-bound модель: от -46% до -60% TG. Repack увеличивает working set, вызывая больше page faults.',
    w_rtr_swap_fix: 'Отключите -rtr для моделей, превышающих 90% RAM.',
    w_muge_swap: 'Merge Up+Gate + swap-bound модель: -46% TG. Удваивает размер непрерывного выделения для тензоров экспертов.',
    w_muge_swap_fix: 'Отключите -muge для swap-bound моделей.',
    w_rtr_muge: 'Оба rtr и muge включены. Работают вместе (краш исправлен), но избегайте для swap-bound моделей.',
    w_threads_moe: 'MoE модель с >16 потоками: от -7% до -12% TG из-за контенции без дополнительной пропускной способности.',
    w_threads_moe_fix: 'Используйте -t 16 для MoE моделей на Zen4.',
    w_ctk_good: 'q8_0 KV cache экономит 50% памяти кеша при 0% потери скорости и качества. Отличный выбор.',
    w_ser_info: 'Smart Expert Reduction уменьшает число активных экспертов. Экономит swap I/O и вычисления, но может повлиять на качество сложных промтов.',
    w_swap_bound: 'Модель swap-bound (превышает 90% RAM). Рекомендуется: отключить rtr и muge, включить ctk=q8_0.',
    w_fa_off: 'Flash Attention выключен. Это значительно снижает производительность. Рекомендуется всегда ON.',
    w_threads_ccd: 'Используется потоков меньше одного CCD на dual-CCD процессоре. L3 кеш урезан с 64 МБ до 32 МБ.',
    w_threads_ccd_fix: 'Используйте -t 16 для задействования обоих CCD.',
    w_rtr_nommap: 'Runtime Repack автоматически отключает mmap (--no-mmap). Модель будет загружена целиком в RAM.',
    w_muge_dense: '-muge влияет только на MoE модели (ffn_up_exps + ffn_gate_exps). На dense модели эффекта нет.',
    w_khad_f16: 'K-Cache Hadamard полезен только с квантизированным KV cache (не f16/f32).',
  },
  en: {
    sec_model: 'Model', sec_perf: 'Performance', sec_opt: 'Optimization',
    sec_server: 'Server', sec_adv: 'Advanced',
    p_model: 'Model path', d_model: 'Path to GGUF file. Split models (00001-of-NNNNN) are detected automatically',
    p_model_size: 'Model size (GB)', d_model_size: 'Total size of all parts. Key parameter: if model > 90% RAM it is swap-bound and needs different settings',
    p_model_type: 'Model type', d_model_type: 'Dense — all weights active always (Llama, Phi, Gemma). MoE — only a subset of experts active per token (MiniMax, DeepSeek, Qwen3-MoE). Auto-detected from GGUF metadata',
    p_ngl: 'GPU layers', d_ngl: 'Layers placed on GPU. -1 = auto (as many as fit), 0 = CPU only. Set 0 for CPU-only systems',
    p_threads: 'Threads', d_threads: 'Compute threads for generation (TG). On dual-CCD (7950X): 16 optimal — both CCDs give 64 MB L3. Over 16 on MoE hurts (-7..12%)',
    p_threads_batch: 'Threads (batch)', d_threads_batch: 'Threads for prompt processing (PP). -1 = same as -t. Separate value useful if PP and TG scale differently',
    p_ctx: 'Context size', d_ctx: 'Context window (tokens). 0 = from model metadata. Each token in KV cache uses memory — for swap-bound better to limit (e.g. 8192)',
    p_batch: 'Batch size', d_batch: 'Logical batch for PP. Larger = faster prompt processing but more memory. Default 2048, minimum 32',
    p_ubatch: 'Micro-batch size', d_ubatch: 'Physical batch — tokens actually processed at once. Must be <= batch size. Default 512',
    p_fa: 'Flash Attention', d_fa: 'Optimized attention kernel: less memory, higher speed. No reason to disable — always keep ON',
    p_rtr: 'Runtime Repack', d_rtr: 'Repack weights for optimal L1D cache access. Speeds up in-RAM models. Auto-disables mmap. For swap-bound: CATASTROPHIC (-46..60% TG) — increases working set',
    p_muge: 'Merge Up+Gate Experts', d_muge: 'Merge ffn_up + ffn_gate expert tensors into one. Only affects MoE models. For swap-bound: -46% TG (doubles contiguous allocation)',
    p_ctk: 'KV Cache K Type', d_ctk: 'Key quantization in KV cache. q8_0 is the best choice: saves 50% cache memory with 0% speed/quality loss. For max context try q4_0',
    p_ctv: 'KV Cache V Type', d_ctv: 'Value quantization in KV cache. Can be more aggressive than K — quality is less sensitive. q4_0 for maximum context window',
    p_mla: 'MLA Mode', d_mla: 'Multi-head Latent Attention — KV cache mode for models supporting MLA (DeepSeek etc.). 3 = auto-select optimal',
    p_ser: 'Smart Expert Reduction', d_ser: 'Router drops experts with weight below threshold, guaranteeing min_experts. Instead of fixed 8 — variable 4-8. Reduces swap I/O by ~25-30%',
    ser_min: 'min experts:', ser_thresh: 'threshold:',
    p_gr: 'Graph Reuse', d_gr: 'Reuse compute graph between tokens. Saves graph construction time. Only disable for debugging',
    p_mqkv: 'Merge QKV', d_mqkv: 'Merge Q, K, V into one tensor for attention. Improves data locality during attention computation',
    p_khad: 'K-Cache Hadamard', d_khad: 'Hadamard transform for K-cache. Reduces quantization error. Only useful with quantized cache (q8_0, q4_0). Pointless with f16/f32',
    p_fmoe: 'Fused MoE', d_fmoe: 'Fused up*gate op for MoE models. Fewer kernel launches. Default ON — not recommended to disable',
    p_fug: 'Fused Up*Gate', d_fug: 'Fused up*unary(gate) for FFN. Fewer kernel calls = faster. Default ON',
    p_host: 'Host', p_port: 'Port', p_np: 'Parallel sequences', d_np: 'Concurrent request slots. Each slot = separate KV cache, uses extra memory',
    p_apikey: 'API Key', p_thttp: 'HTTP threads', d_thttp: 'Threads for HTTP request processing (not compute). -1 = auto. Rarely needs changing',
    p_seed: 'Seed', d_seed: 'Random number generator seed. -1 = random. Fixed seed for reproducible results',
    p_predict: 'Predict tokens', d_predict: 'Max tokens per generation. -1 = unlimited. Useful for benchmarks (-n 128) or limiting response length',
    p_mmap: 'Memory-mapped I/O (mmap)', d_mmap: 'Load model by mapping file into memory. OS loads pages on demand. Auto OFF with -rtr (repack needs full copy in RAM)',
    p_mlock: 'mlock', d_mlock: 'Lock entire model in RAM — prevents OS from swapping pages. On Windows requires SeLockMemoryPrivilege',
    p_numa: 'NUMA strategy', d_numa: 'Memory placement across NUMA nodes. For single-socket (AM5): disabled is optimal. Benchmarks showed distribute/isolate hurt on Zen4',
    p_defrag: 'Defrag threshold', d_defrag: 'KV cache fragments when tokens are deleted. Defrag compacts it. -1 = disabled. 0.1 = gentle, 0.01 = aggressive',
    cmd_title: 'Generated Command',
    btn_copy: 'Copy', btn_export: 'Export JSON', btn_import: 'Import JSON', btn_reset: 'Reset',
    pe_cores: 'CPU cores (physical)', pe_threads: 'CPU threads (logical)', pe_ccds: 'CCD count',
    pe_ram: 'RAM (GB)', pe_ssd: 'SSD read (GB/s)', pe_bandwidth: 'RAM bandwidth (GB/s)',
    toast_copied: 'Copied!', toast_exported: 'Config exported!',
    toast_imported: 'Config imported!', toast_reset: 'Reset!',
    btn_launch: 'Launch', btn_stop: 'Stop', btn_clear: 'Clear',
    proc_title: 'Process Output', proc_idle: 'idle', proc_running: 'running', proc_stopped: 'stopped',
    srv_online: 'Dashboard server: connected', srv_offline: 'Dashboard server: offline (run dashboard_server.py)',
    scan_no_path: 'Enter a model path or directory first', scan_empty: 'No .gguf files found',
    btn_auto: 'Auto-configure', auto_applied: 'Parameters auto-configured',
    auto_no_model: 'Select a model first',
    auto_reading: 'Reading model metadata...',
    btn_glossary: '? Glossary',
    glossary_title: 'Glossary',
    glossary_search: 'Search...',
    w_rtr_swap: 'Runtime Repack + swap-bound model: -46% to -60% TG regression. Repack increases working set, causing more page faults.',
    w_rtr_swap_fix: 'Disable -rtr for models exceeding 90% of RAM.',
    w_muge_swap: 'Merge Up+Gate + swap-bound model: -46% TG regression. Doubles contiguous allocation for expert tensors.',
    w_muge_swap_fix: 'Disable -muge for swap-bound models.',
    w_rtr_muge: 'Both rtr and muge enabled. They work together (crash was fixed), but avoid this combo for swap-bound models.',
    w_threads_moe: 'MoE model with >16 threads: -7% to -12% TG from contention without extra bandwidth.',
    w_threads_moe_fix: 'Use -t 16 for MoE models on Zen4.',
    w_ctk_good: 'q8_0 KV cache saves 50% cache memory with 0% speed/quality loss. Excellent choice.',
    w_ser_info: 'Smart Expert Reduction reduces active experts. Saves swap I/O and compute, but may affect quality for complex prompts.',
    w_swap_bound: 'Model is swap-bound (exceeds 90% RAM). Recommended: disable rtr and muge, enable ctk=q8_0.',
    w_fa_off: 'Flash Attention is OFF. This significantly hurts performance. Always recommended ON.',
    w_threads_ccd: 'Using fewer threads than one CCD on dual-CCD CPU. L3 cache cut from 64 MB to 32 MB.',
    w_threads_ccd_fix: 'Use -t 16 to leverage both CCDs.',
    w_rtr_nommap: 'Runtime Repack automatically disables mmap (--no-mmap). Model will be fully loaded into RAM.',
    w_muge_dense: '-muge only affects MoE models (ffn_up_exps + ffn_gate_exps). No effect on dense models.',
    w_khad_f16: 'K-Cache Hadamard only useful with quantized KV cache (not f16/f32).',
  }
};

// ============================================================
// === HARDWARE PROFILES ===
// ============================================================
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
  'custom': {
    name: 'Custom',
    cores: 16, threads: 32, ccdCount: 1,
    totalRamGb: 64, ramBandwidthGbps: 50, ssdReadGbps: 3.0,
  },
};

// ============================================================
// === PRESETS ===
// ============================================================
const PRESETS = {
  'moe_in_ram': {
    name: { ru: 'MoE (в RAM)', en: 'MoE (In-RAM)' },
    desc: { ru: 'Qwen3-30B-A3B, gpt-oss-20b и т.д.', en: 'Qwen3-30B-A3B, gpt-oss-20b, etc.' },
    values: { threads: 16, flash_attn: true, repack_tensors: true, merge_up_gate_exps: false,
              cache_type_k: 'q8_0', cache_type_v: 'f16', model_type: 'moe' },
  },
  'moe_swap': {
    name: { ru: 'MoE (swap-bound)', en: 'MoE (Swap-bound)' },
    desc: { ru: 'MiniMax-M2.5 151 ГБ и т.п.', en: 'MiniMax-M2.5 151 GB, etc.' },
    values: { threads: 16, flash_attn: true, repack_tensors: false, merge_up_gate_exps: false,
              cache_type_k: 'q8_0', cache_type_v: 'q8_0', model_type: 'moe' },
  },
  'dense_in_ram': {
    name: { ru: 'Dense (в RAM)', en: 'Dense (In-RAM)' },
    desc: { ru: 'Llama-3, Phi-4 и т.д.', en: 'Llama-3, Phi-4, etc.' },
    values: { threads: 16, flash_attn: true, repack_tensors: true, merge_up_gate_exps: false,
              cache_type_k: 'q8_0', cache_type_v: 'f16', model_type: 'dense' },
  },
  'server_prod': {
    name: { ru: 'Сервер (Production)', en: 'Server (Production)' },
    desc: { ru: 'llama-server с параллельными слотами', en: 'llama-server with parallel slots' },
    values: { threads: 16, flash_attn: true, repack_tensors: true, cache_type_k: 'q8_0',
              cache_type_v: 'f16', n_parallel: 4, hostname: '0.0.0.0', model_type: 'dense',
              target: 'llama-server' },
  },
  'max_context': {
    name: { ru: 'Макс. контекст', en: 'Max Context' },
    desc: { ru: 'Максимальный контекст с квант. KV', en: 'Max context with quantized KV' },
    values: { flash_attn: true, cache_type_k: 'q8_0', cache_type_v: 'q4_0', n_ctx: 131072 },
  },
};

// ============================================================
// === CROSS-PARAMETER RULES ===
// ============================================================
function isSwapBound(s, p) {
  return p.totalRamGb > 0 && s.model_size_gb > 0 && s.model_size_gb > p.totalRamGb * 0.9;
}

const RULES = [
  {
    id: 'rtr_swap', severity: 'error', params: ['repack_tensors'],
    test: (s, p) => s.repack_tensors && isSwapBound(s, p),
    msg: 'w_rtr_swap', fix: 'w_rtr_swap_fix',
  },
  {
    id: 'muge_swap', severity: 'error', params: ['merge_up_gate_exps'],
    test: (s, p) => s.merge_up_gate_exps && isSwapBound(s, p),
    msg: 'w_muge_swap', fix: 'w_muge_swap_fix',
  },
  {
    id: 'rtr_muge', severity: 'info', params: ['repack_tensors', 'merge_up_gate_exps'],
    test: (s, p) => s.repack_tensors && s.merge_up_gate_exps,
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
    id: 'ser_info', severity: 'info', params: ['ser'],
    test: (s) => s.ser_enabled,
    msg: 'w_ser_info',
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
    test: (s) => s.repack_tensors,
    msg: 'w_rtr_nommap',
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

// ============================================================
// === STATE ===
// ============================================================
let currentLang = 'ru';
let currentProfile = null;
let suppressUpdate = false;

const DEFAULTS = {
  model: '', model_size_gb: 0, model_type: 'dense', n_gpu_layers: -1,
  threads: 16, threads_batch: -1, n_ctx: 0, n_batch: 2048, n_ubatch: 512,
  flash_attn: true, repack_tensors: false, merge_up_gate_exps: false,
  cache_type_k: 'f16', cache_type_v: 'f16', mla_attn: 3,
  ser_enabled: false, ser_min: 4, ser_thresh: 0.05,
  graph_reuse: true, merge_qkv: false, k_cache_hadamard: false,
  fused_moe_up_gate: true, fused_up_gate: true,
  hostname: '127.0.0.1', port: 8080, n_parallel: 1, api_key: '', n_threads_http: -1,
  seed: -1, n_predict: -1, use_mmap: true, use_mlock: false,
  numa: 'disabled', defrag_thold: -1,
  target: 'llama-cli', shell: 'bash',
};

const state = { ...DEFAULTS };

// Proxy for reactivity
const S = new Proxy(state, {
  set(t, k, v) {
    if (t[k] === v) return true;
    t[k] = v;
    // rtr forces mmap off
    if (k === 'repack_tensors' && v) {
      t.use_mmap = false;
    }
    if (!suppressUpdate) {
      syncToDOM(k);
      evaluate();
      renderCommand();
      saveState();
    }
    return true;
  }
});

// ============================================================
// === DOM SYNC ===
// ============================================================
const TOGGLE_PARAMS = [
  'flash_attn', 'repack_tensors', 'merge_up_gate_exps', 'graph_reuse',
  'merge_qkv', 'k_cache_hadamard', 'fused_moe_up_gate', 'fused_up_gate',
  'use_mmap', 'use_mlock', 'ser_enabled',
];

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
    if (p === 'use_mmap' && state.repack_tensors) {
      if (track) track.classList.add('disabled');
    } else if (p === 'use_mmap') {
      const track2 = document.getElementById('tog-use_mmap');
      if (track2) track2.classList.remove('disabled');
    }
  }
  // Sync inputs/selects
  const inputMap = {
    model: 'p-model', model_size_gb: 'p-model_size_gb', model_type: 'p-model_type',
    n_gpu_layers: 'p-n_gpu_layers', threads: 'p-threads', threads_batch: 'p-threads_batch',
    n_ctx: 'p-n_ctx', n_batch: 'p-n_batch', n_ubatch: 'p-n_ubatch',
    cache_type_k: 'p-cache_type_k', cache_type_v: 'p-cache_type_v', mla_attn: 'p-mla_attn',
    ser_min: 'p-ser_min', ser_thresh: 'p-ser_thresh',
    hostname: 'p-hostname', port: 'p-port', n_parallel: 'p-n_parallel',
    api_key: 'p-api_key', n_threads_http: 'p-n_threads_http',
    seed: 'p-seed', n_predict: 'p-n_predict', numa: 'p-numa', defrag_thold: 'p-defrag_thold',
    target: 'sel-target', shell: 'sel-shell',
  };
  if (changedKey && inputMap[changedKey]) {
    const el = document.getElementById(inputMap[changedKey]);
    if (el && el !== document.activeElement) el.value = state[changedKey];
  } else {
    for (const [k, id] of Object.entries(inputMap)) {
      const el = document.getElementById(id);
      if (el && el !== document.activeElement) el.value = state[k];
    }
  }
  // SER inputs enable/disable
  document.getElementById('p-ser_min').disabled = !state.ser_enabled;
  document.getElementById('p-ser_thresh').disabled = !state.ser_enabled;
}

function syncAllToDOM() {
  for (const p of TOGGLE_PARAMS) syncToDOM(p);
  syncToDOM(null); // sync all inputs
}

function toggleParam(name) {
  if (name === 'use_mmap' && state.repack_tensors) return; // locked
  S[name] = !state[name];
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
  renderDots(paramSeverity);
}

function severityLevel(s) {
  return { success: 0, info: 1, warning: 2, error: 3 }[s] || 0;
}

const SEVERITY_ICONS = { error: '\u26D4', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F', success: '\u2705' };

function renderWarnings(active) {
  const area = document.getElementById('warnings-area');
  area.innerHTML = '';
  // Sort: errors first, then warnings, info, success
  active.sort((a, b) => severityLevel(b.severity) - severityLevel(a.severity));
  for (const rule of active) {
    const div = document.createElement('div');
    div.className = 'warning-banner ' + rule.severity;
    const icon = document.createElement('span');
    icon.className = 'warning-icon';
    icon.textContent = SEVERITY_ICONS[rule.severity] || '';
    div.appendChild(icon);
    const text = document.createElement('span');
    text.className = 'warning-text';
    let html = '<b>' + rule.id.replace(/_/g, ' ') + ':</b> ' + t(rule.msg);
    if (rule.fix) html += '<br><em>' + t(rule.fix) + '</em>';
    text.innerHTML = html;
    div.appendChild(text);
    area.appendChild(div);
  }
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

// ============================================================
// === COMMAND GENERATION ===
// ============================================================
function renderCommand() {
  const s = state;
  const isServer = s.target === 'llama-server';
  const parts = [s.target];

  // Model
  if (s.model) {
    const path = s.shell === 'powershell' ? s.model : s.model;
    parts.push('-m "' + path + '"');
  }

  // Performance
  if (s.threads !== -1 && s.threads !== 0) parts.push('-t ' + s.threads);
  if (s.threads_batch !== -1) parts.push('-tb ' + s.threads_batch);
  if (s.n_ctx !== 0) parts.push('-c ' + s.n_ctx);
  if (s.n_batch !== 2048) parts.push('-b ' + s.n_batch);
  if (s.n_ubatch !== 512) parts.push('-ub ' + s.n_ubatch);

  // Optimization — always emit fa for clarity
  parts.push(s.flash_attn ? '-fa 1' : '-fa 0');
  if (s.repack_tensors) parts.push('-rtr');
  if (s.merge_up_gate_exps) parts.push('-muge');
  if (s.cache_type_k !== 'f16') parts.push('-ctk ' + s.cache_type_k);
  if (s.cache_type_v !== 'f16') parts.push('-ctv ' + s.cache_type_v);
  if (s.mla_attn !== 3) parts.push('-mla ' + s.mla_attn);
  if (s.ser_enabled) parts.push('-ser ' + s.ser_min + ',' + s.ser_thresh);
  if (!s.graph_reuse) parts.push('-no-gr');
  if (s.merge_qkv) parts.push('-mqkv');
  if (s.k_cache_hadamard) parts.push('-khad');
  if (!s.fused_moe_up_gate) parts.push('-no-fmoe');
  if (!s.fused_up_gate) parts.push('-no-fug');

  // GPU
  if (s.n_gpu_layers !== -1) parts.push('-ngl ' + s.n_gpu_layers);

  // Server-only
  if (isServer) {
    if (s.hostname !== '127.0.0.1') parts.push('--host ' + s.hostname);
    if (s.port !== 8080) parts.push('--port ' + s.port);
    if (s.n_parallel !== 1) parts.push('-np ' + s.n_parallel);
    if (s.api_key) parts.push('--api-key "' + s.api_key + '"');
    if (s.n_threads_http !== -1) parts.push('--threads-http ' + s.n_threads_http);
  }

  // Advanced
  if (s.seed !== -1) parts.push('-s ' + s.seed);
  if (s.n_predict !== -1) parts.push('-n ' + s.n_predict);
  if (!s.use_mmap && !s.repack_tensors) parts.push('--no-mmap'); // rtr implies it
  if (s.use_mlock) parts.push('--mlock');
  if (s.numa !== 'disabled') parts.push('--numa ' + s.numa);
  if (s.defrag_thold !== -1) parts.push('-dt ' + s.defrag_thold);

  const cont = s.shell === 'powershell' ? ' `' : ' \\';
  const sep = '\n  ';
  // Join: first part alone, rest indented
  let cmd;
  if (parts.length <= 3) {
    cmd = parts.join(' ');
  } else {
    cmd = parts[0] + cont + sep + parts.slice(1).join(cont + sep);
  }

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
  sel.innerHTML = '<option value="">-- ' + (currentLang === 'ru' ? 'Пресет' : 'Preset') + ' --</option>';
  for (const [k, v] of Object.entries(PRESETS)) {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = v.name[currentLang] + ' \u2014 ' + v.desc[currentLang];
    sel.appendChild(opt);
  }
}

function applyPreset(id) {
  if (!id) return;
  const preset = PRESETS[id];
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
  document.getElementById('btn-lang-ru').classList.toggle('active', lang === 'ru');
  document.getElementById('btn-lang-en').classList.toggle('active', lang === 'en');
  document.documentElement.lang = lang;
  // Update all data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (LANG[lang][key]) el.textContent = LANG[lang][key];
  });
  initPresets();
  evaluate();
  renderCommand();
  saveState();
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
      suppressUpdate = false;
    }
    if (data.profileId) {
      document.getElementById('sel-profile').value = data.profileId;
      if (data.profileId === 'custom' && data.customProfile) {
        for (const [k, v] of Object.entries(data.customProfile)) {
          const el = document.getElementById('pe-' + k.replace(/([A-Z])/g, (m) => {
            // convert camelCase keys to element IDs
            return m;
          }));
        }
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
        suppressUpdate = false;
        syncAllToDOM();
        evaluate();
        renderCommand();
        saveState();
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
    if (serverInfo.physical_cores) info.push(serverInfo.physical_cores + ' cores');
    if (serverInfo.total_ram_gb) info.push(serverInfo.total_ram_gb + ' GB RAM');
    if (serverInfo.os) info.push(serverInfo.os);
    document.getElementById('sys-info').textContent = info.join(' | ');
    // Auto-populate profile RAM if available
    if (serverInfo.total_ram_gb && currentProfile) {
      // Update custom profile fields if system RAM detected
      const peRam = document.getElementById('pe-ram');
      if (peRam && document.getElementById('sel-profile').value === 'custom') {
        peRam.value = serverInfo.total_ram_gb;
        updateCustomProfile();
      }
    }
    // Enable launch button
    document.getElementById('btn-launch').style.opacity = '1';
    // Check if process is already running
    await checkProcessStatus();
  } catch(e) {
    serverConnected = false;
    document.getElementById('server-dot').className = 'status-dot disconnected';
    document.getElementById('server-status-text').textContent = t('srv_offline');
    document.getElementById('sys-info').textContent = '';
    document.getElementById('btn-launch').style.opacity = '0.4';
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
    const computed = computeOptimalParams(lastModelMeta, state.model_size_gb, profile);

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

function computeOptimalParams(modelInfo, modelSizeGb, profile) {
  const totalRam = profile.totalRamGb || 64;
  const cores = profile.cores || 8;
  const ccdCount = profile.ccdCount || 1;
  const isMoE = modelInfo.is_moe;
  const expertCount = modelInfo.expert_count || 0;
  const expertUsed = modelInfo.expert_used_count || 0;
  const isSwapBound = modelSizeGb > totalRam * 0.9;
  const isComfortable = modelSizeGb > 0 && modelSizeGb < totalRam * 0.6;
  const contextLen = modelInfo.context_length || 0;

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
  if (ccdCount >= 2) {
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

  // --- Flash Attention: always ON ---
  params.flash_attn = true;

  // --- Runtime Repack ---
  if (isSwapBound) {
    params.repack_tensors = false;
    reasons.push({
      param: 'repack_tensors', value: 'OFF',
      ru: `rtr OFF: swap-bound (${modelSizeGb} ГБ > ${Math.round(totalRam*0.9)} ГБ). rtr даёт -46..60% TG`,
      en: `rtr OFF: swap-bound (${modelSizeGb} GB > ${Math.round(totalRam*0.9)} GB). rtr causes -46..60% TG`,
    });
  } else {
    params.repack_tensors = true;
    reasons.push({
      param: 'repack_tensors', value: 'ON',
      ru: 'rtr ON: модель помещается в RAM, repacking ускоряет L1D доступ',
      en: 'rtr ON: model fits in RAM, repacking improves L1D access',
    });
  }

  // --- Merge Up+Gate ---
  if (isMoE && !isSwapBound) {
    params.merge_up_gate_exps = false; // muge is safe but rarely helps, keep off by default
    reasons.push({
      param: 'merge_up_gate_exps', value: 'OFF',
      ru: 'muge OFF: незначительный прирост для in-RAM MoE',
      en: 'muge OFF: minimal gain for in-RAM MoE',
    });
  } else if (isMoE && isSwapBound) {
    params.merge_up_gate_exps = false;
    reasons.push({
      param: 'merge_up_gate_exps', value: 'OFF',
      ru: 'muge OFF: swap-bound MoE, muge даёт -46% TG',
      en: 'muge OFF: swap-bound MoE, muge causes -46% TG',
    });
  } else {
    params.merge_up_gate_exps = false;
  }

  // --- KV Cache types ---
  params.cache_type_k = 'q8_0';
  reasons.push({
    param: 'cache_type_k', value: 'q8_0',
    ru: 'ctk q8_0: экономит 50% памяти KV при 0% потере качества',
    en: 'ctk q8_0: saves 50% KV memory with 0% quality loss',
  });

  if (isSwapBound || (contextLen > 65536)) {
    params.cache_type_v = 'q8_0';
    reasons.push({
      param: 'cache_type_v', value: 'q8_0',
      ru: 'ctv q8_0: swap-bound или длинный контекст — экономия V-кеша',
      en: 'ctv q8_0: swap-bound or long context — saving V-cache',
    });
  } else {
    params.cache_type_v = 'f16';
  }

  // --- SER for swap-bound MoE ---
  if (isMoE && isSwapBound && expertUsed >= 4) {
    params.ser_enabled = true;
    params.ser_min = Math.max(2, Math.floor(expertUsed / 2));
    params.ser_thresh = 0.05;
    reasons.push({
      param: 'ser', value: `${params.ser_min},${params.ser_thresh}`,
      ru: `SER ON: min=${params.ser_min} из ${expertUsed} активных. Снижает swap I/O на ~25-30%`,
      en: `SER ON: min=${params.ser_min} of ${expertUsed} active. Reduces swap I/O by ~25-30%`,
    });
  } else {
    params.ser_enabled = false;
  }

  // --- Graph Reuse: always ON ---
  params.graph_reuse = true;

  // --- GPU layers ---
  params.n_gpu_layers = 0;

  // --- mmap ---
  if (params.repack_tensors) {
    params.use_mmap = false; // forced by rtr
  } else {
    params.use_mmap = true;
  }

  // --- Context size suggestion ---
  if (contextLen > 0 && isSwapBound) {
    // For swap-bound, suggest smaller context to save RAM
    params.n_ctx = Math.min(8192, contextLen);
    reasons.push({
      param: 'n_ctx', value: params.n_ctx,
      ru: `Контекст ${params.n_ctx}: swap-bound, ограничиваем для экономии RAM (макс. модели: ${contextLen})`,
      en: `Context ${params.n_ctx}: swap-bound, limited to save RAM (model max: ${contextLen})`,
    });
  }

  return {
    params,
    reasons,
    summary: {
      is_moe: isMoE,
      is_swap_bound: isSwapBound,
      expert_count: expertCount,
      expert_used: expertUsed,
      model_name: modelInfo.name || modelInfo.basename || '',
      model_size_gb: modelSizeGb,
      context_length: contextLen,
      architecture: modelInfo.architecture,
    },
  };
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
  if (!serverConnected) {
    toast(t('srv_offline'));
    return;
  }
  // Build args array from current state
  const args = buildArgsArray();
  try {
    const result = await apiPost('/api/launch', { args });
    if (result.ok) {
      toast(result.message);
      showProcessPanel(true);
      startOutputPolling();
    } else {
      toast(result.message || result.error);
    }
  } catch(e) {
    toast('Launch error: ' + e.message);
  }
}

function buildArgsArray() {
  const s = state;
  const args = [s.target]; // llama-cli or llama-server

  if (s.model) args.push('-m', s.model);

  if (s.threads > 0) { args.push('-t', '' + s.threads); }
  if (s.threads_batch !== -1) { args.push('-tb', '' + s.threads_batch); }
  if (s.n_ctx !== 0) { args.push('-c', '' + s.n_ctx); }
  if (s.n_batch !== 2048) { args.push('-b', '' + s.n_batch); }
  if (s.n_ubatch !== 512) { args.push('-ub', '' + s.n_ubatch); }

  args.push('-fa', s.flash_attn ? '1' : '0');
  if (s.repack_tensors) args.push('-rtr');
  if (s.merge_up_gate_exps) args.push('-muge');
  if (s.cache_type_k !== 'f16') { args.push('-ctk', s.cache_type_k); }
  if (s.cache_type_v !== 'f16') { args.push('-ctv', s.cache_type_v); }
  if (s.mla_attn !== 3) { args.push('-mla', '' + s.mla_attn); }
  if (s.ser_enabled) { args.push('-ser', s.ser_min + ',' + s.ser_thresh); }
  if (!s.graph_reuse) args.push('-no-gr');
  if (s.merge_qkv) args.push('-mqkv');
  if (s.k_cache_hadamard) args.push('-khad');
  if (!s.fused_moe_up_gate) args.push('-no-fmoe');
  if (!s.fused_up_gate) args.push('-no-fug');

  if (s.n_gpu_layers !== -1) { args.push('-ngl', '' + s.n_gpu_layers); }

  if (s.target === 'llama-server') {
    if (s.hostname !== '127.0.0.1') { args.push('--host', s.hostname); }
    if (s.port !== 8080) { args.push('--port', '' + s.port); }
    if (s.n_parallel !== 1) { args.push('-np', '' + s.n_parallel); }
    if (s.api_key) { args.push('--api-key', s.api_key); }
    if (s.n_threads_http !== -1) { args.push('--threads-http', '' + s.n_threads_http); }
  }

  if (s.seed !== -1) { args.push('-s', '' + s.seed); }
  if (s.n_predict !== -1) { args.push('-n', '' + s.n_predict); }
  if (!s.use_mmap && !s.repack_tensors) args.push('--no-mmap');
  if (s.use_mlock) args.push('--mlock');
  if (s.numa !== 'disabled') { args.push('--numa', s.numa); }
  if (s.defrag_thold !== -1) { args.push('-dt', '' + s.defrag_thold); }

  return args;
}

async function stopProcess() {
  if (!serverConnected) return;
  try {
    const result = await apiPost('/api/stop', {});
    toast(result.message);
    stopOutputPolling();
    await checkProcessStatus();
  } catch(e) {
    toast('Stop error: ' + e.message);
  }
}

function showProcessPanel(show) {
  document.getElementById('process-panel').classList.toggle('visible', show);
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

async function pollOutput() {
  if (!serverConnected) return;
  try {
    const data = await apiGet('/api/output?offset=' + lastOutputOffset);
    if (data.lines && data.lines.length > 0) {
      const el = document.getElementById('proc-output');
      el.textContent += data.lines.join('\n') + '\n';
      lastOutputOffset += data.lines.length;
      el.scrollTop = el.scrollHeight;
    }
  } catch(e) {}
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
      statusEl.textContent = t('proc_running');
      uptimeEl.textContent = s.uptime_s ? formatUptime(s.uptime_s) : '';
      btnLaunch.classList.add('hidden');
      btnStop.classList.remove('hidden');
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
      if (outputPollTimer) {
        // Do one final poll then stop
        await pollOutput();
        stopOutputPolling();
      }
    }
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
const HELP = {
  threads: {
    ru: `<h4>Потоки (-t)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Потоки — это как количество рабочих рук. Больше потоков = модель считает быстрее, но только до определённого предела. Как конвейер на заводе: 16 рабочих оптимально, 32 уже мешают друг другу.</div>
<p>Количество потоков для матричных вычислений при генерации токенов (TG) и обработке промта (PP).</p>
<div class="bench">Бенчмарки на Ryzen 9 7950X (MoE модели):
• -t 16: <span class="good">0.91 t/s</span> (оптимум)
• -t 32: 0.80 t/s (-12%) — лишняя контенция за bandwidth
• -t 8:  ~0.5 t/s — только один CCD, L3 = 32 МБ вместо 64 МБ</div>
<div class="tip">Dual-CCD процессоры (7950X, 7900X): всегда 16. Single-CCD (7800X3D): число физических ядер.</div>
<p>Для dense моделей можно использовать все ядра, но для MoE больше 16 потоков конкурируют за bandwidth без прироста.</p>
<div class="see-also">См. также: <span>-tb</span> (потоки batch), <span>-b</span> (batch size)</div>`,
    en: `<h4>Threads (-t)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Threads are like pairs of working hands. More threads = model computes faster, but only up to a point. Like an assembly line: 16 workers is optimal, 32 start getting in each other's way.</div>
<p>Number of threads for matrix math during token generation (TG) and prompt processing (PP).</p>
<div class="bench">Benchmarks on Ryzen 9 7950X (MoE models):
• -t 16: <span class="good">0.91 t/s</span> (optimal)
• -t 32: 0.80 t/s (-12%) — extra contention for bandwidth
• -t 8:  ~0.5 t/s — only one CCD, L3 = 32 MB instead of 64 MB</div>
<div class="tip">Dual-CCD CPUs (7950X, 7900X): always 16. Single-CCD (7800X3D): physical core count.</div>
<p>For dense models you can use all cores, but for MoE more than 16 threads contend for bandwidth with no gain.</p>
<div class="see-also">See also: <span>-tb</span> (batch threads), <span>-b</span> (batch size)</div>`,
  },
  threads_batch: {
    ru: `<h4>Потоки для batch (-tb)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Когда вы отправляете длинный промт, модель обрабатывает его пакетами (batch). Этот параметр задаёт число потоков именно для этой фазы. Обычно совпадает с основными потоками.</div>
<p>Отдельное число потоков для prompt processing (PP). По умолчанию -1 = совпадает с <span class="hl">-t</span>.</p>
<p>Может быть полезно если PP и TG по-разному масштабируются на вашем CPU. На большинстве конфигураций одинаковое значение оптимально.</p>
<div class="tip">Если не уверены — оставьте -1. Система возьмёт значение из -t.</div>
<div class="see-also">См. также: <span>-t</span> (основные потоки), <span>-b</span> (batch size)</div>`,
    en: `<h4>Batch Threads (-tb)</h4>
<div class="beginner-section"><div class="label">For beginners</div>When you send a long prompt, the model processes it in batches. This sets the thread count specifically for that phase. Usually matches the main threads setting.</div>
<p>Separate thread count for prompt processing (PP). Default -1 = same as <span class="hl">-t</span>.</p>
<p>Useful if PP and TG scale differently on your CPU. For most configs, same value as -t is optimal.</p>
<div class="tip">If unsure — leave at -1. The system will use the -t value.</div>
<div class="see-also">See also: <span>-t</span> (main threads), <span>-b</span> (batch size)</div>`,
  },
  n_batch: {
    ru: `<h4>Batch Size (-b)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Когда вы отправляете промт из 1000 токенов, модель не обрабатывает их по одному — она берёт порциями (batch). Больше порция = быстрее обработка промта, но нужно больше памяти. Не влияет на скорость генерации ответа.</div>
<p>Логический размер batch для prompt processing. Токены промта группируются в пакеты этого размера. По умолчанию 2048 — хорошее значение для большинства систем.</p>
<div class="bench">Влияние batch size:
• -b 2048: <span class="good">стандарт</span>, баланс скорость/память
• -b 512:  медленнее PP, меньше памяти
• -b 8192: быстрее PP при достаточной RAM</div>
<div class="tip">Уменьшайте только если не хватает RAM при обработке длинных промтов. Минимум 32.</div>
<div class="see-also">См. также: <span>-ub</span> (micro-batch), <span>-tb</span> (потоки batch)</div>`,
    en: `<h4>Batch Size (-b)</h4>
<div class="beginner-section"><div class="label">For beginners</div>When you send a 1000-token prompt, the model doesn't process them one by one — it takes them in portions (batches). Bigger portion = faster prompt processing, but more memory needed. Doesn't affect answer generation speed.</div>
<p>Logical batch size for prompt processing. Prompt tokens are grouped into packets of this size. Default 2048 — good for most systems.</p>
<div class="bench">Batch size impact:
• -b 2048: <span class="good">standard</span>, speed/memory balance
• -b 512:  slower PP, less memory
• -b 8192: faster PP with sufficient RAM</div>
<div class="tip">Only reduce if running out of RAM during long prompt processing. Minimum 32.</div>
<div class="see-also">See also: <span>-ub</span> (micro-batch), <span>-tb</span> (batch threads)</div>`,
  },
  n_ubatch: {
    ru: `<h4>Micro-batch Size (-ub)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Это «внутренний» размер порции. Batch (-b) разбивается на более мелкие части (micro-batch) для реальных вычислений. Обычно менять не нужно.</div>
<p>Физический размер batch — сколько токенов реально обрабатывается за одну итерацию вычислений. Должен быть &le; batch size (-b). По умолчанию 512.</p>
<div class="tip">Продвинутый параметр. Уменьшение снижает пиковое потребление памяти при PP, но замедляет обработку. Для большинства пользователей 512 оптимально.</div>
<div class="see-also">См. также: <span>-b</span> (batch size)</div>`,
    en: `<h4>Micro-batch Size (-ub)</h4>
<div class="beginner-section"><div class="label">For beginners</div>This is the "inner" portion size. The batch (-b) gets split into smaller pieces (micro-batches) for actual computation. Usually doesn't need changing.</div>
<p>Physical batch size — tokens actually processed per compute iteration. Must be &le; batch size (-b). Default 512.</p>
<div class="tip">Advanced parameter. Reducing it lowers peak memory during PP but slows processing. 512 is optimal for most users.</div>
<div class="see-also">See also: <span>-b</span> (batch size)</div>`,
  },
  flash_attn: {
    ru: `<h4>Flash Attention (-fa)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Внимание (attention) — ключевой механизм LLM: модель «смотрит» на все предыдущие токены, чтобы решить что сказать дальше. Flash Attention — оптимизированная версия этого механизма. Работает быстрее и экономит память. Всегда включайте.</div>
<p>Оптимизированная реализация механизма внимания. Использует тайловый алгоритм, который:</p>
<p>• Снижает потребление памяти с O(n²) до O(n)</p>
<p>• Увеличивает скорость за счёт лучшей утилизации кеша</p>
<p>• Позволяет работать с более длинным контекстом</p>
<div class="tip">Нет ни одной причины выключать. Если что-то не работает с -fa 1 — это баг, о нём стоит сообщить.</div>
<div class="see-also">См. также: <span>-ctk</span> (тип KV-кеша), <span>-c</span> (контекст)</div>`,
    en: `<h4>Flash Attention (-fa)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Attention is the core LLM mechanism: the model "looks at" all previous tokens to decide what to say next. Flash Attention is an optimized version — faster and uses less memory. Always enable it.</div>
<p>Optimized attention mechanism using tiled algorithm:</p>
<p>• Reduces memory from O(n²) to O(n)</p>
<p>• Faster through better cache utilization</p>
<p>• Enables longer context windows</p>
<div class="tip">There is no reason to disable this. If something breaks with -fa 1 — it's a bug worth reporting.</div>
<div class="see-also">See also: <span>-ctk</span> (KV cache type), <span>-c</span> (context)</div>`,
  },
  repack_tensors: {
    ru: `<h4>Runtime Repack (-rtr)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Представьте книжный шкаф: обычно книги стоят как попало, и чтобы найти нужную — нужно рыться. Repack переставляет «книги» (веса модели) так, чтобы процессор мог быстрее их читать. Но если модель не влезает в память — перестановка только мешает, потому что надо загрузить ВСЁ с диска.</div>
<p>При загрузке модели перепаковывает тензоры в формат, оптимальный для L1D-кеша процессора (interleaved layout). Тип меняется, например, Q4_K → Q4_K_R4.</p>
<p><b>Для in-RAM моделей:</b> <span class="good">рекомендуется</span> — ускоряет матричные операции.</p>
<p><b>Для swap-bound моделей:</b> <span class="bad">КАТЕГОРИЧЕСКИ НЕТ</span></p>
<div class="bench">Бенчмарки на MiniMax-M2.5 (151 ГБ, 96 ГБ RAM):
• Без rtr: <span class="good">0.91 t/s</span>
• С rtr:   <span class="bad">0.36-0.49 t/s</span> (-46..60%)
Причина: rtr отключает mmap и загружает ВСЮ модель
(151 ГБ) в виртуальную память, увеличивая working set.</div>
<div class="tip">Правило: если модель помещается в RAM — включайте rtr. Если нет — ни в коем случае.</div>
<div class="see-also">См. также: <span>-muge</span> (merge экспертов), <span>mmap</span></div>`,
    en: `<h4>Runtime Repack (-rtr)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Imagine a bookshelf: books are scattered randomly, finding the right one takes time. Repack rearranges the "books" (model weights) so the CPU reads them faster. But if the model doesn't fit in memory — rearranging makes things worse because you must load EVERYTHING from disk.</div>
<p>At load time, repacks tensors into a layout optimal for L1D cache (interleaved). Type changes e.g. Q4_K → Q4_K_R4.</p>
<p><b>For in-RAM models:</b> <span class="good">recommended</span> — speeds up matrix ops.</p>
<p><b>For swap-bound models:</b> <span class="bad">ABSOLUTELY NOT</span></p>
<div class="bench">Benchmarks on MiniMax-M2.5 (151 GB, 96 GB RAM):
• Without rtr: <span class="good">0.91 t/s</span>
• With rtr:    <span class="bad">0.36-0.49 t/s</span> (-46..60%)
Reason: rtr disables mmap and loads the ENTIRE model
(151 GB) into virtual memory, increasing working set.</div>
<div class="tip">Rule: if model fits in RAM — enable rtr. If not — never.</div>
<div class="see-also">See also: <span>-muge</span> (merge experts), <span>mmap</span></div>`,
  },
  merge_up_gate_exps: {
    ru: `<h4>Merge Up+Gate Experts (-muge)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>В MoE-моделях каждый «эксперт» состоит из двух частей (up и gate). Эта опция склеивает их в одну, чтобы CPU мог читать их за один проход. Работает только для MoE моделей. Для больших моделей, не помещающихся в память — вредит.</div>
<p>Объединяет два экспертных тензора (ffn_up_exps и ffn_gate_exps) в один непрерывный тензор. Потенциально лучше утилизирует кеш при последовательном доступе.</p>
<p><b>Только MoE:</b> на dense моделях эффекта нет.</p>
<p><b>Для swap-bound MoE:</b> <span class="bad">-46% TG</span> — удваивает размер непрерывного выделения, страдает от page faults.</p>
<div class="tip">В текущей версии даже для in-RAM MoE прирост минимальный. Безопаснее держать OFF.</div>
<div class="see-also">См. также: <span>-rtr</span> (repack), <span>-no-fmoe</span> (fused MoE)</div>`,
    en: `<h4>Merge Up+Gate Experts (-muge)</h4>
<div class="beginner-section"><div class="label">For beginners</div>In MoE models each "expert" consists of two parts (up and gate). This option glues them into one so the CPU reads them in a single pass. Only works for MoE models. For large models that don't fit in memory — it hurts.</div>
<p>Merges two expert tensors (ffn_up_exps and ffn_gate_exps) into one contiguous tensor. Potentially better cache utilization for sequential access.</p>
<p><b>MoE only:</b> no effect on dense models.</p>
<p><b>For swap-bound MoE:</b> <span class="bad">-46% TG</span> — doubles contiguous allocation, suffers from page faults.</p>
<div class="tip">Even for in-RAM MoE the gain is minimal in current version. Safer to keep OFF.</div>
<div class="see-also">See also: <span>-rtr</span> (repack), <span>-no-fmoe</span> (fused MoE)</div>`,
  },
  cache_type_k: {
    ru: `<h4>KV Cache K Type (-ctk)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Когда модель генерирует текст, она запоминает «ключи» и «значения» для каждого предыдущего токена — это KV-кеш. Чем длиннее разговор, тем больше памяти он занимает. Квантизация (q8_0) сжимает эти данные вдвое без потери качества — как ZIP для фотографий без потерь.</div>
<p>Тип квантизации для ключей (K) в KV-кеше. KV-кеш хранит промежуточные данные внимания для всех обработанных токенов.</p>
<div class="bench">Сравнение типов:
• f16:   базовый, 2 байта/элемент
• <span class="good">q8_0:  1 байт/элемент — 50% экономии, 0% потери</span>
• q4_0:  0.5 байт/элемент — 75% экономии, минимальные потери
• f32:   4 байта — перерасход, не рекомендуется</div>
<div class="tip"><b>q8_0 — золотой стандарт.</b> Экономит половину памяти KV-кеша бесплатно. Подтверждено бенчмарками: PP=315 t/s, TG=29.6 t/s — идентично f16.</div>
<div class="see-also">См. также: <span>-ctv</span> (тип V-кеша), <span>-khad</span> (Hadamard), <span>-c</span> (контекст)</div>`,
    en: `<h4>KV Cache K Type (-ctk)</h4>
<div class="beginner-section"><div class="label">For beginners</div>As the model generates text, it memorizes "keys" and "values" for each previous token — that's the KV cache. The longer the conversation, the more memory it uses. Quantization (q8_0) compresses this data by half with no quality loss — like lossless ZIP for photos.</div>
<p>Quantization type for keys (K) in KV cache. KV cache stores intermediate attention data for all processed tokens.</p>
<div class="bench">Type comparison:
• f16:   baseline, 2 bytes/element
• <span class="good">q8_0:  1 byte/element — 50% savings, 0% loss</span>
• q4_0:  0.5 bytes/element — 75% savings, minimal loss
• f32:   4 bytes — wasteful, not recommended</div>
<div class="tip"><b>q8_0 is the gold standard.</b> Saves half KV cache memory for free. Confirmed by benchmarks: PP=315 t/s, TG=29.6 t/s — identical to f16.</div>
<div class="see-also">See also: <span>-ctv</span> (V-cache type), <span>-khad</span> (Hadamard), <span>-c</span> (context)</div>`,
  },
  cache_type_v: {
    ru: `<h4>KV Cache V Type (-ctv)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Аналогично -ctk, но для «значений» (V). V-кеш менее чувствителен к сжатию, поэтому его можно квантизировать агрессивнее (q4_0), особенно если нужно уместить огромный контекст.</div>
<p>Тип квантизации для значений (V) в KV-кеше. V-часть менее чувствительна к потере точности, чем K-часть.</p>
<div class="bench">Рекомендации:
• f16:   базовый — максимальное качество
• q8_0:  <span class="good">безопасный выбор</span> — 50% экономии
• q4_0:  75% экономии — для максимального контекста
• Для swap-bound: q8_0 (экономим RAM для весов)</div>
<div class="tip">Для большинства случаев ставьте как -ctk (q8_0). Для контекста 128K+ можно q4_0.</div>
<div class="see-also">См. также: <span>-ctk</span> (тип K-кеша), <span>-c</span> (контекст)</div>`,
    en: `<h4>KV Cache V Type (-ctv)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Same as -ctk but for "values" (V). V-cache is less sensitive to compression, so you can quantize it more aggressively (q4_0), especially if you need a huge context window.</div>
<p>Quantization type for values (V) in KV cache. V-part is less sensitive to precision loss than K-part.</p>
<div class="bench">Recommendations:
• f16:   baseline — maximum quality
• q8_0:  <span class="good">safe choice</span> — 50% savings
• q4_0:  75% savings — for maximum context
• For swap-bound: q8_0 (save RAM for weights)</div>
<div class="tip">For most cases set same as -ctk (q8_0). For 128K+ context try q4_0.</div>
<div class="see-also">See also: <span>-ctk</span> (K-cache type), <span>-c</span> (context)</div>`,
  },
  ser: {
    ru: `<h4>Smart Expert Reduction (-ser)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>В MoE-моделях на каждый токен «голосуют» эксперты, и обычно берут 8 самых популярных. Но иногда 2-3 из них почти не нужны (их «голос» очень слабый). SER отсеивает таких слабых экспертов, экономя время на их загрузку с диска. Это как не приглашать на совещание тех, кому нечего сказать.</div>
<p>В MoE моделях роутер выбирает top-K экспертов на каждый токен (напр. 8 из 256). SER позволяет отбрасывать экспертов с низким весом:</p>
<p>• <b>min_experts</b> — минимум экспертов (гарантия). Напр. 4</p>
<p>• <b>threshold</b> — порог веса. Эксперт с весом < threshold отбрасывается. Напр. 0.05</p>
<div class="bench">Пример для MiniMax-M2.5 (256 экспертов, 8 активных):
• Без SER: 8 экспертов × 62 слоя × 8.8 МБ = 4.4 ГБ/токен с диска
• SER min=4,thresh=0.05: ~6 экспертов = 3.3 ГБ/токен (-25%)
• Ожидание: ~1.15-1.25 t/s вместо 0.91 t/s</div>
<div class="tip">Начните с <span class="hl">-ser 4,0.05</span> и проверьте качество генерации. Увеличивайте порог осторожно.</div>
<div class="see-also">См. также: <span>тип модели</span> (Dense vs MoE)</div>`,
    en: `<h4>Smart Expert Reduction (-ser)</h4>
<div class="beginner-section"><div class="label">For beginners</div>In MoE models, experts "vote" on each token and usually the top 8 are selected. But sometimes 2-3 of them barely contribute (very low "vote"). SER filters out these weak experts, saving time loading them from disk. It's like not inviting people who have nothing to say to a meeting.</div>
<p>In MoE models the router picks top-K experts per token (e.g. 8 of 256). SER drops low-weight experts:</p>
<p>• <b>min_experts</b> — minimum guaranteed experts. E.g. 4</p>
<p>• <b>threshold</b> — weight threshold. Expert with weight < threshold is dropped. E.g. 0.05</p>
<div class="bench">Example for MiniMax-M2.5 (256 experts, 8 active):
• No SER: 8 experts × 62 layers × 8.8 MB = 4.4 GB/token from disk
• SER min=4,thresh=0.05: ~6 experts = 3.3 GB/token (-25%)
• Expected: ~1.15-1.25 t/s instead of 0.91 t/s</div>
<div class="tip">Start with <span class="hl">-ser 4,0.05</span> and check generation quality. Increase threshold cautiously.</div>
<div class="see-also">See also: <span>model type</span> (Dense vs MoE)</div>`,
  },
  model_size_gb: {
    ru: `<h4>Размер модели</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Это общий размер файлов модели на диске. Главное правило: если модель больше ~90% вашей RAM — она «swap-bound» (не помещается в память, и системе приходится постоянно подгружать данные с SSD). Это кардинально меняет оптимальные настройки.</div>
<p>Суммарный размер GGUF-файлов модели. Для split-моделей (например MiniMax 5 частей) суммируются все части автоматически.</p>
<p><b>Swap-bound порог:</b> модель > 90% от RAM вашего профиля.</p>
<div class="bench">Пример: 96 ГБ RAM, порог = 86 ГБ
• Qwen3-30B Q4_K_M (17 ГБ): <span class="good">in-RAM</span> — rtr ON
• MiniMax-M2.5 Q5_K (151 ГБ): <span class="bad">swap-bound</span> — rtr OFF, muge OFF
• Потолок swap-bound на SSD 3 ГБ/с: ~1.0-1.2 t/s</div>`,
    en: `<h4>Model Size</h4>
<div class="beginner-section"><div class="label">For beginners</div>This is the total size of model files on disk. Key rule: if the model is larger than ~90% of your RAM — it's "swap-bound" (doesn't fit in memory, so the system constantly loads data from SSD). This fundamentally changes optimal settings.</div>
<p>Total size of GGUF model files. For split models (e.g. MiniMax 5 parts) all parts are summed automatically.</p>
<p><b>Swap-bound threshold:</b> model > 90% of your profile's RAM.</p>
<div class="bench">Example: 96 GB RAM, threshold = 86 GB
• Qwen3-30B Q4_K_M (17 GB): <span class="good">in-RAM</span> — rtr ON
• MiniMax-M2.5 Q5_K (151 GB): <span class="bad">swap-bound</span> — rtr OFF, muge OFF
• Swap-bound ceiling at SSD 3 GB/s: ~1.0-1.2 t/s</div>`,
  },
  model_type: {
    ru: `<h4>Тип модели: Dense vs MoE</h4>
<div class="beginner-section"><div class="label">Для новичков</div><b>Dense</b> — обычная модель, где все веса работают на каждый токен. Как один большой мозг.<br><b>MoE</b> (Mixture of Experts) — модель из множества «экспертов-специалистов». На каждый токен работают только несколько (напр. 8 из 256). Модель огромная, но реально работает малая часть — поэтому быстрая при том же качестве.</div>
<p><b>Dense</b> (Llama, Phi, Gemma): все параметры активны на каждый токен. Производительность зависит от bandwidth.</p>
<p><b>MoE</b> (MiniMax, DeepSeek, Qwen3-MoE): на каждый токен активируется только K экспертов из N. Например, MiniMax: 8 из 256.</p>
<div class="bench">Что это значит для параметров:
• MoE: -muge и -rtr критичны для swap-bound
• MoE: -ser может уменьшить число активных экспертов
• MoE: >16 потоков вредит из-за контенции
• Dense: -muge и -ser не имеют эффекта</div>
<div class="tip">Автоматически определяется из GGUF метаданных кнопкой "Авто-конфигурация".</div>`,
    en: `<h4>Model Type: Dense vs MoE</h4>
<div class="beginner-section"><div class="label">For beginners</div><b>Dense</b> — a regular model where all weights work for every token. Like one big brain.<br><b>MoE</b> (Mixture of Experts) — a model made of many "specialist experts". Only a few work per token (e.g. 8 of 256). The model is huge, but only a small part actually runs — so it's fast while maintaining quality.</div>
<p><b>Dense</b> (Llama, Phi, Gemma): all parameters active for every token. Performance depends on bandwidth.</p>
<p><b>MoE</b> (MiniMax, DeepSeek, Qwen3-MoE): only K of N experts activated per token. E.g. MiniMax: 8 of 256.</p>
<div class="bench">What this means for parameters:
• MoE: -muge and -rtr critical for swap-bound
• MoE: -ser can reduce active expert count
• MoE: >16 threads hurts due to contention
• Dense: -muge and -ser have no effect</div>
<div class="tip">Auto-detected from GGUF metadata via "Auto-configure" button.</div>`,
  },
  n_gpu_layers: {
    ru: `<h4>GPU слои (-ngl)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Модель состоит из слоёв (layers). Каждый слой можно разместить на GPU (видеокарте) вместо CPU. GPU считает намного быстрее, но у неё ограниченная память (VRAM). Если GPU нет — ставьте 0.</div>
<p>Количество слоёв трансформера, размещаемых в VRAM видеокарты.</p>
<p>• <b>-1</b> = авто (все что влезут в VRAM)</p>
<p>• <b>0</b> = только CPU (для систем без GPU)</p>
<p>• <b>N</b> = конкретное число слоёв</p>
<div class="tip">Для CPU-only систем (как Ryzen без GPU) всегда ставьте 0. Дашборд автоматически установит 0 при авто-конфигурации.</div>`,
    en: `<h4>GPU Layers (-ngl)</h4>
<div class="beginner-section"><div class="label">For beginners</div>A model consists of layers. Each layer can be placed on the GPU (graphics card) instead of CPU. GPU computes much faster but has limited memory (VRAM). If you have no GPU — set to 0.</div>
<p>Number of transformer layers placed in GPU VRAM.</p>
<p>• <b>-1</b> = auto (as many as fit in VRAM)</p>
<p>• <b>0</b> = CPU only (for systems without GPU)</p>
<p>• <b>N</b> = specific layer count</p>
<div class="tip">For CPU-only systems (like Ryzen without GPU) always set 0. The dashboard auto-sets 0 during auto-configuration.</div>`,
  },
  k_cache_hadamard: {
    ru: `<h4>K-Cache Hadamard (-khad)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Когда мы сжимаем (квантизуем) K-кеш, некоторые числа теряют точность больше других (выбросы). Преобразование Адамара равномерно «размазывает» эти выбросы, снижая общую ошибку. Аналогия: вместо одной глубокой ямы на дороге — множество маленьких неровностей, по которым ехать комфортнее.</div>
<p>Применяет преобразование Адамара к K-кешу перед квантизацией. Это "размазывает" выбросы по всем элементам, уменьшая ошибку округления.</p>
<p><b>Полезно:</b> с квантизированным KV cache (ctk=q8_0, q4_0 и т.д.)</p>
<p><b>Бессмысленно:</b> с f16/f32 — нечего квантизировать</p>
<div class="see-also">См. также: <span>-ctk</span> (тип K-кеша), <span>-ctv</span> (тип V-кеша)</div>`,
    en: `<h4>K-Cache Hadamard (-khad)</h4>
<div class="beginner-section"><div class="label">For beginners</div>When we compress (quantize) the K-cache, some numbers lose more precision than others (outliers). Hadamard transform evenly "spreads" these outliers, reducing overall error. Analogy: instead of one deep pothole on the road — many tiny bumps that are much more comfortable to drive over.</div>
<p>Applies Hadamard transform to K-cache before quantization. This "spreads" outliers across all elements, reducing rounding error.</p>
<p><b>Useful:</b> with quantized KV cache (ctk=q8_0, q4_0, etc.)</p>
<p><b>Pointless:</b> with f16/f32 — nothing to quantize</p>
<div class="see-also">See also: <span>-ctk</span> (K-cache type), <span>-ctv</span> (V-cache type)</div>`,
  },
  graph_reuse: {
    ru: `<h4>Graph Reuse (-gr / -no-gr)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Модель при генерации каждого токена строит «план вычислений» (граф). Если план не меняется между токенами — его можно переиспользовать, экономя время. Всегда держите ON.</div>
<p>Переиспользование графа вычислений между последовательными токенами. Экономит время на построение графа (~5-10% PP).</p>
<div class="tip">Выключать только для отладки или при возникновении артефактов (крайне маловероятно).</div>`,
    en: `<h4>Graph Reuse (-gr / -no-gr)</h4>
<div class="beginner-section"><div class="label">For beginners</div>For each token, the model builds a "computation plan" (graph). If the plan doesn't change between tokens — it can be reused, saving time. Always keep ON.</div>
<p>Reuse compute graph between consecutive tokens. Saves graph construction time (~5-10% PP).</p>
<div class="tip">Only disable for debugging or if you encounter artifacts (extremely unlikely).</div>`,
  },
  merge_qkv: {
    ru: `<h4>Merge QKV (-mqkv)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>В механизме внимания используются три матрицы: Q (запрос), K (ключ), V (значение). Эта опция объединяет их в одну, чтобы CPU мог загрузить все три за один проход памяти вместо трёх отдельных.</div>
<p>Слияние Q, K, V проекций в один непрерывный тензор для attention. Улучшает локальность данных при вычислениях внимания.</p>
<div class="tip">Экспериментальная опция. Может дать небольшой прирост на некоторых моделях.</div>
<div class="see-also">См. также: <span>-fa</span> (Flash Attention), <span>-ctk</span>/<span>-ctv</span> (KV cache)</div>`,
    en: `<h4>Merge QKV (-mqkv)</h4>
<div class="beginner-section"><div class="label">For beginners</div>The attention mechanism uses three matrices: Q (query), K (key), V (value). This option merges them into one so the CPU can load all three in a single memory pass instead of three separate ones.</div>
<p>Merge Q, K, V projections into one contiguous tensor for attention. Improves data locality during attention computation.</p>
<div class="tip">Experimental option. May give a small boost on some models.</div>
<div class="see-also">See also: <span>-fa</span> (Flash Attention), <span>-ctk</span>/<span>-ctv</span> (KV cache)</div>`,
  },
  fused_moe_up_gate: {
    ru: `<h4>Fused MoE (-no-fmoe)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Вместо двух отдельных операций (up и gate) для каждого эксперта, эта опция объединяет их в одну. Как готовить два блюда одновременно вместо последовательно — экономит время. По умолчанию включено.</div>
<p>Объединённая операция up*gate для MoE dispatch. Уменьшает число kernel launches и накладные расходы на вызовы.</p>
<div class="tip">Нет причин отключать. Флаг <span class="hl">-no-fmoe</span> существует для отладки.</div>
<div class="see-also">См. также: <span>-no-fug</span> (fused up*gate FFN), <span>-muge</span> (merge experts)</div>`,
    en: `<h4>Fused MoE (-no-fmoe)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Instead of two separate operations (up and gate) for each expert, this fuses them into one. Like cooking two dishes simultaneously instead of sequentially — saves time. Enabled by default.</div>
<p>Fused up*gate operation for MoE dispatch. Reduces kernel launches and call overhead.</p>
<div class="tip">No reason to disable. The flag <span class="hl">-no-fmoe</span> exists for debugging.</div>
<div class="see-also">See also: <span>-no-fug</span> (fused up*gate FFN), <span>-muge</span> (merge experts)</div>`,
  },
  fused_up_gate: {
    ru: `<h4>Fused Up*Gate (-no-fug)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Аналогично Fused MoE, но для FFN-блока (Feed-Forward Network) — основного вычислительного блока модели. Объединяет две операции в одну для скорости.</div>
<p>Объединённая операция up*unary(gate) для FFN-блоков. Меньше kernel-вызовов = быстрее.</p>
<div class="tip">По умолчанию ON. Отключать только для отладки.</div>
<div class="see-also">См. также: <span>-no-fmoe</span> (fused MoE)</div>`,
    en: `<h4>Fused Up*Gate (-no-fug)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Similar to Fused MoE but for FFN blocks (Feed-Forward Network) — the main computational block of the model. Combines two operations into one for speed.</div>
<p>Fused up*unary(gate) for FFN blocks. Fewer kernel calls = faster.</p>
<div class="tip">Default ON. Only disable for debugging.</div>
<div class="see-also">See also: <span>-no-fmoe</span> (fused MoE)</div>`,
  },
  mla_attn: {
    ru: `<h4>Режим MLA (-mla)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>MLA (Multi-head Latent Attention) — специальный способ хранения KV-кеша, поддерживаемый некоторыми моделями (DeepSeek). Использует сжатое представление, экономя память. Режим 3 = автовыбор — система сама определит лучший вариант.</div>
<p>Режим работы Multi-head Latent Attention для моделей, поддерживающих его (DeepSeek и т.п.):</p>
<p>• <b>0</b> — Standard: обычный attention без MLA</p>
<p>• <b>1</b> — K + V^T cache: полный MLA с кешированием K и транспонированного V</p>
<p>• <b>2</b> — K cache only: только K-кеш, V пересчитывается</p>
<p>• <b>3</b> — Auto: автоматический выбор лучшего режима</p>
<div class="tip">Оставьте 3 (авто). Для моделей без MLA этот параметр игнорируется.</div>`,
    en: `<h4>MLA Mode (-mla)</h4>
<div class="beginner-section"><div class="label">For beginners</div>MLA (Multi-head Latent Attention) — a special way of storing KV cache supported by some models (DeepSeek). Uses compressed representation, saving memory. Mode 3 = auto — the system will pick the best option.</div>
<p>Multi-head Latent Attention mode for models that support it (DeepSeek etc.):</p>
<p>• <b>0</b> — Standard: regular attention without MLA</p>
<p>• <b>1</b> — K + V^T cache: full MLA caching K and transposed V</p>
<p>• <b>2</b> — K cache only: only K-cache, V is recomputed</p>
<p>• <b>3</b> — Auto: automatically select best mode</p>
<div class="tip">Leave at 3 (auto). For models without MLA this parameter is ignored.</div>`,
  },
  use_mmap: {
    ru: `<h4>Memory-mapped I/O (mmap)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Вместо загрузки всего файла модели в RAM, mmap «показывает» файл системе как часть памяти. Когда нужны данные — система подгружает их с диска автоматически. Это единственный способ работать с моделями, которые больше вашей RAM.</div>
<p>Модель отображается в виртуальное адресное пространство через CreateFileMapping (Windows) / mmap (Linux). OS подгружает страницы с диска по мере обращения.</p>
<p><b>Для swap-bound:</b> обязательно ON — это единственный способ работать с моделью больше RAM. OS управляет подкачкой автоматически.</p>
<p><b>При -rtr:</b> принудительно OFF — repack требует изменения данных в памяти, что невозможно с read-only mmap.</p>
<div class="tip">Не трогайте вручную — rtr и система управляют этим автоматически.</div>
<div class="see-also">См. также: <span>-rtr</span> (repack), <span>--mlock</span></div>`,
    en: `<h4>Memory-mapped I/O (mmap)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Instead of loading the entire model file into RAM, mmap "shows" the file to the system as if it were memory. When data is needed — the system loads it from disk automatically. This is the only way to work with models larger than your RAM.</div>
<p>Model is mapped into virtual address space via CreateFileMapping (Windows) / mmap (Linux). OS loads pages from disk on access.</p>
<p><b>For swap-bound:</b> must be ON — only way to work with models larger than RAM. OS manages paging automatically.</p>
<p><b>With -rtr:</b> forced OFF — repack modifies data in memory, impossible with read-only mmap.</p>
<div class="tip">Don't touch manually — rtr and the system manage this automatically.</div>
<div class="see-also">See also: <span>-rtr</span> (repack), <span>--mlock</span></div>`,
  },
  use_mlock: {
    ru: `<h4>mlock (--mlock)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Когда модель в RAM, система может временно «вытеснить» часть данных на диск, если ей нужна память для другого. mlock запрещает это — данные гарантированно остаются в RAM. Полезно, если модель почти помещается и вы хотите избежать случайных замедлений.</div>
<p>Блокировка всей модели в RAM — запрещает OS вытеснять страницы в swap-файл.</p>
<p><b>Windows:</b> требует привилегию SeLockMemoryPrivilege (настраивается через secpol.msc)</p>
<p><b>Linux:</b> использует mlock(), может потребовать повышение лимитов (ulimit -l)</p>
<div class="tip">Для моделей, которые точно помещаются в RAM — может дать стабильность. Для swap-bound — не используйте (невозможно заблокировать больше чем есть RAM).</div>
<div class="see-also">См. также: <span>mmap</span>, <span>размер модели</span></div>`,
    en: `<h4>mlock (--mlock)</h4>
<div class="beginner-section"><div class="label">For beginners</div>When the model is in RAM, the system may temporarily "evict" some data to disk if it needs memory for something else. mlock prevents this — data is guaranteed to stay in RAM. Useful if the model barely fits and you want to avoid random slowdowns.</div>
<p>Lock entire model in RAM — prevents OS from swapping pages to disk.</p>
<p><b>Windows:</b> requires SeLockMemoryPrivilege (set via secpol.msc)</p>
<p><b>Linux:</b> uses mlock(), may need raised limits (ulimit -l)</p>
<div class="tip">For models that definitely fit in RAM — can provide stability. For swap-bound — don't use (can't lock more than available RAM).</div>
<div class="see-also">See also: <span>mmap</span>, <span>model size</span></div>`,
  },
  numa: {
    ru: `<h4>Стратегия NUMA (--numa)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>NUMA — архитектура памяти в серверных и некоторых десктопных CPU. Разные группы ядер имеют «свою» память, и доступ к «чужой» медленнее. Для обычных десктопных AMD (AM5) — оставьте disabled.</div>
<p>Политика размещения памяти по NUMA-нодам:</p>
<p>• <b>disabled</b> — OS решает сама (оптимально для single-socket)</p>
<p>• <b>distribute</b> — равномерно по нодам</p>
<p>• <b>isolate</b> — привязка потоков к нодам</p>
<p>• <b>numactl</b> — через утилиту numactl</p>
<div class="bench">Бенчмарки на Zen4 (AM5, single socket):
• disabled: <span class="good">оптимум</span>
• distribute: <span class="bad">-5% TG</span>
• isolate: <span class="bad">-11% TG</span></div>
<div class="tip">Для десктопных процессоров (AM5, LGA1700) всегда disabled. NUMA-настройки актуальны для dual-socket серверов.</div>`,
    en: `<h4>NUMA Strategy (--numa)</h4>
<div class="beginner-section"><div class="label">For beginners</div>NUMA — memory architecture in server and some desktop CPUs. Different core groups have "their own" memory, and accessing "foreign" memory is slower. For regular desktop AMD (AM5) — leave disabled.</div>
<p>Memory placement policy across NUMA nodes:</p>
<p>• <b>disabled</b> — OS decides (optimal for single-socket)</p>
<p>• <b>distribute</b> — spread evenly across nodes</p>
<p>• <b>isolate</b> — pin threads to nodes</p>
<p>• <b>numactl</b> — via numactl utility</p>
<div class="bench">Benchmarks on Zen4 (AM5, single socket):
• disabled: <span class="good">optimal</span>
• distribute: <span class="bad">-5% TG</span>
• isolate: <span class="bad">-11% TG</span></div>
<div class="tip">For desktop CPUs (AM5, LGA1700) always disabled. NUMA settings matter for dual-socket servers.</div>`,
  },
  n_ctx: {
    ru: `<h4>Размер контекста (-c)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Контекст — это «память» модели в рамках разговора. Если контекст 8192 токенов — модель помнит примерно 6000 слов вашего диалога. Больше контекст = помнит больше, но расходует больше RAM. Для swap-bound моделей лучше ограничить.</div>
<p>Максимальное число токенов, которые модель "помнит". Каждый токен занимает место в KV-кеше.</p>
<div class="bench">Расход памяти KV-кеша (примерно):
• 8K контекст, ctk=f16:  ~256 МБ
• 32K контекст, ctk=f16: ~1 ГБ
• 128K контекст, ctk=q8_0: ~2 ГБ
• 128K контекст, ctk=f16: ~4 ГБ</div>
<div class="tip">Для swap-bound моделей ограничьте контекст (8192), чтобы освободить RAM для весов модели. 0 = авто из метаданных (может быть 128K+).</div>
<div class="see-also">См. также: <span>-ctk</span>/<span>-ctv</span> (тип KV-кеша), <span>-fa</span> (Flash Attention)</div>`,
    en: `<h4>Context Size (-c)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Context is the model's "memory" within a conversation. If context is 8192 tokens — the model remembers roughly 6000 words of your dialog. More context = remembers more, but uses more RAM. For swap-bound models it's better to limit it.</div>
<p>Maximum tokens the model "remembers". Each token occupies space in KV cache.</p>
<div class="bench">KV cache memory usage (approximate):
• 8K context, ctk=f16:  ~256 MB
• 32K context, ctk=f16: ~1 GB
• 128K context, ctk=q8_0: ~2 GB
• 128K context, ctk=f16: ~4 GB</div>
<div class="tip">For swap-bound models limit context (8192) to free RAM for model weights. 0 = auto from metadata (can be 128K+).</div>
<div class="see-also">See also: <span>-ctk</span>/<span>-ctv</span> (KV cache type), <span>-fa</span> (Flash Attention)</div>`,
  },
  seed: {
    ru: `<h4>Seed (-s)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Модель генерирует текст с элементом случайности. Seed — «зерно» этой случайности. С одинаковым seed модель даст одинаковый ответ на один и тот же промт. Полезно для тестирования. -1 = каждый раз разный результат.</div>
<p>Зерно генератора случайных чисел. Фиксированный seed обеспечивает воспроизводимость результатов.</p>
<div class="tip">Для обычного использования оставьте -1. Для бенчмарков или сравнения моделей — укажите конкретное число.</div>`,
    en: `<h4>Seed (-s)</h4>
<div class="beginner-section"><div class="label">For beginners</div>The model generates text with an element of randomness. Seed is the "seed" of that randomness. With the same seed the model gives the same answer for the same prompt. Useful for testing. -1 = different result each time.</div>
<p>Random number generator seed. Fixed seed ensures reproducible results.</p>
<div class="tip">For normal use leave at -1. For benchmarks or model comparisons — set a specific number.</div>`,
  },
  n_predict: {
    ru: `<h4>Макс. токенов (-n)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Ограничение длины ответа модели в токенах. 1 токен ≈ 0.75 слова. -1 = без ограничений — модель остановится сама (по стоп-токену). 128 = для бенчмарков. 2048 = для ограничения длинных ответов.</div>
<p>Максимальное число токенов, которые модель сгенерирует за один запрос.</p>
<p>• <b>-1</b> = без ограничений (остановка по EOS-токену или контексту)</p>
<p>• <b>128</b> = типичное значение для бенчмарков</p>
<p>• <b>2048</b> = ограничение длины ответа</p>`,
    en: `<h4>Max Tokens (-n)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Limits the model's response length in tokens. 1 token ≈ 0.75 words. -1 = unlimited — model stops on its own (stop token). 128 = for benchmarks. 2048 = to limit long responses.</div>
<p>Maximum tokens the model will generate per request.</p>
<p>• <b>-1</b> = unlimited (stops on EOS token or context limit)</p>
<p>• <b>128</b> = typical for benchmarks</p>
<p>• <b>2048</b> = limit response length</p>`,
  },
  defrag_thold: {
    ru: `<h4>Порог дефрагментации (-dt)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>KV-кеш может фрагментироваться (появляются «дыры»), когда токены удаляются из контекста. Дефрагментация «уплотняет» кеш. Обычно не нужно менять.</div>
<p>Порог фрагментации KV-кеша для автоматической дефрагментации:</p>
<p>• <b>-1</b> = дефрагментация выключена (по умолчанию)</p>
<p>• <b>0.1</b> = мягкая (при >10% фрагментации)</p>
<p>• <b>0.01</b> = агрессивная (при >1%)</p>
<div class="tip">Актуально при длинных сессиях с удалением сообщений (напр. в server mode). Для обычного использования оставьте -1.</div>`,
    en: `<h4>Defrag Threshold (-dt)</h4>
<div class="beginner-section"><div class="label">For beginners</div>KV cache can get fragmented (develop "holes") when tokens are removed from context. Defragmentation "compacts" the cache. Usually doesn't need changing.</div>
<p>KV cache fragmentation threshold for automatic defragmentation:</p>
<p>• <b>-1</b> = defragmentation disabled (default)</p>
<p>• <b>0.1</b> = gentle (at >10% fragmentation)</p>
<p>• <b>0.01</b> = aggressive (at >1%)</p>
<div class="tip">Relevant for long sessions with message deletion (e.g. server mode). For normal use leave at -1.</div>`,
  },
  n_parallel: {
    ru: `<h4>Параллельные слоты (-np)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>При использовании llama-server несколько пользователей могут отправлять запросы одновременно. Каждый «слот» — это отдельная сессия с собственной памятью. Больше слотов = больше одновременных пользователей, но каждый слот потребляет RAM на KV-кеш.</div>
<p>Количество параллельных слотов обработки в llama-server. Каждый слот имеет собственный KV-кеш.</p>
<div class="bench">Расход памяти:
• 1 слот, c=8192, ctk=q8_0: ~128 МБ KV-кеш
• 4 слота, c=8192, ctk=q8_0: ~512 МБ KV-кеш
• 8 слотов, c=32768, ctk=f16: ~8 ГБ KV-кеш</div>
<div class="tip">Начните с 1 и увеличивайте по потребности. Для локального использования 1-2 обычно достаточно.</div>
<div class="see-also">См. также: <span>--host</span>, <span>--port</span>, <span>-c</span> (контекст)</div>`,
    en: `<h4>Parallel Slots (-np)</h4>
<div class="beginner-section"><div class="label">For beginners</div>When using llama-server, multiple users can send requests simultaneously. Each "slot" is a separate session with its own memory. More slots = more concurrent users, but each slot consumes RAM for KV cache.</div>
<p>Number of parallel processing slots in llama-server. Each slot has its own KV cache.</p>
<div class="bench">Memory usage:
• 1 slot, c=8192, ctk=q8_0: ~128 MB KV cache
• 4 slots, c=8192, ctk=q8_0: ~512 MB KV cache
• 8 slots, c=32768, ctk=f16: ~8 GB KV cache</div>
<div class="tip">Start with 1 and increase as needed. For local use 1-2 is usually enough.</div>
<div class="see-also">See also: <span>--host</span>, <span>--port</span>, <span>-c</span> (context)</div>`,
  },
};

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
const GLOSSARY = [
  // --- Basics ---
  { cat: { ru: 'Основы', en: 'Basics' },
    term: { ru: 'Токен (token)', en: 'Token' },
    def: {
      ru: 'Минимальная единица текста для модели. Слово может быть 1-3 токена. «Привет» = 1 токен, «контрреволюционный» = 3-4 токена. 1 токен ≈ 0.75 слова (EN) или ~0.5 слова (RU). Скорость модели измеряется в токенах/секунду (t/s).',
      en: 'Smallest text unit for the model. A word can be 1-3 tokens. "Hello" = 1 token, "counterrevolutionary" = 3-4 tokens. 1 token ≈ 0.75 words. Model speed is measured in tokens/second (t/s).',
    }},
  { term: { ru: 'Промт (prompt)', en: 'Prompt' },
    def: {
      ru: 'Весь текст, который вы отправляете модели: системный промт + история диалога + ваш вопрос. Обработка промта (PP — Prompt Processing) — первая фаза, когда модель «читает» вашу просьбу.',
      en: 'All text you send to the model: system prompt + dialog history + your question. Prompt Processing (PP) is the first phase when the model "reads" your request.',
    }},
  { term: { ru: 'Генерация (TG — Token Generation)', en: 'Token Generation (TG)' },
    def: {
      ru: 'Вторая фаза — модель генерирует ответ по одному токену за раз. Скорость TG — то, что вы ощущаете как «скорость печати» модели. Обычно медленнее PP, потому что каждый токен зависит от предыдущего.',
      en: 'Second phase — the model generates a response one token at a time. TG speed is what you perceive as the model\'s "typing speed". Usually slower than PP because each token depends on the previous one.',
    }},
  { term: { ru: 'Контекст (context window)', en: 'Context Window' },
    def: {
      ru: 'Максимальное количество токенов, которые модель «видит» одновременно. Если контекст = 8192, модель помнит ~6000 слов диалога. Превысили лимит — старые сообщения «забываются».',
      en: 'Maximum number of tokens the model "sees" at once. If context = 8192, the model remembers ~6000 words of dialog. Exceed the limit — old messages get "forgotten".',
    }},
  // --- Model Architecture ---
  { cat: { ru: 'Архитектура модели', en: 'Model Architecture' },
    term: { ru: 'Dense модель', en: 'Dense Model' },
    def: {
      ru: 'Обычная модель, где все параметры (веса) используются для каждого токена. Примеры: Llama, Phi, Gemma. <span class="analogy">Как один универсальный работник, который знает всё.</span>',
      en: 'Regular model where all parameters (weights) are used for every token. Examples: Llama, Phi, Gemma. <span class="analogy">Like one universal worker who knows everything.</span>',
    }},
  { term: { ru: 'MoE (Mixture of Experts)', en: 'MoE (Mixture of Experts)' },
    def: {
      ru: 'Модель из множества «экспертов-специалистов». На каждый токен роутер выбирает только K из N (напр. 8 из 256). Модель огромная, но реально работает только малая часть. <span class="analogy">Как компания с 256 специалистами, где на каждый проект назначают только 8.</span> Примеры: MiniMax, DeepSeek, Qwen3-MoE.',
      en: 'Model made of many "specialist experts". For each token, a router selects only K of N (e.g. 8 of 256). The model is huge but only a small part actually runs. <span class="analogy">Like a company with 256 specialists where only 8 are assigned to each project.</span> Examples: MiniMax, DeepSeek, Qwen3-MoE.',
    }},
  { term: { ru: 'Роутер (router)', en: 'Router' },
    def: {
      ru: 'Компонент MoE модели, который решает какие эксперты будут обрабатывать каждый токен. Присваивает каждому эксперту «вес» — насколько он нужен. Экспертов с высоким весом берут, с низким — пропускают.',
      en: 'MoE component that decides which experts process each token. Assigns each expert a "weight" — how needed it is. High-weight experts are selected, low-weight ones are skipped.',
    }},
  { term: { ru: 'Слой (layer)', en: 'Layer' },
    def: {
      ru: 'Модель — это стопка одинаковых «слоёв» (обычно 32-80). Каждый слой выполняет: attention (внимание) + FFN (вычисления). Токен проходит через все слои последовательно, как по конвейеру.',
      en: 'A model is a stack of identical "layers" (usually 32-80). Each layer performs: attention + FFN (computations). A token passes through all layers sequentially, like an assembly line.',
    }},
  // --- Memory & Quantization ---
  { cat: { ru: 'Память и квантизация', en: 'Memory & Quantization' },
    term: { ru: 'Квантизация (quantization)', en: 'Quantization' },
    def: {
      ru: 'Сжатие весов модели из формата с высокой точностью (f16 — 2 байта) в более компактный (Q4_K — ~0.5 байта). Уменьшает размер модели в 3-4 раза с минимальной потерей качества. <span class="analogy">Как JPEG для фотографий — файл меньше, разница почти не видна.</span> Типы: Q4_K_M, Q5_K, Q6_K, Q8_0 — чем больше число, тем точнее и больше.',
      en: 'Compressing model weights from high precision (f16 — 2 bytes) to compact format (Q4_K — ~0.5 bytes). Reduces model size 3-4x with minimal quality loss. <span class="analogy">Like JPEG for photos — file is smaller, difference barely visible.</span> Types: Q4_K_M, Q5_K, Q6_K, Q8_0 — higher number = more precise and larger.',
    }},
  { term: { ru: 'KV-кеш (KV cache)', en: 'KV Cache' },
    def: {
      ru: 'Промежуточные данные внимания (Keys + Values) для всех обработанных токенов. Хранит «память» разговора. Растёт с каждым токеном. Можно квантизировать (ctk/ctv) для экономии памяти.',
      en: 'Intermediate attention data (Keys + Values) for all processed tokens. Stores conversation "memory". Grows with each token. Can be quantized (ctk/ctv) to save memory.',
    }},
  { term: { ru: 'Тензор (tensor)', en: 'Tensor' },
    def: {
      ru: 'Многомерный массив чисел — основная структура данных нейросети. Веса модели, KV-кеш, промежуточные вычисления — всё хранится в тензорах. <span class="analogy">Как таблицы в Excel, но многомерные.</span>',
      en: 'Multi-dimensional array of numbers — the core data structure of neural networks. Model weights, KV cache, intermediate computations — everything stored as tensors. <span class="analogy">Like Excel spreadsheets but multi-dimensional.</span>',
    }},
  { term: { ru: 'GGUF', en: 'GGUF' },
    def: {
      ru: 'Формат файлов моделей для llama.cpp. Содержит веса модели + метаданные (архитектура, размер контекста, тип квантизации). Большие модели могут быть split (разделены на несколько файлов, напр. -00001-of-00005.gguf).',
      en: 'Model file format for llama.cpp. Contains model weights + metadata (architecture, context size, quantization type). Large models can be split into multiple files (e.g. -00001-of-00005.gguf).',
    }},
  // --- Performance ---
  { cat: { ru: 'Производительность', en: 'Performance' },
    term: { ru: 'Swap-bound', en: 'Swap-bound' },
    def: {
      ru: 'Ситуация, когда модель не помещается в RAM и система подкачивает данные с SSD. Порог: размер модели > 90% RAM. Скорость ограничена SSD (~3 ГБ/с), а не CPU. <span class="analogy">Как работать с книгами, когда стол маленький — приходится постоянно ходить к полке.</span> Кардинально меняет оптимальные настройки.',
      en: 'When the model doesn\'t fit in RAM and the system pages data from SSD. Threshold: model size > 90% RAM. Speed is limited by SSD (~3 GB/s), not CPU. <span class="analogy">Like working with books when your desk is small — you constantly have to go to the shelf.</span> Fundamentally changes optimal settings.',
    }},
  { term: { ru: 'mmap (memory-mapped I/O)', en: 'mmap (memory-mapped I/O)' },
    def: {
      ru: 'Технология, которая «показывает» файл модели операционной системе как часть RAM. Вместо загрузки всего файла — ОС подгружает только нужные страницы с диска. Единственный способ работать со swap-bound моделями.',
      en: 'Technology that "shows" the model file to the OS as if it were RAM. Instead of loading the whole file — the OS loads only needed pages from disk. The only way to work with swap-bound models.',
    }},
  { term: { ru: 'Page fault', en: 'Page Fault' },
    def: {
      ru: 'Когда CPU обращается к данным, которых нет в RAM (они на диске) — происходит page fault. ОС ставит процесс на паузу, загружает нужную страницу (4 КБ) с SSD, и продолжает. Каждый page fault = задержка ~100 мкс. Основной источник замедления swap-bound моделей.',
      en: 'When CPU accesses data not in RAM (it\'s on disk) — a page fault occurs. OS pauses the process, loads the needed page (4 KB) from SSD, and continues. Each page fault ≈ ~100 µs delay. Main source of slowdown for swap-bound models.',
    }},
  { term: { ru: 'Working set', en: 'Working Set' },
    def: {
      ru: 'Объём данных, к которым модель реально обращается за определённый период. Если working set > RAM — происходят page faults и подкачка с диска. rtr и muge увеличивают working set, поэтому вредят swap-bound моделям.',
      en: 'Amount of data the model actually accesses over a period. If working set > RAM — page faults occur and data is paged from disk. rtr and muge increase working set, which is why they hurt swap-bound models.',
    }},
  // --- CPU / Hardware ---
  { cat: { ru: 'Процессор и железо', en: 'CPU & Hardware' },
    term: { ru: 'CCD (Core Complex Die)', en: 'CCD (Core Complex Die)' },
    def: {
      ru: 'Физический кристалл с ядрами в процессорах AMD. Ryzen 7950X имеет 2 CCD по 8 ядер, каждый со своим L3-кешем 32 МБ. <span class="analogy">Два отдельных «офиса», каждый со своим «складом» (L3 кешем).</span> Важно использовать оба CCD (-t 16) для доступа к полным 64 МБ L3.',
      en: 'Physical die with cores in AMD CPUs. Ryzen 7950X has 2 CCDs with 8 cores each, each with its own 32 MB L3 cache. <span class="analogy">Two separate "offices", each with its own "warehouse" (L3 cache).</span> Important to use both CCDs (-t 16) for full 64 MB L3 access.',
    }},
  { term: { ru: 'Кеш (L1D, L2, L3)', en: 'Cache (L1D, L2, L3)' },
    def: {
      ru: 'Сверхбыстрая память внутри CPU: L1D (32 КБ, ~1 нс) → L2 (1 МБ, ~3 нс) → L3 (64 МБ, ~10 нс) → RAM (~80 нс) → SSD (~100 мкс). Repack (-rtr) оптимизирует раскладку данных под L1D. <span class="analogy">L1D — карман, L2 — рюкзак, L3 — стол, RAM — шкаф, SSD — подвал.</span>',
      en: 'Ultra-fast memory inside CPU: L1D (32 KB, ~1 ns) → L2 (1 MB, ~3 ns) → L3 (64 MB, ~10 ns) → RAM (~80 ns) → SSD (~100 µs). Repack (-rtr) optimizes data layout for L1D. <span class="analogy">L1D = pocket, L2 = backpack, L3 = desk, RAM = shelf, SSD = basement.</span>',
    }},
  { term: { ru: 'Bandwidth (пропускная способность)', en: 'Bandwidth' },
    def: {
      ru: 'Скорость передачи данных: RAM bandwidth (~67 ГБ/с для DDR5) — скорость чтения весов модели. SSD bandwidth (~3 ГБ/с) — скорость подкачки для swap-bound. Генерация токенов (TG) обычно bandwidth-bound (ограничена скоростью чтения из RAM, а не скоростью вычислений).',
      en: 'Data transfer speed: RAM bandwidth (~67 GB/s for DDR5) — speed of reading model weights. SSD bandwidth (~3 GB/s) — paging speed for swap-bound. Token generation (TG) is usually bandwidth-bound (limited by RAM read speed, not compute speed).',
    }},
  { term: { ru: 'AVX-512', en: 'AVX-512' },
    def: {
      ru: 'Набор инструкций CPU для обработки 512 бит данных за такт (16 чисел float32 или 64 числа int8). Zen4 (Ryzen 7000) — первое поколение AMD с полноценным AVX-512. ik_llama.cpp использует AVX-512 для быстрого матричного умножения (IQK ядра).',
      en: 'CPU instruction set processing 512 bits of data per cycle (16 float32 or 64 int8 numbers). Zen4 (Ryzen 7000) is the first AMD generation with full AVX-512 support. ik_llama.cpp uses AVX-512 for fast matrix multiplication (IQK kernels).',
    }},
];

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
    document.getElementById('glossary-title').textContent = L('glossary_title');
    document.getElementById('glossary-filter').placeholder = L('glossary_search');
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
// === INIT ===
// ============================================================
function init() {
  initProfiles();
  const loaded = loadState();
  if (!loaded) {
    applyProfile('ryzen_7950x_96gb');
  }
  setLang(currentLang);
  syncAllToDOM();
  evaluate();
  renderCommand();
  injectHelpButtons();
  // Try connecting to dashboard server
  checkServer();
  // Periodic server check
  setInterval(checkServer, 10000);
}

document.addEventListener('DOMContentLoaded', init);
