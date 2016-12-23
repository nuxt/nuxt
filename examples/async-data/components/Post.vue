<template>
  <div class="post">
    <h1>{{ title }}</h1>
    <pre>{{ content }}</pre>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  name: 'post',
  props: ['postId'],
  created () {
    // if (this.$nuxt.hasComponentData(this)) {
    //   let data = this.$nuxt.getComponentData(this)
    //   this.title = data.title
    //   this.content = data.content
    //   return
    // }
    let promise = axios.get(`https://jsonplaceholder.typicode.com/posts/${this.postId}`)
    promise.then((res) => {
      console.log(res.data)
      this.title = res.data.title
      this.content = res.data.body
    })
    this.$nuxt.addComponentData(this, promise)
  },
  data () {
    return {
      title: '',
      content: ''
    }
  }
}
</script>

<style scoped>
.post {
  width: 50%;
  border: 1px #ddd solid;
  margin: auto;
  padding: 30px;
}
</style>
