export default defineComponent({
  name: 'Foo',
  methods: {
    getMessage () {
      return 'Hello world'
    }
  },
  render () {
    return h('div', {}, this.getMessage())
  }
})
