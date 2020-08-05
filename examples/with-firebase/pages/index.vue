<template>
  <div>
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>Avatar</th>
          <th>Name</th>
          <th>Title</th>
          <th>Profile</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(user, key) in users" :key="key">
          <td>
            <NuxtLink :to="{ path: `/users/${key}`}">
              <img :src="user.avatar" class="rounded" alt="avatar">
            </NuxtLink>
          </td>
          <td>{{ user.name }}</td>
          <td>{{ user.title }}</td>
          <td>
            <NuxtLink :to="{ path: `/users/${key}`}">
              View profile &rarr;
            </NuxtLink>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import axios from '~/plugins/axios'

export default {
  async asyncData () {
    const { data: users } = await axios.get('users.json')
    return { users }
  }
}
</script>
