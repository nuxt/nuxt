export default defineNuxtConfig({
  routeRules: {
    '/': {
      headers: {
        'My-Header': 'My-Value'
      }
    }
  }
})
