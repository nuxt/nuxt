import type { NuxtOptions } from 'nuxt/schema'

export type ContentSecurityPolicyConfig = NuxtOptions['csp']

export type ContentSecurityPolicyValue = NuxtOptions['csp']['value']

export type Section = 'body' | 'bodyAppend' | 'bodyPrepend' | 'head'
