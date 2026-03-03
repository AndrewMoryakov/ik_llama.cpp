// ============================================================
// === i18n STRINGS ===
// ============================================================
const LANG = {
  ru: {
    sec_model: 'Модель', sec_perf: 'Производительность', sec_opt: 'Оптимизации',
    sec_server: 'Сервер', sec_adv: 'Дополнительно',
    ws_sections: 'Разделы',
    ws_sections_note: 'Навигация по рабочим экранам',
    ws_nav_overview: 'Обзор',
    ws_nav_launch: 'Запуск',
    ws_nav_runtime: 'Runtime',
    ws_title_overview: 'Обзор',
    ws_title_launch: 'Запуск',
    ws_title_runtime: 'Runtime',
    ws_desc_overview: 'Профиль железа, состояние dashboard-сервера и текущие предупреждения.',
    ws_desc_model: 'Путь к модели, размер, семейство и базовые решения по размещению.',
    ws_desc_perf: 'Потоки, контекст, batching и workload-зависимые настройки производительности.',
    ws_desc_opt: 'Специфичные для ik_llama runtime-флаги, форматы кеша и MoE-контролы.',
    ws_desc_server: 'Сетевые настройки llama-server и параметры параллельной обработки запросов.',
    ws_desc_adv: 'Дополнительные runtime- и memory-параметры, которые обычно не трогают без причины.',
    ws_desc_launch: 'Сгенерированная команда, экспорт/импорт конфига и контроль запуска.',
    ws_desc_runtime: 'Интерактивные терминалы, логи процесса и живая observability для активного запуска.',
    ov_family: 'Семейство',
    ov_memory: 'Память',
    ov_validation: 'Статус',
    ov_runtime: 'Runtime',
    ov_warn_count: 'Активных предупреждений',
    ov_warn_none: 'нет',
    ov_runtime_offline: 'server offline',
    ov_runtime_idle: 'готов к запуску',
    ov_runtime_loading: 'загрузка модели',
    ov_runtime_ready: 'модель работает',
    ov_runtime_stopped: 'процесс остановлен',
    ov_mem_unknown: 'неизвестно',
    ov_mem_inram: 'in-RAM',
    ov_mem_near: 'near-RAM',
    ov_mem_swap: 'swap-bound',
    ov_validation_validated: 'validated baseline',
    ov_validation_partial: 'research / partial',
    ov_validation_unknown: 'unknown family',
    ov_actions_title: 'Следующие шаги',
    ov_actions_note: 'Быстрые переходы по текущему состоянию конфигурации и процесса.',
    ov_action_model_title: 'Проверьте модель',
    ov_action_model_body: 'Уточните путь, размер и family detection. От этого зависит весь остальной профиль.',
    ov_action_perf_title: 'Сведите performance baseline',
    ov_action_perf_body: 'Проверьте workload, потоки, контекст и batching до тонкой оптимизации.',
    ov_action_opt_title: 'Сверьте runtime policy',
    ov_action_opt_body: 'Сравните RTR, KV cache и MoE knobs с текущими validated выводами.',
    ov_action_launch_title: 'Соберите и запустите команду',
    ov_action_launch_body: 'Проверьте сгенерированную команду, затем стартуйте процесс из рабочего launch-pane.',
    ov_action_runtime_title: 'Следите за runtime',
    ov_action_runtime_body: 'После запуска переходите в Runtime: там интерактивные панели, логи и live observability.',
    ov_go_model: 'К модели',
    ov_go_perf: 'К performance',
    ov_go_opt: 'К оптимизациям',
    ov_go_launch: 'К запуску',
    ov_go_runtime: 'К runtime',
    ov_go_model_size: 'К размеру',
    ov_go_rtr: 'К RTR',
    ov_go_threads: 'К потокам',
    ov_profile_title: 'Текущий профиль',
    ov_profile_note: 'Короткая сводка по workload, потокам и runtime policy без перехода по секциям.',
    ov_quick_workload: 'Workload',
    ov_quick_threads: 'Threads',
    ov_quick_rtr: 'RTR',
    ov_quick_kv: 'KV cache',
    ov_quick_fa: 'FlashAttn',
    ov_quick_mmap: 'mmap',
    ov_quick_hot: 'Hot experts',
    ov_quick_auto: 'auto',
    ov_browse_model: 'Выбрать GGUF',
    ov_family_unknown_value: 'Не определено',
    ov_validation_unknown_value: 'Нет validated-профиля',
    ov_family_unknown_note: 'Семейство пока не определено. Выберите GGUF и дайте dashboard прочитать путь и размер модели.',
    ov_validation_unknown_note: 'Для этой модели еще нет подтвержденной линии. Проверьте family detection и сравните базовый runtime-профиль вручную.',
    warn_open: 'Открыть',
    p_model: 'Путь к модели', d_model: 'Путь к GGUF-файлу. Split-модели (00001-of-NNNNN) определяются автоматически',
    p_model_size: 'Размер модели (ГБ)', d_model_size: 'Суммарный размер всех частей. Ключевой параметр: если модель > 90% RAM — она swap-bound, и нужны другие настройки',
    p_model_type: 'Тип модели', d_model_type: 'Dense — все веса активны всегда (Llama, Phi, Gemma). MoE — только часть экспертов активна на токен (MiniMax, DeepSeek, Qwen3-MoE). Определяется автоматически при чтении GGUF',
    p_workload: 'Сценарий нагрузки', d_workload: 'Что для вас важнее: реальный prompt+generation, чистая скорость генерации или обработка промта. Рекомендации отличаются',
    p_ngl: 'GPU слои', d_ngl: 'Количество слоёв, размещаемых на GPU. -1 = авто (все что влезут), 0 = только CPU. Для CPU-only систем ставьте 0',
    p_threads: 'Потоки', d_threads: 'Потоки вычислений при генерации (TG). На dual-CCD (7950X) 16 — хороший baseline для MoE. Для in-RAM моделей имеет смысл отдельно проверить 24/32, а не считать их вредными заранее',
    p_threads_batch: 'Потоки (batch)', d_threads_batch: 'Потоки для обработки промта (PP). -1 = как -t. Отдельное значение полезно если PP и TG по-разному масштабируются',
    p_ctx: 'Размер контекста', d_ctx: 'Контекстное окно (токены). 0 = из метаданных модели. Каждый токен в KV-кеше занимает память — для swap-bound лучше ограничить (напр. 8192)',
    p_batch: 'Batch size', d_batch: 'Логический batch для PP. Больше = быстрее обработка промта, но больше памяти. По умолчанию 2048, минимум 32',
    p_ubatch: 'Micro-batch size', d_ubatch: 'Физический batch — сколько токенов реально обрабатываются за раз. Должен быть <= batch size. По умолчанию 512',
    p_fa: 'Flash Attention', d_fa: 'Оптимизированное ядро внимания. Для текущих Zen4 MoE сценариев особенно важно для mixed path (prompt+generation). Держите ON по умолчанию; выключайте только для явной A/B-проверки или диагностики',
    p_rtr: 'Runtime Repack', d_rtr: 'Три режима: off, on, auto. AUTO — throughput-first старт для Qwen3MoE и gpt-oss на Zen4. Для MiniMax текущая practical картина уже разделяется: TG-only тяготеет к OFF, mixed path стоит сравнивать с AUTO. rtr=on отключает mmap; при auto итог решает runtime policy',
    p_muge: 'Merge Up+Gate Experts', d_muge: 'Слияние ffn_up + ffn_gate экспертов. Влияет только на MoE. Сильного стабильного выигрыша пока не подтверждено; для swap-bound риск деградации высокий, поэтому обычно держите OFF',
    p_ctk: 'Тип KV Cache K', d_ctk: 'Квантизация ключей в KV-кеше. q8_0 — текущий лучший baseline: сильно экономит память и в текущих validated профилях не показал заметимой деградации. Для макс. контекста можно q4_0',
    p_ctv: 'Тип KV Cache V', d_ctv: 'Квантизация значений в KV-кеше. Можно агрессивнее чем K — качество менее чувствительно. q4_0 для максимального контекстного окна',
    p_mla: 'Режим MLA', d_mla: 'Multi-head Latent Attention — режим работы KV-кеша для моделей, поддерживающих MLA (DeepSeek и т.п.). 3 = автовыбор оптимального',
    p_ser: 'Smart Expert Reduction', d_ser: 'Экспериментальная router-side опция: движок может отбросить очень слабых экспертов и не тратить на них память/доступ, сохранив минимум min_experts. Идея особенно интересна для huge swap-bound MoE, но это пока A/B-территория, не baseline.',
    p_hot_budget: 'Hot Expert Budget', d_hot_budget: 'Сколько «горячих» экспертов после prompt пытаться удерживать ближе к памяти. Это влияет не на качество модели, а на то, какие experts runtime старается не отпускать перед decode. Для обычного MiniMax запуска начинайте с 0: большие бюджеты пока не стали новым default.',
    p_hot_budget_mult: 'Hot Expert Budget Mult', d_hot_budget_mult: 'Множитель поверх внутреннего hot-expert baseline runtime. Он не меняет модель и не переучивает router, а только делает hot-набор более или менее агрессивным. Используйте только для controlled MoE locality A/B.',
    p_hot_selection: 'Hot Expert Selection', d_hot_selection: 'Как именно runtime решает, какие эксперты считать hot после prompt. full-prompt = смотреть на весь prompt. tail-window = смотреть только на конец prompt. Это меняет логику выбора experts для раннего decode: последние токены prompt могут лучше предсказывать первые ответы модели.',
    p_hot_tail: 'Tail Window', d_hot_tail: 'Размер хвоста prompt для режима tail-window. Например, 16 означает: выбирать hot experts только по последним 16 токенам prompt, а не по всему prompt. Малое окно = более локальный и агрессивный прогноз; большое = ближе к full-prompt.',
    p_exp_preset: 'Экспериментальный пресет', d_exp_preset: 'Готовые наборы исследовательских ручек. Используйте их как старт для A/B, а не как validated default.',
    p_exp_link: 'Связывать пресет с проверенными настройками', d_exp_link: 'Если ON, выбор экспериментального пресета может также перестроить проверенные параметры, когда без этого bundle теряет смысл. Если OFF, меняются только экспериментальные ручки.',
    p_prompt_packed: 'Prompt Packed QKV', d_prompt_packed: 'Экспериментальный prompt-only режим: вместо обычных раздельных Q/K/V runtime пробует более локальный layout для prompt-фазы. Это может ускорять обработку prompt, но не обязано ускорять всю сессию и иногда стоит дополнительной RAM/времени загрузки.',
    p_prompt_packed_preset: 'Preset Prompt Packed', d_prompt_packed_preset: 'Готовый способ сказать runtime, какие слои пробовать упаковывать. Это не «лучший режим вообще», а быстрый старт для A/B: у Qwen чаще смысл имеет front-half, у gpt-oss — back-half.',
    p_prompt_packed_range: 'Диапазон Prompt Packed', d_prompt_packed_range: 'Ручной override для продвинутого A/B. Вы явно задаёте, на каких слоях включать Prompt Packed. Если не уверены, зачем вам свой диапазон, используйте preset.',
    opt_tab_validated: 'Проверено',
    opt_tab_experimental: 'Эксперименты',
    opt_exp_title: 'Экспериментальные параметры',
    opt_exp_intro: 'Эти ручки не входят в validated baseline. Они нужны для целевых A/B-проверок и runtime-исследований, а не как рекомендации по умолчанию.',
    opt_exp_meta_note: 'У каждого experimental-параметра теперь есть три метки: где он подходит по механике, где текущий runtime реально его поддерживает и где уже есть подтвержденный benchmark-сигнал.',
    opt_exp_learn_title: 'Что они меняют в исполнении',
    opt_exp_learn_body: 'Эти параметры не меняют веса модели. Они меняют runtime-поведение: какие эксперты считаются горячими, насколько prompt используется как прогноз для раннего decode, и можно ли отбрасывать очень слабых экспертов. Меняйте по одному параметру за раз и сравнивайте с validated baseline.',
    exp_preset_none: 'Ручной режим: dashboard ничего сам не подбирает, вы вручную управляете исследовательскими ручками.',
    exp_preset_minimax: 'MiniMax mixed locality: включает tail-window selection для hot experts. При связке с проверенными настройками удерживает mixed-friendly baseline вокруг Flash Attention + RTR auto + muge OFF.',
    exp_preset_qwen: 'Qwen prompt-packed: включает Prompt Packed QKV с профилем front-half. Это исследование prompt-path locality, а не validated рекомендация.',
    exp_preset_gptoss: 'gpt-oss prompt-packed: включает Prompt Packed QKV с профилем back-half. Это исследование prompt-path locality, а не validated рекомендация.',
    exp_preset_merge_qkv: 'Attention merge-qkv: включает Merge QKV как мягкий attention-side эксперимент. При связке дополнительно фиксирует Flash Attention и Graph Reuse.',
    p_live_obs: 'Live Observability', d_live_obs: 'Dashboard-only traces для интерактивной визуализации фаз inference и активности экспертов. Полезно для обучения и диагностики; для максимально чистых бенчей можно выключить.',
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
    p_mmap: 'Memory-mapped I/O (mmap)', d_mmap: 'Загрузка модели через отображение файла в память. OS подгружает страницы по необходимости. rtr=on принудительно выключает mmap; при rtr=auto итоговое решение может изменить runtime policy',
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
    chat_title: 'Чат', chat_empty: 'Запустите модель, чтобы начать общение',
    cli_welcome: 'Запустите модель для начала сессии',
    cli_terminal_label: 'llama-cli \u2014 логи (сессия в терминале)',
    console_label: 'Консоль \u2014 логи',
    cli_ext_session: 'Интерактивная сессия открыта в отдельном терминале. Здесь отображаются логи загрузки.',
    cli_ext_ready: 'Модель загружена. Введите сообщение в окне терминала.',
    cli_ext_input: 'Используйте внешний терминал для ввода',
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
    w_rtr_swap: 'Принудительный rtr=on на swap-bound модели рискован: растёт working set, отключается mmap и можно получить сильную просадку, особенно на mixed path.',
    w_rtr_swap_fix: 'Для swap-bound не форсируйте ON. Для Qwen3MoE/gpt-oss начните с AUTO. Для MiniMax: TG-only начните с OFF, а mixed path обязательно сравните с AUTO.',
    w_muge_swap: 'Merge Up+Gate на swap-bound MoE обычно вреден: растёт размер непрерывных выделений и усиливаются page faults.',
    w_muge_swap_fix: 'Отключите -muge для swap-bound моделей.',
    w_rtr_muge: 'rtr и muge включены одновременно. Это уже не аварийная комбинация, но для swap-bound MoE её лучше избегать.',
    w_rtr_auto_moe: 'rtr=auto на MoE — текущий throughput-first старт для Zen4-профиля на Qwen3MoE и gpt-oss. Mixed path нельзя оценивать только по TG.',
    w_rtr_auto_fix: 'Если модель MiniMax или другой тяжёлый swap-bound кейс — проверьте также rtr=off отдельно.',
    w_rtr_off_validated_moe: 'Для текущих Qwen3MoE/gpt-oss на Zen4 rtr=off консервативен, но часто оставляет производительность на столе по сравнению с auto.',
    w_threads_moe: 'MoE модель с >16 потоками: на этом Zen4-хосте это часто хуже для throughput, но не является универсальным правилом. Для in-RAM моделей делайте A/B с 24/32.',
    w_threads_moe_fix: 'Используйте -t 16 как baseline для MoE на Zen4 и отдельно проверяйте 24/32 только на реальных бенчах.',
    w_ctk_good: 'q8_0 KV cache остаётся лучшим текущим baseline: он сильно экономит память и на текущих validated профилях не показал заметного ухудшения.',
    w_ser_info: 'SER — экспериментальная router-side опция. Она может уменьшить swap I/O, но пока не должна подаваться как validated default.',
    w_gptoss_huge_auto: 'Для huge gpt-oss throughput-first старт сейчас обычно rtr=auto, но помните о высокой цене по startup/load time.',
    w_gptoss_huge_auto_fix: 'Если важнее запуск и cold-start, сравните с rtr=off.',
    w_swap_bound: 'Модель swap-bound (превышает 90% RAM). Для таких кейсов важны mmap, размер KV cache и режим rtr. Не переносите выводы с in-RAM моделей напрямую.',
    w_fa_off: 'Flash Attention выключен. Это особенно бьёт по mixed path (prompt+generation). На текущем Zen4 MoE профиле держите ON.',
    w_threads_ccd: 'Используется потоков меньше одного CCD на dual-CCD процессоре. L3 кеш урезан с 64 МБ до 32 МБ.',
    w_threads_ccd_fix: 'Используйте -t 16 для задействования обоих CCD.',
    w_rtr_nommap: 'rtr=on принудительно отключает mmap. В режиме auto mmap может остаться включённым до решения runtime policy.',
    w_muge_dense: '-muge влияет только на MoE модели (ffn_up_exps + ffn_gate_exps). На dense модели эффекта нет.',
    w_khad_f16: 'K-Cache Hadamard полезен только с квантизированным KV cache (не f16/f32).',
    w_minimax_rtr_on: 'MiniMax M2.5 имеет свою attention/runtime специфику. Принудительный rtr=on для swap-bound MiniMax остаётся рискованным режимом.',
    w_minimax_rtr_auto: 'Для MiniMax старый плохой auto-результат был policy bug. На fixed tree TG-only всё ещё тяготеет к OFF, но mixed path уже дал небольшой выигрыш у AUTO.',
    w_minimax_hot_budget_hint: 'Для MiniMax короткий quick check когда-то подсветил 24/32, но первый более длинный controlled rtr=off run не подтвердил новый default выше legacy 16.',
    w_minimax_hot_budget_fix: 'Практический user-facing baseline сейчас простой: оставьте Hot Expert Budget = 0. Более крупные бюджеты пока research-only.',
    w_workload_mixed: 'Выбран mixed (PG) режим. Для текущего форка это основной пользовательский сценарий, и его нельзя оценивать только по TG.',
    w_workload_tg: 'Выбран TG-only режим. Хорош для decode throughput, но не переносите выводы напрямую на prompt+generation.',
    w_workload_pp: 'Выбран PP режим. Это полезно для длинных промтов, но не отражает общую скорость диалога.',
    w_mqkv_experimental: 'Merge QKV — экспериментальная опция. Она model-sensitive и не является validated default для текущего релизного слоя.',
    w_hot_budget_experimental: 'Hot Expert Budget — экспериментальный env-knob. Для обычного MiniMax запуска оставляйте 0; более крупные бюджеты пока не стали validated default.',
    w_hot_budget_family: 'Hot Expert Budget относится к huge-MoE locality. По механике он шире, чем одна family, но текущий runtime fully wired сегодня прежде всего на MiniMax-path. На других MoE это пока research A/B, а не готовое правило.',
    w_hot_budget_mult_experimental: 'Hot Expert Budget Mult — экспериментальный MoE locality knob. Он не меняет фиксированный budget, а масштабирует внутренний hot-expert baseline runtime.',
    w_hot_budget_mult_family: 'Hot Expert Budget Mult относится к huge-MoE locality. По механике он шире одной family, но benchmark-backed guidance пока еще research-only.',
    w_hot_selection_experimental: 'Hot Expert Selection / Tail Window — экспериментальная MoE-locality ветка. Она не меняет веса модели, а только меняет то, по какой части prompt runtime выбирает hot experts.',
    w_hot_selection_family: 'Hot Expert Selection / Tail Window относятся к MoE locality, а не к одной модели. Runtime-path уже widened на compatible MoE. По текущим бенчмаркам MiniMax остается основным huge-MoE кейсом, а на gpt-oss-20b есть слабый, но положительный signal. Для остальных MoE это пока research-only.',
    w_prompt_packed_experimental: 'Prompt Packed QKV — исследовательский prompt-path режим. Он не является validated default и может стоить дополнительной RAM и времени загрузки.',
    w_prompt_packed_family: 'Prompt Packed QKV относится к split-QKV attention-семействам. Ручной runtime-path widened beyond one family, но practical value сейчас разная: strongest signal уже есть на gpt-oss-120b, на Qwen3MoE и gpt-oss-20b это в основном prompt-side gain при слабом mixed-path эффекте. Для остальных split-QKV семей это пока research-only.',
    w_prompt_packed_range: 'Задан явный Prompt Packed range. Это advanced override поверх preset и его стоит включать только для осознанного A/B.',
    w_exp_preset_link: 'Связка экспериментального пресета с проверенными настройками включена. При выборе preset dashboard может менять Flash Attention, RTR, Graph Reuse и другие validated knobs.',
    badge_family: 'Семейство',
    badge_path: 'Путь',
    badge_status: 'Статус',
    badge_family_qwen: 'Qwen3MoE',
    badge_family_gptoss: 'gpt-oss',
    badge_family_minimax: 'MiniMax M2.5',
    badge_family_other: 'Generic / unknown',
    badge_path_inram: 'in-RAM профиль',
    badge_path_swap: 'swap-bound профиль',
    badge_path_mixed: 'mixed-path важен',
    badge_path_tg: 'TG-only фокус',
    badge_path_pp: 'PP фокус',
    badge_status_validated: 'validated baseline',
    badge_status_partial: 'research / partial',
    badge_status_unknown: 'unknown family',
    badge_status_exp_knobs: 'experimental knobs active',
    note_minimax_hot_budget: 'MiniMax advanced note: короткий quick check когда-то подсветил большие бюджеты, но первый более длинный controlled rtr=off run вернул нас к legacy default 16. Для обычного запуска оставляйте Hot Expert Budget = 0; большие бюджеты пока research-only.',
    live_title: 'Живая схема inference',
    live_subtitle: 'Поток по фазам и активность MoE-экспертов для текущего запуска',
    live_waiting: 'Ожидание запуска модели',
    live_disabled: 'Live Observability выключен. Включите его в Advanced, чтобы dashboard добавил trace-env переменные для фаз и экспертов.',
    live_running: 'live',
    live_idle: 'idle',
    live_arch: 'Архитектура',
    live_trace: 'Trace',
    live_timeline: 'Фазы',
    live_flow_title: 'Схема выполнения',
    live_flow_note: 'Это упрощенная визуальная модель реального inference: активные блоки и стрелки подсвечиваются по live/replay trace-данным.',
    live_flow_node_hint: 'Блок верхнеуровневой схемы inference',
    live_flow_arrow_hint: 'Переход данных между крупными этапами inference',
    live_flow_path: 'Текущий путь',
    live_flow_node_input: 'Input / Prompt',
    live_flow_node_shared: 'Shared path',
    live_flow_node_router: 'Router',
    live_flow_node_experts: 'Experts',
    live_flow_node_decode: 'Decode',
    live_flow_path_idle: 'ожидание',
    live_flow_path_prompt: 'prompt path',
    live_flow_path_first_decode: 'prompt → first decode',
    live_flow_path_decode: 'decode tail',
    live_flow_note_idle: 'Трасса еще не началась. После запуска модели блоки начнут подсвечиваться по реальному ходу inference.',
    live_flow_note_prompt: 'Сейчас идет обработка prompt: данные проходят shared path, затем router выбирает экспертов для prompt batch.',
    live_flow_note_first_decode: 'Сейчас виден переход от prompt к первому decode токену. Это важная граница, где часто проявляется разница между mixed и TG-only path.',
    live_flow_note_decode: 'Сейчас идет обычный decode tail: router продолжает выбирать экспертов динамически, а prompt уже не определяет путь полностью.',
    live_mem_title: 'Режим памяти',
    live_mem_regime: 'Профиль памяти',
    live_mem_regime_inram: 'in-RAM',
    live_mem_regime_near: 'near-RAM',
    live_mem_regime_swap: 'swap-bound',
    live_mem_regime_unknown: 'unknown',
    live_mem_model: 'Размер модели',
    live_mem_ram: 'RAM профиля',
    live_mem_available: 'Свободно сейчас',
    live_mem_ratio: 'Модель / RAM',
    live_mem_note_unknown: 'Недостаточно данных, чтобы точно оценить memory regime. Обычно это значит, что размер модели или RAM профиля еще не определены.',
    live_mem_note_inram: 'Модель уверенно помещается в RAM. Здесь bottleneck чаще ближе к compute и layout, а не к подкачке.',
    live_mem_note_near: 'Модель близка к пределу RAM. Даже небольшие изменения KV cache, RTR или hot experts уже могут менять поведение заметно.',
    live_mem_note_swap: 'Модель swap-bound: память и подкачка становятся частью critical path. Здесь важно не только сколько считаем, но и какие эксперты удается держать горячими.',
    live_mem_note_hot_budget: 'Текущий hot-expert budget',
    live_mem_note_stage: 'Последний stage',
    live_mem_note_locked_share: 'Последний locked share',
    live_phase_prompt: 'Prompt',
    live_phase_first_decode: 'First decode',
    live_phase_decode_tail: 'Decode tail',
    live_phase_current: 'Текущая фаза',
    live_prompt_tokens: 'Prompt токены',
    live_prompt_ms: 'Prompt ms',
    live_ttft_ms: 'TTFT ms',
    live_decode_tps: 'Decode tok/s',
    live_last_token_ms: 'Последний токен ms',
    live_decode_steps: 'Decode steps',
    live_moe_title: 'MoE activity',
    live_moe_stage: 'Этап',
    live_moe_layer: 'Слой',
    live_moe_budget: 'Budget',
    live_moe_locked_share: 'Locked share',
    live_moe_dispatches: 'Dispatches',
    live_moe_top_experts: 'Top experts',
    live_moe_selection: 'Hot selection',
    live_moe_locked_total: 'Locked/total',
    live_moe_fails: 'Fails',
    live_moe_stage_compare: 'Сравнение стадий',
    live_moe_heatmap: 'Heatmap экспертов',
    live_moe_heatmap_note: 'Если доступны layer traces, строки — слои модели. Иначе используется fallback по стадиям hot-expert workflow.',
    live_moe_heatmap_empty_note: 'У этого run нет достаточно глубоких expert traces для heatmap. Для полного layer x expert вида выберите curated demo с layer trace.',
    live_moe_heatmap_open_demo: 'Открыть layer-trace demo',
    live_moe_heatmap_rows: 'Строк',
    live_moe_heatmap_cols: 'Экспертов',
    live_moe_heatmap_peak: 'Пик',
    live_moe_heatmap_axis: 'Ось строк',
    live_moe_heatmap_legend: 'Интенсивность цвета показывает, насколько часто эксперт встречался в текущем trace-окне.',
    live_moe_heatmap_low: 'мало',
    live_moe_heatmap_high: 'много',
    live_moe_prompt_decode_compare: 'Prompt vs decode по экспертам',
    live_moe_overlap_count: 'Общих экспертов',
    live_moe_overlap_hint: 'Характер',
    live_moe_stability: 'Стабильность набора экспертов',
    live_moe_stability_label: 'Оценка',
    live_moe_stability_score: 'Overlap',
    live_moe_stability_note: 'Overlap показывает, насколько prompt и decode используют похожий top-expert набор. Низкий overlap = prompt плохо предсказывает будущий decode path.',
    live_moe_stability_stable: 'stable',
    live_moe_stability_mixed: 'mixed',
    live_moe_stability_volatile: 'volatile',
    live_recent_phases: 'Последние фазовые события',
    live_recent_stage_history: 'История стадий hot experts',
    live_phase_compare: 'Prompt vs decode',
    live_phase_compare_note: 'Prompt и decode — разные режимы выполнения; не переносите выводы с одного на другой автоматически.',
    live_recent_idx: 'Шаг',
    live_recent_total_ms: 'Итого ms',
    live_recent_locked_share: 'Locked %',
    live_no_phase_data: 'Пока нет trace-данных по фазам.',
    live_no_moe_data: 'Пока нет trace-данных по экспертам.',
    live_mode: 'Режим',
    live_mode_live: 'Live',
    live_mode_replay: 'Replay',
    live_replay_run: 'Replay run',
    live_replay_filter: 'Фильтр',
    live_replay_filter_curated: 'curated',
    live_replay_filter_all: 'all',
    live_replay_filter_trace: 'trace only',
    live_replay_reload: 'Обновить список',
    live_replay_play: 'Play',
    live_replay_pause: 'Pause',
    live_replay_step: 'Шаг',
    live_replay_speed: 'Скорость',
    live_replay_latest: 'последний',
    live_replay_no_runs: 'Нет replay-ранов с логами.',
    live_replay_no_trace: 'В выбранном run нет trace-событий для replay.',
    live_replay_source: 'Источник',
    live_replay_event: 'Событие',
    live_replay_frames: 'Кадры',
    live_replay_demo: 'Demo',
    live_replay_generic: 'generic run',
    live_replay_type: 'Тип',
    live_replay_telemetry: 'Телеметрия',
    live_replay_telemetry_layer_expert: 'layer + expert',
    live_replay_telemetry_phase_trace: 'phase trace',
    live_replay_telemetry_no_trace: 'без trace',
    live_replay_quick_picks: 'Быстрый выбор demo',
    live_family_label: 'Семейство',
    live_replay_finished: 'Replay завершен',
    live_family_generic: 'Generic',
    live_family_minimax: 'MiniMax',
    live_family_gptoss: 'gpt-oss',
    live_family_qwen: 'Qwen',
    live_view: 'Представление',
    live_view_learn: 'Learn',
    live_view_inspect: 'Inspect',
    live_learn_phase_title: 'Что сейчас происходит',
    live_learn_phase_text_idle: 'Запуск еще не дал trace-событий. Когда появятся prompt и decode, панель начнет показывать живой сценарий работы модели.',
    live_learn_phase_text_prompt: 'Сейчас модель обрабатывает prompt. Это не то же самое, что дальнейшая генерация: prompt и decode могут вести себя по-разному.',
    live_learn_phase_text_first_decode: 'Сейчас выполняется первый токен после prompt. Это важная граница: именно здесь часто видна разница между prompt-путем и обычным decode.',
    live_learn_phase_text_decode: 'Сейчас идет обычная генерация токенов. Этот режим нельзя механически переносить на prompt или mixed path целиком.',
    live_learn_moe_title: 'Что видно по MoE',
    live_learn_moe_none: 'Пока нет trace-событий по экспертам. Это нормально, если trace не включен или run не содержит MoE activity lines.',
    live_learn_moe_text: 'Эксперты активируются динамически. Это помогает понять, почему active params не означают один фиксированный кусок модели в RAM.',
    live_learn_prompt_decode: 'Prompt и decode — разные режимы. Если они показывают разную картину, это не аномалия, а нормальное свойство huge MoE.',
    live_learn_stage_prefix: 'Текущий stage:',
    live_learn_top_prefix: 'Top experts:',
    live_learn_overlap_prefix: 'Пересечение prompt/decode сейчас видно по экспертам:',
    live_learn_overlap_none: 'Заметного пересечения top-экспертов между prompt и decode сейчас не видно.',
    live_learn_stability_prefix: 'Стабильность набора экспертов:',
    live_learn_stability_none: 'Стабильность набора экспертов пока не рассчитана.',
    live_token_title: 'Путь токена',
    live_token_kind: 'Токен',
    live_token_chip: 'token',
    live_token_prompt_batch: 'prompt batch',
    live_token_first: 'first decode token',
    live_token_decode: 'decode token',
    live_token_idle: 'ожидание',
    live_token_note_idle: 'Когда появятся phase trace-события, здесь начнет двигаться условный токен по схеме inference.',
    live_token_note_prompt: 'Во время prompt двигается не один токен, а batch. Эта схема показывает упрощенный путь данных через router и experts.',
    live_token_note_first: 'Первый decode token — это граница между prompt и steady-state generation. Именно здесь mixed path часто отличается от TG-only.',
    live_token_note_decode: 'Во время decode токены идут по одному. Router продолжает выбирать экспертов динамически, поэтому путь не фиксируется после prompt.',
    live_token_line_hint: 'Упрощенный путь данных для текущей фазы inference',
    live_token_stop_input_hint: 'Сюда попадает prompt batch или следующий decode token',
    live_token_stop_router_hint: 'Router выбирает, какие эксперты активировать в MoE-слоях',
    live_token_stop_experts_hint: 'Выбранные эксперты обрабатывают токен или batch',
    live_token_stop_decode_hint: 'После shared path и experts модель формирует следующий decode шаг',
    live_minimax_story_title: 'MiniMax memory story',
    live_minimax_story_note: 'Это упрощенная memory-модель huge MoE: shared tensors стараются держаться горячими, часть экспертов попадает в hot set, а холодные эксперты остаются pageable.',
    live_minimax_story_shared: 'Shared tensors',
    live_minimax_story_shared_note: 'Attention, router и другие общие части модели выгодно держать горячими, потому что они нужны почти всегда.',
    live_minimax_story_hot: 'Hot experts',
    live_minimax_story_hot_note: 'Prompt может подсказать вероятно полезный subset экспертов, но не фиксирует будущий decode path целиком.',
    live_minimax_story_cold: 'Cold experts',
    live_minimax_story_cold_note: 'Остальные эксперты могут оставаться холодными и подкачиваться по мере необходимости. Именно здесь huge MoE часто упирается в locality и paging.',
    live_replay_desc_none_title: 'Replay demo',
    live_replay_desc_none_body: 'Выберите replay run, чтобы увидеть его live-подобную визуализацию и короткое объяснение, чему этот запуск учит.',
    live_replay_overview_title: 'Curated replay demos',
    live_replay_overview_note: 'Начните с одного из curated demo-run. Это самый быстрый способ понять live/replay слой без ручного просмотра всех артефактов.',
    live_replay_scenarios: 'Сценарии просмотра',
    live_scenario_minimax_title: 'Learn MiniMax',
    live_scenario_minimax_body: 'Показывает huge MoE под memory pressure: layer x expert heatmap, hot experts и memory-aware поведение.',
    live_scenario_qwen_title: 'Learn Qwen',
    live_scenario_qwen_body: 'Показывает более легкий in-RAM / near-RAM MoE сценарий, где проще увидеть prompt vs decode без сильной подкачки.',
    live_scenario_gptoss_title: 'Inspect gpt-oss',
    live_scenario_gptoss_body: 'Подходит для более чистого replay UX и инженерного разбора decode/mixed path без huge-model шума.',
    live_replay_desc_generic_title: 'Replay run',
    live_replay_desc_generic_body: 'Это сохраненный trace-run. Используйте его, чтобы посмотреть поток inference, активность экспертов и различия между prompt и decode без повторного запуска модели.',
    live_replay_desc_minimax_layer_title: 'MiniMax: layer-by-layer expert activity',
    live_replay_desc_minimax_layer_body: 'Этот demo-run полезен для huge MoE: он показывает реальный layer x expert heatmap, поток prompt → decode и memory-aware поведение MiniMax под CPU inference.',
    live_replay_desc_minimax_quick_title: 'MiniMax: quick expert check',
    live_replay_desc_minimax_quick_body: 'Этот run полезен как компактный пример hot-expert telemetry: на нем проще увидеть стадии hot expert workflow, не дожидаясь тяжелого long-run.',
    live_replay_desc_gptoss_title: 'gpt-oss: MoE replay',
    live_replay_desc_gptoss_body: 'Этот run стоит смотреть для более легкого и менее noisy MoE сценария. Он хорош для отладки replay UX и сравнения prompt/decode без huge-model давления памяти.',
    live_replay_desc_qwen_title: 'Qwen: MoE replay',
    live_replay_desc_qwen_body: 'Этот run полезен для изучения in-RAM или near-in-RAM MoE поведения, где bottleneck ближе к compute path, а не к сильной подкачке.',
    live_replay_desc_qwen_window_title: 'Qwen: decode window trace',
    live_replay_desc_qwen_window_body: 'Этот run помогает посмотреть первые decode-токены после prompt и увидеть, как mixed path отличается от TG-only даже без huge-model memory pressure.',
    live_onboard_title: 'Что делать дальше',
    live_onboard_title_replay: 'Как читать этот replay',
    live_onboard_body_live: 'Эта полоса помогает не потеряться в live-режиме: сначала поймите фазу inference, потом посмотрите prompt vs decode и только после этого переходите к деталям MoE.',
    live_onboard_body_replay: 'В replay лучше идти от общего к частному: сначала поток выполнения, затем prompt/decode, затем эксперты и memory story.',
    live_onboard_chip_mode: 'Mode',
    live_onboard_chip_view: 'View',
    live_onboard_chip_telemetry: 'Telemetry',
    live_onboard_chip_trace: 'Trace',
    live_onboard_step_watch_flow: 'Сначала посмотрите, какая фаза сейчас активна и как подсвечивается execution flow.',
    live_onboard_step_compare_prompt_decode: 'Затем сравните prompt и decode: это два разных режима, и выводы нельзя переносить автоматически.',
    live_onboard_step_switch_replay: 'Если live run слишком шумный, переключитесь в Replay и откройте curated demo.',
    live_onboard_step_inspect_heatmap: 'В Inspect сначала проверьте, есть ли layer x expert heatmap или только phase trace fallback.',
    live_onboard_step_inspect_stage: 'Если это MiniMax, посмотрите stage history и locked share — это лучше показывает memory behavior.',
    live_onboard_step_use_curated_replay: 'Для обучения проще начинать не с текущего запуска, а с curated replay сценариев.',
    live_onboard_step_layer_heatmap: 'Начните с heatmap: он показывает, как эксперты распределяются по слоям или стадиям.',
    live_onboard_step_prompt_decode: 'Потом сравните prompt и decode, чтобы увидеть, насколько prompt реально предсказывает дальнейший путь.',
    live_onboard_step_minimax_memory: 'Для MiniMax завершите просмотр memory story: она объясняет shared tensors, hot experts и cold experts.',
    live_onboard_step_replay_flow: 'Сначала просмотрите execution flow и token journey, чтобы понять общую логику запуска.',
    live_onboard_step_try_layer_demo: 'Если здесь только phase trace, откройте curated MiniMax layer-trace demo для глубокого expert view.',
    live_onboard_step_switch_inspect: 'Если сейчас Learn, переключитесь в Inspect после первого прохода — там больше полезных деталей.',
    live_workspace_main: 'Главная сцена',
    live_workspace_side: 'Инспектор',
    live_workspace_stage_flow: 'Flow',
    live_workspace_stage_heatmap: 'Heatmap',
    live_workspace_stage_compare: 'Compare',
    live_workspace_inspector_guide: 'Guide',
    live_workspace_inspector_phase: 'Phase',
    live_workspace_inspector_moe: 'MoE',
    live_workspace_inspector_memory: 'Memory',
    live_workspace_hide_inspector: 'Скрыть инспектор',
    live_workspace_show_inspector: 'Показать инспектор',
    runtime_dock_title: 'Runtime panels',
    runtime_dock_note: 'Сворачивайте правую колонку, чтобы освободить место для live-сцены.',
    runtime_dock_hide_side: 'Свернуть правую колонку',
    runtime_dock_show_side: 'Развернуть правую колонку',
    runtime_main_bar_title: 'Правая колонка скрыта',
    runtime_main_bar_note: 'Разверните терминал, чат и логи, когда они снова понадобятся.',
  },
  en: {
    sec_model: 'Model', sec_perf: 'Performance', sec_opt: 'Optimization',
    sec_server: 'Server', sec_adv: 'Advanced',
    ws_sections: 'Sections',
    ws_sections_note: 'Workspace navigation',
    ws_nav_overview: 'Overview',
    ws_nav_launch: 'Launch',
    ws_nav_runtime: 'Runtime',
    ws_title_overview: 'Overview',
    ws_title_launch: 'Launch',
    ws_title_runtime: 'Runtime',
    ws_desc_overview: 'Hardware profile, dashboard server state, and current warnings.',
    ws_desc_model: 'Model path, size, family, and basic placement decisions.',
    ws_desc_perf: 'Threads, context, batching, and workload-specific performance controls.',
    ws_desc_opt: 'ik_llama-specific runtime switches, cache formats, and MoE controls.',
    ws_desc_server: 'llama-server network settings and request concurrency controls.',
    ws_desc_adv: 'Advanced runtime and memory controls that usually stay untouched without a reason.',
    ws_desc_launch: 'Generated command, config export/import, and launch controls.',
    ws_desc_runtime: 'Interactive terminals, process logs, and live observability for the active run.',
    ov_family: 'Family',
    ov_memory: 'Memory',
    ov_validation: 'Status',
    ov_runtime: 'Runtime',
    ov_warn_count: 'Active warnings',
    ov_warn_none: 'none',
    ov_runtime_offline: 'server offline',
    ov_runtime_idle: 'ready to launch',
    ov_runtime_loading: 'loading model',
    ov_runtime_ready: 'model running',
    ov_runtime_stopped: 'process stopped',
    ov_mem_unknown: 'unknown',
    ov_mem_inram: 'in-RAM',
    ov_mem_near: 'near-RAM',
    ov_mem_swap: 'swap-bound',
    ov_validation_validated: 'validated baseline',
    ov_validation_partial: 'research / partial',
    ov_validation_unknown: 'unknown family',
    ov_actions_title: 'Next actions',
    ov_actions_note: 'Fast jumps based on the current configuration and process state.',
    ov_action_model_title: 'Check the model',
    ov_action_model_body: 'Confirm path, size, and family detection. Everything else depends on that.',
    ov_action_perf_title: 'Lock the performance baseline',
    ov_action_perf_body: 'Check workload, threads, context, and batching before fine-grained optimization.',
    ov_action_opt_title: 'Review runtime policy',
    ov_action_opt_body: 'Compare RTR, KV cache, and MoE knobs against the current validated conclusions.',
    ov_action_launch_title: 'Build and launch',
    ov_action_launch_body: 'Review the generated command, then start the process from the launch pane.',
    ov_action_runtime_title: 'Watch runtime',
    ov_action_runtime_body: 'After launch, move to Runtime for interactive panels, logs, and live observability.',
    ov_go_model: 'Open model',
    ov_go_perf: 'Open performance',
    ov_go_opt: 'Open optimization',
    ov_go_launch: 'Open launch',
    ov_go_runtime: 'Open runtime',
    ov_go_model_size: 'Open size',
    ov_go_rtr: 'Open RTR',
    ov_go_threads: 'Open threads',
    ov_profile_title: 'Current profile',
    ov_profile_note: 'Compact summary of workload, threads, and runtime policy without leaving Overview.',
    ov_quick_workload: 'Workload',
    ov_quick_threads: 'Threads',
    ov_quick_rtr: 'RTR',
    ov_quick_kv: 'KV cache',
    ov_quick_fa: 'FlashAttn',
    ov_quick_mmap: 'mmap',
    ov_quick_hot: 'Hot experts',
    ov_quick_auto: 'auto',
    ov_browse_model: 'Choose GGUF',
    ov_family_unknown_value: 'Not detected',
    ov_validation_unknown_value: 'No validated profile',
    ov_family_unknown_note: 'The family is not detected yet. Pick a GGUF and let the dashboard read model path and size first.',
    ov_validation_unknown_note: 'This model has no validated line yet. Confirm family detection and compare the baseline runtime profile manually.',
    warn_open: 'Open',
    p_model: 'Model path', d_model: 'Path to GGUF file. Split models (00001-of-NNNNN) are detected automatically',
    p_model_size: 'Model size (GB)', d_model_size: 'Total size of all parts. Key parameter: if model > 90% RAM it is swap-bound and needs different settings',
    p_model_type: 'Model type', d_model_type: 'Dense — all weights active always (Llama, Phi, Gemma). MoE — only a subset of experts active per token (MiniMax, DeepSeek, Qwen3-MoE). Auto-detected from GGUF metadata',
    p_workload: 'Workload', d_workload: 'What matters most to you: real prompt+generation flow, decode-only throughput, or prompt processing. Recommendations differ',
    p_ngl: 'GPU layers', d_ngl: 'Layers placed on GPU. -1 = auto (as many as fit), 0 = CPU only. Set 0 for CPU-only systems',
    p_threads: 'Threads', d_threads: 'Compute threads for generation (TG). On dual-CCD (7950X), 16 is a good MoE baseline. For in-RAM models it is still worth A/B testing 24/32 instead of assuming they are always worse',
    p_threads_batch: 'Threads (batch)', d_threads_batch: 'Threads for prompt processing (PP). -1 = same as -t. Separate value useful if PP and TG scale differently',
    p_ctx: 'Context size', d_ctx: 'Context window (tokens). 0 = from model metadata. Each token in KV cache uses memory — for swap-bound better to limit (e.g. 8192)',
    p_batch: 'Batch size', d_batch: 'Logical batch for PP. Larger = faster prompt processing but more memory. Default 2048, minimum 32',
    p_ubatch: 'Micro-batch size', d_ubatch: 'Physical batch — tokens actually processed at once. Must be <= batch size. Default 512',
    p_fa: 'Flash Attention', d_fa: 'Optimized attention kernel. For current Zen4 MoE work it matters especially for mixed path (prompt+generation). Keep it ON by default; only disable for explicit A/B checks or debugging',
    p_rtr: 'Runtime Repack', d_rtr: 'Three modes: off, on, auto. AUTO is the current throughput-first starting point for Qwen3MoE and gpt-oss on Zen4. For MiniMax, the practical picture now splits: TG-only still leans to OFF, while mixed path is worth comparing against AUTO. rtr=on disables mmap; with auto the runtime policy decides the effective outcome',
    p_muge: 'Merge Up+Gate Experts', d_muge: 'Merge ffn_up + ffn_gate expert tensors. Only affects MoE. No strong stable win is confirmed yet; for swap-bound cases regression risk is high, so keep it OFF by default',
    p_ctk: 'KV Cache K Type', d_ctk: 'Key quantization in KV cache. q8_0 is the current best baseline: it saves a lot of memory and showed no meaningful regression in the current validated profiles. For max context try q4_0',
    p_ctv: 'KV Cache V Type', d_ctv: 'Value quantization in KV cache. Can be more aggressive than K — quality is less sensitive. q4_0 for maximum context window',
    p_mla: 'MLA Mode', d_mla: 'Multi-head Latent Attention — KV cache mode for models supporting MLA (DeepSeek etc.). 3 = auto-select optimal',
    p_ser: 'Smart Expert Reduction', d_ser: 'Experimental router-side option: the engine may drop very weak experts and avoid spending memory/access on them while still keeping at least min_experts. This is most interesting for huge swap-bound MoE, but it is still A/B territory, not a baseline.',
    p_hot_budget: 'Hot Expert Budget', d_hot_budget: 'How many “hot” experts the runtime should try to keep closer to memory after the prompt. This does not change model quality directly; it changes which experts the engine tries to retain before decode. For normal MiniMax use, start with 0: larger budgets have not become a new default.',
    p_hot_budget_mult: 'Hot Expert Budget Mult', d_hot_budget_mult: 'A multiplier over the runtime hot-expert baseline. It does not change the model itself; it scales how aggressively runtime grows the hot set. Use it only for controlled MoE locality A/B.',
    p_hot_selection: 'Hot Expert Selection', d_hot_selection: 'How the runtime decides which experts become hot after the prompt. full-prompt = look at the whole prompt. tail-window = look only at the end of the prompt. This changes the expert-selection logic for early decode: the last prompt tokens may predict the first answer tokens better than the full prompt.',
    p_hot_tail: 'Tail Window', d_hot_tail: 'How large the prompt tail is when tail-window mode is used. For example, 16 means: choose hot experts only from the last 16 prompt tokens, not from the whole prompt. Smaller windows are more local and aggressive; larger ones behave more like full-prompt.',
    opt_tab_validated: 'Validated',
    opt_tab_experimental: 'Experimental',
    opt_exp_title: 'Experimental knobs',
    opt_exp_intro: 'These controls are outside the validated baseline. They are for targeted A/B checks and runtime research, not default recommendations.',
    opt_exp_meta_note: 'Each experimental knob now carries three badges: where it fits mechanically, where current runtime support is actually wired today, and where benchmark-backed signal already exists.',
    opt_exp_learn_title: 'How these change execution',
    opt_exp_learn_body: 'These settings do not change model weights. They change runtime behavior: which experts are treated as hot, how much of the prompt is trusted as a predictor of early decode, and whether very weak experts may be dropped. Change one knob at a time and compare against the validated baseline.',
    p_exp_preset: 'Experimental preset', d_exp_preset: 'Ready-made research bundles. Use them as fast A/B starting points, not as validated defaults.',
    p_exp_link: 'Link preset to validated settings', d_exp_link: 'If ON, applying an experimental preset may also adjust validated knobs when the bundle depends on them. If OFF, only experimental controls change.',
    p_prompt_packed: 'Prompt Packed QKV', d_prompt_packed: 'Experimental prompt-only mode: instead of the usual split Q/K/V path, runtime tries a more locality-friendly layout for the prompt phase. This may speed up prompt processing, but it does not automatically speed up the full session and may cost extra RAM/load time.',
    p_prompt_packed_preset: 'Prompt Packed preset', d_prompt_packed_preset: 'A ready-made way to tell runtime which layers to try packing. This is not “the best mode in general”; it is a fast A/B starting point. Current research suggests Qwen tends to like front-half, while gpt-oss tends to like back-half.',
    p_prompt_packed_range: 'Prompt Packed range', d_prompt_packed_range: 'Manual override for advanced A/B. You explicitly choose which layers should use Prompt Packed. If you do not know why you need a custom range, use a preset instead.',
    p_live_obs: 'Live Observability', d_live_obs: 'Dashboard-only traces for interactive inference-phase and expert-activity visualization. Useful for learning and debugging; disable it for the cleanest benchmark runs.',
    ser_min: 'min experts:', ser_thresh: 'threshold:',
    p_gr: 'Graph Reuse', d_gr: 'Reuse compute graph between tokens. Saves graph construction time. Only disable for debugging',
    p_mqkv: 'Merge QKV', d_mqkv: 'Merge Q, K, V into one tensor for attention. Improves data locality during attention computation',
    p_khad: 'K-Cache Hadamard', d_khad: 'Hadamard transform for K-cache. Reduces quantization error. Only useful with quantized cache (q8_0, q4_0). Pointless with f16/f32',
    p_fmoe: 'Fused MoE', d_fmoe: 'Fused up*gate op for MoE models. Fewer kernel launches. Default ON — not recommended to disable',
    p_fug: 'Fused Up*Gate', d_fug: 'Fused up*unary(gate) for FFN. Fewer kernel calls = faster. Default ON',
    exp_preset_none: 'Manual mode: the dashboard does not auto-apply a research bundle. You control experimental knobs directly.',
    exp_preset_minimax: 'MiniMax mixed locality: enables tail-window hot-expert selection and, when linked, keeps a mixed-friendly baseline around Flash Attention + RTR auto + muge OFF.',
    exp_preset_qwen: 'Qwen prompt-packed: enables Prompt Packed QKV with a front-half profile. This is prompt-path locality research, not a validated recommendation.',
    exp_preset_gptoss: 'gpt-oss prompt-packed: enables Prompt Packed QKV with a back-half profile. This is prompt-path locality research, not a validated recommendation.',
    exp_preset_merge_qkv: 'Attention merge-qkv: enables Merge QKV as a mild attention-side experiment. When linked, it also fixes Flash Attention and Graph Reuse.',
    p_host: 'Host', p_port: 'Port', p_np: 'Parallel sequences', d_np: 'Concurrent request slots. Each slot = separate KV cache, uses extra memory',
    p_apikey: 'API Key', p_thttp: 'HTTP threads', d_thttp: 'Threads for HTTP request processing (not compute). -1 = auto. Rarely needs changing',
    p_seed: 'Seed', d_seed: 'Random number generator seed. -1 = random. Fixed seed for reproducible results',
    p_predict: 'Predict tokens', d_predict: 'Max tokens per generation. -1 = unlimited. Useful for benchmarks (-n 128) or limiting response length',
    p_mmap: 'Memory-mapped I/O (mmap)', d_mmap: 'Load model by mapping file into memory. OS loads pages on demand. rtr=on forces mmap off; with rtr=auto the runtime policy may still change the effective outcome',
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
    chat_title: 'Chat', chat_empty: 'Launch a model to start chatting',
    cli_welcome: 'Launch a model to start the terminal session',
    cli_terminal_label: 'llama-cli \u2014 logs (session in terminal)',
    console_label: 'Console \u2014 logs',
    cli_ext_session: 'Interactive session opened in external terminal. Loading logs displayed here.',
    cli_ext_ready: 'Model loaded. Type your message in the terminal window.',
    cli_ext_input: 'Use the external terminal for input',
    proc_title: 'Process Output', proc_idle: 'idle', proc_running: 'running', proc_stopped: 'stopped',
    srv_online: 'Dashboard server: connected', srv_offline: 'Dashboard server: offline (run dashboard_server.py)',
    scan_no_path: 'Enter a model path or directory first', scan_empty: 'No .gguf files found',
    btn_auto: 'Auto-configure', auto_applied: 'Parameters auto-configured',
    auto_no_model: 'Select a model first',
    auto_reading: 'Reading model metadata...',
    btn_glossary: '? Glossary',
    glossary_title: 'Glossary',
    glossary_search: 'Search...',
    w_rtr_swap: 'Forced rtr=on on a swap-bound model is risky: working set grows, mmap gets disabled, and the slowdown can become severe, especially on mixed path.',
    w_rtr_swap_fix: 'Do not force ON for swap-bound models. Start with AUTO for Qwen3MoE/gpt-oss. For MiniMax: start TG-only with OFF, and explicitly compare mixed path against AUTO.',
    w_muge_swap: 'Merge Up+Gate on swap-bound MoE is usually harmful: contiguous allocations get larger and page-fault pressure rises.',
    w_muge_swap_fix: 'Disable -muge for swap-bound models.',
    w_rtr_muge: 'rtr and muge are both enabled. This is no longer a crash combo, but it is still best avoided for swap-bound MoE.',
    w_rtr_auto_moe: 'rtr=auto on MoE is the current throughput-first starting point for the Zen4 profile on Qwen3MoE and gpt-oss. Do not infer mixed-path behavior from TG alone.',
    w_rtr_auto_fix: 'If the model is MiniMax or another heavy swap-bound case, also test rtr=off explicitly.',
    w_rtr_off_validated_moe: 'For current Zen4 Qwen3MoE/gpt-oss cases, rtr=off is conservative but often leaves performance on the table versus auto.',
    w_threads_moe: 'MoE model with >16 threads: on this Zen4 host that is often worse for throughput, but it is not a universal rule. For in-RAM models, A/B test 24/32.',
    w_threads_moe_fix: 'Use -t 16 as the MoE baseline on Zen4 and test 24/32 only on real benchmarks.',
    w_ctk_good: 'q8_0 KV cache remains the best current baseline: it saves a lot of memory and showed no meaningful regression in the current validated profiles.',
    w_ser_info: 'SER is an experimental router-side option. It may reduce swap I/O, but it should not be presented as a validated default yet.',
    w_gptoss_huge_auto: 'For huge gpt-oss, rtr=auto is currently the throughput-first start, but remember the high startup/load-time cost.',
    w_gptoss_huge_auto_fix: 'If cold-start matters more, compare against rtr=off.',
    w_swap_bound: 'Model is swap-bound (exceeds 90% RAM). For these cases, mmap, KV cache size, and rtr mode matter a lot. Do not copy in-RAM conclusions directly.',
    w_fa_off: 'Flash Attention is OFF. This hurts mixed path (prompt+generation) especially hard. On the current Zen4 MoE profile, keep it ON.',
    w_threads_ccd: 'Using fewer threads than one CCD on dual-CCD CPU. L3 cache cut from 64 MB to 32 MB.',
    w_threads_ccd_fix: 'Use -t 16 to leverage both CCDs.',
    w_rtr_nommap: 'rtr=on forces mmap off. In auto mode mmap may still remain enabled until the runtime policy decides otherwise.',
    w_muge_dense: '-muge only affects MoE models (ffn_up_exps + ffn_gate_exps). No effect on dense models.',
    w_khad_f16: 'K-Cache Hadamard only useful with quantized KV cache (not f16/f32).',
    w_minimax_rtr_on: 'MiniMax M2.5 has its own attention/runtime specifics. Forced rtr=on remains a risky mode for swap-bound MiniMax.',
    w_minimax_rtr_auto: 'For MiniMax, the old bad auto result came from a policy bug. On the fixed tree TG-only still leans to OFF, but mixed path already showed a small AUTO win.',
    w_minimax_hot_budget_hint: 'For MiniMax, a short quick check once highlighted 24/32, but the first longer controlled rtr=off run did not confirm a new default above the legacy 16 budget.',
    w_minimax_hot_budget_fix: 'The current user-facing baseline is simple: leave Hot Expert Budget = 0. Larger budgets remain research-only for now.',
    w_workload_mixed: 'Mixed (PG) workload is selected. In the current fork this is the main user-facing scenario, and it must not be inferred from TG alone.',
    w_workload_tg: 'TG-only workload is selected. Good for decode throughput, but do not transfer those conclusions directly to prompt+generation.',
    w_workload_pp: 'PP workload is selected. Useful for long prompts, but it does not represent full dialog speed.',
    w_mqkv_experimental: 'Merge QKV is experimental. It is model-sensitive and not part of the validated default layer.',
    w_hot_budget_experimental: 'Hot Expert Budget is an experimental env knob. For normal MiniMax use, leave it at 0; larger budgets have not become a validated default.',
    w_hot_budget_family: 'Hot Expert Budget belongs to huge-MoE locality. Mechanically it is broader than one family, but the current runtime path is fully wired today mainly on the MiniMax path. On other MoE families treat it as research A/B, not as a ready-made rule.',
    w_hot_budget_mult_experimental: 'Hot Expert Budget Mult is an experimental MoE locality knob. It does not set a fixed budget; it scales the internal runtime hot-expert baseline.',
    w_hot_budget_mult_family: 'Hot Expert Budget Mult belongs to huge-MoE locality. Mechanically it is broader than a single family, but benchmark-backed guidance is still research-only.',
    w_hot_selection_experimental: 'Hot Expert Selection / Tail Window is an experimental MoE locality path. It does not change model weights, only how the runtime chooses hot experts from the prompt.',
    w_hot_selection_family: 'Hot Expert Selection / Tail Window belong to MoE locality rather than to one model. The runtime path is now widened to compatible MoE. Current benchmarks still center on MiniMax, while gpt-oss-20b only shows a small positive signal so far. Treat other MoE families as research-only until more validation exists.',
    w_prompt_packed_experimental: 'Prompt Packed QKV is a research prompt-path mode. It is not a validated default and may cost extra RAM and load time.',
    w_prompt_packed_family: 'Prompt Packed QKV belongs to split-QKV attention families. The manual runtime path is now broader than a single family, but practical value differs: the strongest signal is already on gpt-oss-120b, while Qwen3MoE and gpt-oss-20b mainly show prompt-side gains with weak mixed-path value. Treat other split-QKV families as research mode for now.',
    w_prompt_packed_range: 'An explicit Prompt Packed range is set. This is an advanced override on top of the preset and should only be used for deliberate A/B checks.',
    w_exp_preset_link: 'The experimental preset is linked to validated settings. Selecting a preset may change Flash Attention, RTR, Graph Reuse, or other validated knobs.',
    badge_family: 'Family',
    badge_path: 'Path',
    badge_status: 'Status',
    badge_family_qwen: 'Qwen3MoE',
    badge_family_gptoss: 'gpt-oss',
    badge_family_minimax: 'MiniMax M2.5',
    badge_family_other: 'Generic / unknown',
    badge_path_inram: 'in-RAM profile',
    badge_path_swap: 'swap-bound profile',
    badge_path_mixed: 'mixed-path matters',
    badge_path_tg: 'TG-only focus',
    badge_path_pp: 'PP focus',
    badge_status_validated: 'validated baseline',
    badge_status_partial: 'research / partial',
    badge_status_unknown: 'unknown family',
    badge_status_exp_knobs: 'experimental knobs active',
    note_minimax_hot_budget: 'MiniMax advanced note: a short quick check once pointed at larger budgets, but the first longer controlled rtr=off run brought the practical answer back to the legacy default 16. For normal launches leave Hot Expert Budget = 0; larger budgets remain research-only.',
    live_title: 'Live Inference View',
    live_subtitle: 'Phase flow and MoE expert activity for the current run',
    live_waiting: 'Waiting for a model launch',
    live_disabled: 'Live Observability is disabled. Enable it in Advanced so the dashboard adds phase and expert trace environment variables.',
    live_running: 'live',
    live_idle: 'idle',
    live_arch: 'Architecture',
    live_trace: 'Trace',
    live_timeline: 'Phases',
    live_flow_title: 'Execution flow',
    live_flow_note: 'This is a simplified visual model of real inference: active blocks and arrows are driven by live/replay trace data.',
    live_flow_node_hint: 'A high-level block in the inference flow',
    live_flow_arrow_hint: 'Data transition between major inference stages',
    live_flow_path: 'Current path',
    live_flow_node_input: 'Input / Prompt',
    live_flow_node_shared: 'Shared path',
    live_flow_node_router: 'Router',
    live_flow_node_experts: 'Experts',
    live_flow_node_decode: 'Decode',
    live_flow_path_idle: 'idle',
    live_flow_path_prompt: 'prompt path',
    live_flow_path_first_decode: 'prompt → first decode',
    live_flow_path_decode: 'decode tail',
    live_flow_note_idle: 'Trace has not started yet. After model launch the blocks will highlight according to the real inference path.',
    live_flow_note_prompt: 'The model is processing the prompt: data goes through the shared path, then the router selects experts for the prompt batch.',
    live_flow_note_first_decode: 'The prompt-to-first-decode transition is active now. This is an important boundary where mixed and TG-only behavior often diverge.',
    live_flow_note_decode: 'Normal decode tail is active: the router keeps selecting experts dynamically, and the prompt no longer determines the full path.',
    live_mem_title: 'Memory regime',
    live_mem_regime: 'Memory profile',
    live_mem_regime_inram: 'in-RAM',
    live_mem_regime_near: 'near-RAM',
    live_mem_regime_swap: 'swap-bound',
    live_mem_regime_unknown: 'unknown',
    live_mem_model: 'Model size',
    live_mem_ram: 'Profile RAM',
    live_mem_available: 'Available now',
    live_mem_ratio: 'Model / RAM',
    live_mem_note_unknown: 'Not enough data to estimate the memory regime yet. Usually this means model size or profile RAM is still unknown.',
    live_mem_note_inram: 'The model fits comfortably in RAM. Bottlenecks here are usually closer to compute and layout than to paging.',
    live_mem_note_near: 'The model is near the RAM limit. Small changes in KV cache, RTR, or hot experts can already change behavior noticeably.',
    live_mem_note_swap: 'The model is swap-bound: memory and paging become part of the critical path. What matters is not just how much compute happens, but which experts stay hot.',
    live_mem_note_hot_budget: 'Current hot-expert budget',
    live_mem_note_stage: 'Latest stage',
    live_mem_note_locked_share: 'Latest locked share',
    live_phase_prompt: 'Prompt',
    live_phase_first_decode: 'First decode',
    live_phase_decode_tail: 'Decode tail',
    live_phase_current: 'Current phase',
    live_prompt_tokens: 'Prompt tokens',
    live_prompt_ms: 'Prompt ms',
    live_ttft_ms: 'TTFT ms',
    live_decode_tps: 'Decode tok/s',
    live_last_token_ms: 'Last token ms',
    live_decode_steps: 'Decode steps',
    live_moe_title: 'MoE activity',
    live_moe_stage: 'Stage',
    live_moe_layer: 'Layer',
    live_moe_budget: 'Budget',
    live_moe_locked_share: 'Locked share',
    live_moe_dispatches: 'Dispatches',
    live_moe_top_experts: 'Top experts',
    live_moe_selection: 'Hot selection',
    live_moe_locked_total: 'Locked/total',
    live_moe_fails: 'Fails',
    live_moe_stage_compare: 'Stage comparison',
    live_moe_heatmap: 'Expert heatmap',
    live_moe_heatmap_note: 'If layer traces are available, rows are model layers. Otherwise the heatmap falls back to hot-expert stages.',
    live_moe_heatmap_empty_note: 'This run does not have deep enough expert traces for a heatmap. Choose a curated layer-trace demo for a full layer x expert view.',
    live_moe_heatmap_open_demo: 'Open layer-trace demo',
    live_moe_heatmap_rows: 'Rows',
    live_moe_heatmap_cols: 'Experts',
    live_moe_heatmap_peak: 'Peak',
    live_moe_heatmap_axis: 'Row axis',
    live_moe_heatmap_legend: 'Color intensity shows how often the expert appeared in the current trace window.',
    live_moe_heatmap_low: 'low',
    live_moe_heatmap_high: 'high',
    live_moe_prompt_decode_compare: 'Prompt vs decode experts',
    live_moe_overlap_count: 'Shared experts',
    live_moe_overlap_hint: 'Pattern',
    live_moe_stability: 'Expert-set stability',
    live_moe_stability_label: 'Assessment',
    live_moe_stability_score: 'Overlap',
    live_moe_stability_note: 'Overlap shows how similar the prompt and decode top-expert sets are. Low overlap means prompt predicts future decode poorly.',
    live_moe_stability_stable: 'stable',
    live_moe_stability_mixed: 'mixed',
    live_moe_stability_volatile: 'volatile',
    live_recent_phases: 'Recent phase events',
    live_recent_stage_history: 'Hot-expert stage history',
    live_phase_compare: 'Prompt vs decode',
    live_phase_compare_note: 'Prompt and decode are different execution modes; do not transfer conclusions from one onto the other automatically.',
    live_recent_idx: 'Step',
    live_recent_total_ms: 'Total ms',
    live_recent_locked_share: 'Locked %',
    live_no_phase_data: 'No phase trace data yet.',
    live_no_moe_data: 'No expert trace data yet.',
    live_mode: 'Mode',
    live_mode_live: 'Live',
    live_mode_replay: 'Replay',
    live_replay_run: 'Replay run',
    live_replay_filter: 'Filter',
    live_replay_filter_curated: 'curated',
    live_replay_filter_all: 'all',
    live_replay_filter_trace: 'trace only',
    live_replay_reload: 'Reload list',
    live_replay_play: 'Play',
    live_replay_pause: 'Pause',
    live_replay_step: 'Step',
    live_replay_speed: 'Speed',
    live_replay_latest: 'latest',
    live_replay_no_runs: 'No replay runs with logs found.',
    live_replay_no_trace: 'Selected run has no trace events for replay.',
    live_replay_source: 'Source',
    live_replay_event: 'Event',
    live_replay_frames: 'Frames',
    live_replay_demo: 'Demo',
    live_replay_generic: 'generic run',
    live_replay_type: 'Type',
    live_replay_telemetry: 'Telemetry',
    live_replay_telemetry_layer_expert: 'layer + expert',
    live_replay_telemetry_phase_trace: 'phase trace',
    live_replay_telemetry_no_trace: 'no trace',
    live_replay_quick_picks: 'Quick demo picks',
    live_family_label: 'Family',
    live_replay_finished: 'Replay finished',
    live_family_generic: 'Generic',
    live_family_minimax: 'MiniMax',
    live_family_gptoss: 'gpt-oss',
    live_family_qwen: 'Qwen',
    live_view: 'View',
    live_view_learn: 'Learn',
    live_view_inspect: 'Inspect',
    live_learn_phase_title: 'What is happening now',
    live_learn_phase_text_idle: 'No trace events yet. Once prompt and decode activity appears, this panel starts explaining the current model flow.',
    live_learn_phase_text_prompt: 'The model is processing the prompt. This is not the same as later generation: prompt and decode can behave differently.',
    live_learn_phase_text_first_decode: 'This is the first token after prompt. It is an important boundary where prompt path and normal decode often diverge.',
    live_learn_phase_text_decode: 'The model is generating normal decode tokens. Do not transfer this behavior mechanically onto prompt or mixed path as a whole.',
    live_learn_moe_title: 'What MoE shows',
    live_learn_moe_none: 'No expert trace events yet. This is normal if trace is disabled or the run has no MoE activity lines.',
    live_learn_moe_text: 'Experts activate dynamically. This helps explain why active params do not mean one fixed chunk of the model sits in RAM.',
    live_learn_prompt_decode: 'Prompt and decode are different execution modes. If they look different here, that is expected for huge MoE.',
    live_learn_stage_prefix: 'Current stage:',
    live_learn_top_prefix: 'Top experts:',
    live_learn_overlap_prefix: 'Current prompt/decode overlap is visible in experts:',
    live_learn_overlap_none: 'There is no strong prompt/decode top-expert overlap visible right now.',
    live_learn_stability_prefix: 'Expert-set stability:',
    live_learn_stability_none: 'Expert-set stability is not available yet.',
    live_token_title: 'Token journey',
    live_token_kind: 'Token',
    live_token_chip: 'token',
    live_token_prompt_batch: 'prompt batch',
    live_token_first: 'first decode token',
    live_token_decode: 'decode token',
    live_token_idle: 'idle',
    live_token_note_idle: 'Once phase trace events appear, a simplified token will start moving across the inference path here.',
    live_token_note_prompt: 'During prompt, the model processes a batch rather than a single token. This diagram shows a simplified data path through router and experts.',
    live_token_note_first: 'The first decode token is the boundary between prompt and steady-state generation. Mixed path often diverges from TG-only exactly here.',
    live_token_note_decode: 'During decode, tokens advance one by one. The router keeps selecting experts dynamically, so the path is not fixed after prompt.',
    live_token_line_hint: 'Simplified data path for the current inference phase',
    live_token_stop_input_hint: 'The prompt batch or next decode token enters the model here',
    live_token_stop_router_hint: 'The router decides which experts should activate in MoE layers',
    live_token_stop_experts_hint: 'Selected experts process the token or prompt batch',
    live_token_stop_decode_hint: 'After shared path and experts, the model produces the next decode step',
    live_minimax_story_title: 'MiniMax memory story',
    live_minimax_story_note: 'This is a simplified huge-MoE memory model: shared tensors try to stay hot, some experts enter the hot set, and cold experts remain pageable.',
    live_minimax_story_shared: 'Shared tensors',
    live_minimax_story_shared_note: 'Attention, router and other common model parts are worth keeping hot because they are needed almost all the time.',
    live_minimax_story_hot: 'Hot experts',
    live_minimax_story_hot_note: 'The prompt can hint at a likely useful subset of experts, but it does not lock the full future decode path.',
    live_minimax_story_cold: 'Cold experts',
    live_minimax_story_cold_note: 'The remaining experts may stay cold and get paged in on demand. Huge MoE often bottlenecks exactly here through locality and paging.',
    live_replay_desc_none_title: 'Replay demo',
    live_replay_desc_none_body: 'Select a replay run to see its live-like visualization and a short explanation of what this run is useful for.',
    live_replay_overview_title: 'Curated replay demos',
    live_replay_overview_note: 'Start with one of the curated demo-runs. This is the fastest way to understand the live/replay layer without browsing all artifacts manually.',
    live_replay_scenarios: 'Viewing scenarios',
    live_scenario_minimax_title: 'Learn MiniMax',
    live_scenario_minimax_body: 'Shows huge MoE under memory pressure: layer x expert heatmap, hot experts, and memory-aware behavior.',
    live_scenario_qwen_title: 'Learn Qwen',
    live_scenario_qwen_body: 'Shows a lighter in-RAM / near-RAM MoE case where prompt vs decode is easier to inspect without heavy paging.',
    live_scenario_gptoss_title: 'Inspect gpt-oss',
    live_scenario_gptoss_body: 'Good for cleaner replay UX and engineering inspection of decode/mixed path without huge-model noise.',
    live_replay_desc_generic_title: 'Replay run',
    live_replay_desc_generic_body: 'This is a saved trace-run. Use it to inspect inference flow, expert activity, and prompt/decode differences without relaunching the model.',
    live_replay_desc_minimax_layer_title: 'MiniMax: layer-by-layer expert activity',
    live_replay_desc_minimax_layer_body: 'This demo-run is useful for huge MoE: it shows a real layer x expert heatmap, prompt → decode flow, and memory-aware MiniMax behavior under CPU inference.',
    live_replay_desc_minimax_quick_title: 'MiniMax: quick expert check',
    live_replay_desc_minimax_quick_body: 'This run is useful as a compact hot-expert telemetry example: it shows the hot-expert workflow stages without waiting for a heavy long-run.',
    live_replay_desc_gptoss_title: 'gpt-oss: MoE replay',
    live_replay_desc_gptoss_body: 'This run is useful as a lighter and less noisy MoE scenario. It is good for replay UX work and prompt/decode comparison without huge-model memory pressure.',
    live_replay_desc_qwen_title: 'Qwen: MoE replay',
    live_replay_desc_qwen_body: 'This run is useful for studying in-RAM or near-in-RAM MoE behavior, where the bottleneck is closer to compute path than to heavy paging.',
    live_replay_desc_qwen_window_title: 'Qwen: decode window trace',
    live_replay_desc_qwen_window_body: 'This run helps inspect the first decode tokens after prompt and see how mixed path differs from TG-only even without huge-model memory pressure.',
    live_onboard_title: 'What to do next',
    live_onboard_title_replay: 'How to read this replay',
    live_onboard_body_live: 'This strip keeps live mode focused: first identify the inference phase, then compare prompt vs decode, and only then dive into MoE details.',
    live_onboard_body_replay: 'In replay, go from broad to narrow: first execution flow, then prompt/decode, then experts and memory story.',
    live_onboard_chip_mode: 'Mode',
    live_onboard_chip_view: 'View',
    live_onboard_chip_telemetry: 'Telemetry',
    live_onboard_chip_trace: 'Trace',
    live_onboard_step_watch_flow: 'Start by checking which phase is active and how the execution flow highlights it.',
    live_onboard_step_compare_prompt_decode: 'Then compare prompt and decode. They are different execution modes, and conclusions do not transfer automatically.',
    live_onboard_step_switch_replay: 'If the live run is too noisy, switch to Replay and open a curated demo.',
    live_onboard_step_inspect_heatmap: 'In Inspect, first check whether you have a real layer x expert heatmap or only a phase-trace fallback.',
    live_onboard_step_inspect_stage: 'For MiniMax, stage history and locked share often explain memory behavior better than raw tok/s.',
    live_onboard_step_use_curated_replay: 'For learning, it is usually easier to start from curated replay scenarios than from the current run.',
    live_onboard_step_layer_heatmap: 'Start with the heatmap. It shows how experts distribute across layers or workflow stages.',
    live_onboard_step_prompt_decode: 'Then compare prompt and decode to see how well prompt predicts the later path.',
    live_onboard_step_minimax_memory: 'For MiniMax, finish with the memory story. It explains shared tensors, hot experts, and cold experts.',
    live_onboard_step_replay_flow: 'Begin with execution flow and token journey to understand the overall run structure.',
    live_onboard_step_try_layer_demo: 'If this replay has only phase trace, open a curated MiniMax layer-trace demo for deeper expert inspection.',
    live_onboard_step_switch_inspect: 'If you are in Learn, switch to Inspect after the first pass to see more useful details.',
    live_workspace_main: 'Main stage',
    live_workspace_side: 'Inspector',
    live_workspace_stage_flow: 'Flow',
    live_workspace_stage_heatmap: 'Heatmap',
    live_workspace_stage_compare: 'Compare',
    live_workspace_inspector_guide: 'Guide',
    live_workspace_inspector_phase: 'Phase',
    live_workspace_inspector_moe: 'MoE',
    live_workspace_inspector_memory: 'Memory',
    live_workspace_hide_inspector: 'Hide inspector',
    live_workspace_show_inspector: 'Show inspector',
    runtime_dock_title: 'Runtime panels',
    runtime_dock_note: 'Collapse the right column to free space for the live scene.',
    runtime_dock_hide_side: 'Hide right column',
    runtime_dock_show_side: 'Show right column',
    runtime_main_bar_title: 'Right column hidden',
    runtime_main_bar_note: 'Restore terminal, chat, and logs when you need them again.',
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
// === CROSS-PARAMETER RULES ===
// ============================================================
function isSwapBound(s, p) {
  return p.totalRamGb > 0 && s.model_size_gb > 0 && s.model_size_gb > p.totalRamGb * 0.9;
}

function modelPathContains(s = state, needle = '') {
  const path = String((s && s.model) || '').toLowerCase();
  return !!needle && path.includes(String(needle).toLowerCase());
}

function getRtrMode(s = state) {
  return s.repack_tensors || 'off';
}

function isRtrForcedOn(s = state) {
  return getRtrMode(s) === 'on';
}

function isRtrEnabled(s = state) {
  return getRtrMode(s) !== 'off';
}

function detectModelFamily(s = state, meta = lastModelMeta) {
  const arch = String(meta?.architecture || '').toLowerCase();
  const name = String(meta?.name || meta?.basename || s.model || '').toLowerCase();
  if (arch.includes('minimax') || name.includes('minimax')) return 'minimax';
  if (arch.includes('openai') || arch.includes('gpt-oss') || name.includes('gpt-oss')) return 'gpt-oss';
  if (arch.includes('qwen3moe') || (name.includes('qwen3') && name.includes('a3b'))) return 'qwen3moe';
  return 'other';
}

function isValidatedAutoMoeFamily(s = state, meta = lastModelMeta) {
  const family = detectModelFamily(s, meta);
  return s.model_type === 'moe' && (family === 'qwen3moe' || family === 'gpt-oss');
}

function getFamilyValidationStatus(s = state, meta = lastModelMeta) {
  return window.IKLLamaEvidenceLayer?.getFamilyValidationStatus?.(
    { state: s, meta, family: detectModelFamily(s, meta), modelPath: s.model || '', modelType: s.model_type, workload: s.workload_profile, isSwapBound: isSwapBound(s, currentProfile || {}) },
    { detectModelFamily, isSwapBound }
  ) || 'unknown';
}

function hasExperimentalKnobs(s = state) {
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

function isExperimentalRuntimeLimited(param, s = state, p = currentProfile) {
  const meta = getSupportBadgeMeta(param, s, p);
  if (!meta) return false;
  return meta.className === 'support-limited' || meta.className === 'support-inactive';
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
let currentWorkspacePane = 'overview';
let currentOptimizationPane = 'validated';

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
const TOGGLE_PARAMS = [
  'flash_attn', 'merge_up_gate_exps', 'graph_reuse',
  'merge_qkv', 'k_cache_hadamard', 'fused_moe_up_gate', 'fused_up_gate',
  'use_mmap', 'use_mlock', 'ser_enabled', 'live_observability',
  'experimental_preset_link_validated', 'prompt_packed_qkv',
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
  renderParameterApplicability();
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

function severityLevel(s) {
  return { success: 0, info: 1, warning: 2, error: 3 }[s] || 0;
}

const SEVERITY_ICONS = { error: '\u26D4', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F', success: '\u2705' };
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
  hot_expert_selection: 'moe-huge',
  hot_expert_tail_window: 'moe-huge',
  merge_qkv: 'arch-specific',
  k_cache_hadamard: 'quantized-kv',
  prompt_packed_qkv: 'split-qkv',
  prompt_packed_qkv_preset: 'split-qkv',
  prompt_packed_qkv_range: 'split-qkv',
  experimental_preset: 'all',
  experimental_preset_link_validated: 'all',
};

function getParamScopeAndMetaHost(param) {
  const controlId = PARAM_CONTROL_MAP[param];
  const control = controlId ? document.getElementById(controlId) : null;
  if (!control) return { scope: null, host: null };

  const scope = control.closest('.param-row, .experimental-link-card, .experimental-preset-copy');
  if (!scope) return { scope: null, host: null };

  let host = scope.querySelector('.param-label');
  if (!host) {
    host = scope.querySelector(`.param-meta-host[data-meta-host="${param}"]`);
    if (!host) {
      host = document.createElement('div');
      host.className = 'param-meta-host';
      host.dataset.metaHost = param;
      const anchor = scope.querySelector('.experimental-intro-title, .param-desc');
      if (anchor) scope.insertBefore(host, anchor.nextSibling);
      else scope.appendChild(host);
    }
  }

  let strip = host.querySelector(`.param-meta-strip[data-meta-param="${param}"]`);
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'param-meta-strip';
    strip.dataset.metaParam = param;
    host.appendChild(strip);
  }

  return { scope, host, strip };
}

function renderParameterApplicability() {
  for (const [param, controlId] of Object.entries(PARAM_CONTROL_MAP)) {
    const control = document.getElementById(controlId);
    if (!control) continue;

    const { strip } = getParamScopeAndMetaHost(param);
    if (!strip) continue;

    strip.innerHTML = '';

    const appMeta = getApplicabilityMeta(getExperimentalApplicabilityKind(param));
    const appBadge = document.createElement('span');
    appBadge.className = `param-app-badge ${appMeta.className}`;
    appBadge.dataset.appParam = param;
    appBadge.textContent = appMeta.label;
    appBadge.title = appMeta.title;
    strip.appendChild(appBadge);

    if (window.IKLLamaEvidenceLayer?.EXPERIMENTAL_KNOB_EVIDENCE?.[param]) {
      const supportMeta = getSupportBadgeMeta(param);
      if (supportMeta) {
        const supportBadge = document.createElement('span');
        supportBadge.className = `param-support-badge ${supportMeta.className}`;
        supportBadge.dataset.supportParam = param;
        supportBadge.textContent = supportMeta.label;
        supportBadge.title = supportMeta.title;
        strip.appendChild(supportBadge);
      }

      const validationMeta = getValidationBadgeMeta(param);
      if (validationMeta) {
        const validationBadge = document.createElement('span');
        validationBadge.className = `param-validation-badge ${validationMeta.className}`;
        validationBadge.dataset.validationParam = param;
        validationBadge.textContent = validationMeta.label;
        validationBadge.title = validationMeta.title;
        strip.appendChild(validationBadge);
      }

      const confidenceMeta = getConfidenceBadgeMeta(param);
      if (confidenceMeta) {
        const confidenceBadge = document.createElement('span');
        confidenceBadge.className = `param-confidence-badge ${confidenceMeta.className}`;
        confidenceBadge.dataset.confidenceParam = param;
        confidenceBadge.textContent = confidenceMeta.label;
        confidenceBadge.title = confidenceMeta.title;
        strip.appendChild(confidenceBadge);
      }
    }
  }
}
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
  use_mmap: 'advanced',
  use_mlock: 'advanced',
  numa: 'advanced',
  defrag_thold: 'advanced',
  seed: 'advanced',
  n_predict: 'advanced',
};

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

  const family = detectModelFamily(state);
  const familyClass = family === 'qwen3moe'
    ? 'family-qwen'
    : family === 'gpt-oss'
      ? 'family-gptoss'
      : family === 'minimax'
        ? 'family-minimax'
        : 'family-generic';
  const familyText = family === 'qwen3moe'
    ? t('badge_family_qwen')
    : family === 'gpt-oss'
      ? t('badge_family_gptoss')
      : family === 'minimax'
        ? t('badge_family_minimax')
        : t('badge_family_other');

  const profile = currentProfile || { totalRamGb: 0 };
  const swapBadge = isSwapBound(state, profile) ? t('badge_path_swap') : t('badge_path_inram');
  const workloadBadge = state.workload_profile === 'tg'
    ? t('badge_path_tg')
    : state.workload_profile === 'pp'
      ? t('badge_path_pp')
      : t('badge_path_mixed');
  const validationStatus = getFamilyValidationStatus(state);
  const statusClass = validationStatus === 'validated'
    ? 'status-validated'
    : validationStatus === 'partial'
      ? 'status-partial'
      : 'status-unknown';
  const statusText = validationStatus === 'validated'
    ? t('badge_status_validated')
    : validationStatus === 'partial'
      ? t('badge_status_partial')
      : t('badge_status_unknown');
  const experimentalBadge = hasExperimentalKnobs(state)
    ? `<span class="model-badge status-experimental">${t('badge_status_exp_knobs')}</span>`
    : '';

  el.innerHTML = `
    <span class="model-badge ${familyClass}">${t('badge_family')}: ${familyText}</span>
    <span class="model-badge family-generic">${t('badge_path')}: ${swapBadge}</span>
    <span class="model-badge family-generic">${workloadBadge}</span>
    <span class="model-badge ${statusClass}">${t('badge_status')}: ${statusText}</span>
    ${experimentalBadge}
  `;
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

  root.innerHTML = `
    <details class="exp-preset-dropdown">
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

function buildEnvOverrides(s = state) {
  const env = {};
  if (s.live_observability) {
    env.IK_LLAMA_PG_TRACE = '1';
    env.IK_LLAMA_PG_TRACE_DECODE_WINDOW = '8';
    env.IK_LLAMA_HOT_EXPERT_TRACE = '1';
  }
  return env;
}

function buildExperimentalCliArgs(s = state) {
  const args = [];
  if ((s.hot_expert_budget || 0) > 0) {
    args.push('--experimental', `hot-expert-budget=${s.hot_expert_budget}`);
  }
  if ((s.hot_expert_budget_mult || 0) > 0) {
    args.push('--experimental', `hot-expert-budget-mult=${s.hot_expert_budget_mult}`);
  }
  if (s.hot_expert_selection && s.hot_expert_selection !== 'default') {
    args.push('--experimental', `hot-expert-selection=${String(s.hot_expert_selection)}`);
  }
  if (s.hot_expert_selection === 'tail-window' && (s.hot_expert_tail_window || 0) > 0) {
    args.push('--experimental', `hot-expert-tail-window=${s.hot_expert_tail_window}`);
  }
  if (s.prompt_packed_qkv) {
    args.push('--experimental', 'prompt-packed-qkv=on');
    const explicitRange = String(s.prompt_packed_qkv_range || '').trim();
    if (explicitRange) {
      args.push('--experimental', `prompt-packed-range=${explicitRange}`);
    } else if (s.prompt_packed_qkv_preset) {
      args.push('--experimental', `prompt-packed-preset=${String(s.prompt_packed_qkv_preset)}`);
    }
  }
  return args;
}

function renderEnvPrefix(env, shell) {
  const entries = Object.entries(env);
  if (!entries.length) return '';
  if (shell === 'powershell') {
    return entries.map(([k, v]) => `$env:${k}='${String(v).replace(/'/g, "''")}'`).join('\n') + '\n';
  }
  return entries.map(([k, v]) => `${k}=${String(v)}`).join(' ') + ' \\\n';
}

