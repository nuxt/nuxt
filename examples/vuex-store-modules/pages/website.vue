<template>
  <div>
    <h2>Articles</h2>
    <ul>
      <li v-for="(article, index) in articles" :key="index">
        <span>{{ article }}</span>
      </li>
    </ul>
    <h2>Comments <small>(nested under articles)</small></h2>
    <ul>
      <li v-for="(comment, index) in comments" :key="index">
        <span>{{ comment }}</span>
      </li>
    </ul>
    <NuxtLink to="/">
      Home
    </NuxtLink>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  computed: mapGetters({
    articles: 'articles/get',
    comments: 'articles/comments/get'
  }),
  methods: {
  }
}
</script>

<style>
</style>
