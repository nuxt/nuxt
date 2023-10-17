import { readonly } from 'vue'
import { setResponseHeader } from 'h3'
import type { HttpClientHintsConfiguration, HttpClientHintsRequest } from './types'
import { type Browser, parseUserAgent } from './detect-browser'
import { NuxtHTTPClientHintsState } from './types'
import { defineNuxtPlugin, useNuxtApp, useRuntimeConfig } from '#app/nuxt'
import { useCookie } from '#app/composables/cookie'
import { useState } from '#app/composables/state'
import { useRequestEvent, useRequestHeaders } from '#app/composables/ssr'

export default defineNuxtPlugin<{ httpClientHints: HttpClientHintsRequest }>({
  name: 'nuxt:http-client-hints:server',
  enforce: 'pre',
  setup () {
    const httpClientHintsConfiguration = useRuntimeConfig().public.httpClientHints as HttpClientHintsConfiguration
    const httpClientHints = useState<HttpClientHintsRequest>(NuxtHTTPClientHintsState)

    const requestHeaders = useRequestHeaders<string>(HttpRequestHeaders)
    const userAgentHeader = requestHeaders['user-agent']

    // 1. extract browser info
    const userAgent = userAgentHeader
      ? parseUserAgent(userAgentHeader)
      : null
    // 2. prepare client hints request
    const clientHintsRequest = collectClientHints(userAgent, httpClientHintsConfiguration, requestHeaders)
    // 3. write client hints response headers when required
    writeClientHintsResponseHeaders(clientHintsRequest, httpClientHintsConfiguration)
    httpClientHints.value = clientHintsRequest
    // 4. send the theme cookie to the client when required
    httpClientHints.value.colorSchemeCookie = writeThemeCookie(
      clientHintsRequest,
      httpClientHintsConfiguration
    )

    return {
      provide: readonly({
        httpClientHints,
        httpClientHintsConfiguration
      })
    }
  }
})

const AcceptClientHintsHeaders = {
  prefersColorScheme: 'Sec-CH-Prefers-Color-Scheme',
  prefersReducedMotion: 'Sec-CH-Prefers-Reduced-Motion',
  viewportHeight: 'Sec-CH-Viewport-Height',
  viewportWidth: 'Sec-CH-Viewport-Width'
}

type AcceptClientHintsHeadersKey = keyof typeof AcceptClientHintsHeaders

type BrowserFeatureAvailable = (android: boolean, versions: number[]) => boolean
type BrowserFeatures = Record<AcceptClientHintsHeadersKey, BrowserFeatureAvailable>

// Tests for Browser compatibility
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-CH-Prefers-Reduced-Motion#browser_compatibility
// https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-CH-Prefers-Color-Scheme#browser_compatibility
const chromiumBasedBrowserFeatures: BrowserFeatures = {
  prefersColorScheme: (_, v) => v[0] >= 93,
  prefersReducedMotion: (_, v) => v[0] >= 108,
  viewportHeight: (_, v) => v[0] >= 108,
  viewportWidth: (_, v) => v[0] >= 108
}
const allowedBrowsers: [browser: Browser, features: BrowserFeatures][] = [
  // 'edge',
  // 'edge-ios',
  ['chrome', chromiumBasedBrowserFeatures],
  ['edge-chromium', chromiumBasedBrowserFeatures],
  ['chromium-webview', chromiumBasedBrowserFeatures],
  ['opera', {
    prefersColorScheme: (android, v) => v[0] >= (android ? 66 : 79),
    prefersReducedMotion: (android, v) => v[0] >= (android ? 73 : 94),
    viewportHeight: (android, v) => v[0] >= (android ? 73 : 94),
    viewportWidth: (android, v) => v[0] >= (android ? 73 : 94)
  }]
]

const AcceptClientHintsRequestHeaders: Record<AcceptClientHintsHeadersKey, Lowercase<string>> = Object.entries(AcceptClientHintsHeaders).reduce((acc, [key, value]) => {
  acc[key as AcceptClientHintsHeadersKey] = value.toLowerCase() as Lowercase<string>
  return acc
}, {} as Record<AcceptClientHintsHeadersKey, Lowercase<string>>)

