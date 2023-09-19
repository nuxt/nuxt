export default definePayloadPlugin((nuxtApp) => {
  definePayloadReducer('BlinkingText', data => data === '<original-blink>' && '_')
  definePayloadReviver('BlinkingText', () => '<revivified-blink>')
  if (import.meta.server) {
    nuxtApp.payload.blinkable = '<original-blink>'
  }
})
