<script setup lang="ts">
function localScopedComposables () {
  const _assert = (key?: string) => key ?? 'was not keyed'

  function basic () {
    function useState (key?: string) {
      return _assert(key)
    }
    const useAsyncData = _assert

    return [useState(), useAsyncData()]
  }

  function hoisting () {
    return [useState()]

    function useState (key?: string) {
      return _assert(key)
    }
  }

  function complex () {
    const [useState] = [_assert]
    const { a: useAsyncData } = {
      a: _assert
    }
    const [_, { b: useLazyAsyncData }] = [null, {
      b: _assert
    }]

    return [useState(), useAsyncData(), useLazyAsyncData()]
  }

  function deeperScope () {
    const useState = _assert

    return [(function () {
      return useState()
    })()]
  }

  return [...basic(), ...hoisting(), ...complex(), ...deeperScope()]
}

const skippedLocalScopedComposables = localScopedComposables().every(res => res === 'was not keyed')
</script>

<template>
  <div>
    {{ skippedLocalScopedComposables }}
  </div>
</template>

<style scoped>
body {
  background-color: #000;
  color: #fff;
}
</style>
