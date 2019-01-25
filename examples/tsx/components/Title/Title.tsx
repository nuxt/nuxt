import * as tsx from 'vue-tsx-support'
import styles from './styles.css'

export default tsx.component({
  name: 'Title',
  props: {
    label: {
      type: String,
      required: true as true
    }
  },
  beforeCreate () {
    // Render Inline CSS on SSR
    if ((styles as any).__inject__) {
      (styles as any).__inject__(this.$ssrContext)
    }
  },
  render () {
    return <h1 class={styles.Title}>{this.label}</h1>
  }
})
