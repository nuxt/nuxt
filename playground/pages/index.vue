<template>
  <div>
    <h2>
      Hello world
    </h2>
    <strong>Playground pages</strong>
    <ul>
      <li v-for="link of links" :key="link">
        <nuxt-link :to="link">
          {{ link }}
        </nuxt-link>
      </li>
    </ul>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import { useRouter } from 'vue-router'

export default defineComponent({
  setup () {
    const links = useRouter().getRoutes().filter(route => ['index', '404'].includes(route.name) === false).map(route => route.path)

    return { links }
  }
})
</script>
