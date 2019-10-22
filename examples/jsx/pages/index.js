export default {
  head: {
    title: 'Home page 🚀',
    meta: [
      { hid: 'description', name: 'description', content: 'Home page description' }
    ],
    script: [
      { src: '/head.js' },
      // Supported since 1.0
      { src: '/body.js', body: true },
      { src: '/defer.js', defer: '' }
    ]
  },
  render () {
    return <div class='container'>
      <h1>Home page 🚀</h1>
      <NuxtLink to='/about'>About page</NuxtLink>
    </div>
  }
}
