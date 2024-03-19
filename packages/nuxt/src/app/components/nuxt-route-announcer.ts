import { defineComponent, h } from 'vue'
import { Politeness, useRouteAnnouncer } from '#app/composables/route-announcer'

class CustomRouteAnnouncer extends HTMLElement {
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

customElements.define('custom-route-announcer', CustomRouteAnnouncer)

type PolitenessValue = `${Politeness}`;

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
      validator: (value: string) => Object.values(Politeness).includes(value as Politeness)
    }
  },
  setup (props, { slots, expose }) {
    const { set, polite, assertive, message, politeness } = useRouteAnnouncer({ politeness: props.politeness as Politeness })

    expose({
      set, polite, assertive, message, politeness
    })

    return () => h('custom-route-announcer', {
      class: 'nuxt-route-announcer',
      role: 'alert',
      'aria-live': politeness.value,
      'aria-atomic': props.atomic
    }, slots.default ? slots.default({ message: message.value }) : message.value)
  }
})
