import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";

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
  const [authors, participants] = await Promise.all([
    getProfiles([plan.user_id]),
    participantIds.length > 0 ? getProfiles(participantIds) : Promise.resolve([]),
  ]);

  return {
    ...(plan as CallPlanRow),
    author: authors[0] ?? null,
    slots: mappedSlots,
    participant_profiles: participants,
  };
}

export async function listFeedCallPlans(limit = 20): Promise<CallPlanWithDetails[]> {
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
}
