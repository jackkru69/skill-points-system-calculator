# Калькулятор новой системы скиллпойнтов — спецификация

SPA без бэкенда: Vite + React 19 + TypeScript + Tailwind v4 + Zustand (persist в localStorage) + Vitest.
UI на русском. Тёмная тема, компактно, удобно для геймдизайнера (всё на одной странице, мгновенный пересчёт).

## 1. Предметная область

Статы (SPECIAL): `ST` Сила (СЛ), `PE` Восприятие (ВС), `EN` Выносливость (ВН), `CH` Харизма (ХАР), `IN` Интеллект (ИНТ), `AG` Ловкость (ЛВ), `LK` Удача (УД).
Диапазон стата 1..10, пул очков по умолчанию 40 (всё настраивается).

Скиллы (порядок важен, он же порядок по умолчанию для блидинга), база = statA * statB * mult:

| id | Название | База | Получает из (по умолчанию, `bleedLinks`) |
|---|---|---|---|
| smallGuns | Мелкие пушки | PE*AG | mediumGuns, mediumGuns (= 0.5·Средние) |
| mediumGuns | Средние пушки | PE*AG | smallGuns, bigGuns |
| bigGuns | Большие пушки | PE*ST | mediumGuns, throwing |
| throwing | Метательное | ST*AG | bigGuns, melee |
| melee | Холодное | ST*AG | throwing, unarmed |
| unarmed | Рукопашка | ST*EN | melee, sneak |
| sneak | Скрытность | AG*CH | unarmed, steal |
| steal | Воровство | AG*LK | sneak, lockpick |
| lockpick | Взлом | PE*AG | steal, traps |
| traps | Ловушки | PE*LK | lockpick, repair |
| repair | Ремонт | AG*LK | traps, craft |
| craft | Крафт | CH*LK | repair, science |
| science | Наука | PE*LK | craft, doctor |
| doctor | Доктор | PE*LK | science, firstAid |
| firstAid | Санитар | ST*CH | doctor, doctor (= 0.5·Доктор) |
| barter | Торговля | CH*CH*2 | — (не получает и никуда не блидит) |

Правило по умолчанию (режим блида `incoming`): скилл получает из предыдущего и следующего соседа по списку, Торговля исключена; у крайних (Мелкие, Санитар) единственный сосед выбран дважды. Интеллект не участвует в базе.

Контрольный пример из ТЗ / таблицы клиента (ST10 PE5 EN10 CH2 IN2 AG10 LK1): Мелкие 50, Средние 50, Большие 50, Метательное 100, Холодное 100, Рукопашка 100, Скрытность 20, Воровство 10, Взлом 50, Ловушки 5, Ремонт 10, Крафт 2, Наука 5, Доктор 5, Санитар 20, Торговля 8.
Формулы таблицы клиента (Total SP = свои Direct SP + входящий блид): Мелкие = own + 0.5·Средние; Средние = own + 0.25·Мелкие + 0.25·Большие; Санитар = own + 0.5·Доктор; Торговля = own.
96 СП прямо в Рукопашку → Холодное получает 24 bleed, Скрытность 24 bleed.
Пример ТЗ «10 в Большие / 25 в Средние → 16.25 / 27.5» выполняется в режиме `incoming` по умолчанию (Большие ← Средние·0.25, Средние ← Большие·0.25).

Стартовый билд (первый запуск и «Сброс билда»): все статы = 5 (при пуле 40 остаётся 5 свободных очков), без тэгов, уровень 1.

## 2. Формулы (движок, чистые функции)

- `base(skill) = stats[statA] * stats[statB] * mult`.
- `start(skill) = base + (tagged ? tagBonus : 0)` (флэт-бонус тэга, по умолчанию 20).
- `Direct_SP(skill)` = сумма СП, вложенных игроком напрямую (по всем уровням).
- Блид задаётся связями `SkillDef.bleedLinks: [SkillId|null, SkillId|null]` и режимом `config.bleedMode`:
  - `'incoming'` (по умолчанию): links — источники, из которых скилл получает; коэф. — получателя: `Bleed_SP(skill) = Σ по link: Direct_SP(link) * coef(skill)`.
  - `'outgoing'` (семантика ТЗ v1): links — цели, в которые скилл блидит; коэф. — источника: `Bleed_SP(target) = Σ по source: Direct_SP(source) * coef(source)` за каждое вхождение target в `source.bleedLinks`.
  - `coef(skill) = skill.bleedCoef ?? config.bleedCoefDefault (0.25)`. Один и тот же скилл в обоих слотах = двойной блид. Каскада нет: блидится только Direct_SP. Тэг источника на блид не влияет (утекает столько, сколько потрачено).
