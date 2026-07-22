<template>
  <div>
    <h1 data-testid="page-title">
      ClientOnly
    </h1>
    <ClientOnly>
      <VaporCounter label="vapor in client-only" />
      <template #fallback>
        <p data-testid="client-only-fallback">
          fallback content
        </p>
      </template>
    </ClientOnly>
  </div>
</template>
