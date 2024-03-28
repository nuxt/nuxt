import { defineComponent, h } from 'vue'
import type { PolitenessValue } from '#app/composables/route-announcer'
import { Politeness, useRouteAnnouncer } from '#app/composables/route-announcer'

export default defineComponent({
  name: 'NuxtRouteAnnouncer',
  props: {
    atomic: {
      type: Boolean,
      default: false
    },
    politeness: {
      type: String as () => PolitenessValue,
      default: Politeness.Polite,
      validator: (value: PolitenessValue) => Object.values(Politeness).includes(value as Politeness)
    }
  },
  setup (props, { slots, expose }) {
    const { set, polite, assertive, message, politeness } = useRouteAnnouncer({ politeness: props.politeness })

    expose({
      set, polite, assertive, message, politeness
    })

    return () => h('nuxt-route-announcer', {
      class: 'nuxt-route-announcer',
      style: {
        position: 'absolute'
      }
    }, h('div', {
      role: 'alert',
      'aria-live': politeness.value,
      'aria-atomic': props.atomic,
      style: {
        border: '0',
        clip: 'rect(0 0 0 0)',
        'clip-path': 'inset(50%)',
        height: '1px',
        width: '1px',
        overflow: 'hidden',
        position: 'absolute',
        'white-space': 'nowrap',
        'word-wrap': 'normal',
        margin: '-1px',
        padding: '0'
      }
    }, slots.default ? slots.default({ message: message.value }) : message.value))
  }
})
