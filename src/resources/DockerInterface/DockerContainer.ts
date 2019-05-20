import { HostPortProvider } from './HostPortProvider'
import { Logger } from '../../utils/Logger'
import { Subprocess } from './Subprocess'

class DockerContainer {
  imageName: string
  dockerProc: any
  gpuCapable: boolean
  detach: boolean
  port: string
  network: string
  envVariables: string[]
  dnsName: string

  constructor({ imageName, gpuCapable, port, detach, network, envVariables, dnsName }: any) {
    this.imageName = imageName
    this.port = port
    this.gpuCapable = gpuCapable
    this.detach = detach
    this.network = network
    this.envVariables = envVariables
    this.dnsName = dnsName
  }

  public run() {
    this.dockerProc = new Subprocess({
      path: process.env.DOCKER_BINARY_PATH || '/usr/bin/docker',
      args: this.createRunArgs(),
    })

    return this.dockerProc.start()
  }

  public getExitCode() {
    return this.dockerProc.exitCode()
  }

  public getStdErr() {
    return this.dockerProc.getStdErr()
  }

  private createRunArgs() {
    let args = ['run']
    this.gpuCapable && args.push('--runtime=nvidia')
    if (this.port) {
      args.push(`--expose=${this.port}`)
      args = args.concat([`-e`, `PORT=${this.port}`])
    }

    if (this.dnsName) {
      args.push(`--name=${this.dnsName}`)
    }

    if (this.network) {
      args.push(`--network=${this.network}`)
    }

    if (this.envVariables) {
      this.envVariables.forEach(envVar => {
        args = args.concat(['-e', envVar])
      })
    }

    if (this.detach) {
      args.push('-d')
    }

    if (process.env.NODE_ENV === 'development') {
      const hostPort = HostPortProvider.get()
      args = args.concat(['-p', `${hostPort}:3000`])
      Logger.info(`FunctionWatcher will listen on ${hostPort}`)
    }

    args.push(this.imageName)
    Logger.info(`Run args`, { args })
    return args
  }
}

export { DockerContainer }
