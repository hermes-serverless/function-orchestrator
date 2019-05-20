import { Stream, Readable } from 'stream'

export class Simpletream extends Stream.Readable {
  constructor(options?: any) {
    super(options)
  }

  _read() {
    this.push(null)
  }
}
