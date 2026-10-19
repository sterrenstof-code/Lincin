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
  /** Gestuurd in een gesprek: dan zien alleen de leden hem (0064). */
  chatId?: string | null;
}): Promise<CallPlanRow> {
  const { data: plan, error: planErr } = await supabase
    .from("call_plans")
    .insert({
      user_id: args.userId,
      title: args.title.trim(),
      description: args.description?.trim() ?? null,
      chat_id: args.chatId ?? null,
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
        callPlanId: plan.id,
      });
    }
  }

  return plan as CallPlanRow;
}

/**
 * Afspraken met tijdvakken, stemmen en genodigden in één select.
 *
 * Dit waren vier vragen per afspraak (de afspraak, tijdvakken met stemmen,
 * genodigden, profielen). PostgREST kan de drie onderliggende tabellen
 * meenemen via hun foreign keys, en elke ingesloten tabel gaat door zijn
 * eigen policy — wat je los niet mocht zien, zit er ook nu niet in. Het
 * zijn per afspraak een paar rijen, dus de select blijft klein. Daarna nog
 * één vraag voor alle profielen samen.
 */
const CALL_PLAN_SELECT =
  "id, user_id, title, description, created_at, call_plan_slots(id, call_plan_id, starts_at, ends_at, call_plan_votes(user_id, available)), call_plan_invites(user_id)";

type CallPlanEmbedded = CallPlanRow & {
  call_plan_slots: {
    id: string;
    call_plan_id: string;
    starts_at: string;
    ends_at: string;
    call_plan_votes: { user_id: string; available: boolean }[] | null;
  }[] | null;
  call_plan_invites: { user_id: string }[] | null;
};

async function withDetails(plans: CallPlanEmbedded[]): Promise<CallPlanWithDetails[]> {
  if (plans.length === 0) return [];
  const prepared = plans.map((plan) => {
    const allVoterIds = new Set<string>();
    const slots: CallPlanSlot[] = (plan.call_plan_slots ?? []).map((s) => {
      const votes = s.call_plan_votes ?? [];
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
    return {
      plan,
      slots,
      participantIds: Array.from(allVoterIds),
      inviteeIds: (plan.call_plan_invites ?? []).map((r) => r.user_id),
    };
  });

  const allProfileIds = new Set<string>();
  for (const p of prepared) {
    allProfileIds.add(p.plan.user_id);
    p.participantIds.forEach((id) => allProfileIds.add(id));
    p.inviteeIds.forEach((id) => allProfileIds.add(id));
  }
  const allProfiles = await getProfiles(Array.from(allProfileIds));
  const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p]));

  return prepared.map(({ plan, slots, participantIds, inviteeIds }) => ({
    id: plan.id,
    user_id: plan.user_id,
    title: plan.title,
    description: plan.description,
    created_at: plan.created_at,
    author: profileMap[plan.user_id] ?? null,
    slots,
    participant_profiles: participantIds.map((id) => profileMap[id]).filter(Boolean) as Profile[],
    invitee_profiles: inviteeIds.map((id) => profileMap[id]).filter(Boolean) as Profile[],
  }));
}

export async function getCallPlanWithDetails(
  planId: string
): Promise<CallPlanWithDetails | null> {
  const { data: plan, error } = await supabase
    .from("call_plans")
    .select(CALL_PLAN_SELECT)
    .eq("id", planId)
    // Tijdvakken op volgorde, zoals toen ze nog apart opgehaald werden.
    .order("starts_at", { referencedTable: "call_plan_slots" })
    .single();
  if (error || !plan) return null;
  const [details] = await withDetails([plan as unknown as CallPlanEmbedded]);
  return details ?? null;
}

export async function listFeedCallPlans(limit = 20): Promise<CallPlanWithDetails[]> {
  // RLS (0064) laat zien wat je mag zien. Een afspraak uit een gesprek
  // hoort in dat gesprek, niet in de feed.
  const { data: plans, error } = await supabase
    .from("call_plans")
    .select(CALL_PLAN_SELECT)
    .is("chat_id", null)
    .order("created_at", { ascending: false })
    .order("starts_at", { referencedTable: "call_plan_slots" })
    .limit(limit);
  if (error) throw error;
  return withDetails((plans ?? []) as unknown as CallPlanEmbedded[]);
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

  // Notify plan owner (fire-and-forget) — alleen bij "ja"-stem, één keer per persoon.
  //
  // Een async IIFE en geen `.then(...).catch(...)`: de builder van Supabase
  // geeft een `PromiseLike` terug, en die heeft wél `then` maar géén `catch`.
  // De keten hierboven zag er dus goed uit maar ving niets op — een fout in
  // de notificatie zou als unhandled rejection zijn geëindigd.
  if (args.available) {
    void (async () => {
      try {
        const { data: slot } = await supabase
          .from("call_plan_slots")
          .select("call_plan_id")
          .eq("id", args.slotId)
          .single();
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
            callPlanId: slot.call_plan_id,
          });
        }
      } catch {
        // Bewust stil: een gemiste notificatie mag een stem niet laten falen.
      }
    })();
  }
}
