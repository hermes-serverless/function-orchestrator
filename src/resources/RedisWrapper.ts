import R from 'ramda'
import redis from 'redis'
import { Logger } from './../utils/Logger'

type Listener = (...args: any) => void
interface ActiveSubscriptions {
  [key: string]: { id: string; listener: Listener }[]
}

class NoSuchListener extends Error {
  constructor(listener: string) {
    super(`No such listener ${listener}`)
  }
}

class NoSuchChannel extends Error {
  constructor(channel: string) {
    super(`No such channel ${channel}`)
  }
}

export class RedisWrapper {
  public static client = redis.createClient({
    host: 'event-broker',
    port: 6379,
  })

  private static subscriptions: ActiveSubscriptions = {}

  public static addSubscription(channelName: string, listenerID: string, listener: Listener) {
    const listenerWrapper = (channel: string, ...args: any) => {
      Logger.info(`RedisEvent `, { channel, ...args })
      if (channel === channelName) listener(channel, ...args)
    }
    this.client.subscribe(channelName)
    this.client.addListener('message', listenerWrapper)
    if (this.subscriptions[channelName] == null) {
      this.subscriptions[channelName] = []
    }

    this.subscriptions[channelName].push({
      id: listenerID,
      listener: listenerWrapper,
    })

    Logger.info(`Added subscription to channel ${channelName}, ${listenerID}`)
  }

  public static removeSubscription(channelName: string, listenerID: string) {
    if (R.isNil(this.subscriptions[channelName])) throw new NoSuchChannel(channelName)
    const listenerIndex = R.findIndex(el => el.id === listenerID, this.subscriptions[channelName])

    if (listenerIndex === -1) throw new NoSuchListener(listenerID)
    const { listener } = this.subscriptions[channelName].splice(listenerIndex, 1)[0]
    this.client.removeListener('message', listener)

    if (this.subscriptions[channelName].length === 0) {
      delete this.subscriptions[channelName]
      this.client.unsubscribe(channelName)
    }

    Logger.info(`Removed subscription to channel ${channelName}, ${listenerID}`)
  }
}

if (process.env.NODE_ENV === 'development') {
  RedisWrapper.client.monitor((err, res) => {
    Logger.info('Redis client entered monitor mode')
  })

  RedisWrapper.client.on('monitor', (time, args, rawReply) => {
    console.log(`[redis monitor] ${time}: ${args}`)
  })
}
