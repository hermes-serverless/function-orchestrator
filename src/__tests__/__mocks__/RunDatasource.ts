import { RunData, RunPostObj, RunGetObj, RunPutObj } from '@hermes-serverless/api-types-function-registry-api/run'

export const mockRunDatasource = () => {
  jest.doMock('../../datasources/RunDatasource.ts', () => {
    return {
      RunDatasource: {
        getRun: jest.fn(),
        createFunctionRun: jest.fn(),
        updateRun: jest.fn(),
      },
    }
  })

  const mockCreateFunctionRun = (runData: RunData) => {
    const RunDatasource = require('../../datasources/RunDatasource').RunDatasource as Record<string, jest.Mock>
    const ret: RunPostObj = { createdRun: [runData] }
    RunDatasource.createFunctionRun.mockResolvedValue(ret)
  }

  const mockGetRun = (runData: RunData) => {
    const RunDatasource = require('../../datasources/RunDatasource').RunDatasource as Record<string, jest.Mock>
    const ret: RunGetObj = { runs: [runData] }
    RunDatasource.getRun.mockResolvedValue(ret)
  }

  const mockUpdateRun = (runData: RunData) => {
    const RunDatasource = require('../../datasources/RunDatasource').RunDatasource as Record<string, jest.Mock>
    const ret: RunPutObj = { updatedRuns: [runData] }
    RunDatasource.updateRun.mockResolvedValue(ret)
  }

  const unmockRunDatasource = () => {
    jest.unmock('../../datasources/RunDatasource.ts')
  }

  return { mockCreateFunctionRun, mockGetRun, mockUpdateRun, unmockRunDatasource }
}
