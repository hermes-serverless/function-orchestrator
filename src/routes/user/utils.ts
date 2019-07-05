import { pick } from 'ramda'
import { InvalidRequestArguments } from './../../datasources/Errors'

export const pickKeys = (possibleKeys: string[], obj: object) => {
  return pick(possibleKeys, obj)
}

export const checkifBodyIsValid = (requiredKeys: string[], body: any) => {
  requiredKeys.forEach(el => {
    if (body[el] == null) throw new InvalidRequestArguments(`Missing ${el} field on request`)
  })
}
