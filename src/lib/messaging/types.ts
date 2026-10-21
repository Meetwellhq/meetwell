export type ConversationRow = {
  id: number;
  role: "member" | "mentor";
  other_name: string;
  other_slug: string | null;
  other_avatar: string | null;
  other_title: string | null;
  last_message: string | null;
  last_message_mine: boolean | null;
  last_message_at: string | null;
  unread: number;
  access_until: string;
  /** Why it's read-only for me, or null if I can write. */
  locked: "ended" | "blocked" | "paused" | "member_first" | null;
  blocked_by_me: boolean;
};

export type MessageRow = { id: number; mine: boolean; body: string; created_at: string };
