"use server";

import { revalidatePath } from "next/cache";
import { audienceArgs, parseAudience } from "./campaigns";
import {
  sendCampaignEmail,
  sendInviteEmail,
  sendMentorApprovedEmail,
  sendMentoringEmail,
  sendPartnerAccessEmail,
  sendPublishCardEmail,
  sendSparkBetaEmail,
  sendSparkPausedEmail,
  sendWithdrawalSentEmail,
} from "../email";
import { refundPayment, sendTransfer } from "../payments/paystack";
import { isSparkOn } from "../spark";
import { createClient, getCurrentUser } from "../supabase/server";
import { parseOutreachList, xHandle } from "../outreach";
import { emailSchema } from "../validation";

export type InviteState = { ok?: boolean; error?: string };

/**
 * Invite one person from the waiting list: create (or reuse) their personal
 * access code, then email it. The database refuses anyone who isn't an admin.
 */
export async function inviteFromWaitlist(_: InviteState, formData: FormData): Promise<InviteState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Invalid email." };
  const fullName = String(formData.get("fullName") ?? "").slice(0, 80) || null;

  const supabase = await createClient();
  const { data: code, error } = await supabase.rpc("admin_invite", { p_email: email.data });
  if (error || typeof code !== "string") {
    console.error("admin_invite failed", error?.code, error?.message);
    return { error: error?.code === "42501" ? "You don't have access to invites." : "Couldn't create the invite." };
  }

  const sent = await sendInviteEmail(email.data, fullName, code);
  revalidatePath("/admin", "layout");
  return sent ? { ok: true } : { error: `Code created (${code}) but the email didn't send. Try again.` };
}

export type AnnounceState = { sent?: number; failed?: number; remaining?: number; error?: string };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Each one-off announcement: its key in announcements_sent and how it is sent.
const ANNOUNCEMENTS = {
  spark_beta: sendSparkBetaEmail,
  mentoring: sendMentoringEmail,
  // Only to people whose card is still a draft (the database picks them).
  publish_card: sendPublishCardEmail,
  // Only to people who turned Spark on (the database picks them).
  spark_paused: sendSparkPausedEmail,
} satisfies Record<string, (to: string, fullName: string | null) => Promise<boolean>>;

export type AnnouncementKind = keyof typeof ANNOUNCEMENTS;

/**
 * Email an announcement to members who haven't had it yet, in paced batches
 * (Resend rate limit, ~60s function limit). Each person is recorded only after
 * their email went out, so a failed send is retried on the next click. The
 * database refuses anyone who isn't an admin.
 */
export async function sendAnnouncement(kind: AnnouncementKind): Promise<AnnounceState> {
  const sendOne = ANNOUNCEMENTS[kind];
  if (!sendOne) return { error: "Unknown announcement." };
  if (kind === "spark_beta" && !(await isSparkOn())) return { error: "Spark is paused, so this email can't be sent yet." };
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_announcement_recipients", { p_kind: kind, p_limit: 40 });
  if (error) {
    console.error("admin_announcement_recipients failed", error.code, error.message);
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't load the members." };
  }

  const started = Date.now();
  let sent = 0;
  let failed = 0;
  for (const r of (data ?? []) as { email: string; full_name: string | null }[]) {
    if (Date.now() - started > 40_000) break;
    if (await sendOne(r.email, r.full_name)) {
      await supabase.rpc("admin_mark_announced", { p_kind: kind, p_email: r.email });
      sent++;
    } else {
      failed++;
    }
    await pause(600);
  }

  const { data: status } = await supabase.rpc("admin_announcement_status", { p_kind: kind });
  const remaining = (status as { remaining: number }[] | null)?.[0]?.remaining;
  revalidatePath("/admin", "layout");
  return { sent, failed, remaining };
}

/**
 * New email page: send the chosen email to the next batch of people the
 * filters match (same pacing as announcements). `params` are the page's
 * address values, checked again here. Each person is logged after their
 * email went out, so a failed send is retried on the next click.
 */
export async function sendCampaign(params: Record<string, string>): Promise<AnnounceState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const audience = parseAudience({ ...params, role: params.role ?? "all" });
  if (audience.template === "spark_beta" && !(await isSparkOn())) return { error: "Spark is paused, so this email can't be sent yet." };
  const args = audienceArgs(audience);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_email_audience", { ...args, p_limit: 40 });
  if (error) {
    console.error("admin_email_audience failed", error.code, error.message);
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't load the people for this email." };
  }

  const started = Date.now();
  let sent = 0;
  let failed = 0;
  for (const r of (data ?? []) as { email: string; full_name: string | null }[]) {
    if (Date.now() - started > 40_000) break;
    const result = await sendCampaignEmail(audience.template, r.email, r.full_name);
    if (result.ok) {
      sent++;
      const { error: logError } = await supabase.rpc("admin_record_email_send", {
        p_template: audience.template,
        p_email: r.email,
        p_resend_id: result.id,
      });
      // If a send can't be logged, stop: carrying on could email the same people twice.
      if (logError) {
        console.error("admin_record_email_send failed", logError.code, logError.message);
        return { sent, failed, error: "Sending stopped: a send couldn't be saved. Check the database SQL has been run." };
      }
    } else {
      failed++;
    }
    await pause(600);
  }

  const { data: remaining } = await supabase.rpc("admin_email_audience_count", args);
  revalidatePath("/admin/announcements", "layout");
  return { sent, failed, remaining: typeof remaining === "number" ? remaining : undefined };
}

