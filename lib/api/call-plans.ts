import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { createNotification } from "./notifications";

export type CallPlanSlot = {
  id: string;
  call_plan_id: string;
  starts_at: string;
  ends_at: string;
  yes_voters: string[];   // user_ids
  no_voters: string[];
};

export type CallPlanRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
};

export type CallPlanWithDetails = CallPlanRow & {
  author: Profile | null;
  slots: CallPlanSlot[];
  participant_profiles: Profile[];
  invitee_profiles: Profile[];
};

export async function createCallPlan(args: {
  userId: string;
  title: string;
  description?: string | null;
  slots: { starts_at: Date; ends_at: Date }[];
  inviteeIds?: string[];
}): Promise<CallPlanRow> {
  const { data: plan, error: planErr } = await supabase
    .from("call_plans")
    .insert({
      user_id: args.userId,
      title: args.title.trim(),
      description: args.description?.trim() ?? null,
    })
    .select("id, user_id, title, description, created_at")
    .single();
  if (planErr) throw planErr;

  const slotRows = args.slots.map((s) => ({
    call_plan_id: plan.id,
    starts_at: s.starts_at.toISOString(),
    ends_at: s.ends_at.toISOString(),
  }));
  const { error: slotErr } = await supabase.from("call_plan_slots").insert(slotRows);
  if (slotErr) throw slotErr;

  if (args.inviteeIds && args.inviteeIds.length > 0) {
    const inviteRows = args.inviteeIds.map((uid) => ({
      call_plan_id: plan.id,
      user_id: uid,
    }));
    await supabase.from("call_plan_invites").insert(inviteRows);

    // Notify each invitee
    for (const uid of args.inviteeIds) {
      createNotification({
        userId: uid,
        actorId: args.userId,
        type: "invited_to_call",
        postId: plan.id,
      });
    }
  }

  return plan as CallPlanRow;
}

export async function getCallPlanWithDetails(
  planId: string
): Promise<CallPlanWithDetails | null> {
  const { data: plan, error: pErr } = await supabase
    .from("call_plans")
    .select("id, user_id, title, description, created_at")
    .eq("id", planId)
    .single();
  if (pErr) return null;

  const { data: slots, error: sErr } = await supabase
    .from("call_plan_slots")
    .select("id, call_plan_id, starts_at, ends_at, call_plan_votes(user_id, available)")
    .eq("call_plan_id", planId)
    .order("starts_at");
  if (sErr) throw sErr;

  const allVoterIds = new Set<string>();
  const mappedSlots: CallPlanSlot[] = (slots ?? []).map((s: any) => {
    const votes: { user_id: string; available: boolean }[] = s.call_plan_votes ?? [];
    votes.forEach((v) => allVoterIds.add(v.user_id));
    return {
      id: s.id,
      call_plan_id: s.call_plan_id,
      starts_at: s.starts_at,
      ends_at: s.ends_at,
      yes_voters: votes.filter((v) => v.available).map((v) => v.user_id),
      no_voters: votes.filter((v) => !v.available).map((v) => v.user_id),
    };
  });

  const participantIds = Array.from(allVoterIds);

  // Fetch invitees
  const { data: inviteRows } = await supabase
    .from("call_plan_invites")
    .select("user_id")
    .eq("call_plan_id", planId);
  const inviteeIds = (inviteRows ?? []).map((r: any) => r.user_id as string);

  const allProfileIds = Array.from(new Set([plan.user_id, ...participantIds, ...inviteeIds]));
  const allProfiles = await getProfiles(allProfileIds);
  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]));

  return {
    ...(plan as CallPlanRow),
    author: profileMap[plan.user_id] ?? null,
    slots: mappedSlots,
    participant_profiles: participantIds.map((id) => profileMap[id]).filter(Boolean) as Profile[],
    invitee_profiles: inviteeIds.map((id) => profileMap[id]).filter(Boolean) as Profile[],
  };
}

export async function listFeedCallPlans(limit = 20): Promise<CallPlanWithDetails[]> {
  // RLS already filters to creator + friends + invitees — just fetch all visible
  const { data: plans, error } = await supabase
    .from("call_plans")
    .select("id, user_id, title, description, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!plans || plans.length === 0) return [];

  const results = await Promise.all(
    (plans as CallPlanRow[]).map((p) => getCallPlanWithDetails(p.id))
  );
  return results.filter((p): p is CallPlanWithDetails => p !== null);
}

/** Realtime: luister op stemwijzigingen voor een call plan. */
export function subscribeToCallPlanVotes(
  planId: string,
  onChange: () => void
): RealtimeChannel {
  return supabase
    .channel(`call-plan-votes:${planId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "call_plan_votes" },
      onChange
    )
    .subscribe();
}

export async function inviteToCallPlan(args: {
  callPlanId: string;
  inviterUserId: string;
  inviteeIds: string[];
}): Promise<void> {
  const rows = args.inviteeIds.map((uid) => ({
    call_plan_id: args.callPlanId,
    user_id: uid,
  }));
  await supabase
    .from("call_plan_invites")
    .upsert(rows, { ignoreDuplicates: true });

  for (const uid of args.inviteeIds) {
    createNotification({
      userId: uid,
      actorId: args.inviterUserId,
      type: "invited_to_call",
      postId: args.callPlanId,
    });
  }
}

export async function voteCallPlanSlot(args: {
  slotId: string;
  userId: string;
  available: boolean;
}): Promise<void> {
  const { error } = await supabase
    .from("call_plan_votes")
    .upsert(
      { call_plan_slot_id: args.slotId, user_id: args.userId, available: args.available },
      { onConflict: "call_plan_slot_id,user_id" }
    );
  if (error) throw error;

  // Notify plan owner (fire-and-forget) — alleen bij "ja"-stem, één keer per persoon
  if (args.available) {
    supabase
      .from("call_plan_slots")
      .select("call_plan_id")
      .eq("id", args.slotId)
      .single()
      .then(async ({ data: slot }) => {
        if (!slot) return;
        const { data: plan } = await supabase
          .from("call_plans")
          .select("user_id")
          .eq("id", slot.call_plan_id)
          .single();
        if (plan?.user_id && plan.user_id !== args.userId) {
          await createNotification({
            userId: plan.user_id,
            actorId: args.userId,
            type: "vote_on_call",
            postId: slot.call_plan_id,
          });
        }
      })
      .catch(() => {});
  }
}
