import R from 'ramda'
import { RUNS_CLEANUP_INTERVAL } from '../../limits/'
import { User } from './../../typings.d'
import { Logger } from './../../utils/Logger'
import { Run, RunToCreate } from './Run'

const addName = (msg: string) => {
  return `[RunsManager] ${msg}`
}

export class RunsManager {
  public static runs: Run[] = []

  public static createRun = async (runToCreate: RunToCreate, token: string) => {
    const run = new Run()
    await run.init(runToCreate, token)
    RunsManager.runs.push(run)
    return run
  }

  public static getRun = async (user: User, runID: string, token: string) => {
    let run = R.find(el => el.runID === runID, RunsManager.runs)

    if (run == null) {
      Logger.info(addName(`Run id ${runID} not found. Try to get from db`))
      run = new Run()
      await run.init({ user, id: runID }, token)
      Logger.info(addName(`Run id ${runID} got from db`))
      RunsManager.runs.push(run)
    } else Logger.info(addName(`Got run ${runID} from array`))
    return run
  }

  public static cleanup() {
    RunsManager.runs = RunsManager.runs.filter(run => run.allFinished)
    Logger.info(`[RunsManager] Cleanup runsLen: ${RunsManager.runs.length}`)
  }

  public static cleanupTimer = setInterval(() => RunsManager.cleanup(), RUNS_CLEANUP_INTERVAL)
}
