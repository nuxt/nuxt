/**
 * NuxtConfigurationEnv
 * Documentation: https://nuxtjs.org/api/configuration-css
 */

interface NuxtConfigurationCssObject {
  src: string
  lang: string | 'stylus' | 'sass' | 'scss' | 'less' | 'css'
}

export type NuxtConfigurationCSS = Array<string | NuxtConfigurationCssObject>
