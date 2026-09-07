<template>
  <div>
    <h1 data-testid="page-title">
      Lazy hydration
    </h1>
    <div style="height: 150vh" />
    <LazyVaporCounter
      hydrate-on-visible
      label="lazy vapor"
      data-testid="lazy-vapor"
    />
  </div>
</template>
