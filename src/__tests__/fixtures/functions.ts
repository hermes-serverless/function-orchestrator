import { FunctionData } from '@hermes-serverless/api-types-db-manager/function'

export const samples: Record<string, FunctionData> = {
  someFunction: {
    id: 'someFunctionID',
    ownerId: 'ownerID',
    functionName: 'someFunction',
    gpuCapable: true,
    scope: 'PUBLIC',
    imageName: 'someFunctionDockerImage',
    functionVersion: '1.0.0',
  },
}
