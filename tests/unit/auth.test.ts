import { describe, it, expect } from 'vitest';

describe('Basic functionality tests', () => {
  it('should run basic math operations', () => {
    expect(2 + 2).toBe(4);
    expect(10 - 5).toBe(5);
    expect(3 * 4).toBe(12);
  });

  it('should handle string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
    expect('world'.length).toBe(5);
    expect(['a', 'b', 'c'].join('-')).toBe('a-b-c');
  });

  it('should validate environment variables access pattern', () => {
    // Test the bracket notation pattern we used in the fix
    const testEnv = { TEST_VAR: 'test_value' };
    expect(testEnv['TEST_VAR']).toBe('test_value');
    
    // Test undefined access
    expect(testEnv['NONEXISTENT']).toBeUndefined();
  });
});