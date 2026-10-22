import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Runs the real migration against an in-process Postgres and checks the
 * security model: RLS ownership, public projection, slug locking, events.
 */
const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

let db: PGlite;

async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

async function createProfile(user: string, slug: string) {
  const [row] = await as<{ id: string }>(
    user,
    `insert into public.profiles (user_id, slug, full_name, professional_title, website_url, website_is_public, status)
     values ($1, $2, 'Test Person', 'Designer', 'https://secret.example', false, 'published') returning id`,
    [user, slug],
  );
  await as(user, `select public.replace_profile_children($1, $2::jsonb, $3::jsonb)`, [
    row.id,
    JSON.stringify([
      { type: "email", value: `${slug}@public.test`, isPublic: true },
      { type: "phone", value: "+15550001111", isPublic: false },
    ]),
    JSON.stringify([
      { platform: "github", url: "https://github.com/public", isPublic: true },
      { platform: "x", url: "https://x.com/hidden", isPublic: false },
    ]),
  ]);
  return row.id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-stubs.sql"), "utf8"));
  const dir = join(__dirname, "../../supabase/migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.exec("insert into public.access_codes (code, max_uses) values ('SETUP-CODE', 2)");
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ($1, 'a@test', '{"access_code":"setup-code"}'), ($2, 'b@test', '{"access_code":"SETUP-CODE"}')`,
    [ALICE, BOB],
  );
  await createProfile(ALICE, "alice");
}, 60_000);

describe("test harness", () => {
  it("really switches database role and user identity", async () => {
    expect(await as(BOB, "select current_user::text as r, auth.uid()::text as u")).toEqual([{ r: "authenticated", u: BOB }]);
    expect(await as(null, "select current_user::text as r, auth.uid() as u")).toEqual([{ r: "anon", u: null }]);
  });
});

describe("public projection", () => {
  it("returns only public fields of a published profile", async () => {
    const [{ p }] = await as<{ p: Record<string, unknown> }>(null, "select public.get_public_profile('alice') as p");
    const json = JSON.stringify(p);
    expect(p.fullName).toBe("Test Person");
    expect(p.websiteUrl).toBeNull();
    expect(p.contacts).toEqual([{ type: "email", value: "alice@public.test", label: null }]);
    expect(p.socials).toEqual([{ platform: "github", url: "https://github.com/public" }]);
    expect(json).not.toContain("+15550001111");
    expect(json).not.toContain("x.com/hidden");
    expect(json).not.toContain("secret.example");
    expect(json).not.toContain(ALICE); // no user id
    // Only the year they joined, not the exact date.
    expect(p.joinedYear).toBe(new Date().getFullYear());
    expect(Object.keys(p)).not.toContain("createdAt");
  });

  it("is case-insensitive on slug and null for unknown slugs", async () => {
    const [{ p }] = await as<{ p: unknown }>(null, "select public.get_public_profile('  ALICE ') as p");
    expect(p).not.toBeNull();
    const [{ q }] = await as<{ q: unknown }>(null, "select public.get_public_profile('nobody') as q");
    expect(q).toBeNull();
  });

  it("hides unpublished profiles and shows them again on republish", async () => {
    await as(ALICE, "update public.profiles set status = 'unpublished' where user_id = $1", [ALICE]);
    const [{ p }] = await as<{ p: unknown }>(BOB, "select public.get_public_profile('alice') as p");
    expect(p).toBeNull();
    await as(ALICE, "update public.profiles set status = 'published' where user_id = $1", [ALICE]);
    const [{ q }] = await as<{ q: unknown }>(null, "select public.get_public_profile('alice') as q");
    expect(q).not.toBeNull();
  });
});

describe("row-level security", () => {
  it("anon cannot read base tables", async () => {
    await expect(as(null, "select * from public.profiles")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.contact_methods")).rejects.toThrow(/permission denied/);
  });

  it("other users cannot see private rows or the profile itself", async () => {
    expect(await as(BOB, "select * from public.profiles")).toHaveLength(0);
    expect(await as(BOB, "select * from public.contact_methods")).toHaveLength(0);
    expect(await as(BOB, "select * from public.social_links")).toHaveLength(0);
  });

  it("other users cannot modify or delete someone else's profile", async () => {
    const updated = await as(BOB, "update public.profiles set full_name = 'Hacked' where slug = 'alice' returning id");
    expect(updated).toHaveLength(0);
    const deleted = await as(BOB, "delete from public.profiles where slug = 'alice' returning id");
    expect(deleted).toHaveLength(0);
    const [{ full_name }] = await as<{ full_name: string }>(ALICE, "select full_name from public.profiles");
    expect(full_name).toBe("Test Person");
  });

  it("users cannot create a profile for someone else", async () => {
    await expect(
      as(BOB, "insert into public.profiles (user_id, slug, full_name) values ($1, 'fake-alice', 'X')", [ALICE]),
    ).rejects.toThrow(/row-level security/);
  });

  it("users cannot inject contact rows into another profile", async () => {
    const [{ id }] = await as<{ id: string }>(ALICE, "select id from public.profiles");
    await expect(
      as(BOB, "insert into public.contact_methods (profile_id, type, value, is_public) values ($1, 'email', 'evil@x.test', true)", [id]),
    ).rejects.toThrow(/row-level security/);
    await expect(as(BOB, "select public.replace_profile_children($1, '[]', '[]')", [id])).rejects.toThrow(/Profile not found/);
  });

  it("owners can read their own private fields", async () => {
    const rows = await as<{ value: string }>(ALICE, "select value from public.contact_methods order by sort_order");
    expect(rows.map((r) => r.value)).toEqual(["alice@public.test", "+15550001111"]);
  });
});

describe("profile rules", () => {
  it("locks the slug once published", async () => {
    await expect(as(ALICE, "update public.profiles set slug = 'alice-two' where user_id = $1", [ALICE])).rejects.toThrow(
      /permanent/,
    );
  });

  it("allows slug changes while still a draft", async () => {
    await as(BOB, "insert into public.profiles (user_id, slug, full_name) values ($1, 'bob', 'Bob')", [BOB]);
    const rows = await as(BOB, "update public.profiles set slug = 'bobby' where user_id = $1 returning slug", [BOB]);
    expect(rows).toEqual([{ slug: "bobby" }]);
  });

  it("enforces a unique slug and valid format", async () => {
    await expect(as(BOB, "update public.profiles set slug = 'alice' where user_id = $1", [BOB])).rejects.toThrow(/unique|duplicate/);
    await expect(as(BOB, "update public.profiles set slug = 'Bad Slug' where user_id = $1", [BOB])).rejects.toThrow(/check/);
  });

  it("accepts the networking goal and rejects unknown goals", async () => {
    const rows = await as(BOB, "update public.profiles set networking_goals = '{networking}' where user_id = $1 returning networking_goals", [BOB]);
    expect(rows).toEqual([{ networking_goals: ["networking"] }]);
    await expect(
      as(BOB, "update public.profiles set networking_goals = '{world-domination}' where user_id = $1", [BOB]),
    ).rejects.toThrow(/check/);
  });

  it("rejects unsafe URL schemes", async () => {
    await expect(
      as(BOB, "update public.profiles set website_url = 'javascript:alert(1)' where user_id = $1", [BOB]),
    ).rejects.toThrow(/check/);
    const [{ id }] = await as<{ id: string }>(BOB, "select id from public.profiles");
    await expect(
      as(BOB, "insert into public.social_links (profile_id, platform, url) values ($1, 'github', 'http://github.com/x')", [id]),
    ).rejects.toThrow(/check/);
  });

  it("caps contact methods per profile", async () => {
    const [{ id }] = await as<{ id: string }>(BOB, "select id from public.profiles");
    const many = Array.from({ length: 11 }, (_, i) => ({ type: "email", value: `b${i}@x.test`, isPublic: true }));
    await expect(as(BOB, "select public.replace_profile_children($1, $2::jsonb, '[]')", [id, JSON.stringify(many)])).rejects.toThrow(
      /Too many/,
    );
  });

  it("reports slug availability without leaking owners", async () => {
    const [{ a }] = await as<{ a: boolean }>(BOB, "select public.is_slug_available('alice') as a");
    expect(a).toBe(false);
    const [{ b }] = await as<{ b: boolean }>(BOB, "select public.is_slug_available('bobby') as b");
    expect(b).toBe(true); // their own slug
  });
});

describe("events", () => {
  it("records anonymous events for published profiles only, not the owner's own", async () => {
    await as(null, "select public.record_profile_event('alice', 'view', 'qr')");
    await as(BOB, "select public.record_profile_event('alice', 'save_contact', null)");
    await as(ALICE, "select public.record_profile_event('alice', 'view', 'link')"); // owner: ignored
    await as(null, "select public.record_profile_event('bobby', 'view', 'qr')"); // draft: ignored

    const stats = await as<{ event_type: string; source: string | null; total: number }>(
      ALICE,
      "select * from public.get_my_profile_stats(30) order by event_type",
    );
    expect(stats.map((s) => [s.event_type, s.source, Number(s.total)])).toEqual([
      ["save_contact", null, 1],
      ["view", "qr", 1],
    ]);
    expect(await as(BOB, "select * from public.get_my_profile_stats(30)")).toHaveLength(0);
  });

  it("anon cannot insert or read events directly", async () => {
    await expect(as(null, "select * from public.profile_events")).rejects.toThrow(/permission denied/);
    await expect(as(BOB, "insert into public.profile_events (profile_id, event_type) select id, 'view' from public.profiles")).rejects.toThrow(
      /permission denied/,
    );
  });

  it("rejects unknown event types", async () => {
    await expect(as(null, "select public.record_profile_event('alice', 'hack', null)")).rejects.toThrow(/check/);
  });
});

describe("deletion", () => {
  it("deleting an account cascades to profile and children", async () => {
    await as(BOB, "select public.delete_own_account()");
    const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from public.profiles where user_id = $1", [BOB]).then((r) => r.rows);
    expect(n).toBe(0);
    const [{ u }] = await db.query<{ u: number }>("select count(*)::int as u from auth.users where id = $1", [BOB]).then((r) => r.rows);
    expect(u).toBe(0);
  });

  it("deleted profiles are no longer public", async () => {
    await as(ALICE, "delete from public.profiles where user_id = $1", [ALICE]);
    const [{ p }] = await as<{ p: unknown }>(null, "select public.get_public_profile('alice') as p");
    expect(p).toBeNull();
    const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from public.contact_methods").then((r) => r.rows);
    expect(n).toBe(0);
  });
});

describe("waitlist", () => {
  it("lets anyone join once but nobody read the list", async () => {
    expect(await as(null, "select public.join_waitlist('  New@Person.test ', ' Ada Obi ') as ok")).toEqual([{ ok: true }]);
    // A duplicate is ignored and reports false, so no second email is sent.
    expect(await as(BOB, "select public.join_waitlist('new@person.test', 'Someone Else') as ok")).toEqual([{ ok: false }]);
    await expect(as(null, "select * from public.waitlist")).rejects.toThrow(/permission denied/);
    await expect(as(BOB, "select * from public.waitlist")).rejects.toThrow(/permission denied/);
    await expect(as(null, "insert into public.waitlist (email) values ('x@y.test')")).rejects.toThrow(/permission denied/);
    const rows = (await db.query<{ email: string; full_name: string }>("select email, full_name from public.waitlist")).rows;
    expect(rows).toEqual([{ email: "new@person.test", full_name: "Ada Obi" }]);
  });
});

describe("access codes", () => {
  const newUser = (code: string | null) =>
    db.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'n@test', $1)", [
      code === null ? {} : { access_code: code },
    ]);

  it("keeps the code list private but lets anyone check a code", async () => {
    await db.exec("insert into public.access_codes (code, max_uses) values ('INVITE-ONE', 1), ('OLD-CODE', 5)");
    await db.exec("update public.access_codes set expires_at = now() - interval '1 day' where code = 'OLD-CODE'");
    await expect(as(null, "select * from public.access_codes")).rejects.toThrow(/permission denied/);
    expect(await as(null, "select public.check_access_code(' invite-one ') as ok")).toEqual([{ ok: true }]);
    expect(await as(null, "select public.check_access_code('nope-nope') as ok")).toEqual([{ ok: false }]);
    expect(await as(null, "select public.check_access_code('old-code') as ok")).toEqual([{ ok: false }]);
  });

  it("blocks sign-ups without a valid code and uses codes up", async () => {
    await expect(newUser(null)).rejects.toThrow(/access code is required/);
    await expect(newUser("NOPE-NOPE")).rejects.toThrow(/access code is required/);
    await expect(newUser("OLD-CODE")).rejects.toThrow(/access code is required/);
    await newUser("invite-one");
    await expect(newUser("INVITE-ONE")).rejects.toThrow(/access code is required/); // single use
    const users = (await db.query<{ m: unknown }>("select raw_user_meta_data as m from auth.users where email = 'n@test'")).rows;
    expect(users).toEqual([{ m: {} }]); // code not stored on the user
    expect(await as(null, "select public.check_access_code('INVITE-ONE') as ok")).toEqual([{ ok: false }]);
  });
});

describe("invites", () => {
  it("only admins can see the waiting list or send invites", async () => {
    await db.query("select public.join_waitlist('invitee@test', 'Ivy Invitee')");
    await expect(as(BOB, "select * from public.admin_list_waitlist()")).rejects.toThrow(/Not allowed/);
    await expect(as(BOB, "select public.admin_invite('invitee@test')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select public.admin_invite('invitee@test')")).rejects.toThrow(/permission denied|Not allowed/);
    await expect(as(BOB, "select * from public.admins")).rejects.toThrow(/permission denied/);
  });

  it("creates a single-use code, re-sends it, and shows sign-up status", async () => {
    await db.query("insert into public.admins (user_id) values ($1)", [ALICE]);
    const [{ code }] = await as<{ code: string }>(ALICE, "select public.admin_invite(' Invitee@Test ') as code");
    expect(code).toMatch(/^MW-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    // Inviting again returns the same unused code.
    expect(await as(ALICE, "select public.admin_invite('invitee@test') as code")).toEqual([{ code }]);

    const before = await as<{ email: string; invited_at: string | null; signed_up: boolean }>(
      ALICE,
      "select email, invited_at, signed_up from public.admin_list_waitlist() where email = 'invitee@test'",
    );
    expect(before[0].invited_at).not.toBeNull();
    expect(before[0].signed_up).toBe(false);

    await db.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'invitee@test', $1)", [
      { access_code: code.toLowerCase() },
    ]);
    const after = await as<{ signed_up: boolean }>(
      ALICE,
      "select signed_up from public.admin_list_waitlist() where email = 'invitee@test'",
    );
    expect(after).toEqual([{ signed_up: true }]);
    // The code is used up, so a new invite makes a fresh one.
    const [{ code: next }] = await as<{ code: string }>(ALICE, "select public.admin_invite('invitee@test') as code");
    expect(next).not.toBe(code);
  });

  it("refuses emails that are not on the list", async () => {
    await expect(as(ALICE, "select public.admin_invite('nobody@test')")).rejects.toThrow(/not on the waiting list/);
  });
});

describe("internal functions", () => {
  it("can't be called by visitors", async () => {
    await expect(as(null, "select public.purge_old_profile_events()")).rejects.toThrow(/permission denied/);
    await expect(as(BOB, "select public.purge_old_profile_events()")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select public.admin_invite('x@test')")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.admin_list_waitlist()")).rejects.toThrow(/permission denied/);
  });
});

describe("admin members view", () => {
  it("shows each account's card status and usage to admins only", async () => {
    await expect(as(BOB, "select * from public.admin_list_members()")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_list_members()")).rejects.toThrow(/permission denied/);

    const CAROL = "33333333-3333-3333-3333-333333333333";
    await db.exec("insert into public.access_codes (code, max_uses) values ('CAROL-CODE', 1)");
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'carol@test', $2)", [
      CAROL,
      { access_code: "CAROL-CODE" },
    ]);
    const id = await createProfile(CAROL, "carol");
    await db.query(
      `insert into public.profile_events (profile_id, event_type, source)
       values ($1, 'view', 'qr'), ($1, 'view', 'link'), ($1, 'save_contact', null)`,
      [id],
    );
    const [expected] = (
      await db.query<{ views: number; qr: number; saved: number }>(
        `select count(*) filter (where event_type = 'view')::int as views,
                count(*) filter (where event_type = 'view' and source = 'qr')::int as qr,
                count(*) filter (where event_type = 'save_contact')::int as saved
         from public.profile_events where profile_id = $1`,
        [id],
      )
    ).rows;

    const rows = await as<{ email: string; slug: string | null; card_status: string | null; has_photo: boolean; views: string; qr_scans: string; contacts_saved: string }>(
      ALICE,
      "select * from public.admin_list_members()",
    );
    const carol = rows.find((r) => r.slug === "carol")!;
    expect(carol.email).toBe("carol@test");
    expect(carol.card_status).toBe("published");
    expect(carol.has_photo).toBe(false);
    expect(Number(carol.views)).toBe(expected.views);
    expect(Number(carol.qr_scans)).toBe(expected.qr);
    expect(Number(carol.contacts_saved)).toBe(expected.saved);
    // Accounts without a card still appear.
    expect(rows.some((r) => r.email === "invitee@test" && r.card_status === null)).toBe(true);
  });
});

describe("reminders", () => {
  const SECRET = "test-secret-that-is-long-enough-1234567890";

  it("refuses callers without the secret", async () => {
    await db.query("insert into public.internal_settings (key, value) values ('cron_secret', $1)", [SECRET]);
    await expect(as(null, "select * from public.claim_reminders('wrong', 40)")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.claim_reminders(null, 40)")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.reminders_sent")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.internal_settings")).rejects.toThrow(/permission denied/);
  });

  it("finds each kind of reminder once, then never again", async () => {
    // Invite sent 4 days ago, still unused.
    await db.query("select public.join_waitlist('slow@test', 'Sam Slow')");
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ALICE]);
    const [{ code }] = await as<{ code: string }>(ALICE, "select public.admin_invite('slow@test') as code");
    await db.query("update public.waitlist set invited_at = now() - interval '4 days' where email = 'slow@test'");

    // Unconfirmed account, 2 days old.
    await db.exec("insert into public.access_codes (code, max_uses) values ('REMIND-CODE', 3)");
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data, created_at, email_confirmed_at)
       values (gen_random_uuid(), 'unconfirmed@test', '{"access_code":"REMIND-CODE"}', now() - interval '2 days', null),
              (gen_random_uuid(), 'drafty@test', '{"access_code":"REMIND-CODE"}', now() - interval '3 days', now() - interval '3 days')`,
    );

    // Published 8 days ago, no QR scans.
    const DAN = "44444444-4444-4444-4444-444444444444";
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data, created_at, email_confirmed_at)
       values ($1, 'quiet@test', '{"access_code":"REMIND-CODE"}', now() - interval '10 days', now() - interval '10 days')`,
      [DAN],
    );
    await createProfile(DAN, "quiet");
    // The publish date is normally locked; backdate it for the test only.
    await db.exec("alter table public.profiles disable trigger profiles_before_write");
    await db.query("update public.profiles set published_at = now() - interval '8 days' where slug = 'quiet'");
    await db.exec("alter table public.profiles enable trigger profiles_before_write");

    const first = await as<{ kind: string; email: string; full_name: string | null; access_code: string | null }>(
      null,
      `select * from public.claim_reminders('${SECRET}', 40)`,
    );
    const pick = (kind: string, email: string) => first.find((r) => r.kind === kind && r.email === email);
    expect(pick("invite_unused", "slow@test")).toMatchObject({ full_name: "Sam Slow", access_code: code });
    expect(pick("email_unconfirmed", "unconfirmed@test")).toBeTruthy();
    expect(pick("card_draft", "drafty@test")).toBeTruthy();
    expect(pick("no_scans", "quiet@test")).toBeTruthy();
    // Fresh accounts and recent invites are left alone.
    expect(first.some((r) => r.email === "invitee@test" && r.kind === "invite_unused")).toBe(false);

    const second = await as(null, `select * from public.claim_reminders('${SECRET}', 40)`);
    expect(second).toEqual([]);
  });
});

describe("reminder status on the admin page", () => {
  it("lists the reminders each person was sent", async () => {
    // The reminders test above sent one of each kind.
    const waitlist = await as<{ email: string; reminders: { kind: string; sent_at: string }[] }>(
      ALICE,
      "select email, reminders from public.admin_list_waitlist() where email = 'slow@test'",
    );
    expect(waitlist[0].reminders.map((r) => r.kind)).toEqual(["invite_unused"]);

    const members = await as<{ email: string; reminders: { kind: string }[] }>(
      ALICE,
      "select email, reminders from public.admin_list_members() where email in ('drafty@test', 'quiet@test', 'unconfirmed@test') order by email",
    );
    expect(members.map((m) => [m.email, m.reminders.map((r) => r.kind).sort()])).toEqual([
      ["drafty@test", ["card_draft"]],
      // Published 8 days ago with no scans and a thin profile: both reminders.
      ["quiet@test", ["no_scans", "profile_incomplete"]],
      ["unconfirmed@test", ["email_unconfirmed"]],
    ]);
    // People with no reminders get an empty list, not null.
    const none = await as<{ reminders: unknown[] }>(ALICE, "select reminders from public.admin_list_members() where email = 'carol@test'");
    expect(none[0].reminders).toEqual([]);
    await expect(as(null, "select * from public.admin_list_members()")).rejects.toThrow(/permission denied/);
  });
});

describe("waitlist updates and unsubscribe", () => {
  it("returns a private unsubscribe token on first join only", async () => {
    const [{ t }] = await as<{ t: string | null }>(null, "select public.join_waitlist_with_token('updates@test', 'Uma Updates') as t");
    expect(t).toMatch(/^[0-9a-f-]{36}$/);
    const [{ t: again }] = await as<{ t: string | null }>(null, "select public.join_waitlist_with_token('UPDATES@test', 'Someone') as t");
    expect(again).toBeNull();
    // Older rows got their own tokens too.
    const rows = (await db.query<{ n: number; distinct_n: number }>(
      "select count(*)::int as n, count(distinct unsubscribe_token)::int as distinct_n from public.waitlist",
    )).rows;
    expect(rows[0].n).toBe(rows[0].distinct_n);
  });

  it("unsubscribes with the right token and nothing else", async () => {
    const [{ token }] = (await db.query<{ token: string }>(
      "select unsubscribe_token::text as token from public.waitlist where email = 'updates@test'",
    )).rows;
    expect(await as(null, "select public.unsubscribe_waitlist(gen_random_uuid()) as ok")).toEqual([{ ok: false }]);
    expect(await as(null, `select public.unsubscribe_waitlist('${token}') as ok`)).toEqual([{ ok: true }]);
    // Clicking again is fine and keeps the first date.
    expect(await as(null, `select public.unsubscribe_waitlist('${token}') as ok`)).toEqual([{ ok: true }]);
    const [{ unsub, others }] = (await db.query<{ unsub: boolean; others: number }>(
      `select (select unsubscribed_at is not null from public.waitlist where email = 'updates@test') as unsub,
              (select count(*)::int from public.waitlist where unsubscribed_at is not null and email <> 'updates@test') as others`,
    )).rows;
    expect(unsub).toBe(true);
    expect(others).toBe(0);
    // Visitors still can't read the list or tokens.
    await expect(as(null, "select unsubscribe_token from public.waitlist")).rejects.toThrow(/permission denied/);
  });
});

describe("AI network matching", () => {
  const SECRET = "test-secret-that-is-long-enough-1234567890"; // stored by the reminders tests
  const JUNIOR = "55555555-5555-5555-5555-555555555555";
  const SENIOR = "66666666-6666-6666-6666-666666666666";
  const ENGINEER = "77777777-7777-7777-7777-777777777777";
  const MARKETER = "88888888-8888-8888-8888-888888888888";
  const OPTED_OUT = "99999999-9999-9999-9999-999999999999";
  const SPARSE = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  beforeAll(async () => {
    await db.exec("insert into public.access_codes (code, max_uses) values ('MATCH-CODE', 10)");
    for (const [id, email] of [
      [JUNIOR, "junior@test"], [SENIOR, "senior@test"], [ENGINEER, "engineer@test"],
      [MARKETER, "marketer@test"], [OPTED_OUT, "optout@test"], [SPARSE, "sparse@test"],
    ]) {
      await db.query(
        `insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at)
         values ($1, $2, '{"access_code":"MATCH-CODE"}', now())`,
        [id, email],
      );
      await createProfile(id, email.split("@")[0]);
    }
    // Fill in organisation and bio so test profiles are at least 80% complete.
    await db.exec("update public.profiles set organization = 'Studio', bio = 'I like meeting people.'");
    const set = (id: string, sql: string) => db.query(`update public.profiles set ${sql} where user_id = $1`, [id]);
    await set(JUNIOR, "field = 'product_design', experience_years = 1, looking_for = '{mentor}', city = 'Lagos', matching_opt_in = true");
    await set(SENIOR, "field = 'product_design', experience_years = 4, looking_for = '{mentee}', city = 'Lagos', matching_opt_in = true, avatar_url = 'https://example.test/senior.jpg'");
    await set(ENGINEER, "field = 'software_engineering', experience_years = 3, looking_for = '{collaborators}', matching_opt_in = true");
    await set(MARKETER, "field = 'marketing_growth', experience_years = 6, looking_for = '{mentee}', matching_opt_in = true");
    await set(OPTED_OUT, "field = 'product_design', experience_years = 8, looking_for = '{mentee}', matching_opt_in = false");
    // Opted in and very experienced, but a thin profile (no title, organisation or bio): 50%.
    await set(SPARSE, "field = 'product_design', experience_years = 10, looking_for = '{mentee}', matching_opt_in = true, professional_title = null, organization = null, bio = null");
  });

  it("refuses callers without the job secret, and keeps matches private", async () => {
    await expect(as(null, "select * from public.matching_due_users('wrong', 30)")).rejects.toThrow(/Not allowed/);
    await expect(as(null, `select * from public.matching_candidates('wrong', '${JUNIOR}', 8)`)).rejects.toThrow(/Not allowed/);
    await expect(as(null, `select public.record_match('wrong', '${JUNIOR}', gen_random_uuid(), 'x')`)).rejects.toThrow(/Not allowed/);
    await expect(as(JUNIOR, "select * from public.matches")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.my_matches()")).rejects.toThrow(/permission denied/);
  });

  it("recommends only people with 4+ years and more experience, the 4-year designer first", async () => {
    const cands = await as<{ slug: string; score: number }>(
      null,
      `select slug, score from public.matching_candidates('${SECRET}', '${JUNIOR}', 8)`,
    );
    expect(cands[0].slug).toBe("senior");
    const slugs = cands.map((c) => c.slug);
    expect(slugs).not.toContain("optout"); // not opted in
    expect(slugs).not.toContain("marketer"); // unrelated field
    expect(slugs).not.toContain("junior"); // not themselves
    expect(slugs).not.toContain("engineer"); // related field and ahead, but only 3 years: under the 4-year minimum

    // No photo, no recommendation, however experienced.
    await db.exec("update public.profiles set avatar_url = null where slug = 'senior'");
    const noPhoto = await as<{ slug: string }>(null, `select slug from public.matching_candidates('${SECRET}', '${JUNIOR}', 8)`);
    expect(noPhoto.map((c) => c.slug)).not.toContain("senior");
    await db.exec("update public.profiles set avatar_url = 'https://example.test/senior.jpg' where slug = 'senior'");

    // Never the other way round: the senior is never shown people with less experience.
    const forSenior = await as<{ slug: string }>(
      null,
      `select slug from public.matching_candidates('${SECRET}', '${SENIOR}', 8)`,
    );
    expect(forSenior.map((c) => c.slug)).not.toContain("junior");
    expect(forSenior.map((c) => c.slug)).not.toContain("engineer");
  });

  it("gives at most one match a day and never the same person twice", async () => {
    const due = await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`);
    const dueEmails = due.map((d) => d.email);
    expect(dueEmails).toEqual(expect.arrayContaining(["junior@test", "engineer@test"]));
    expect(dueEmails).not.toContain("optout@test");
    // 4+ years: recommended to others, never introduced themselves.
    expect(dueEmails).not.toContain("senior@test");
    expect(dueEmails).not.toContain("marketer@test");

    const [{ id: seniorId }] = (await db.query<{ id: string }>("select id from public.profiles where slug = 'senior'")).rows;
    const [{ id: engId }] = (await db.query<{ id: string }>("select id from public.profiles where slug = 'engineer'")).rows;
    const record = (profileId: string, reason: string) =>
      as<{ m: string | null }>(null, `select public.record_match('${SECRET}', '${JUNIOR}', '${profileId}', '${reason}') as m`);

    expect((await record(seniorId, "Ada is 3 years ahead of you in product design and mentors."))[0].m).not.toBeNull();
    expect((await record(engId, "x"))[0].m).toBeNull(); // already had one today

    const dueAfter = await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`);
    expect(dueAfter.map((d) => d.email)).not.toContain("junior@test");

    // A day later: due again, and can get the next person.
    await db.exec("update public.matches set created_at = now() - interval '1 day'");
    const dueNextDay = await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`);
    expect(dueNextDay.map((d) => d.email)).toContain("junior@test");
    const cands = await as<{ slug: string }>(null, `select slug from public.matching_candidates('${SECRET}', '${JUNIOR}', 8)`);
    expect(cands.map((c) => c.slug)).not.toContain("senior"); // never twice
    expect((await record(engId, "Kemi has 2 more years in product and tech."))[0].m).not.toBeNull();
    expect((await record(seniorId, "again"))[0].m).toBeNull();

    const mine = await as<{ slug: string }>(JUNIOR, "select slug from public.my_matches()");
    expect(mine.map((m) => m.slug).sort()).toEqual(["engineer", "senior"]);
    expect(await as(SENIOR, "select * from public.my_matches()")).toEqual([]); // one-way
  });

  it("stops at 5 free matches a month (Lagos time), and last month doesn't count", async () => {
    const used = async () =>
      (await db.query<{ n: number }>(`select public.spark_matches_this_month('${JUNIOR}') as n`)).rows[0].n;
    const due = async () =>
      (await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`)).map((d) => d.email);
    const ids = (await db.query<{ id: string }>(
      "select id from public.profiles where slug not in ('junior', 'sparse') order by slug limit 5",
    )).rows.map((r) => r.id);
    expect(ids).toHaveLength(5);
    const insertFive = (when: string) =>
      db.query(
        `insert into public.matches (user_id, matched_profile_id, reason, created_at)
         select $1, id, 'test', ${when} from unnest($2::uuid[]) as id`,
        [JUNIOR, ids],
      );
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);

    // Five matches last month: none of them count, so the member is due.
    await insertFive("public.spark_month_start() - interval '1 day'");
    expect(await used()).toBe(0);
    expect(await due()).toContain("junior@test");

    // Five this month: no sixth until next month.
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);
    await insertFive("public.spark_month_start()");
    expect(await used()).toBe(5);
    expect(await due()).not.toContain("junior@test");
    const [{ id: sixth }] = (await db.query<{ id: string }>("select id from public.profiles where slug = 'sparse'")).rows;
    const recorded = await as<{ m: string | null }>(
      null,
      `select public.record_match('${SECRET}', '${JUNIOR}', '${sixth}', 'sixth') as m`,
    );
    expect(recorded[0].m).toBeNull();

    // The member sees their own count; the helpers stay locked.
    expect((await as<{ n: number }>(JUNIOR, "select public.my_matches_this_month() as n"))[0].n).toBe(5);
    await expect(as(null, `select public.spark_matches_this_month('${JUNIOR}')`)).rejects.toThrow(/permission denied/);
    await expect(as(JUNIOR, `select public.spark_matches_this_month('${JUNIOR}')`)).rejects.toThrow(/permission denied/);
    await expect(as(JUNIOR, "select public.spark_month_start()")).rejects.toThrow(/permission denied/);
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);
  });

  it("leaves out profiles under 80% complete, both ways", async () => {
    const [{ junior, sparse }] = (await db.query<{ junior: number; sparse: number }>(
      `select public.profile_completeness(j) as junior, public.profile_completeness(s) as sparse
       from public.profiles j, public.profiles s where j.slug = 'junior' and s.slug = 'sparse'`,
    )).rows;
    expect(junior).toBeGreaterThanOrEqual(80);
    expect(sparse).toBe(50);
    const cands = await as<{ slug: string }>(null, `select slug from public.matching_candidates('${SECRET}', '${JUNIOR}', 20)`);
    expect(cands.map((c) => c.slug)).not.toContain("sparse"); // not recommended
    const due = await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`);
    expect(due.map((d) => d.email)).not.toContain("sparse@test"); // doesn't get matches
    await expect(as(null, "select public.profile_completeness(p) from public.profiles p")).rejects.toThrow(/permission denied/);
  });

  it("reminds members under 80% to complete their profile, once, with photo info", async () => {
    // Published a couple of days ago (the publish date is normally locked).
    await db.exec("alter table public.profiles disable trigger profiles_before_write");
    await db.exec("update public.profiles set published_at = now() - interval '2 days' where slug in ('sparse', 'junior')");
    await db.exec("alter table public.profiles enable trigger profiles_before_write");

    const first = await as<{ kind: string; email: string; completeness: number | null; has_photo: boolean | null }>(
      null,
      `select kind, email, completeness, has_photo from public.claim_reminders('${SECRET}', 200)`,
    );
    const incomplete = first.filter((r) => r.kind === "profile_incomplete");
    expect(incomplete).toContainEqual({ kind: "profile_incomplete", email: "sparse@test", completeness: 50, has_photo: false });
    expect(incomplete.map((r) => r.email)).not.toContain("junior@test"); // 80%+ already
    const again = await as<{ kind: string; email: string }>(null, `select kind, email from public.claim_reminders('${SECRET}', 200)`);
    expect(again.filter((r) => r.kind === "profile_incomplete" && r.email === "sparse@test")).toEqual([]);
  });

  it("recommends nobody when no one in the field has more experience", async () => {
    const before = await as<{ slug: string; score: number }>(
      null,
      `select slug, score from public.matching_candidates('${SECRET}', '${MARKETER}', 8)`,
    );
    expect(before).toEqual([]); // nobody in growth with more experience
  });

  it("tells members with 4+ years how often they were introduced, but not to whom", async () => {
    const [{ id: seniorId }] = (await db.query<{ id: string }>("select id from public.profiles where slug = 'senior'")).rows;
    await db.query("delete from public.matches where matched_profile_id = $1", [seniorId]);
    await db.query(
      `insert into public.matches (user_id, matched_profile_id, reason, created_at) values
         ($1, $3, 'this month', now()),
         ($2, $3, 'last month', public.spark_month_start() - interval '1 day')`,
      [JUNIOR, ENGINEER, seniorId],
    );
    expect(await as(SENIOR, "select * from public.my_spark_mentor_stats()")).toEqual([{ this_month: 1, total: 2 }]);
    expect(await as(JUNIOR, "select * from public.my_spark_mentor_stats()")).toEqual([{ this_month: 0, total: 0 }]);
    await expect(as(null, "select * from public.my_spark_mentor_stats()")).rejects.toThrow(/permission denied/);
    await db.query("delete from public.matches where matched_profile_id = $1", [seniorId]);
  });
});

