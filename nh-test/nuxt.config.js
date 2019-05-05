import pkg from './package'
import esm from 'esm'

export default async function() {
  return await esm(module)('./conf')
}
