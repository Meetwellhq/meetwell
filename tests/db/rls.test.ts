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
  // Spark is paused in production (20261129000000_spark_switch.sql); the Spark tests below run with it on.
  await db.exec("update public.internal_settings set value = 'true' where key = 'spark_enabled'");
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

    // A day later (and in a new month, so the free one is back): due again, and can get the next person.
    await db.exec("update public.matches set created_at = public.spark_month_start() - interval '1 day'");
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

  it("stops at 1 free match a month (Lagos time), and last month doesn't count", async () => {
    const used = async () =>
      (await db.query<{ n: number }>(`select public.spark_matches_this_month('${JUNIOR}') as n`)).rows[0].n;
    const due = async () =>
      (await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`)).map((d) => d.email);
    const ids = (await db.query<{ id: string }>(
      "select id from public.profiles where slug not in ('junior', 'sparse') order by slug limit 1",
    )).rows.map((r) => r.id);
    expect(ids).toHaveLength(1);
    const insertOne = (when: string) =>
      db.query(
        `insert into public.matches (user_id, matched_profile_id, reason, created_at)
         select $1, id, 'test', ${when} from unnest($2::uuid[]) as id`,
        [JUNIOR, ids],
      );
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);

    // A match last month doesn't count, so the member is due.
    await insertOne("public.spark_month_start() - interval '1 day'");
    expect(await used()).toBe(0);
    expect(await due()).toContain("junior@test");

    // One this month (more than 20 hours ago): no second until next month.
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);
    await insertOne("least(public.spark_month_start(), now() - interval '1 day')");
    if ((await used()) < 1) return; // first day of the month: the backdated match fell into last month
    expect(await due()).not.toContain("junior@test");
    const [{ id: second }] = (await db.query<{ id: string }>("select id from public.profiles where slug = 'sparse'")).rows;
    const recorded = await as<{ m: string | null }>(
      null,
      `select public.record_match('${SECRET}', '${JUNIOR}', '${second}', 'second') as m`,
    );
    expect(recorded[0].m).toBeNull();

    // The member sees their own count; the helpers stay locked.
    expect((await as<{ n: number }>(JUNIOR, "select public.my_matches_this_month() as n"))[0].n).toBe(1);
    await expect(as(JUNIOR, "select public.spark_free_per_month()")).rejects.toThrow(/permission denied/);
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

  it("can record the Mentoring announcement", async () => {
    expect((await as<{ ok: boolean }>(ALICE, "select public.admin_mark_announced('mentoring', 'x@test') as ok"))[0].ok).toBe(true);
  });

  it("sends 'publish your card' only to confirmed members whose card is a draft", async () => {
    // Make one confirmed member's card a draft for this test.
    const [{ id: draftId, status: was }] = (await db.query<{ id: string; status: string }>(
      `update public.profiles p set status = 'draft' from auth.users u, public.profiles old
       where p.id = (select p2.id from public.profiles p2 join auth.users u2 on u2.id = p2.user_id
                     where u2.email_confirmed_at is not null and not public.is_admin_user(u2.id) and p2.status <> 'draft'
                     order by p2.created_at limit 1)
         and u.id = p.user_id and old.id = p.id
       returning p.id, old.status::text as status`,
    )).rows;
    const [{ drafts }] = (await db.query<{ drafts: number }>(
      `select count(*)::int as drafts from auth.users u join public.profiles p on p.user_id = u.id
       where p.status = 'draft' and u.email_confirmed_at is not null and not public.is_admin_user(u.id)`,
    )).rows;
    expect(drafts).toBeGreaterThan(0);
    const recipients = await as<{ email: string }>(ALICE, "select email from public.admin_announcement_recipients('publish_card', 100)");
    expect(recipients).toHaveLength(drafts);
    const statuses = (await db.query<{ status: string | null }>(
      `select p.status::text as status from auth.users u left join public.profiles p on p.user_id = u.id
       where u.email = any($1)`,
      [recipients.map((r) => r.email)],
    )).rows.map((r) => r.status);
    expect(new Set(statuses)).toEqual(new Set(["draft"]));
    const [status] = await as<{ sent: number; remaining: number }>(ALICE, "select * from public.admin_announcement_status('publish_card')");
    expect(status).toEqual({ sent: 0, remaining: drafts });
    await db.query("update public.profiles set status = $2 where id = $1", [draftId, was]);
  });
});

describe("New email (audience and send log)", () => {
  const audience = (args: string) =>
    as<{ email: string }>(ALICE, `select email from public.admin_email_audience(${args})`).then((r) => r.map((x) => x.email));

  it("is admin-only and checks the filters", async () => {
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ALICE]);
    await expect(as(BOB, "select * from public.admin_email_audience('publish_card')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_email_audience('publish_card')")).rejects.toThrow(/permission denied/);
    await expect(as(BOB, "select public.admin_record_email_send('publish_card', 'x@test')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_email_results()")).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, "select * from public.email_sends")).rejects.toThrow(/permission denied/);
    await expect(audience("'nope'")).rejects.toThrow(/Unknown email or filter/);
    await expect(audience("'publish_card', 'boss'")).rejects.toThrow(/Unknown email or filter/);
  });

  it("filters by card, sends each email once, and allows a resend after the chosen days", async () => {
    const [{ id: draftId, status: was }] = (await db.query<{ id: string; status: string }>(
      `update public.profiles p set status = 'draft' from public.profiles old
       where p.id = (select p2.id from public.profiles p2 join auth.users u2 on u2.id = p2.user_id
                     where u2.email_confirmed_at is not null and not public.is_admin_user(u2.id) and p2.status <> 'draft'
                     order by p2.created_at limit 1)
         and old.id = p.id
       returning p.id, old.status::text as status`,
    )).rows;
    const [{ email: draftEmail }] = (await db.query<{ email: string }>(
      "select u.email from auth.users u join public.profiles p on p.user_id = u.id where p.id = $1", [draftId],
    )).rows;

    const drafts = await audience("'publish_card', 'all', 'draft'");
    expect(drafts).toContain(draftEmail);
    const statuses = (await db.query<{ status: string }>(
      "select p.status::text as status from auth.users u join public.profiles p on p.user_id = u.id where u.email = any($1)", [drafts],
    )).rows.map((r) => r.status);
    expect(new Set(statuses)).toEqual(new Set(["draft"]));
    const [{ n }] = await as<{ n: number }>(ALICE, "select public.admin_email_audience_count('publish_card', 'all', 'draft') as n");
    expect(n).toBe(drafts.length);
    const noCard = await audience("'publish_card', 'all', 'none'");
    const withCard = (await db.query("select 1 from auth.users u join public.profiles p on p.user_id = u.id where u.email = any($1)", [noCard])).rows;
    expect(withCard).toHaveLength(0);

    // Sent once: gone from the list, and from the count.
    await as(ALICE, `select public.admin_record_email_send('publish_card', '${draftEmail}')`);
    expect(await audience("'publish_card', 'all', 'draft'")).not.toContain(draftEmail);
    // Another email still reaches them.
    expect(await audience("'add_photo', 'all', 'draft'")).toContain(draftEmail);
    // Resend after 14 days: not yet, then yes once the send is older.
    expect(await audience("'publish_card', 'all', 'draft', false, false, null, 14")).not.toContain(draftEmail);
    await db.query("update public.email_sends set sent_at = now() - interval '20 days' where email = $1", [draftEmail]);
    expect(await audience("'publish_card', 'all', 'draft', false, false, null, 14")).toContain(draftEmail);
    expect(await audience("'publish_card', 'all', 'draft'")).not.toContain(draftEmail); // "never again" still holds

    const history = await as<{ template: string; people: number }>(ALICE, "select template, people from public.admin_email_results()");
    expect(history).toEqual(expect.arrayContaining([{ template: "publish_card", people: 1 }]));

    await db.query("delete from public.email_sends where email = $1", [draftEmail]);
    await db.query("update public.profiles set status = $2 where id = $1", [draftId, was]);
  });

  it("records Resend's events and shows results, including who did what the email asked", async () => {
    const SECRET = "test-secret-that-is-long-enough-1234567890";
    // Two sends of "Add a photo": one person has a photo now, one doesn't.
    const [withPhoto, without] = (await db.query<{ email: string }>(
      `select u.email from auth.users u join public.profiles p on p.user_id = u.id
       where not public.is_admin_user(u.id) order by (p.avatar_url is null), u.email limit 2`,
    )).rows.map((r) => r.email);
    await db.query("update public.profiles set avatar_url = 'https://example.test/a.jpg' where user_id = (select id from auth.users where email = $1)", [withPhoto]);
    const [{ was }] = (await db.query<{ was: string | null }>(
      "select p.avatar_url as was from public.profiles p join auth.users u on u.id = p.user_id where u.email = $1", [without],
    )).rows;
    await db.query("update public.profiles set avatar_url = null where user_id = (select id from auth.users where email = $1)", [without]);

    await as(ALICE, `select public.admin_record_email_send('add_photo', '${withPhoto}', 're_1')`);
    await as(ALICE, `select public.admin_record_email_send('add_photo', '${without}', 're_2')`);

    // Events need the cron secret; unknown ids and types are ignored.
    await expect(as(null, "select public.record_email_event('wrong', 're_1', 'delivered')")).rejects.toThrow();
    const event = (id: string, type: string) =>
      as<{ ok: boolean }>(null, `select public.record_email_event('${SECRET}', '${id}', '${type}') as ok`).then((r) => r[0].ok);
    expect(await event("re_1", "delivered")).toBe(true);
    expect(await event("re_2", "delivered")).toBe(true);
    expect(await event("re_1", "clicked")).toBe(true); // a click counts as an open too
    expect(await event("re_2", "bounced")).toBe(true);
    expect(await event("re_missing", "clicked")).toBe(false);
    expect(await event("re_1", "spam")).toBe(false);

    const [row] = await as<Record<string, number | string>>(
      ALICE, "select people, delivered, opened, clicked, bounced, acted from public.admin_email_results() where template = 'add_photo'",
    );
    expect(row).toEqual({ people: 2, delivered: 2, opened: 1, clicked: 1, bounced: 1, acted: 1 });

    await db.query("delete from public.email_sends where resend_id in ('re_1', 're_2')");
    await db.query("update public.profiles set avatar_url = $2 where user_id = (select id from auth.users where email = $1)", [without, was]);
  });

  it("counts older one-off announcements as already sent", async () => {
    const all = await audience("'mentoring'");
    expect(all.length).toBeGreaterThan(0);
    await db.query("insert into public.announcements_sent (kind, email) values ('mentoring', $1) on conflict do nothing", [all[0]]);
    expect(await audience("'mentoring'")).not.toContain(all[0]);
    await db.query("delete from public.announcements_sent where kind = 'mentoring' and email = $1", [all[0]]);
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

  it("uses a credit only after the free one in a month", async () => {
    const ids = (await db.query<{ id: string }>(
      "select id from public.profiles where slug not in ('junior', 'senior') order by slug limit 1",
    )).rows.map((r) => r.id);
    const [{ id: seniorId }] = (await db.query<{ id: string }>("select id from public.profiles where slug = 'senior'")).rows;
    const due = async () =>
      (await as<{ email: string }>(null, `select email from public.matching_due_users('${SECRET}', 50)`)).map((d) => d.email);
    await db.query("delete from public.matches where user_id = $1", [JUNIOR]);

    // The free one this month, a day ago: with credits the member is still due.
    await db.query(
      `insert into public.matches (user_id, matched_profile_id, reason, created_at)
       select $1, id, 'free', greatest(public.spark_month_start(), now() - interval '1 day') from unnest($2::uuid[]) as id`,
      [JUNIOR, ids],
    );
    await db.query("update public.matches set created_at = now() - interval '1 day' where user_id = $1 and created_at > now() - interval '20 hours'", [JUNIOR]);
    const freeUsed = (await db.query<{ n: number }>(`select public.spark_matches_this_month('${JUNIOR}') as n`)).rows[0].n;
    if (freeUsed < 1) return; // first day of the month: the backdated match fell into last month
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

describe("mentors and mentees on the admin Users page", () => {
  const JUNIOR = "55555555-5555-5555-5555-555555555555"; // 1 year
  const SENIOR = "66666666-6666-6666-6666-666666666666"; // 4 years

  it("shows each person's years and mentoring status", async () => {
    await db.query("insert into public.mentor_settings (user_id, status) values ($1, 'approved')", [SENIOR]);
    const rows = await as<{ email: string; experience_years: number | null; mentor_status: string | null }>(
      "11111111-1111-1111-1111-111111111111",
      "select email, experience_years, mentor_status from public.admin_list_members()",
    );
    const byEmail = (e: string) => rows.find((r) => r.email === e);
    expect(byEmail("junior@test")).toMatchObject({ experience_years: 1, mentor_status: null });
    expect(byEmail("senior@test")).toMatchObject({ experience_years: 4, mentor_status: "approved" });
    expect(byEmail("invitee@test")?.experience_years).toBeNull(); // no card
    await expect(as(JUNIOR, "select * from public.admin_list_members()")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_list_members()")).rejects.toThrow(/permission denied/);
    await db.query("delete from public.mentor_settings where user_id = $1", [SENIOR]);
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

describe("log-in help", () => {
  it("says whether an email has an account, ignoring case and spaces, never for admins", async () => {
    expect(await as(null, "select public.account_exists(' Owner@Contacts.TEST ') as e")).toEqual([{ e: true }]);
    expect(await as(null, "select public.account_exists('nobody@nowhere.test') as e")).toEqual([{ e: false }]);
    // ALICE is an admin by now (see invites).
    expect(await as(null, "select public.account_exists('a@test') as e")).toEqual([{ e: false }]);
  });
});

describe("free messages with mentors", () => {
  const SENIOR = "66666666-6666-6666-6666-666666666666"; // approved mentor (see mentor subscriptions)
  const ENGINEER = "77777777-7777-7777-7777-777777777777"; // 3 years

  it("lets a mentor go free, and members start a conversation without paying", async () => {
    await expect(as(SENIOR, "select public.set_mentor_offer(150000, true)")).rejects.toThrow(/between/);
    await as(SENIOR, "select public.set_mentor_offer(0, true)");
    expect(await as(null, "select price_kobo from public.mentor_offer('senior')")).toEqual([{ price_kobo: 0 }]);

    // No Paystack checkout for a free mentor.
    await expect(as(ENGINEER, "select * from public.start_subscription_purchase('senior')")).rejects.toThrow(/paid messages/);

    const [{ id }] = await as<{ id: number }>(ENGINEER, "select public.start_free_conversation('senior') as id");
    const [conv] = (
      await db.query<{ member_id: string; open: boolean }>(
        "select member_id, access_until > now() + interval '29 days' as open from public.conversations where id = $1",
        [id],
      )
    ).rows;
    expect(conv).toEqual({ member_id: ENGINEER, open: true });
    // Still no money moved.
    expect(
      (await db.query("select 1 from public.payments where user_id = $1 and amount_kobo = 0", [ENGINEER])).rows,
    ).toEqual([]);

    await expect(as(SENIOR, "select public.start_free_conversation('senior')")).rejects.toThrow(/That is you/);
    await expect(as(null, "select public.start_free_conversation('senior')")).rejects.toThrow(/permission denied/);
  });

  it("stops free conversations once the mentor charges again", async () => {
    await as(SENIOR, "select public.set_mentor_offer(500000, true)");
    await expect(as(ENGINEER, "select public.start_free_conversation('senior')")).rejects.toThrow(/free messages/);
  });
});

describe("waiting list status", () => {
  it("shows a used code with no account as not signed up, and Resend makes a fresh code", async () => {
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ALICE]);
    await db.query("select public.join_waitlist('forwarded@test', 'Fola Forwarded')");
    const [{ code }] = await as<{ code: string }>(ALICE, "select public.admin_invite('forwarded@test') as code");
    // Someone else signs up with Fola's code.
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'someone-else@test', $1)", [
      { access_code: code },
    ]);
    const [row] = await as<{ signed_up: boolean; code_used: boolean; confirmed: boolean }>(
      ALICE,
      "select signed_up, code_used, confirmed from public.admin_list_waitlist() where email = 'forwarded@test'",
    );
    expect(row).toEqual({ signed_up: false, code_used: true, confirmed: false });
    const [{ code: fresh }] = await as<{ code: string }>(ALICE, "select public.admin_invite('forwarded@test') as code");
    expect(fresh).not.toBe(code);
    const [after] = await as<{ code_used: boolean }>(ALICE, "select code_used from public.admin_list_waitlist() where email = 'forwarded@test'");
    expect(after.code_used).toBe(false);
  });
});

describe("partners", () => {
  const SPEAKER = "5a5a5a5a-5a5a-5a5a-5a5a-5a5a5a5a5a5a";
  const DRAFTER = "5b5b5b5b-5b5b-5b5b-5b5b-5b5b5b5b5b5b";
  const TEAM = "5c5c5c5c-5c5c-5c5c-5c5c-5c5c5c5c5c5c";
  const newUser = (id: string, email: string, meta: Record<string, unknown>) =>
    db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [id, email, meta]);
  let partner = "";

  beforeAll(async () => {
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ALICE]);
    const [{ id }] = await as<{ id: string }>(ALICE, "select public.admin_create_partner('ThinkUX', 'ThinkUX') as id");
    partner = id;
  });

  it("only admins can create and list partners", async () => {
    await expect(as(BOB, "select public.admin_create_partner('Fake', 'fake')")).rejects.toThrow(/Not allowed/);
    await expect(as(BOB, "select * from public.admin_list_partners()")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_list_partners()")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.partners")).rejects.toThrow(/permission denied/);
  });

  it("lets someone sign up through a partner link without a code, and records it", async () => {
    expect(await as(null, "select public.partner_invite_name(' THINKUX ') as n")).toEqual([{ n: "ThinkUX" }]);
    expect(await as(null, "select public.partner_invite_name('nobody') as n")).toEqual([{ n: null }]);
    await newUser(SPEAKER, "speaker@partner.test", { via_partner: "thinkux", experience_years: "9" });
    await newUser(DRAFTER, "drafter@partner.test", { via_partner: "thinkux", experience_years: "9" });
    const rows = (await db.query("select user_id from public.partner_signups where partner_id = $1 order by user_id", [partner])).rows;
    expect(rows).toEqual([{ user_id: SPEAKER }, { user_id: DRAFTER }]);
    const [{ meta }] = (await db.query<{ meta: Record<string, unknown> }>("select raw_user_meta_data as meta from auth.users where id = $1", [SPEAKER])).rows;
    expect(meta).not.toHaveProperty("via_partner");
  });

  it("refuses a partner link for people under 4 years, and keeps the years for onboarding", async () => {
    await expect(newUser("5f5f5f5f-5f5f-5f5f-5f5f-5f5f5f5f5f5f", "junior@partner.test", { via_partner: "thinkux", experience_years: "2" })).rejects.toThrow(/access code is required/);
    await expect(newUser("5f5f5f5f-5f5f-5f5f-5f5f-5f5f5f5f5f50", "noyears@partner.test", { via_partner: "thinkux" })).rejects.toThrow(/access code is required/);
    const [{ meta }] = (await db.query<{ meta: Record<string, unknown> }>("select raw_user_meta_data as meta from auth.users where id = $1", [SPEAKER])).rows;
    expect(meta.experience_years).toBe("9");
  });

  it("refuses a paused or full partner link", async () => {
    await as(ALICE, "select public.admin_set_partner_active($1, false)", [partner]);
    await expect(newUser("5d5d5d5d-5d5d-5d5d-5d5d-5d5d5d5d5d5d", "late@partner.test", { via_partner: "thinkux", experience_years: "9" })).rejects.toThrow(/access code is required/);
    await as(ALICE, "select public.admin_set_partner_active($1, true)", [partner]);
    await db.query("update public.partners set max_signups = 2 where id = $1", [partner]);
    await expect(newUser("5e5e5e5e-5e5e-5e5e-5e5e-5e5e5e5e5e5e", "full@partner.test", { via_partner: "thinkux", experience_years: "9" })).rejects.toThrow(/access code is required/);
    await db.query("update public.partners set max_signups = 200 where id = $1", [partner]);
  });

  it("shows the partner's team who joined, with public details only once published", async () => {
    await createProfile(SPEAKER, "partner-speaker");
    await db.query("insert into public.mentor_settings (user_id, status) values ($1, 'approved')", [SPEAKER]);
    await db.exec("insert into public.access_codes (code, max_uses) values ('PARTNER-TEAM', 1)");
    await newUser(TEAM, "team@partner.test", { access_code: "PARTNER-TEAM" });
    expect(await as(ALICE, "select public.admin_add_partner_member($1, 'nobody@partner.test') as ok", [partner])).toEqual([{ ok: false }]);
    expect(await as(ALICE, "select public.admin_add_partner_member($1, ' TEAM@partner.test ') as ok", [partner])).toEqual([{ ok: true }]);

    await expect(as(BOB, "select * from public.partner_people($1)", [partner])).rejects.toThrow(/Not allowed/);
    expect(await as(BOB, "select * from public.my_partners()")).toEqual([]);
    const [mine] = await as<{ name: string; signups: number }>(TEAM, "select name, signups from public.my_partners()");
    expect(mine).toEqual({ name: "ThinkUX", signups: 2 });

    const people = await as<{ full_name: string | null; published: boolean; mentor: boolean; slug: string | null }>(
      TEAM,
      "select full_name, published, mentor, slug from public.partner_people($1) order by published desc",
      [partner],
    );
    expect(people).toEqual([
      { full_name: "Test Person", published: true, mentor: true, slug: "partner-speaker" },
      { full_name: null, published: false, mentor: false, slug: null },
    ]);

    const [row] = await as<{ signups: number; published: number; mentors: number; team: string[] }>(
      ALICE,
      "select signups, published, mentors, team from public.admin_list_partners() where slug = 'thinkux'",
    );
    expect(row).toEqual({ signups: 2, published: 1, mentors: 1, team: ["team@partner.test"] });
  });

  it("lets only admins see a partner's full list", async () => {
    await expect(as(TEAM, "select * from public.admin_partner_people($1)", [partner])).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_partner_people($1)", [partner])).rejects.toThrow(/permission denied/);
    const rows = await as<{ email: string; mentor: boolean; published: boolean }>(
      ALICE,
      "select email, mentor, published from public.admin_partner_people($1) order by email",
      [partner],
    );
    expect(rows).toEqual([
      { email: "drafter@partner.test", mentor: false, published: false },
      { email: "speaker@partner.test", mentor: true, published: true },
    ]);
  });

  it("gives the partner 10% of its mentors' payments for 12 months, and takes it back on a refund", async () => {
    const pay = async (ref: string, amount: number) => {
      await db.query(
        `insert into public.payments (reference, user_id, amount_kobo, currency, status, kind, mentor_id, days, mentor_share_kobo)
         values ($1, $2, $3, 'NGN', 'pending', 'subscription', $4, 30, $5)`,
        [ref, DRAFTER, amount, SPEAKER, Math.round(amount * 0.8)],
      );
      await db.query("update public.payments set status = 'success', paid_at = now() where reference = $1", [ref]);
    };
    const money = async () =>
      (await as<{ earned_kobo: number; paid_kobo: number; available_kobo: number; pending_kobo: number }>(
        ALICE,
        "select * from public.admin_partner_money($1)",
        [partner],
      ))[0];

    await pay("mw_partner_1", 500000);
    await db.query("update public.payments set status = 'success' where reference = 'mw_partner_1'"); // no change: no second share
    expect(await money()).toEqual({ earned_kobo: 50000, paid_kobo: 0, available_kobo: 0, pending_kobo: 50000 });

    // Meetwell keeps 10% of this payment: 20% minus the partner's 10%.
    const [{ m }] = await as<{ m: { revenue_total_kobo: number } }>(ALICE, "select public.admin_metrics() as m");
    const before = Number(m.revenue_total_kobo);
    await pay("mw_partner_2", 200000);
    const [{ m: after }] = await as<{ m: { revenue_total_kobo: number } }>(ALICE, "select public.admin_metrics() as m");
    expect(Number(after.revenue_total_kobo) - before).toBe(20000);

    // A refund takes the partner's share back.
    await as(ALICE, "select public.admin_mark_refunded('mw_partner_2')");
    expect((await money()).earned_kobo).toBe(50000);

    // Ready to pay after 7 days; payouts can't go over that.
    await db.query("update public.partner_ledger set available_at = now() - interval '1 day' where kind = 'earning'");
    expect(await money()).toEqual({ earned_kobo: 50000, paid_kobo: 0, available_kobo: 50000, pending_kobo: 0 });
    await expect(as(ALICE, "select public.admin_record_partner_payout($1, 60000, 'too much')", [partner])).rejects.toThrow(/More than is ready/);
    await expect(as(BOB, "select public.admin_record_partner_payout($1, 100, 'x')", [partner])).rejects.toThrow(/Not allowed/);
    await as(ALICE, "select public.admin_record_partner_payout($1, 50000, 'Bank transfer, October')", [partner]);
    expect(await money()).toEqual({ earned_kobo: 50000, paid_kobo: 50000, available_kobo: 0, pending_kobo: 0 });

    // After the mentor's first 12 months, the partner earns nothing more.
    await db.query("update public.partner_signups set created_at = now() - interval '13 months' where user_id = $1", [SPEAKER]);
    await pay("mw_partner_3", 500000);
    expect((await money()).earned_kobo).toBe(50000);

    // The partner's team sees totals only; outsiders see nothing.
    const [mine] = await as<{ earned_kobo: number }>(TEAM, "select earned_kobo from public.my_partner_money($1)", [partner]);
    expect(mine.earned_kobo).toBe(50000);
    await expect(as(BOB, "select * from public.my_partner_money($1)", [partner])).rejects.toThrow(/Not allowed/);
    await expect(as(TEAM, "select * from public.admin_partner_ledger($1)", [partner])).rejects.toThrow(/Not allowed/);
    await expect(as(TEAM, "select * from public.partner_ledger")).rejects.toThrow(/permission denied/);
    const ledger = await as<{ kind: string; amount_kobo: number }>(ALICE, "select kind, amount_kobo from public.admin_partner_ledger($1)", [partner]);
    expect(ledger.map((l) => l.kind).sort()).toEqual(["earning", "earning", "payout", "refund"]);
  });
});

describe("partner event pages", () => {
  // The ThinkUX speaker from "partners" (card partner-speaker, approved mentor) is reused.
  const TEAM = "5c5c5c5c-5c5c-5c5c-5c5c-5c5c5c5c5c5c"; // on ThinkUX's team
  const JUNIOR = "55555555-5555-5555-5555-555555555555"; // 1 year
  let techcabal = "";

  beforeAll(async () => {
    const [{ id }] = await as<{ id: string }>(ALICE, "select public.admin_create_partner('TechCabal', 'techcabal') as id");
    techcabal = id;
  });

  it("lets only admins create events and add speakers", async () => {
    await expect(as(BOB, "select public.admin_create_event('techcabal', 'tc-summit', 'Summit', '2026-11-20')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select public.admin_create_event('techcabal', 'tc-summit', 'Summit', '2026-11-20')")).rejects.toThrow(/permission denied/);
    await as(ALICE, "select public.admin_create_event('techcabal', 'tc-summit', 'TechCabal Summit', '2026-11-20', null, 'Landmark, Lagos', 'Two days of talks.')");
    await as(ALICE, "select public.admin_create_event('thinkux', 'thinkux-day', 'ThinkUX Day', '2026-12-05')");
    await expect(as(ALICE, "select public.admin_create_event('techcabal', 'Bad Slug!', 'X', '2026-11-20')")).rejects.toThrow(/check constraint/);

    await expect(as(BOB, "select public.admin_add_event_speaker('tc-summit', 'partner-speaker')")).rejects.toThrow(/Not allowed/);
    await expect(as(ALICE, "select public.admin_add_event_speaker('tc-summit', 'nobody@x.test')")).rejects.toThrow(/No card found/);
    // By card link (full URL works too) or by account email.
    expect(await as(ALICE, "select public.admin_add_event_speaker('tc-summit', 'https://meetwell.me/p/partner-speaker') as n")).toEqual([{ n: "Test Person" }]);
    expect(await as(ALICE, "select public.admin_add_event_speaker('thinkux-day', 'SPEAKER@partner.test') as n")).toEqual([{ n: "Test Person" }]);
    await expect(as(null, "select * from public.partner_events")).rejects.toThrow(/permission denied/);
    await expect(as(null, "select * from public.event_speakers")).rejects.toThrow(/permission denied/);

    // Editing: admins only; the link name stays; ends before it starts is refused.
    await expect(as(BOB, "select public.admin_update_event('thinkux-day', 'Hacked', '2026-12-05')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select public.admin_update_event('thinkux-day', 'Hacked', '2026-12-05')")).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, "select public.admin_update_event('no-such-event', 'X', '2026-12-05')")).rejects.toThrow(/No such event/);
    await expect(as(ALICE, "select public.admin_update_event('thinkux-day', 'X', '2026-12-05', '2026-12-01')")).rejects.toThrow(/check constraint/);
    await as(ALICE, "select public.admin_update_event('thinkux-day', ' ThinkUX Day 2026 ', '2026-12-06', '2026-12-07', 'Lagos', '  ')");
    expect(
      (await db.query("select name, starts_on::text, ends_on::text, venue, about from public.partner_events where slug = 'thinkux-day'")).rows,
    ).toEqual([{ name: "ThinkUX Day 2026", starts_on: "2026-12-06", ends_on: "2026-12-07", venue: "Lagos", about: null }]);
    await as(ALICE, "select public.admin_update_event('thinkux-day', 'ThinkUX Day', '2026-12-05')");
  });

  it("shows the public page with each speaker's card and mentoring price", async () => {
    const [event] = await as<Record<string, unknown>>(null, "select name, venue, partner_name from public.public_event('TC-SUMMIT')");
    expect(event).toEqual({ name: "TechCabal Summit", venue: "Landmark, Lagos", partner_name: "TechCabal" });
    const speakers = await as<{ slug: string; price_kobo: number | null }>(null, "select slug, price_kobo from public.public_event_speakers('tc-summit')");
    expect(speakers).toEqual([{ slug: "partner-speaker", price_kobo: 500000 }]);

    await as(ALICE, "select public.admin_set_event_active('tc-summit', false)");
    expect(await as(null, "select * from public.public_event('tc-summit')")).toEqual([]);
    expect(await as(null, "select * from public.public_event_speakers('tc-summit')")).toEqual([]);
    await as(ALICE, "select public.admin_set_event_active('tc-summit', true)");
  });

  it("credits the event's partner for a payment started from its page, only for its speakers", async () => {
    const money = async (p: string) =>
      (await as<{ earned_kobo: number }>(ALICE, "select earned_kobo from public.admin_partner_money($1)", [p]))[0].earned_kobo;
    const [{ id: thinkux }] = (await db.query<{ id: string }>("select id from public.partners where slug = 'thinkux'")).rows;
    const thinkuxBefore = await money(thinkux);

    // Started from the TechCabal Summit page: credited to TechCabal, though the mentor joined through ThinkUX.
    const [p] = await as<{ reference: string }>(JUNIOR, "select * from public.start_subscription_purchase('partner-speaker', 'tc-summit')");
    const [{ event }] = (await db.query<{ event: string | null }>(
      "select e.slug as event from public.payments y left join public.partner_events e on e.id = y.event_id where y.reference = $1", [p.reference],
    )).rows;
    expect(event).toBe("tc-summit");
    await db.query("update public.payments set status = 'success', paid_at = now() where reference = $1", [p.reference]);
    expect(await money(techcabal)).toBe(50000);
    expect(await money(thinkux)).toBe(thinkuxBefore);

    // An event the mentor doesn't speak at, or a made-up one, isn't kept.
    await db.query("delete from public.event_speakers where event_id = (select id from public.partner_events where slug = 'thinkux-day')");
    for (const ev of ["thinkux-day", "no-such-event"]) {
      const [q] = await as<{ reference: string }>(JUNIOR, `select * from public.start_subscription_purchase('partner-speaker', '${ev}')`);
      const [{ event_id }] = (await db.query<{ event_id: string | null }>("select event_id from public.payments where reference = $1", [q.reference])).rows;
      expect(event_id).toBeNull();
    }
    // The old one-argument call still works.
    expect(await as(JUNIOR, "select reference from public.start_subscription_purchase('partner-speaker')")).toHaveLength(1);

    // A refund takes the event partner's share back.
    await as(ALICE, `select public.admin_mark_refunded('${p.reference}')`);
    expect(await money(techcabal)).toBe(0);

    const [row] = await as<{ payments: number; revenue_kobo: number; speakers: { slug: string; mentor: boolean }[] }>(
      ALICE, "select payments, revenue_kobo, speakers from public.admin_partner_events('techcabal')",
    );
    expect(row.payments).toBe(0); // refunded, so no longer counted
    expect(row.speakers).toEqual([{ slug: "partner-speaker", full_name: "Test Person", status: "published", mentor: true }]);
  });

  it("pays the event's partner for 12 months after the event, then follows the sign-up rule", async () => {
    const money = async (p: string) =>
      (await as<{ earned_kobo: number }>(ALICE, "select earned_kobo from public.admin_partner_money($1)", [p]))[0].earned_kobo;
    const [{ id: thinkux }] = (await db.query<{ id: string }>("select id from public.partners where slug = 'thinkux'")).rows;
    // An old TechCabal event (ended over a year ago) where the ThinkUX speaker spoke.
    await as(ALICE, "select public.admin_create_event('techcabal', 'tc-old', 'Old Summit', (current_date - interval '14 months')::date, (current_date - interval '13 months')::date)");
    await as(ALICE, "select public.admin_add_event_speaker('tc-old', 'partner-speaker')");
    // The mentor joined through ThinkUX recently (an earlier test moved it back 13 months).
    const speaker = "(select user_id from public.profiles where slug = 'partner-speaker')";
    const [{ joined }] = (await db.query<{ joined: string }>(`select created_at::text as joined from public.partner_signups where user_id = ${speaker}`)).rows;
    await db.query(`update public.partner_signups set created_at = now() - interval '1 month' where user_id = ${speaker}`);
    const tcBefore = await money(techcabal);
    const tuxBefore = await money(thinkux);

    const [p] = await as<{ reference: string }>(JUNIOR, "select * from public.start_subscription_purchase('partner-speaker', 'tc-old')");
    await db.query("update public.payments set status = 'success', paid_at = now() where reference = $1", [p.reference]);
    // Still tagged with the event, but TechCabal's 12 months are over: ThinkUX (the mentor's sign-up partner) earns.
    expect((await db.query("select e.slug from public.payments y join public.partner_events e on e.id = y.event_id where y.reference = $1", [p.reference])).rows).toEqual([{ slug: "tc-old" }]);
    expect(await money(techcabal)).toBe(tcBefore);
    expect(await money(thinkux)).toBe(tuxBefore + 50000);
    await as(ALICE, `select public.admin_mark_refunded('${p.reference}')`);
    await db.query(`update public.partner_signups set created_at = $1 where user_id = ${speaker}`, [joined]);
  });

  it("tags a free mentor's conversation with the event it started from", async () => {
    const owner = "(select user_id from public.profiles where slug = 'partner-speaker')";
    const [{ price }] = (await db.query<{ price: number }>(`select price_kobo as price from public.mentor_settings where user_id = ${owner}`)).rows;
    await db.query(`update public.mentor_settings set price_kobo = 0 where user_id = ${owner}`);

    // From the TechCabal Summit page (the mentor speaks there): tagged, and counted for admins.
    const [{ id }] = await as<{ id: number }>(JUNIOR, "select public.start_free_conversation('partner-speaker', 'tc-summit') as id");
    const eventOf = async () =>
      (await db.query<{ event: string | null }>(
        "select e.slug as event from public.conversations c left join public.partner_events e on e.id = c.event_id where c.id = $1", [id],
      )).rows[0].event;
    expect(await eventOf()).toBe("tc-summit");
    const [row] = await as<{ free_conversations: number }>(ALICE, "select free_conversations from public.admin_partner_events('techcabal')");
    expect(row.free_conversations).toBe(1);
    // Starting again from another page keeps the first event; the old one-argument call still works.
    await as(JUNIOR, "select public.start_free_conversation('partner-speaker', 'thinkux-day')");
    await as(JUNIOR, "select public.start_free_conversation('partner-speaker')");
    expect(await eventOf()).toBe("tc-summit");

    await db.query(`update public.mentor_settings set price_kobo = $1 where user_id = ${owner}`, [price]);
  });

  it("adds a speaker with the details for their email, and says if they were already on", async () => {
    await as(ALICE, "select public.admin_create_event('techcabal', 'tc-mail', 'Mail Summit', '2026-11-30', null, 'Lagos')");
    await expect(as(BOB, "select * from public.admin_add_event_speaker_details('tc-mail', 'partner-speaker')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select * from public.admin_add_event_speaker_details('tc-mail', 'partner-speaker')")).rejects.toThrow(/permission denied/);
    const [first] = await as<Record<string, unknown>>(ALICE, "select * from public.admin_add_event_speaker_details('tc-mail', 'partner-speaker')");
    expect(first).toMatchObject({
      full_name: "Test Person", email: "speaker@partner.test", profile_slug: "partner-speaker", added: true,
      event_name: "Mail Summit", venue: "Lagos", partner_name: "TechCabal",
    });
    const [again] = await as<{ added: boolean }>(ALICE, "select added from public.admin_add_event_speaker_details('tc-mail', 'SPEAKER@partner.test')");
    expect(again.added).toBe(false);
    await as(ALICE, "select public.admin_delete_event('tc-mail')");
  });

  it("deletes an event only while nothing has come from it", async () => {
    await as(ALICE, "select public.admin_create_event('techcabal', 'tc-mistake', 'Typo Event', '2026-11-30')");
    await as(ALICE, "select public.admin_add_event_speaker('tc-mistake', 'partner-speaker')");
    await expect(as(BOB, "select public.admin_delete_event('tc-mistake')")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select public.admin_delete_event('tc-mistake')")).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, "select public.admin_delete_event('no-such-event')")).rejects.toThrow(/No such event/);
    // Events with payments or conversations are kept (tc-summit had a payment, tc-old too).
    await expect(as(ALICE, "select public.admin_delete_event('tc-summit')")).rejects.toThrow(/has history/);
    await as(ALICE, "select public.admin_delete_event('tc-mistake')");
    expect((await db.query("select 1 from public.partner_events where slug = 'tc-mistake'")).rows).toEqual([]);
    expect(
      (await db.query("select 1 from public.event_speakers s left join public.partner_events e on e.id = s.event_id where e.id is null")).rows,
    ).toEqual([]);
  });

  it("shows a partner's team its own events only", async () => {
    const mine = await as<{ name: string; conversations: number }>(TEAM, "select name, conversations from public.my_partner_events()");
    expect(mine.map((e) => e.name)).toEqual(["ThinkUX Day"]);
    expect(mine[0].conversations).toBe(0); // the free conversation above came from TechCabal's event
    expect(await as(BOB, "select * from public.my_partner_events()")).toEqual([]);
    await expect(as(null, "select * from public.my_partner_events()")).rejects.toThrow(/permission denied/);
  });
});

describe("Spark switch", () => {
  const ADMIN_S = "5a5a0000-0000-0000-0000-00000000000a";
  const CARD_S = "5a5a0000-0000-0000-0000-00000000000b";
  beforeAll(async () => {
    await db.exec("insert into public.access_codes (code, max_uses) values ('SPARK-CODE', 2)");
    for (const [id, email] of [[ADMIN_S, "sparkadmin@test"], [CARD_S, "sparkcard@test"]]) {
      await db.query("insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), $3)", [id, email, { access_code: "SPARK-CODE" }]);
    }
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ADMIN_S]);
    // Title, organisation, bio, field, years = 5 card items; plus a city (Spark only).
    await db.query(
      "insert into public.profiles (user_id, slug, full_name, professional_title, organization, bio, field, experience_years, city) values ($1, 'spark-card', 'Sam', 'Designer', 'Studio', 'Hi', 'product_design', 5, 'Lagos')",
      [CARD_S],
    );
  });

  it("is readable by anyone, and only admins can flip it", async () => {
    expect(await as(null, "select public.spark_enabled() as on")).toEqual([{ on: true }]);
    await expect(as(BOB, "select public.admin_set_spark_enabled(false)")).rejects.toThrow(/Not allowed/);
    await expect(as(null, "select public.admin_set_spark_enabled(false)")).rejects.toThrow(/permission denied/);
    await expect(as(BOB, "select * from public.admin_spark_progress()")).rejects.toThrow(/Not allowed/);
    await as(ADMIN_S, "select public.admin_set_spark_enabled(false)");
    expect(await as(null, "select public.spark_enabled() as on")).toEqual([{ on: false }]);
    const [p] = await as<{ enabled: boolean; users: number; mentors: number }>(ADMIN_S, "select * from public.admin_spark_progress()");
    expect(p.enabled).toBe(false);
    expect(p.users).toBeGreaterThan(0);
    expect(p.mentors).toBeGreaterThan(0);
  });

  it("scores the 6 important items while off, and all 10 when on", async () => {
    const score = async () =>
      (await db.query<{ s: number }>("select public.profile_completeness(p) as s from public.profiles p where p.slug = 'spark-card'")).rows[0].s;
    expect(await score()).toBe(50); // title, bio, years = 3 of 6 (organisation, field and city don't count)
    await db.query(
      "insert into public.social_links (profile_id, platform, url) select id, 'instagram', 'https://instagram.com/sam' from public.profiles where slug = 'spark-card'",
    );
    expect(await score()).toBe(67); // a social link counts: 4 of 6
    await as(ADMIN_S, "select public.admin_set_spark_enabled(true)");
    expect(await score()).toBe(70); // 7 of 10: organisation, the link, field and city count again
  });
});

describe("Spark paused announcement", () => {
  it("goes only to members who turned Spark on, once each", async () => {
    await db.query("insert into public.admins (user_id) values ($1) on conflict do nothing", [ALICE]);
    await db.query("update public.profiles set matching_opt_in = false");
    await db.query("update public.profiles set matching_opt_in = true where slug = 'spark-card'");
    const recipients = await as<{ email: string }>(ALICE, "select email from public.admin_announcement_recipients('spark_paused', 100)");
    expect(recipients.map((r) => r.email)).toEqual(["sparkcard@test"]);
    await as(ALICE, "select public.admin_mark_announced('spark_paused', 'sparkcard@test')");
    const [status] = await as<{ sent: number; remaining: number }>(ALICE, "select * from public.admin_announcement_status('spark_paused')");
    expect(status).toEqual({ sent: 1, remaining: 0 });
  });
});

describe("saved your card back emails", () => {
  const AMA = "5b5b0000-0000-0000-0000-0000000000a1";
  const KOFI = "5b5b0000-0000-0000-0000-0000000000a2";
  const SECRET = "test-secret-that-is-long-enough-1234567890";
  const claim = () => as<{ email: string; savers: { full_name: string; slug: string }[] }>(null, `select email, savers from public.claim_saveback_emails('${SECRET}', 40)`);

  beforeAll(async () => {
    await db.exec("insert into public.access_codes (code, max_uses) values ('SAVEBACK-CODE', 2)");
    for (const [id, email] of [[AMA, "ama@saveback.test"], [KOFI, "kofi@saveback.test"]]) {
      await db.query("insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values ($1, $2, now(), $3)", [id, email, { access_code: "SAVEBACK-CODE" }]);
    }
    await createProfile(AMA, "ama-card");
    await createProfile(KOFI, "kofi-card");
    await db.query("insert into public.internal_settings (key, value) values ('cron_secret', $1) on conflict (key) do update set value = excluded.value", [SECRET]);
  });

  it("tells the first saver once, when the other person saves them back", async () => {
    await as(AMA, "select public.save_contact('kofi-card')");
    expect(await claim()).toEqual([]); // one-way so far
    await as(KOFI, "select public.save_contact('ama-card')");
    await as(KOFI, "select public.save_contact('ama-card')"); // twice: still one notice
    const rows = await claim();
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("ama@saveback.test");
    expect(rows[0].savers.map((s) => s.slug)).toEqual(["kofi-card"]);
    expect(await claim()).toEqual([]); // sent once
    await expect(as(null, "select * from public.claim_saveback_emails('wrong', 40)")).rejects.toThrow(/Not allowed/);
    await expect(as(KOFI, "select * from public.saveback_notices")).rejects.toThrow(/permission denied/);
  });

  it("skips people who turned the emails off", async () => {
    await as(KOFI, "select public.set_saveback_emails(false)");
    expect(await as(KOFI, "select public.my_saveback_emails() as on")).toEqual([{ on: false }]);
    await as(AMA, "select public.remove_contact('kofi-card')").catch(() => {});
    await db.query("delete from public.saveback_notices");
    await db.query("delete from public.saved_contacts where user_id in ($1, $2)", [AMA, KOFI]);
    await as(KOFI, "select public.save_contact('ama-card')");
    await as(AMA, "select public.save_contact('kofi-card')"); // Ama saved back: Kofi would be told, but he's off
    expect(await claim()).toEqual([]);
    const [{ token }] = (await db.query<{ token: string }>("select token from public.email_prefs where user_id = $1", [AMA])).rows;
    expect(await as(null, "select public.unsubscribe_saveback_emails($1) as ok", [token])).toEqual([{ ok: true }]);
    expect(await as(AMA, "select public.my_saveback_emails() as on")).toEqual([{ on: false }]);
  });
});
