import { describe, expect, it } from 'vitest'
import { resolveBadgeVersion, resolveSinceVersion, stampDocument, stampSource } from './_unreleased-version'

describe('resolveBadgeVersion', () => {
  it('names the minor for a minor release', () => {
    expect(resolveBadgeVersion('4.6.0')).toBe('4.6')
  })

  it('keeps the patch when a feature ships in one', () => {
    expect(resolveBadgeVersion('4.5.2')).toBe('4.5.2')
  })

  it('drops the badge for the first release of a major', () => {
    expect(resolveBadgeVersion('5.0.0')).toBeUndefined()
    expect(resolveBadgeVersion('5.0.0-alpha.1')).toBeUndefined()
  })

  it('throws on an unparseable version', () => {
    expect(() => resolveBadgeVersion('not-a-version')).toThrow()
  })
})

describe('stampDocument', () => {
  it('stamps inline badges', () => {
    const content = '## Named Views :versionBadge{version="unreleased"}\n'
    expect(stampDocument(content, '4.6')).toBe('## Named Views :versionBadge{version="4.6"}\n')
  })

  it('leaves badges that already name a version', () => {
    const content = '## Named Views :versionBadge{version="4.5"}\n'
    expect(stampDocument(content, '4.6')).toBe(content)
  })

  it('preserves other badge attributes', () => {
    const content = ':versionBadge{version=\'unreleased\' size="sm"}\n'
    expect(stampDocument(content, '4.6')).toBe(':versionBadge{version="4.6" size="sm"}\n')
  })

  it('stamps the frontmatter field, quoted or not', () => {
    const content = '---\ntitle: "useLayout"\nminimalVersion: unreleased\n---\n\nBody\n'
    expect(stampDocument(content, '4.6')).toBe('---\ntitle: "useLayout"\nminimalVersion: "4.6"\n---\n\nBody\n')
    expect(stampDocument(content.replace('unreleased', '"unreleased"'), '4.6')).toContain('minimalVersion: "4.6"')
  })

  it('ignores `minimalVersion` outside the frontmatter', () => {
    const content = '---\ntitle: "useLayout"\n---\n\n`minimalVersion: unreleased` is a placeholder.\n'
    expect(stampDocument(content, '4.6')).toBe(content)
  })

  it('removes badges without leaving stray whitespace when the version is the baseline', () => {
    expect(stampDocument('## Named Views :versionBadge{version="unreleased"}\n', undefined))
      .toBe('## Named Views\n')
    expect(stampDocument('Set layouts in route rules: :versionBadge{version="unreleased"}\n', undefined))
      .toBe('Set layouts in route rules:\n')
    expect(stampDocument('| `timeout` :versionBadge{version="unreleased"} | `number` |\n', undefined))
      .toBe('| `timeout` | `number` |\n')
  })

  it('removes the frontmatter field when the version is the baseline', () => {
    const content = '---\ntitle: "useLayout"\nminimalVersion: unreleased\n---\n\nBody\n'
    expect(stampDocument(content, undefined)).toBe('---\ntitle: "useLayout"\n---\n\nBody\n')
  })

  it('leaves badges inside inline code alone - they document the syntax', () => {
    const content = 'Add a badge: `:versionBadge{version="unreleased"}` next to the option.\n'
    expect(stampDocument(content, '4.6')).toBe(content)
    expect(stampDocument(content, undefined)).toBe(content)
  })

  it('leaves badges inside fenced code blocks alone', () => {
    const content = '```md\n## Named Views :versionBadge{version="unreleased"}\n```\n'
    expect(stampDocument(content, '4.6')).toBe(content)
    expect(stampDocument(content, undefined)).toBe(content)
  })

  it('still stamps a badge on a line that also contains inline code', () => {
    const content = '| `timeout` :versionBadge{version="unreleased"} | `number` |\n'
    expect(stampDocument(content, '4.6')).toBe('| `timeout` :versionBadge{version="4.6"} | `number` |\n')
  })

  it('leaves documents without placeholders untouched', () => {
    const content = '---\ntitle: "useLayout"\nminimalVersion: "4.5"\n---\n\nBody :versionBadge{version="4.5"}\n'
    expect(stampDocument(content, '4.6')).toBe(content)
    expect(stampDocument(content, undefined)).toBe(content)
  })
})

describe('resolveSinceVersion', () => {
  it('names the full release, matching the existing tags', () => {
    expect(resolveSinceVersion('4.6.0')).toBe('4.6.0')
    expect(resolveSinceVersion('4.5.2')).toBe('4.5.2')
  })

  it('names the release a prerelease leads up to', () => {
    expect(resolveSinceVersion('5.0.0-alpha.1')).toBe('5.0.0')
  })

  it('is never dropped for the first release of a major', () => {
    expect(resolveSinceVersion('5.0.0')).toBe('5.0.0')
  })

  it('throws on an unparseable version', () => {
    expect(() => resolveSinceVersion('not-a-version')).toThrow()
  })
})

describe('stampSource', () => {
  it('stamps a single-line tag', () => {
    expect(stampSource('/** @since unreleased */\n', '4.6.0')).toBe('/** @since 4.6.0 */\n')
  })

  it('stamps a tag in a multi-line block, keeping the rest of the comment', () => {
    const content = [
      '/**',
      ' * Returns the layout resolved for the current route.',
      ' * @since unreleased',
      ' */',
      'export function useLayout () {}',
      '',
    ].join('\n')

    expect(stampSource(content, '4.6.0')).toBe(content.replace('@since unreleased', '@since 4.6.0'))
  })

  it('stamps every occurrence in a file', () => {
    const content = '/** @since unreleased */\nconst a = 1\n/** @since unreleased */\nconst b = 2\n'
    expect(stampSource(content, '4.6.0')).toBe('/** @since 4.6.0 */\nconst a = 1\n/** @since 4.6.0 */\nconst b = 2\n')
  })

  it('leaves tags that already name a version', () => {
    const content = '/** @since 3.9.0 */\n'
    expect(stampSource(content, '4.6.0')).toBe(content)
  })

  it('does not touch other placeholder-looking text', () => {
    const content = '/** Reset an unreleased state */\nconst since = \'unreleased\'\n'
    expect(stampSource(content, '4.6.0')).toBe(content)
  })
})
