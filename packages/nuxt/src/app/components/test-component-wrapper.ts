import { defineComponent, h } from 'vue'
import { parseQuery } from 'vue-router'
import { resolve } from 'pathe'
import destr from 'destr'
// @ts-expect-error virtual file
import { devRootDir } from '#build/nuxt.config.mjs'

export default (url: string) => defineComponent({
  name: 'NuxtTestComponentWrapper',
  inheritAttrs: false,
  async setup (props, { attrs }) {
    const query = parseQuery(new URL(url, 'http://localhost').search)
    const urlProps = query.props ? destr<Record<string, any>>(query.props as string) : {}
    const path = resolve(query.path as string)
    if (!path.startsWith(devRootDir)) {
      throw new Error(`[nuxt] Cannot access path outside of project root directory: \`${path}\`.`)
    }
    const comp = await import(/* @vite-ignore */ path as string).then(r => r.default)
    return () => [
      h('div', 'Component Test Wrapper for ' + path),
      h('div', { id: 'nuxt-component-root' }, [
        h(comp, { ...attrs, ...props, ...urlProps }),
      ]),
    ]
  },
})
