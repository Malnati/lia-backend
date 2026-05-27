import { AccessProfilesController } from '../src/admin/access-profiles.controller';
import { UsersController } from '../src/admin/users.controller';

describe('admin CRUD API contract from REQ.md', () => {
  it('exposes users CRUD controller methods', () => {
    const methods = Object.getOwnPropertyNames(UsersController.prototype);
    expect(methods).toContain('findAll');
    expect(methods).toContain('create');
    expect(methods).toContain('update');
  });

  it('exposes access profile CRUD controller methods', () => {
    const methods = Object.getOwnPropertyNames(AccessProfilesController.prototype);
    expect(methods).toContain('findAll');
    expect(methods).toContain('create');
    expect(methods).toContain('update');
  });
});
