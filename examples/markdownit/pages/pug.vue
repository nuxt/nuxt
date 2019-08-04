<template lang="pug">
  div
    h1 Pug Page
    :markdown-it()
      ## Current route is: {{ $route.name }}
    div(v-html="$md.render(model)")

    br
    nuxt-link(to='/') Back Home
</template>

<script>
export default {
  data () {
    return {
      model: '## Title h2\n### title h3\n\nLong text Long text Long text Long text Long text Long text Long text Long text Long text \n\n* gimme a list item\n* and one more yeehaw'
    }
  }
}
</script>
