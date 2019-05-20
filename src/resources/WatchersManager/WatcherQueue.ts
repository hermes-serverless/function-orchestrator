class Scheduler {
  arr: string[]

  constructor() {
    this.arr = []
  }

  public pop() {
    return this.arr.pop()
  }

  public push(dnsName: string) {
    this.arr.push(dnsName)
  }
}

class NoActiveWatcher extends Error {
  constructor(functionName: string, message?: string) {
    super(`No active watcher for ${functionName}.` + (message ? ` ${message}` : ''))
    Error.captureStackTrace(this, NoActiveWatcher)
  }
}

export class WatcherQueue {
  functionName: string
  scheduler: Scheduler

  constructor(functionName: string) {
    this.functionName = functionName
    this.scheduler = new Scheduler()
  }

  public getEndpoint = (dnsName: string) => {
    return 'http://' + dnsName + ':3000'
  }

  public pop() {
    const dnsName = this.scheduler.pop()
    if (dnsName == null) throw new NoActiveWatcher(this.functionName)
    return this.getEndpoint(dnsName)
  }

  public push(endpoint: string) {
    let reg = /.*\/\/([^:]*):.*/
    if (reg.test(endpoint)) {
      this.scheduler.push(reg.exec(endpoint)[1])
    } else this.scheduler.push(endpoint)
  }
}
