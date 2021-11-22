<template>
  <canvas class="webgl" :style="{ opacity: ready ? 1 : 0 }" />
</template>

<script>
export default {
  data () {
    return {
      ready: false
    }
  },
  async mounted () {
    const THREE = await import('three').then(m => m.default || m)
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js' /* webpackChunkName: "gem" */).then(m => m.default || m)
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js' /* webpackChunkName: "gem" */).then(m => m.default || m)
    // Canvas
    const canvas = document.querySelector('canvas.webgl')

    // Scene
    const scene = new THREE.Scene()

    // Models
    let gem
    let light

    const gltfLoader = new GLTFLoader()
    gltfLoader.load(
      '/3D/gem.gltf',
      (gltf) => {
        // Gem
        gem = gltf.scene.children[6]

        // Material setup
        const textureLoader = new THREE.TextureLoader()
        const roughnessTexture = textureLoader.load('/3D/roughness.jpeg')
        gem.material.roughnessMap = roughnessTexture
        gem.material.displacementScale = 0.15
        gem.material.emissiveIntensity = 0.4
        gem.material.refractionRatio = 1
        gem.rotation.z = 0
        scene.add(gem)

        light = gltf.scene.children[0]
        scene.add(light)
        this.ready = true
      }
    )

    // Lights
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 2)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 3)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const directionalLight2 = new THREE.DirectionalLight(0xFFFFFF, 3)
    directionalLight2.position.set(-1, -1, -1)
    scene.add(directionalLight2)

    // Settings
    const sizes = {
      width: 200,
      height: 200
    }

    // Base camera
    const camera = new THREE.PerspectiveCamera(
      75,
      sizes.width / sizes.height,
      0.1,
      100
    )
    camera.position.set(2, 2, 6)
    scene.add(camera)

    // Controls
    const controls = new OrbitControls(camera, canvas)
    controls.enableZoom = false
    controls.target.set(0, 0.75, 0)
    controls.enableDamping = true
    controls.enablePan = false
    // Lock Y Axis
    controls.minPolarAngle = Math.PI / 2
    controls.maxPolarAngle = Math.PI / 2

    // Render
    const renderer = new THREE.WebGLRenderer({
      antialiasing: true,
      canvas,
      alpha: true
    })
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    // Animations
    const clock = new THREE.Clock()
    let previousTime = 0

    const tick = () => {
      const elapsedTime = clock.getElapsedTime()
      const _deltaTime = elapsedTime - previousTime
      previousTime = elapsedTime
      if (gem) {
        gem.rotation.y = 1.1 * elapsedTime
      }

      // Update controls
      controls.update()

      // Render
      renderer.render(scene, camera)

      // Call tick again on the next frame
      window.requestAnimationFrame(tick)
    }

    tick()
  }
}
</script>

<style scoped>
.webgl {
  outline: none;
  width: 200px;
  height: 200px;
  opacity: 0;
  transition: opacity 1s ease;
}
</style>
