import type { UseScriptInput } from '@unhead/vue/scripts'
import { createError } from './error'

function renderStubMessage (name: string) {
  const message = `\`${name}\` is provided by @nuxt/scripts. Check your console to install it or run 'npx nuxt module add @nuxt/scripts' to install it.`
  if (import.meta.client) {
    throw createError({
      fatal: true,
      statusCode: 500,
      statusMessage: message,
    })
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScript<T extends Record<string | symbol, any>> (input: UseScriptInput, options?: Record<string, unknown>) {
  renderStubMessage('useScript')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptTriggerElement (...args: unknown[]) {
  renderStubMessage('useScriptTriggerElement')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptTriggerConsent (...args: unknown[]) {
  renderStubMessage('useScriptTriggerConsent')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptEventPage (...args: unknown[]) {
  renderStubMessage('useScriptEventPage')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleAnalytics (...args: unknown[]) {
  renderStubMessage('useScriptGoogleAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptPlausibleAnalytics (...args: unknown[]) {
  renderStubMessage('useScriptPlausibleAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptCloudflareWebAnalytics (...args: unknown[]) {
  renderStubMessage('useScriptCloudflareWebAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptCrisp (...args: unknown[]) {
  renderStubMessage('useScriptCrisp')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptFathomAnalytics (...args: unknown[]) {
  renderStubMessage('useScriptFathomAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptMatomoAnalytics (...args: unknown[]) {
  renderStubMessage('useScriptMatomoAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleTagManager (...args: unknown[]) {
  renderStubMessage('useScriptGoogleTagManager')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptSegment (...args: unknown[]) {
  renderStubMessage('useScriptSegment')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptClarity (...args: unknown[]) {
  renderStubMessage('useScriptClarity')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptMetaPixel (...args: unknown[]) {
  renderStubMessage('useScriptMetaPixel')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptXPixel (...args: unknown[]) {
  renderStubMessage('useScriptXPixel')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptIntercom (...args: unknown[]) {
  renderStubMessage('useScriptIntercom')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptHotjar (...args: unknown[]) {
  renderStubMessage('useScriptHotjar')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptStripe (...args: unknown[]) {
  renderStubMessage('useScriptStripe')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptLemonSqueezy (...args: unknown[]) {
  renderStubMessage('useScriptLemonSqueezy')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptVimeoPlayer (...args: unknown[]) {
  renderStubMessage('useScriptVimeoPlayer')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptYouTubeIframe (...args: unknown[]) {
  renderStubMessage('useScriptYouTubeIframe')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleMaps (...args: unknown[]) {
  renderStubMessage('useScriptGoogleMaps')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptNpm (...args: unknown[]) {
  renderStubMessage('useScriptNpm')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleAdsense (...args: unknown[]) {
  renderStubMessage('useScriptGoogleAdsense')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptYouTubePlayer (...args: unknown[]) {
  renderStubMessage('useScriptYouTubePlayer')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptUmamiAnalytics (...args: unknown[]) {
  renderStubMessage('useScriptUmamiAnalytics')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptSnapchatPixel (...args: unknown[]) {
  renderStubMessage('useScriptSnapchatPixel')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptRybbitAnalytics (...args: unknown[]) {
  renderStubMessage('useScriptRybbitAnalytics')
}
