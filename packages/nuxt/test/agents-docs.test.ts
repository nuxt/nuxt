import { describe, expect, it } from 'vitest'
import { generateAgentsBlock, mergeAgentsContent } from '../src/core/agents.ts'

describe('agents docs', () => {
  describe('generateAgentsBlock', () => {
    it('includes the resolved docs path and version, wrapped in managed markers', () => {
      const block = generateAgentsBlock('node_modules/@nuxt/docs/', '4.3.1')

      expect(block).toContain('<!-- nuxt:agents-docs:start -->')
      expect(block).toContain('<!-- nuxt:agents-docs:end -->')
      expect(block).toContain('Nuxt v4.3.1')
      expect(block).toContain('node_modules/@nuxt/docs/')
    })
  })

  describe('mergeAgentsContent', () => {
    const block = generateAgentsBlock('node_modules/@nuxt/docs/', '4.3.1')

    it('uses just the block when the file does not exist yet', () => {
      expect(mergeAgentsContent('', block)).toBe(`${block}\n`)
    })

    it('appends the block, preserving hand-written content, when no managed block exists yet', () => {
      const existing = '# My project\n\nSome instructions for agents.\n'
      const result = mergeAgentsContent(existing, block)

      expect(result).toContain('# My project')
      expect(result).toContain('Some instructions for agents.')
      expect(result).toContain(block)
      expect(result.indexOf('# My project')).toBeLessThan(result.indexOf(block))
    })

    it('replaces only the managed block, preserving content before and after it', () => {
      const oldBlock = generateAgentsBlock('node_modules/@nuxt/docs/', '4.3.0')
      const existing = `# My project\n\n${oldBlock}\n\nMore hand-written notes.\n`

      const result = mergeAgentsContent(existing, block)

      expect(result).toContain('# My project')
      expect(result).toContain('More hand-written notes.')
      expect(result).toContain(block)
      expect(result).not.toContain('4.3.0')
    })

    it('is idempotent: merging the same block twice produces the same content', () => {
      const once = mergeAgentsContent('', block)
      const twice = mergeAgentsContent(once, block)

      expect(twice).toBe(once)
    })
  })
})
