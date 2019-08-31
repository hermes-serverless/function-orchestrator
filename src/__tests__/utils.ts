import { Waiter } from '@hermes-serverless/custom-promises'
import http from 'http'

export const closeServer = (server: http.Server, waiter: Waiter<any>) => {
  server.close(err => {
    if (err) waiter.reject(err)
    waiter.resolve()
  })
}
