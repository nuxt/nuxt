/**
 * [HTTP Client Hints](https://developer.mozilla.org/en-US/docs/Web/HTTP/Client_hints) configuration.
 */
export interface HttpClientHints {
  /**
   * Enable HTTP Client Hints.
   *
   * @default false
   */
  enabled: boolean
  /**
   * Enable viewport size detection?.
   *
   * @see https://wicg.github.io/responsive-image-client-hints/#sec-ch-viewport-width
   * @see https://wicg.github.io/responsive-image-client-hints/#sec-ch-viewport-height
   * @default false
   */
  viewportSize: boolean
  /**
   * Enable prefers-reduced-motion detection?.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-CH-Prefers-Reduced-Motion
   * @default false
   */
  prefersReducedMotion: boolean
  /**
   * Enable prefers-color-scheme detection?.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-CH-Prefers-Color-Scheme
   * @default false
   */
  prefersColorScheme: boolean | 'custom'
  /**
   * Cookie options for prefers-color-scheme.
   */
  prefersColorSchemeCookie?: {
    /**
     * The cookie path.
     *
     * @default '/'
     */
    path: string
    /**
     * The cookie name.
     *
     * @default 'color-scheme'
     */
    name: string
    /**
     * The default theme.
     *
     * @default 'dark'
     */
    defaultTheme: string
    /**
     * The theme name to be used when the user's preference is dark.
     *
     * @default 'dark'
     */
    darkThemeName: string
    /**
     * The theme name to be used when the user's preference is light or unset.
     *
     * @default 'light'
     */
    lightThemeName: string
    /**
     * Available theme names.
     *
     * @default ['dark', 'light']
     */
    themeNames: string[]
    /**
     * This flag can be used when your application provides a custom dark and light themes,
     * but will not provide a theme selector.
     *
     * For example, the theme selector will be the one provided by the browser.
     *
     * @default false
     */
    useBrowserThemeOnly: boolean
  }
}
