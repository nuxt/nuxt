/**
 * mock the behavior of nuxt retrieving data from an api
 */

import { defineHandler } from 'nitro/h3'

export default defineHandler(() => {
  return '<div>Hello my name is : {{name}}, i am defined by ShowTemplate.vue and my template is retrieved from the API</div>'
})
