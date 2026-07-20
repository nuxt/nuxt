<template>
  <div>
    <NuxtLoadingIndicator />
    <nav>
      <NuxtLink
        to="/"
        data-testid="nav-index"
      >
        Home
      </NuxtLink>
      <NuxtLink
        to="/vapor-page"
        data-testid="nav-vapor-page"
      >
        Vapor page
      </NuxtLink>
      <NuxtLink
        to="/mixed"
        data-testid="nav-mixed"
      >
        Mixed
      </NuxtLink>
      <NuxtLink
        to="/async-await"
        data-testid="nav-async-await"
      >
        Async await
      </NuxtLink>
      <NuxtLink
        to="/async-data"
        data-testid="nav-async-data"
      >
        Async data
      </NuxtLink>
      <NuxtLink
        to="/vdom-async-data"
        data-testid="nav-vdom-async-data"
      >
        VDOM async data
      </NuxtLink>
      <NuxtLink
        to="/lazy-data"
        data-testid="nav-lazy-data"
      >
        Lazy data
      </NuxtLink>
      <NuxtLink
        to="/slow"
        data-testid="nav-slow"
      >
        Slow
      </NuxtLink>
      <NuxtLink
        to="/prefetch"
        data-testid="nav-prefetch"
      >
        Prefetch
      </NuxtLink>
    </nav>
    <NuxtPage />
  </div>
</template>
