import { defineComponent, h } from 'vue'
import { useRouteAnnouncer } from '#app/composables/route-announcer'


export default defineComponent({
  name: 'NuxtRouteAnnouncer',
  setup () {
    const { message, politeness } = useRouteAnnouncer();
    if (!import.meta.client) { return }
   
    return () => h('div', {
      class: 'nuxt-route-announcer',
      ariaLive: politeness.value,
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
    }, message.value)
  }
})


