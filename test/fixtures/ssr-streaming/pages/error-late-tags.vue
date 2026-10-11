<template>
  <div>
    <p data-testid="shell-text">
      error late tags shell content
    </p>
    <Suspense>
      <LateTagsError />
      <template #fallback>
        <div data-testid="fallback">
          loading...
        </div>
      </template>
    </Suspense>
  </div>
</template>
