import { date, Stats } from "@/components/admin/admin-ui";
import { AddOutreach, CopyMessageButton, EditableName, OpenOnX, OutreachStatusPicker, RemoveOutreach } from "@/components/admin/outreach-admin";
import { Badge, EmptyState } from "@/components/ui/misc";
import type { OutreachStatus } from "@/lib/admin/actions";
import { inviteLink, outreachMessage } from "@/lib/outreach";

export type OutreachRow = {
  id: number;
  first_name: string | null;
  x_handle: string;
  note: string | null;
  access_code: string | null;
  status: OutreachStatus;
  contacted_at: string | null;
  replied_at: string | null;
  created_at: string;
  joined: boolean;
};

/** Numbers, the add form and the list of people on the outreach page. */
export function OutreachList({ rows, site }: { rows: OutreachRow[]; site: string }) {
  const contacted = rows.filter((r) => r.status !== "to_contact").length;
  const replied = rows.filter((r) => r.status === "replied").length;
  const joined = rows.filter((r) => r.joined).length;
  const pct = (n: number) => (contacted ? `${Math.round((n / contacted) * 100)}% of messaged` : undefined);

  return (
    <>
      <Stats
        items={[
          { label: "On the list", value: rows.length },
          { label: "Messaged", value: contacted },
          { label: "Replied", value: replied, note: pct(replied) },
          { label: "Signed up", value: joined, note: pct(joined) },
        ]}
      />
      <AddOutreach />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState title="No one on the list yet" description="Add someone you'd like to invite from X." />
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {rows.map((r) => {
            const link = r.access_code ? inviteLink(site, r.access_code) : site;
            return (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <EditableName id={r.id} name={r.first_name} />
                      <span className="text-sm text-ink-2">@{r.x_handle}</span>
                      {r.joined && <Badge tone="success">Signed up</Badge>}
                    </p>
                    {r.note && <p className="mt-0.5 text-sm text-ink-2">{r.note}</p>}
                    <p className="mt-1 text-xs text-ink-3">
                      Added {date(r.created_at)}
                      {r.contacted_at && <> · Messaged {date(r.contacted_at)}</>}
                      {r.replied_at && <> · Replied {date(r.replied_at)}</>}
                    </p>
                  </div>
                  <RemoveOutreach id={r.id} name={r.first_name ?? `@${r.x_handle}`} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyMessageButton message={outreachMessage(r.first_name, link)} />
                  <OpenOnX handle={r.x_handle} />
                  <div className="sm:ml-auto">
                    <OutreachStatusPicker id={r.id} status={r.status} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
