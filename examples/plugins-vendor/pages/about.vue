<template>
  <div>
    <img :src="thumbnailUrl" />
    <p><router-link to="/">Home</router-link> - About</p>
  </div>
</template>

<script>
import axios from 'axios'

export default {
  data () {
    return axios.get('http://jsonplaceholder.typicode.com/photos/1').then(res => res.data)
  }
}
</script>
