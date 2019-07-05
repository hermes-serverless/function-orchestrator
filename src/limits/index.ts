const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

export const MAX_WATCHER_IDLE_TIME = parseInt(process.env.MAX_WATCHER_IDLE_TIME, 10) || 10 * MINUTE
export const RUNS_CLEANUP_INTERVAL = parseInt(process.env.RUNS_CLEANUP_INTERVAL, 10) || 1 * HOUR
