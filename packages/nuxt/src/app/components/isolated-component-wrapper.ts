import { resolve } from 'pathe'
import { defineComponent, h } from 'vue'
import { parseQuery } from 'vue-router'
import destr from 'destr'
// @ts-expect-error virtual file
import { buildAssetsURL } from '#internal/nuxt/paths'

export default (url: string) => defineComponent({
  name: 'IsolatedComponentWrapper',
  inheritAttrs: false,
  async setup (props, { attrs }) {
    const query = parseQuery(new URL(url, 'http://localhost').search)
    const urlProps = query.props ? destr<Record<string, any>>(query.props as string) : {}
    const name = query.name as string
    // @ts-expect-error virtual file
    const components = await import(/* @vite-ignore */ '#build/isolated-components.json').then(c => c.default)

    if (!components[name]) {
      throw new Error(`[nuxt] Component not found ${name}`)
    }
    const path = resolve(components[name])

    const component = await import(/* @vite-ignore */ buildAssetsURL(path)).then(r => r.default)

    return () => h('div', { id: 'nuxt-component-root' }, [
      h(component, { ...attrs, ...props, ...urlProps }),
    ])
  },
})
