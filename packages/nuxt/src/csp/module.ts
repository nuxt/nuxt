import { addServerPlugin, defineNuxtModule } from '@nuxt/kit'
import { resolve } from 'pathe'

import defu from 'defu'
import { defaultCSPConfig, defuReplaceArray, hashBundledAssets } from './runtime/nitro/utils/index.ts'
import type { ContentSecurityPolicyConfig } from './types/index.ts'
import { distDir } from '../dirs.ts'
import { logger } from '../utils.ts'

export default defineNuxtModule<Partial<ContentSecurityPolicyConfig>>({
  meta: {
    name: 'nuxt:csp',
    configKey: 'csp',
  },
  defaults: defaultCSPConfig,
  setup (options, nuxt) {
    if (options.value === false) {
      return
    }

    let cspConfig = defaultCSPConfig

    if (nuxt.options.csp.strict) {
      cspConfig = {
        value: {
          'base-uri': ['\'none\''],
          'font-src': ['\'self\'', 'https:', 'data:'],
          'form-action': ['\'self\''],
          'frame-ancestors': ['\'self\''],
          'img-src': ['\'self\'', 'data:'],
          'object-src': ['\'none\''],
          'script-src-attr': ['\'none\''],
          'style-src': ['\'self\'', 'https:', '\'unsafe-inline\''],
          'script-src': ['\'self\'', 'https:', '\'unsafe-inline\'', '\'strict-dynamic\'', '\'nonce-{{nonce}}\''],
          'upgrade-insecure-requests': true,
        },
        strict: true,
        reportOnly: false,
        nonce: true,
        sri: true,
        ssg: {
          meta: true,
          hashScripts: true,
          hashStyles: false,
        },
      }
    }

    const contentSecurityPolicyConfig: ContentSecurityPolicyConfig = defuReplaceArray({ ...nuxt.options.csp }, { ...cspConfig })

    // Warn if reportOnly is used with ssg.meta, as meta tags don't support Content-Security-Policy-Report-Only
    if (contentSecurityPolicyConfig.reportOnly && contentSecurityPolicyConfig.ssg?.meta) {
      logger.warn('`reportOnly` is ignored for SSG meta tags. The `Content-Security-Policy-Report-Only` header is not supported inside a `<meta>` element.')
    }

    nuxt.options.nitro.virtual = defu(
      {
        '#content-security-policy': () => `export default ${JSON.stringify(contentSecurityPolicyConfig)}`,
      },
      nuxt.options.nitro.virtual,
    )

    // Record SRI Hashes in the Virtual File System at build time
    if (contentSecurityPolicyConfig.sri) {
      let sriHashes: Record<string, string> = {}
      nuxt.options.nitro.virtual = defu(
        {
          '#sri-hashes': () => `export default ${JSON.stringify(sriHashes)}`,
        },
        nuxt.options.nitro.virtual,
      )
      nuxt.hook('nitro:build:before', async (nitro) => {
        sriHashes = await hashBundledAssets(nitro)
      })
    }

    if (contentSecurityPolicyConfig.nonce) {
      addServerPlugin(resolve(distDir, 'csp/runtime/nitro/plugins/nonce'))
    }

    if (contentSecurityPolicyConfig.ssg?.meta) {
      addServerPlugin(resolve(distDir, 'csp/runtime/nitro/plugins/meta'))
    }

    if (contentSecurityPolicyConfig.ssg?.hashScripts || contentSecurityPolicyConfig.ssg?.hashStyles) {
      addServerPlugin(resolve(distDir, 'csp/runtime/nitro/plugins/ssg-hashes'))
    }

    if (contentSecurityPolicyConfig.sri) {
      addServerPlugin(resolve(distDir, 'csp/runtime/nitro/plugins/sri'))
    }

    addServerPlugin(resolve(distDir, 'csp/runtime/nitro/plugins/update-csp'))
  },
})
