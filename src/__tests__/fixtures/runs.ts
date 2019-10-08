import { RunData } from '@hermes-serverless/api-types-function-registry-api/run'

export const runSamples: Record<string, RunData> = {
  finishedRun: {
    id: 'finishedRunID',
    userId: 'userWhoExecuted',
    status: 'success',
    startTime: new Date(),
    outputPath: '',
    endTime: new Date(),
    watcherID: 'Useless',
    function: {
      functionName: 'someFunction',
      language: 'cuda',
      gpuCapable: true,
      scope: 'PUBLIC',
      imageName: 'someFunctionDockerImage',
      functionVersion: '1.0.0',
      owner: { username: 'ownerUsername' },
    },
  },
  createdRun: {
    id: 'createdRunId',
    userId: 'userWhoExecuted',
    status: 'success',
    startTime: new Date(),
    outputPath: '',
    endTime: new Date(),
    watcherID: 'Useless',
    function: {
      functionName: 'someFunction',
      language: 'cuda',
      gpuCapable: true,
      scope: 'PUBLIC',
      imageName: 'someFunctionDockerImage',
      functionVersion: '1.0.0',
      owner: { username: 'ownerUsername' },
    },
  },
}
