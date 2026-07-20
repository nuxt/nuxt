<template>
  <div>
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
    </nav>
    <NuxtPage />
  </div>
</template>
