import { NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const prisma = {
    user: { findFirst: jest.fn() },
    userProfile: { findUnique: jest.fn(), update: jest.fn() },
  };
  const cloudinaryProvider = {
    destroy: jest.fn(),
    uploadBuffer: jest.fn(),
  };

  const service = new ProfileService(prisma as any, cloudinaryProvider as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the current profile on the happy path', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      role: { id: 'role-1', code: 'EMPLOYEE', name: 'Employee' },
      profile: { id: 'profile-1', fullName: 'User One' },
    });

    const result = await service.getMyProfile('user-1');

    expect(result.data?.email).toBe('user@example.com');
    expect(result.data?.profile?.fullName).toBe('User One');
  });

  it('throws when the user profile is missing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getMyProfile('missing')).rejects.toThrow(NotFoundException);
  });

  it('updates profile data and avatar on the happy path', async () => {
    prisma.userProfile.findUnique.mockResolvedValue({
      userId: 'user-1',
      avatarPublicId: 'old-public-id',
    });
    cloudinaryProvider.uploadBuffer.mockResolvedValue({
      secure_url: 'https://cdn.example/avatar.webp',
      public_id: 'new-public-id',
    });
    prisma.userProfile.update.mockResolvedValue({
      userId: 'user-1',
      fullName: 'Updated User',
    });

    const result = await service.updateMyProfile(
      'user-1',
      {
        fullName: 'Updated User',
        dateOfBirth: '2024-01-01',
      },
      {
        buffer: Buffer.from('avatar'),
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 512,
      } as Express.Multer.File,
    );

    expect(cloudinaryProvider.destroy).toHaveBeenCalledWith('old-public-id', 'image');
    expect(result.data?.fullName).toBe('Updated User');
  });
});
