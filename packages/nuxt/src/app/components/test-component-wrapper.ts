import { defineComponent, h } from 'vue'
import { parseQuery } from 'vue-router'
import { resolve } from 'pathe'
import { runtimeErrorUtils } from '../utils'
import { E4008 } from '../error-codes'
// @ts-expect-error virtual file
import { devRootDir } from '#build/nuxt.config.mjs'

export default (url: string) => defineComponent({
  name: 'NuxtTestComponentWrapper',
  inheritAttrs: false,
  async setup (props, { attrs }) {
    const query = parseQuery(new URL(url, 'http://localhost').search)
    let urlProps: Record<string, any> = {}
    if (query.props) {
      try {
        const parsedProps = JSON.parse(query.props as string)
        if (parsedProps && typeof parsedProps === 'object') {
          urlProps = parsedProps
        }
      } catch {
        // ignore invalid JSON props in test wrapper
      }
    }
    const path = resolve(query.path as string)
    if (!path.startsWith(devRootDir)) {
      runtimeErrorUtils.throw(`Cannot access path outside of project root directory: \`${path}\`.`, { code: E4008, fix: 'Use a path within the project root directory for the test component wrapper.' })
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
