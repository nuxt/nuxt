import { defineComponent, getCurrentInstance, onErrorCaptured, useId } from 'vue'
import type { ComponentPublicInstance, DefineSetupFnComponent, SlotsType, VNode } from 'vue'
import { ssrRenderSlot } from 'vue/server-renderer'

import { useNuxtApp } from '../nuxt'
import { clearNuxtState, useState } from '../composables/state'
import { _invokeAppErrorHandler, createError, createErrorFromThrown } from '../composables/error'
import type { NuxtError } from '../composables/error'
import { createIdScope, isVaporSlot, resetIdScope } from './utils'
import { captureTeleports, createBuffer, settleBuffer } from './ssr-buffer'
import type { SSRBuffer, SSRBufferItem } from './ssr-buffer'
import { renderDiagnostics } from '../diagnostics/render'
import { ssrErrorBoundary, vapor } from '#build/nuxt.config.mjs'

interface NuxtErrorBoundaryProps {
  /**
   * When the error was caught during server-side rendering, re-render the default slot on the
   * client once mounted (falling back to the `#error` slot again if it throws there too).
   */
  retryOnClient?: boolean
}

type NuxtErrorBoundaryEmits = {
  error: (error: Error) => void
}

type NuxtErrorBoundarySlots = SlotsType<{
  default?: () => VNode[]
  error?: (props: { error: Error, clearError: () => void }) => VNode[]
}>

type Push = (item: SSRBufferItem) => void

function toPublicError (err: unknown): NuxtError {
  if (import.meta.dev || !createErrorFromThrown(err).unhandled) {
    return createError(err as Error)
  }
  return createError({ status: 500, statusText: 'Internal Server Error' })
}

const NuxtErrorBoundaryServer = defineComponent({
  name: 'NuxtErrorBoundary',
  inheritAttrs: false,
  emits: {
    error (_error: Error) {
      return true
    },
  },
  setup (_, { slots, emit }) {
    const vm = getCurrentInstance()!
    const renderDefaultSlot = (push: Push) => ssrRenderSlot(slots, 'default', {}, null, push, vm)

    if (!ssrErrorBoundary) {
      return { renderContent: renderDefaultSlot }
    }

    const nuxtApp = useNuxtApp()
    const error = useState<NuxtError | undefined>(useId())
    const idScope = createIdScope(vm)

    if (vapor && isVaporSlot(slots.default)) {
      if (import.meta.dev) {
        renderDiagnostics.NUXT_E4024()
      }
      return { renderContent: renderDefaultSlot }
    }

    function handleError (err: unknown, target: ComponentPublicInstance | null, info: string) {
      if (!error.value && !committed) {
        error.value = toPublicError(err)
        if (import.meta.dev) {
          renderDiagnostics.NUXT_E4025({ cause: err })
        }
      }
      emit('error', err as Error)
      nuxtApp.hooks.callHook('vue:error', err, target, info)?.catch(hookError => console.error('[nuxt] Error in `vue:error` hook', hookError))
      _invokeAppErrorHandler(nuxtApp, err, target, info)
    }

    let committed = false
    let renderingErrorSlot = false
    onErrorCaptured((err, target, info) => {
      if (renderingErrorSlot) {
        return
      }
      handleError(err, target, info)
      return false
    })

    function renderErrorSlot (): SSRBuffer {
      renderingErrorSlot = true
      const idStatePrefix = `${vm.appContext.config.idPrefix || 'v'}-${idScope}`
      nuxtApp.runWithContext(() => clearNuxtState(key => key.startsWith(idStatePrefix), { reset: false }))
      resetIdScope(vm, idScope)
      const { getBuffer, push } = createBuffer()
      ssrRenderSlot(slots, 'error', { error: error.value, clearError: () => {} }, null, push, vm)
      return getBuffer()
    }

    function renderContent (push: Push) {
      const { getBuffer, push: pushDefault } = createBuffer()
      const teleports = captureTeleports(vm, () => {
        try {
          renderDefaultSlot(pushDefault)
        } catch (err) {
          handleError(err, vm.proxy, 'render')
        }
      })

      const buffer = getBuffer()
      const selectSlot = () => {
        if (error.value) {
          teleports.discard()
          return renderErrorSlot()
        }
        committed = true
        return buffer
      }

      if (!buffer.hasAsync && !teleports.buffer.hasAsync) {
        push(selectSlot())
        return
      }

      push(settleBuffer([buffer, teleports.buffer]).then(
        selectSlot,
        (err) => {
          handleError(err, vm.proxy, 'render')
          return selectSlot()
        },
      ))
    }

    return { renderContent }
  },
  ssrRender (ctx: { renderContent: (push: Push) => void }, push: Push) {
    ctx.renderContent(push)
  },
}) as unknown as DefineSetupFnComponent<NuxtErrorBoundaryProps, NuxtErrorBoundaryEmits, NuxtErrorBoundarySlots>

export default NuxtErrorBoundaryServer
