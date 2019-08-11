import { Waiter } from '@hermes-serverless/custom-promises'
import express from 'express'
import http from 'http'
import { Proxy } from '../../resources/ProxyServer'
import { Logger } from '../../utils/Logger'

Logger.enabled = false

const closeServer = (server: http.Server, waiter: Waiter<any>) => {
  server.close(err => {
    if (err) waiter.reject(err)
    waiter.resolve()
  })
}

it('Correctly sets the request headers on proxy', async () => {
  const app = express()
  const reqChange = jest.fn()
  const onErr = jest.fn()
  app.use('/', (req, res) => {
    reqChange.mockImplementationOnce(proxyReq => proxyReq.setHeader('x-custom-header-to-test', 'wow'))
    Proxy.redirect(req, res, 'http://localhost:23302', reqChange, onErr)
  })

  const waitSource = new Waiter()
  const waitDest = new Waiter()
  const dest = http.createServer((req, res) => {
    expect(req.headers['x-custom-header-to-test']).toBe('wow')
    expect(req.headers.host).toBe('localhost:23301')
    res.end()
    closeServer(source, waitSource)
    closeServer(dest, waitDest)
  })

  dest.listen(23302)
  const source = app.listen(23301, () => {
    http.request('http://localhost:23301', () => {}).end()
  })

  await waitDest.finish()
  await waitSource.finish()
  expect(reqChange).toBeCalledTimes(1)
  expect(onErr).not.toBeCalled()
})

it('Calls error callback', async () => {
  const app = express()
  const reqChange = jest.fn()
  const onErr = jest.fn()
  app.use('/', (req, res) => {
    onErr.mockImplementationOnce(err => {
      closeServer(source, waitSource)
      res.end()
    })
    Proxy.redirect(req, res, 'http://localhost:23302', reqChange, onErr)
  })

  app.use('/', (req, res) => {
    Proxy.redirect(req, res, 'http://localhost:23302', reqChange, onErr)
  })

  const waitSource = new Waiter()

  const source = app.listen(23301, () => {
    http.request('http://localhost:23301', () => {}).end()
  })

  await waitSource.finish()
  expect(reqChange).toBeCalledTimes(1)
  expect(onErr).toBeCalledTimes(1)
})
