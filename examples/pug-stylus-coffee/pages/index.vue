<template lang="pug">
  section.container
    div
      logo
      h1.title Nuxt.js with Pug Stylus and Coffee!
      h2.subtitle {{ $store.state.msg }}
      //- h2.subtitle {{message}}
      .links
        a.button--green(
          href='https://nuxtjs.org/'
          arget='_blank') Documentation
        a.button--grey(
          href='https://github.com/nuxt/nuxt.js'
          target='_blank') GitHub
</template>


<script lang="coffee">
import Logo from '~/components/Logo.vue'

export default
  components: { Logo }
  computed:
    message: -> @$store.state.msgComputed
</script>

<style lang="stylus">
.container
  margin: 0 auto
  min-height: 100vh
  display: flex
  justify-content: center
  align-items: center
  text-align: center

.title
  font-family: 'Quicksand', 'Source Sans Pro', -apple-system, BlinkMacSystemFont,
    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif
  display: block
  font-weight: 300
  font-size: 60px
  color: #35495e
  letter-spacing: 1px
  padding 5%

.subtitle
  font-weight: 300
  font-size: 42px
  color: #526488
  word-spacing: 5px
  padding-bottom: 15px

.links
  padding-top: 15px
</style>
