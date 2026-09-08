<template>
  <div>
    <h1 data-testid="title">
      Late Tags
    </h1>
    <Suspense>
      <LateTags />
      <template #fallback>
        <div data-testid="fallback">
          loading...
        </div>
      </template>
    </Suspense>
  </div>
</template>
