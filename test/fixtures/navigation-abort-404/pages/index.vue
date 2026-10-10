<template>
  <main>
    <h1>Home</h1>
    <NuxtLink
      id="abort"
      to="/missing?abort=1"
      no-prefetch
    >Abort navigation</NuxtLink>
    <NuxtLink
      id="unknown"
      to="/missing"
      no-prefetch
    >Unknown route</NuxtLink>
  </main>
</template>
