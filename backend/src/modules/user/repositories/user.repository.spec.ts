import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const repository = new UserRepository(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries active users by email on the happy path', async () => {
    await repository.findActiveByEmail('user@example.com');

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: 'user@example.com',
          deletedAt: null,
        }),
      }),
    );
  });

  it('queries filtered user lists with search and role filters', async () => {
    await repository.findMany({
      search: 'john',
      roleCode: 'EMPLOYEE',
      status: 'ACTIVE',
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          status: 'ACTIVE',
        }),
      }),
    );
  });
});
