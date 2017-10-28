<template lang="pug">
  div
    h1 Pug Page
    div(language="md") Current route is: {{ $route.name }}
    div(language="md") Data model is: {{ model }}
    a(href='/') Back Home
</template>

<script>
export default {
  data () {
    return {
      model: 'I am pug'
    }
  }
}
</script>