describe("announcements", () => {
  it("lets only admins send, to confirmed members, once each", async () => {
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ALICE]);
    await expect(as(BOB, "select * from public.admin_announcement_recipients('spark_beta', 25)")).rejects.toThrow(/Not allowed/);
    await expect(as(BOB, "select public.admin_mark_announced('spark_beta', 'x@test')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_announcement_recipients('spark_beta', 25)")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.admin_announcement_status('spark_beta')")).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, "select * from public.announcements_sent")).rejects.toThrow(/permission denied/);

    const recipients = await as<{ email: string }>(ALICE, "select email from public.admin_announcement_recipients('spark_beta', 100)");
    const emails = recipients.map((r) => r.email);
    const [{ confirmed }] = (await db.query<{ confirmed: number }>(
      "select count(*)::int as confirmed from auth.users where email_confirmed_at is not null",
    )).rows;
    expect(emails).toHaveLength(Math.min(confirmed, 100));
    expect(emails).not.toContain("unconfirmed@test"); // only confirmed accounts

    const [first] = emails;
    expect((await as<{ ok: boolean }>(ALICE, `select public.admin_mark_announced('spark_beta', '${first}') as ok`))[0].ok).toBe(true);
    expect((await as<{ ok: boolean }>(ALICE, `select public.admin_mark_announced('spark_beta', '${first}') as ok`))[0].ok).toBe(false);
    const after = await as<{ email: string }>(ALICE, "select email from public.admin_announcement_recipients('spark_beta', 100)");
    expect(after.map((r) => r.email)).not.toContain(first);
    const [status] = await as<{ sent: number; remaining: number }>(ALICE, "select * from public.admin_announcement_status('spark_beta')");
    expect(status).toEqual({ sent: 1, remaining: confirmed - 1 });
    await expect(as(ALICE, "select public.admin_mark_announced('other', 'x@test')")).rejects.toThrow(/check constraint/);
  });
});

