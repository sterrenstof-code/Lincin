import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";

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

/** Eén rij van `feed_polls_with_details` (0098). */
type PollDetailsRow = Required<PollRow> & {
  options: {
    id: string;
    poll_id: string;
    label: string;
    position: number;
    created_by: string | null;
    votes: number;
    /** Leeg bij een anonieme poll — dat bewaakt de functie zelf. */
    voter_ids: string[];
  }[];
  my_option_ids: string[] | null;
  voter_count: number | null;
};

/**
 * Polls met keuzes, aantallen en eigen stem, voor een hele lijst tegelijk.
 *
 * Dit waren zes vragen per poll (de poll, keuzes, uitslag, aantal
 * stemmers, stemmen, profielen); bij twintig polls in de feed ruim honderd
 * keer heen en weer. Nu doet `feed_polls_with_details` (0098) de eerste
 * vijf in één keer voor alle polls, en volgt er één vraag voor alle
 * profielen samen. De functie is security invoker: wat RLS je niet laat
 * zien komt er ook hier niet uit, en bij een anonieme poll geeft ze geen
 * namen — alleen de aantallen en je eigen keuze.
 */
async function pollsWithDetails(pollIds: string[]): Promise<PollWithDetails[]> {
  if (pollIds.length === 0) return [];
  const { data, error } = await supabase.rpc("feed_polls_with_details", { p_poll_ids: pollIds });
  if (error) throw error;
  const rows = (data ?? []) as PollDetailsRow[];

  const peopleIds = new Set<string>();
  for (const poll of rows) {
    peopleIds.add(poll.user_id);
    for (const o of poll.options) {
      if (o.created_by) peopleIds.add(o.created_by);
      if (!poll.anonymous) o.voter_ids.forEach((id) => peopleIds.add(id));
    }
  }
  const people = await getProfiles(Array.from(peopleIds));
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  const byPoll = new Map(
    rows.map((poll): [string, PollWithDetails] => {
      const anonymous = !!poll.anonymous;
      const options: PollOption[] = poll.options.map((o) => ({
        id: o.id,
        poll_id: o.poll_id,
        label: o.label,
        position: o.position,
        vote_count: o.votes ?? 0,
        voters: anonymous ? [] : (o.voter_ids.map((id) => byId[id]).filter(Boolean) as Profile[]),
        created_by: o.created_by,
        proposer: o.created_by ? byId[o.created_by] ?? null : null,
      }));
      const myIds = poll.my_option_ids ?? [];
      return [
        poll.id,
        {
          id: poll.id,
          user_id: poll.user_id,
          question: poll.question,
          ends_at: poll.ends_at,
          created_at: poll.created_at,
          swatch: poll.swatch,
          author: byId[poll.user_id] ?? null,
          options,
          allow_multiple: !!poll.allow_multiple,
          anonymous,
          allow_proposals: !!poll.allow_proposals,
          my_vote_option_id: myIds[0] ?? null,
          my_vote_option_ids: myIds,
          total_votes: options.reduce((n, o) => n + o.vote_count, 0),
          voter_count: poll.voter_count ?? 0,
        },
      ];
    }),
  );
  // In de volgorde waarin erom gevraagd werd; wat je niet mag zien valt weg.
  return pollIds.map((id) => byPoll.get(id)).filter((p): p is PollWithDetails => !!p);
}

/**
 * Eén poll, voor een gesprek of zijn eigen scherm. `myUserId` hoeft niet
 * meer: de functie weet zelf wie er vraagt (auth.uid()). Hij blijft in de
 * handtekening zodat de aanroepers niet hoeven te veranderen.
 */
export async function getPollWithDetails(
  pollId: string,
  _myUserId?: string
): Promise<PollWithDetails | null> {
  const [poll] = await pollsWithDetails([pollId]);
  return poll ?? null;
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
    .select("id")
    .is("chat_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!polls || polls.length === 0) return [];
  return pollsWithDetails(polls.map((p) => p.id as string));
}

/**
 * Je eigen poll weghalen. Keuzes en stemmen gaan mee (on delete cascade);
 * RLS ("polls: owner delete") laat alleen de maker dit doen.
 */
export async function deletePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) throw error;
}
