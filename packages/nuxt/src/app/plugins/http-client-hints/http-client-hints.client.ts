import { readonly } from 'vue'
import type { HttpClientHintsConfiguration, HttpClientHintsRequest } from './types'
import { NuxtHTTPClientHintsState } from './types'
import { defineNuxtPlugin, useRuntimeConfig } from '#app/nuxt'
import { useState } from '#app/composables/state'
import { reloadNuxtApp } from '#app/composables/chunk'

export default defineNuxtPlugin<{ httpClientHints: HttpClientHintsRequest }>({
  name: 'nuxt:http-client-hints:client',
  enforce: 'pre',
  setup () {
    const httpClientHints = useState<HttpClientHintsRequest>(NuxtHTTPClientHintsState)

    const {
      firstRequest,
      prefersColorSchemeAvailable,
      prefersReducedMotionAvailable,
      viewportHeightAvailable,
      viewportWidthAvailable
    } = httpClientHints.value

    const httpClientHintsConfiguration = useRuntimeConfig().public.httpClientHints as HttpClientHintsConfiguration

    const {
      reloadOnFirstRequest,
      viewportSize,
      prefersReducedMotion,
      prefersColorScheme,
      prefersColorSchemeCookie
    } = httpClientHintsConfiguration

    // reload the page when it is the first request, explicitly configured, and any feature available
    if (firstRequest && reloadOnFirstRequest) {
      if (prefersColorScheme) {
        const themeCookie = httpClientHints.value.colorSchemeCookie
        // write the cookie and refresh the page if configured
        if (prefersColorSchemeCookie && themeCookie) {
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          const cookieName = prefersColorSchemeCookie.name
          const parseCookieName = `${cookieName}=`
          const cookieEntry = `${parseCookieName}${themeCookie ?? prefersColorSchemeCookie.defaultTheme};`
          const newThemeName = prefersDark ? prefersColorSchemeCookie.darkThemeName : prefersColorSchemeCookie.lightThemeName
          document.cookie = themeCookie.replace(cookieEntry, `${cookieName}=${newThemeName};`)
          reloadNuxtApp({ force: true })
        } else if (prefersColorSchemeAvailable) {
          reloadNuxtApp({ force: true })
        }
      }

      if (prefersReducedMotion && prefersReducedMotionAvailable) { reloadNuxtApp({ force: true }) }

      if (viewportSize && viewportHeightAvailable) { reloadNuxtApp({ force: true }) }

      if (viewportSize && viewportWidthAvailable) { reloadNuxtApp({ force: true }) }
    }

    return {
      provide: readonly({
        httpClientHints,
        httpClientHintsConfiguration
      })
    }
  }
})