- `Total_SP = Direct_SP + Bleed_SP` (дробные значения допустимы: 16.25).
- Перевод Total_SP в проценты — по старому принципу: начиная со `start`, каждый пункт скилла стоит `costAt(value) * (tagged ? tagCostMultiplier : 1)` СП, где `costAt(v) = baseCost (1)` при v < thresholds[0].from, иначе cost последнего порога с from <= v. Значение непрерывное (дробное), cap = skillMax (300); СП сверх капа = `overflowSP`. Для отображения значение округляется вниз (точное — в tooltip). Функция зависит только от (start, Total_SP, tagged) — порядок вложений не важен.
- Пороги по умолчанию (5 штук): 100→2, 150→3, 200→4, 250→5, 275→6 (СП за пункт). В конфиге редактируются from и cost каждого; есть helper «шаг удорожания» (cost_i = baseCost + step*i).
- СП за уровень: `IN * spPerIntCoef (4)` + `(skilled ? skilledBonusSP (24) : 0)`. Не зависит от номера уровня. Уровень 1 даёт `startingSP` (по умолч. 0), каждый level-up (2..maxLevel) даёт СП за уровень. Считается от текущих статов (stateless).
- Тэги: без Скилледа разрешено `tagsNormal` (3), со Скилледом `tagsSkilled` (1).

### Валидация (список Issue {level: 'error'|'warning', message})
- Тэгов больше разрешённого → error. Для Скилледа текст: «Билд не соответствует: с трейтом «Скиллед» можно тэгнуть только 1 навык (выбрано N)». Тэгов меньше → warning.
- Сумма статов ≠ пул → error если больше, warning если меньше. Стат вне диапазона → error.
- Потрачено СП больше, чем заработано → error (может случиться после смены ИНТ/Скилледа).
- СП в скилле сверх капа 300 → warning.

## 3. Модель данных — см. `src/engine/types.ts` (контракт, не менять без нужды).

Прокачка уровней: `build.levels[i]` — запись уровня (i=0 → уровень 1) с `alloc` (Direct SP по скиллам, вложенные на этом уровне). Текущий уровень = последний. Добавлять/снимать СП можно только в текущем уровне (снять нельзя ниже 0 в alloc текущего уровня). «Level Up» добавляет новую пустую запись (если < maxLevel). «Отменить уровень» удаляет последнюю (возврат СП). «Сброс прокачки» → один уровень с пустым alloc. Статы/тэги/трейт можно менять в любой момент — всё пересчитывается, ошибки показываются валидацией.

## 4. Движок — `src/engine/`
- `types.ts` — типы (`BleedMode`, `BleedEdge`, `BleedLink`, `BleedNode` и др.).
- `defaults.ts` — `STATS: StatDef[]`, `DEFAULT_CONFIG: Config` (`maxLevel` 15, `bleedMode` 'incoming'), `DEFAULT_BUILD: Build` (все статы 5, уровень 1).
- `calc.ts`:
  - `baseValue(skill: SkillDef, stats: Stats): number`
  - `costAt(value: number, config: Config): number`
  - `spToValue(start: number, totalSP: number, tagged: boolean, config: Config): { value: number; overflowSP: number }`
  - `spToNextPoint(start, totalSP, tagged, config): number` — сколько ещё СП нужно, чтобы floor(value) вырос на 1 (Infinity на капе)
  - `spForPoints(start, totalSP, tagged, config, points): number` — дельта Total SP, чтобы сдвинуть отображаемое (floor) значение на `points` пунктов: >0 — сколько добавить (цель ≤ кап, на капе 0), <0 — отрицательная дельта (цель не ниже start). Учитывает тэг (×0.5) и пороги.
  - `bleedEdges(config): BleedEdge[]` — все вхождения связей `{from, to, coef}` с учётом режима; `bleedGraph(config): Record<SkillId, {outgoing, incoming}>` — для UI (подсветка, аналитика, tooltip), дубли суммируются в coef.
  - `spPerLevel(stats, skilled, config): number`, `spEarned(build, config): number`
  - `directSP(build): Record<SkillId, number>`
  - `computeBuild(build, config): BuildResult` (`bleedFrom` корректен в обоих режимах)
  - `computeHistory(build, config): LevelSnapshot[]` — снимок после каждого уровня (кумулятивно)
  - `statUsage(config): Record<StatId, number>` — в скольких базах участвует стат (для конфига; в ТЗ: СЛ 5, ВС 7, ВН 1, ХАР 3(4), ИНТ 0, ЛВ 8, УД 6)
- `validate.ts`: `validateBuild(build, config, result?): Issue[]`
- `calc.test.ts`: тесты на контрольный пример ТЗ (базы, формулы таблицы клиента, 10 в Большие / 25 в Средние → 16.25/27.5, 96 в Рукопашку → 24/24), `bleedGraph`, `spForPoints`, пороги, тэг (полцены: +1 пункт до 100 = 0.5 СП, +бонус), кап, Скиллед + 3 тэга → error, SP/level = 4*IN (+24), умолчания (статы 5, maxLevel 15).

