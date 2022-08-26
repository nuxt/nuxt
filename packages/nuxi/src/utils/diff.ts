import flatten from 'flat'
import { detailedDiff } from 'deep-object-diff'
import { green, red, blue, cyan } from 'colorette'

function normalizeDiff (diffObj: any, type: 'added' | 'deleted' | 'updated', ignore: string[]) {
  return Object.entries(flatten(diffObj) as Record<string, any>)
    .map(([key, value]) => ({ key, value, type }))
    .filter(item => !ignore.includes(item.key) && typeof item.value !== 'function')
}

export function diff (a: any, b: any, ignore: string[]) {
  const _diff: any = detailedDiff(a, b)
  return [
    ...normalizeDiff(_diff.added, 'added', ignore),
    ...normalizeDiff(_diff.deleted, 'deleted', ignore),
    ...normalizeDiff(_diff.updated, 'updated', ignore)
  ]
}

const typeMap = {
  added: green('added'),
  deleted: red('deleted'),
  updated: blue('updated')
}

export function printDiff (diff: any) {
  for (const item of diff) {
    console.log('  ', typeMap[item.type as keyof typeof typeMap] || item.type, cyan(item.key), item.value ? `~> ${cyan(item.value)}` : '')
  }
  console.log()
}
