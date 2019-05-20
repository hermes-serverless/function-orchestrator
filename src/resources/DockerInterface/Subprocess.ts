import { Logger } from '../../utils/Logger'
import { spawn, ChildProcess } from 'child_process'
import { Readable } from 'stream'

class SubprocessReturnCodeError extends Error {
  constructor(
    path: string,
    args: string[],
    returnCode: number,
    stdout: string,
    stderr: string,
    message?: string
  ) {
    let msg =
      `Subprocess ${path} returned ${returnCode}.\nThe args were ${args}.\nThe stdout: ${stdout}. The stderr: ${stderr}` +
      (message ? message : '')
    super(msg)
  }
}

class Subprocess {
  path: string
  args: string[]
  process: ChildProcess
  stderrOutput: string
  resolveReturnCode: any
  returnCode: Promise<number>
  inputStream?: Readable
  stdoutOutput: string

  constructor({ path, args, inputStream }: any) {
    this.path = path
    this.args = args
    this.stderrOutput = ''
    if (inputStream) this.inputStream = inputStream
    this.returnCode = new Promise(resolve => {
      this.resolveReturnCode = resolve
    })
  }

  public start() {
    Logger.info('spawn process', { path: this.path, args: this.args })
    this.process = spawn(this.path, this.args)

    this.process.on('close', (ret: number) => {
      this.resolveReturnCode(ret)
      if (ret != 0)
        throw new SubprocessReturnCodeError(
          this.path,
          this.args,
          ret,
          this.stdoutOutput,
          this.stderrOutput
        )
    })

    this.process.on('error', (err: any) => console.log('Error catch', err))
    this.process.stderr.on('data', (data: any) => (this.stderrOutput += data))
    this.process.stdout.on('data', (data: any) => (this.stdoutOutput += data))

    if (this.inputStream) {
      this.inputStream.pipe(this.process.stdin).on('error', (e: any) => {
        console.log('PIPE ERROR CAPTURED', e)
      })
    }

    return this.resolveReturnCode
  }

  public async getStdErr() {
    await this.returnCode
    return this.stderrOutput
  }

  public exitCode() {
    return this.returnCode
  }

  public kill() {}
}

export { Subprocess }
