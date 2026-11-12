"use server";

import { revalidatePath } from "next/cache";
import { FUNDING_KINDS, FUNDING_REGIONS, FUNDING_STAGES, type FundingStatus } from "../funding";
import { createClient, getCurrentUser } from "../supabase/server";

/** Funding radar actions. The database refuses anyone who isn't an admin. */

type Result = { error?: string };
export type FundingFormState = { ok?: string; error?: string };

const done = () => revalidatePath("/admin/funding");
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function fundingSetStatus(id: string, status: FundingStatus): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  if (!FUNDING_STAGES.some((s) => s.value === status)) return { error: "That isn't a stage." };
  const { error } = await (await createClient()).rpc("admin_set_funding_status", { p_id: id, p_status: status });
  if (error) return { error: "Couldn't update that." };
  done();
  return {};
}

export async function fundingSetDetails(id: string, notes: string, deadline: string): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  if (deadline && !isDate(deadline)) return { error: "That deadline isn't a date." };
  const { error } = await (await createClient()).rpc("admin_set_funding_details", {
    p_id: id,
    p_notes: notes.slice(0, 4000),
    p_deadline: deadline || null,
  });
  if (error) return { error: "Couldn't save that." };
  done();
  return {};
}

export async function fundingDelete(id: string): Promise<Result> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const { error } = await (await createClient()).rpc("admin_delete_funding", { p_id: id });
  if (error) return { error: "Couldn't remove it." };
  done();
  return {};
}

/** Add an opportunity by hand. */
export async function fundingAdd(_: FundingFormState, formData: FormData): Promise<FundingFormState> {
  if (!(await getCurrentUser())) return { error: "Please log in again." };
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const name = get("name").slice(0, 160);
  const deadline = get("deadline");
  const link = get("link");
  const kind = get("kind");
  const region = get("region");
  const equity = get("equity");
  if (name.replace(/[^a-z0-9]/gi, "").length < 3) return { error: "Give it a name." };
  if (deadline && !isDate(deadline)) return { error: "That deadline isn't a date." };
  if (link && !/^https?:\/\//.test(link)) return { error: "The link should start with https://" };

  const { error } = await (await createClient()).rpc("admin_add_funding", {
    p_name: name,
    p_funder: get("funder").slice(0, 200),
    p_kind: FUNDING_KINDS.some((k) => k.value === kind) ? kind : "grant",
    p_amount: get("amount").slice(0, 160),
    p_equity_free: equity === "yes" ? true : equity === "no" ? false : null,
    p_deadline: deadline || null,
    p_region: (FUNDING_REGIONS as readonly string[]).includes(region) ? region : "Africa",
    p_link: link.slice(0, 500),
    p_eligibility: get("eligibility").slice(0, 1500),
    p_fit: get("fit").slice(0, 1500),
  });
  if (error) {
    console.error("admin_add_funding failed", error.code, error.message);
    if (error.code === "23505") return { error: "That one is already on the funding radar." };
    return { error: error.code === "42501" ? "You don't have access to this." : "Couldn't add it." };
  }
  done();
  return { ok: `Added ${name}.` };
}
