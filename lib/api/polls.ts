import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
  vote_count: number;
};

export type PollRow = {
  id: string;
  user_id: string;
  question: string;
  ends_at: string | null;
  created_at: string;
};

export type PollWithDetails = PollRow & {
  author: Profile | null;
  options: PollOption[];
  my_vote_option_id: string | null;
  total_votes: number;
};

export async function createPoll(args: {
  userId: string;
  question: string;
  options: string[];       // minimaal 2 labels
  endsAt?: Date | null;
}): Promise<PollRow> {
  const { data: poll, error: pollErr } = await supabase
    .from("polls")
    .insert({
      user_id: args.userId,
      question: args.question.trim(),
      ends_at: args.endsAt?.toISOString() ?? null,
    })
    .select("id, user_id, question, ends_at, created_at")
    .single();
  if (pollErr) throw pollErr;

  const optionRows = args.options.map((label, i) => ({
    poll_id: poll.id,
    label: label.trim(),
    position: i,
  }));
  const { error: optErr } = await supabase.from("poll_options").insert(optionRows);
  if (optErr) throw optErr;

  return poll as PollRow;
}

export async function getPollWithDetails(
  pollId: string,
  myUserId: string
): Promise<PollWithDetails | null> {
  const { data: poll, error: pErr } = await supabase
    .from("polls")
    .select("id, user_id, question, ends_at, created_at")
    .eq("id", pollId)
    .single();
  if (pErr) return null;

  const { data: options, error: oErr } = await supabase
    .from("poll_options")
    .select("id, poll_id, label, position, poll_votes(count)")
    .eq("poll_id", pollId)
    .order("position");
  if (oErr) throw oErr;

  const { data: myVote } = await supabase
    .from("poll_votes")
    .select("poll_option_id")
    .eq("user_id", myUserId)
    .in("poll_option_id", (options ?? []).map((o: any) => o.id))
    .maybeSingle();

  const authors = await getProfiles([poll.user_id]);

  const mappedOptions: PollOption[] = (options ?? []).map((o: any) => ({
    id: o.id,
    poll_id: o.poll_id,
    label: o.label,
    position: o.position,
    vote_count: (o.poll_votes?.[0]?.count as number) ?? 0,
  }));

  const totalVotes = mappedOptions.reduce((s, o) => s + o.vote_count, 0);

  return {
    ...(poll as PollRow),
    author: authors[0] ?? null,
    options: mappedOptions,
    my_vote_option_id: myVote?.poll_option_id ?? null,
    total_votes: totalVotes,
  };
}

export async function listFeedPolls(limit = 30): Promise<PollWithDetails[]> {
  const { data: polls, error } = await supabase
    .from("polls")
    .select("id, user_id, question, ends_at, created_at")
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
}): Promise<void> {
  // Verwijder eventuele vorige stem op dezelfde poll
  const { data: existingOptions } = await supabase
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
}
