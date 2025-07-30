import type { NuxtOptions } from 'nuxt/schema'

export type ContentSecurityPolicyConfig = NuxtOptions['contentSecurityPolicy']

export type ContentSecurityPolicyValue = NuxtOptions['contentSecurityPolicy']['value']

export type Section = 'body' | 'bodyAppend' | 'bodyPrepend' | 'head'
