import { generateRequestId } from './string.util';

describe('generateRequestId', () => {
  it('returns a bare uuid on the happy path', () => {
    expect(generateRequestId()).toBe('test-uuid');
  });

  it('prefixes the request id when a prefix is provided', () => {
    expect(generateRequestId('req')).toBe('req-test-uuid');
  });
});
