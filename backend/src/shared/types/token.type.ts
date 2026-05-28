export type AccessTokenPayloadType = {
  userId: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  iat: number;
  exp: number;
};

export type RefreshTokenPayloadType = {
  userId: string;
  iat: number;
  exp: number;
};
