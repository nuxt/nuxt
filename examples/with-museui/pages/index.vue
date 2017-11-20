<template>
	<div>
		<mu-appbar title="Nuxt.js">
			<mu-icon-button icon="menu" slot="left" @click="toggle()" />
			<mu-icon-menu icon="expand_more" slot="right">
				<mu-menu-item value="1" title="One" />
				<mu-menu-item value="2" title="Two" />
				<mu-menu-item value="3" title="Three" />
			</mu-icon-menu>
		</mu-appbar>
		<mu-drawer :open="open" @close="toggle()" :docked=false>
			<mu-list>
				<mu-list-item title="Menu Item 1" />
				<mu-list-item title="Menu Item 2" />
				<mu-list-item title="Menu Item 3" />
			</mu-list>
		</mu-drawer>
		<div class="content">
			<mu-raised-button label="Primary" class="demo-raised-button" primary/>
		</div>
	</div>
</template>

<script>
	export default {
	  data() {
	    return {
	      open: false
	    }
	  },
	  methods: {
	    toggle(flag) {
	      this.open = !this.open
	    }
	  }
	}
</script>

<style>
	.content {
		margin: 10px
	}
</style>
