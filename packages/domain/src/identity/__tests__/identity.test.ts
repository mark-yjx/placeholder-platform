import test from 'node:test';
import assert from 'node:assert/strict';

import { Email, PasswordHash, Role, User } from '../index';

test('Email.create accepts valid email and normalizes', () => {
  const email = Email.create('  Student@Example.com ');
  assert.equal(email.toString(), 'student@example.com');
});

test('Email.create rejects invalid format', () => {
  assert.throws(() => Email.create('invalid-email'), /Invalid email format/);
});

test('User enforces role assignment constraints', () => {
  const user = new User(
    'user-1',
    Email.create('user@example.com'),
    PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz1234567890'),
    [Role.STUDENT]
  );

  user.assignRole(Role.ADMIN);
  assert.deepEqual([...user.roles].sort(), [Role.ADMIN, Role.STUDENT].sort());
  assert.throws(() => user.assignRole(Role.ADMIN), /Role already assigned/);
});
