import { User } from '../../typings'

export const mockAuthDatasource = () => {
  jest.doMock('../../datasources/AuthDatasource.ts', () => {
    return {
      AuthDatasource: {
        getMe: jest.fn(),
      },
    }
  })

  const mockAuthorizationGetMe = (user: User) => {
    const AuthDatasource = require('../../datasources/AuthDatasource').AuthDatasource as Record<string, jest.Mock>
    AuthDatasource.getMe.mockResolvedValue(user)
  }

  const unmockAuthDatasource = () => {
    jest.unmock('../../datasources/AuthDatasource.ts')
  }

  return { mockAuthorizationGetMe, unmockAuthDatasource }
}
