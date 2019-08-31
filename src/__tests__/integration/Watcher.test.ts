import { Waiter } from '@hermes-serverless/custom-promises'
import axios from 'axios'
import { Request, Response } from 'express'
import getPort from 'get-port'
import getStream from 'get-stream'
import http from 'http'
import path from 'path'
import { RedisWrapper } from '../../resources/RedisWrapper'
import { RunsManager } from '../../resources/RunsManager'
import { Watcher } from '../../resources/RunsManager/WatchersManager/Watcher'
import { Logger } from '../../utils/Logger'
import { closeServer } from '../utils'
import { createFunctionData, getHermesConfig } from './utils'

Logger.enabled = false

const hermesFunctionPath = path.join(__dirname, '../fixtures/hermes-functions/cpp/char-printer')
process.env.HERMES_NETWORK = 'hermes-test'
const fnData = getHermesConfig(hermesFunctionPath)

afterAll(async () => {
  await RedisWrapper.shutdown()
  RunsManager.shutdown()
})

test('Watcher starts-up and shuts down', async () => {
  const onShutdown = jest.fn()
  const { gpuCapable, id: functionID, imageName } = createFunctionData(fnData)
  const w = new Watcher({ onShutdown, functionID, imageName, gpuCapable })
  await w.start()
  await w.shutdown()
})

test('Watcher accepts async runs', async () => {
  const onShutdown = jest.fn()
  const { gpuCapable, id: functionID, imageName } = createFunctionData(fnData)
  const w = new Watcher({ onShutdown, functionID, imageName, gpuCapable })
  await w.start()

  const waitServer = new Waiter()
  const server = http.createServer(async (req, res) => {
    await w.run(req as Request, res as Response, 'run-id', 'async')
    const runStatus = await w.getRunStatus('run-id', ['out', 'err'])
    expect(runStatus.status).toBe('success')
    expect(runStatus.out).toBe('a'.repeat(10))
    expect(runStatus.err).toBe('')
    const resultInfo = await w.getResultInfo('run-id')
    expect(resultInfo.status).toBe('success')
    expect(resultInfo.startTime).toBe(runStatus.startTime)
    expect(resultInfo.endTime).toBe(runStatus.endTime)
    const resultOutput = await getStream(await w.getResultOutput('run-id'))
    expect(resultOutput).toBe('a'.repeat(10))
    await w.shutdown()
    closeServer(server, waitServer)
  })

  const port = await getPort()
  server.listen(port)
  const res = await axios.post(`http://localhost:${port}`, 'a 10')
  expect(res.data.runID).toBe('run-id')
  await waitServer.finish()
}, 10000)

test('Watcher accepts sync runs', async () => {
  const onShutdown = jest.fn()
  const { gpuCapable, id: functionID, imageName } = createFunctionData(fnData)
  const w = new Watcher({ onShutdown, functionID, imageName, gpuCapable })
  await w.start()

  const waitServer = new Waiter()
  const server = http.createServer(async (req, res) => {
    // @ts-ignore
    await w.run(req, res, 'run-id', 'sync')
    const runStatus = await w.getRunStatus('run-id', ['out', 'err'])
    expect(runStatus.status).toBe('success')
    expect(runStatus.out).toBe('a'.repeat(10))
    expect(runStatus.err).toBe('')
    const resultInfo = await w.getResultInfo('run-id')
    expect(resultInfo.status).toBe('success')
    expect(resultInfo.startTime).toBe(runStatus.startTime)
    expect(resultInfo.endTime).toBe(runStatus.endTime)
    const resultOutput = await getStream(await w.getResultOutput('run-id'))
    expect(resultOutput).toBe('a'.repeat(10))
    await w.shutdown()
    closeServer(server, waitServer)
  })

  const port = await getPort()
  server.listen(port)
  const res = await axios.post(`http://localhost:${port}`, 'a 10')
  expect(res.data).toBe('a'.repeat(10))
  await waitServer.finish()
}, 10000)
