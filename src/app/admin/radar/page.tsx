import type { Metadata } from "next";
import { NotReady, PageTitle } from "@/components/admin/admin-ui";
import { RadarBoard } from "@/components/admin/radar-board";
import { lagosToday, type RadarEvent, type RadarPitch } from "@/lib/radar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Partner radar · Admin" };

export default async function AdminRadarPage() {
  const supabase = await createClient();
  const [events, pitch] = await Promise.all([supabase.rpc("admin_list_radar"), supabase.rpc("admin_get_radar_pitch")]);
  const ready = !events.error && !pitch.error;

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Partner radar">
        Lagos events and Nigerian online meetups found about two weeks ahead, so there&apos;s time to ask the organisers
        about Meetwell joining as a partner. The weekly search adds new finds every Monday.
      </PageTitle>

      {ready ? (
        <RadarBoard
          events={(events.data ?? []) as RadarEvent[]}
          pitch={((pitch.data ?? [])[0] as RadarPitch | undefined) ?? { pitch: "", offer: "", sender: "" }}
          today={lagosToday()}
        />
      ) : (
        <NotReady what="The partner radar" />
      )}
    </div>
  );
}
