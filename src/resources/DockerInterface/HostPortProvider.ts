const INITIAL_PORT = 8888
const TOTAL_PORTS = 200

const shuffleArray = (array: any[]) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
}

export class HostPortProvider {
  static ports: number[] = Array.from(Array(TOTAL_PORTS), (_, i: number) => i + INITIAL_PORT)

  private static shuffle() {
    shuffleArray(this.ports)
  }

  public static get() {
    HostPortProvider.shuffle()
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
