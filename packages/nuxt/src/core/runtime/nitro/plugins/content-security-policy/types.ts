import type { NuxtOptions } from 'nuxt/schema'

export type ContentSecurityPolicyConfig = NuxtOptions['contentSecurityPolicy']

export type Section = 'body' | 'bodyAppend' | 'bodyPrepend' | 'head'
