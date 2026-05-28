import { ApiProperty } from '@nestjs/swagger';

export class SessionUserPermission {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  module: string;

  @ApiProperty()
  method: string;

  @ApiProperty()
  path: string;
}

export class SessionUserProfile {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ required: false })
  avatarUrl?: string | null;

  @ApiProperty({ required: false })
  jobTitle?: string | null;
}

export class SessionUserRole {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ type: [SessionUserPermission] })
  permissions: SessionUserPermission[];
}

export class SessionUser {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: SessionUserRole })
  role: SessionUserRole;

  @ApiProperty({ type: SessionUserProfile })
  profile: SessionUserProfile;
}

export class AuthResponse {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ type: SessionUser })
  user: SessionUser;
}
