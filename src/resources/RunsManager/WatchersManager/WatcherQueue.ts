import { Watcher } from './Watcher'
import R from 'ramda'

class Scheduler {
  arr: Watcher[]

  constructor() {
    this.arr = []
  }

  public pop(id: string) {
    const index = R.findIndex(el => el.getID() === id, this.arr)
    const ret = this.arr[index]
    this.arr.splice(index, 1)
    return ret
  }

  public getAvailable() {
    return R.find(el => el.canAcceptNewRuns(), this.arr)
  }

  public push(obj: Watcher) {
    this.arr.push(obj)
    return obj
  }
}

export class WatcherQueue {
  scheduler: Scheduler

  constructor() {
    this.scheduler = new Scheduler()
  }

  public getAvailable() {
    return this.scheduler.getAvailable()
  }

  public pop(watcherID: string) {
    return this.scheduler.pop(watcherID)
  }

  public push(watcher: Watcher) {
    return this.scheduler.push(watcher)
  }

  public getAll() {
    return this.scheduler.arr
  }

  public getLen() {
    return this.scheduler.arr.length
  }
}
