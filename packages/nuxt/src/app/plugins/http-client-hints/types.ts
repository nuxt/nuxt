export interface HttpClientHintsInfo {
  firstRequest: boolean
  prefersColorSchemeAvailable: boolean
  prefersReducedMotionAvailable: boolean
  viewportHeightAvailable: boolean
  viewportWidthAvailable: boolean
}
export interface HttpClientHintsRequest extends HttpClientHintsInfo {
  prefersColorScheme?: 'dark' | 'light' | 'no-preference'
  prefersReducedMotion?: 'no-preference' | 'reduce'
  viewportHeight?: number
  viewportWidth?: number
  colorSchemeFromCookie?: string
  colorSchemeCookie?: string
}

export interface HttpClientHintsConfiguration {
  reloadOnFirstRequest: boolean
  viewportSize: boolean
  prefersColorScheme: boolean
  prefersReducedMotion: boolean
  clientWidth?: number
  clientHeight?: number
  prefersColorSchemeCookie?: {
    path: string
    name: string
    themeNames: string[]
    darkThemeName: string
    lightThemeName: string
    defaultTheme: string
    useBrowserThemeOnly: boolean
  }
}

export const NuxtHTTPClientHintsState = 'nuxt:http-client-hints:state'
