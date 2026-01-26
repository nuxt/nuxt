<template>
  <div class="lazy-fallback-page">
    <h1>Lazy Component Fallback Test</h1>

    <div id="with-fallback">
      <LazySlowLoadingComponent>
        <template #fallback>
          <div class="loading-fallback">
            Loading slow component...
          </div>
        </template>
      </LazySlowLoadingComponent>
    </div>

    <div id="without-fallback">
      <LazySlowLoadingComponent />
    </div>

    <div id="hydration-with-fallback">
      <LazySlowLoadingComponent :hydrate-on-idle="true">
        <template #fallback>
          <div class="hydration-loading-fallback">
            Hydration loading...
          </div>
        </template>
      </LazySlowLoadingComponent>
    </div>
  </div>
</template>
