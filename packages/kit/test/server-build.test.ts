import { describe, expect, it } from 'vitest'

import { resolveNitroDeployCommand } from '../src/internal/server-build.ts'

function options (outputDir: string) {
  return { rootDir: '/project', output: { dir: outputDir, publicDir: `${outputDir}/public` } }
}

describe('resolveNitroDeployCommand', () => {
  it.each([
    ['npx wrangler --cwd ./ pages deploy', 'npx wrangler --cwd .output/ pages deploy'],
    ['npx gh-pages --dotfiles -d ./public', 'npx gh-pages --dotfiles -d .output/public'],
    ['npx vercel deploy --prebuilt', 'npx vercel deploy --prebuilt'],
  ])('resolves the paths of a Nitro 3 command against the project root (%s)', (command, resolved) => {
    expect(resolveNitroDeployCommand(command, options('/project/.output'))).toBe(resolved)
  })

  it.each([
    ['npx wrangler pages deploy {{ output.dir }}', 'npx wrangler pages deploy .output'],
    ['npx wrangler pages deploy {{output.publicDir}}', 'npx wrangler pages deploy .output/public'],
    ['npx wrangler pages deploy {{ output.missing }}', 'npx wrangler pages deploy {{ output.missing }}'],
  ])('resolves the placeholders of a Nitro 2 command against the project root (%s)', (command, resolved) => {
    expect(resolveNitroDeployCommand(command, options('/project/.output'))).toBe(resolved)
  })

  it.each([
    ['/project/release\'s', 'npx gh-pages -d "release\'s/public"'],
    ['/project/$HOME', 'npx gh-pages -d "\\$HOME/public"'],
    ['/project/out`id`', 'npx gh-pages -d "out\\`id\\`/public"'],
    ['/project/a&b', 'npx gh-pages -d "a&b/public"'],
  ])('quotes a resolved path containing shell syntax (%s)', (outputDir, resolved) => {
    expect(resolveNitroDeployCommand('npx gh-pages -d ./public', options(outputDir))).toBe(resolved)
  })

  it('quotes a resolved path containing whitespace', () => {
    expect(resolveNitroDeployCommand('npx wrangler --cwd ./ pages deploy', options('/project/my output'))).toBe('npx wrangler --cwd "my output/" pages deploy')
    expect(resolveNitroDeployCommand('npx wrangler pages deploy {{ output.publicDir }}', options('/project/say "hi" there'))).toBe('npx wrangler pages deploy "say \\"hi\\" there/public"')
  })

  it('keeps paths relative to an output directory at the project root', () => {
    expect(resolveNitroDeployCommand('npx gh-pages -d ./public', options('/project'))).toBe('npx gh-pages -d ./public')
    expect(resolveNitroDeployCommand('npx wrangler pages deploy {{ output.dir }}', options('/project'))).toBe('npx wrangler pages deploy .')
  })

  it('returns nothing for a preset without a deploy command, or with one Nitro runs itself', () => {
    expect(resolveNitroDeployCommand(undefined, options('/project/.output'))).toBeUndefined()
    expect(resolveNitroDeployCommand(() => {}, options('/project/.output'))).toBeUndefined()
  })
})
