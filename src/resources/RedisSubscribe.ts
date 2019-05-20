import { Logger } from './../utils/Logger'
import redis from 'redis'
import crypto from 'crypto'

type Listener = (...args: any) => void
interface ActiveSubscriptions {
  [key: string]: { listener: Listener }
}

export class RedisSubscribe {
  static client = redis.createClient({
    host: 'event-broker',
    port: 6379,
  })

  static subscriptions: ActiveSubscriptions = {}

  public static addSubscription(listener: Listener): string {
    const id = crypto.randomBytes(16).toString('hex')
    const listenerWrapper = (channel: string, ...args: any) => {
      if (channel === id) listener(channel, ...args)
    }
    RedisSubscribe.client.subscribe(id)
    RedisSubscribe.client.addListener('message', listenerWrapper)
    RedisSubscribe.subscriptions[id] = {
      listener,
    }
    Logger.info(`Added subscription to channel ${id}`)
    return id
  }

  public static removeSubscription(id: string) {
    const { listener } = RedisSubscribe.subscriptions[id]
    RedisSubscribe.client.unsubscribe(id)
    RedisSubscribe.client.removeListener('message', listener)
    Logger.info(`Removed subscription to channel ${id}`)
  }
}

if (process.env.NODE_ENV === 'development') {
  RedisSubscribe.client.monitor((err, res) => {
    Logger.info('Redis client entered monitor mode')
  })

  RedisSubscribe.client.on('monitor', (time, args, raw_reply) => {
    console.log(`[redis monitor] ${time}: ${args}`)
  })
}
