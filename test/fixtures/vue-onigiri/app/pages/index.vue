<template>
  <div>
    <NuxtLink
      id="islands"
      to="/islands"
    >
      islands
    </NuxtLink>
    <NuxtLink to="/server-page">
      to server page
    </NuxtLink>
    <NuxtLink
      data-testid="server-page-404"
      to="/server-components/lost-page"
    >
      to 404 server page
    </NuxtLink>
    <NuxtLink to="/nested-nuxt-client">
      nested-nuxt-client
    </NuxtLink>
    <NuxtLink to="/selective-client-slots">
      selective-client-slots
    </NuxtLink>
  </div>
</template>
