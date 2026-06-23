import '~/assets/css-from-js-module.css'

import { h } from 'vue'

export default {
  name: 'JSModuleComponent',
  render: () => h('span', { class: 'js-module-component' }),
}
