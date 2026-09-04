<template>
  <div>
    <h1 data-testid="page-title">
      DevOnly
    </h1>
    <DevOnly>
      <VaporCounter label="vapor in dev-only" />
      <template #fallback>
        <p data-testid="dev-only-fallback">
          production fallback
        </p>
      </template>
    </DevOnly>
  </div>
</template>
