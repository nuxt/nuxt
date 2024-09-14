import { describe, expect, it } from 'vitest'
import type { ComponentOptions } from 'vue'
import { defineComponent, h, toDisplayString, useAttrs } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { createClientOnly } from '../../packages/nuxt/src/app/components/client-only'

const Client = defineComponent({
  name: 'TestClient',
  setup () {
    const attrs = useAttrs()
    return () => h('div', {}, toDisplayString(attrs))
  },
})

describe('createClient attribute inheritance', () => {
  it('should retrieve attributes with useAttrs()', async () => {
    const wrapper = await mountSuspended(createClientOnly(Client as ComponentOptions), {
      attrs: {
        id: 'client',
      },
    })

    expect(wrapper.html()).toMatchInlineSnapshot(`
      "<div id="client">{
        "id": "client"
        }</div>"
    `)
  })
})
