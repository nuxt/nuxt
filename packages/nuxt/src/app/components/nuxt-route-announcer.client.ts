import { defineComponent, h } from 'vue'
import { Politeness, useRouteAnnouncer } from '#app/composables/route-announcer'

class NuxtRouteAnnouncerShadow extends HTMLElement {
  connectedCallback () {
    const shadow = this.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    const fragment = document.createDocumentFragment()
    style.textContent = `
      :host {
        border: 0;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        height: 1px;
        width: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
        word-wrap: normal;
        margin: -1px;
        padding: 0;
      }
    `
    fragment.appendChild(style)
    fragment.appendChild(document.createElement('slot'))
    shadow.appendChild(fragment)
  }
}

customElements.define('nuxt-route-announcer-shadow', NuxtRouteAnnouncerShadow)

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
    const { set, polite, assertive, message, politeness } = useRouteAnnouncer({ politeness: props.politeness })

    expose({
      set, polite, assertive
    })

    return () => h('nuxt-route-announcer-shadow', {
      class: 'nuxt-route-announcer',
      ariaLive: politeness.value,
      ariaAtomic: props.ariaAtomic
    }, slots.default ? slots.default({ message }) : message.value)
  }
})
