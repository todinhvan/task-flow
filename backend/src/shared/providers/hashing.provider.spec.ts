jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import { compare, hash } from 'bcrypt';
import envConfig from '@/config';
import { HashingProvider } from './hashing.provider';

describe('HashingProvider', () => {
  const provider = new HashingProvider();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hashes values on the happy path', async () => {
    (hash as jest.Mock).mockResolvedValue('hashed-value');

    const result = await provider.hash('secret');

    expect(hash).toHaveBeenCalledWith('secret', envConfig.SaltRounds);
    expect(result).toBe('hashed-value');
  });

  it('compares hashed values on the happy path', async () => {
    (compare as jest.Mock).mockResolvedValue(true);

    const result = await provider.compare('secret', 'hashed-value');

    expect(compare).toHaveBeenCalledWith('secret', 'hashed-value');
    expect(result).toBe(true);
  });
});
