// block for `time` ms, then return the number of loops we could run in that time:
function expensive(time) {
	let start = Date.now(),
		  count = 0
	while (Date.now() - start < time) count++
	return count
}

// Respond to message from parent thread
self.addEventListener('message', (event) => {
  console.log('worker', event.data)

  if (event.data.action === 'expensive' && event.data.time) {
		// Post data to parent thread
		self.postMessage(expensive(Number(event.data.time)))
	} else {
		self.postMessage({ hello: 'from worker' })
	}
})
