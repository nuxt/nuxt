import { formatDelta, markdownTable, summarise } from './stats.ts'

const TIMING_MIN_SAMPLES = 3

export interface Metric {
  label: string
  /** One value for exact metrics, every sample for timings. */
  baseline: number[]
  head: number[]
  format: (value: number) => string
  exact: boolean
  higherIsBetter: boolean
  /** Smallest relative change that is flagged. Timings also need each median outside the other target's min/max range. */
  threshold: number
}

interface MetricOptions {
  higherIsBetter?: boolean
  threshold?: number
}

type Status = 'regression' | 'improvement' | 'unchanged'

export function exact (label: string, baseline: number, head: number, format: (value: number) => string = String, { higherIsBetter = false, threshold = 0.001 }: MetricOptions = {}): Metric {
  return { label, baseline: [baseline], head: [head], format, exact: true, higherIsBetter, threshold }
}

export function timing (label: string, baseline: number[], head: number[], format: (value: number) => string, { higherIsBetter = false, threshold = 0.05 }: MetricOptions = {}): Metric {
  return { label, baseline, head, format, exact: false, higherIsBetter, threshold }
}

function classify (metric: Metric): Status {
  const a = summarise(metric.baseline)
  const b = summarise(metric.head)
  const change = (b.median - a.median) / Math.max(Math.abs(a.median), 1)
  if (a.median === b.median || Math.abs(change) < metric.threshold) {
    return 'unchanged'
  }
  if (!metric.exact) {
    const overlaps = (b.median >= a.min && b.median <= a.max) || (a.median >= b.min && a.median <= b.max)
    if (a.n < TIMING_MIN_SAMPLES || b.n < TIMING_MIN_SAMPLES || overlaps) {
      return 'unchanged'
    }
  }
  return (change > 0) === metric.higherIsBetter ? 'improvement' : 'regression'
}

function changeCell (metric: Metric): string {
  const a = summarise(metric.baseline).median
  const b = summarise(metric.head).median
  if (!metric.exact) {
    return formatDelta(a, b)
  }
  if (a === b) {
    return '0'
  }
  const absolute = `${b > a ? '+' : '-'}${metric.format(Math.abs(b - a))}`
  return a === 0 ? absolute : `${absolute} (${formatDelta(a, b)})`
}

const marker: Record<Status, string> = { regression: '🔴', improvement: '🟢', unchanged: '' }

function table (metrics: { metric: Metric, status: Status }[], flagged: boolean): string {
  return markdownTable(flagged ? ['', 'Metric', 'baseline', 'head', 'change'] : ['Metric', 'baseline', 'head', 'change'], metrics.map(({ metric, status }) => {
    const row = [metric.label, metric.format(summarise(metric.baseline).median), metric.format(summarise(metric.head).median), flagged ? `**${changeCell(metric)}**` : changeCell(metric)]
    return flagged ? [marker[status], ...row] : row
  }))
}

export interface Summary {
  markdown: string
  regressions: number
  improvements: number
}

/** Lists regressions, then improvements, with every other metric collapsed. */
export function renderSummary (metrics: Metric[]): Summary {
  const classified = metrics.map(metric => ({ metric, status: classify(metric) }))
  const regressions = classified.filter(m => m.status === 'regression')
  const improvements = classified.filter(m => m.status === 'improvement')
  const unchanged = classified.filter(m => m.status === 'unchanged')

  const counts = [
    regressions.length && `🔴 **${regressions.length} ${regressions.length === 1 ? 'regression' : 'regressions'}**`,
    improvements.length && `🟢 **${improvements.length} ${improvements.length === 1 ? 'improvement' : 'improvements'}**`,
  ].filter(Boolean)
  const lines = [counts.length ? `${counts.join(', ')}; ${unchanged.length} of ${metrics.length} metrics unchanged, below threshold or within noise.` : `No significant changes across ${metrics.length} metrics.`]
  if (counts.length) {
    lines.push('', table([...regressions, ...improvements], true))
  }
  if (unchanged.length) {
    lines.push('', '<details>', `<summary>${unchanged.length} unchanged, below threshold or within noise</summary>`, '', table(unchanged, false), '', '</details>')
  }
  return { markdown: lines.join('\n'), regressions: regressions.length, improvements: improvements.length }
}
