import { Waiter } from '@hermes-serverless/custom-promises'

export const sleep = (ms: number) => {
  const waiter = new Waiter()
  setTimeout(waiter.resolve, ms)
  return waiter.finish()
}