// ============================================================
// === COMMAND GENERATION ===
// ============================================================
function renderCommand() {
  const s = state;
  const isServer = s.target === 'llama-server';
  // On Linux/macOS prefix with ./ for local executables
  const isUnix = serverInfo && (serverInfo.os === 'Linux' || serverInfo.os === 'Darwin');
  const prefix = isUnix ? './' : '';
  const parts = [prefix + s.target];

  // Model
  if (s.model) {
    parts.push('-m "' + s.model + '"');
  }

  // Performance
  if (s.threads !== -1 && s.threads !== 0) parts.push('-t ' + s.threads);
  if (s.threads_batch !== -1) parts.push('-tb ' + s.threads_batch);
  if (s.n_ctx !== 0) parts.push('-c ' + s.n_ctx);
  if (s.n_batch !== 2048) parts.push('-b ' + s.n_batch);
  if (s.n_ubatch !== 512) parts.push('-ub ' + s.n_ubatch);

  // Optimization — always emit fa for clarity
  parts.push(s.flash_attn ? '-fa 1' : '-fa 0');
  parts.push('-rtr ' + getRtrMode(s));
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

  // llama-cli: interactive conversation mode
  if (!isServer) {
    parts.push('-i -cnv');
  }

  // Advanced
  if (s.seed !== -1) parts.push('-s ' + s.seed);
  if (s.n_predict !== -1) parts.push('-n ' + s.n_predict);
  if (!s.use_mmap && !isRtrForcedOn(s)) parts.push('--no-mmap');
  if (s.use_mlock) parts.push('--mlock');
  if (s.numa !== 'disabled') parts.push('--numa ' + s.numa);
  if (s.defrag_thold !== -1) parts.push('-dt ' + s.defrag_thold);
  const experimentalArgs = buildExperimentalCliArgs(s);
  for (let i = 0; i < experimentalArgs.length; i += 2) {
    parts.push(`${experimentalArgs[i]} ${experimentalArgs[i + 1]}`);
  }

  const cont = s.shell === 'powershell' ? ' `' : ' \\';
  const sep = '\n  ';
  // Join: first part alone, rest indented
  let cmd;
  if (parts.length <= 3) {
    cmd = parts.join(' ');
  } else {
    cmd = parts[0] + cont + sep + parts.slice(1).join(cont + sep);
  }

  const envPrefix = renderEnvPrefix(buildEnvOverrides(s), s.shell);
  if (envPrefix) {
    cmd = envPrefix + cmd;
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
  const presets = window.IKLLamaEvidenceLayer?.listStandardPresets?.(currentLang) || [];
  sel.innerHTML = '<option value="">-- ' + (currentLang === 'ru' ? 'Пресет' : 'Preset') + ' --</option>';
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
  const contextLen = modelInfo.context_length || 0;
  const family = detectModelFamily({ ...state, model_type: isMoE ? 'moe' : 'dense' }, modelInfo);
  const evidenceCtx = {
    state: { ...state, model_type: isMoE ? 'moe' : 'dense' },
    meta: modelInfo,
    family,
    modelPath: state.model || '',
    modelType: isMoE ? 'moe' : 'dense',
    workload: 'mixed',
    isSwapBound
  };
  const runtimeProfile = window.IKLLamaEvidenceLayer?.resolveRuntimeProfile?.(
    evidenceCtx,
    currentLang,
    { detectModelFamily, isSwapBound }
  ) || {
    id: 'fallback',
    defaults: {
      workload_profile: 'mixed',
      flash_attn: true,
      merge_up_gate_exps: false,
      cache_type_k: 'q8_0',
      cache_type_v: isSwapBound ? 'q8_0' : 'f16',
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
      ru: currentLang === 'ru' ? entry.text : entry.text,
      en: currentLang === 'en' ? entry.text : entry.text,
    });
  });

  // --- Runtime Repack ---
  const rtrGuidance = window.IKLLamaEvidenceLayer?.getAutoConfigRtrGuidance?.(
    evidenceCtx,
    currentLang,
    { detectModelFamily, isSwapBound }
  );
  params.repack_tensors = rtrGuidance?.mode || (isMoE ? 'auto' : (isSwapBound ? 'off' : 'on'));
  (rtrGuidance?.reasons || []).forEach((entry) => {
    reasons.push({
      param: 'repack_tensors',
      value: entry.value,
      ru: currentLang === 'ru' ? entry.text : entry.text,
      en: currentLang === 'en' ? entry.text : entry.text,
    });
  });

  // --- KV Cache context override for huge/long context ---
  if (contextLen > 65536 && params.cache_type_v !== 'q8_0') {
    params.cache_type_v = 'q8_0';
    reasons.push({
      param: 'cache_type_v', value: 'q8_0',
      ru: 'ctv q8_0: очень длинный контекст — дополнительно ужимаем V-cache поверх baseline.',
      en: 'ctv q8_0: very long context — tighten the V-cache further on top of the baseline.'
    });
  }

  // --- SER for swap-bound MoE ---
  if (isMoE && isSwapBound && expertUsed >= 4) {
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
    params.use_mmap = false; // only forced by explicit ON
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

  const hotGuidance = window.IKLLamaEvidenceLayer?.getHotExpertGuidance?.(
    evidenceCtx,
    currentLang,
    { detectModelFamily, isSwapBound }
  );
  (hotGuidance?.reasons || []).forEach((entry) => {
    reasons.push({
      param: 'hot_expert_budget',
      value: entry.value,
      ru: currentLang === 'ru' ? entry.text : entry.text,
      en: currentLang === 'en' ? entry.text : entry.text,
    });
  });

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
  const env = buildEnvOverrides();
  const isCli = state.target === 'llama-cli';
  try {
    const result = await apiPost('/api/launch', { args, env, terminal: isCli });
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
  const s = state;
  const isServer = s.target === 'llama-server';
  const args = [s.target];

  if (s.model) args.push('-m', s.model);

  if (s.threads > 0) { args.push('-t', '' + s.threads); }
  if (s.threads_batch !== -1) { args.push('-tb', '' + s.threads_batch); }
  if (s.n_ctx !== 0) { args.push('-c', '' + s.n_ctx); }
  if (s.n_batch !== 2048) { args.push('-b', '' + s.n_batch); }
  if (s.n_ubatch !== 512) { args.push('-ub', '' + s.n_ubatch); }

  args.push('-fa', s.flash_attn ? '1' : '0');
  args.push('-rtr', getRtrMode(s));
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

  if (isServer) {
    // Server mode: include server-specific settings
    args.push('--host', s.hostname || '127.0.0.1');
    args.push('--port', '' + (s.port || 8080));
    if (s.n_parallel !== 1) { args.push('-np', '' + s.n_parallel); }
    if (s.api_key) { args.push('--api-key', s.api_key); }
    if (s.n_threads_http !== -1) { args.push('--threads-http', '' + s.n_threads_http); }
  } else {
    // CLI mode: interactive conversation
    args.push('-i', '-cnv');
  }

  if (s.seed !== -1) { args.push('-s', '' + s.seed); }
  if (s.n_predict !== -1) { args.push('-n', '' + s.n_predict); }
  if (!s.use_mmap && !isRtrForcedOn(s)) args.push('--no-mmap');
  if (s.use_mlock) args.push('--mlock');
  if (s.numa !== 'disabled') { args.push('--numa', s.numa); }
  if (s.defrag_thold !== -1) { args.push('-dt', '' + s.defrag_thold); }
  args.push(...buildExperimentalCliArgs(s));

  return args;
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
<div class="tip">Что меняет: путь attention начинает тратить меньше памяти и делать меньше лишних проходов по данным. Где помогает: prompt и mixed path, длинный контекст, MoE на Zen4. Где может навредить: обычно нигде, кроме редкой диагностики backend-specific проблем. Когда трогать: почти никогда — держите ON.</div>
<div class="see-also">См. также: <span>-ctk</span> (тип KV-кеша), <span>-c</span> (контекст)</div>`,
    en: `<h4>Flash Attention (-fa)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Attention is the core LLM mechanism: the model "looks at" all previous tokens to decide what to say next. Flash Attention is an optimized version — faster and uses less memory. Always enable it.</div>
<p>Optimized attention mechanism using tiled algorithm:</p>
<p>• Reduces memory from O(n²) to O(n)</p>
<p>• Faster through better cache utilization</p>
<p>• Enables longer context windows</p>
<div class="tip">What it changes: the attention path uses less memory and fewer wasteful passes over data. Where it helps: prompt and mixed path, long context, Zen4 MoE. Where it can hurt: usually nowhere except rare backend-specific debugging. When to touch it: almost never — keep it ON.</div>
<div class="see-also">See also: <span>-ctk</span> (KV cache type), <span>-c</span> (context)</div>`,
  },
  repack_tensors: {
    ru: `<h4>Runtime Repack (-rtr)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Repack переставляет веса модели в более удобный для CPU порядок. Это может ускорять вычисления, но меняет поведение загрузки и памяти. Теперь в fork есть три режима: <span class="hl">off</span>, <span class="hl">on</span>, <span class="hl">auto</span>.</div>
<p>Режимы:</p>
<p>• <b>off</b> — не перепаковывать, сохранить обычную mmap-загрузку</p>
<p>• <b>on</b> — форсировать repack во что бы то ни стало</p>
<p>• <b>auto</b> — дать runtime самому решить, стоит ли repack включать</p>
<p><b>Текущий практический вывод:</b> для Qwen3MoE и gpt-oss на Zen4 лучший общий старт — <span class="good">auto</span>. Для MiniMax картина уже разделена: <span class="hl">TG-only</span> тяготеет к <span class="hl">off</span>, а в <span class="hl">mixed path</span> уже есть подтвержденный смысл сравнивать с <span class="good">auto</span>.</p>
<div class="bench">Почему это важно:
• in-RAM модель: repack может помочь CPU locality
• swap-bound модель: принудительный ON может отключить mmap и увеличить working set
• mixed path (prompt+generation) нельзя оценивать только по TG
• этот параметр меняет не математику модели, а runtime-layout весов и поведение памяти</div>
<div class="tip">Простое правило для новичка: <b>MoE на Zen4</b> — начните с <span class="hl">rtr=auto</span>. Если это MiniMax или очень большая swap-bound модель — для <span class="hl">TG-only</span> начните с <span class="hl">off</span>, а для <span class="hl">mixed path</span> обязательно сравните <span class="hl">off</span> и <span class="hl">auto</span>. Трогать <span class="hl">on</span> без отдельного основания обычно не нужно.</div>
<div class="see-also">См. также: <span>-muge</span> (merge экспертов), <span>mmap</span></div>`,
    en: `<h4>Runtime Repack (-rtr)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Repack rearranges model weights into a CPU-friendlier layout. That can speed up compute, but it also changes memory and loading behavior. The fork now has three modes: <span class="hl">off</span>, <span class="hl">on</span>, <span class="hl">auto</span>.</div>
<p>Modes:</p>
<p>• <b>off</b> — no repack, keep normal mmap-style loading</p>
<p>• <b>on</b> — force repack unconditionally</p>
<p>• <b>auto</b> — let the runtime decide whether repack is worth it</p>
<p><b>Current practical takeaway:</b> for Qwen3MoE and gpt-oss on Zen4, the best general starting point is <span class="good">auto</span>. For MiniMax, the picture now splits: <span class="hl">TG-only</span> still leans to <span class="hl">off</span>, while <span class="hl">mixed path</span> now has a confirmed reason to compare against <span class="good">auto</span>.</p>
<div class="bench">Why it matters:
• in-RAM model: repack can help CPU locality
• swap-bound model: forced ON can disable mmap and increase working set
• mixed path (prompt+generation) must not be judged from TG alone
• this knob changes not the model math but the runtime layout of weights and memory behavior</div>
<div class="tip">Simple beginner rule: for <b>MoE on Zen4</b>, start with <span class="hl">rtr=auto</span>. If the model is MiniMax or another huge swap-bound case, start <span class="hl">TG-only</span> with <span class="hl">off</span>, and for <span class="hl">mixed path</span> explicitly compare <span class="hl">off</span> and <span class="hl">auto</span>. Touch <span class="hl">on</span> only if you have a specific reason.</div>
<div class="see-also">See also: <span>-muge</span> (merge experts), <span>mmap</span></div>`,
  },
  merge_up_gate_exps: {
    ru: `<h4>Merge Up+Gate Experts (-muge)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>В MoE-моделях каждый «эксперт» состоит из двух частей (up и gate). Эта опция склеивает их в одну, чтобы CPU мог читать их за один проход. Работает только для MoE моделей. Для больших swap-bound моделей риск деградации высокий.</div>
<p>Объединяет два экспертных тензора (ffn_up_exps и ffn_gate_exps) в один непрерывный тензор. Потенциально лучше утилизирует кеш при последовательном доступе.</p>
<p><b>Только MoE:</b> на dense моделях эффекта нет.</p>
<p><b>Для swap-bound MoE:</b> высокий риск деградации — растут непрерывные выделения и page faults.</p>
<div class="tip">Что меняет: layout expert-тензоров и характер доступа к ним. Где может помочь: отдельные in-RAM MoE A/B. Где может навредить: huge swap-bound MoE из-за больших непрерывных выделений и page faults. Когда трогать: редко, только в целевых тестах.</div>
<div class="see-also">См. также: <span>-rtr</span> (repack), <span>-no-fmoe</span> (fused MoE)</div>`,
    en: `<h4>Merge Up+Gate Experts (-muge)</h4>
<div class="beginner-section"><div class="label">For beginners</div>In MoE models each "expert" consists of two parts (up and gate). This option glues them into one so the CPU reads them in a single pass. Only works for MoE models. For large swap-bound models the regression risk is high.</div>
<p>Merges two expert tensors (ffn_up_exps and ffn_gate_exps) into one contiguous tensor. Potentially better cache utilization for sequential access.</p>
<p><b>MoE only:</b> no effect on dense models.</p>
<p><b>For swap-bound MoE:</b> regression risk is high — larger contiguous allocations and more page-fault pressure.</p>
<div class="tip">What it changes: the layout of expert tensors and the way they are accessed. Where it may help: targeted in-RAM MoE A/B checks. Where it can hurt: huge swap-bound MoE because of larger contiguous allocations and page-fault pressure. When to touch it: rarely, only in targeted tests.</div>
<div class="see-also">See also: <span>-rtr</span> (repack), <span>-no-fmoe</span> (fused MoE)</div>`,
  },
  cache_type_k: {
    ru: `<h4>KV Cache K Type (-ctk)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Когда модель генерирует текст, она запоминает «ключи» и «значения» для каждого предыдущего токена — это KV-кеш. Чем длиннее разговор, тем больше памяти он занимает. Квантизация (q8_0) сжимает эти данные вдвое без потери качества — как ZIP для фотографий без потерь.</div>
<p>Тип квантизации для ключей (K) в KV-кеше. KV-кеш хранит промежуточные данные внимания для всех обработанных токенов.</p>
<div class="bench">Сравнение типов:
• f16:   базовый, 2 байта/элемент
• <span class="good">q8_0:  1 байт/элемент — 50% экономии, текущий безопасный baseline</span>
• q4_0:  0.5 байт/элемент — 75% экономии, минимальные потери
• f32:   4 байта — перерасход, не рекомендуется</div>
<div class="tip"><b>q8_0 — текущий лучший baseline.</b> Что меняет этот параметр: размер и точность KV-кеша. Где помогает: длинный контекст и нехватка RAM. Где может навредить: слишком агрессивные режимы вроде q4_0 могут ухудшать качество на длинных сессиях. Когда трогать: когда реальный bottleneck — память или контекст, а не просто «хочется покрутить цифры».</div>
<div class="see-also">См. также: <span>-ctv</span> (тип V-кеша), <span>-khad</span> (Hadamard), <span>-c</span> (контекст)</div>`,
    en: `<h4>KV Cache K Type (-ctk)</h4>
<div class="beginner-section"><div class="label">For beginners</div>As the model generates text, it memorizes "keys" and "values" for each previous token — that's the KV cache. The longer the conversation, the more memory it uses. Quantization (q8_0) compresses this data by half with no quality loss — like lossless ZIP for photos.</div>
<p>Quantization type for keys (K) in KV cache. KV cache stores intermediate attention data for all processed tokens.</p>
<div class="bench">Type comparison:
• f16:   baseline, 2 bytes/element
• <span class="good">q8_0:  1 byte/element — 50% savings, current safe baseline</span>
• q4_0:  0.5 bytes/element — 75% savings, minimal loss
• f32:   4 bytes — wasteful, not recommended</div>
<div class="tip"><b>q8_0 is the current best baseline.</b> What this changes: the size and precision of the KV cache. Where it helps: long context and RAM pressure. Where it can hurt: very aggressive modes such as q4_0 may reduce quality on long sessions. When to touch it: when memory or context length is the real bottleneck, not just because the number looks smaller.</div>
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
<div class="tip">Что меняет: объем и точность V-части KV-кеша. Где помогает: очень длинный контекст и дефицит RAM. Где может навредить: слишком агрессивное сжатие может снижать устойчивость long-context reasoning. Когда трогать: если реально боретесь за память, а не просто хотите «самую агрессивную» настройку.</div>
<div class="see-also">См. также: <span>-ctk</span> (тип K-кеша), <span>-c</span> (контекст)</div>`,
    en: `<h4>KV Cache V Type (-ctv)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Same as -ctk but for "values" (V). V-cache is less sensitive to compression, so you can quantize it more aggressively (q4_0), especially if you need a huge context window.</div>
<p>Quantization type for values (V) in KV cache. V-part is less sensitive to precision loss than K-part.</p>
<div class="bench">Recommendations:
• f16:   baseline — maximum quality
• q8_0:  <span class="good">safe choice</span> — 50% savings
• q4_0:  75% savings — for maximum context
• For swap-bound: q8_0 (save RAM for weights)</div>
<div class="tip">What this changes: the size and precision of the V-side of KV cache. Where it helps: very long context and RAM pressure. Where it can hurt: overly aggressive compression may reduce long-context stability. When to touch it: when you are genuinely fighting for memory, not just chasing the most aggressive setting.</div>
<div class="see-also">See also: <span>-ctk</span> (K-cache type), <span>-c</span> (context)</div>`,
  },
  ser: {
    ru: `<h4>Smart Expert Reduction (-ser)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>В MoE-моделях на каждый токен «голосуют» эксперты, и обычно берут 8 самых популярных. Но иногда 2-3 из них почти не нужны (их «голос» очень слабый). SER отсеивает таких слабых экспертов, экономя время на их загрузку с диска. Это как не приглашать на совещание тех, кому нечего сказать.</div>
<p>В MoE моделях роутер выбирает top-K экспертов на каждый токен (напр. 8 из 256). SER позволяет отбрасывать экспертов с низким весом:</p>
<p>• <b>min_experts</b> — минимум экспертов (гарантия). Напр. 4</p>
<p>• <b>threshold</b> — порог веса. Эксперт с весом < threshold отбрасывается. Напр. 0.05</p>
<div class="bench">Идея на примере MiniMax-M2.5 (256 экспертов, 8 активных):
• Без SER: роутер всегда тащит полный top-K
• С SER: часть слабых экспертов может быть отброшена
• Это потенциально уменьшает swap I/O, но эффект и цена по качеству пока нужно проверять отдельно</div>
<div class="tip">Что меняет: runtime начинает пропускать часть слабых experts вместо полного top-K. Где помогает: huge swap-bound MoE, где дорог не compute, а доступ к expert weights. Где может навредить: качество и устойчивость reasoning. Когда трогать: только как controlled A/B, не как «включу на всякий случай».</div>
<div class="see-also">См. также: <span>тип модели</span> (Dense vs MoE)</div>`,
    en: `<h4>Smart Expert Reduction (-ser)</h4>
<div class="beginner-section"><div class="label">For beginners</div>In MoE models, experts "vote" on each token and usually the top 8 are selected. But sometimes 2-3 of them barely contribute (very low "vote"). SER filters out these weak experts, saving time loading them from disk. It's like not inviting people who have nothing to say to a meeting.</div>
<p>In MoE models the router picks top-K experts per token (e.g. 8 of 256). SER drops low-weight experts:</p>
<p>• <b>min_experts</b> — minimum guaranteed experts. E.g. 4</p>
<p>• <b>threshold</b> — weight threshold. Expert with weight < threshold is dropped. E.g. 0.05</p>
<div class="bench">Idea using MiniMax-M2.5 (256 experts, 8 active) as an example:
• Without SER: the router always keeps the full top-K
• With SER: some weak experts may be dropped
• That can reduce swap I/O, but both the speed effect and the quality cost still need separate validation</div>
<div class="tip">What this changes: runtime begins skipping some weak experts instead of always keeping the full top-K. Where it helps: huge swap-bound MoE where expert-weight access is the real cost. Where it can hurt: quality and reasoning stability. When to touch it: only as a controlled A/B, not as a casual “maybe faster” switch.</div>
<div class="see-also">See also: <span>model type</span> (Dense vs MoE)</div>`,
  },
  hot_expert_budget: {
    ru: `<h4>Hot Expert Budget (--experimental hot-expert-budget=N)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>У huge MoE вроде MiniMax не все эксперты одинаково полезны сразу после промта. Fork может запомнить «горячих» экспертов из prompt-фазы и попытаться держать их в памяти для первых decode-токенов. Этот параметр задаёт, сколько таких экспертов разрешено держать в hot-наборе.</div>
<p><b>0</b> = оставить runtime default.</p>
<p><b>N &gt; 0</b> = попросить runtime держать до N «горячих» экспертов.</p>
<div class="bench">Что это значит practically:
• слишком маленький budget — полезные эксперты не помещаются в hot-набор
• слишком большой budget — растёт давление на RAM без гарантии выигрыша
• короткий quick check когда-то подсветил большие бюджеты, но первый более длинный controlled MiniMax run не оправдал новый default выше legacy 16</div>
<div class="tip">Что меняет: сколько experts runtime пытается держать «теплыми» после prompt. Где помогает: huge swap-bound MoE, если ранний decode переиспользует узкий hot set. Где может навредить: лишнее давление на RAM и удержание неправильных experts. Когда трогать: в первую очередь для MiniMax-класса и только как controlled test.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-budget=16</span></div>
<div class="see-also">См. также: <span>-rtr</span> (runtime repack), <span>-ser</span> (router pruning), <span>тип модели</span> (Dense vs MoE)</div>`,
    en: `<h4>Hot Expert Budget (--experimental hot-expert-budget=N)</h4>
<div class="beginner-section"><div class="label">For beginners</div>In huge MoE models such as MiniMax, not all experts are equally useful right after the prompt. The fork can remember "hot" experts from the prompt phase and try to keep them resident for the first decode tokens. This parameter sets how many experts are allowed in that hot set.</div>
<p><b>0</b> = keep the runtime default.</p>
<p><b>N &gt; 0</b> = ask the runtime to keep up to N "hot" experts.</p>
<div class="bench">What this means in practice:
• too small a budget — useful experts do not fit into the hot set
• too large a budget — RAM pressure increases without a guaranteed win
• a short quick check once highlighted larger budgets, but the first longer controlled MiniMax run did not justify a new default above the legacy 16 budget</div>
<div class="tip">What this changes: how many experts runtime tries to keep “warm” after the prompt. Where it helps: huge swap-bound MoE if early decode reuses a narrow hot set. Where it can hurt: extra RAM pressure and retention of the wrong experts. When to touch it: mainly for MiniMax-class tests and only as a controlled experiment.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-budget=16</span></div>
<div class="see-also">See also: <span>-rtr</span> (runtime repack), <span>-ser</span> (router pruning), <span>model type</span> (Dense vs MoE)</div>`,
  },
  hot_expert_budget_mult: {
    ru: `<h4>Hot Expert Budget Mult (--experimental hot-expert-budget-mult=M)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Это не фиксированное число hot experts, а множитель поверх внутреннего baseline runtime. Он не меняет модель и не меняет router. Он только говорит runtime: делай hot-набор более агрессивным, чем обычно.</div>
<p><b>0</b> = не задавать множитель, оставить runtime baseline.</p>
<p><b>M &gt; 0</b> = увеличить hot-набор относительно внутренней политики модели.</p>
<div class="bench">Практический смысл:
• fixed budget = грубый фиксированный лимит
• budget mult = более мягкая регулировка поверх baseline runtime
• это может быть полезнее, когда модели не нужен один и тот же hot limit на всех prompts</div>
<div class="tip">Что меняет: агрессивность роста hot-набора в runtime. Где помогает: MoE locality A/B, когда fixed budget слишком груб. Где может навредить: лишнее удержание experts и рост RAM pressure. Когда трогать: только в controlled tests после baseline.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-budget-mult=1.5</span></div>
<div class="see-also">См. также: <span>Hot Expert Budget</span>, <span>Hot Expert Selection</span>, <span>Tail Window</span></div>`,
    en: `<h4>Hot Expert Budget Mult (--experimental hot-expert-budget-mult=M)</h4>
<div class="beginner-section"><div class="label">For beginners</div>This is not a fixed number of hot experts. It is a multiplier on top of the internal runtime baseline. It does not change the model and does not change the router. It only tells runtime to make the hot set more aggressive than usual.</div>
<p><b>0</b> = do not set a multiplier, keep the runtime baseline.</p>
<p><b>M &gt; 0</b> = enlarge the hot set relative to the model's internal policy.</p>
<div class="bench">Practical meaning:
• fixed budget = a coarse hard limit
• budget mult = a softer scaling over the runtime baseline
• this can be more useful when the model does not want the same hot limit on every prompt</div>
<div class="tip">What this changes: how aggressively runtime grows the hot set. Where it helps: MoE locality A/B when a fixed budget is too crude. Where it can hurt: retaining too many experts and increasing RAM pressure. When to touch it: only in controlled tests after a baseline.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-budget-mult=1.5</span></div>
<div class="see-also">See also: <span>Hot Expert Budget</span>, <span>Hot Expert Selection</span>, <span>Tail Window</span></div>`,
  },
  hot_expert_selection: {
    ru: `<h4>Hot Expert Selection (--experimental hot-expert-selection=...)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>После prompt fork может запомнить «горячих» экспертов и попытаться держать их ближе к памяти для первых decode-токенов. Этот параметр задаёт, по какой части prompt выбирать таких экспертов.</div>
<p><b>default</b> — не задавать env, оставить текущий runtime baseline.</p>
<p><b>full-prompt</b> — считать hot experts по всему prompt.</p>
<p><b>tail-window</b> — смотреть только на хвост prompt. Идея: последние токены prompt иногда лучше предсказывают ранний decode, чем весь prompt целиком.</p>
<div class="bench">Практический смысл:
• full-prompt — более общий и консервативный выбор
• tail-window — более локальный прогноз для первых decode-шагов
• это не меняет веса модели и не «переучивает» router
• меняется именно runtime-логика: какие experts fork считает приоритетными для раннего decode
• то есть вы меняете не саму модель, а способ использовать prompt как прогноз для ближайших токенов ответа</div>
<div class="tip">Сейчас это имеет смысл прежде всего для huge MiniMax. Для обычного запуска других MoE-моделей не включайте это без отдельного A/B.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-selection=tail-window</span></div>
<div class="see-also">См. также: <span>Hot Expert Budget</span>, <span>Tail Window</span>, <span>-rtr</span></div>`,
    en: `<h4>Hot Expert Selection (--experimental hot-expert-selection=...)</h4>
<div class="beginner-section"><div class="label">For beginners</div>After the prompt, the fork can remember “hot” experts and try to keep them closer to memory for the first decode tokens. This setting controls which part of the prompt is used to choose those experts.</div>
<p><b>default</b> — do not set the env, keep the current runtime baseline.</p>
<p><b>full-prompt</b> — choose hot experts from the whole prompt.</p>
<p><b>tail-window</b> — look only at the end of the prompt. The idea is that the last prompt tokens may predict early decode better than the whole prompt.</p>
<div class="bench">Practical meaning:
• full-prompt — more general and conservative selection
• tail-window — more local prediction for the first decode steps
• this does not change model weights and does not “retrain” the router
• it changes the runtime logic: which experts the fork treats as priority candidates for early decode
• in other words, you are not changing the model itself; you are changing how prompt information is used as a predictor for the first answer tokens</div>
<div class="tip">Right now this mainly makes sense for huge MiniMax. Do not enable it for other MoE families without a separate A/B check.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-selection=tail-window</span></div>
<div class="see-also">See also: <span>Hot Expert Budget</span>, <span>Tail Window</span>, <span>-rtr</span></div>`,
  },
  hot_expert_tail_window: {
    ru: `<h4>Tail Window (--experimental hot-expert-tail-window=N)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Если выбор hot experts идет по хвосту prompt, нужно указать размер этого хвоста. Например, 16 означает: смотреть только на последние 16 токенов prompt.</div>
<p><b>Малое окно</b> — агрессивный локальный прогноз. Лучше ловит совсем ранний decode, но может пропустить более широкий контекст.</p>
<p><b>Большое окно</b> — ближе к поведению full-prompt, но эффект locality может стать слабее.</p>
<div class="bench">Текущий рабочий research-кандидат для MiniMax mixed-path: <span class="hl">16</span>. Это не validated default, а лишь первый promising A/B-результат.
<br>Интуитивно: вместо вопроса «какие experts были важны для всего prompt?» runtime задаёт более узкий вопрос: «какие experts были важны для самого конца prompt, из которого сейчас начнётся ответ?»</div>
<div class="tip">Используйте только вместе с Hot Expert Selection = tail-window. Если вы не тестируете MoE locality специально, оставьте как есть.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-selection=tail-window --experimental hot-expert-tail-window=16</span></div>
<div class="see-also">См. также: <span>Hot Expert Selection</span>, <span>Hot Expert Budget</span></div>`,
    en: `<h4>Tail Window (--experimental hot-expert-tail-window=N)</h4>
<div class="beginner-section"><div class="label">For beginners</div>If hot experts are chosen from the prompt tail, you must specify how large that tail is. For example, 16 means: look only at the last 16 prompt tokens.</div>
<p><b>Small window</b> — aggressive local prediction. Better for very early decode, but may miss wider context.</p>
<p><b>Large window</b> — closer to full-prompt behavior, but the locality effect may become weaker.</p>
<div class="bench">Current working research candidate for MiniMax mixed-path: <span class="hl">16</span>. This is not a validated default, only the first promising A/B result.
<br>Intuitively: instead of asking “which experts mattered for the whole prompt?”, runtime asks the narrower question “which experts mattered for the very end of the prompt, where the answer is about to begin?”</div>
<div class="tip">Use this only together with Hot Expert Selection = tail-window. If you are not testing MoE locality on purpose, leave it alone.</div>
<div class="tip">CLI example: <span class="hl">--experimental hot-expert-selection=tail-window --experimental hot-expert-tail-window=16</span></div>
    <div class="see-also">See also: <span>Hot Expert Selection</span>, <span>Hot Expert Budget</span></div>`,
  },
  experimental_preset: {
    ru: `<h4>Экспериментальный пресет</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Это не «волшебная оптимизация», а готовый набор исследовательских ручек под конкретную гипотезу. Пресет помогает быстро повторить известный A/B-сценарий, не вспоминая все env-переменные вручную.</div>
<p><b>MiniMax mixed locality</b> — включает locality-идею для huge MiniMax: tail-window selection для hot experts.</p>
<p><b>Qwen prompt-packed</b> — включает Prompt Packed QKV с профилем, который по текущим данным лучше подходит Qwen.</p>
<p><b>gpt-oss prompt-packed</b> — тот же класс эксперимента, но с профилем под gpt-oss.</p>
<p><b>Attention merge-qkv</b> — мягкий attention-side эксперимент с Merge QKV.</p>
<div class="tip">Пресет не делает гипотезу validated. Он только быстро выставляет исследовательские параметры в воспроизводимое состояние.</div>
<div class="see-also">См. также: <span>Связывать пресет с проверенными настройками</span>, <span>Prompt Packed QKV</span>, <span>Hot Expert Selection</span></div>`,
    en: `<h4>Experimental preset</h4>
<div class="beginner-section"><div class="label">For beginners</div>This is not a “magic optimization”. It is a ready-made bundle of research knobs for a specific hypothesis. A preset helps you reproduce a known A/B scenario without remembering every env variable by hand.</div>
<p><b>MiniMax mixed locality</b> — enables the locality idea for huge MiniMax: tail-window hot-expert selection.</p>
<p><b>Qwen prompt-packed</b> — enables Prompt Packed QKV with the profile that currently fits Qwen best.</p>
<p><b>gpt-oss prompt-packed</b> — the same class of experiment, but with a profile tuned for gpt-oss.</p>
<p><b>Attention merge-qkv</b> — a mild attention-side experiment using Merge QKV.</p>
<div class="tip">A preset does not make a hypothesis validated. It only puts research knobs into a reproducible starting state.</div>
<div class="see-also">See also: <span>Link preset to validated settings</span>, <span>Prompt Packed QKV</span>, <span>Hot Expert Selection</span></div>`,
  },
  experimental_preset_link_validated: {
    ru: `<h4>Связывать пресет с проверенными настройками</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Некоторые исследовательские идеи имеют смысл только рядом с определённым baseline. Например, prompt-path эксперимент почти всегда стоит проверять с включённым Flash Attention, а MiniMax locality bundle — не вместе с muge=ON.</div>
<p><b>ON</b> — пресет может также подправить проверенные параметры, если без этого bundle становится нерепрезентативным.</p>
<p><b>OFF</b> — меняются только экспериментальные ручки, а validated слой остаётся как есть.</p>
<div class="tip">Если хотите чисто проверить одну гипотезу поверх собственного baseline — выключите связку. Если хотите быстро повторить задуманный автором bundle — оставьте ON.</div>`,
    en: `<h4>Link preset to validated settings</h4>
<div class="beginner-section"><div class="label">For beginners</div>Some research ideas only make sense next to a specific baseline. For example, a prompt-path experiment is usually tested with Flash Attention enabled, and the MiniMax locality bundle is not meant to be mixed with muge=ON.</div>
<p><b>ON</b> — the preset may also adjust validated knobs if the bundle would otherwise become misleading.</p>
<p><b>OFF</b> — only experimental knobs change, while the validated layer stays untouched.</p>
<div class="tip">If you want to test one hypothesis strictly on top of your own baseline, disable the link. If you want to reproduce the intended bundle quickly, keep it ON.</div>`,
  },
  prompt_packed_qkv: {
    ru: `<h4>Prompt Packed QKV (--experimental prompt-packed-qkv=on)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Некоторые модели хранят Q, K и V раздельно. Этот исследовательский путь пытается в prompt-фазе упаковать их в более удобный для CPU формат, чтобы attention работал с лучшей локальностью данных.</div>
<p>Это влияет только на prompt-подобные батчи. Decode baseline не переписывается целиком.</p>
<div class="bench">Практический смысл:
• может ускорять prompt-часть
• эффект на полный mixed path обычно меньше
• иногда стоит дополнительной RAM и времени загрузки</div>
<div class="tip">Что меняет: только prompt-path layout, а не всю модель. Где помогает: prompt-heavy и mixed-path A/B на split-QKV семьях. Где может навредить: RAM, load time и общая простота baseline. Когда трогать: manual experiments на compatible split-QKV моделях; auto-policy и validation сейчас лучше всего развиты на Qwen3MoE / gpt-oss.</div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-qkv=on --experimental prompt-packed-preset=front-half</span></div>
<div class="see-also">См. также: <span>Preset Prompt Packed</span>, <span>Диапазон Prompt Packed</span>, <span>Flash Attention</span></div>`,
    en: `<h4>Prompt Packed QKV (--experimental prompt-packed-qkv=on)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Some models keep Q, K, and V projections split. This research path tries to pack them into a more CPU-friendly layout during the prompt phase so attention can run with better data locality.</div>
<p>This affects only prompt-like batches. The normal decode baseline is not fully rewritten.</p>
<div class="bench">Practical meaning:
• can improve the prompt side
• the effect on full mixed path is usually smaller
• may cost extra RAM and load time</div>
<div class="tip">What this changes: only the prompt-path layout, not the whole model. Where it helps: prompt-heavy and mixed-path A/B on split-QKV families. Where it can hurt: RAM, load time, and baseline simplicity. When to touch it: manual experiments on compatible split-QKV models; auto-policy and validation are currently best developed on Qwen3MoE / gpt-oss.</div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-qkv=on --experimental prompt-packed-preset=front-half</span></div>
<div class="see-also">See also: <span>Prompt Packed preset</span>, <span>Prompt Packed range</span>, <span>Flash Attention</span></div>`,
  },
  prompt_packed_qkv_preset: {
    ru: `<h4>Preset Prompt Packed (--experimental prompt-packed-preset=...)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Prompt Packed можно применять не ко всем слоям, а только к части. Preset — это готовый диапазон слоёв, который уже показал хоть какой-то смысл на конкретной семье моделей.</div>
<p><b>auto</b> — доверить fork выбрать известный family-aware вариант.</p>
<p><b>front-half</b> — ранняя половина слоёв; сейчас это больше похоже на Qwen-сценарий.</p>
<p><b>back-half</b> — поздняя половина слоёв; сейчас это больше похоже на gpt-oss-сценарий.</p>
<p><b>full</b> — все слои; как правило, это самый тяжёлый и наименее безопасный вариант.</p>
<div class="tip">Если нет сильной причины, не начинайте с full.</div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-preset=back-half</span></div>`,
    en: `<h4>Prompt Packed preset (--experimental prompt-packed-preset=...)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Prompt Packed does not have to cover all layers. A preset is a ready-made layer range that already showed at least some meaning on a specific model family.</div>
<p><b>auto</b> — let the fork choose a known family-aware variant.</p>
<p><b>front-half</b> — early half of the layers; currently closer to the Qwen case.</p>
<p><b>back-half</b> — late half of the layers; currently closer to the gpt-oss case.</p>
<p><b>full</b> — all layers; usually the heaviest and least safe option.</p>
<div class="tip">Without a strong reason, do not start from full.</div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-preset=back-half</span></div>`,
  },
  prompt_packed_qkv_range: {
    ru: `<h4>Диапазон Prompt Packed (--experimental prompt-packed-range=start:end)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Это ручной override поверх preset. Вы явно говорите fork: “используй Prompt Packed только на слоях от start до end”.</div>
<p>Формат: <span class="hl">start:end</span>, например <span class="hl">0:24</span> или <span class="hl">12:24</span>.</p>
<p>Если диапазон задан, он важнее preset.</p>
<div class="tip">Это уже advanced A/B. Если не понимаете, зачем вам явный range, оставьте поле пустым и используйте preset.</div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-range=0:24</span></div>`,
    en: `<h4>Prompt Packed range (--experimental prompt-packed-range=start:end)</h4>
<div class="beginner-section"><div class="label">For beginners</div>This is a manual override on top of the preset. You explicitly tell the fork: “use Prompt Packed only on layers from start to end”.</div>
<p>Format: <span class="hl">start:end</span>, for example <span class="hl">0:24</span> or <span class="hl">12:24</span>.</p>
<p>If the range is set, it overrides the preset.</p>
<div class="tip">This is already advanced A/B territory. If you do not know why you need an explicit range, leave it empty and use a preset.</div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-range=0:24</span></div>`,
  },
  model_size_gb: {
    ru: `<h4>Размер модели</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Это общий размер файлов модели на диске. Главное правило: если модель больше ~90% вашей RAM — она «swap-bound» (не помещается в память, и системе приходится постоянно подгружать данные с SSD). Это кардинально меняет оптимальные настройки.</div>
<p>Суммарный размер GGUF-файлов модели. Для split-моделей (например MiniMax 5 частей) суммируются все части автоматически.</p>
<p><b>Swap-bound порог:</b> модель > 90% от RAM вашего профиля.</p>
<div class="bench">Пример: 96 ГБ RAM, порог = 86 ГБ
• Qwen3-30B Q4_K_M (17 ГБ): <span class="good">in-RAM</span> — обычно rtr AUTO
• MiniMax-M2.5 Q5_K (151 ГБ): <span class="bad">swap-bound</span> — TG-only чаще стартует с rtr OFF, но mixed path уже стоит сравнивать с AUTO; muge OFF
• Для MiniMax-класса на этом хосте throughput часто оказывается около ~1 t/s, но это сильно зависит от memory state и не должно подаваться как жёсткий потолок</div>`,
    en: `<h4>Model Size</h4>
<div class="beginner-section"><div class="label">For beginners</div>This is the total size of model files on disk. Key rule: if the model is larger than ~90% of your RAM — it's "swap-bound" (doesn't fit in memory, so the system constantly loads data from SSD). This fundamentally changes optimal settings.</div>
<p>Total size of GGUF model files. For split models (e.g. MiniMax 5 parts) all parts are summed automatically.</p>
<p><b>Swap-bound threshold:</b> model > 90% of your profile's RAM.</p>
<div class="bench">Example: 96 GB RAM, threshold = 86 GB
• Qwen3-30B Q4_K_M (17 GB): <span class="good">in-RAM</span> — usually rtr AUTO
• MiniMax-M2.5 Q5_K (151 GB): <span class="bad">swap-bound</span> — TG-only usually starts from rtr OFF, but mixed path is now worth comparing against AUTO; muge OFF
• For MiniMax-class runs on this host throughput often lands around ~1 t/s, but this is strongly memory-state dependent and should not be treated as a hard ceiling</div>`,
  },
  model_type: {
    ru: `<h4>Тип модели: Dense vs MoE</h4>
<div class="beginner-section"><div class="label">Для новичков</div><b>Dense</b> — обычная модель, где все веса работают на каждый токен. Как один большой мозг.<br><b>MoE</b> (Mixture of Experts) — модель из множества «экспертов-специалистов». На каждый токен работают только несколько (напр. 8 из 256). Модель огромная, но реально работает малая часть — поэтому быстрая при том же качестве.</div>
<p><b>Dense</b> (Llama, Phi, Gemma): все параметры активны на каждый токен. Производительность зависит от bandwidth.</p>
<p><b>MoE</b> (MiniMax, DeepSeek, Qwen3-MoE): на каждый токен активируется только K экспертов из N. Например, MiniMax: 8 из 256.</p>
<div class="bench">Что это значит для параметров:
• MoE: режим -rtr и опция -muge критичны для swap-bound
• MoE: -ser может уменьшить число активных экспертов
• MoE: >16 потоков вредит из-за контенции
• Dense: -muge и -ser не имеют эффекта</div>
<div class="tip">Автоматически определяется из GGUF метаданных кнопкой "Авто-конфигурация".</div>`,
    en: `<h4>Model Type: Dense vs MoE</h4>
<div class="beginner-section"><div class="label">For beginners</div><b>Dense</b> — a regular model where all weights work for every token. Like one big brain.<br><b>MoE</b> (Mixture of Experts) — a model made of many "specialist experts". Only a few work per token (e.g. 8 of 256). The model is huge, but only a small part actually runs — so it's fast while maintaining quality.</div>
<p><b>Dense</b> (Llama, Phi, Gemma): all parameters active for every token. Performance depends on bandwidth.</p>
<p><b>MoE</b> (MiniMax, DeepSeek, Qwen3-MoE): only K of N experts activated per token. E.g. MiniMax: 8 of 256.</p>
<div class="bench">What this means for parameters:
• MoE: the -rtr mode and -muge are critical for swap-bound
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
<div class="tip">Что меняет: layout attention-тензоров и число memory passes в attention path. Где помогает: attention-heavy модели и prompt-side locality tests. Где может навредить: path model-sensitive, выигрыш не универсален. Когда трогать: как мягкий attention-side эксперимент, а не как baseline для всех моделей.</div>
<div class="see-also">См. также: <span>-fa</span> (Flash Attention), <span>-ctk</span>/<span>-ctv</span> (KV cache)</div>`,
    en: `<h4>Merge QKV (-mqkv)</h4>
<div class="beginner-section"><div class="label">For beginners</div>The attention mechanism uses three matrices: Q (query), K (key), V (value). This option merges them into one so the CPU can load all three in a single memory pass instead of three separate ones.</div>
<p>Merge Q, K, V projections into one contiguous tensor for attention. Improves data locality during attention computation.</p>
<div class="tip">What this changes: the layout of attention tensors and the number of memory passes in the attention path. Where it helps: attention-heavy models and prompt-side locality tests. Where it can hurt: this path is model-sensitive and the win is not universal. When to touch it: as a mild attention-side experiment, not as a baseline for every model.</div>
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
<p><b>Для swap-bound:</b> mmap обычно является правильной базой, потому что OS может подгружать страницы по требованию.</p>
<p><b>При rtr=on:</b> mmap принудительно OFF — repack требует изменения данных в памяти. При <b>rtr=auto</b> итог уже зависит от runtime policy.</p>
<div class="tip">Практическое правило: вручную запрещайте mmap только если вы специально проверяете такой сценарий. Для auto/off обычно разумнее оставить mmap включённым.</div>
<div class="see-also">См. также: <span>-rtr</span> (repack), <span>--mlock</span></div>`,
    en: `<h4>Memory-mapped I/O (mmap)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Instead of loading the entire model file into RAM, mmap "shows" the file to the system as if it were memory. When data is needed — the system loads it from disk automatically. This is the only way to work with models larger than your RAM.</div>
<p>Model is mapped into virtual address space via CreateFileMapping (Windows) / mmap (Linux). OS loads pages from disk on access.</p>
<p><b>For swap-bound:</b> mmap is usually the right baseline because the OS can load pages on demand.</p>
<p><b>With rtr=on:</b> mmap is forced OFF — repack modifies data in memory. With <b>rtr=auto</b> the effective outcome depends on the runtime policy.</p>
<div class="tip">Practical rule: only disable mmap manually if you are explicitly testing that scenario. For auto/off it is usually better to leave mmap enabled.</div>
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
  { term: { ru: 'Data-driven evidence layer', en: 'Data-driven evidence layer' },
    def: {
      ru: 'Отдельный слой данных в dashboard, который хранит не сами настройки модели, а знания о них: для какого класса моделей параметр применим, где runtime его реально поддерживает, где он уже проверен benchmark-ами и насколько высока практическая уверенность. Нужен, чтобы новые выводы добавлялись как данные, а не как новые разрозненные if/else по всему UI.',
      en: 'A dedicated dashboard data layer that stores evidence about model knobs rather than the knobs themselves: which model class a parameter applies to, where runtime really supports it, where it has benchmark validation, and how high the practical confidence is. It exists so that new findings can be added as data instead of new scattered if/else branches across the UI.',
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
  { term: { ru: 'Горячие эксперты (hot experts)', en: 'Hot Experts' },
    def: {
      ru: 'Небольшой набор экспертов MoE, которые были особенно активны на prompt-фазе и которые runtime пытается держать «поближе» к памяти для начала decode. Это полезно прежде всего для huge swap-bound моделей вроде MiniMax. Слишком маленький набор не помогает, слишком большой увеличивает давление на RAM.',
      en: 'A small subset of MoE experts that were especially active during the prompt phase and that the runtime tries to keep "closer" to memory for the beginning of decode. This is mainly useful for huge swap-bound models such as MiniMax. Too small a set does not help, too large a set increases RAM pressure.',
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
      ? (currentLang === 'ru' ? 'Введите сообщение...' : 'Type a message...')
      : (currentLang === 'ru' ? 'Ожидание загрузки модели...' : 'Waiting for model to load...');
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
