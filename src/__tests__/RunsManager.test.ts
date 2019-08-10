import { RUNS_CLEANUP_INTERVAL } from '../limits/'

jest.mock('../resources/RunsManager/Run.ts', () => {
  return jest.fn().mockImplementation(() => {
    return {
      init: jest.fn(),
    }
  })
})

jest.useFakeTimers()
const RunsManager = require('../resources/RunsManager').RunsManager

test('Cleanup interval works', () => {
  const spy = jest.spyOn(RunsManager, 'cleanup')
  expect(spy).not.toBeCalled()
  jest.advanceTimersByTime(RUNS_CLEANUP_INTERVAL)
  expect(spy).toBeCalledTimes(1)
})
