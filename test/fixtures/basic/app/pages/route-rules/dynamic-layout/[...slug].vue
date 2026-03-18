<template>
  <div>
    <div data-testid="layout-meta">
      {{ $route.meta.layout || 'none' }}
    </div>
    <NuxtLink
      data-testid="to-b"
      to="/route-rules/dynamic-layout/b"
    >
      to-b
    </NuxtLink>
  </div>
</template>
