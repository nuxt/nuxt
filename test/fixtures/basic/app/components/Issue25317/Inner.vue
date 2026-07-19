<template>
  <Suspense>
    <Issue25317Loader />
    <template #fallback>
      <div id="issue-25317-inner-fallback">
        inner-loading
      </div>
    </template>
  </Suspense>
</template>
