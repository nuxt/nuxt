interface Summary {
  n: number
  median: number
  min: number
  max: number
}

export function summarise (samples: number[]): Summary {
  if (samples.length === 0) {
    throw new Error('cannot summarise an empty sample set')
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const middle = (sorted.length - 1) / 2
  return {
    n: sorted.length,
    median: (sorted[Math.floor(middle)]! + sorted[Math.ceil(middle)]!) / 2,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  }
}

export function formatMs (value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ms`
}

export function formatBytes (bytes: number): string {
  if (bytes >= 1024 ** 2) {
    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`
  }
  return `${bytes} B`
}

export function formatDelta (baseline: number, head: number): string {
  if (baseline === 0) {
    return head === 0 ? '0%' : 'n/a'
  }
  const pct = ((head - baseline) / baseline) * 100
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

export function markdownTable (headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

export function compareRow (label: string, baseline: number[], head: number[], format = formatMs): string[] {
  const a = summarise(baseline)
  const b = summarise(head)
  return [
    label,
    format(a.median),
    format(b.median),
    formatDelta(a.median, b.median),
    `${format(a.min)} / ${format(a.max)}`,
    `${format(b.min)} / ${format(b.max)}`,
  ]
}

export const compareHeaders = ['', 'baseline median', 'head median', 'delta', 'baseline min / max', 'head min / max']
