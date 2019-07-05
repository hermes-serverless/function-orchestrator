import { Subprocess, SubprocessIO } from './../../utils/Subprocess'
import { HostPortProvider } from './HostPortProvider'
import { Logger } from '../../utils/Logger'

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
  docker: Subprocess
  id: string
  opts: DockerContainerOptions

  public start: (io: SubprocessIO) => void
  public getExitCode: () => void
  public getErr: () => void
  public getOut: () => void
  public getExitSignal: () => void
  public finish: () => void
  public getError: () => void

  constructor(id: string, options: DockerContainerOptions) {
    this.opts = options
    this.id = id

    this.docker = new Subprocess({
      id,
      path: process.env.DOCKER_BINARY_PATH || '/usr/bin/docker',
      args: this.createRunArgs(),
    })

    this.start = this.docker.start
    this.getExitCode = this.docker.getExitCode
    this.getErr = this.docker.getErr
    this.getOut = this.docker.getOut
    this.getExitSignal = this.docker.getExitSignal
    this.finish = this.docker.finish
    this.getError = this.docker.getError
  }

  private createRunArgs() {
    const { imageName, gpuCapable, detach, port, network, envVariables, dnsName } = this.opts

    let args = ['run']
    if (gpuCapable) args.push('--runtime=nvidia')
    if (port != null) args = args.concat([`-e`, `PORT=${port}`])
    if (dnsName != null) args.push(`--name=${dnsName}`)
    if (network != null) args.push(`--network=${network}`)
    if (detach) args.push('-d')

    if (envVariables != null) {
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
