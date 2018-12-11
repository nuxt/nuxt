<template lang="md">
  # Hello World!

  Current route is: {{ $route.path }}

  Data model is: {{ model }}

  <NuxtLink to="/about">Goto About</NuxtLink>

  <NuxtLink to="/pug">Goto Pug</NuxtLink>
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