const HttpRequestHeaders = Array.from(Object.values(AcceptClientHintsRequestHeaders)).concat('user-agent', 'cookie')

const ClientHeaders = ['Accept-CH', 'Vary', 'Critical-CH']

function browserFeatureAvailable (userAgent: ReturnType<typeof parseUserAgent>, feature: AcceptClientHintsHeadersKey) {
  if (userAgent == null || userAgent.type !== 'browser') { return false }

  try {
    const browserName = userAgent.name
    const android = userAgent.os?.toLowerCase().startsWith('android') ?? false
    const versions = userAgent.version.split('.').map(v => Number.parseInt(v))
    return allowedBrowsers.some(([name, check]) => {
      if (browserName !== name) { return false }

      try {
        return check[feature](android, versions)
      } catch {
        return false
      }
    })
  } catch {
    return false
  }
}

function lookupClientHints (
  userAgent: ReturnType<typeof parseUserAgent>,
  httpClientHintsConfiguration: HttpClientHintsConfiguration
) {
  const request: HttpClientHintsRequest = {
    firstRequest: true,
    prefersColorSchemeAvailable: false,
    prefersReducedMotionAvailable: false,
    viewportHeightAvailable: false,
    viewportWidthAvailable: false
  }

  if (userAgent == null || userAgent.type !== 'browser') { return request }

  if (httpClientHintsConfiguration.prefersColorScheme) { request.prefersColorSchemeAvailable = browserFeatureAvailable(userAgent, 'prefersColorScheme') }

  if (httpClientHintsConfiguration.prefersReducedMotion) { request.prefersReducedMotionAvailable = browserFeatureAvailable(userAgent, 'prefersReducedMotion') }

  if (httpClientHintsConfiguration.viewportSize) {
    request.viewportHeightAvailable = browserFeatureAvailable(userAgent, 'viewportHeight')
    request.viewportWidthAvailable = browserFeatureAvailable(userAgent, 'viewportWidth')
  }

  return request
}

function collectClientHints (
  userAgent: ReturnType<typeof parseUserAgent>,
  httpClientHintsConfiguration: HttpClientHintsConfiguration,
  headers: { [key in Lowercase<string>]?: string | undefined }
) {
  // collect client hints
  const hints = lookupClientHints(userAgent, httpClientHintsConfiguration)

  if (httpClientHintsConfiguration.prefersColorScheme) {
    if (httpClientHintsConfiguration.prefersColorSchemeCookie) {
      const cookieName = httpClientHintsConfiguration.prefersColorSchemeCookie.name
      const cookieValue = headers.cookie?.split(';').find(c => c.trim().startsWith(`${cookieName}=`))
      if (cookieValue) {
        const value = cookieValue.split('=')?.[1].trim()
        if (httpClientHintsConfiguration.prefersColorSchemeCookie.themeNames.includes(value)) {
          hints.colorSchemeFromCookie = value
          hints.firstRequest = false
        }
      }
    }
    if (!hints.colorSchemeFromCookie) {
      const value = hints.prefersColorSchemeAvailable
        ? headers[AcceptClientHintsRequestHeaders.prefersColorScheme]?.toLowerCase()
        : undefined
      if (value === 'dark' || value === 'light' || value === 'no-preference') {
        hints.prefersColorScheme = value
        hints.firstRequest = false
      }

      // update the color scheme cookie
      if (httpClientHintsConfiguration.prefersColorSchemeCookie) {
        if (!value || value === 'no-preference') {
          hints.colorSchemeFromCookie = httpClientHintsConfiguration.prefersColorSchemeCookie.defaultTheme
        } else {
          hints.colorSchemeFromCookie = value === 'dark'
            ? httpClientHintsConfiguration.prefersColorSchemeCookie.darkThemeName
            : httpClientHintsConfiguration.prefersColorSchemeCookie.lightThemeName
        }
      }
    }
  }

  if (hints.prefersReducedMotionAvailable && httpClientHintsConfiguration.prefersReducedMotion) {
    const value = headers[AcceptClientHintsRequestHeaders.prefersReducedMotion]
    if (value === 'no-preference' || value === 'reduce') {
      hints.prefersReducedMotion = value
      hints.firstRequest = false
    }
  }

  if (hints.viewportHeightAvailable && httpClientHintsConfiguration.viewportSize) {
    const header = headers[AcceptClientHintsRequestHeaders.viewportHeight]
    if (header) {
      hints.firstRequest = false
      try {
        hints.viewportHeight = Number.parseInt(header)
      } catch {
        hints.viewportHeight = httpClientHintsConfiguration.clientHeight
      }
    }
  } else {
    hints.viewportHeight = httpClientHintsConfiguration.clientHeight
  }

  if (hints.viewportWidthAvailable && httpClientHintsConfiguration.viewportSize) {
    const header = headers[AcceptClientHintsRequestHeaders.viewportWidth]
    if (header) {
      hints.firstRequest = false
      try {
        hints.viewportWidth = Number.parseInt(header)
      } catch {
        hints.viewportWidth = httpClientHintsConfiguration.clientWidth
      }
    }
  } else {
    hints.viewportWidth = httpClientHintsConfiguration.clientWidth
  }

  return hints
}

