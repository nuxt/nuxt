
import { storiesOf } from '@storybook/vue'
import { linkTo } from '@storybook/addon-links'

import Welcome from '~/components/Welcome.vue'

storiesOf('Welcome', module).add('to Storybook', () => ({
  render: h => h(Welcome)
}))
  .add('with Link To Button', () => ({
    components: { Welcome },
    template: '<div align=center><welcome :showApp="action" /></div>',
    methods: { action: linkTo('Button') }
  }))
