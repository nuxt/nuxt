import { BUDGETS } from './registry'

const INTRO = 'Go to a page in this app. Use when the user asks for another page, or when an action they want is on a different page.'
const PREFIX = `${INTRO} Pages: `

const depth = (path: string) => path.split('/').length

/** The `navigate` tool description, listing as many of `pages` as fit in the description budget, shallowest first. */
export function describeNavigation (pages: string[]): string {
  const sorted = [...pages].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))
  const omitted = (count: number) => count < sorted.length ? `, and ${sorted.length - count} more` : ''
  let listed = 0
  let length = PREFIX.length + 1
  for (let count = 1; count <= sorted.length; count++) {
    length += sorted[count - 1]!.length + (count > 1 ? 2 : 0)
    if (length > BUDGETS.description) {
      break
    }
    if (length + omitted(count).length <= BUDGETS.description) {
      listed = count
    }
  }
  return listed ? `${PREFIX}${sorted.slice(0, listed).join(', ')}${omitted(listed)}.` : INTRO
}
