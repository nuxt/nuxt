<template>
<foobar>
    {{$store.state[$route.query.onServerInit === '1' ? 'id2': 'id']}}
</foobar>
</template>