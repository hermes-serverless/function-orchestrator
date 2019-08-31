import { TimedWaiter, Waiter } from '@hermes-serverless/custom-promises'
import Deque from 'double-ended-queue'
import { RunRequest } from '.'
import { Logger } from '../../../utils/Logger'
import { Watcher } from './Watcher'

export class ProducerConsumer {
  private requests: Deque<Waiter<Watcher>>
  private items: Deque<Watcher>

  constructor() {
    this.requests = new Deque()
    this.items = new Deque()
  }

  public requestsNumber() {
    return this.requests.length
  }

  public itemsNumber() {
    return this.items.length
  }

  public _maybeFulfillRequest = () => {
    while (this.items.length > 0 && !this.items.peekFront().canAcceptNewRuns) {
      // If reached here, front Watcher should be turned off
      this.items.dequeue()
    }

    if (this.requests.length > 0 && this.items.length > 0) {
      this.requests.dequeue().resolve(this.items.dequeue())
    }
  }

  public add = (item: Watcher) => {
    this.items.enqueue(item)
    this._maybeFulfillRequest()
  }

  public consume = () => {
    const waiter: TimedWaiter<Watcher> = new TimedWaiter(20000)
    this.requests.enqueue(waiter)
    this._maybeFulfillRequest()
    return waiter.finish()
  }
}

export class WatcherQueue {
  private watchers: Watcher[]
  private watchersStarting: { promise: Promise<any>; watcherID: string }[]
  private producerConsumer: ProducerConsumer

  constructor(private watcherType: RunRequest, private onDone: () => void) {
    this.producerConsumer = new ProducerConsumer()
    this.watchersStarting = []
    this.watchers = []
  }

  public getWatcher = () => {
    const promisedAndReadyWatchers = this.watchersStarting.length + this.producerConsumer.itemsNumber()
    const newRequestsNumber = this.producerConsumer.requestsNumber() + 1
    if (newRequestsNumber >= promisedAndReadyWatchers / 2) {
      const create = 2 * newRequestsNumber - promisedAndReadyWatchers
      this._createWatchers(create)
    }
    const promise = this.producerConsumer.consume()
    return promise
  }

  public _createWatchers = (n: number) => {
    Logger.info(this.addName(`Create ${n} watchers`))
    for (let i = 0; i < n; i += 1) {
      this._createWatcher()
    }
  }

  public _createWatcher = (tries = 2) => {
    if (tries === 0) return
    const onShutdown = (watcherID: string) => {
      this.watchers = this.watchers.filter(el => el.watcherID !== watcherID)
      Logger.info(
        this.addName(
          `Remove ${watcherID}- watchers: ${this.watchers.length} - watchersStarting: ${this.watchersStarting.length}`
        )
      )
      if (this.watchers.length === 0 && this.watchersStarting.length === 0) this.onDone()
    }

    const watcher = new Watcher({
      onShutdown,
      ...this.watcherType,
    })

    const promise = watcher.start()
    this.watchersStarting.push({
      promise,
      watcherID: watcher.watcherID,
    })

    promise
      .then(() => {
        this.producerConsumer.add(watcher)
        this.watchers.push(watcher)
        Logger.info(
          this.addName(
            `New watcher - watchers: ${this.watchers.length} - watchersStarting: ${this.watchersStarting.length}`
          )
        )
      })
      .catch(err => {
        Logger.error(this.addName(`Error starting watcher`), err)
        this._createWatcher(tries - 1)
        Logger.info(
          this.addName(
            `Error starting watcher - tries left ${tries - 1} - watchers: ${this.watchers.length} - watchersStarting: ${
              this.watchersStarting.length
            }`
          )
        )
      })
      .finally(() => {
        this.watchersStarting = this.watchersStarting.filter(el => el.watcherID !== watcher.watcherID)
        if (this.watchers.length === 0 && this.watchersStarting.length === 0 && tries === 1) this.onDone()
      })
  }

  private addName(msg: string) {
    return `[WatcherQueue ${this.watcherType.imageName}] ${msg}`
  }
}
