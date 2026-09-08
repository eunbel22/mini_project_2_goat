import { describe, it, expect } from 'vitest';
import { validateCustomerInfoInput, isValidEmail, MAX_GUESTS } from '../src/utils/customerInfo';

describe('validateCustomerInfoInput', () => {
  const base = { name: '홍길동', email: 'test@example.com', purpose: '상담', guests: [] as { name: string; email: string }[] };

  it('accepts a fully filled valid input', () => {
    expect(validateCustomerInfoInput(base)).toBeNull();
  });

  it('rejects missing name', () => {
    expect(validateCustomerInfoInput({ ...base, name: '' })).toBe('이름을 입력하세요');
  });

  it('rejects missing email', () => {
    expect(validateCustomerInfoInput({ ...base, email: '' })).toBe('이메일을 입력하세요');
  });

  it('rejects malformed email', () => {
    expect(validateCustomerInfoInput({ ...base, email: 'not-an-email' })).toBe('이메일 형식이 올바르지 않습니다');
  });

  it('rejects missing purpose', () => {
    expect(validateCustomerInfoInput({ ...base, purpose: '' })).toBe('상담 목적/과제를 입력하세요');
  });

  it('rejects more than MAX_GUESTS guests', () => {
    const guests = Array.from({ length: MAX_GUESTS + 1 }, (_, i) => ({ name: `G${i}`, email: `g${i}@example.com` }));
    expect(validateCustomerInfoInput({ ...base, guests })).toBe(`게스트는 최대 ${MAX_GUESTS}명까지 추가할 수 있습니다`);
  });

  it('accepts exactly MAX_GUESTS guests with valid emails', () => {
    const guests = Array.from({ length: MAX_GUESTS }, (_, i) => ({ name: `G${i}`, email: `g${i}@example.com` }));
    expect(validateCustomerInfoInput({ ...base, guests })).toBeNull();
  });

  it('rejects a guest with a malformed email', () => {
    const guests = [{ name: 'Guest', email: 'bad-email' }];
    expect(validateCustomerInfoInput({ ...base, guests })).toBe('게스트 이메일 형식이 올바르지 않습니다');
  });

  it('rejects a guest with an empty name', () => {
    const guests = [{ name: '', email: 'guest@example.com' }];
    expect(validateCustomerInfoInput({ ...base, guests })).toBe('게스트 이름을 입력하세요');
  });
});

describe('isValidEmail', () => {
  it('accepts standard email formats', () => {
    expect(isValidEmail('a@b.com')).toBe(true);
  });

  it('rejects strings without @', () => {
    expect(isValidEmail('abc.com')).toBe(false);
  });

  it('rejects strings without a domain suffix', () => {
    expect(isValidEmail('a@b')).toBe(false);
  });
});
