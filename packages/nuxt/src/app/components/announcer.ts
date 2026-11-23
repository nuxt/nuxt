import { computed, defineComponent, h } from 'vue'
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
      const { set, polite, assertive, message, politeness, _regions } = useAnnouncer({ politeness: props.politeness })

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
        const renderRegion = (urgency: AnnouncerPoliteness) => {
          const regionMessage = _regions[urgency].value
          const allRegionsEmpty = Object.values(_regions).every(region => !region.value)
          const slot = slots.default
          const showSlot = regionMessage || (allRegionsEmpty && urgency === politeness.value)
          const content = slot && showSlot ? slot({ message: regionMessage }) : regionMessage

          return h('span', {
            'role': urgency === 'polite' ? 'status' : urgency === 'assertive' ? 'alert' : undefined,
            'aria-live': urgency,
            'aria-atomic': props.atomic,
            'style': visuallyHidden,
          }, content)
        }

        // Keep both live regions mounted so assistive technology can observe changes.
        return () => h('span', { class: className, style: { position: 'absolute' } },
          (['polite', 'assertive', 'off'] as const).map(renderRegion))
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
