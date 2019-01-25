import * as tsx from 'vue-tsx-support'

export default tsx.component({
  name: 'List',
  props: {
    data: {
      type: Array as () => string[],
      required: true as true
    }
  },
  computed: {
    filterd (): string[] {
      return this.data.filter(item => item.length < 6)
    }
  },
  render () {
    return (
      <ul>
        {this.filterd.map(item => (
          <li>{item}</li>
        ))}
      </ul>
    )
  }
})
