import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getToken, setToken, clearToken, getUser, setUser } from '@/lib/auth';

describe('Auth Helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should store and retrieve the token', () => {
      const testToken = 'test-jwt-token';
      setToken(testToken);
      expect(getToken()).toBe(testToken);
    });

    it('should return null if no token is set', () => {
      expect(getToken()).toBeNull();
    });

    it('should clear the token and user data', () => {
      setToken('some-token');
      setUser({ name: 'Test' });
      clearToken();
      expect(getToken()).toBeNull();
      expect(getUser()).toBeNull();
    });
  });

  describe('User Persistence', () => {
    it('should store and retrieve the user object', () => {
      const testUser = { id: 1, full_name: 'David Lameck', email: 'david@test.zm' };
      setUser(testUser);
      expect(getUser()).toEqual(testUser);
    });

    it('should return null for malformed user data', () => {
      localStorage.setItem('user', 'invalid-json');
      expect(getUser()).toBeNull();
    });
  });
});
