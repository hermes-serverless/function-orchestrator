import { DockerContainer, DockerContainerOptions } from '../../../resources/DockerInterface/DockerContainer'
import { Logger } from '../../../utils/Logger'

Logger.enabled = false

jest.mock('execa', () => {
  return jest.fn()
})

jest.mock('../../../resources/DockerInterface/HostPortProvider.ts', () => {
  return {
    HostPortProvider: {
      get: jest.fn().mockReturnValue(123),
    },
  }
})

describe('Docker arguments are correctly created', () => {
  test.each([
    [
      {
        imageName: 'dockerImageName',
        gpuCapable: false,
        detach: true,
        port: 3000,
        network: 'hermes',
        envVariables: ['a=500'],
        dnsName: 'watcher',
      },
      'production',
      'run -e PORT=3000 --name=watcher --network=hermes -d -e a=500 dockerImageName',
    ],
    [
      {
        imageName: 'dockerImageName',
        gpuCapable: false,
        port: 2000,
        detach: false,
        network: 'hermes',
        envVariables: [],
        dnsName: 'watcher',
      },
      'development',
      'run -e PORT=2000 --name=watcher --network=hermes -p 123:2000 dockerImageName',
    ],
  ])('%p %p ========> %p', (containerArgs: DockerContainerOptions, NODE_ENV: string, expected: string) => {
    process.env.NODE_ENV = NODE_ENV
    const c: any = new DockerContainer('id', containerArgs)
    expect(c.createRunArgs()).toEqual(expected.split(' '))
  })
})
