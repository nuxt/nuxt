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
export function defineAnnouncerComponent (name: string, className: string, atomic: boolean, useAnnouncer: (opts: NuxtAnnouncerOpts) => Omit<NuxtAnnouncer, '_cleanup'>, dualRegions = false): DefineSetupFnComponent<AnnouncerProps, {}, AnnouncerSlots> {
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
      const { set, polite, assertive, message, politeMessage, assertiveMessage, politeness } = useAnnouncer({ politeness: props.politeness })

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

      if (!dualRegions) {
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
      }

      // two fixed live regions (WAI-ARIA roles are not meant to change over time):
      // one polite, one assertive, so messages of different urgency never overwrite each other
      return () => h('span', {
        class: className,
        style: {
          position: 'absolute',
        },
      }, [
        h('span', {
          'role': 'status',
          'aria-live': 'polite',
          'aria-atomic': props.atomic,
          'style': visuallyHidden,
        }, slots.default && politeness.value !== 'assertive' ? slots.default({ message: message.value }) : politeMessage.value),
        h('span', {
          'role': 'alert',
          'aria-live': 'assertive',
          'aria-atomic': props.atomic,
          'style': visuallyHidden,
        }, slots.default && politeness.value === 'assertive' ? slots.default({ message: message.value }) : assertiveMessage.value),
      ])
    },
  }) as unknown as DefineSetupFnComponent<AnnouncerProps, {}, AnnouncerSlots>
}