## 5. Store — `src/store/` (Zustand + persist, ключ `sp-calc-v2`; старый `sp-calc-v1` не читается)
`useAppStore` со state `{ config: Config; build: Build; configOpen: boolean }` и actions:
- build: `setStat(id, value)`, `toggleTag(skillId)`, `setSkilled(bool)`, `addSP(skillId, amount)` (сырые СП в текущий уровень; amount может быть отрицательным; клэмп: не ниже 0 в alloc текущего уровня, не больше доступных СП для положительного), `addPoints(skillId, points)` (в пунктах навыка: +N — тратит ровно `spForPoints` с учётом текущего Total SP вкл. блид; если на +N не хватает — покупает максимум целых пунктов, а если не хватает и на один — вкладывает весь остаток; −N — возвращает СП только из alloc текущего уровня, не ниже 0; само-блид учитывается делением на 1+coef), `setCurrentAlloc(skillId, value)`, `levelUp()`, `levelUpTo(n)`, `undoLevel()`, `resetLeveling()`, `resetBuild()`, `loadBuild(build)`
- config: `updateConfig(patch: Partial<Config>)`, `updateSkill(id, patch: Partial<SkillDef>)`, `setThreshold(index, patch)`, `resetConfig()`, `loadConfig(config)`, `setConfigOpen(bool)`
- селектор-хук `useBuildResult()` → `computeBuild(build, config)` (useMemo), `useIssues()`.
- `src/store/share.ts`: `encodeState({build, config}) → string` (base64url JSON), `decodeState(str)`; при старте, если в `location.hash` есть `#s=...`, загрузить. `sanitizeConfig` заполняет недостающие поля умолчаниями (`bleedMode`, `bleedLinks`); старый формат (`bleedTargets` без `bleedMode`, ссылки/JSON v1) мигрирует в `bleedMode: 'outgoing'` с теми же связями — результат расчёта не меняется.

## 6. UI
Шапка: название, кнопки «Конфиг баланса» (toggle панели), «Поделиться» (копирует ссылку), «Экспорт/Импорт JSON» (build+config).

Layout (desktop): слева колонка персонажа, по центру таблица скиллов, справа (при включении) панель конфига — шириной ~480px, со своим скроллом; на узких экранах конфиг — оверлей-drawer.

**Персонаж** (`src/components/calculator/`):
- `StatsPanel`: 7 статов с −/+ и числом, остаток пула (красный при перерасходе).
- `TraitsPanel`: чекбокс «Скиллед» с описанием «Позволяет тэгнуть только один навык вместо трёх, но даёт 24 дополнительных СП на каждый уровень» (числа из конфига); счётчик тэгов N/M.
- `LevelPanel`: Уровень N, СП за уровень, заработано/потрачено/доступно, кнопки Level Up, «+5 ур.», «до макс.», «Отменить уровень», «Сброс прокачки».
- `IssuesBanner`: ошибки/предупреждения валидации над таблицей.

**Таблица скиллов** `SkillsTable`: колонки — ★ тэг (кликабельно), Навык (tooltip: «Блидит в» / «Получает из» с коэф., из `bleedGraph`), Формула (напр. «ВС×ЛВ»), База, Direct SP (вложено, с вкладом текущего уровня в скобках), Bleed SP (tooltip: от каких скиллов сколько), Total SP, Значение % (крупно, с полоской прогресса до 300 и маркерами порогов), «Цена, СП/пункт» (цена следующего пункта с учётом тэга: у тэгнутого до 100 — 0.5, помечено ★×0.5), «Пункты навыка»: `−10 −1 | +1 +10` — кнопки меняют отображаемое значение на N пунктов (`addPoints`), тратя/возвращая ровно нужные СП; shift-клик ×5; tooltip показывает цену/возврат. Наведение на строку подсвечивает (по `bleedGraph`) скиллы, в которые она блидит, и из которых получает.
Тэгнутая строка выделена. Числа — tabular-nums, дробные до 2 знаков.

**История** `HistoryTable` (сворачиваемая, под таблицей): строки — уровни, колонки — скиллы, значение % после уровня; изменившиеся ячейки подсвечены.

**Конфиг** (`src/components/config/ConfigPanel` и подкомпоненты), всё редактируется на лету, изменения сразу пересчитывают билд:
- Общие: пул статов, мин/макс стата, тэг-бонус, множитель цены для тэга, кол-во тэгов (обычно/Скиллед), бонус СП Скилледа, k (СП = ИНТ×k), стартовые СП, макс. уровень, кап скилла, базовая цена, глобальный коэф. блида.
- Пороги удорожания: 5 строк (from, cost) + helper «шаг удорожания» с кнопкой «применить».
- Скиллы: переключатель режима блида «Входящий / Исходящий» (`bleedMode`); по строке на скилл — название, statA (select), statB (select), множитель, связь #1 (select, «—» = нет), #2 (select, может совпадать с #1 = двойной), коэф. (пусто = глобальный). Заголовки: «Получает из #1/#2» (incoming; коэф. — получателя) или «Блидит в #1/#2» (outgoing; коэф. — источника).
- Аналитика: использование статов (`statUsage`), список входящих блидов для каждого скилла и Σ входа/выхода (из `bleedGraph`).
- Кнопки: «Сбросить к умолчанию», экспорт/импорт конфига JSON. Измененные относительно DEFAULT_CONFIG поля подсвечены.

Общие UI-примитивы — `src/components/ui/` (NumberInput с клэмпом и шагом, Select, Button, Tooltip через title или простой кастом).
