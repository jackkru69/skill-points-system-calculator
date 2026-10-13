# Калькулятор новой системы скиллпойнтов — спецификация

SPA без бэкенда: Vite + React 19 + TypeScript + Tailwind v4 + Zustand (persist в localStorage) + Vitest.
UI на русском. Тёмная тема, компактно, удобно для геймдизайнера (всё на одной странице, мгновенный пересчёт).

## 1. Предметная область

Статы (SPECIAL): `ST` Сила (СЛ), `PE` Восприятие (ВС), `EN` Выносливость (ВН), `CH` Харизма (ХАР), `IN` Интеллект (ИНТ), `AG` Ловкость (ЛВ), `LK` Удача (УД).
Диапазон стата 1..10, пул очков по умолчанию 40 (всё настраивается).

Скиллы (порядок важен, он же порядок по умолчанию для блидинга), база = statA * statB * mult:

| id | Название | База | Блидит в (по умолчанию) |
|---|---|---|---|
| smallGuns | Мелкие пушки | PE*AG | mediumGuns |
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
| firstAid | Санитар | ST*CH | doctor |
| barter | Торговля | CH*CH*2 | — (никуда не блидит; в неё тоже никто по умолчанию) |

Правило по умолчанию: скилл блидит в соседей по списку, Торговля исключена. Интеллект не участвует в базе.

Контрольный пример из ТЗ (ST10 PE5 EN10 CH2 IN2 AG10 LK1): Мелкие 50, Средние 50, Большие 50, Метательное 100, Холодное 100, Рукопашка 100, Скрытность 20, Воровство 10, Взлом 50, Ловушки 5, Ремонт 10, Крафт 2, Наука 5, Доктор 5, Санитар 20, Торговля 8.
96 СП прямо в Рукопашку → Холодное получает 24 bleed, Скрытность 24 bleed.

## 2. Формулы (движок, чистые функции)

- `base(skill) = stats[statA] * stats[statB] * mult`.
- `start(skill) = base + (tagged ? tagBonus : 0)` (флэт-бонус тэга, по умолчанию 20).
- `Direct_SP(skill)` = сумма СП, вложенных игроком напрямую (по всем уровням).
- `Bleed_SP(target) = Σ по source: Direct_SP(source) * coef(source)` за каждое вхождение target в `source.bleedTargets` (один и тот же скилл дважды = двойной блид). Каскада нет: блидится только Direct_SP. Тэг источника на блид не влияет (утекает столько, сколько потрачено).
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
- `types.ts` — типы (готово).
- `defaults.ts` — `STATS: StatDef[]`, `DEFAULT_CONFIG: Config`, `DEFAULT_BUILD: Build` (статы из примера ТЗ, уровень 1).
- `calc.ts`:
  - `baseValue(skill: SkillDef, stats: Stats): number`
  - `costAt(value: number, config: Config): number`
  - `spToValue(start: number, totalSP: number, tagged: boolean, config: Config): { value: number; overflowSP: number }`
  - `spToNextPoint(start, totalSP, tagged, config): number` — сколько ещё СП нужно, чтобы floor(value) вырос на 1 (Infinity на капе)
  - `spPerLevel(stats, skilled, config): number`, `spEarned(build, config): number`
  - `directSP(build): Record<SkillId, number>`
  - `computeBuild(build, config): BuildResult`
  - `computeHistory(build, config): LevelSnapshot[]` — снимок после каждого уровня (кумулятивно)
  - `statUsage(config): Record<StatId, number>` — в скольких базах участвует стат (для конфига; в ТЗ: СЛ 5, ВС 7, ВН 1, ХАР 3(4), ИНТ 0, ЛВ 8, УД 6)
- `validate.ts`: `validateBuild(build, config, result?): Issue[]`
- `calc.test.ts`: тесты на контрольный пример ТЗ (базы, 10/25 пушек → 16.25/27.5 Total SP, 96 в Рукопашку → 24/24), пороги, тэг (полцены, +бонус), кап, Скиллед + 3 тэга → error, SP/level = 4*IN (+24).

