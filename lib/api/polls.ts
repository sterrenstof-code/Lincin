import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";
import { createNotification } from "./notifications";

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  vote_count: number;
  /** Wie erop stemde; leeg bij een anonieme poll (0085). */
  voters: Profile[];
  /** 0085 — wie deze keuze voorstelde; leeg = de maker zelf. */
  created_by: string | null;
  proposer: Profile | null;
};

export type PollRow = {
  id: string;
  user_id: string;
  question: string;
  ends_at: string | null;
  created_at: string;
  /** 0060 — meerdere keuzes per linc. `false` zolang de migratie niet draaide. */
  allow_multiple: boolean;
  /** 0078 — de gekozen kleur; `null` = de kleur van de maker. */
  swatch?: string | null;
  /** 0085 — niemand ziet wie wat stemde, alleen de aantallen. */
  anonymous?: boolean;
  /** 0085 — "Eigen voorstel mag": iedereen mag een keuze toevoegen (tot zes). */
  allow_proposals?: boolean;
};

export type PollWithDetails = PollRow & {
  author: Profile | null;
  options: PollOption[];
  /** De eerste eigen stem; bij één stem per linc de enige. */
  my_vote_option_id: string | null;
  /** Alle eigen stemmen — meer dan één alleen bij `allow_multiple`. */
  my_vote_option_ids: string[];
  total_votes: number;
  /** Hoeveel mensen stemden — bij meerdere keuzes de noemer van een percentage (0086). */
  voter_count: number;
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
  /** De kleur uit "Nieuwe bijdrage" (0078). */
  swatch?: string | null;
  /** 0085 — anoniem: alleen aantallen, geen namen. */
  anonymous?: boolean;
  /** 0085 — "Eigen voorstel mag". */
  allowProposals?: boolean;
}): Promise<PollRow> {
  const row: { user_id: string; question: string; ends_at: string | null; chat_id: string | null; allow_multiple?: boolean; swatch?: string; anonymous?: boolean; allow_proposals?: boolean } = {
    user_id: args.userId,
    question: args.question.trim(),
    ends_at: args.endsAt?.toISOString() ?? null,
    chat_id: args.chatId ?? null,
    ...(args.swatch ? { swatch: args.swatch } : null),
    ...(args.anonymous ? { anonymous: true } : null),
    ...(args.allowProposals ? { allow_proposals: true } : null),
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
  const withCol = await supabase.from("polls").select(`${POLL_COLUMNS_BASE}, allow_multiple, swatch, anonymous, allow_proposals`).eq("id", pollId).single();
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

  const [optionsRes, results, voterCount] = await Promise.all([
    supabase.from("poll_options").select("id, poll_id, label, position, created_by").eq("poll_id", pollId).order("position"),
    // De aantallen komen van de server: bij een anonieme poll ziet de app
    // andermans stemmen niet (0085), maar wel hoeveel het er zijn.
    supabase.rpc("poll_results", { p_poll_id: pollId }),
    supabase.rpc("poll_voter_count", { p_poll_id: pollId }),
  ]);
  if (optionsRes.error) throw optionsRes.error;
  const options = (optionsRes.data ?? []) as { id: string; poll_id: string; label: string; position: number; created_by: string | null }[];
  const countOf = new Map(((results.data ?? []) as { option_id: string; votes: number }[]).map((r) => [r.option_id, r.votes]));

  // Wie stemde: wat de policy laat zien — alles bij een gewone poll, alleen
  // jezelf bij een anonieme.
  const { data: votes } = await supabase
    .from("poll_votes")
    .select("poll_option_id, user_id")
    .in("poll_option_id", options.map((o) => o.id));
  const visible = (votes ?? []) as { poll_option_id: string; user_id: string }[];
  const myIds = visible.filter((v) => v.user_id === myUserId).map((v) => v.poll_option_id);

  const anonymous = !!poll.anonymous;
  const peopleIds = Array.from(
    new Set([
      poll.user_id,
      ...(anonymous ? [] : visible.map((v) => v.user_id)),
      ...options.map((o) => o.created_by).filter((x): x is string => !!x),
    ]),
  );
  const people = await getProfiles(peopleIds);
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  const mappedOptions: PollOption[] = options.map((o) => ({
    id: o.id,
    poll_id: o.poll_id,
    label: o.label,
    position: o.position,
    vote_count: countOf.get(o.id) ?? 0,
    voters: anonymous ? [] : (visible.filter((v) => v.poll_option_id === o.id).map((v) => byId[v.user_id]).filter(Boolean) as Profile[]),
    created_by: o.created_by,
    proposer: o.created_by ? byId[o.created_by] ?? null : null,
  }));

  return {
    ...(poll as PollRow),
    author: byId[poll.user_id] ?? null,
    options: mappedOptions,
    allow_multiple: !!(poll as { allow_multiple?: boolean }).allow_multiple,
    anonymous,
    allow_proposals: !!poll.allow_proposals,
    my_vote_option_id: myIds[0] ?? null,
    my_vote_option_ids: myIds,
    total_votes: mappedOptions.reduce((n, o) => n + o.vote_count, 0),
    voter_count: typeof voterCount.data === "number" ? voterCount.data : 0,
  };
}

/**
 * Een tik op een keuze (0085): stemmen, wisselen (bij één keuze) of je stem
 * intrekken als je nog eens op dezelfde tikt. Gesloten na de einddatum.
 */
export async function votePollOption(optionId: string): Promise<"voted" | "withdrawn" | "closed"> {
  const { data, error } = await supabase.rpc("vote_poll_option", { p_option_id: optionId });
  if (error) throw error;
  return data as "voted" | "withdrawn" | "closed";
}

/** Een eigen voorstel: toevoegen en meteen erop stemmen (0085). Zelfde tekst = stem op die keuze. */
export async function proposePollOption(pollId: string, label: string): Promise<string> {
  const { data, error } = await supabase.rpc("propose_poll_option", { p_poll_id: pollId, p_label: label });
  if (error) throw error;
  return data as string;
}

/** Een voorstel weghalen: de maker of wie het voorstelde, zolang niemand anders erop stemde. */
export async function removePollOption(optionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("remove_poll_option", { p_option_id: optionId });
  if (error) throw error;
  return !!data;
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
          pollId: args.pollId,
        });
      }
    });
}

/**
 * Je eigen poll weghalen. Keuzes en stemmen gaan mee (on delete cascade);
 * RLS ("polls: owner delete") laat alleen de maker dit doen.
 */
export async function deletePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) throw error;
}
