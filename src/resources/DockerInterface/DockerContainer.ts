import execa, { ExecaChildProcess } from 'execa'
import { Logger } from '../../utils/Logger'
import { HostPortProvider } from './HostPortProvider'

interface DockerContainerOptions {
  imageName: string
  gpuCapable: boolean
  detach: boolean
  port: number
  network: string
  envVariables: string[]
  dnsName: string
}

export class DockerContainer {
  dockerProc: ExecaChildProcess<string>
  id: string
  opts: DockerContainerOptions

  constructor(id: string, options: DockerContainerOptions) {
    this.opts = options
    this.id = id
  }

  public start = () => {
    this.dockerProc = execa(process.env.DOCKER_BINARY_PATH || '/usr/bin/docker', this.createRunArgs())
    this.dockerProc.all.pipe(process.stderr)
    return this.dockerProc
  }

  private createRunArgs() {
    const { imageName, gpuCapable, detach, port, network, envVariables, dnsName } = this.opts

    let args = ['run']
    if (gpuCapable) args.push('--runtime=nvidia')
    if (!port) args = args.concat([`-e`, `PORT=${port}`])
    if (!dnsName) args.push(`--name=${dnsName}`)
    if (!network) args.push(`--network=${network}`)
    if (detach) args.push('-d')

    if (!envVariables) {
      envVariables.forEach(envVar => {
        args = args.concat(['-e', envVar])
      })
    }

    if (process.env.NODE_ENV === 'development') {
      const hostPort = HostPortProvider.get()
      args = args.concat(['-p', `${hostPort}:${port}`])
      Logger.info(`FunctionWatcher will listen on ${hostPort}`)
    }

    args.push(imageName)
    Logger.info(`Run args`, { args })
    return args
  }
}
