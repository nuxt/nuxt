import '~/assets/shared-with-js-module.css'

import { h } from 'vue'

export default {
  name: 'SharedCssModule',
  render: () => h('span', { class: 'shared-with-js-module' }),
}
