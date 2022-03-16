export interface RunTestOptions {
  rootDir: string,
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
  const { startVitest } = await import('vitest/dist/node.js')
  const succeeded = await startVitest(
    [] /* argv */,
    // Vitest options
    {
      root: opts.rootDir,
      run: true
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
