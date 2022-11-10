import { resolve } from 'pathe'
import { distDir } from './dirs'

export interface RunTestOptions {
  rootDir: string,
  dev?: boolean,
  watch?: boolean
  runner?: 'vitest'
  globalSetup?: boolean
}

const RunTestDefaults: Partial<RunTestOptions> = {
  runner: 'vitest',
  globalSetup: true
}

export async function runTests (opts: RunTestOptions) {
  opts = { ...RunTestDefaults, ...opts }

  if (opts.runner !== 'vitest') {
    throw new Error(`Unsupported runner: ${opts.runner}. Currently only vitest runner is supported.`)
  }

  if (opts.dev) {
    // Set default dev option for @nuxt/test-utils
    process.env.NUXT_TEST_DEV = 'true'
  }

  // Consumed by recoverContextFromEnv()
  process.env.NUXT_TEST_OPTIONS = JSON.stringify(opts)

  const { startVitest } = await import('vitest/node')
  const succeeded = await startVitest(
    'test',
    [] /* argv */,
    // Vitest options
    {
      root: opts.rootDir,
      run: !opts.watch,
      deps: {
        inline: [/@nuxt\/test-utils/]
      }
    },
    // Vite options
    {
      esbuild: {
        tsconfigRaw: '{}'
      },
      test: {
        dir: opts.rootDir,
        deps: {
          inline: [
            distDir,
            '@nuxt/test-utils',
            '@nuxt/test-utils-edge'
          ]
        },
        globals: true,
        globalSetup: [
          ...opts.globalSetup ? [resolve(distDir, './runtime/global-setup')] : []
        ]
      }
    }
  )

  if (!succeeded) {
    process.exit(1)
  }
}
