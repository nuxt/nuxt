export default defineEventHandler(() => ({
  shared: useLayerPrecedence(),
  layerOnly: useLayerOnlyUtil(),
}))
