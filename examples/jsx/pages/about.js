
import Test from '~/components/test.vue'

export default {
  head: {
    title: 'About Page',
    meta: [
      { hid: 'description', name: 'description', content: 'About page description' }
    ]
  },
  components: {
    Test
  },
  render () {
    return <div class='container'>
      <h1>About page</h1>
      <test data='I am test component' />
      <p><NuxtLink to='/'>Home page</NuxtLink></p>
    </div>
  }
}
