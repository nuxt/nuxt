<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})
</script>

<template>
  <div>
    <NuxtLink to="/">← Back</NuxtLink>
    <h1>Admin Dashboard</h1>
    <p>Welcome, administrator. Here you can manage users and settings.</p>
    <ul>
      <li>Total users: 1,284</li>
      <li>Active sessions: 42</li>
      <li>Pending reviews: 7</li>
    </ul>
  </div>
</template>
