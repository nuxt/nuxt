import { defineComponent, h } from 'vue'
import type { DefineSetupFnComponent } from 'vue'
import { parseQuery } from 'vue-router'
import { isAbsolute, relative, resolve } from 'pathe'
import { renderDiagnostics } from '../diagnostics/render'
import { devRootDir } from '#build/nuxt.config.mjs'

const testComponentWrapper = (url: string, componentLoaders: Record<string, () => Promise<any>> = {}): DefineSetupFnComponent<{}> => defineComponent({
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
    const rel = relative(devRootDir, path)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw renderDiagnostics.NUXT_E4008({ path })
    }
    const loader = componentLoaders[path]
    const comp = await (loader ? loader() : import(/* @vite-ignore */ path as string)).then(r => r.default)
    return () => [
      h('div', 'Component Test Wrapper for ' + path),
      h('div', { id: 'nuxt-component-root' }, [
        h(comp, { ...attrs, ...props, ...urlProps }),
      ]),
    ]
  },
}) as unknown as DefineSetupFnComponent<{}>

export default testComponentWrapper
