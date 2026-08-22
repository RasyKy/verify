/**
 * adminService — account and institution management.
 *
 * The invariants that matter here are about privilege: an invite must never
 * return a working credential, a role must only ever be written to
 * `app_metadata`, and an admin must not be able to lock themselves out.
 */
import { createAdminService, slugify } from '../src/services/adminService.js';
import { createFakeDb } from './helpers/fakeSupabase.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = 'u-admin';

const admin = {
  id: ADMIN_ID,
  email: 'admin@example.com',
  role: 'admin',
  organizationId: null,
};

/** Records what the Supabase auth admin API was asked to do. */
function createFakeAuth({ inviteError = null } = {}) {
  const calls = { invite: [], update: [] };
  return {
    calls,

    async inviteUserByEmail(email, options) {
      calls.invite.push({ email, options });
      if (inviteError) return { data: null, error: inviteError };
      return { data: { user: { id: 'new-user-id', email } }, error: null };
    },

    async updateUserById(id, attrs) {
      calls.update.push({ id, attrs });
      return { data: { user: { id } }, error: null };
    },
  };
}

function seedOrg(overrides = {}) {
  return {
    organizations: [
      {
        id: ORG,
        name: 'Royal University of Phnom Penh',
        slug: 'rupp',
        status: 'active',
        ...overrides,
      },
    ],
    profiles: [],
  };
}

