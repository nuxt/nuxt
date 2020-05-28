/**
 * NuxtConfigurationPlugin
 * Documentation: https://nuxtjs.org/api/configuration-plugins
 *                https://nuxtjs.org/guide/plugins
 */

export type NuxtConfigurationPlugin = { mode?: 'all' | 'client' | 'server', src: string, ssr?: boolean } | string
