const SECOND = 1000
const MINUTE = 60 * SECOND
export const MAX_WATCHER_IDLE_TIME = parseInt(process.env.MAX_WATCHER_IDLE_TIME, 10) || 10 * MINUTE
