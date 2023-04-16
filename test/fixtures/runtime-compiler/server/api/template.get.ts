/**
 * mock the behavior of nuxt retrieving data from an api
 */

export default defineEventHandler(() => {
  return '<div>Hello my name is : {{name}}, i am defined by ShowTemplate.vue and my template is retrieved from the API</div>'
})
