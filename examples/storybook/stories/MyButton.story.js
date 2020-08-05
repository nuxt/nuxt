
import { storiesOf } from '@storybook/vue'
import Centered from '@storybook/addon-centered'
import MyButton from '~/components/Button.vue'

storiesOf('Button', module)
  .addDecorator(Centered)
  .add('rounded button', () => ({
    template: '<my-button :rounded="true"> 👍  A Button with rounded edges</my-button>'
  }))
  .add('normal button', () => ({
    components: { MyButton },
    template: '<my-button :rounded="false">A Button with square edges</my-button>'
  }))
