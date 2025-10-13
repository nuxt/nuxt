import { consola } from 'consola'
import { colors } from 'consola/utils'
import { type H3Event, getRequestURL } from 'h3'
import { parseQuery, stringifyQuery } from 'ufo'

/**
 * Shows a debugging message in the console with a link to view the page with SSR disabled
 * This utility helps developers debug SSR errors by providing them with a direct link
 * to view the page with SSR disabled, which can make identifying the source of errors easier.
 *
 * @param event - The event that caused the error
 */
export function showSSRDebugPrompt (event: H3Event): void {
  if (!import.meta.dev) { return }

  const url = getRequestURL(event)
  const query = parseQuery(url.search)
  url.search = stringifyQuery({ ...query, 'nuxt-no-ssr': '1' })

  consola.box([
    colors.red('Error rendering page'),
    'You can try to debug the error by opening the page with server rendering disabled.',
    `\`${url.href}\``,
  ].join('\n'))
}
