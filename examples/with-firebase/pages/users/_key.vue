<template>
  <div class="card" style="width: 20rem;">
    <div class="card-block">
      <img :src="user.avatar" class="rounded" alt="avatar"> <br><br>
      <h4 class="card-title">{{ user.name }}</h4>
      <h6 class="card-subtitle mb-2 text-muted">{{ user.title }}</h6>
      <p class="card-text">{{ user.description }}</p>
      <a href="#" class="btn btn-primary">Hire {{ user.name.split(' ')[0] }}</a>
    </div>
  </div>
</template>

<script>
import axios from '~/plugins/axios'

export default {
  async asyncData({ route }) {
    const { key } = route.params
    const { data: user } = await axios.get(`users/${key}.json`)
    return { user }
  }
}
</script>
