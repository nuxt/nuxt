<template lang="md">
  # Hello World!

  Current route is: {{ $route.path }}

  Data model is: {{ model }}

  <nuxt-link to="/about">Goto About</nuxt-link>

  <nuxt-link to="/pug">Goto Pug</nuxt-link>
</template>

<script>
export default {
  data() {
    return {
      model: 'I am index'
    }
  }
}
</script>
