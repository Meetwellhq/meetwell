"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { deleteAccount, deleteProfile, setProfilePublished } from "@/lib/profiles/actions";

export function PublishButton({ published }: { published: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);

  const run = (publish: boolean) =>
    start(async () => {
      const res = await setProfilePublished(publish);
      if (!res.ok) {
        toast(res.error ?? "Something went wrong.", "error");
        return;
      }
      setConfirm(false);
      toast(publish ? "Your card is live." : "Your card is now offline.");
      router.refresh();
    });

  if (!published) {
    return (
      <Button onClick={() => run(true)} loading={pending}>
        Publish card
      </Button>
    );
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setConfirm(true)}>
        Unpublish
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Take your card offline?"
        description="Anyone who opens your link or scans your QR code will see that the card is unavailable. You can publish it again any time — the link and QR code stay the same."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => run(false)} loading={pending}>Unpublish</Button>
        </div>
      </Dialog>
    </>
  );
}

export function DangerZone() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<"profile" | "account" | null>(null);
  const [typed, setTyped] = useState("");

  const run = () =>
    start(async () => {
      const res = dialog === "account" ? await deleteAccount() : await deleteProfile();
      // On success these actions redirect; we only get here on failure.
      if (res && !res.ok) toast(res.error ?? "Something went wrong.", "error");
    });

  const close = () => {
    setDialog(null);
    setTyped("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="font-medium">Delete card</p>
          <p className="text-sm text-ink-2">Removes your profile, contact details, photo and stats. Your account stays.</p>
        </div>
        <Button variant="secondary" className="text-danger" onClick={() => setDialog("profile")}>Delete card</Button>
      </div>
      <div className="flex flex-col justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-medium">Delete account</p>
          <p className="text-sm text-ink-2">Permanently deletes your account and everything in it.</p>
        </div>
        <Button variant="danger" onClick={() => setDialog("account")}>Delete account</Button>
      </div>

      <Dialog
        open={dialog !== null}
        onClose={close}
        title={dialog === "account" ? "Delete your account?" : "Delete your card?"}
        description={
          <>
            This can&apos;t be undone. Your public link and QR code will stop working immediately.
            {dialog === "profile" && " You can create a new card afterwards, but it may need a different link."}
          </>
        }
      >
        <label className="text-sm font-medium" htmlFor="confirm-delete">
          Type <span className="font-mono">DELETE</span> to confirm
        </label>
        <input
          id="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mt-1.5 h-11 w-full rounded-xl border border-border-strong px-3.5 focus:border-danger focus:outline-none"
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="danger" disabled={typed !== "DELETE"} loading={pending} onClick={run}>
            {dialog === "account" ? "Delete account" : "Delete card"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
