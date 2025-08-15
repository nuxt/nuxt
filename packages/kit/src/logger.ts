import { consola } from 'consola'
import type { ConsolaInstance, ConsolaOptions } from 'consola'

export const logger = consola;

export default function useLogger (tag?: string, options: Partial<ConsolaOptions> = {}) {
  return tag ? logger.create(options).withTag(tag) : logger
}
 
/**
 * EnvLogger is authored by maxkcyfun on 8-14-25.
 * START EvnLogger. 
 */
interface LoggerOptions {
  tag?: string;
  log(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
  critical(message: string, ...args: any[]): void;
  box(message: string, ...args: any[]): void;
}

/**
 * Log for the specified environment.
 */
class EnvLogger implements LoggerOptions {
  private logger: ConsolaInstance;

  constructor(
    consolaLogger: ConsolaInstance,
    private env: 'development' | 'production',
    tag?: string
  ) {
    const suffix = this.env === 'development' ? ':dev' : ':prod';
    this.logger = consolaLogger.withTag(tag ? `${tag}${suffix}` : `logger${suffix}`);
  }
  tag?: string | undefined;

  private shouldLog() {
    return process.env.NODE_ENV === this.env;
  }

  log(msg: string, ...args: any[]) { if (this.shouldLog()) this.logger.log(msg, ...args); }
  info(msg: string, ...args: any[]) { if (this.shouldLog()) this.logger.info(msg, ...args); }
  warn(msg: string, ...args: any[]) { if (this.shouldLog()) this.logger.warn(msg, ...args); }
  error(msg: string, ...args: any[]) { if (this.shouldLog()) this.logger.error(msg, ...args); }
  success(msg: string, ...args: any[]) { if (this.shouldLog()) this.logger.success(`✅ ${msg}`, ...args); }
  critical(msg: string, ...args: any[]) { if (this.shouldLog()) this.logger.error(`🔥 CRITICAL: ${msg}`, ...args); }
  box(msg: string, ...args: any[]) { if (this.shouldLog()) this.logger.box(msg, ...args); }
}
/**
 * Log anywhere.
 */
class Logger implements LoggerOptions {
  private logger: ConsolaInstance;
  public dev: EnvLogger;
  public prod: EnvLogger;

  constructor(consolaLogger: ConsolaInstance, tag?: string) {
    this.logger = consolaLogger.withTag(tag ?? 'logger');
    this.dev = new EnvLogger(consolaLogger, 'development', tag);
    this.prod = new EnvLogger(consolaLogger, 'production', tag);
  }

  log(msg: string, ...args: any[]) { this.logger.log(msg, ...args); }
  info(msg: string, ...args: any[]) { this.logger.info(msg, ...args); }
  warn(msg: string, ...args: any[]) { this.logger.warn(msg, ...args); }
  error(msg: string, ...args: any[]) { this.logger.error(msg, ...args); }
  success(msg: string, ...args: any[]) { this.logger.success(`✅ ${msg}`, ...args); }
  critical(msg: string, ...args: any[]) { this.logger.error(`🔥 CRITICAL: ${msg}`, ...args); }
  box(msg: string, ...args: any[]) {  this.logger.box(msg, ...args); }
}

const loggerCache = new Map<string, Logger>();

export function useEnvLogger(tag = '[Env Logger]', options: Partial<ConsolaOptions> = {}): Logger {
  if (!loggerCache.has(tag)) {
    const baseLogger = consola.create({ ...options });
    loggerCache.set(tag, new Logger(baseLogger, tag));
  }
  return loggerCache.get(tag)!;
}

/**
 * Copy and paste the page and endpoint files below to test the logger.
 * Remove this after testing. Note, I have not throughly tested this.
 */

/**
 * // index.vue
<script setup lang="ts">
// make sure to import correctly
import useLogger, { useEnvLogger } from '~/modules/EnvLogger'
const logger = useLogger('[index.vue]', { level: 3 })
const envLogger = useEnvLogger('[index.vue]', { level: 3 })
const userInput = ref<string>('');

function onLogClick(input: string): void {

  $fetch('/api/logger-endpoint', {
    method: 'POST',
    body: {
      message: input
    }
  });

  logger.log(input);
  envLogger.log(input);
  envLogger.dev.log(input);
  envLogger.prod.log(input);


  logger.info(input);
  envLogger.info(input);
  envLogger.dev.info(input);
  envLogger.prod.info(input);

  logger.warn(input);
  envLogger.warn(input);
  envLogger.dev.warn(input);
  envLogger.prod.warn(input);

  logger.error(input);
  envLogger.error(input);
  envLogger.dev.error(input);
  envLogger.prod.error(input);

  logger.success(input);
  envLogger.success(input);
  envLogger.dev.success(input);
  envLogger.prod.success(input);

  logger.error(input);
  envLogger.critical(input);
  envLogger.dev.critical(input);
  envLogger.prod.critical(input);

  logger.box(input);
  envLogger.box(input);
  envLogger.dev.box(input);
  envLogger.prod.box(input);

  userInput.value = '';
}


</script>

<template>
  <div>
    <h1>Hello from logger!</h1>
    <h4>See the debug console for logs.</h4>
    <input v-model="userInput" placeholder="Type something here..." @keyup.enter="onLogClick(userInput)"></input>
    <button @click="onLogClick(userInput)">Log input</button>
  </div>
</template>

 */

/**
 * // logger-endpoint.ts
import useLogger, { useEnvLogger } from '@/modules/EnvLogger'

export default defineEventHandler(async (event) => {
const logger = useLogger();
const envLogger = useEnvLogger();

  const body = await readBody(event);

  logger.log(body.message);
  envLogger.log(body.message);
  envLogger.dev.log(body.message);
  envLogger.prod.log(body.message);


  logger.info(body.message);
  envLogger.info(body.message);
  envLogger.dev.info(body.message);
  envLogger.prod.info(body.message);

  logger.warn(body.message);
  envLogger.warn(body.message);
  envLogger.dev.warn(body.message);
  envLogger.prod.warn(body.message);

  logger.error(body.message);
  envLogger.error(body.message);
  envLogger.dev.error(body.message);
  envLogger.prod.error(body.message);

  logger.success(body.message);
  envLogger.success(body.message);
  envLogger.dev.success(body.message);
  envLogger.prod.success(body.message);

  logger.error(body.message);
  envLogger.critical(body.message);
  envLogger.dev.critical(body.message);
  envLogger.prod.critical(body.message);

  logger.box(body.message);
  envLogger.box(body.message);
  envLogger.dev.box(body.message);
  envLogger.prod.box(body.message);

  setResponseStatus(event, 200);
  return;
})

 */

/**
 * END EvnLogger.
 */
