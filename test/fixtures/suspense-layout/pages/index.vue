<template>
  <div>
    <h1 data-testid="index-title">
      Index Page
    </h1>
    <NuxtLink
      to="/redirect"
      data-testid="link-redirect"
    >
      Go via redirect
    </NuxtLink>
    <NuxtLink
      to="/asyncdata/p0"
      data-testid="link-async-start"
    >
      Async p0
    </NuxtLink>
  </div>
</template>
