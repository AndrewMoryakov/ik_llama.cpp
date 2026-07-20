# Анализ 7 — проекция решений из других веток на ускорение MiniMax

**Дата:** 2026-07-19
**Scope:** решения, найденные в других refs `origin/*` данного форка, наложены
на текущую программу ускорения MiniMax-M2.7 на Ryzen 9 7950X / 96 GB. Источники
и точные refs приведены в [analysis-6](analysis-6-fork-branch-opportunities.md).

## Как читать карту

Это не список «готовых к merge» патчей. Для модели ~110 GB на 96 GB RAM первым
вопросом остаётся реальный bottleneck: ШАГ 0 должен отделить device I/O, page
cache, RAM bandwidth и compute. Решение из другой ветки имеет ценность только
тогда, когда покрывает измеренную проблему и может быть перенесено изолированно.

Обозначения: **готово** — уже в текущем дереве; **донор** — есть код в другой
ветке, но нужен выборочный port; **новая работа** — реализации в `origin/*` нет;
**не подходит** — не надо инвестировать для этого MiniMax-сценария.

## Карта «наша задача → веточная наработка → решение»

| Наша задача / гипотеза | Наработка на сторонних ветках | Статус для текущей ветки | Проекция и решение | Гейт / следующий шаг |
|---|---|---|---|---|
| Доказать, что именно ограничивает decode | Нет готового per-token trace/cache simulator | **Новая работа — уже реализована** в `--moe-trace` и `tools/moe_cache_sim/` | Не переносить чужую статистику вместо trace: aggregate PP-stats не заменяют per-token последовательность | ШАГ 0 → MiniMax trace → cache simulation |
| Найти постоянное горячее подмножество экспертов | Hot Experts: PP stats + static top-N hot set + tail-window/tail-blend (`e8444f2a` и серия) | **Донор** | Полезно как проверяемый static-residency эксперимент: закрепить ограниченный hot budget после PP и проверить hit/locality | Переносить сначала только export stats, затем pinning с жёстким budget; A/B на M2.7 |
| Спрятать fault latency текущего active dispatch | В той же серии `PrefetchVirtualMemory` / `MADV_WILLNEED` для активных экспертов | **Донор, но частичное покрытие** | Может помочь поздним слоям/уже известному dispatch, но не является predictive prefetch и почти не даёт lead time ранним слоям | Рассматривать только после доказанной locality и static-pin A/B; мерить physical I/O и latency |
| Prefetch экспертов следующего токена | Готового previous-token predictor нет | **Новая работа** | Основной production-кандидат: прошлый токен известен до следующего forward pass, запросы выдаются послойно с лимитом inflight bytes | По trace измерить Jaccard и byte recall; затем отдельный bounded prototype |
| Управляемая residency/eviction вместо page cache | Slab cache / predictive selective residency не найдены | **Новая работа** | Наиболее глубокий путь, если OS page cache даёт плохой hit-rate; требует per-expert ranges, ownership, eviction и I/O scheduling | Начинать только если trace/simulator и prefetch A/B подтвердят потенциал |
| Сократить bytes/token через top-k/SER | Исторические SER branches: `smart_expert_selection`, `fix_ser`, `fix_ser_cuda` | **Донор только как историческая справка** | В HEAD `-ser` no-op; простой перенос/раскомментирование недопустим. Сравнивать SER с fixed top-k при равном среднем числе экспертов | Correctness + quality suite + реальный retrace после каждого режима |
| Снизить top-k фиксированно | Runtime override уже есть; ветки fused top-k в основном исторически интегрированы | **Готово для эксперимента** | Самый дешёвый эксперимент 8→7→6; baseline trace — только first-order оценка, после изменения обязателен новый trace | Quality gate, physical I/O, latency и retrace для каждого k |
| Сделать модель mmap-дружественной и не получить OOM | Offline repack / merge-up-gate / R4 исторически развивались в `ik/*` refs | **Готово функционально** | Использовать offline `_R4` и заранее fused gate/up GGUF через уже имеющиеся инструменты; runtime `-rtr` и `-muge` для >RAM нельзя | Собрать artifact, проверить mmap и memory footprint до speed A/B |
| Ускорить CPU TG, когда paging уже не доминирует | `origin/ik/cpu_moe_tg` (`6944e7e6`): fast fused up/gate путь для single-token TG | **Донор, узкий кандидат** | Возможен ручной малый port для CPU-only TG, если threads кратны числу experts. Не уменьшает SSD I/O | Прежде подтвердить compute/RAM-bound phase; отдельный microbenchmark и correctness test |
| Улучшить CPU kernels / R4 / Zen4 | Старые R4/Zen4/AVX2 refs | **В основном готово** | Не переносить старые ветки: relevant paths уже в текущем дереве. AVX-512, threads и affinity — только A/B tuning | Измерить resident/compute phase отдельно от paging |
| Сократить KV pressure | Исторические KV branches; типы `-ctk`/`-ctv` уже есть | **Готово для конфигурационных A/B** | Это не лечит expert paging напрямую, но освобождает RAM для page cache/hot set на длинном context | Benchmark по context length и quality/VRAM-RAM footprint |
| Per-expert tiered quantization | Готового решения нет; текущий layout — монолитные expert tensors | **Новая архитектурная работа** | Нельзя выдать за «готовый перенос»: потребуются banks/remap/graph/kernel или новый layout | Только после sensitivity/quality исследования и оценки размера выигрыша |
| Прунинг экспертов | Готового безопасного pipeline не найдено | **Новая модельная работа** | Потенциально единственный путь надёжно уложить artifact в RAM, но router становится контрфактуальным после вмешательства | Ступени 224→208→192→176, iterative retrace и domain quality gate |
| Grouped routing / CUDA router kernels | Есть исторические ветки, но grouped routing относится к `BAILINGMOE2`; CUDA не соответствует CPU-only цели | **Не подходит** | Не переносить для MiniMax CPU-only; это не улучшит SSD paging | Нет действия |
| SMT/CCD affinity и Windows large pages | Готовой policy нет; Windows mmap large pages отсутствуют | **Новая работа / tuning** | Large pages не считать быстрой победой. SMT/affinity только как измеряемая настройка compute/resident фаз | A/B после ШАГ 0, без смешения с I/O изменениями |

