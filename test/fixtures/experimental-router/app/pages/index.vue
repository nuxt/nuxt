<template>
  <div>
    <h1>experimental-router-index</h1>
    <NuxtLink
      id="user"
      to="/users/42"
    >
      user 42
    </NuxtLink>
    <NuxtLink
      id="named"
      :to="{ name: 'users-id', params: { id: 'a b' }, query: { tab: ['info'] } }"
    >
      named
    </NuxtLink>
    <NuxtLink
      id="child"
      to="/parent/child"
    >
      child
    </NuxtLink>
    <RouterLink
      id="router-link"
      to="/parent"
    >
      router link
    </RouterLink>
  </div>
</template>
