export const AUTH_KEY = 'AUTH_KEY';

export const AuthName = {
  Bearer: 'Bearer',
  ApiKey: 'ApiKey',
  None: 'None',
} as const;

export type TAuthName = (typeof AuthName)[keyof typeof AuthName];

export const AuthCondition = {
  And: 'And',
  Or: 'Or',
} as const;

export type TAuthCondition = (typeof AuthCondition)[keyof typeof AuthCondition];
