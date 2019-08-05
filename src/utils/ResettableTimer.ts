export class ResettableTimer {
  private cb: () => void
  private ms: number
  private timer: NodeJS.Timeout

  constructor(ms: number, cb: () => void) {
    this.ms = ms
    this.cb = cb
  }

  public stop = () => {
    clearTimeout(this.timer)
  }

  public start = () => {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.stop()
      this.cb()
    }, this.ms)
  }

  public reset = () => {
    this.stop()
    this.start()
  }
}
