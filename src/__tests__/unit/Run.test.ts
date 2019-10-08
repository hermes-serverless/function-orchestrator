import { FunctionData, FunctionGetObj } from '@hermes-serverless/api-types-function-registry-api/function'
import { RunData, RunGetObj, RunPostObj } from '@hermes-serverless/api-types-function-registry-api/run'
import { Waiter } from '@hermes-serverless/custom-promises'
import execa from 'execa'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'
import { FunctionIDWithOwner } from '../../datasources/RunDatasource'
import { Run } from '../../resources/RunsManager/Run'
import { Logger } from '../../utils/Logger'
import { functionSamples } from '../fixtures/functions'
import { runSamples } from '../fixtures/runs'

Logger.enabled = false
const tmpPath = path.join(os.tmpdir(), 'run-tests')

jest.mock('../../resources/RunsManager/paths', () => {
  const path = jest.requireActual('path')
  const os = jest.requireActual('os')
  return {
    resultsBasePath: path.join(os.tmpdir(), 'run-tests'),
  }
})

jest.mock('../../resources/RunsManager/WatchersManager', () => {
  return {
    WatchersManager: {
      getAvailableWatcher: jest.fn(),
    },
  }
})

jest.mock('../../datasources/RunDatasource', () => {
  return {
    RunDatasource: {
      getRun: jest.fn(),
      deleteRun: jest.fn(),
      updateRun: jest.fn(),
      createFunctionRun: jest.fn(),
    },
  }
})

jest.mock('../../datasources/FunctionDatasource', () => {
  return {
    FunctionDatasource: {
      getFunction: jest.fn(),
    },
  }
})

const RunDatasource = require('../../datasources/RunDatasource').RunDatasource as Record<string, jest.Mock>
const FunctionDatasource = require('../../datasources/FunctionDatasource').FunctionDatasource as Record<
  string,
  jest.Mock
>
const WatchersManager = require('../../resources/RunsManager/WatchersManager').WatchersManager as Record<
  string,
  jest.Mock
>

const prepareRunToCreate = (sample: RunData) => {
  const user = { id: sample.userId, username: 'usernameWhoExecuted' }
  const functionID: FunctionIDWithOwner = {
    functionName: sample.function.functionName,
    functionVersion: sample.function.functionVersion,
    functionOwner: sample.function.owner.username,
  }

  const postMock: RunPostObj = { createdRun: [sample] }
  RunDatasource.createFunctionRun.mockResolvedValue(postMock)
  return { user, functionID }
}

const initRun = async (runData: RunData) => {
  const token = 'token123'
  const { user, functionID } = prepareRunToCreate(runData)
  const r: any = new Run()
  await r.init({ user, ...functionID }, token)
  expect(r.finishedExecuting).toBe(false)
  expect(r.finishedTransferingResult).toBe(false)
  return { r, token, user, functionID }
}

const prepareStart = async (runData: RunData, functionData: FunctionData) => {
  const req = jest.fn()
  const res = jest.fn()
  const { r, token, user, functionID } = await initRun(runData)
  const watcher = { run: jest.fn() }
  WatchersManager.getAvailableWatcher.mockResolvedValue(watcher)
  const runRequest = {
    functionID: functionData.id,
    gpuCapable: functionData.gpuCapable,
    imageName: functionData.imageName,
  }
  r.createRunRequest = jest.fn().mockResolvedValue(runRequest)
  r.transferResult = jest.fn()
  r.onStartError = jest.fn()
  return { r, watcher, user, functionID, runRequest, token, req, res }
}

beforeEach(() => {
  execa.sync('rm', ['-rf', tmpPath])
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true })
  jest.clearAllMocks()
})

describe('init', () => {
  test('Using existing Run', async () => {
    const user = { id: 'userWhoExecuted', username: 'usernameWhoExecuted' }
    const token = 'token123'
    const r: any = new Run()
    const getMock: RunGetObj = { runs: [runSamples.finishedRun] }
    RunDatasource.getRun.mockResolvedValue(getMock)
    await r.init({ user, id: 'finishedRunID' }, token)
    expect(RunDatasource.getRun).toBeCalledTimes(1)
    expect(RunDatasource.getRun).toBeCalledWith(user, { id: 'finishedRunID' }, token)
    expect(r.id).toBe('finishedRunID')
    expect(r.finishedExecuting).toBe(true)
    expect(r.finishedTransferingResult).toBe(true)
  })

  test('Creating new run', async () => {
    const token = 'token123'
    const r: any = new Run()
    const { user, functionID } = prepareRunToCreate(runSamples.createdRun)
    await r.init({ user, ...functionID }, token)
    expect(RunDatasource.createFunctionRun).toBeCalledTimes(1)
    expect(RunDatasource.createFunctionRun).toBeCalledWith(user, functionID, { status: 'running' }, token)
    expect(r.id).toBe('createdRunId')
    expect(r.finishedExecuting).toBe(false)
    expect(r.finishedTransferingResult).toBe(false)
  })

  test('Error using existing Run', async () => {
    const user = { id: 'userWhoExecuted', username: 'usernameWhoExecuted' }
    const token = 'token123'
    const r: any = new Run()
    const err = new Error('ERR_MOCK')
    RunDatasource.getRun.mockRejectedValue(err)
    await expect(r.init({ user, id: 'finishedRunID' }, token)).rejects.toThrow(err)
  })

  test('Error on new run', async () => {
    const token = 'token123'
    const r: any = new Run()
    const { user, functionID } = prepareRunToCreate(runSamples.createdRun)
    const err = new Error('ERR_MOCK')
    RunDatasource.createFunctionRun.mockRejectedValue(err)
    await expect(r.init({ user, ...functionID }, token)).rejects.toThrow(err)
  })
})

