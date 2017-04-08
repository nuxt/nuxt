<template>
  <div>
    <h2>Articles</h2>
    <ul>
      <li v-for="article in articles">
        <span>{{article}}</span>
      </li>
    </ul>
    <h2>Comments <small>(nested under articles)</small></h2>
    <ul>
      <li v-for="comment in comments">
        <span>{{comment}}</span>
      </li>
    </ul>
    <nuxt-link to="/">Home</nuxt-link>
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
