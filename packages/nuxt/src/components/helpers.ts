import { pathToFileURL } from 'node:url'
import { parseQuery, parseURL } from 'ufo'

export function isVueTemplate (id: string) {
  // Bare `.vue` file (in Vite)
  if (id.endsWith('.vue')) {
    return true
  }

  const { search } = parseURL(decodeURIComponent(pathToFileURL(id).href))
  if (!search) {
    return false
  }

  const query = parseQuery(search)

  // Macro
  if (query.macro) {
    return true
  }

  // Non-Vue or Styles
  if (!('vue' in query) || query.type === 'style') {
    return false
  }

  // Query `?vue&type=template` (in Webpack or external template)
  return true
}
