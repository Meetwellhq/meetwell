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
  await db.query("insert into auth.users (id, email) values ($1, 'a@test'), ($2, 'b@test')", [ALICE, BOB]);
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
    expect(await as(null, "select public.join_waitlist('  New@Person.test ') as ok")).toEqual([{ ok: true }]);
    // A duplicate is ignored and reports false, so no second email is sent.
    expect(await as(BOB, "select public.join_waitlist('new@person.test') as ok")).toEqual([{ ok: false }]);
    await expect(as(null, "select * from public.waitlist")).rejects.toThrow(/permission denied/);
    await expect(as(BOB, "select * from public.waitlist")).rejects.toThrow(/permission denied/);
    await expect(as(null, "insert into public.waitlist (email) values ('x@y.test')")).rejects.toThrow(/permission denied/);
    const rows = (await db.query<{ email: string }>("select email from public.waitlist")).rows;
    expect(rows).toEqual([{ email: "new@person.test" }]);
  });
});
