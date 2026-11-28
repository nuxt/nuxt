import type { CompatibilityDateSpec, CompatibilityDates, DateString } from 'compatx'

export function applyCompatibilityDateUpdate (
  config: { compatibilityDate?: CompatibilityDateSpec },
  date: DateString,
): void {
  const current = config.compatibilityDate
  if (isCompatibilityDateRecord(current)) {
    current.default = date
    return
  }
  config.compatibilityDate = date
}

function isCompatibilityDateRecord (
  value: CompatibilityDateSpec | undefined,
): value is Partial<CompatibilityDates> {
  return !!value && typeof value === 'object'
}
