(function (global) {
  'use strict';

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
<div class="tip"><b>Критическое:</b> на gpt-oss MXFP4 этот флаг вызывает краш (exit 127). Для gpt-oss никогда не включать.</div>
<div class="see-also">См. также: <span>-rtr</span> (repack), <span>-no-fmoe</span> (fused MoE)</div>`,
    en: `<h4>Merge Up+Gate Experts (-muge)</h4>
<div class="beginner-section"><div class="label">For beginners</div>In MoE models each "expert" consists of two parts (up and gate). This option glues them into one so the CPU reads them in a single pass. Only works for MoE models. For large swap-bound models the regression risk is high.</div>
<p>Merges two expert tensors (ffn_up_exps and ffn_gate_exps) into one contiguous tensor. Potentially better cache utilization for sequential access.</p>
<p><b>MoE only:</b> no effect on dense models.</p>
<p><b>For swap-bound MoE:</b> regression risk is high — larger contiguous allocations and more page-fault pressure.</p>
<div class="tip">What it changes: the layout of expert tensors and the way they are accessed. Where it may help: targeted in-RAM MoE A/B checks. Where it can hurt: huge swap-bound MoE because of larger contiguous allocations and page-fault pressure. When to touch it: rarely, only in targeted tests.</div>
<div class="tip"><b>Critical:</b> on gpt-oss MXFP4 this flag causes a crash (exit 127). Never enable for gpt-oss.</div>
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
<div class="bench">• <span class="good">gpt-oss-120b back-half: +3.45% prompt (pg512,128), 0% decode regression — confirmed, medium confidence</span></div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-qkv=on --experimental prompt-packed-preset=back-half</span></div>
<div class="see-also">См. также: <span>Preset Prompt Packed</span>, <span>Диапазон Prompt Packed</span>, <span>Flash Attention</span></div>`,
    en: `<h4>Prompt Packed QKV (--experimental prompt-packed-qkv=on)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Some models keep Q, K, and V projections split. This research path tries to pack them into a more CPU-friendly layout during the prompt phase so attention can run with better data locality.</div>
<p>This affects only prompt-like batches. The normal decode baseline is not fully rewritten.</p>
<div class="bench">Practical meaning:
• can improve the prompt side
• the effect on full mixed path is usually smaller
• may cost extra RAM and load time</div>
<div class="tip">What this changes: only the prompt-path layout, not the whole model. Where it helps: prompt-heavy and mixed-path A/B on split-QKV families. Where it can hurt: RAM, load time, and baseline simplicity. When to touch it: manual experiments on compatible split-QKV models; auto-policy and validation are currently best developed on Qwen3MoE / gpt-oss.</div>
<div class="bench">• <span class="good">gpt-oss-120b back-half: +3.45% prompt (pg512,128), 0% decode regression — confirmed, medium confidence</span></div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-qkv=on --experimental prompt-packed-preset=back-half</span></div>
<div class="see-also">See also: <span>Prompt Packed preset</span>, <span>Prompt Packed range</span>, <span>Flash Attention</span></div>`,
  },
  prompt_packed_qkv_preset: {
    ru: `<h4>Preset Prompt Packed (--experimental prompt-packed-preset=...)</h4>
<div class="beginner-section"><div class="label">Для новичков</div>Prompt Packed можно применять не ко всем слоям, а только к части. Preset — это готовый диапазон слоёв, который уже показал хоть какой-то смысл на конкретной семье моделей.</div>
<p><b>auto</b> — доверить fork выбрать известный family-aware вариант.</p>
<p><b>front-half</b> — ранняя половина слоёв; сейчас это больше похоже на Qwen-сценарий.</p>
<p><b>back-half</b> — поздняя половина слоёв; подтверждён на gpt-oss-120b (+3.45% prompt, medium confidence).</p>
<p><b>full</b> — все слои; как правило, это самый тяжёлый и наименее безопасный вариант.</p>
<div class="tip">Если нет сильной причины, не начинайте с full.</div>
<div class="tip">CLI example: <span class="hl">--experimental prompt-packed-preset=back-half</span></div>`,
    en: `<h4>Prompt Packed preset (--experimental prompt-packed-preset=...)</h4>
<div class="beginner-section"><div class="label">For beginners</div>Prompt Packed does not have to cover all layers. A preset is a ready-made layer range that already showed at least some meaning on a specific model family.</div>
<p><b>auto</b> — let the fork choose a known family-aware variant.</p>
<p><b>front-half</b> — early half of the layers; currently closer to the Qwen case.</p>
<p><b>back-half</b> — late half of the layers; confirmed on gpt-oss-120b (+3.45% prompt, medium confidence).</p>
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

  global.DashboardHelp = { HELP, GLOSSARY };
})(typeof window !== 'undefined' ? window : this);
