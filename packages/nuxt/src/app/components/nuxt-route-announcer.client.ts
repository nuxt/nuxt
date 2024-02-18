import { defineComponent, h } from 'vue'
import { useRouteAnnouncer } from '#app/composables/route-announcer'
import { Politeness } from '#app/composables/route-announcer'

export default defineComponent({
  name: 'NuxtRouteAnnouncer',
  props: {
    ariaAtomic: {
      type: Boolean,
      default: false
    },
    politeness: {
      type: String as unknown as () => Politeness,
      default: Politeness.Polite
    }
  },
  setup (props, { slots, expose }) {
    const { set, polite, assertive, message, politeness } = useRouteAnnouncer({ politeness: props.politeness });
   
    expose({
      set, polite, assertive
    })

    return () => h('div', {
      class: 'nuxt-route-announcer',
      ariaLive: politeness.value,
      ariaAtomic: props.ariaAtomic,
      style: {
        border: 0,
        clip: 'rect(0 0 0 0)',
        clipPath: 'inset(50%)',
        height: '1px',
        width: '1px',
        overflow: 'hidden',
        position: 'absolute',
        whiteSpace: 'nowrap',
        wordWrap: 'normal',
        margin: '-1px',
        padding: 0
      }
    }, slots.default ? slots.default({ message }) : message.value)
  }
})


