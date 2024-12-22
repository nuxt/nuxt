import { describe, expect, it } from 'vitest'

import { extractRouteRules } from '../src/pages/route-rules'

describe('route-rules', () => {
  it('should extract route rules from pages', async () => {
    for (const [path, code] of Object.entries(examples)) {
      const result = await extractRouteRules(code, path)

      expect(result).toStrictEqual({
        'prerender': true,
      })
    }
  })
})

const examples = {
  // vue component with two script blocks
  'app.vue': `
<template>
  <div></div>
</template>

<script>
export default {}
</script>

<script setup lang="ts">
defineRouteRules({
  prerender: true
})
</script>
      `,
  // vue component with a normal script block, and defineRouteRules ambiently
  'component.vue': `

<script>
defineRouteRules({
  prerender: true
})
export default {
  setup() {}
}
</script>
      `,
// TODO: JS component with defineRouteRules within a setup function
//   'component.ts': `
// export default {
//   setup() {
//     defineRouteRules({
//       prerender: true
//     })
//   }
// }
//     `,
}
