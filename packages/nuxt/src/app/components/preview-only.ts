import { defineComponent } from 'vue'
import type { DefineSetupFnComponent, SlotsType, VNode } from 'vue'
import { useState } from '../composables/state'

interface PreviewState {
  enabled: boolean
  state: Record<any, unknown>
  _initialized?: boolean
}

type PreviewOnlySlots = SlotsType<{
  default?: () => VNode[]
  /**
   * If you require a replacement when preview mode is not enabled.
   */
  fallback?: () => VNode[]
}>

const PreviewOnly = defineComponent({
  name: 'PreviewOnly',
  inheritAttrs: false,
  ...(import.meta.dev && {
    slots: Object as PreviewOnlySlots,
  }),
  setup (_, props) {
    const preview = useState<PreviewState>('_preview-state', () => ({
      enabled: false,
      state: {},
    }))

    return () => preview.value.enabled ? props.slots.default?.() : props.slots.fallback?.()
  },
}) as unknown as DefineSetupFnComponent<{}, {}, PreviewOnlySlots>

export default PreviewOnly