describe("Spark credits", () => {
  const SECRET = "test-secret-that-is-long-enough-1234567890";
  const JUNIOR = "55555555-5555-5555-5555-555555555555";
  const SENIOR = "66666666-6666-6666-6666-666666666666";
  const start = (user: string, pack: string) =>
    as<{ reference: string; amount_kobo: number; credits: number; email: string }>(
      user,
      `select * from public.start_credit_purchase('${pack}')`,
    );
  const confirm = (ref: string, amount: number, currency = "NGN", token = SECRET) =>
    as<{ added: boolean; credits: number }>(
      null,
      `select added, credits from public.confirm_payment('${token}', '${ref}', ${amount}, '${currency}', 123)`,
    );
  const balance = async (user: string) => (await as<{ n: number }>(user, "select public.my_spark_credits() as n"))[0].n;

  it("keeps payments and credits private, and prices on the server", async () => {
    await expect(as(JUNIOR, "select * from public.payments")).rejects.toThrow(/permission denied/);
    await expect(as(JUNIOR, "select * from public.credit_ledger")).rejects.toThrow(/permission denied/);
    await expect(as(JUNIOR, "insert into public.credit_ledger (user_id, delta, reason) values (auth.uid(), 100, 'admin')")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.start_credit_purchase('spark_5')")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select public.my_spark_credits()")).rejects.toThrow(/permission denied/);
    await expect(as(JUNIOR, `select public.spark_credit_balance('${JUNIOR}')`)).rejects.toThrow(/permission denied/);
    expect(await as(JUNIOR, "select * from public.list_credit_packs()")).toEqual([
      { id: "spark_5", credits: 5, amount_kobo: 250000 },
      { id: "spark_15", credits: 15, amount_kobo: 600000 },
    ]);
    await expect(start(JUNIOR, "free_credits")).rejects.toThrow(/Unknown pack/);
    await expect(start(SENIOR, "spark_5")).rejects.toThrow(/under 4 years/);
  });

  it("adds credits once, only for the right amount, only with the secret", async () => {
    expect(await balance(JUNIOR)).toBe(0);
    const [p] = await start(JUNIOR, "spark_5");
    expect(p).toMatchObject({ amount_kobo: 250000, credits: 5, email: "junior@test" });
    expect(p.reference).toMatch(/^mw_[0-9a-f]{32}$/);

    await expect(confirm(p.reference, 250000, "NGN", "wrong")).rejects.toThrow(/Not allowed/);
    await expect(confirm(p.reference, 100)).rejects.toThrow(/does not match/); // underpaid
    await expect(confirm(p.reference, 250000, "USD")).rejects.toThrow(/does not match/);
    await expect(confirm("mw_unknown", 250000)).rejects.toThrow(/Unknown payment/);
    expect(await balance(JUNIOR)).toBe(0);

    expect(await confirm(p.reference, 250000)).toEqual([{ added: true, credits: 5 }]);
    expect(await confirm(p.reference, 250000)).toEqual([{ added: false, credits: 5 }]); // webhook twice
    expect(await balance(JUNIOR)).toBe(5);

    const [failed] = await start(JUNIOR, "spark_15");
    await as(null, `select public.mark_payment_failed('${SECRET}', '${failed.reference}')`);
    const rows = await as<{ reference: string; status: string }>(JUNIOR, "select reference, status from public.admin_list_payments()").catch((e) => e);
    expect(rows).toBeInstanceOf(Error); // not an admin
    const admin = await as<{ reference: string; status: string }>(
      "11111111-1111-1111-1111-111111111111",
      "select reference, status from public.admin_list_payments()",
    );
    expect(admin).toEqual(expect.arrayContaining([
      { reference: p.reference, status: "success" },
      { reference: failed.reference, status: "failed" },
    ]));
  });

  it("uses a credit only after the free 5 in a month", async () => {
    const ids = (await db.query<{ id: string }>(
      "select id from public.profiles where slug not in ('junior', 'senior') order by slug limit 5",
    )).rows.map((r) => r.id);
    const [{ id: seniorId }] = (await db.query<{ id: string }>("select id from public.profiles where slug = 'senior'")).rows;
    const due = async () =>
      (await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`)).map((d) => d.email);
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);

    // Five free this month, a day ago: with credits the member is still due.
    await db.query(
      `insert into public.matches (user_id, matched_profile_id, reason, created_at)
       select $1, id, 'free', greatest(public.spark_month_start(), now() - interval '1 day') from unnest($2::uuid[]) as id`,
      [JUNIOR, ids],
    );
    await db.query("update public.matches set created_at = now() - interval '1 day' where user_id = $1 and created_at > now() - interval '20 hours'", [JUNIOR]);
    const freeUsed = (await db.query<{ n: number }>(`select public.spark_matches_this_month('${JUNIOR}') as n`)).rows[0].n;
    if (freeUsed < 5) return; // first day of the month: the backdated matches fell into last month
    expect(await due()).toContain("junior@test");

    const [{ m }] = await as<{ m: string | null }>(null, `select public.record_match('${SECRET}', '${JUNIOR}', '${seniorId}', 'paid one') as m`);
    expect(m).not.toBeNull();
    expect(await balance(JUNIOR)).toBe(4); // one credit used

    // Out of credits: no more until next month.
    await db.query("delete from public.credit_ledger where user_id = $1", [JUNIOR]);
    await db.query("update public.matches set created_at = now() - interval '1 day' where user_id = $1", [JUNIOR]);
    expect(await due()).not.toContain("junior@test");
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);
  });
});

describe("admin account", () => {
  const SECRET = "test-secret-that-is-long-enough-1234567890";
  const ADMIN = "abababab-abab-abab-abab-abababababab";

  it("keeps the admin account out of members, announcements and reminders", async () => {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at, created_at)
       values ($1, 'admin@meetwell.test', '{"access_code":"MATCH-CODE"}', now(), now() - interval '5 days')`,
      [ADMIN],
    );
    await db.query("insert into public.admins (user_id) values ($1)", [ADMIN]);

    const members = await as<{ email: string }>(ADMIN, "select email from public.admin_list_members()");
    expect(members.length).toBeGreaterThan(0); // the admin can see members
    expect(members.map((m) => m.email)).not.toContain("admin@meetwell.test");

    const recipients = await as<{ email: string }>(ADMIN, "select email from public.admin_announcement_recipients('spark_beta', 100)");
    expect(recipients.map((r) => r.email)).not.toContain("admin@meetwell.test");

    // No card for 5 days would normally trigger a "finish your card" reminder.
    const reminders = await as<{ email: string }>(null, `select email from public.claim_reminders('${SECRET}', 200)`);
    expect(reminders.map((r) => r.email)).not.toContain("admin@meetwell.test");

    await expect(as(ADMIN, `select public.is_admin_user('${ADMIN}')`)).rejects.toThrow(/permission denied/);
  });
});

