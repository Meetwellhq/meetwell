"use client";

import { ArrowLeft, ArrowUpRight, Flag, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { publicProfilePath, SUPPORT_EMAIL } from "@/lib/config";
import { markConversationRead, reportMessage, sendMessage, setBlocked } from "@/lib/messaging/actions";
import type { ConversationRow, MessageRow } from "@/lib/messaging/types";

const MAX = 2000;
const REFRESH_MS = 8000;

const time = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

function LockedNotice({ conversation }: { conversation: ConversationRow }) {
  const name = conversation.other_name.split(" ")[0];
  switch (conversation.locked) {
    case "ended":
      return (
        <>
          This conversation has ended. Your messages are still here to read.
          {conversation.role === "member" && conversation.other_slug && (
            <>
              {" "}
              <Link href={`/subscribe/${conversation.other_slug}`} className="font-medium underline">
                Renew for 30 days
              </Link>{" "}
              to keep talking.
            </>
          )}
        </>
      );
    case "blocked":
      return conversation.blocked_by_me ? (
        <>You blocked {name}. Unblock them to send messages again.</>
      ) : (
        <>You can&apos;t send messages in this conversation.</>
      );
    case "paused":
      return (
        <>
          Your messaging is paused while we look at a report. Questions? Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </>
      );
    case "member_first":
      return <>{name} writes first. You&apos;ll be able to reply once they do.</>;
    default:
      return null;
  }
}

export function Thread({
  conversation,
  messages,
  justPaid = false,
}: {
  conversation: ConversationRow;
  messages: MessageRow[];
  justPaid?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [blocking, startBlocking] = useTransition();
  const [reporting, setReporting] = useState<MessageRow | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const id = Number(conversation.id);
  const lastId = messages.at(-1)?.id;

  // Mark as read and scroll down whenever new messages arrive.
  useEffect(() => {
    markConversationRead(id);
    bottom.current?.scrollIntoView({ block: "end" });
  }, [id, lastId]);

  // Check for new messages every few seconds while the page is open.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  const send = () =>
    startSending(async () => {
      setError(null);
      const res = await sendMessage(id, draft);
      if (res.error) setError(res.error);
      else {
        setDraft("");
        router.refresh();
      }
    });

  const toggleBlock = (blocked: boolean) =>
    startBlocking(async () => {
      const res = await setBlocked(id, blocked);
      setConfirmBlock(false);
      if (res.error) toast(res.error, "error");
      else {
        toast(blocked ? "Blocked." : "Unblocked.");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* Phones only: the list is beside the conversation from laptops up. */}
          <Link href="/dashboard/messages" aria-label="All messages" className="-ml-2 rounded-full p-2 text-ink-2 hover:bg-surface-2 lg:hidden">
            <ArrowLeft className="size-5" />
          </Link>
          <Avatar name={conversation.other_name} src={conversation.other_avatar} className="size-10 shrink-0 text-sm" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{conversation.other_name}</p>
            {conversation.other_title && <p className="truncate text-sm text-ink-2">{conversation.other_title}</p>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {conversation.other_slug && (
            <a
              href={publicProfilePath(conversation.other_slug)}
              target="_blank"
              rel="noopener"
              className="hidden items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-ink-2 hover:bg-surface-2 sm:inline-flex"
            >
              Card <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          )}
          {conversation.blocked_by_me ? (
            <Button variant="ghost" size="sm" onClick={() => toggleBlock(false)} loading={blocking}>
              Unblock
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmBlock(true)}>
              Block
            </Button>
          )}
        </div>
      </div>

      {justPaid && (
        <Alert tone="success">
          Payment received. You can message {conversation.other_name.split(" ")[0]} until{" "}
          {new Date(conversation.access_until).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Africa/Lagos" })}.
        </Alert>
      )}

      <div className="flex min-h-[50vh] flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-surface p-4 lg:h-[calc(100dvh-26rem)] lg:min-h-80">
        {messages.length === 0 && (
          <p className="m-auto max-w-xs text-center text-sm text-ink-3">
            {conversation.role === "member"
              ? `Say hello to ${conversation.other_name.split(" ")[0]}. A short intro and one clear question works best.`
              : "No messages yet."}
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`group flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed ${
                m.mine ? "rounded-br-md bg-accent text-white" : "rounded-bl-md bg-surface-2 text-ink"
              }`}
            >
              {m.body}
            </div>
            <div className="mt-0.5 flex items-center gap-2 px-1 text-[11px] text-ink-3">
              <time dateTime={m.created_at}>{time(m.created_at)}</time>
              {!m.mine && (
                <button
                  type="button"
                  onClick={() => setReporting(m)}
                  className="inline-flex items-center gap-1 hover:text-ink sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
                >
                  <Flag className="size-3" aria-hidden /> Report
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>

      {conversation.locked ? (
        <Alert>
          <LockedNotice conversation={conversation} />
        </Alert>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex flex-col gap-2"
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex items-end gap-2">
            <Textarea
              aria-label="Message"
              value={draft}
              maxLength={MAX}
              rows={2}
              placeholder="Write a message…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) send();
                }
              }}
              className="flex-1 resize-none"
            />
            <Button type="submit" loading={sending} disabled={!draft.trim()} icon={<Send className="size-4" />}>
              Send
            </Button>
          </div>
          <p className="text-right text-xs text-ink-3">
            {draft.length > MAX - 200 ? `${MAX - draft.length} characters left · ` : ""}Enter to send, Shift+Enter for a new line
          </p>
        </form>
      )}

      <p className="text-center text-xs text-ink-3">
        Messages are private between you two. Please keep to our{" "}
        <Link href="/community-rules" className="underline">
          community rules
        </Link>
        .
      </p>

      <Dialog
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`Block ${conversation.other_name.split(" ")[0]}?`}
        description="Neither of you will be able to send messages in this conversation. They won't be told. You can unblock any time."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmBlock(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => toggleBlock(true)} loading={blocking}>
            Block
          </Button>
        </div>
      </Dialog>

      {reporting && <ReportDialog message={reporting} onClose={() => setReporting(null)} />}
    </div>
  );
}

function ReportDialog({ message, onClose }: { message: MessageRow; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await reportMessage(Number(message.id), reason, note);
      if (res.error) setError(res.error);
      else {
        toast("Thanks. We'll look into it.");
        onClose();
      }
    });

  return (
    <Dialog
      open
      onClose={onClose}
      title="Report this message"
      description="Only our team sees reports. The other person isn't told who reported them."
    >
      <div className="flex flex-col gap-4">
        <blockquote className="line-clamp-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{message.body}</blockquote>
        <Field label="What's wrong?">
          {({ id }) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose…</option>
              <option value="harassment">Harassment or bullying</option>
              <option value="spam">Spam or selling</option>
              <option value="scam">Scam or asking for money</option>
              <option value="inappropriate">Inappropriate or offensive</option>
              <option value="other">Something else</option>
            </Select>
          )}
        </Field>
        <Field label="Anything to add?" optional>
          {({ id }) => <Textarea id={id} value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={pending} disabled={!reason}>
            Send report
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
