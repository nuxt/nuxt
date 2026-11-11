import { BUDGETS } from './registry'

const INTRO = 'Go to a page in this app. Use when the user asks for another page, or when an action they want is on a different page.'

const depth = (path: string) => path.split('/').length

/** The `navigate` tool description, listing as many of `pages` as fit in the description budget, shallowest first. */
export function describeNavigation (pages: string[]): string {
  const sorted = [...pages].sort((a, b) => depth(a) - depth(b) || a.localeCompare(b))
  for (let count = sorted.length; count > 0; count--) {
    const rest = sorted.length - count
    const description = `${INTRO} Pages: ${sorted.slice(0, count).join(', ')}${rest ? `, and ${rest} more` : ''}.`
    if (description.length <= BUDGETS.description) {
      return description
    }
  }
  return INTRO
}
