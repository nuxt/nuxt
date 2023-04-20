import { $fetch as _$fetch, fetch as _fetch } from 'ofetch'
import * as _kit from '@nuxt/kit'
import { resolve } from 'pathe'
import { stringifyQuery } from 'ufo'
import { useTestContext } from './context'
import { $fetch } from './server'

/**
 * This is a function to render a component directly with the Nuxt server.
 */
export function $fetchComponent (filepath: string, props?: Record<string, any>) {
  return $fetch(componentTestUrl(filepath, props))
}

export function componentTestUrl (filepath: string, props?: Record<string, any>) {
  const ctx = useTestContext()
  filepath = resolve(ctx.options.rootDir, filepath)
  const path = stringifyQuery({
    path: filepath,
    props: JSON.stringify(props)
  })
  return `/__nuxt_component_test__/?${path}`
}
