// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { version } from 'vue'

const [major = 0, minor = 0] = version.split('.').map(Number)
const supportsVapor = major > 3 || (major === 3 && minor >= 6)

// self-contained client build, as node resolves `vue` to a build without the vapor runtime
const vaporBuild = 'vue/dist/vue.runtime-with-vapor.esm-browser.js'

vi.mock('#build/nuxt.config.mjs', async () => ({
  rawVaporSlotKey: (await import(/* @vite-ignore */ vaporBuild)).rawVaporSlotKey,
}))

describe.skipIf(!supportsVapor)('isVaporSlot', () => {
  let vue: any
  let isVaporSlot: typeof import('../src/app/components/utils.ts').isVaporSlot

  beforeAll(async () => {
    vue = await import(/* @vite-ignore */ vaporBuild)
    ;({ isVaporSlot } = await import('../src/app/components/utils.ts'))
  })

  function detectVaporSlot (createParent: (child: unknown) => unknown) {
    const detected: boolean[] = []
    const Child = vue.defineComponent({
      setup (_: unknown, { slots }: any) {
        detected.push(isVaporSlot(slots.default))
        return () => vue.h('div', slots.default?.())
      },
    })
    const app = vue.createApp(createParent(Child))
    app.use(vue.vaporInteropPlugin)
    app.mount(document.createElement('div'))
    app.unmount()
    return detected
  }

  it('should not match a vdom slot', () => {
    const detected = detectVaporSlot(Child => vue.defineComponent({
      setup: () => () => vue.h(Child, null, { default: () => 'vdom' }),
    }))
    expect(detected).toEqual([false])
  })

  it('should match a slot authored in a vapor component', () => {
    const detected = detectVaporSlot(Child => vue.defineVaporComponent({
      setup: () => vue.createComponent(Child, null, { default: () => document.createTextNode('vapor') }),
    }))
    expect(detected).toEqual([true])
  })
})
