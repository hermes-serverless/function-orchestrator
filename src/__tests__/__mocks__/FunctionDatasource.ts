import { FunctionData, FunctionGetObj } from '@hermes-serverless/api-types-function-registry-api/function'

export const mockFunctionDatasource = () => {
  jest.doMock('../../datasources/FunctionDatasource.ts', () => {
    return {
      FunctionDatasource: {
        getFunction: jest.fn(),
      },
    }
  })

  const mockFunctionGet = (fn: FunctionData) => {
    const FunctionDatasource = require('../../datasources/FunctionDatasource').FunctionDatasource as Record<
      string,
      jest.Mock
    >
    const res: FunctionGetObj = { functions: [fn] }
    FunctionDatasource.getFunction.mockResolvedValue(res)
  }

  const unmockFunctionDatasource = () => {
    jest.unmock('../../datasources/FunctionDatasource.ts')
  }

  return { mockFunctionGet, unmockFunctionDatasource }
}
