/**
 * Platform administration — accounts and institutions.
 *
 * This is the only place in the system that creates a privileged account, so
 * two rules hold throughout:
 *
 *   • The backend never chooses a password. Issuers are invited by email and
 *     set their own, so no working credential is ever returned in an API
 *     response, written to a log, or relayed by hand.
 *   • `app_metadata.role` is written with the service key and never from
 *     `user_metadata`, which the user can edit themselves via
 *     `auth.updateUser()`. Writing a role anywhere the user can reach would let
 *     a holder promote themselves to admin.
 *
 * `profiles` remains the authority on role and status regardless — see
 * middleware/auth.js — because an `app_metadata` change only reaches a JWT on
 * its next refresh, and a deactivation has to take effect sooner than that.
 */
import { adminClient, unwrap } from '../config/supabase.js';
import { env } from '../config/env.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { invalidateProfileCache } from '../middleware/auth.js';

/** Turns "Royal University of Phnom Penh" into "royal-university-of-phnom-penh". */
export function slugify(name) {
  return (
    name
      .normalize('NFKD')
      // Strip combining marks so "Institut Supérieur" and "Institut Superieur"
      // produce the same slug rather than one containing a stray character.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  );
}

/**
 * @param {object} [deps]
 * @param {import('@supabase/supabase-js').SupabaseClient} [deps.db]
 * @param {object} [deps.auth] supabase `auth.admin` surface
 * @param {(userId: string) => void} [deps.onProfileChanged]
 */
export function createAdminService({
  db = adminClient,
  auth = adminClient.auth.admin,
  onProfileChanged = invalidateProfileCache,
} = {}) {
  async function recordAudit({ action, actor, targetLabel, metadata = {} }) {
    try {
      unwrap(
        await db.from('audit_events').insert({
          actor_id: actor?.id ?? null,
          actor_email: actor?.email ?? null,
          actor_name: actor?.fullName ?? null,
          action,
          target_label: targetLabel,
          organization_id: actor?.organizationId ?? null,
          metadata,
        }),
        `insert audit_events (${action})`
      );
    } catch (err) {
      // Never roll back an account change because its audit row failed; log
      // loudly instead so the gap is visible.
      logger.error('audit insert failed — action still happened', {
        err,
        action,
        targetLabel,
      });
    }
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  /**
   * Invites an issuer or admin (FR-AUTH-01).
   *
   * Supabase emails a one-time link; the invitee sets their own password on
   * arrival. Nothing here knows or returns a credential.
   */
  async function inviteUser({ email, fullName, role, organizationId }, actor) {
    const existing = unwrap(
      await db
        .from('profiles')
        .select('id, status')
        .eq('email', email)
        .maybeSingle(),
      'check existing profile'
    );
    if (existing) {
      // 409 rather than a silent re-invite: re-sending an invite to a live
      // account would issue a link that can reset a working password.
      throw conflict('An account with that email already exists.');
    }

    if (organizationId) {
      const org = unwrap(
        await db
          .from('organizations')
          .select('id, name, status')
          .eq('id', organizationId)
          .maybeSingle(),
        'load organization for invite'
      );
      if (!org) throw notFound('That institution does not exist.');
      if (org.status !== 'active') {
        throw badRequest('That institution is suspended.');
      }
    }

    const { data, error } = await auth.inviteUserByEmail(email, {
      // Where the invitee lands after clicking the link. The page reads the
      // session Supabase puts in the URL and asks them to choose a password.
      redirectTo: `${env.publicAppUrl}/auth/set-password`,
      data: { full_name: fullName },
    });
    if (error) {
      logger.error('invite failed', { err: error, email });
      throw badRequest(
        `Could not send the invitation: ${error.message ?? 'unknown error'}`
      );
    }

    const userId = data.user.id;

    // Role goes in app_metadata, which only the service key can write. Done as
    // a second call because inviteUserByEmail's `data` maps to user_metadata.
    const promoted = await auth.updateUserById(userId, {
      app_metadata: { role },
    });
    if (promoted.error) {
      logger.error('could not set app_metadata.role on invited user', {
        err: promoted.error,
        userId,
      });
    }

    // Upsert, not insert: a database trigger may already have created a bare
    // profile row for the new auth user.
    const profile = unwrap(
      await db
        .from('profiles')
        .upsert(
          {
            id: userId,
            email,
            full_name: fullName,
            role,
            organization_id: organizationId,
            status: 'active',
            profile_is_public: true,
          },
          { onConflict: 'id' }
        )
        .select()
        .single(),
      'upsert invited profile'
    );

    await recordAudit({
      action: 'issuer.invited',
      actor,
      targetLabel: `${fullName} <${email}>`,
      metadata: { user_id: userId, role, organization_id: organizationId },
    });

    return profile;
  }

  async function listUsers({
    role,
    status,
    organizationId,
    search,
    limit,
    offset,
  }) {
    let query = db
      .from('profiles')
      .select('*, organizations ( id, name )')
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (status) query = query.eq('status', status);
    if (organizationId) query = query.eq('organization_id', organizationId);
    if (search) {
      const safe = search.replace(/[,()]/g, ' ');
      query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }

    const rows = unwrap(await query, 'select profiles') ?? [];
    return {
      total: rows.length,
      users: rows.slice(offset, offset + limit).map((row) => ({
        ...row,
        organization_name: row.organizations?.name ?? null,
      })),
    };
  }

  /**
   * Deactivates or reactivates an account (FR-AUTH-04).
   *
   * Deactivation is a `profiles.status` change, not a deletion: `certificates.
   * issuer_id` references the row, and the audit trail must survive the person
   * leaving. requireAuth rejects a non-active profile on the next request.
   */
  async function setUserStatus(userId, status, actor) {
    if (userId === actor.id) {
      // Without this an admin can lock themselves out, and if they are the only
      // admin nobody can undo it.
      throw badRequest('You cannot change your own account status.');
    }

    const user = unwrap(
      await db
        .from('profiles')
        .select('id, email, full_name, role, status')
        .eq('id', userId)
        .maybeSingle(),
      'load profile for status change'
    );
    if (!user) throw notFound('User not found.');
    if (user.status === status) {
      throw conflict(`That account is already ${status}.`);
    }

    const updated = unwrap(
      await db
        .from('profiles')
        .update({ status })
        .eq('id', userId)
        .select()
        .single(),
      'update profile status'
    );

    /**
     * Drop the cached profile so the change takes effect on the very next
     * request rather than up to 60s later.
     *
     * This is the whole enforcement mechanism, and it is sufficient: requireAuth
     * re-reads `profiles.status` on every request and rejects anything that is
     * not 'active'. Revoking the Supabase session as well would be redundant —
     * and supabase-js only exposes `auth.admin.signOut(jwt)`, which needs the
     * user's own token, something the server does not hold. An unexpired access
     * token therefore still exists, but it can no longer buy anything.
     */
    onProfileChanged(userId);

    await recordAudit({
      action: status === 'deactivated' ? 'issuer.removed' : 'issuer.invited',
      actor,
      targetLabel: `${user.full_name ?? user.email} <${user.email}>`,
      metadata: { user_id: userId, status, previous_status: user.status },
    });

    return updated;
  }

  // ── Organizations ─────────────────────────────────────────────────────────

  async function createOrganization(input, actor) {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) {
      throw badRequest('Could not derive a slug from that name.');
    }

    const clash = unwrap(
      await db
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .maybeSingle(),
      'check organization slug'
    );
    if (clash) {
      throw conflict(`An institution with the slug "${slug}" already exists.`);
    }

    const org = unwrap(
      await db
        .from('organizations')
        .insert({
          name: input.name,
          slug,
          type: input.type,
          website: input.website ?? null,
          accredited: input.accredited,
          status: 'active',
        })
        .select()
        .single(),
      'insert organization'
    );

    await recordAudit({
      action: 'org.created',
      actor,
      targetLabel: org.name,
      metadata: { organization_id: org.id, slug: org.slug },
    });

    return org;
  }

  async function listOrganizations({ status, limit, offset }) {
    let query = db
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const rows = unwrap(await query, 'select organizations') ?? [];
    return {
      total: rows.length,
      organizations: rows.slice(offset, offset + limit),
    };
  }

  /**
   * Suspends or reactivates an institution.
   *
   * Suspension does not touch its issuers' accounts or its certificates:
   * already-issued credentials must stay verifiable regardless of the
   * institution's standing today. It blocks new invites (see inviteUser).
   */
  async function setOrganizationStatus(orgId, status, actor) {
    const org = unwrap(
      await db
        .from('organizations')
        .select('id, name, status')
        .eq('id', orgId)
        .maybeSingle(),
      'load organization for status change'
    );
    if (!org) throw notFound('Institution not found.');
    if (org.status === status) {
      throw conflict(`That institution is already ${status}.`);
    }

    const updated = unwrap(
      await db
        .from('organizations')
        .update({ status })
        .eq('id', orgId)
        .select()
        .single(),
      'update organization status'
    );

    await recordAudit({
      action: status === 'suspended' ? 'org.suspended' : 'org.reactivated',
      actor,
      targetLabel: org.name,
      metadata: { organization_id: orgId, status },
    });

    return updated;
  }

  return {
    inviteUser,
    listUsers,
    setUserStatus,
    createOrganization,
    listOrganizations,
    setOrganizationStatus,
  };
}

export const adminService = createAdminService();
