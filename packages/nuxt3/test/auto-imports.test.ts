import { expect } from 'chai'
import { TransformPlugin } from '../src/auto-imports/transform'

describe('module:auto-imports:build', () => {
  const { transform: _transform } = TransformPlugin.raw({ ref: 'vue', computed: 'bar' }, {} as any)
  const transform = (code: string) => _transform.call({} as any, code, '')

  it('should correct inject', async () => {
    const result = await transform('const a = ref(0)')
    expect(result).to.equal('import { ref } from \'vue\';const a = ref(0)')
  })

  it('should ignore imported', async () => {
    const result = await transform('import { ref } from "foo";const a = ref(0)')
    expect(result).to.equal(null)
  })

  it('should ignore comments', async () => {
    const result = await transform('// import { computed } from "foo"\n;const a = computed(0)')
    expect(result).to.equal('import { computed } from \'bar\';// import { computed } from "foo"\n;const a = computed(0)')
  })
})
