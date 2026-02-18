import { defineComponent, h } from 'vue'
import type { AnnouncerPoliteness } from '../composables/announcer'
import { useAnnouncer } from '../composables/announcer'

export default defineComponent({
  name: 'NuxtAnnouncer',
  props: {
    atomic: {
      type: Boolean,
      default: true,
    },
    politeness: {
      type: String as () => AnnouncerPoliteness,
      default: 'polite',
    },
  },
  setup (props, { slots, expose }) {
    const { set, polite, assertive, message, politeness } = useAnnouncer({
      politeness: props.politeness,
    })

    expose({
      set,
      polite,
      assertive,
      message,
      politeness,
    })

    return () => h('span', {
      class: 'nuxt-announcer',
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