function writeClientHintHeaders (key: string, headers: Record<string, string[]>) {
  ClientHeaders.forEach((header) => {
    headers[header] = (headers[header] ? headers[header] : []).concat(key)
  })
}

function writeClientHintsResponseHeaders (
  clientHintsRequest: HttpClientHintsRequest,
  httpClientHintsConfiguration: HttpClientHintsConfiguration
) {
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Critical-CH
  // Each header listed in the Critical-CH header should also be present in the Accept-CH and Vary headers.

  const headers: Record<string, string[]> = {}

  if (httpClientHintsConfiguration.prefersColorScheme && clientHintsRequest.prefersColorSchemeAvailable) { writeClientHintHeaders(AcceptClientHintsHeaders.prefersColorScheme, headers) }

  if (httpClientHintsConfiguration.prefersReducedMotion && clientHintsRequest.prefersReducedMotionAvailable) { writeClientHintHeaders(AcceptClientHintsHeaders.prefersReducedMotion, headers) }

  if (httpClientHintsConfiguration.viewportSize && clientHintsRequest.viewportHeightAvailable && clientHintsRequest.viewportWidthAvailable) {
    writeClientHintHeaders(AcceptClientHintsHeaders.viewportHeight, headers)
    writeClientHintHeaders(AcceptClientHintsHeaders.viewportWidth, headers)
  }

  if (Object.keys(headers).length === 0) { return }

  const nuxtApp = useNuxtApp()
  const callback = () => {
    const event = useRequestEvent(nuxtApp)
    Object.entries(headers).forEach(([key, value]) => {
      setResponseHeader(event, key, value)
    })
  }
  const unhook = nuxtApp.hooks.hookOnce('app:rendered', callback)
  nuxtApp.hooks.hookOnce('app:error', () => {
    unhook()
    return callback()
  })
}

function writeThemeCookie (
  clientHintsRequest: HttpClientHintsRequest,
  httpClientHintsConfiguration: HttpClientHintsConfiguration
) {
  if (!httpClientHintsConfiguration.prefersColorScheme || !httpClientHintsConfiguration.prefersColorSchemeCookie) { return }

  const cookieName = httpClientHintsConfiguration.prefersColorSchemeCookie.name
  const themeName = clientHintsRequest.colorSchemeFromCookie ?? httpClientHintsConfiguration.prefersColorSchemeCookie.defaultTheme
  const path = httpClientHintsConfiguration.prefersColorSchemeCookie.path

  const date = new Date()
  const expires = new Date(date.setDate(date.getDate() + 365))
  if (!clientHintsRequest.firstRequest || !httpClientHintsConfiguration.reloadOnFirstRequest) {
    useCookie(cookieName, {
      path,
      expires,
      sameSite: 'lax'
    }).value = themeName
  }

  return `${cookieName}=${themeName}; Path=${path}; Expires=${expires.toUTCString()}; SameSite=Lax`
}