describe("admin metrics", () => {
  const ADMIN = "abababab-abab-abab-abab-abababababab"; // created in "admin account"

  it("gives admins growth and revenue numbers, and nobody else", async () => {
    await expect(as("55555555-5555-5555-5555-555555555555", "select public.admin_metrics()")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select public.admin_metrics()")).rejects.toThrow(/permission denied/);

    const [{ m }] = await as<{ m: Record<string, unknown> }>(ADMIN, "select public.admin_metrics() as m");
    const [{ users }] = (await db.query<{ users: number }>(
      "select count(*)::int as users from auth.users u where not exists (select 1 from public.admins a where a.user_id = u.id)",
    )).rows;
    expect(Number(m.members)).toBe(users); // admins left out
    const [{ kobo }] = (await db.query<{ kobo: number }>(
      "select coalesce(sum(amount_kobo), 0)::int as kobo from public.payments where status = 'success'",
    )).rows;
    expect(Number(m.revenue_total_kobo)).toBe(kobo);
    expect(Number(m.revenue_total_kobo)).toBeGreaterThan(0); // the credits test paid for a pack
    expect(m.signups_by_week).toHaveLength(12);
    expect(m.revenue_by_month).toHaveLength(6);
    const months = m.revenue_by_month as { kobo: number }[];
    expect(months.reduce((n, x) => n + Number(x.kobo), 0)).toBe(kobo); // all paid this month in tests
  });
});

describe("messaging", () => {
  const SECRET = "test-secret-that-is-long-enough-1234567890";
  const ADMIN = "abababab-abab-abab-abab-abababababab";
  const JUNIOR = "55555555-5555-5555-5555-555555555555"; // 1 year
  const SENIOR = "66666666-6666-6666-6666-666666666666"; // 4 years
  const ENGINEER = "77777777-7777-7777-7777-777777777777"; // 3 years, not in the conversation
  let conv = 0;

  const send = (user: string, body: string, c = conv) =>
    as<{ id: string }>(user, "select public.send_message($1, $2) as id", [c, body]);

  it("only admins open conversations, member under 4 and mentor 4+", async () => {
    await expect(as(JUNIOR, "select public.admin_open_conversation('junior@test', 'senior@test', 30)")).rejects.toThrow(/Not allowed/);
    await expect(as(ADMIN, "select public.admin_open_conversation('senior@test', 'junior@test', 30)")).rejects.toThrow(/4\+ years/);
    const [{ id }] = await as<{ id: number }>(ADMIN, "select public.admin_open_conversation('junior@test', 'senior@test', 30) as id");
    conv = Number(id);
    expect(conv).toBeGreaterThan(0);
    await expect(as(JUNIOR, "select * from public.conversations")).rejects.toThrow(/permission denied/);
    await expect(as(JUNIOR, "select * from public.messages")).rejects.toThrow(/permission denied/);
  });

  it("lets the member write first, keeps strangers out, and counts unread", async () => {
    await expect(send(SENIOR, "Hi!")).rejects.toThrow(/member_first/);
    await expect(send(ENGINEER, "Let me in")).rejects.toThrow(/Not allowed/);
    await expect(as(ENGINEER, `select * from public.my_messages(${conv})`)).rejects.toThrow(/Not allowed/);
    await expect(send(JUNIOR, "   ")).rejects.toThrow(/1 to 2,000/);
    await expect(send(JUNIOR, "x".repeat(2001))).rejects.toThrow(/1 to 2,000/);

    await send(JUNIOR, "Hello Ada, I'd love your advice on portfolios.");
    expect((await as<{ n: number }>(SENIOR, "select public.my_unread_messages() as n"))[0].n).toBe(1);
    expect((await as<{ n: number }>(JUNIOR, "select public.my_unread_messages() as n"))[0].n).toBe(0);
    await send(SENIOR, "Happy to help. Send it over.");
    const thread = await as<{ mine: boolean; body: string }>(JUNIOR, `select mine, body from public.my_messages(${conv})`);
    expect(thread.map((m) => m.mine)).toEqual([true, false]);
    await as(SENIOR, `select public.mark_conversation_read(${conv})`);
    expect((await as<{ n: number }>(SENIOR, "select public.my_unread_messages() as n"))[0].n).toBe(0);
    const list = await as<{ role: string; other_name: string; locked: string | null }>(SENIOR, "select role, locked from public.my_conversations()");
    expect(list).toEqual([{ role: "mentor", locked: null }]);
  });

  it("emails each person once, for the first message the other sends, if switched on, with the secret", async () => {
    const firstOf = async (sender: string) =>
      (await db.query<{ id: string }>(
        "select id from public.messages where conversation_id = $1 and sender_id = $2 order by created_at, id limit 1",
        [conv, sender],
      )).rows[0].id;
    const claim = (id: string) =>
      as<{ email: string; sender_name: string; preview: string }>(
        null,
        `select email, sender_name, preview from public.claim_message_email('${SECRET}', ${id})`,
      );
    const juniorFirst = await firstOf(JUNIOR);
    await expect(as(null, `select * from public.claim_message_email('wrong', ${juniorFirst})`)).rejects.toThrow(/Not allowed/);
    expect(await claim(juniorFirst)).toEqual([
      { email: "senior@test", sender_name: "Test Person", preview: "Hello Ada, I'd love your advice on portfolios." },
    ]);
    expect(await claim(juniorFirst)).toEqual([]); // only once
    const [{ id: later }] = await send(JUNIOR, "Here it is.");
    expect(await claim(later)).toEqual([]); // not the first message: no email
    expect(await claim((await send(JUNIOR, "And one more thing."))[0].id)).toEqual([]);
    expect((await claim(await firstOf(SENIOR))).map((r) => r.email)).toEqual(["junior@test"]); // the reply's first message

    // Turned off: no emails.
    await db.exec("delete from public.message_emails_sent");
    await as(SENIOR, "select public.set_message_emails(false)");
    expect((await as<{ on: boolean }>(SENIOR, "select public.my_message_emails() as on"))[0].on).toBe(false);
    expect(await claim(juniorFirst)).toEqual([]);
    await as(SENIOR, "select public.set_message_emails(true)");
    // One-click off from the email link.
    const [{ token }] = (await db.query<{ token: string }>("select token from public.email_prefs where user_id = $1", [SENIOR])).rows;
    expect((await as<{ ok: boolean }>(null, `select public.unsubscribe_message_emails('${token}') as ok`))[0].ok).toBe(true);
    expect(await claim(juniorFirst)).toEqual([]);
    await as(SENIOR, "select public.set_message_emails(true)");
  });

  it("limits messages per hour, and goes read-only when access ends", async () => {
    await db.query(
      "insert into public.messages (conversation_id, sender_id, body) select $1, $2, 'filler' from generate_series(1, 30)",
      [conv, SENIOR],
    );
    await expect(send(SENIOR, "one too many")).rejects.toThrow(/Too many messages/);
    await db.query("delete from public.messages where body = 'filler'");

    await db.query("update public.conversations set access_until = now() - interval '1 minute' where id = $1", [conv]);
    await expect(send(JUNIOR, "still there?")).rejects.toThrow(/ended/);
    expect((await as<{ body: string }>(JUNIOR, `select body from public.my_messages(${conv})`)).length).toBeGreaterThan(0); // history stays
    await db.query("update public.conversations set access_until = now() + interval '30 days' where id = $1", [conv]);
  });

  it("blocks both ways, and pauses after three open reports", async () => {
    await as(SENIOR, `select public.set_block(${conv}, true)`);
    await expect(send(JUNIOR, "hello?")).rejects.toThrow(/blocked/);
    await expect(send(SENIOR, "hello?")).rejects.toThrow(/blocked/);
    await as(SENIOR, `select public.set_block(${conv}, false)`);

    const juniorMsgs = (await db.query<{ id: string }>(
      "select id from public.messages where conversation_id = $1 and sender_id = $2 order by id limit 3", [conv, JUNIOR],
    )).rows.map((r) => r.id);
    expect(juniorMsgs).toHaveLength(3);
    const [{ id: own }] = (await db.query<{ id: string }>("select id from public.messages where sender_id = $1 limit 1", [SENIOR])).rows;
    await expect(as(SENIOR, `select public.report_message(${own}, 'spam', null)`)).rejects.toThrow(/Not allowed/); // not your own
    await expect(as(SENIOR, `select public.report_message(${juniorMsgs[0]}, 'rude', null)`)).rejects.toThrow(/check/);
    for (const id of juniorMsgs) await as(SENIOR, `select public.report_message(${id}, 'spam', 'test')`);
    await expect(send(JUNIOR, "am I paused?")).rejects.toThrow(/paused/);

    const reports = await as<{ status: string; reported_email: string; reported_paused: boolean; context: unknown[] }>(
      ADMIN, "select status, reported_email, reported_paused, context from public.admin_list_reports()",
    );
    expect(reports).toHaveLength(3);
    expect(reports[0]).toMatchObject({ status: "open", reported_email: "junior@test", reported_paused: true });
    expect(reports[0].context.length).toBeLessThanOrEqual(7);
    await expect(as(SENIOR, "select * from public.admin_list_reports()")).rejects.toThrow(/Not allowed/);

    // Admin sees conversation counts, never messages.
    const convs = await as<Record<string, unknown>>(ADMIN, "select * from public.admin_list_conversations()");
    expect(Object.keys(convs[0])).not.toContain("body");

    await as(ADMIN, "select public.admin_set_messaging_paused('junior@test', false)");
    for (const r of await as<{ id: string }>(ADMIN, "select id from public.admin_list_reports()")) {
      await as(ADMIN, `select public.admin_resolve_report(${r.id}, 'dismiss')`);
    }
    await send(JUNIOR, "Back again.");
  });
});

describe("secret-protected functions for logged-in callers", () => {
  it("lets the server confirm a payment during a member's session, still only with the secret", async () => {
    const JUNIOR = "55555555-5555-5555-5555-555555555555";
    await expect(
      as(JUNIOR, "select * from public.confirm_payment('wrong', 'mw_x', 1, 'NGN', 1)"),
    ).rejects.toThrow(/Not allowed/); // reaches the secret check, not "permission denied"
    await expect(as(JUNIOR, "select * from public.claim_message_email('wrong', 1)")).rejects.toThrow(/Not allowed/);
  });
});

describe("mentor subscriptions and wallet", () => {
  const SECRET = "test-secret-that-is-long-enough-1234567890";
  const ADMIN = "abababab-abab-abab-abab-abababababab";
  const JUNIOR = "55555555-5555-5555-5555-555555555555"; // 1 year
  const SENIOR = "66666666-6666-6666-6666-666666666666"; // 4 years, photo
  const ENGINEER = "77777777-7777-7777-7777-777777777777"; // 3 years
  const status = async (u: string) =>
    (await as<{ status: string | null; checks: Record<string, boolean> }>(u, "select status, checks from public.my_mentor_status()"))[0];
  const wallet = async (u: string) =>
    (await as<{ available_kobo: number; pending_kobo: number }>(u, "select available_kobo, pending_kobo from public.my_wallet()"))[0];
  const q = (sql: string, params: unknown[] = []) => db.query(sql, params);

  it("lets eligible mentors apply, and only admins approve", async () => {
    // A brand-new account can apply; the admin decides.
    const s = await status(SENIOR);
    expect(Object.keys(s.checks)).not.toContain("account_age");
    expect(Object.values(s.checks).every(Boolean)).toBe(true);
    await as(SENIOR, "select public.apply_as_mentor()");
    expect((await status(SENIOR)).status).toBe("applied");
    await expect(as(JUNIOR, "select public.apply_as_mentor()")).rejects.toThrow(/Not eligible/); // 1 year

    // Not approved yet: no offer, no price changes.
    expect(await as(null, "select * from public.mentor_offer('senior')")).toEqual([]);
    await expect(as(SENIOR, "select public.set_mentor_offer(500000, true)")).rejects.toThrow(/Not an approved mentor/);
    await expect(as(SENIOR, "select * from public.admin_decide_mentor('senior@test', 'approved')")).rejects.toThrow(/Not allowed/);
    const [decided] = await as<{ email: string }>(ADMIN, "select * from public.admin_decide_mentor('senior@test', 'approved')");
    expect(decided.email).toBe("senior@test");

    await expect(as(SENIOR, "select public.set_mentor_offer(100000, true)")).rejects.toThrow(/between/); // under N2,000
    await expect(as(SENIOR, "select public.set_mentor_offer(2100000, true)")).rejects.toThrow(/between/);
    await as(SENIOR, "select public.set_mentor_offer(600000, true)");
    expect(await as(null, "select * from public.mentor_offer('senior')")).toEqual([{ price_kobo: 600000, first_name: "Test" }]);
  });

  it("sells 30 days of messages at the mentor's price, 80% to their wallet after 7 days", async () => {
    await expect(as(SENIOR, "select * from public.start_subscription_purchase('senior')")).rejects.toThrow(/That is you/);
    await q("update public.profiles set experience_years = 5 where user_id = $1", [ENGINEER]);
    await expect(as(ENGINEER, "select * from public.start_subscription_purchase('senior')")).rejects.toThrow(/under 4 years/);
    await q("update public.profiles set experience_years = 3 where user_id = $1", [ENGINEER]);

    const [p] = await as<{ reference: string; amount_kobo: number }>(ENGINEER, "select * from public.start_subscription_purchase('senior')");
    expect(p.amount_kobo).toBe(600000);
    await expect(
      as(null, `select * from public.confirm_payment('${SECRET}', '${p.reference}', 100, 'NGN', 9)`),
    ).rejects.toThrow(/does not match/);
    const [r] = await as<{ added: boolean; kind: string; conversation_id: number }>(
      null,
      `select added, kind, conversation_id from public.confirm_payment('${SECRET}', '${p.reference}', 600000, 'NGN', 9)`,
    );
    expect(r).toMatchObject({ added: true, kind: "subscription" });
    const again = await as<{ added: boolean }>(null, `select added from public.confirm_payment('${SECRET}', '${p.reference}', 600000, 'NGN', 9)`);
    expect(again[0].added).toBe(false); // webhook twice: no double access or earnings

    const [conv] = (await q(
      "select round(extract(epoch from access_until - now()) / 86400)::int as days from public.conversations where id = $1",
      [r.conversation_id],
    )).rows as { days: number }[];
    expect(conv.days).toBe(30);
    expect(await wallet(SENIOR)).toEqual({ available_kobo: 0, pending_kobo: 480000 }); // 80%, held 7 days
    await expect(as(ENGINEER, "select * from public.wallet_ledger")).rejects.toThrow(/permission denied/);

    // The member can message the mentor straight away.
    await as(ENGINEER, `select public.send_message(${r.conversation_id}, 'Hi, thanks for taking my question.')`);
  });

  it("withdraws N5,000+ of available money to a checked account, with admin approval", async () => {
    await expect(as(SENIOR, "select public.request_withdrawal(500000)")).rejects.toThrow(/bank account/);
    await expect(
      as(SENIOR, `select public.save_payout_account('wrong', '${SENIOR}', '058', 'GTBank', '1234', 'TEST PERSON', 'RCP_x')`),
    ).rejects.toThrow(/Not allowed/);
    await as(null, `select public.save_payout_account('${SECRET}', '${SENIOR}', '058', 'GTBank', '1234', 'TEST PERSON', 'RCP_x')`);
    await expect(as(SENIOR, "select public.request_withdrawal(500000)")).rejects.toThrow(/available balance/); // still pending

    // Seven days later the earning is available. Add another so there's N9,600.
    await q("update public.wallet_ledger set available_at = now() - interval '1 minute' where user_id = $1", [SENIOR]);
    await q("insert into public.wallet_ledger (user_id, amount_kobo, kind) values ($1, 480000, 'adjustment')", [SENIOR]);
    expect((await wallet(SENIOR)).available_kobo).toBe(960000);
    await expect(as(SENIOR, "select public.request_withdrawal(400000)")).rejects.toThrow(/minimum/);
    await expect(as(SENIOR, "select public.request_withdrawal(1000000)")).rejects.toThrow(/available balance/);

    const [{ id: w1 }] = await as<{ id: number }>(SENIOR, "select public.request_withdrawal(500000) as id");
    expect((await wallet(SENIOR)).available_kobo).toBe(460000); // held straight away
    await expect(as(SENIOR, `select * from public.admin_approve_withdrawal(${w1})`)).rejects.toThrow(/Not allowed/);
    const [ap] = await as<{ reference: string; amount_kobo: number; recipient_code: string }>(
      ADMIN,
      `select reference, amount_kobo, recipient_code from public.admin_approve_withdrawal(${w1})`,
    );
    expect(ap).toMatchObject({ amount_kobo: 500000, recipient_code: "RCP_x" });
    await as(null, `select public.record_transfer_result('${SECRET}', '${ap.reference}', 'success', 'TRF_1')`);
    expect((await as<{ status: string }>(SENIOR, "select status from public.my_withdrawals()"))[0].status).toBe("paid");

    // A failed transfer gives the money back, once.
    await q("insert into public.wallet_ledger (user_id, amount_kobo, kind) values ($1, 100000, 'adjustment')", [SENIOR]);
    const [{ id: w2 }] = await as<{ id: number }>(SENIOR, "select public.request_withdrawal(500000) as id");
    const [ap2] = await as<{ reference: string }>(ADMIN, `select reference from public.admin_approve_withdrawal(${w2})`);
    await as(null, `select public.record_transfer_result('${SECRET}', '${ap2.reference}', 'failed', null)`);
    expect((await wallet(SENIOR)).available_kobo).toBe(560000);
    await as(null, `select public.record_transfer_result('${SECRET}', '${ap2.reference}', 'failed', null)`);
    expect((await wallet(SENIOR)).available_kobo).toBe(560000);

    // Rejected by the admin: money back too.
    const [{ id: w3 }] = await as<{ id: number }>(SENIOR, "select public.request_withdrawal(500000) as id");
    await as(ADMIN, `select public.admin_reject_withdrawal(${w3}, 'Please check your bank details')`);
    expect((await wallet(SENIOR)).available_kobo).toBe(560000);
  });

  it("flags subscriptions with no mentor reply after 7 days, and refunds take the share back", async () => {
    const [p] = await as<{ reference: string }>(JUNIOR, "select * from public.start_subscription_purchase('senior')");
    await as(null, `select * from public.confirm_payment('${SECRET}', '${p.reference}', 600000, 'NGN', 10)`);
    await q("update public.payments set paid_at = now() - interval '8 days' where reference = $1", [p.reference]);
    // Earlier tests left messages in this conversation; make them older than the payment.
    await q(
      "update public.messages set created_at = now() - interval '10 days' where conversation_id = (select id from public.conversations where member_id = $1 and mentor_id = $2)",
      [JUNIOR, SENIOR],
    );
    const subs = await as<{ reference: string; refund_due: boolean }>(ADMIN, "select reference, refund_due from public.admin_list_subscriptions()");
    expect(subs.find((s) => s.reference === p.reference)?.refund_due).toBe(true);

    const before = await wallet(SENIOR);
    await as(ADMIN, `select public.admin_mark_refunded('${p.reference}')`);
    const after = await wallet(SENIOR);
    expect(after.available_kobo + after.pending_kobo).toBe(before.available_kobo + before.pending_kobo - 480000);
    await expect(as(ADMIN, `select public.admin_mark_refunded('${p.reference}')`)).rejects.toThrow(/Not a paid subscription/);
    const [{ id: convId }] = (await q(
      "select id from public.conversations where member_id = $1 and mentor_id = $2", [JUNIOR, SENIOR],
    )).rows as { id: number }[];
    await expect(as(JUNIOR, `select public.send_message(${convId}, 'hello')`)).rejects.toThrow(/ended/);
  });

  it("reminds members 3 days before access ends, once", async () => {
    await q(
      "update public.conversations set access_until = now() + interval '2 days 12 hours' where mentor_id = $1 and member_id = $2",
      [SENIOR, ENGINEER],
    );
    const first = await as<{ email: string }>(null, `select email from public.claim_subscription_reminders('${SECRET}')`);
    expect(first.map((r) => r.email)).toContain("engineer@test");
    expect(await as(null, `select email from public.claim_subscription_reminders('${SECRET}')`)).toEqual([]);
  });
});

describe("admin metrics with subscriptions", () => {
  it("counts only Meetwell's share as revenue", async () => {
    const ADMIN = "abababab-abab-abab-abab-abababababab";
    const [{ m }] = await as<{ m: { revenue_total_kobo: number } }>(ADMIN, "select public.admin_metrics() as m");
    const [{ ours }] = (await db.query<{ ours: number }>(
      "select coalesce(sum(amount_kobo - coalesce(mentor_share_kobo, 0)), 0)::int as ours from public.payments where status = 'success'",
    )).rows;
    expect(Number(m.revenue_total_kobo)).toBe(ours);
    const [{ gross }] = (await db.query<{ gross: number }>(
      "select coalesce(sum(amount_kobo), 0)::int as gross from public.payments where status = 'success'",
    )).rows;
    expect(ours).toBeLessThan(gross); // a subscription was paid, so the mentor share is left out
  });
});

describe("reply reminders", () => {
  const SECRET = "test-secret-that-is-long-enough-1234567890";
  const JUNIOR = "55555555-5555-5555-5555-555555555555";
  const SENIOR = "66666666-6666-6666-6666-666666666666";
  const ENGINEER = "77777777-7777-7777-7777-777777777777";

  it("reminds the person a message is waiting on after 4 hours, once", async () => {
    const [{ id: conv }] = (await db.query<{ id: number }>(
      "select id from public.conversations where member_id = $1 and mentor_id = $2", [ENGINEER, SENIOR],
    )).rows;
    await db.query("update public.conversations set access_until = now() + interval '10 days' where id = $1", [conv]);
    const claim = () =>
      as<{ email: string; to_mentor: boolean; preview: string }>(
        null, `select email, to_mentor, preview from public.claim_reply_reminders('${SECRET}', 50)`,
      );
    await expect(as(null, "select * from public.claim_reply_reminders('wrong', 50)")).rejects.toThrow(/Not allowed/);

    const [{ id: msg }] = (await db.query<{ id: number }>(
      "insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Are you free to chat this week?') returning id",
      [conv, ENGINEER],
    )).rows;
    expect((await claim()).map((r) => r.email)).not.toContain("senior@test"); // only just sent

    // Everything in this conversation is now older; the newest is the member's question.
    await db.query("update public.messages set created_at = now() - interval '30 hours' where conversation_id = $1 and id <> $2", [conv, msg]);
    await db.query("update public.messages set created_at = now() - interval '5 hours' where id = $1", [msg]);
    const due = (await claim()).filter((r) => r.email === "senior@test");
    expect(due).toEqual([{ email: "senior@test", to_mentor: true, preview: "Are you free to chat this week?" }]);
    expect((await claim()).map((r) => r.email)).not.toContain("senior@test"); // once

    // A reply means nothing is waiting on the mentor any more.
    await db.query("delete from public.message_reminders_sent");
    await db.query("insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'Yes, Thursday?')", [conv, SENIOR]);
    expect((await claim()).map((r) => r.email)).not.toContain("senior@test");
    await expect(as(JUNIOR, "select * from public.message_reminders_sent")).rejects.toThrow(/permission denied/);
  });
});

describe("payment history", () => {
  it("shows members only their own paid and refunded payments", async () => {
    const JUNIOR = "55555555-5555-5555-5555-555555555555";
    const ENGINEER = "77777777-7777-7777-7777-777777777777";
    await expect(as(null, "select * from public.my_payments()")).rejects.toThrow(/permission denied/);
    const mine = await as<{ kind: string; status: string; amount_kobo: number; mentor_name: string | null }>(
      JUNIOR, "select kind, status, amount_kobo, mentor_name from public.my_payments()",
    );
    const [{ n }] = (await db.query<{ n: number }>(
      "select count(*)::int as n from public.payments where user_id = $1 and status in ('success', 'refunded')", [JUNIOR],
    )).rows;
    expect(mine).toHaveLength(n);
    expect(mine.map((p) => p.kind)).toEqual(expect.arrayContaining(["credits", "subscription"]));
    expect(mine.find((p) => p.kind === "subscription")).toMatchObject({ status: "refunded", mentor_name: "Test Person" });
    expect(mine.every((p) => ["success", "refunded"].includes(p.status))).toBe(true); // no failed or unfinished
    const theirs = await as<{ reference: string }>(ENGINEER, "select reference from public.my_payments()");
    const juniorRefs = new Set((await as<{ reference: string }>(JUNIOR, "select reference from public.my_payments()")).map((p) => p.reference));
    expect(theirs.some((p) => juniorRefs.has(p.reference))).toBe(false);
  });
});

describe("outreach tracker", () => {
  it("is for admins only", async () => {
    await expect(as(BOB, "select * from public.admin_list_outreach()")).rejects.toThrow(/Not allowed/);
    await expect(as(BOB, "select public.admin_add_outreach('Dan', 'dan', null)")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_list_outreach()")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select public.admin_add_outreach('Dan', 'dan', null)")).rejects.toThrow(/permission denied/);
    await expect(as(BOB, "select * from public.outreach_contacts")).rejects.toThrow(/permission denied/);
  });

  it("gives each person a personal code and tracks them to sign-up", async () => {
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ALICE]);
    const [{ code }] = await as<{ code: string }>(ALICE, "select public.admin_add_outreach(' Daniel ', ' @DanBuilds ', 'Backend lead') as code");
    expect(code).toMatch(/^MW-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    await expect(as(ALICE, "select public.admin_add_outreach('Dan', 'danbuilds', null)")).rejects.toThrow(/already on the list/);
    await expect(as(ALICE, "select public.admin_add_outreach('Dan', 'not a handle!', null)")).rejects.toThrow(/check/);

    const [row] = await as<{ id: number; first_name: string; x_handle: string; status: string; joined: boolean }>(
      ALICE,
      "select id, first_name, x_handle, status, joined from public.admin_list_outreach() where x_handle = 'danbuilds'",
    );
    expect(row).toMatchObject({ first_name: "Daniel", status: "to_contact", joined: false });

    await as(ALICE, "select public.admin_set_outreach_status($1, 'replied')", [row.id]);
    const [moved] = await as<{ status: string; contacted_at: string | null; replied_at: string | null }>(
      ALICE,
      "select status, contacted_at, replied_at from public.admin_list_outreach() where id = $1",
      [row.id],
    );
    expect(moved.status).toBe("replied");
    expect(moved.contacted_at).not.toBeNull();
    expect(moved.replied_at).not.toBeNull();
    await expect(as(ALICE, "select public.admin_set_outreach_status($1, 'spammed')", [row.id])).rejects.toThrow(/check/);

    await db.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'dan@out.test', $1)", [
      { access_code: code },
    ]);
    const [joined] = await as<{ joined: boolean }>(ALICE, "select joined from public.admin_list_outreach() where id = $1", [row.id]);
    expect(joined.joined).toBe(true);
  });

  it("allows a missing name and fixing it later", async () => {
    await as(ALICE, "select public.admin_add_outreach(null, 'kemi_codes', null)");
    const [row] = await as<{ id: number; first_name: string | null }>(
      ALICE,
      "select id, first_name from public.admin_list_outreach() where x_handle = 'kemi_codes'",
    );
    expect(row.first_name).toBeNull();
    await expect(as(BOB, "select public.admin_set_outreach_name($1, 'Kemi')", [row.id])).rejects.toThrow(/Not allowed/);
    await as(ALICE, "select public.admin_set_outreach_name($1, ' Kemi ')", [row.id]);
    expect(await as(ALICE, "select first_name from public.admin_list_outreach() where id = $1", [row.id])).toEqual([
      { first_name: "Kemi" },
    ]);
  });

  it("removes a person and their unused code", async () => {
    const [{ code }] = await as<{ code: string }>(ALICE, "select public.admin_add_outreach('Tolu', 'tolu_dev', null) as code");
    const [{ id }] = await as<{ id: number }>(ALICE, "select id from public.admin_list_outreach() where x_handle = 'tolu_dev'");
    await as(ALICE, "select public.admin_delete_outreach($1)", [id]);
    expect(await as(ALICE, "select id from public.admin_list_outreach() where x_handle = 'tolu_dev'")).toEqual([]);
    expect((await db.query("select 1 from public.access_codes where code = $1", [code])).rows).toEqual([]);
  });
});

