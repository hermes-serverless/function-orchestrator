import fs from 'fs'
import path from 'path'
import { RunData } from '@hermes-serverless/api-types-db-manager/run'
import { FunctionData } from '@hermes-serverless/api-types-db-manager/function'
import execa from 'execa'

interface FunctionBasicData {
  functionName: string
  language: string
  gpuCapable: boolean
  functionVersion: string
}

export const createImageName = ({ functionName, functionVersion }: any) => {
  return `function-orchestrator-test/watcher-${functionName}-${functionVersion}`
}

export const stopWatchers = (fnData: any) => {
  const { stdout } = execa.sync('docker', `container ls -q --filter ancestor=${createImageName(fnData)}`.split(' '))
  if (!stdout) return
  const containers = stdout.replace(/\n/g, ' ').split(' ')
  execa.sync('docker', ['stop', ...containers])
}

export const createRunData = ({ functionName, language, gpuCapable, functionVersion }: FunctionBasicData): RunData => {
  return {
    id: 'createdRunId',
    userId: 'runRequester',
    status: 'running',
    startTime: null,
    endTime: null,
    watcherID: 'someWatcherID',
    outputPath: '',
    function: {
      functionName,
      language,
      functionVersion,
      gpuCapable,
      scope: 'PUBLIC',
      imageName: createImageName({ functionName, functionVersion }),
      owner: { username: 'functionOwner' },
    },
  }
}

export const createFunctionData = ({
  functionName,
  language,
  gpuCapable,
  functionVersion,
}: FunctionBasicData): FunctionData => {
  return {
    functionName,
    functionVersion,
    gpuCapable,
    id: 'function-id',
    ownerId: 'functionOwner',
    scope: 'PUBLIC',
    imageName: createImageName({ functionName, functionVersion }),
  }
}

export const getHermesConfig = (functionPath: string) => {
  return JSON.parse(fs.readFileSync(path.join(functionPath, 'hermes.config.json'), { encoding: 'utf8' }))
}
