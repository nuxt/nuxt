<script setup lang="ts">
const userId = ref(1)
const profile = ref<any>(null)

const { execute: fetchUser } = await useAsyncData('user', () => $fetch('/api/test'))

const { data: avatar } = await useAsyncData('avatar', async () => {
  await $fetch('/api/test')
})

watch(userId, fetchUser.execute)

onMounted(() => {
  useFetch(`/api/test`)
})

function switchUser () {
  userId.value++
}
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>
    <h1>User Profile</h1>

    <div>
      <h2>User #{{ userId }}</h2>
      <p>Avatar: {{ avatar ?? 'No avatar' }}</p>
      <button @click="switchUser">
        Next User
      </button>
    </div>
  </div>
</template>
