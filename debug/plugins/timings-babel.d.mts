// @ts-check

import { declare } from '@babel/helper-plugin-utils'

export const leading: string
export const trailing: string

export function generateInitCode (functionName: string): string
export function generateFinallyCode (functionName: string): string

export default declare
