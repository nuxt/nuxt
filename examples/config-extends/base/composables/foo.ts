import { useState } from '#app'

export const useFoo = () => useState('foo', () => 'foo')
