export const namedExport = defineComponent({
  async setup () {
    await nextTick()
    useRuntimeConfig()
    return () => h('div', 'This is a custom component with a named export.')
  }
})
