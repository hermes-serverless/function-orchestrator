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
  private watcherType: RunRequest
  private onDone: () => void

  constructor(watcherType: RunRequest, onDone: () => void) {
    this.producerConsumer = new ProducerConsumer()
    this.watcherType = watcherType
    this.watchersStarting = []
    this.watchers = []
    this.onDone = onDone
  }

  public getWatcher = () => {
    const promise = this.producerConsumer.consume()
    const promisedAndReadyWatchers = this.watchersStarting.length + this.producerConsumer.itemsNumber()
    if (this.producerConsumer.requestsNumber() >= promisedAndReadyWatchers / 2) {
      this._createWatchers(2 * this.producerConsumer.requestsNumber() - promisedAndReadyWatchers)
    }
    return promise
  }

  public _createWatchers = (n: number) => {
    for (let i = 0; i < n; i += 1) {
      this._createWatcher()
    }
  }

  public _createWatcher = (tries = 2) => {
    if (tries === 0) return
    const onShutdown = (watcherID: string) => {
      Logger.info(this.addName(`Remove ${watcherID}`))
      this.watchers = this.watchers.filter(el => el.watcherID !== watcherID)
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
      })
      .catch(err => {
        Logger.error(this.addName(`Error starting watcher`), err)
        this._createWatcher(tries - 1)
      })
      .finally(() => {
        this.watchersStarting = this.watchersStarting.filter(el => el.watcherID !== watcher.watcherID)
        if (this.watchers.length === 0 && this.watchersStarting.length === 0 && tries === 1) this.onDone()
      })
  }

  private addName(msg: string) {
    return `[WatcherQueue] ${msg}`
  }
}
