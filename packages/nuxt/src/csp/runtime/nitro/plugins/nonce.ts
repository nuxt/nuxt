// @ts-expect-error : we are importing from the virtual file system
import contentSecurityPolicyConfig from '#content-security-policy'
import type { NitroApp } from 'nitro/types'
import type { ContentSecurityPolicyConfig } from '../../../types'
import { generateRandomNonce } from '../utils'
import type { ServerRequestContext } from 'srvx'

const LINK_RE = /<link\b([^>]*>)/gi
const NONCE_RE = /nonce="[^"]+"/i
const SCRIPT_RE = /<script\b([^>]*>)/gi
const STYLE_RE = /<style\b([^>]*>)/gi
const QUOTE_MASK_RE = /"[^"]*"/g
const QUOTE_RESTORE_RE = /__QUOTE_PLACEHOLDER_(\d+)__/g

/**
 * This plugin generates a nonce for the current request and adds it to the HTML.
 * It only runs in SSR mode.
 */
export default (nitroApp: NitroApp) => {
  // Exit in SSG mode
  if (import.meta.prerender) {
    return
  }

  const cspConfig = contentSecurityPolicyConfig as ContentSecurityPolicyConfig

  // Genearate a 16-byte random nonce for each request.
  nitroApp.hooks?.hook('request', (event) => {
    event.req.context!.security ||= {}

    const securityContext = event.req.context!.security as ServerRequestContext[string] & { nonce?: string }

    if (securityContext.nonce) {
      // When rendering server-only (NuxtIsland) components, each component will trigger a request event.
      // The request context is shared between the event that renders the actual page and the island request events.
      // Make sure to only generate the nonce once.
      return
    }

    if (cspConfig && cspConfig.nonce && !import.meta.prerender) {
      const nonce = generateRandomNonce()
      securityContext.nonce = nonce
    }
  })

  // Set the nonce attribute on all script, style, and link tags.
  nitroApp.hooks?.hook('render:html', (html, { event }) => {
    // event.context.security ||= {}
    // Exit if no CSP defined
    if (
      !cspConfig ||
      !cspConfig.value ||
      !cspConfig.nonce
    ) {
      return
    }

    const securityContext = event.req.context!.security as ServerRequestContext[string] & { nonce: string }

    const nonce = securityContext.nonce
    // Scan all relevant sections of the NuxtRenderHtmlContext
    type Section = 'body' | 'bodyAppend' | 'bodyPrepend' | 'head'
    const sections = ['body', 'bodyAppend', 'bodyPrepend', 'head'] as Section[]
    for (const section of sections) {
      html[section] = html[section].map(element => injectNonceToTags(element, nonce))
    }

    // Add meta header for Vite in development
    if (import.meta.dev) {
      html.head.push(
        `<meta property="csp-nonce" nonce="${nonce}">`,
      )
    }
  })
}

function injectNonceToTags (element: string, nonce: string) {
  // Skip non-string elements
  if (typeof element !== 'string') {
    return element
  }
  const quotes: string[] = []

  // Mask attributes to avoid manipulating stringified elements
  let maskedElement = element.replace(QUOTE_MASK_RE, (match) => {
    quotes.push(match)
    return `__QUOTE_PLACEHOLDER_${quotes.length - 1}__`
  })
  // Add nonce to all link tags
  maskedElement = maskedElement.replace(LINK_RE, (match, rest) => {
    if (NONCE_RE.test(rest)) {
      return match.replace(NONCE_RE, `nonce="${nonce}"`)
    }
    return `<link nonce="${nonce}"` + rest
  })
  // Add nonce to all script tags
  maskedElement = maskedElement.replace(SCRIPT_RE, (_match, rest) => {
    return `<script nonce="${nonce}"` + rest
  })
  // Add nonce to all style tags
  maskedElement = maskedElement.replace(STYLE_RE, (_match, rest) => {
    return `<style nonce="${nonce}"` + rest
  })

  // Restore the original quoted content.
  const restoredHtml = maskedElement.replace(QUOTE_RESTORE_RE, (_match, index) => {
    return quotes[Number.parseInt(index, 10)] ?? _match
  })

  return restoredHtml
}
