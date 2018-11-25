import Vue, { VNode } from 'vue'

export default Vue.extend({
  name: 'AltLayout',
  render(h): VNode {
    return (
      <div>
        <header>Header</header>
        <main>
          <nuxt />
        </main>
        <footer>Footer</footer>
      </div>
    )
  }
})
