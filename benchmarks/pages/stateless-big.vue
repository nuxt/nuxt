<template>
	<ul>
		<li v-for="n in 10000" :key="n">This is row {{ n + 1 }}</li>
	</ul>
</template>