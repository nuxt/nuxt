import { computed, defineComponent, h, watch } from 'vue'
import type { DefineSetupFnComponent, SlotsType, VNode } from 'vue'
import type { AnnouncerPoliteness, NuxtAnnouncer, NuxtAnnouncerOpts } from '../composables/announcer'

export interface AnnouncerProps {
  atomic?: boolean
  politeness?: AnnouncerPoliteness
}

export type AnnouncerSlots = SlotsType<{
  default?: (props: { message: string }) => VNode[]
}>

const visuallyHidden = {
  'border': '0',
  'clip': 'rect(0 0 0 0)',
  'clip-path': 'inset(50%)',
  'height': '1px',
  'width': '1px',
  'overflow': 'hidden',
  'position': 'absolute',
  'white-space': 'nowrap',
  'word-wrap': 'normal',
  'margin': '-1px',
  'padding': '0',
}

/* @__NO_SIDE_EFFECTS__ */
export function defineAnnouncerComponent (name: string, className: string, atomic: boolean, useAnnouncer: (opts: NuxtAnnouncerOpts) => Omit<NuxtAnnouncer, '_cleanup'>, separateRegions = false): DefineSetupFnComponent<AnnouncerProps, {}, AnnouncerSlots> {
  return defineComponent({
    name,
    props: {
      atomic: {
        type: Boolean,
        default: atomic,
      },
      politeness: {
        type: String as () => AnnouncerPoliteness,
        default: 'polite',
      },
    },
    setup (props, { slots, expose }) {
      const { set, polite, assertive, message, politeness, _regions, _isSetting } = useAnnouncer({ politeness: props.politeness })

      const role = computed(() => {
        if (politeness.value === 'assertive') {
          return 'alert'
        }
        if (politeness.value === 'off') {
          return undefined
        }
        return 'status'
      })

      expose({ set, polite, assertive, message, politeness })

      if (separateRegions) {
        watch([message, politeness], () => {
          if (!_isSetting()) { _regions[politeness.value].value = message.value }
        }, { flush: 'sync' })

        return () => h('span', { class: className, style: { position: 'absolute' } },
          (['polite', 'assertive', 'off'] as const).map(urgency => h('span', {
            'role': urgency === 'polite' ? 'status' : urgency === 'assertive' ? 'alert' : undefined,
            'aria-live': urgency,
            'aria-atomic': props.atomic,
            'style': visuallyHidden,
          }, slots.default && (_regions[urgency].value || (urgency === politeness.value && !Object.values(_regions).some(region => region.value)))
            ? slots.default({ message: _regions[urgency].value })
            : _regions[urgency].value)))
      }

      return () => h('span', {
        class: className,
        style: {
          position: 'absolute',
        },
      }, h('span', {
        'role': role.value,
        'aria-live': politeness.value,
        'aria-atomic': props.atomic,
        'style': visuallyHidden,
      }, slots.default ? slots.default({ message: message.value }) : message.value))
    },
  }) as unknown as DefineSetupFnComponent<AnnouncerProps, {}, AnnouncerSlots>
}
