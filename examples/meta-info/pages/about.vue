<template>
  <div class="container">
    <h1>About page</h1>
    <p>Check the source code to see the custom meta tags added with our custom component <code>twitter-head-card</code></p>
    <TwitterHeadCard />
    <p>
      <NuxtLink to="/">
        Home page
      </NuxtLink>
    </p>
  </div>
</template>

<script>
import TwitterHeadCard from '~/components/twitter-head-card.vue'

export default {
  components: {
    TwitterHeadCard
  },
  head: {
    title: 'About Page',
    meta: [
      { hid: 'description', name: 'description', content: 'About page description' }
    ]
  }
}
</script>

<style>
.container {
  text-align: center;
  margin-top: 150px;
  font-size: 20px;
}
</style>
