import { SetMetadata } from '@nestjs/common';
import { AUTH_KEY, AuthCondition, AuthName, TAuthCondition, TAuthName } from '../constants/auth.constant';

export const Auth = (authNames: TAuthName[], condition: TAuthCondition = AuthCondition.And) => {
  return SetMetadata(AUTH_KEY, { authNames, condition });
};

export const IsPublic = () => Auth([AuthName.None]);
