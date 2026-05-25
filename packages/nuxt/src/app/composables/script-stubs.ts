import type { UseScriptInput } from '@unhead/vue/scripts'
import { createError } from './error'

function renderStubMessage (name: string): void {
  const message = `\`${name}\` is provided by @nuxt/scripts. Check your console to install it or run 'npx nuxt module add @nuxt/scripts' to install it.`
  if (import.meta.client) {
    throw createError({
      fatal: true,
      status: 500,
      statusText: message,
    })
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScript<T extends Record<string | symbol, any>> (input: UseScriptInput, options?: Record<string, unknown>): void {
  renderStubMessage('useScript')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptTriggerElement (...args: unknown[]): void {
  renderStubMessage('useScriptTriggerElement')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptTriggerConsent (...args: unknown[]): void {
  renderStubMessage('useScriptTriggerConsent')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptEventPage (...args: unknown[]): void {
  renderStubMessage('useScriptEventPage')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptGoogleAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptPlausibleAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptPlausibleAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptCloudflareWebAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptCloudflareWebAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptCrisp (...args: unknown[]): void {
  renderStubMessage('useScriptCrisp')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptFathomAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptFathomAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptMatomoAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptMatomoAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleTagManager (...args: unknown[]): void {
  renderStubMessage('useScriptGoogleTagManager')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptSegment (...args: unknown[]): void {
  renderStubMessage('useScriptSegment')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptClarity (...args: unknown[]): void {
  renderStubMessage('useScriptClarity')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptMetaPixel (...args: unknown[]): void {
  renderStubMessage('useScriptMetaPixel')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptXPixel (...args: unknown[]): void {
  renderStubMessage('useScriptXPixel')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptIntercom (...args: unknown[]): void {
  renderStubMessage('useScriptIntercom')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptHotjar (...args: unknown[]): void {
  renderStubMessage('useScriptHotjar')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptStripe (...args: unknown[]): void {
  renderStubMessage('useScriptStripe')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptLemonSqueezy (...args: unknown[]): void {
  renderStubMessage('useScriptLemonSqueezy')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptVimeoPlayer (...args: unknown[]): void {
  renderStubMessage('useScriptVimeoPlayer')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptYouTubeIframe (...args: unknown[]): void {
  renderStubMessage('useScriptYouTubeIframe')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleMaps (...args: unknown[]): void {
  renderStubMessage('useScriptGoogleMaps')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptNpm (...args: unknown[]): void {
  renderStubMessage('useScriptNpm')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleAdsense (...args: unknown[]): void {
  renderStubMessage('useScriptGoogleAdsense')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptYouTubePlayer (...args: unknown[]): void {
  renderStubMessage('useScriptYouTubePlayer')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptUmamiAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptUmamiAnalytics')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptSnapchatPixel (...args: unknown[]): void {
  renderStubMessage('useScriptSnapchatPixel')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptRybbitAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptRybbitAnalytics')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptDatabuddyAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptDatabuddyAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptRedditPixel (...args: unknown[]): void {
  renderStubMessage('useScriptRedditPixel')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptPayPal (...args: unknown[]): void {
  renderStubMessage('useScriptPayPal')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptVercelAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptVercelAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptPostHog (...args: unknown[]): void {
  renderStubMessage('useScriptPostHog')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptMixpanelAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptMixpanelAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptBingUet (...args: unknown[]): void {
  renderStubMessage('useScriptBingUet')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptTikTokPixel (...args: unknown[]): void {
  renderStubMessage('useScriptTikTokPixel')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleRecaptcha (...args: unknown[]): void {
  renderStubMessage('useScriptGoogleRecaptcha')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGoogleSignIn (...args: unknown[]): void {
  renderStubMessage('useScriptGoogleSignIn')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptGravatar (...args: unknown[]): void {
  renderStubMessage('useScriptGravatar')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptAhrefsAnalytics (...args: unknown[]): void {
  renderStubMessage('useScriptAhrefsAnalytics')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptLinkedInInsight (...args: unknown[]): void {
  renderStubMessage('useScriptLinkedInInsight')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptCalendly (...args: unknown[]): void {
  renderStubMessage('useScriptCalendly')
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useScriptUsercentrics (...args: unknown[]): void {
  renderStubMessage('useScriptUsercentrics')
}
