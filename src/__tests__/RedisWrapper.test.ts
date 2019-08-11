import R from 'ramda'
import { Logger } from '../utils/Logger'

Logger.enabled = false

const subscribe = jest.fn()
const unsubscribe = jest.fn()
const addListener = jest.fn()
const removeListener = jest.fn()

jest.doMock('redis', () => {
  return {
    createClient: () => ({ subscribe, unsubscribe, addListener, removeListener }),
  }
})

const RedisWrapper = require('../resources/RedisWrapper').RedisWrapper

beforeEach(() => {
  jest.clearAllMocks()
  RedisWrapper.subscriptions = {}
})

describe('addSubscription', () => {
  const callAndCheck = (fn: any, mock: any, channel: string) => {
    expect(mock).not.toBeCalled()
    fn(channel, 'arg1', 'arg2', 'arg3')
    expect(mock).toBeCalledTimes(1)
    expect(mock).toBeCalledWith(channel, 'arg1', 'arg2', 'arg3')
  }

  test('Listener wrapper - calls listener when channel match', () => {
    const listener = jest.fn()
    RedisWrapper.addSubscription('channelID', 'listenerID', listener)
    callAndCheck(addListener.mock.calls[0][1], listener, 'channelID')
  })

  test('Listener wrapper - doesnt call listener when channel doesnt match', () => {
    const listener = jest.fn()
    RedisWrapper.addSubscription('channelID', 'listenerID', listener)
    addListener.mock.calls[0][1]('differentChannel', 'arg1', 'arg2', 'arg3')
    expect(listener).not.toBeCalled()
  })

  test('One sub', () => {
    const listener = jest.fn()
    RedisWrapper.addSubscription('channelID', 'listenerID', listener)
    expect(subscribe).toBeCalledTimes(1)
    expect(subscribe).toBeCalledWith('channelID')
    expect(addListener).toBeCalledTimes(1)
    expect(R.keys(RedisWrapper.subscriptions).length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID'].length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID'][0].id).toBe('listenerID')
    callAndCheck(RedisWrapper.subscriptions['channelID'][0].listener, listener, 'channelID')
  })

  test('Two same channel subs', () => {
    const [listener1, listener2] = [jest.fn(), jest.fn()]
    RedisWrapper.addSubscription('channelID', 'listenerID1', listener1)
    RedisWrapper.addSubscription('channelID', 'listenerID2', listener2)
    expect(R.keys(RedisWrapper.subscriptions).length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID'].length).toBe(2)
    expect(RedisWrapper.subscriptions['channelID'][0].id).toBe('listenerID1')
    expect(RedisWrapper.subscriptions['channelID'][1].id).toBe('listenerID2')
  })

  test('Two different channels subs', () => {
    const [listener1, listener2] = [jest.fn(), jest.fn()]
    RedisWrapper.addSubscription('channelID1', 'listenerID1', listener1)
    RedisWrapper.addSubscription('channelID2', 'listenerID2', listener2)
    expect(R.keys(RedisWrapper.subscriptions).length).toBe(2)
    expect(RedisWrapper.subscriptions['channelID1'].length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID2'].length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID1'][0].id).toBe('listenerID1')
    expect(RedisWrapper.subscriptions['channelID2'][0].id).toBe('listenerID2')
  })
})

describe('removeSubscription', () => {
  test('Lenght zeroes', () => {
    RedisWrapper.addSubscription('channelID', 'listenerID', jest.fn())
    RedisWrapper.removeSubscription('channelID', 'listenerID')
    expect(R.keys(RedisWrapper.subscriptions).length).toBe(0)
  })

  test('Lenght doesnt zero', () => {
    RedisWrapper.addSubscription('channelID1', 'listenerID1', jest.fn())
    RedisWrapper.addSubscription('channelID1', 'listenerID2', jest.fn())
    RedisWrapper.addSubscription('channelID2', 'listenerID3', jest.fn())
    RedisWrapper.removeSubscription('channelID1', 'listenerID1')
    expect(R.keys(RedisWrapper.subscriptions).length).toBe(2)
    expect(RedisWrapper.subscriptions['channelID1'].length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID1'][0].id).toBe('listenerID2')
    expect(RedisWrapper.subscriptions['channelID2'].length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID2'][0].id).toBe('listenerID3')
  })

  test('Remove unnexistent listener', () => {
    RedisWrapper.addSubscription('channelID', 'listenerID', jest.fn())
    expect(() => RedisWrapper.removeSubscription('channelID', 'listenerID1')).toThrow(`No such listener listenerID1`)
    expect(R.keys(RedisWrapper.subscriptions).length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID'][0].id).toBe('listenerID')
  })

  test('Remove unnexistent channel', () => {
    RedisWrapper.addSubscription('channelID', 'listenerID', jest.fn())
    expect(() => RedisWrapper.removeSubscription('channelID1', 'listenerID')).toThrow(`No such channel channelID1`)
    expect(R.keys(RedisWrapper.subscriptions).length).toBe(1)
    expect(RedisWrapper.subscriptions['channelID'][0].id).toBe('listenerID')
  })
})
