import { computeBuild } from './calc'
import { STATS } from './defaults'
import type { Build, BuildResult, Config, Issue } from './types'

const fmt = (n: number) => String(Math.round(n * 100) / 100)

export function validateBuild(build: Build, config: Config, result?: BuildResult): Issue[] {
  const r = result ?? computeBuild(build, config)
  const issues: Issue[] = []

  const tags = build.tags.length
  const allowed = r.tagsAllowed
  if (tags > allowed) {
    issues.push({
      level: 'error',
      message: build.skilled
        ? `Билд не соответствует: с трейтом «Скиллед» можно тэгнуть только ${allowed} навык (выбрано ${tags})`
        : `Билд не соответствует: можно тэгнуть только ${allowed} навыка (выбрано ${tags})`,
    })
  } else if (tags < allowed) {
    issues.push({
      level: 'warning',
      message: `Выбрано тэгов меньше, чем доступно: ${tags} из ${allowed}`,
    })
  }

  const used = r.statPointsUsed
  if (used > config.statPool) {
    issues.push({
      level: 'error',
      message: `Сумма статов (${used}) превышает пул (${config.statPool}) на ${used - config.statPool}`,
    })
  } else if (used < config.statPool) {
    issues.push({
      level: 'warning',
      message: `Не распределено очков статов: ${config.statPool - used} из ${config.statPool}`,
    })
  }

  for (const s of STATS) {
    const v = build.stats[s.id]
    if (v < config.statMin || v > config.statMax) {
      issues.push({
        level: 'error',
        message: `Стат «${s.name}» (${v}) вне диапазона ${config.statMin}..${config.statMax}`,
      })
    }
  }

  if (r.spSpent > r.spEarned + 1e-9) {
    issues.push({
      level: 'error',
      message: `Потрачено СП больше, чем заработано: ${fmt(r.spSpent)} из ${fmt(r.spEarned)} (перерасход ${fmt(r.spSpent - r.spEarned)})`,
    })
  }

  for (const s of config.skills) {
    const sr = r.skills[s.id]
    if (sr && sr.overflowSP > 1e-9) {
      issues.push({
        level: 'warning',
        message: `«${s.name}»: ${fmt(sr.overflowSP)} СП сверх капа ${config.skillMax} пропадают`,
      })
    }
  }

  return issues
}