/** New email page: send the chosen email to yourself only (not logged). */
export async function sendCampaignTest(template: string): Promise<AdminFormState> {
  const user = await getCurrentUser();
  if (!user?.email) return { error: "Please log in again." };
  const { data: isAdmin } = await (await createClient()).rpc("is_admin");
  if (!isAdmin) return { error: "You don't have access to this." };
  const { template: checked } = parseAudience({ template });
  return (await sendCampaignEmail(checked, user.email, "Rasheed")).ok
    ? { ok: `Test sent to ${user.email}.` }
    : { error: "The test didn't send. Is RESEND_API_KEY set?" };
}

export type AdminFormState = { ok?: string; error?: string };

/** Open (or extend) a test conversation between a member and a mentor. */
export async function adminOpenConversation(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const member = emailSchema.safeParse(formData.get("member"));
  const mentor = emailSchema.safeParse(formData.get("mentor"));
  if (!member.success || !mentor.success) return { error: "Enter both email addresses." };
  const days = Math.min(Math.max(Number(formData.get("days")) || 30, 1), 365);
  const { error } = await (await createClient()).rpc("admin_open_conversation", {
    p_member_email: member.data,
    p_mentor_email: mentor.data,
    p_days: days,
  });
  if (error) {
    if (error.code === "22023") return { error: error.message };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't open the conversation." };
  }
  revalidatePath("/admin", "layout");
  return { ok: `Conversation open for ${days} days.` };
}

export async function adminResolveReport(reportId: number, action: "dismiss" | "pause"): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_resolve_report", { p_report: reportId, p_action: action });
  if (error) return { error: "Couldn't update the report." };
  revalidatePath("/admin", "layout");
  return {};
}

export async function adminSetPaused(email: string, paused: boolean): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_messaging_paused", { p_email: email, p_paused: paused });
  if (error) return { error: error.code === "22023" ? error.message : "Couldn't update." };
  revalidatePath("/admin", "layout");
  return {};
}

/** Approve, reject or pause a mentor. Approval sends them a short email. */
export async function adminDecideMentor(email: string, status: "approved" | "rejected" | "paused"): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { data, error } = await (await createClient()).rpc("admin_decide_mentor", { p_email: email, p_status: status });
  if (error) return { error: error.code === "22023" ? error.message : "Couldn't update." };
  const row = (data as { email: string; first_name: string }[] | null)?.[0];
  if (status === "approved" && row) await sendMentorApprovedEmail(row.email, row.first_name || null);
  revalidatePath("/admin", "layout");
  return {};
}

