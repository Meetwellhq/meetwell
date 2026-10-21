"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { adminApproveWithdrawal, adminDecideMentor, adminRefundSubscription, adminRejectWithdrawal } from "@/lib/admin/actions";

export function MentorDecision({ email, status }: { email: string; status: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (next: "approved" | "rejected" | "paused") =>
    start(async () => {
      const res = await adminDecideMentor(email, next);
      toast(res.error ?? { approved: "Approved and emailed.", rejected: "Not approved.", paused: "Paused." }[next], res.error ? "error" : undefined);
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" && (
        <Button size="sm" onClick={() => run("approved")} loading={pending}>
          {status === "paused" ? "Unpause" : "Approve"}
        </Button>
      )}
      {status === "applied" && (
        <Button size="sm" variant="secondary" onClick={() => run("rejected")} loading={pending}>
          Not now
        </Button>
      )}
      {status === "approved" && (
        <Button size="sm" variant="ghost" onClick={() => run("paused")} loading={pending}>
          Pause
        </Button>
      )}
    </div>
  );
}

export function WithdrawalActions({ id, amount, to }: { id: number; amount: string; to: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => setConfirm(true)}>
        Approve and send
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>
        Reject
      </Button>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`Send ${amount}?`} description={`Paystack will transfer ${amount} to ${to}. This can't be undone.`}>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await adminApproveWithdrawal(id);
                setConfirm(false);
                toast(res.error ?? res.message ?? "Sent.", res.error ? "error" : undefined);
              })
            }
          >
            Send {amount}
          </Button>
        </div>
      </Dialog>

      <Dialog open={rejecting} onClose={() => setRejecting(false)} title="Reject this withdrawal?" description="The money goes back to their available balance. Say why, so they can fix it.">
        <div className="flex flex-col gap-4">
          <Field label="Reason" optional>
            {({ id: fid }) => <Input id={fid} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The account name doesn't match your card" />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await adminRejectWithdrawal(id, note);
                  setRejecting(false);
                  toast(res.error ?? "Rejected. The money is back in their wallet.", res.error ? "error" : undefined);
                })
              }
            >
              Reject
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export function RefundButton({ reference, amount, member }: { reference: string; amount: string; member: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
        Refund
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Refund ${amount}?`}
        description={`${member} gets the full amount back through Paystack, their messages end, and the mentor's share comes out of their wallet.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await adminRefundSubscription(reference);
                setConfirm(false);
                toast(res.error ?? "Refunded.", res.error ? "error" : undefined);
              })
            }
          >
            Refund {amount}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
