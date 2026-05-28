import { emptyStringToNull, emptyStringToUndefined, shouldValidateDefined } from './transform.util';

describe('transform.util', () => {
  it('converts empty strings to null', () => {
    expect(emptyStringToNull('')).toBeNull();
    expect(emptyStringToNull('value')).toBe('value');
  });

  it('converts empty strings to undefined', () => {
    expect(emptyStringToUndefined('')).toBeUndefined();
    expect(emptyStringToUndefined('value')).toBe('value');
  });

  it('validates only defined and non-null values', () => {
    expect(shouldValidateDefined({}, 'value')).toBe(true);
    expect(shouldValidateDefined({}, undefined)).toBe(false);
    expect(shouldValidateDefined({}, null)).toBe(false);
  });
});
