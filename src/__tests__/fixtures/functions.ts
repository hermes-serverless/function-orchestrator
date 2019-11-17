import { FunctionData } from '@hermes-serverless/api-types-function-registry-api/function'

export const functionSamples: Record<string, FunctionData> = {
  someFunction: {
    id: 'someFunctionID',
    ownerId: 'ownerID',
    functionName: 'someFunction',
    language: 'cuda',
    gpuCapable: true,
    scope: 'PUBLIC',
    imageName: 'someFunctionDockerImage',
    functionVersion: '1.0.0',
    createdAt: 'createdAtMock',
    updatedAt: 'updatedAtMock'
  },
}
