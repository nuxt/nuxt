import chalk from 'chalk'
import consola from 'consola'
import prettyBytes from 'pretty-bytes'

export function getMemoryUsage () {
  // https://nodejs.org/api/process.html#process_process_memoryusage
  const { heapUsed, rss } = process.memoryUsage()
  return { heap: heapUsed, rss }
}

export function getFormattedMemoryUsage () {
  const { heap, rss } = getMemoryUsage()
  return `Memory usage: ${chalk.bold(prettyBytes(heap))} (RSS: ${prettyBytes(rss)})`
}

export function showMemoryUsage () {
  consola.info(getFormattedMemoryUsage())
}
