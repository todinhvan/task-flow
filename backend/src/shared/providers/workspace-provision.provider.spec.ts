import { TaskStatus } from '@/generated/prisma/enums';
import { WorkspaceProvisionProvider } from './workspace-provision.provider';

describe('WorkspaceProvisionProvider', () => {
  const prisma = {
    userProfile: { upsert: jest.fn() },
    boardList: { upsert: jest.fn(), findFirst: jest.fn() },
  };
  const provider = new WorkspaceProvisionProvider(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provisions user profile and default board lists on the happy path', async () => {
    prisma.userProfile.upsert.mockResolvedValue(undefined);
    prisma.boardList.upsert.mockResolvedValue(undefined);

    await provider.provisionForUser({
      userId: 'user-1',
      fullName: 'User One',
      jobTitle: 'Engineer',
    });

    expect(prisma.userProfile.upsert).toHaveBeenCalled();
    expect(prisma.boardList.upsert).toHaveBeenCalledTimes(4);
  });

  it('maps board slugs to task statuses', () => {
    expect(provider.getStatusForListSlug('in-progress')).toBe(TaskStatus.IN_PROGRESS);
    expect(provider.getStatusForListSlug('done')).toBe(TaskStatus.DONE);
    expect(provider.getStatusForListSlug('unknown')).toBe(TaskStatus.TODO);
  });
});
