export default defineNuxtPlugin({
  name: 'custom-type-registration',
  enforce: 'payload',
  setup (nuxtApp) {
    definePayloadReducer('BlinkingText', data => data === '<original-blink>' && '_')
    definePayloadReviver('BlinkingText', () => '<revivified-blink>')
    if (process.server) {
      nuxtApp.payload.blinkable = '<original-blink>'
    }
  }
})