describe('inviteUser', () => {
  it('invites by email and never returns a password', async () => {
    const db = createFakeDb(seedOrg());
    const auth = createFakeAuth();
    const service = createAdminService({ db, auth, onProfileChanged() {} });

    const profile = await service.inviteUser(
      {
        email: 'new.issuer@rupp.edu.kh',
        fullName: 'Sok Dara',
        role: 'issuer',
        organizationId: ORG,
      },
      admin
    );

    expect(auth.calls.invite).toHaveLength(1);
    expect(auth.calls.invite[0].email).toBe('new.issuer@rupp.edu.kh');
    // No credential may appear anywhere in the response.
    expect(JSON.stringify(profile)).not.toMatch(/password/i);
    expect(profile.role).toBe('issuer');
    expect(profile.organization_id).toBe(ORG);
    expect(profile.status).toBe('active');
  });

  it('writes the role to app_metadata, never user_metadata', async () => {
    const db = createFakeDb(seedOrg());
    const auth = createFakeAuth();
    const service = createAdminService({ db, auth, onProfileChanged() {} });

    await service.inviteUser(
      {
        email: 'new.issuer@rupp.edu.kh',
        fullName: 'Sok Dara',
        role: 'issuer',
        organizationId: ORG,
      },
      admin
    );

    // user_metadata is writable by the user via auth.updateUser(); a role there
    // would let a holder promote themselves.
    expect(auth.calls.invite[0].options.data).toEqual({
      full_name: 'Sok Dara',
    });
    expect(auth.calls.invite[0].options.data).not.toHaveProperty('role');
    expect(auth.calls.update[0].attrs).toEqual({
      app_metadata: { role: 'issuer' },
    });
  });

  it('points the invite link at the set-password page', async () => {
    const db = createFakeDb(seedOrg());
    const auth = createFakeAuth();
    const service = createAdminService({ db, auth, onProfileChanged() {} });

    await service.inviteUser(
      {
        email: 'a@b.com',
        fullName: 'A B',
        role: 'issuer',
        organizationId: ORG,
      },
      admin
    );

    expect(auth.calls.invite[0].options.redirectTo).toMatch(
      /\/auth\/set-password$/
    );
  });

  it('refuses to re-invite an existing account', async () => {
    const seed = seedOrg();
    seed.profiles = [
      { id: 'existing', email: 'taken@rupp.edu.kh', status: 'active' },
    ];
    const db = createFakeDb(seed);
    const auth = createFakeAuth();
    const service = createAdminService({ db, auth, onProfileChanged() {} });

    // A re-invite issues a link that can reset a working password.
    await expect(
      service.inviteUser(
        {
          email: 'taken@rupp.edu.kh',
          fullName: 'Someone',
          role: 'issuer',
          organizationId: ORG,
        },
        admin
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(auth.calls.invite).toHaveLength(0);
  });

  it('refuses an unknown institution', async () => {
    const db = createFakeDb({ organizations: [], profiles: [] });
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    await expect(
      service.inviteUser(
        {
          email: 'a@b.com',
          fullName: 'A B',
          role: 'issuer',
          organizationId: ORG,
        },
        admin
      )
    ).rejects.toMatchObject({ status: 404 });
  });

  it('refuses a suspended institution', async () => {
    const db = createFakeDb(seedOrg({ status: 'suspended' }));
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    await expect(
      service.inviteUser(
        {
          email: 'a@b.com',
          fullName: 'A B',
          role: 'issuer',
          organizationId: ORG,
        },
        admin
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  it('records who invited whom', async () => {
    const db = createFakeDb(seedOrg());
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    await service.inviteUser(
      {
        email: 'a@b.com',
        fullName: 'A B',
        role: 'issuer',
        organizationId: ORG,
      },
      admin
    );

    expect(db._store.audit_events[0]).toMatchObject({
      action: 'issuer.invited',
      actor_email: 'admin@example.com',
    });
  });
});

describe('setUserStatus', () => {
  function seedUser(status = 'active') {
    return {
      profiles: [
        {
          id: 'u-issuer',
          email: 'issuer@rupp.edu.kh',
          full_name: 'Sok Dara',
          role: 'issuer',
          status,
        },
      ],
    };
  }

  it('deactivates and drops the cached profile immediately', async () => {
    const db = createFakeDb(seedUser());
    const invalidated = [];
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged: (id) => invalidated.push(id),
    });

    await service.setUserStatus('u-issuer', 'deactivated', admin);

    expect(db._store.profiles[0].status).toBe('deactivated');
    // Without this the 60s profile cache keeps the account working.
    expect(invalidated).toEqual(['u-issuer']);
    expect(db._store.audit_events[0].action).toBe('issuer.removed');
  });

  it('refuses to change your own status', async () => {
    const db = createFakeDb({
      profiles: [
        { id: ADMIN_ID, email: 'admin@example.com', status: 'active' },
      ],
    });
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    // The only admin deactivating themselves is unrecoverable.
    await expect(
      service.setUserStatus(ADMIN_ID, 'deactivated', admin)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a no-op change', async () => {
    const db = createFakeDb(seedUser('deactivated'));
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    await expect(
      service.setUserStatus('u-issuer', 'deactivated', admin)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('404s an unknown user', async () => {
    const db = createFakeDb({ profiles: [] });
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    await expect(
      service.setUserStatus('nobody', 'deactivated', admin)
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('organizations', () => {
  it('derives a slug from the name', async () => {
    const db = createFakeDb({ organizations: [] });
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    const org = await service.createOrganization(
      {
        name: 'Royal University of Phnom Penh',
        type: 'university',
        accredited: true,
      },
      admin
    );

    expect(org.slug).toBe('royal-university-of-phnom-penh');
    expect(org.status).toBe('active');
    expect(db._store.audit_events[0].action).toBe('org.created');
  });

  it('refuses a duplicate slug', async () => {
    const db = createFakeDb(seedOrg());
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    await expect(
      service.createOrganization(
        { name: 'RUPP', slug: 'rupp', type: 'university', accredited: false },
        admin
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('suspends and reactivates with the matching audit action', async () => {
    const db = createFakeDb(seedOrg());
    const service = createAdminService({
      db,
      auth: createFakeAuth(),
      onProfileChanged() {},
    });

    await service.setOrganizationStatus(ORG, 'suspended', admin);
    expect(db._store.organizations[0].status).toBe('suspended');
    expect(db._store.audit_events[0].action).toBe('org.suspended');

    await service.setOrganizationStatus(ORG, 'active', admin);
    expect(db._store.audit_events[1].action).toBe('org.reactivated');
  });
});

describe('slugify', () => {
  it('strips diacritics so accented names produce a usable slug', () => {
    expect(slugify('Institut Supérieur')).toBe('institut-superieur');
  });

  it('collapses punctuation and trims stray hyphens', () => {
    expect(slugify('  ISTAD — Advanced Development!  ')).toBe(
      'istad-advanced-development'
    );
  });
});
