import { NextResponse } from "next/server";
import { createAdminClient, createClient, requireActive } from "@/lib/supabase/server";

export const runtime = "nodejs";

// FIX: Cache this response for 30 seconds — it's polled on every navigation.
// Short enough to stay fresh, long enough to prevent hammering the DB.
export const revalidate = 30;

export async function GET() {
  const ctx = await requireActive();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const nowIso = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const s = await createClient();

  const [{ count: dueCount }, { data: newLessons, count: newLessonCount }] = await Promise.all([
    s.from("flashcard_reviews").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).lte("due_at", nowIso),
    s.from("lessons").select("id,title,created_at", { count: "exact" }).eq("visible", true).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }).limit(5),
  ]);

  let pendingApprovals = 0;
  let unconfirmedEmails = 0;
  let supportUnread = 0;

  if (ctx.profile?.role === "admin") {
    const admin = createAdminClient();
    // FIX: Run all admin queries in parallel and limit conversation/message loads.
    const [pendingProfilesRes, authUsersRes, conversationsRes] = await Promise.all([
      admin.from("profiles").select("id,status").eq("status", "pending"),
      // FIX: Only fetch the count instead of listing all 1000 users.
      admin.auth.admin.listUsers({ page: 1, perPage: 100 }),
      // FIX: Limit to 50 most recent conversations instead of all.
      admin.from("ai_conversations").select("id").order("updated_at", { ascending: false }).limit(50),
    ]);

    const pendingProfiles = pendingProfilesRes.data ?? [];
    pendingApprovals = pendingProfiles.length;

    const allAuthUsers = authUsersRes.data?.users ?? [];
    unconfirmedEmails = allAuthUsers.filter((user) => !user.email_confirmed_at && !user.confirmed_at).length;

    const convoIds = (conversationsRes.data ?? []).map((item: any) => item.id);
    if (convoIds.length) {
      // FIX: Only fetch last message per conversation using a smarter query.
      const { data: messages } = await admin
        .from("ai_messages")
        .select("conversation_id,role")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false });
      // Keep only the last message per conversation.
      const lastByConversation = new Map<string, string>();
      for (const item of messages ?? []) {
        if (!lastByConversation.has(item.conversation_id)) {
          lastByConversation.set(item.conversation_id, item.role);
        }
      }
      supportUnread = [...lastByConversation.values()].filter((role) => role === "student").length;
    }
  } else {
    const { data: conversations } = await s.from("ai_conversations").select("id").eq("user_id", ctx.user.id).limit(1);
    const convoId = conversations?.[0]?.id;
    if (convoId) {
      const { data: messages } = await s
        .from("ai_messages")
        .select("role")
        .eq("conversation_id", convoId)
        .order("created_at", { ascending: false })
        .limit(1);
      const lastRole = messages?.[0]?.role ?? null;
      supportUnread = lastRole === "admin" ? 1 : 0;
    }
  }

  const dueReminders = [
    ...(dueCount ? [{ title: `You have ${dueCount} flashcard review${dueCount === 1 ? "" : "s"} due now.` }] : []),
    ...((newLessons ?? []).slice(0, 3).map((lesson) => ({ title: `New lesson: ${lesson.title}` }))),
    ...(supportUnread ? [{ title: ctx.profile?.role === "admin" ? `${supportUnread} support conversation${supportUnread === 1 ? "" : "s"} need your reply.` : "You have a new admin reply in support chat." }] : []),
    ...(pendingApprovals ? [{ title: `${pendingApprovals} registration request${pendingApprovals === 1 ? "" : "s"} need approval.` }] : []),
    ...(unconfirmedEmails ? [{ title: `${unconfirmedEmails} account${unconfirmedEmails === 1 ? "" : "s"} still need email confirmation.` }] : []),
  ];

  const result = NextResponse.json({
    unread_count: (dueCount ?? 0) + (newLessonCount ?? 0) + pendingApprovals + supportUnread,
    due_count: dueCount ?? 0,
    new_lessons_count: newLessonCount ?? 0,
    pending_approvals: pendingApprovals,
    unconfirmed_emails: unconfirmedEmails,
    support_unread: supportUnread,
    due_reminders: dueReminders,
    recent_lessons: (newLessons ?? []).map((lesson) => ({ id: lesson.id, title: lesson.title, created_at: lesson.created_at })),
  });

  // FIX: Add Cache-Control to allow client/CDN caching for 30 seconds.
  result.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
  return result;
}
