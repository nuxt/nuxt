import 'vuetify/dist/vuetify.css'

import { configure } from '@storybook/vue'
import Vue from 'vue'
import Vuex from 'vuex'
import Vuetify from 'vuetify'
import MyButton from '../components/Button.vue'

Vue.use(Vuex)
Vue.use(Vuetify)

Vue.component('my-button', MyButton)

// Automatically import all files ending in *.stories.js
const req = require.context('../stories', true, /.story.js$/)

function loadStories() {
  req.keys().forEach(req)
}

configure(loadStories, module)
