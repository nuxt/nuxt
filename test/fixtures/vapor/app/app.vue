<script setup lang="ts">
const route = useRoute()
const keepalive = useState('vapor-keepalive', () => route.query.ka === '1' ? true : undefined)
const transition = useState('vapor-transition', () => route.query.tr === '1' ? { name: 'page', mode: 'out-in' as const } : route.query.tr === 'default' ? { name: 'page' } : undefined)
</script>

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
      <NuxtLink
        to="/vdom-page"
        data-testid="nav-vdom-page"
      >
        VDOM page
      </NuxtLink>
      <NuxtLink
        to="/vapor-page-two"
        data-testid="nav-vapor-page-two"
      >
        Vapor page two
      </NuxtLink>
      <NuxtLink
        to="/inner-transition"
        data-testid="nav-inner-transition"
      >
        Inner transition
      </NuxtLink>
      <NuxtLink
        to="/keepalive-vapor"
        data-testid="nav-keepalive-vapor"
      >
        Keepalive vapor
      </NuxtLink>
      <NuxtLink
        to="/keepalive-vdom"
        data-testid="nav-keepalive-vdom"
      >
        Keepalive vdom
      </NuxtLink>
    </nav>
    <NuxtPage
      :keepalive="keepalive"
      :transition="transition"
    />
  </div>
</template>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 100ms;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 100ms;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
