import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { createNotification } from "./notifications";

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  vote_count: number;
  voters: Profile[];
};

export type PollRow = {
  id: string;
  user_id: string;
  question: string;
  ends_at: string | null;
  created_at: string;
  /** 0060 — meerdere keuzes per linc. `false` zolang de migratie niet draaide. */
  allow_multiple: boolean;
};

export type PollWithDetails = PollRow & {
  author: Profile | null;
  options: PollOption[];
  /** De eerste eigen stem; bij één stem per linc de enige. */
  my_vote_option_id: string | null;
  /** Alle eigen stemmen — meer dan één alleen bij `allow_multiple`. */
  my_vote_option_ids: string[];
  total_votes: number;
};

export async function createPoll(args: {
  userId: string;
  question: string;
  options: string[];       // minimaal 2 labels
  endsAt?: Date | null;
  /** `meerdere keuzes` in de keuze-editor (HANDOFF 2.1). */
  allowMultiple?: boolean;
  /**
   * Gestuurd in een gesprek: dan zien alleen de leden hem (0063). Zonder
   * is het een feedpoll, voor jou en je lincs.
   */
  chatId?: string | null;
}): Promise<PollRow> {
  const row: { user_id: string; question: string; ends_at: string | null; chat_id: string | null; allow_multiple?: boolean } = {
    user_id: args.userId,
    question: args.question.trim(),
    ends_at: args.endsAt?.toISOString() ?? null,
    chat_id: args.chatId ?? null,
  };
  const insert = (withMultiple: boolean) =>
    supabase
      .from("polls")
      .insert(withMultiple ? { ...row, allow_multiple: true } : row)
      .select(POLL_COLUMNS_BASE)
      .single();
  // Alleen een meerkeuzepoll schrijft de kolom; zonder migratie 0060 valt
  // hij terug op één stem in plaats van niet gedeeld te worden.
  let { data: poll, error: pollErr } = await insert(!!args.allowMultiple);
  if (pollErr && args.allowMultiple) ({ data: poll, error: pollErr } = await insert(false));
  if (pollErr || !poll) throw pollErr;

  const optionRows = args.options.map((label, i) => ({
    poll_id: poll.id,
    label: label.trim(),
    position: i,
  }));
  const { error: optErr } = await supabase.from("poll_options").insert(optionRows);
  if (optErr) throw optErr;

  return { ...(poll as Omit<PollRow, "allow_multiple">), allow_multiple: !!args.allowMultiple } as PollRow;
}

const POLL_COLUMNS_BASE = "id, user_id, question, ends_at, created_at";

/** Leest `allow_multiple` als de kolom er is (0060), anders `false`. */
async function selectPoll(pollId: string) {
  const withCol = await supabase.from("polls").select(`${POLL_COLUMNS_BASE}, allow_multiple`).eq("id", pollId).single();
  if (!withCol.error) return { data: withCol.data as unknown as PollRow, error: null };
  const base = await supabase.from("polls").select(POLL_COLUMNS_BASE).eq("id", pollId).single();
  return { data: base.data ? ({ ...base.data, allow_multiple: false } as PollRow) : null, error: base.error };
}

export async function getPollWithDetails(
  pollId: string,
  myUserId: string
): Promise<PollWithDetails | null> {
  const { data: poll, error: pErr } = await selectPoll(pollId);
  if (pErr || !poll) return null;

  const { data: options, error: oErr } = await supabase
    .from("poll_options")
    .select("id, poll_id, label, position, poll_votes(user_id)")
    .eq("poll_id", pollId)
    .order("position");
  if (oErr) throw oErr;

  const { data: myVotes } = await supabase
    .from("poll_votes")
    .select("poll_option_id")
    .eq("user_id", myUserId)
    .in("poll_option_id", (options ?? []).map((o: any) => o.id));
  const myIds = (myVotes ?? []).map((v: { poll_option_id: string }) => v.poll_option_id);

  // Collect all voter ids across all options
  const allVoterIds = Array.from(new Set(
    (options ?? []).flatMap((o: any) =>
      (o.poll_votes ?? []).map((v: any) => v.user_id).filter(Boolean)
    )
  ));

  const [authors, allVoterProfiles] = await Promise.all([
    getProfiles([poll.user_id]),
    allVoterIds.length > 0 ? getProfiles(allVoterIds) : Promise.resolve([]),
  ]);
  const voterProfileMap = Object.fromEntries(allVoterProfiles.map((p) => [p.id, p]));

  const mappedOptions: PollOption[] = (options ?? []).map((o: any) => {
    const votes: { user_id: string }[] = o.poll_votes ?? [];
    return {
      id: o.id,
      poll_id: o.poll_id,
      label: o.label,
      position: o.position,
      vote_count: votes.length,
      voters: votes.map((v) => voterProfileMap[v.user_id]).filter(Boolean) as Profile[],
    };
  });

  const totalVotes = mappedOptions.reduce((s, o) => s + o.voters.length, 0);

  return {
    ...(poll as PollRow),
    author: authors[0] ?? null,
    options: mappedOptions,
    allow_multiple: !!(poll as { allow_multiple?: boolean }).allow_multiple,
    my_vote_option_id: myIds[0] ?? null,
    my_vote_option_ids: myIds,
    total_votes: totalVotes,
  };
}

export async function listFeedPolls(limit = 30): Promise<PollWithDetails[]> {
  // Een poll uit een gesprek hoort in dat gesprek, nooit in de feed —
  // ook niet in die van de leden zelf.
  const { data: polls, error } = await supabase
    .from("polls")
    .select("id, user_id, question, ends_at, created_at")
    .is("chat_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!polls || polls.length === 0) return [];

  const { data: { user } } = await supabase.auth.getUser();
  const myUserId = user?.id ?? "";

  const results = await Promise.all(
    (polls as PollRow[]).map((p) => getPollWithDetails(p.id, myUserId))
  );
  return results.filter((p): p is PollWithDetails => p !== null);
}

export async function votePoll(args: {
  optionId: string;
  userId: string;
  pollId: string;
  /**
   * Meerkeuze: de tik zet déze keuze aan of uit en laat de andere staan.
   * Zonder: de vorige stem gaat weg en deze komt ervoor in de plaats.
   */
  multiple?: boolean;
  /** Bij `multiple`: of deze keuze al aangevinkt was (dan gaat hij weg). */
  wasOn?: boolean;
}): Promise<void> {
  if (args.multiple && args.wasOn) {
    const { error } = await supabase
      .from("poll_votes")
      .delete()
      .eq("user_id", args.userId)
      .eq("poll_option_id", args.optionId);
    if (error) throw error;
    return;
  }
  // Verwijder eventuele vorige stem op dezelfde poll
  const { data: existingOptions } = args.multiple ? { data: null } : await supabase
    .from("poll_options")
    .select("id")
    .eq("poll_id", args.pollId);

  if (existingOptions && existingOptions.length > 0) {
    await supabase
      .from("poll_votes")
      .delete()
      .eq("user_id", args.userId)
      .in("poll_option_id", existingOptions.map((o: any) => o.id));
  }

  const { error } = await supabase.from("poll_votes").insert({
    poll_option_id: args.optionId,
    user_id: args.userId,
  });
  if (error) throw error;

  // Notify poll owner (fire-and-forget)
  supabase
    .from("polls")
    .select("user_id")
    .eq("id", args.pollId)
    .single()
    .then(({ data }) => {
      if (data?.user_id) {
        createNotification({
          userId: data.user_id,
          actorId: args.userId,
          type: "vote_on_poll",
          postId: args.pollId,
        });
      }
    });
}
