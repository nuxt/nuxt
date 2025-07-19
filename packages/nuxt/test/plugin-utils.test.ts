import { isValidIslandKey } from "#app/plugins/utils";
import { describe, expect, it } from "vitest";
import {hash} from "ohash"
import { randomUUID } from "crypto";


describe('isValidIslandKey util', () => {
    it('should accept valid island keys', () => {
        // Valid keys following the componentName_hashId pattern
        expect(isValidIslandKey('MyComponent_abc123')).toBe(true)
        expect(isValidIslandKey('UserCard_def456')).toBe(true)
        expect(isValidIslandKey('NavBar_xyz789')).toBe(true)
        expect(isValidIslandKey('A_1')).toBe(true)
        expect(isValidIslandKey('Component123_hash456')).toBe(true)
        expect(isValidIslandKey('my-component_hash123')).toBe(true)
        expect(isValidIslandKey('Component-Name_hash123')).toBe(true)
        expect(isValidIslandKey('ComponentName_' + hash(
            {
                props: randomUUID()
            }
        ))).toBe(true)
    })

    it('should reject invalid island keys', () => {
        // Empty or null/undefined
        expect(isValidIslandKey('')).toBe(false)
        expect(isValidIslandKey(null as any)).toBe(false)
        expect(isValidIslandKey(undefined as any)).toBe(false)

        // Missing underscore separator
        expect(isValidIslandKey('ComponentName')).toBe(false)
        expect(isValidIslandKey('hash123')).toBe(false)

        // Invalid characters
        expect(isValidIslandKey('Component/Name_hash123')).toBe(false)
        expect(isValidIslandKey('Component\\Name_hash123')).toBe(false)
        expect(isValidIslandKey('Component..Name_hash123')).toBe(false)
        expect(isValidIslandKey('Component Name_hash123')).toBe(false)
        expect(isValidIslandKey('Component<script>_hash123')).toBe(false)
        expect(isValidIslandKey('Component"_hash123')).toBe(false)
        expect(isValidIslandKey("Component'_hash123")).toBe(false)

        // Starting with invalid characters
        expect(isValidIslandKey('123Component_hash123')).toBe(false)
        expect(isValidIslandKey('_Component_hash123')).toBe(false)
        expect(isValidIslandKey('-Component_hash123')).toBe(false)

        // Path traversal attempts
        expect(isValidIslandKey('../Component_hash123')).toBe(false)
        expect(isValidIslandKey('../../Component_hash123')).toBe(false)
        expect(isValidIslandKey('Component_../hash123')).toBe(false)
        expect(isValidIslandKey('Component_../../hash123')).toBe(false)

        // URL/protocol attempts
        expect(isValidIslandKey('http://evil.com_hash123')).toBe(false)
        expect(isValidIslandKey('file:///etc/passwd_hash123')).toBe(false)
        expect(isValidIslandKey('Component_http://evil.com')).toBe(false)

        const longKey = 'A'.repeat(95) + '_' + 'B'.repeat(10)
        expect(isValidIslandKey(longKey)).toBe(false)

        expect(isValidIslandKey('Component_Name_hash123')).toBe(false)
        expect(isValidIslandKey('Component__hash123')).toBe(false)
    })

    it('should handle edge cases', () => {
        // Maximum allowed length (100 chars)
        const maxLengthKey = 'A'.repeat(94) + '_' + 'B'.repeat(5) // 100 chars total
        expect(isValidIslandKey(maxLengthKey)).toBe(true)

        // Just over maximum length
        const overLengthKey = 'A'.repeat(95) + '_' + 'B'.repeat(6) // 102 chars total
        expect(isValidIslandKey(overLengthKey)).toBe(false)

        // Minimum valid length
        expect(isValidIslandKey('A_1')).toBe(true)

        // Single character component name with long hash
        expect(isValidIslandKey('A_' + 'B'.repeat(97))).toBe(true) // 100 chars total
    })

    it('should reject non-string inputs', () => {
        expect(isValidIslandKey(123 as any)).toBe(false)
        expect(isValidIslandKey({} as any)).toBe(false)
        expect(isValidIslandKey([] as any)).toBe(false)
        expect(isValidIslandKey(true as any)).toBe(false)
        expect(isValidIslandKey(Symbol('test') as any)).toBe(false)
    })
})