const nairaText = (kobo: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(kobo / 100);

/** Approve a withdrawal and send it with a Paystack Transfer. */
export async function adminApproveWithdrawal(id: number): Promise<{ error?: string; message?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const secret = process.env.CRON_SECRET;
  if (!secret) return { error: "CRON_SECRET isn't set." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_approve_withdrawal", { p_id: id });
  const w = (data as { reference: string; amount_kobo: number; recipient_code: string; email: string; first_name: string }[] | null)?.[0];
  if (error || !w) return { error: error?.code === "22023" ? error.message : "Couldn't approve." };

  let result: "success" | "processing" | "failed" = "failed";
  let code: string | null = null;
  try {
    const t = await sendTransfer({ amountKobo: w.amount_kobo, recipientCode: w.recipient_code, reference: w.reference });
    code = t.transfer_code;
    result = t.status === "success" ? "success" : t.status === "failed" ? "failed" : "processing";
  } catch (err) {
    console.error("Paystack transfer failed", w.reference, err);
  }
  await supabase.rpc("record_transfer_result", { p_token: secret, p_reference: w.reference, p_result: result, p_transfer_code: code });
  revalidatePath("/admin", "layout");

  if (result === "failed") {
    return { error: "Paystack didn't accept the transfer, so the money went back to their wallet. Check Transfers is on in Paystack." };
  }
  const { data: bank } = await supabase.rpc("admin_list_withdrawals");
  const row = ((bank ?? []) as { reference: string; bank_name: string }[]).find((x) => x.reference === w.reference);
  await sendWithdrawalSentEmail(w.email, w.first_name || null, { amount: nairaText(w.amount_kobo), bank: row?.bank_name ?? "bank" });
  return { message: result === "success" ? "Sent." : "Sent to Paystack. It will show as paid once the bank confirms." };
}

export async function adminRejectWithdrawal(id: number, note: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_reject_withdrawal", { p_id: id, p_note: note });
  if (error) return { error: error.code === "22023" ? error.message : "Couldn't reject." };
  revalidatePath("/admin", "layout");
  return {};
}

/** Refund a subscription in full through Paystack, then take the mentor's share back and end access. */
export async function adminRefundSubscription(reference: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  try {
    await refundPayment(reference);
  } catch (err) {
    console.error("Paystack refund failed", reference, err);
    return { error: "Paystack didn't accept the refund. You can refund it in the Paystack dashboard, then try again." };
  }
  const { error } = await (await createClient()).rpc("admin_mark_refunded", { p_reference: reference });
  if (error) return { error: "Refunded in Paystack, but couldn't update Meetwell. Tell your developer." };
  revalidatePath("/admin", "layout");
  return {};
}

export type OutreachStatus = "to_contact" | "contacted" | "replied" | "declined";

/** Add someone found on X to the outreach list, with their own access code. */
export async function adminAddOutreach(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const firstName = String(formData.get("firstName") ?? "").trim().slice(0, 40);
  const handle = xHandle(String(formData.get("handle") ?? ""));
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  if (!handle) return { error: "That doesn't look like an X handle or profile link." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_outreach", { p_first_name: firstName, p_handle: handle, p_note: note });
  if (error) {
    console.error("admin_add_outreach failed", error.code, error.message);
    if (error.code === "23505") return { error: `@${handle} is already on the list.` };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't add them." };
  }
  revalidatePath("/admin", "layout");
  return { ok: `Added ${firstName || "them"} (@${handle}).` };
}

/** Add a pasted list (one person per line, up to 100). People already on the list are skipped. */
export async function adminAddOutreachList(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { entries, bad } = parseOutreachList(String(formData.get("list") ?? "").slice(0, 20_000));
  if (entries.length === 0) return { error: "No X handles or profile links found. Put one person on each line." };
  if (entries.length > 100) return { error: `That's ${entries.length} people. Add up to 100 at a time.` };

  const supabase = await createClient();
  let added = 0;
  let skipped = 0;
  for (const e of entries) {
    const { error } = await supabase.rpc("admin_add_outreach", { p_first_name: e.firstName, p_handle: e.handle, p_note: e.note });
    if (!error) added++;
    else if (error.code === "23505") skipped++;
    else {
      console.error("admin_add_outreach failed", error.code, error.message);
      if (error.code === "42501") return { error: "You don't have access to this." };
      skipped++;
    }
  }
  revalidatePath("/admin", "layout");
  const parts = [`Added ${added}.`];
  if (skipped) parts.push(`${skipped} already on the list.`);
  if (bad.length) parts.push(`${bad.length} line${bad.length === 1 ? "" : "s"} had no handle: ${bad.slice(0, 3).join("; ")}${bad.length > 3 ? "…" : ""}`);
  return { ok: parts.join(" ") };
}

export async function adminSetOutreachName(id: number, firstName: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_outreach_name", { p_id: id, p_first_name: firstName.slice(0, 40) });
  if (error) return { error: "Couldn't save the name." };
  revalidatePath("/admin", "layout");
  return {};
}

export async function adminSetOutreachStatus(id: number, status: OutreachStatus): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_outreach_status", { p_id: id, p_status: status });
  if (error) return { error: "Couldn't update that." };
  revalidatePath("/admin", "layout");
  return {};
}

export async function adminDeleteOutreach(id: number): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_delete_outreach", { p_id: id });
  if (error) return { error: "Couldn't remove them." };
  revalidatePath("/admin", "layout");
  return {};
}

/** Turn a partner's name into its link name: "Think UX!" → "think-ux". */
function partnerSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** Add a partner (an event platform). Its invite link is /join?partner=<slug>. */
export async function adminCreatePartner(_: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const slug = partnerSlug(String(formData.get("slug") ?? "") || name);
  if (!name) return { error: "Add the partner's name." };
  if (slug.length < 3) return { error: "The link name needs at least 3 letters or numbers." };

  const { error } = await (await createClient()).rpc("admin_create_partner", { p_name: name, p_slug: slug });
  if (error) {
    console.error("admin_create_partner failed", error.code, error.message);
    if (error.code === "23505") return { error: `The link name "${slug}" is taken. Try another.` };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't add the partner." };
  }
  revalidatePath("/admin", "layout");
  return { ok: `Added ${name}.` };
}

/** Let someone on the partner's team see its page. They need a Meetwell account first. */
export async function adminAddPartnerMember(partnerId: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: "That doesn't look like an email address." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_add_partner_member", {
    p_partner: partnerId,
    p_email: parsed.data,
  });
  if (error) return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't add them." };
  if (data !== true) return { error: "No Meetwell account with that email. Ask them to sign up through the link first." };
  revalidatePath("/admin", "layout");

  // Tell them, with a link to the page.
  const { data: partners } = await supabase.rpc("admin_list_partners");
  const name = ((partners ?? []) as { id: string; name: string }[]).find((p) => p.id === partnerId)?.name;
  const emailed = name ? await sendPartnerAccessEmail(parsed.data, null, name) : false;
  return {
    ok: emailed
      ? `${parsed.data} can now see the partner page. We emailed them.`
      : `${parsed.data} can now see the partner page. The email didn't send, so let them know.`,
  };
}