describe("contacts and sign-up through a card", () => {
  const OWNER = "c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c0c0";
  const THIRD = "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1";
  const FRIEND = "f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1";
  const newUser = (id: string, email: string, meta: Record<string, unknown>) =>
    db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, meta]);

  beforeAll(async () => {
    await db.exec("insert into public.access_codes (code, max_uses) values ('CONTACTS-CODE', 5)");
    await newUser(OWNER, "owner@contacts.test", { access_code: "CONTACTS-CODE" });
    await createProfile(OWNER, "owner-card");
    await newUser(THIRD, "third@contacts.test", { access_code: "CONTACTS-CODE" });
    await createProfile(THIRD, "third-card");
  });

  it("lets a visitor sign up through a member's card and keeps their saved cards", async () => {
    expect(await as(null, "select public.card_invite_open('Owner-Card') as open")).toEqual([{ open: true }]);
    expect(await as(null, "select public.card_invite_open('nobody-here') as open")).toEqual([{ open: false }]);
    await expect(as(null, "select public.card_invite_profile('owner-card')")).rejects.toThrow(/permission denied/);

    await newUser(FRIEND, "friend@contacts.test", { via_card: "owner-card", saved_cards: ["third-card", "owner-card", "missing"] });
    const [{ meta }] = (await db.query<{ meta: Record<string, unknown> }>("select raw_user_meta_data as meta from auth.users where id = $1", [FRIEND])).rows;
    expect(meta).toEqual({});
    const mine = await as<{ slug: string; source: string }>(FRIEND, "select slug, source from public.my_contacts() order by slug");
    expect(mine).toEqual([
      { slug: "owner-card", source: "qr" },
      { slug: "third-card", source: "link" },
    ]);
  });

  it("refuses sign-up without a code or a real card", async () => {
    await expect(newUser("d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0", "x@contacts.test", { via_card: "nobody-here" })).rejects.toThrow(/access code is required/);
    await expect(newUser("d0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d1", "y@contacts.test", {})).rejects.toThrow(/access code is required/);
  });

  it("stops at 20 sign-ups per card", async () => {
    for (let i = 2; i <= 20; i++) {
      const id = `e0e0e0e0-e0e0-e0e0-e0e0-${String(i).padStart(12, "0")}`;
      await newUser(id, `card${i}@contacts.test`, { via_card: "owner-card" });
    }
    expect(await as(null, "select public.card_invite_open('owner-card') as open")).toEqual([{ open: false }]);
    await expect(newUser("e0e0e0e0-e0e0-e0e0-e0e0-000000000099", "late@contacts.test", { via_card: "owner-card" })).rejects.toThrow(/access code is required/);
    // An access code still works, and the card is still saved.
    await newUser("e0e0e0e0-e0e0-e0e0-e0e0-000000000098", "coded@contacts.test", { access_code: "contacts-code", via_card: "owner-card" });
    expect(await as("e0e0e0e0-e0e0-e0e0-e0e0-000000000098", "select slug from public.my_contacts()")).toEqual([{ slug: "owner-card" }]);
  });

  it("lets members keep, note and remove contacts, never their own card", async () => {
    expect(await as(OWNER, "select public.save_contact('owner-card') as ok")).toEqual([{ ok: false }]);
    expect(await as(OWNER, "select public.save_contact('third-card', 'qr') as ok")).toEqual([{ ok: true }]);
    expect(await as(OWNER, "select public.save_contact('third-card') as ok")).toEqual([{ ok: true }]); // twice is fine
    await as(OWNER, "select public.set_contact_note('third-card', '  Met at the fintech meetup ')");
    expect(await as(OWNER, "select slug, note, source from public.my_contacts()")).toEqual([
      { slug: "third-card", note: "Met at the fintech meetup", source: "qr" },
    ]);
    // Other people can't see or change it.
    expect(await as(BOB, "select * from public.my_contacts()")).toEqual([]);
    await expect(as(BOB, "select * from public.saved_contacts")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select public.save_contact('third-card')")).rejects.toThrow(/permission denied/);
    await as(OWNER, "select public.remove_contact('third-card')");
    expect(await as(OWNER, "select * from public.my_contacts()")).toEqual([]);
  });

  it("shows owners which members with a card saved them", async () => {
    // FRIEND saved owner-card but has no card yet, so they don't show.
    expect(await as<{ slug: string }>(OWNER, "select slug from public.who_saved_me()")).toEqual([]);
    await createProfile(FRIEND, "friend-card");
    const rows = await as<{ slug: string; saved_back: boolean }>(OWNER, "select slug, saved_back from public.who_saved_me()");
    expect(rows).toEqual([{ slug: "friend-card", saved_back: false }]);
    await as(OWNER, "select public.save_contact('friend-card')");
    expect(await as(OWNER, "select saved_back from public.who_saved_me()")).toEqual([{ saved_back: true }]);
    await expect(as(null, "select * from public.who_saved_me()")).rejects.toThrow(/permission denied/);
  });
});
