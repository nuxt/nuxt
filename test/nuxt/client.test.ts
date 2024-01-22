import { describe, it, expect } from "vitest"
import { defineComponent, h, useAttrs, toDisplayString, ComponentOptions } from "vue"
import { mountSuspended } from "@nuxt/test-utils/runtime"
import { createClientOnly } from "../../packages/nuxt/src/app/components/client-only"

const Client = defineComponent({
    name: 'Client', 
    setup() {
        const attrs = useAttrs()
        return () => h('div', {}, toDisplayString(attrs))
    }
})

describe('createClient attribute inheritance', () => {
    it('should retrieve attributes with useAttrs()', async () => {
        const wrapper = await mountSuspended(createClientOnly(Client as ComponentOptions), {
            attrs: {
                id: 'client'
            }
        })

        expect(wrapper.html()).toMatchInlineSnapshot(`
          "<div id="client">{
            "id": "client"
            }</div>"
        `)
    })
})