import { consola } from 'consola'
import { withQuery } from 'ufo'

/**
 * Shows a debugging message in the console with a link to view the page with SSR disabled
 * This utility helps developers debug SSR errors by providing them with a direct link
 * to view the page with SSR disabled, which can make identifying the source of errors easier.
 * 
 * @param path - The URL path that caused the error
 */
export function showSSRDebugPrompt(path: string): void {
  if (!import.meta.dev) return
  
  const url = new URL(path, 'http://localhost')
  const noSSRUrl = withQuery(url.pathname + url.search, { ...Object.fromEntries(url.searchParams), '_nuxt_no_ssr': '1' })
  
  const coloredMessage = [
    '\n\n',
    '\x1b[33m┌─────────────────────────────────────────────────────────────┐\x1b[0m',
    '\x1b[33m│\x1b[0m \x1b[31mSSR Error detected\x1b[0m                                           \x1b[33m│\x1b[0m',
    '\x1b[33m│\x1b[0m You can debug the error by opening the page with SSR disabled:  \x1b[33m│\x1b[0m',
    '\x1b[33m│\x1b[0m \x1b[36m' + noSSRUrl.padEnd(57) + '\x1b[0m \x1b[33m│\x1b[0m',
    '\x1b[33m└─────────────────────────────────────────────────────────────┘\x1b[0m',
    '\n',
  ].join('\n')
  
  consola.log(coloredMessage)
}
