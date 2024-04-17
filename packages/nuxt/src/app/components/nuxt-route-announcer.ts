import { defineComponent, h } from 'vue'
import type { Politeness } from '#app/composables/route-announcer'
import { useRouteAnnouncer } from '#app/composables/route-announcer'

export default defineComponent({
  name: 'NuxtRouteAnnouncer',
  props: {
    atomic: {
      type: Boolean,
      default: false,
    },
    politeness: {
      type: String as () => Politeness,
      default: 'polite',
    },
  },
  setup (props, { slots, expose }) {
    const { set, polite, assertive, message, politeness } = useRouteAnnouncer({ politeness: props.politeness })

    expose({
      set, polite, assertive, message, politeness,
    })

    return () => h('span', {
      class: 'nuxt-route-announcer',
      style: {
        position: 'absolute',
      },
    }, h('span', {
      'role': 'alert',
      'aria-live': politeness.value,
      'aria-atomic': props.atomic,
      'style': {
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
      },
    }, slots.default ? slots.default({ message: message.value }) : message.value))
  },
})
