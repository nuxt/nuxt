#!/usr/bin/env node -r esm

import consola from 'consola'
import * as cli from '../src/index'
import _nuxt from './_nuxt.js'

_nuxt(cli, consola)
