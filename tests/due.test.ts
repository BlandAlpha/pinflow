import { describe, expect, it } from 'vitest'
import { levelsFromDue } from '@shared/quadrant'

const HOUR = 3_600_000
const at = (h: number) => new Date(Date.now() + h * HOUR).toISOString()

describe('levelsFromDue', () => {
  it('6 小时内到期（含已逾期）= 重要且紧急', () => {
    expect(levelsFromDue(at(6))).toEqual({ importance: 'high', urgency: 'high' })
    expect(levelsFromDue(at(-2))).toEqual({ importance: 'high', urgency: 'high' })
  })

  it('一天内到期 = 重要', () => {
    expect(levelsFromDue(at(20))).toEqual({ importance: 'high', urgency: 'normal' })
  })

  it('三天内 = 正常', () => {
    expect(levelsFromDue(at(70))).toEqual({ importance: 'normal', urgency: 'normal' })
  })

  it('一周内 = 不重要', () => {
    expect(levelsFromDue(at(160))).toEqual({ importance: 'normal', urgency: 'low' })
  })

  it('更远 = 双低', () => {
    expect(levelsFromDue(at(400))).toEqual({ importance: 'low', urgency: 'low' })
  })
})
