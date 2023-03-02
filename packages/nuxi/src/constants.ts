/**
 * Special exit code to restart the process
 *
 * Usage:
 * ```ts
 * if (process.env.NUXI_CLI_WRAPPER) {
 *   process.exit(EXIT_CODE_RESTART)
 * }
 * ```
 */
export const EXIT_CODE_RESTART = 85
