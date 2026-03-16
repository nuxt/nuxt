import { describe, expect, it } from 'vitest'
import type { ContentSecurityPolicyValue } from '../src/csp/types'
import {
  defuReplaceArray,
  generateHash,
  generateRandomNonce,
  headerStringFromObject,
} from '../src/csp/utils'

describe('CSP Utils', () => {
  describe('headerStringFromObject', () => {
    it('should return empty string when value is false', () => {
      const result = headerStringFromObject(false)
      expect(result).toBe('')
    })

    it('should correctly format CSP directives with array values', () => {
      const cspValue: ContentSecurityPolicyValue = {
        'default-src': ['\'self\''],
        'script-src': ['\'self\'', 'https://example.com'],
      }
      const result = headerStringFromObject(cspValue)
      expect(result).toContain('default-src \'self\';')
      expect(result).toContain('script-src \'self\' https://example.com;')
    })

    it('should correctly format CSP directives with string values', () => {
      const cspValue: ContentSecurityPolicyValue = {
        'default-src': '\'none\'',
      }
      const result = headerStringFromObject(cspValue)
      expect(result).toBe('default-src \'none\';')
    })

    it('should handle upgrade-insecure-requests boolean correctly', () => {
      const cspValue: ContentSecurityPolicyValue = {
        'upgrade-insecure-requests': true,
      }
      const result = headerStringFromObject(cspValue)
      expect(result).toBe('upgrade-insecure-requests;')
    })

    it('should filter out false values', () => {
      const cspValue: ContentSecurityPolicyValue = {
        'default-src': ['\'self\''],
        'frame-ancestors': false,
        'img-src': ['\'self\'', 'data:'],
      }
      const result = headerStringFromObject(cspValue)
      expect(result).toContain('default-src')
      expect(result).toContain('img-src')
      expect(result).not.toContain('frame-ancestors')
    })

    it('should trim whitespace from array sources', () => {
      const cspValue: ContentSecurityPolicyValue = {
        'script-src': ['  \'self\'  ', ' https://example.com '],
      }
      const result = headerStringFromObject(cspValue)
      expect(result).toContain('\'self\' https://example.com')
    })

    it('should handle complex CSP with multiple directives', () => {
      const cspValue: ContentSecurityPolicyValue = {
        'base-uri': ['\'none\''],
        'font-src': ['\'self\'', 'https:', 'data:'],
        'form-action': ['\'self\''],
        'frame-ancestors': ['\'self\''],
        'img-src': ['\'self\'', 'data:'],
        'object-src': ['\'none\''],
        'script-src-attr': ['\'none\''],
        'style-src': ['\'self\'', 'https:', '\'unsafe-inline\''],
        'script-src': ['\'self\'', 'https:', '\'unsafe-inline\'', '\'strict-dynamic\'', '\'nonce-abc123\''],
        'upgrade-insecure-requests': true,
      }
      const result = headerStringFromObject(cspValue)
      expect(result).toContain('base-uri')
      expect(result).toContain('font-src')
      expect(result).toContain('upgrade-insecure-requests;')
      expect(result.endsWith(';')).toBe(true)
    })

    it('should join directives with spaces', () => {
      const cspValue: ContentSecurityPolicyValue = {
        'default-src': ['\'self\''],
        'script-src': ['\'self\'', 'https://example.com'],
      }
      const result = headerStringFromObject(cspValue)
      expect(result).toMatch(/;.*?;/)
    })
  })

  describe('defuReplaceArray', () => {
    it('should replace arrays in target object with new array values', () => {
      const defaultConfig = {
        fonts: ['arial', 'sans-serif'],
        size: 12,
      }
      const customConfig = {
        fonts: ['roboto', 'monospace'],
      }

      const res = defuReplaceArray({ ...customConfig }, { ...defaultConfig })

      expect(res.fonts).toEqual(['roboto', 'monospace'])
    })

    it('should replace non-array values with new array values', () => {
      const defaultConfig = {
        values: 'single-value',
      }
      const customConfig = {
        values: ['first', 'second'],
      }

      const res = defuReplaceArray({ ...customConfig }, { ...defaultConfig })

      expect(res.values).toEqual(['first', 'second'])
    })

    it('should replace array values with non-array values', () => {
      const defaultConfig = {
        value: ['first', 'second'],
      }
      const customConfig = {
        value: 'single-value',
      }

      const res = defuReplaceArray({ ...customConfig }, { ...defaultConfig })

      expect(res.value).toBe('single-value')
    })

    it('should handle empty arrays', () => {
      const defaultConfig = {
        items: ['a', 'b', 'c'],
      }
      const customConfig = {
        items: [],
      }

      const res = defuReplaceArray({ ...customConfig }, { ...defaultConfig })

      expect(res.items).toEqual([])
    })

    it('should handle nested array values', () => {
      const defaultConfig = {
        nested: [['a', 'b'], ['c', 'd']],
      }
      const customConfig = {
        nested: [['x', 'y'], ['z']],
      }

      const res = defuReplaceArray({ ...customConfig }, { ...defaultConfig })

      expect(res.nested).toEqual([['x', 'y'], ['z']])
    })
  })

  describe('generateRandomNonce', () => {
    it('should generate a nonce string', () => {
      const nonce = generateRandomNonce()
      expect(typeof nonce).toBe('string')
      expect(nonce.length).toBeGreaterThan(0)
    })

    it('should generate a nonce with length 24', () => {
      const nonce = generateRandomNonce()
      expect(nonce).toHaveLength(24)
    })

    it('should generate a valid base64 encoded string', () => {
      const nonce = generateRandomNonce()
      // Base64 regex pattern
      const base64Regex = /^[A-Z0-9+/]*={0,2}$/i
      expect(nonce).toMatch(base64Regex)
    })

    it('should generate different nonces on each call', () => {
      const nonce1 = generateRandomNonce()
      const nonce2 = generateRandomNonce()
      const nonce3 = generateRandomNonce()

      expect(nonce1).not.toBe(nonce2)
      expect(nonce2).not.toBe(nonce3)
      expect(nonce1).not.toBe(nonce3)
    })

    it('should generate cryptographically random values', () => {
      const nonces = Array.from({ length: 10 }, () => generateRandomNonce())
      const uniqueNonces = new Set(nonces)

      // With 10 random nonces, we should have 10 unique values
      expect(uniqueNonces.size).toBe(10)
    })
  })

  describe('generateHash', () => {
    it('should generate SHA-384 hash for buffer content', async () => {
      const content = Buffer.from('hello world')
      const hash = await generateHash(content, 'SHA-384')

      expect(typeof hash).toBe('string')
      expect(hash).toMatch(/^sha384-/)
    })

    it('should generate SHA-384 hash for string content', async () => {
      const content = 'hello world'
      const hash = await generateHash(content, 'SHA-384')

      expect(typeof hash).toBe('string')
      expect(hash).toMatch(/^sha384-/)
      expect(hash.startsWith('sha384-')).toBe(true)
    })

    it('should generate SHA-256 hash', async () => {
      const content = 'test content'
      const hash = await generateHash(content, 'SHA-256')

      expect(hash).toMatch(/^sha256-/)
    })

    it('should generate SHA-512 hash', async () => {
      const content = 'test content'
      const hash = await generateHash(content, 'SHA-512')

      expect(hash).toMatch(/^sha512-/)
    })

    it('should produce consistent hash for same content', async () => {
      const content = 'consistent content'
      const hash1 = await generateHash(content, 'SHA-384')
      const hash2 = await generateHash(content, 'SHA-384')

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different content', async () => {
      const hash1 = await generateHash('content1', 'SHA-384')
      const hash2 = await generateHash('content2', 'SHA-384')

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hashes for different algorithms', async () => {
      const content = 'test content'
      const hash256 = await generateHash(content, 'SHA-256')
      const hash384 = await generateHash(content, 'SHA-384')
      const hash512 = await generateHash(content, 'SHA-512')

      expect(hash256).not.toBe(hash384)
      expect(hash384).not.toBe(hash512)
      expect(hash256).not.toBe(hash512)
    })

    it('should handle empty content', async () => {
      const hash = await generateHash('', 'SHA-384')

      expect(hash).toMatch(/^sha384-/)
      expect(hash.length).toBeGreaterThan(7) // 'sha384-' is 7 chars
    })

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(10000)
      const hash = await generateHash(largeContent, 'SHA-384')

      expect(hash).toMatch(/^sha384-/)
      expect(typeof hash).toBe('string')
    })

    it('should handle content with special characters', async () => {
      const content = '<script>alert("xss")</script>'
      const hash = await generateHash(content, 'SHA-384')

      expect(hash).toMatch(/^sha384-/)
    })

    it('should generate valid base64 hash values', async () => {
      const content = 'test'
      const hash = await generateHash(content, 'SHA-384')
      const base64Part = hash.replace('sha384-', '')

      // Base64 regex pattern
      const base64Regex = /^[A-Z0-9+/]*={0,2}$/i
      expect(base64Part).toMatch(base64Regex)
    })

    it('should handle buffer and string content identically', async () => {
      const content = 'test content'
      const hashFromString = await generateHash(content, 'SHA-384')
      const hashFromBuffer = await generateHash(Buffer.from(content), 'SHA-384')

      expect(hashFromString).toBe(hashFromBuffer)
    })
  })
})
