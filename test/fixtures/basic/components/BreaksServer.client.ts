// @ts-expect-error assigning property to window object to break SSR
window.test = true

export default defineComponent({
  render: () => 'hi'
})
