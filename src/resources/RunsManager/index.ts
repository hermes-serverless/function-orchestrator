import R from 'ramda'
import { User } from './../../typings.d'
import { Logger } from './../../utils/Logger'
import { Run, RunToCreate } from './Run'

const HOUR = 3600 * 1000
const CLEANUP_INTERVAL = 30 * 1000

export class RunsManager {
  public static runs: Run[] = []

  public static createRun = (runToCreate: RunToCreate, token: string) => {
    const run = new Run(runToCreate, token)
    return run
  }

  public static getRun = async (user: User, runID: string, token: string) => {
    let run = R.find(el => el.id === runID, RunsManager.runs)
    if (run == null) {
      run = new Run({ user, id: runID }, token)
      await run.isReady()
      RunsManager.runs.push(run)
    }
    return run
  }

  private static cleanup = () => {
    RunsManager.runs = RunsManager.runs.filter(run => run.allFinished())
    Logger.info(`[RunsManager] Cleanup runsLen: ${RunsManager.runs.length}`)
  }

  public static cleanupTimer = setTimeout(RunsManager.cleanup, CLEANUP_INTERVAL)
}
