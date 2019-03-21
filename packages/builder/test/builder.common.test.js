import { BundleBuilder } from '@nuxt/webpack'

import Builder from '../src/builder'
import BuildContext from '../src/context/build'
import { createNuxt } from './__utils__'

jest.mock('@nuxt/webpack', () => ({
  BundleBuilder: jest.fn(function () {
    this.name = 'webpack_builder'
  })
}))
jest.mock('../src/context/build', () => jest.fn(function () {
  this.name = 'build_context'
}))
jest.mock('../src/ignore')

describe('builder: builder common', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should get webpack builder by default', () => {
    const builder = new Builder(createNuxt(), {})

    const bundleBuilder = builder.getBundleBuilder()

    expect(BuildContext).toBeCalledTimes(1)
    expect(BuildContext).toBeCalledWith(builder)
    expect(BundleBuilder).toBeCalledTimes(1)
    expect(BundleBuilder).toBeCalledWith({ name: 'build_context' })
    expect(bundleBuilder).toEqual({ name: 'webpack_builder' })
  })

  test('should get custom builder from given constructor', () => {
    const builder = new Builder(createNuxt(), {})

    const CustomBundleBuilder = jest.fn(function () {
      this.name = 'custom_builder'
    })
    const bundleBuilder = builder.getBundleBuilder(CustomBundleBuilder)

    expect(BuildContext).toBeCalledTimes(1)
    expect(BuildContext).toBeCalledWith(builder)
    expect(CustomBundleBuilder).toBeCalledTimes(1)
    expect(CustomBundleBuilder).toBeCalledWith({ name: 'build_context' })
    expect(bundleBuilder).toEqual({ name: 'custom_builder' })
  })

  test('should call bundleBuilder forGenerate', () => {
    const bundleBuilder = {
      forGenerate: jest.fn()
    }
    const builder = new Builder(createNuxt(), bundleBuilder)

    builder.forGenerate()

    expect(bundleBuilder.forGenerate).toBeCalledTimes(1)
  })
})