## 5. Store — `src/store/` (Zustand + persist, ключ `sp-calc-v1`)
`useAppStore` со state `{ config: Config; build: Build; configOpen: boolean }` и actions:
- build: `setStat(id, value)`, `toggleTag(skillId)`, `setSkilled(bool)`, `addSP(skillId, amount)` (в текущий уровень; amount может быть отрицательным; клэмп: не ниже 0 в alloc текущего уровня, не больше доступных СП для положительного), `setCurrentAlloc(skillId, value)`, `levelUp()`, `levelUpTo(n)`, `undoLevel()`, `resetLeveling()`, `resetBuild()`, `loadBuild(build)`
- config: `updateConfig(patch: Partial<Config>)`, `updateSkill(id, patch: Partial<SkillDef>)`, `setThreshold(index, patch)`, `resetConfig()`, `loadConfig(config)`, `setConfigOpen(bool)`
- селектор-хук `useBuildResult()` → `computeBuild(build, config)` (useMemo), `useIssues()`.
- `src/store/share.ts`: `encodeState({build, config}) → string` (base64url JSON), `decodeState(str)`; при старте, если в `location.hash` есть `#s=...`, загрузить.

## 6. UI
Шапка: название, кнопки «Конфиг баланса» (toggle панели), «Поделиться» (копирует ссылку), «Экспорт/Импорт JSON» (build+config).

Layout (desktop): слева колонка персонажа, по центру таблица скиллов, справа (при включении) панель конфига — шириной ~480px, со своим скроллом; на узких экранах конфиг — оверлей-drawer.

**Персонаж** (`src/components/calculator/`):
- `StatsPanel`: 7 статов с −/+ и числом, остаток пула (красный при перерасходе).
- `TraitsPanel`: чекбокс «Скиллед» с описанием «Позволяет тэгнуть только один навык вместо трёх, но даёт 24 дополнительных СП на каждый уровень» (числа из конфига); счётчик тэгов N/M.
- `LevelPanel`: Уровень N, СП за уровень, заработано/потрачено/доступно, кнопки Level Up, «+5 ур.», «до макс.», «Отменить уровень», «Сброс прокачки».
- `IssuesBanner`: ошибки/предупреждения валидации над таблицей.

**Таблица скиллов** `SkillsTable`: колонки — ★ тэг (кликабельно), Навык, Формула (напр. «ВС×ЛВ»), База, Direct SP (вложено, с вкладом текущего уровня в скобках), Bleed SP (tooltip: от каких скиллов сколько), Total SP, Значение % (крупно, с полоской прогресса до 300 и маркерами порогов), Цена пункта (СП/пункт сейчас), Действия: `−1 −10 | +1 +10 | +1%` (+1% — вложить spToNextPoint, округляя вверх до 0.01; shift-клик ×5). Наведение на строку подсвечивает скиллы, в которые она блидит, и из которых получает.
Тэгнутая строка выделена. Числа — tabular-nums, дробные до 2 знаков.

**История** `HistoryTable` (сворачиваемая, под таблицей): строки — уровни, колонки — скиллы, значение % после уровня; изменившиеся ячейки подсвечены.

**Конфиг** (`src/components/config/ConfigPanel` и подкомпоненты), всё редактируется на лету, изменения сразу пересчитывают билд:
- Общие: пул статов, мин/макс стата, тэг-бонус, множитель цены для тэга, кол-во тэгов (обычно/Скиллед), бонус СП Скилледа, k (СП = ИНТ×k), стартовые СП, макс. уровень, кап скилла, базовая цена, глобальный коэф. блида.
- Пороги удорожания: 5 строк (from, cost) + helper «шаг удорожания» с кнопкой «применить».
- Скиллы: по строке на скилл — название, statA (select), statB (select), множитель, блидит в #1 (select, «—» = нет), #2 (select, может совпадать с #1), коэф. (пусто = глобальный).
- Аналитика: использование статов (`statUsage`), матрица/список входящих блидов для каждого скилла.
- Кнопки: «Сбросить к умолчанию», экспорт/импорт конфига JSON. Измененные относительно DEFAULT_CONFIG поля подсвечены.

Общие UI-примитивы — `src/components/ui/` (NumberInput с клэмпом и шагом, Select, Button, Tooltip через title или простой кастом).
