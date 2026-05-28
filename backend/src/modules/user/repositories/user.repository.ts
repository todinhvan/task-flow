import { PrismaProvider } from '@/shared/providers/prisma.provider';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaProvider) {}

  findActiveByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include: {
        role: {
          include: {
            permissions: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
        profile: true,
      },
    });
  }

  findActiveById(id: string) {
    return this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        role: {
          include: {
            permissions: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
        profile: true,
      },
    });
  }

  findMany({
    search,
    roleCode,
    status,
  }: {
    search?: string;
    roleCode?: string;
    status?: string;
  }) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(roleCode ? { role: { code: roleCode as any } } : {}),
        ...(status ? { status: status as any } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { profile: { fullName: { contains: search, mode: 'insensitive' } } },
                { profile: { jobTitle: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        role: {
          include: {
            permissions: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
        profile: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
