import { describe, expect, it } from 'vitest'
import type { DateString } from 'compatx'
import { applyCompatibilityDateUpdate } from '../src/core/compatibility-date.ts'

describe('applyCompatibilityDateUpdate', () => {
  it('sets default on an object compatibilityDate and keeps provider keys', () => {
    const config = {
      compatibilityDate: {
        cloudflare: '2024-03-01' as DateString,
      },
    }

    applyCompatibilityDateUpdate(config, '2026-10-24')

    expect(config.compatibilityDate).toEqual({
      cloudflare: '2024-03-01',
      default: '2026-10-24',
    })
  })

  it('replaces a string compatibilityDate', () => {
    const config = {
      compatibilityDate: '2024-01-01' as DateString,
    }

    applyCompatibilityDateUpdate(config, '2026-10-24')

    expect(config.compatibilityDate).toBe('2026-10-24')
  })
})
