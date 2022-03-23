<template>
  <NuxtExampleLayout show-tips example="with-composables">
    <p>
      Named export <code>useA</code> : {{ a }}
    </p>
    <p>
      Named export <code>useB</code> : {{ b }}
    </p>
    <p>
      Named export <code>useC</code> : {{ c }}
    </p>
    <p>
      Named export <code>useD</code> : {{ d }}
    </p>
    <p>
      Default export <code>useFoo</code> : {{ foo }}
    </p>
    <template #tips>
      <div>
        <p>
          This example shows how to use the <code>composables/</code> directory to auto import composables.
        </p>
        <p>
          If a default export is provided, the name of the composable will be mapped to the name of the file.
          Named exports can be used as-is.
        </p>
      </div>
    </template>
  </NuxtExampleLayout>
</template>

<script setup>
const a = useA()
const b = useB()
const c = useC()
const d = useD()
const foo = useFoo()
</script>
