const INITIAL_PORT = 8888
const TOTAL_PORTS = 5

export class HostPortProvider {
  static ports: number[] = Array.from(Array(TOTAL_PORTS), (_, i: number) => i + INITIAL_PORT)

  public static get() {
    return HostPortProvider.ports.pop()
  }

  public static add(port: number) {
    return HostPortProvider.ports.push(port)
  }
}

export interface HostPortProviderInterface {
  get: () => number | undefined
  add: (port: number) => number
}
