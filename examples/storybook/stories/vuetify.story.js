import { storiesOf } from '@storybook/vue'

import Centered from '@storybook/addon-centered'
import VuetifyLogo from '~/components/VuetifyLogo.vue'

storiesOf('Vuetify/Logo', module)
  .addDecorator(Centered)
  .add('Logo', () => ({
    render: h => h(VuetifyLogo)
  }))

const menuItems = [
  {
    action: 'local_activity',
    title: 'Attractions',
    items: [{ title: 'List Item' }]
  },
  {
    action: 'restaurant',
    title: 'Dining',
    active: true,
    items: [
      { title: 'Breakfast & brunch' },
      { title: 'New American' },
      { title: 'Sushi' }
    ]
  },
  {
    action: 'school',
    title: 'Education',
    items: [{ title: 'List Item' }]
  },
  {
    action: 'directions_run',
    title: 'Family',
    items: [{ title: 'List Item' }]
  },
  {
    action: 'healing',
    title: 'Health',
    items: [{ title: 'List Item' }]
  },
  {
    action: 'content_cut',
    title: 'Office',
    items: [{ title: 'List Item' }]
  },
  {
    action: 'local_offer',
    title: 'Promotions',
    items: [{ title: 'List Item' }]
  }
]

const menuItemsAlt = [
  {
    action: 'inbox',
    title: 'Mailbox'
  },
  {
    action: 'note',
    title: 'My Address'
  },
  {
    action: 'assignment',
    title: 'In Progress',
    active: true,
    items: [
      { title: 'Consolidation' },
      { title: 'Repacking' },
      { title: 'Shipping' }
    ]
  },
  {
    action: 'playlist_add_check',
    title: 'Registration'
  },
  {
    action: 'account_circle',
    title: 'Account'
  },
  {
    action: 'view_headline',
    title: 'Shipped'
  }
]

storiesOf('Vuetify/V-Btn', module)
  .add('Square Button', () => ({
    components: {},
    data () {
      return {
        items: menuItems
      }
    },
    template:
      '<v-btn color="success">Success</v-btn>'
  }))
  .add('with rounded button', () => ({
    components: {},
    data () {
      return {
        items: menuItemsAlt
      }
    },
    template:
      `<v-btn color="warning" large round  dark>
Rounded button
    </v-btn>`
  }))
