<template>
  <section class="container">
    <div>
      <AppLogo />
      <h1 class="title">
        web-worker
      </h1>
      <h2 class="subtitle">
        Nuxt.js project
      </h2>
      <p>{{ notification }}</p>
      <ul class="list">
        <li>Number of Web Workers: {{ workers.length }}</li>
        <li>Number of long Running Workers: {{ longRunningWorkers.length }}</li>
        <li>Number of unused Workers: {{ workers.filter(w => !w.inUse).length }}</li>
      </ul>
      <div class="links">
        <a
          :class="needWorkerSetup ? 'hidden' : 'visible'"
          class="button button--green"
          @click="test"
        >
          Test Worker
        </a>
        <a
          :class="needWorkerSetup ? 'hidden' : 'visible'"
          class="button button--green"
          @click="long(4000)"
        >
          Execute long running Worker
        </a>
        <a
          :class="needWorkerSetup || !longRunningWorkers.length ? 'hidden' : 'visible'"
          class="button button--green"
          @click="freeWorker"
        >
          Free long running Worker
        </a>
        <a
          class="button button--grey"
          @click="removeWorker"
        >
          Remove Web Worker
        </a>
        <a
          class="button button--grey"
          @click="createWorkers"
        >
          Create more Workers
        </a>
      </div>
    </div>
  </section>
</template>

<script>
import AppLogo from '~/components/AppLogo.vue'

export default {
  components: {
    AppLogo
  },
  data () {
    return {
      notification: '',
      workers: [],
      workerIndex: 0,
      longRunningWorkers: [],
      longIndex: 0
    }
  },
  computed: {
    needWorkerSetup () {
      return this.workers.length === 0 && this.longRunningWorkers.length === 0
    }
  },
  watch: {
    workers (workers) {
      if (workers.length === 0) this.notification = 'Zero free Web Workers - click "Create more Workers"'
    }
  },
  methods: {
    test () {
      const worker = this.workers[this.workerIndex++ % this.workers.length]

      if (worker) {
        worker.onmessage = (event) => {
          this.notification = event.data.hello
        }
      }

      if (worker) worker.postMessage({ hello: 'world' })
      else this.notification = 'No more test workers available'
    },
    long (milliseconds) {
      let worker = this.workers.shift()

      if (worker) {
        worker.onmessage = (event) => {
          this.notification = `expensive made ${event.data} loops`
          worker.onmessage = null
          this.workers.push(...this.longRunningWorkers.splice(this.longRunningWorkers.indexOf(worker), 1))
        }
        this.longRunningWorkers.push(worker)
      } else {
        worker = this.longRunningWorkers[ this.longIndex++ % this.longRunningWorkers.length]
      }

      worker.postMessage({ action: 'expensive', time: milliseconds })
    },
    freeWorker () {
      // we can't really free a worker, we can only terminate it and create a new
      const worker = this.longRunningWorkers.pop()
      worker.onmessage = null
      worker.terminate()
      this.workers.push(this.$worker.createWorker())
      this.notification = 'Worker freed'
    },
    removeWorker () {
      const worker = this.workers.pop() || this.longRunningWorkers.pop()

      if (!worker) return

      if (this.longRunningWorkers.indexOf(worker) > -1) this.longRunningWorkers.splice(this.longRunningWorkers.indexOf(worker), 1)

      worker.onmessage = null
      worker.terminate()
    },
    createWorkers () {
      if (process.client) {
        for(let i = 0, len = navigator.hardwareConcurrency || 1; i < len; i++) {
          this.workers.push(this.$worker.createWorker())
        }

        this.notification = 'Go nuts!'
      }
    }
  }
}
</script>

<style>
.hidden {
  visibility: hidden;
}

.visible {
  visibility: visible;
}

.container {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.title {
  font-family: "Quicksand", "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; /* 1 */
  display: block;
  font-weight: 300;
  font-size: 100px;
  color: #35495e;
  letter-spacing: 1px;
}

.subtitle {
  font-weight: 300;
  font-size: 42px;
  color: #526488;
  word-spacing: 5px;
  padding-bottom: 15px;
}

.links {
  padding-top: 15px;
}

.list {
  text-align: left;
  color: #526488;
  list-style: none;
}
</style>
