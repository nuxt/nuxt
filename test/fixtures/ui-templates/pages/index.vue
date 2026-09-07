<template>
  <div data-testid="content">
    <h1>home</h1>
    <NuxtLink
      to="/does-not-exist"
      data-testid="broken-link"
    >
      broken link
    </NuxtLink>
  </div>
</template>