export async function adminSetPartnerActive(partnerId: string, active: boolean): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_partner_active", { p_partner: partnerId, p_active: active });
  if (error) return { error: "Couldn't update that." };
  revalidatePath("/admin", "layout");
  return {};
}

/** Add an event page for a partner. Its page is /e/<slug>. */
export async function adminCreateEvent(partnerSlugValue: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const slug = partnerSlug(String(formData.get("slug") ?? "") || name);
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "") || null;
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!name) return { error: "Add the event's name." };
  if (slug.length < 3) return { error: "The link name needs at least 3 letters or numbers." };
  if (!isDate(startsOn)) return { error: "Pick the date it starts." };
  if (endsOn && (!isDate(endsOn) || endsOn < startsOn)) return { error: "The end date can't be before the start." };

  const { error } = await (await createClient()).rpc("admin_create_event", {
    p_partner_slug: partnerSlugValue,
    p_slug: slug,
    p_name: name,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_venue: String(formData.get("venue") ?? "").trim().slice(0, 120) || null,
    p_about: String(formData.get("about") ?? "").trim().slice(0, 600) || null,
  });
  if (error) {
    console.error("admin_create_event failed", error.code, error.message);
    if (error.code === "23505") return { error: `The link name "${slug}" is taken. Try another.` };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't add the event." };
  }
  revalidatePath("/admin", "layout");
  return { ok: `Added ${name}. Now add its speakers.` };
}

/** Add a speaker to an event by their account email or card link. */
export async function adminAddEventSpeaker(eventSlug: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const who = String(formData.get("who") ?? "").trim().slice(0, 200);
  if (!who) return { error: "Enter their email or card link." };
  const { data, error } = await (await createClient()).rpc("admin_add_event_speaker", { p_event_slug: eventSlug, p_who: who });
  if (error) {
    if (error.message.includes("No card found")) return { error: "No card found for that email or link. They need a Meetwell card first." };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't add them." };
  }
  revalidatePath("/admin", "layout");
  revalidatePath(`/e/${eventSlug}`);
  return { ok: `Added ${data as string}.` };
}

export async function adminRemoveEventSpeaker(eventSlug: string, profileSlug: string): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_remove_event_speaker", { p_event_slug: eventSlug, p_profile_slug: profileSlug });
  if (error) return { error: "Couldn't remove them." };
  revalidatePath("/admin", "layout");
  revalidatePath(`/e/${eventSlug}`);
  return {};
}

export async function adminSetEventActive(eventSlug: string, active: boolean): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_event_active", { p_event_slug: eventSlug, p_active: active });
  if (error) return { error: "Couldn't update that." };
  revalidatePath("/admin", "layout");
  revalidatePath(`/e/${eventSlug}`);
  return {};
}

/** After paying a partner by bank transfer, record it (in naira). Up to what's ready to pay. */
export async function adminRecordPartnerPayout(partnerId: string, _: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const naira = Number(String(formData.get("amount") ?? "").replace(/[^0-9.]/g, ""));
  const note = String(formData.get("note") ?? "").trim().slice(0, 200);
  if (!Number.isFinite(naira) || naira <= 0) return { error: "Enter the amount you paid, in naira." };

  const { error } = await (await createClient()).rpc("admin_record_partner_payout", {
    p_partner: partnerId,
    p_amount_kobo: Math.round(naira * 100),
    p_note: note,
  });
  if (error) {
    if (error.message.includes("More than is ready")) return { error: "That's more than is ready to pay." };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't record the payout." };
  }
  revalidatePath("/admin", "layout");
  return { ok: "Payout recorded." };
}

/** Launch Spark (or pause it again) from the admin Overview. Every page is rebuilt so it shows or hides Spark at once. */
export async function adminSetSparkEnabled(enabled: boolean): Promise<{ error?: string }> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_set_spark_enabled", { p_enabled: enabled });
  if (error) return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't change Spark." };
  revalidatePath("/", "layout");
  return {};
}
