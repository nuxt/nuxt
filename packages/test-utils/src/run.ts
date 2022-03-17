export interface RunTestOptions {
  rootDir: string,
  dev?: boolean,
  watch?: boolean
  runner?: 'vitest'
}

const RunTestDefaults: Partial<RunTestOptions> = {
  runner: 'vitest'
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

  const { startVitest } = await import('vitest/dist/node.js')
  const succeeded = await startVitest(
    [] /* argv */,
    // Vitest options
    {
      root: opts.rootDir,
      run: !opts.watch
    },
    // Vite options
    {
      esbuild: {
        tsconfigRaw: '{}'
      }
    }
  )

  if (!succeeded) {
    process.exit(1)
  }
}