## Поток решений и зависимостей

```text
ШАГ 0: device I/O + RAM BW + latency baseline
                    |
                    v
          MiniMax routing trace + cache simulator
              |                       |
              |                       +--> слабая locality
              |                               -> не портировать Hot Experts;
              |                                  приоритет: top-k/SER/модельный размер
              v
       хорошая static locality / hot set
              |
              +--> [донор] export stats -> static hot-expert pin A/B
              |                                |
              |                                +--> [донор] active-dispatch VM prefetch A/B
              |
              +--> хорошая temporal locality
                       -> [новое] previous-token prefetch prototype
                                      |
                                      +--> недостаточно: [новое] slab cache

Параллельно и без runtime repack: [готово] offline _R4 + fused gate/up + mmap

Если CPU/RAM-bound после устранения I/O:
  [донор] cpu_moe_tg port / [готово] Zen4 tuning / KV configuration A/B

Если нужен качественный скачок размера:
  fixed top-k -> SER -> pruning, и после каждого вмешательства новый real trace.
```

## Очередь работ

### Сейчас — без переноса веток

1. Выполнить ШАГ 0 и сохранить raw samples/ETW cross-check.
2. Создать MiniMax layout + routing trace, прогнать cache simulation.
3. Подготовить offline `_R4` + fused gate/up artifact, загрузить mmap без
   `-rtr`/`-muge`.
4. Снять baseline fixed top-k=8; затем отдельно 7 и 6 с quality/retrace.

### Условно следующий малый port

Если trace подтверждает стабильный hot set, создать
`feature/minimax-hot-experts-port`. Переносить в отдельных коммитах:

1. только CSV/API export stats;
2. только static selection + bounded pinning;
3. только VM-prefetch.

Каждый коммит должен собираться и иметь независимый benchmark. Не переносить
ветку `origin/safety/pre-upstream-merge-2026-05-02` целиком: относительно текущей
ветки это 77 уникальных коммитов донора и 219 уникальных коммитов текущей линии,
включая несвязанные артефакты.

### Что сознательно отложено

- previous-token predictor и slab cache — новый код, запускать после trace;
- SER — отдельное восстановление с quality/correctness gate;
- per-expert tiering и pruning — модельные изменения с retrace;
- `cpu_moe_tg` — только если bottleneck сместился в compute;
- large pages, grouped routing, CUDA-specific paths — не являются прямым решением
  текущего CPU-only paging сценария.

## Критерий выбора следующего патча

Следующий патч выбирается не по величине обещанного процента, а по первому
выполненному условию:

1. **I/O заметен + static locality высока** → Hot Experts port.
2. **I/O заметен + temporal recall высок** → previous-token prefetch.
3. **I/O низок / RAM или compute доминирует** → CPU TG port, Zen4/threads/KV A/B.
4. **Нужна скорость выше достижимой cache/prefetch** → top-k/SER/pruning через
   quality gate и новый trace.

Во всех случаях `--moe-trace` — инструмент измерения, а не benchmark mode;
simulator — инструмент приоритизации, а не прогноз post-intervention скорости.