describe('createRunRequest', () => {
  test('Calls FunctionDatasource correctly', async () => {
    const token = 'token123'
    const r: any = new Run()
    const { user, functionID } = prepareRunToCreate(runSamples.createdRun)
    const functionGetMock: FunctionGetObj = { functions: [functionSamples.someFunction] }
    FunctionDatasource.getFunction.mockResolvedValue(functionGetMock)
    await r.init({ user, ...functionID }, token)
    await expect(r.createRunRequest(token)).resolves.toEqual({
      functionID: 'someFunctionID',
      gpuCapable: true,
      imageName: 'someFunctionDockerImage',
    })
    expect(FunctionDatasource.getFunction).toBeCalledTimes(1)
    expect(FunctionDatasource.getFunction).toBeCalledWith(user, functionID, token)
  })
})

describe('startRun', () => {
  test('Behavior on success is as expected', async done => {
    const { r, watcher, runRequest, token, req, res } = await prepareStart(
      runSamples.createdRun,
      functionSamples.someFunction
    )
    const waiter = new Waiter()
    watcher.run.mockResolvedValue(waiter)

    await expect(r.startRun(req, res, token, 'some-run-type')).resolves.toBeUndefined()
    expect(WatchersManager.getAvailableWatcher).toBeCalledTimes(1)
    expect(WatchersManager.getAvailableWatcher).toBeCalledWith(runRequest)
    expect(r.watcherResponsible).toBe(watcher)
    expect(watcher.run).toBeCalledTimes(1)
    expect(watcher.run).toBeCalledWith(req, res, runSamples.createdRun.id, 'some-run-type')

    setTimeout(waiter.resolve, 500)
    await waiter.finish()
    setTimeout(() => {
      expect(r.transferResult).toBeCalledTimes(1)
      expect(r.finishedExecuting).toBe(true)
      expect(r.onStartError).not.toBeCalled()
      done()
    }, 500)
  })

  test('Behavior on preparing phase error is as expected', async () => {
    const { r, req, res, token } = await prepareStart(runSamples.createdRun, functionSamples.someFunction)
    const err = new Error('MOCK-ERR')
    WatchersManager.getAvailableWatcher.mockRejectedValueOnce(err)
    await expect(r.startRun(req, res, token, 'some-run-type')).resolves.toBeUndefined()
    expect(r.onStartError).toBeCalledTimes(1)
    expect(r.onStartError).toBeCalledWith(token, err)
    expect(r.transferResult).not.toBeCalled()
    expect(r.finishedExecuting).toBe(false)
    expect(r.finishedTransferingResult).toBe(false)
  })

  test('Behavior when done promise rejects is as expected', async () => {
    const { r, req, res, token, watcher } = await prepareStart(runSamples.createdRun, functionSamples.someFunction)
    const err = new Error('MOCK-ERR')
    watcher.run.mockRejectedValue(err)
    await expect(r.startRun(req, res, token, 'some-run-type')).resolves.toBeUndefined()
    expect(r.onStartError).toBeCalledTimes(1)
    expect(r.onStartError).toBeCalledWith(token, err)
    expect(r.transferResult).not.toBeCalled()
    expect(r.finishedExecuting).toBe(false)
    expect(r.finishedTransferingResult).toBe(false)
  })
})

describe('onStartError', () => {
  test('Works as expected', async () => {
    const { r, token } = await initRun(runSamples.createdRun)
    RunDatasource.updateRun.mockResolvedValue({ updatedRuns: ['someData'] })
    const err = new Error('ERR-MOCK')
    await r.onStartError(token, err)
    expect(r.data).toBe('someData')
    expect(r.finishedExecuting).toBe(true)
    expect(r.finishedTransferingResult).toBe(true)
    expect(fs.readFileSync(path.join(tmpPath, 'output-createdRunId'), { encoding: 'utf-8' })).toBe('')
    expect(JSON.parse(fs.readFileSync(path.join(tmpPath, 'info-createdRunId'), { encoding: 'utf-8' }))).toEqual({
      status: 'error',
      error: 'Error - ERR-MOCK',
    })
  })

  test('Works on update error', async () => {
    const { r, token } = await initRun(runSamples.createdRun)
    RunDatasource.updateRun.mockRejectedValue(new Error())
    const err = new Error('ERR-MOCK')
    await r.onStartError(token, err)
    expect(r.finishedExecuting).toBe(true)
    expect(r.finishedTransferingResult).toBe(true)
    expect(fs.readFileSync(path.join(tmpPath, 'output-createdRunId'), { encoding: 'utf-8' })).toBe('')
    expect(JSON.parse(fs.readFileSync(path.join(tmpPath, 'info-createdRunId'), { encoding: 'utf-8' }))).toEqual({
      status: 'error',
      error: 'Error - ERR-MOCK',
    })
  })
})

describe('transferResult', () => {
  test('Works as expected', async () => {
    const s = new PassThrough()
    s.end('asdf')
    const { r } = await initRun(runSamples.createdRun)
    const watcher = {
      getResultInfo: jest.fn().mockResolvedValue({ status: 'finished' }),
      getResultOutput: jest.fn().mockResolvedValue(s),
      deleteRunData: jest.fn(),
    }
    r.watcherResponsible = watcher
    r.persistResult = jest.fn()
    await r.transferResult()
    expect(fs.readFileSync(path.join(tmpPath, 'output-createdRunId'), { encoding: 'utf-8' })).toBe('asdf')
    expect(JSON.parse(fs.readFileSync(path.join(tmpPath, 'info-createdRunId'), { encoding: 'utf-8' }))).toEqual({
      status: 'finished',
    })
    expect(watcher.deleteRunData).toBeCalledTimes(1)
  })
})
