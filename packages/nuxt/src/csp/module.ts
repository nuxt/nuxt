import { addServerPlugin, defineNuxtModule } from '@nuxt/kit'
import { resolve } from 'pathe'

import defu from 'defu'
import { defaultCSPConfig, defuReplaceArray, hashBundledAssets } from './utils'
import type { ContentSecurityPolicyConfig } from './types'
import { distDir } from '../dirs'

export default defineNuxtModule<Partial<ContentSecurityPolicyConfig>>({
  meta: {
    name: 'nuxt:csp',
    configKey: 'csp',
  },
  defaults: defaultCSPConfig,
  setup (options, nuxt) {
    const contentSecurityPolicyConfig: ContentSecurityPolicyConfig = defuReplaceArray({ ...nuxt.options.csp }, { ...defaultCSPConfig })

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

    // Set CSP response headers
    addServerPlugin(resolve(distDir, 'csp/runtime/nitro/plugins'))

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
