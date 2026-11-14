const MAX_CACHED_FORMATTERS = 100
const formatters = new Map<string, Intl.DateTimeFormat | Intl.RelativeTimeFormat>()

// share a single `Intl` formatter per unique configuration
export function getFormatter (relative: boolean | undefined, locale: string | undefined, options: Record<string, unknown>): Intl.DateTimeFormat | Intl.RelativeTimeFormat {
  const key = `${relative ? 'r' : 'd'}|${locale ?? ''}|${JSON.stringify(options, Object.keys(options).sort())}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = relative ? new Intl.RelativeTimeFormat(locale, options) : new Intl.DateTimeFormat(locale, options)
    if (formatters.size >= MAX_CACHED_FORMATTERS) {
      formatters.delete(formatters.keys().next().value!)
    }
    formatters.set(key, formatter)
  }
  return formatter
}
