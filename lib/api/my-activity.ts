import { supabase } from "../supabase/client";

/**
 * Wat je zélf gedaan hebt, in cijfers.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * De band "voor jou" bovenaan de feed vertelde alleen wat ánderen met
 * jouw spullen deden: wie reageerde, wie iets omhoog duwde, wie iets
 * deelde. Dat is de helft van een klein netwerk. De andere helft is wat
 * jij erin stopt, en dat stond nergens — terwijl juist dát het is wat een
 * kring als deze levend houdt.
 *
 * Het is bewust een telling en geen ranglijst. Er is niemand om van te
 * winnen: je ziet wat je deze week deed en hoeveel dagen op rij je iets
 * gedaan hebt, en dat is precies het soort duwtje dat werkt zonder dat er
 * punten of niveaus aan te pas komen.
 *
 * ---------------------------------------------------------------
 * WAAROM DRIE VRAGEN EN NIET ÉÉN TABEL
 * ---------------------------------------------------------------
 * `activity_events` bestaat, maar kent alleen "post_created" en wat er om
 * events heen gebeurt — reageren en duwen staan er niet in. Ze staan wél
 * in hun eigen tabellen, en drie tellingen over dertig dagen zijn drie
 * kleine indexscans. Een nieuwe tabel bijhouden die hetzelfde nog eens
 * zegt is de duurdere en de brozere kant.
 *
 * Dertig dagen, want de reeks moet verder terug kunnen kijken dan de week
 * die je toont; de weekcijfers komen uit dezelfde rijen.
 */

const WINDOW_DAYS = 30;
const WEEK_DAYS = 7;

export type MyActivity = {
  /** Deze week — de laatste zeven dagen, vandaag meegerekend. */
  posts: number;
  comments: number;
  boosts: number;
  /** Hoeveel dagen op rij je iets deed, tot en met vandaag of gisteren. */
  streak: number;
  /** Zeven dagen, oudste eerst: deed je die dag iets? */
  week: boolean[];
};

/** De dag van een tijdstip, lokaal, als `2026-09-08`. */
function dayKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export async function getMyActivity(userId: string): Promise<MyActivity> {
  const since = daysAgo(WINDOW_DAYS).toISOString();

  const [posts, comments, boosts] = await Promise.all([
    supabase
      .from("posts")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
    supabase
      .from("entity_comments")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
    supabase
      .from("post_boosts")
      .select("created_at")
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);

  const stamps = (res: { data: { created_at: string }[] | null }) =>
    (res.data ?? []).map((r) => r.created_at);

  const postStamps = stamps(posts as any);
  const commentStamps = stamps(comments as any);
  const boostStamps = stamps(boosts as any);

  const weekStart = daysAgo(WEEK_DAYS - 1);
  weekStart.setHours(0, 0, 0, 0);
  const inWeek = (iso: string) => new Date(iso).getTime() >= weekStart.getTime();

  const active = new Set<string>();
  for (const iso of [...postStamps, ...commentStamps, ...boostStamps]) {
    active.add(dayKey(iso));
  }

  /**
   * De reeks mag vandaag nog leeg zijn.
   *
   * Anders staat hij elke ochtend op nul tot je iets doet, en dan is het
   * geen reeks meer maar een verwijt. Hij breekt pas als er een hele dag
   * tussen zit.
   */
  let streak = 0;
  const startOffset = active.has(dayKey(new Date())) ? 0 : 1;
  for (let i = startOffset; i < WINDOW_DAYS; i += 1) {
    if (!active.has(dayKey(daysAgo(i)))) break;
    streak += 1;
  }

  return {
    posts: postStamps.filter(inWeek).length,
    comments: commentStamps.filter(inWeek).length,
    boosts: boostStamps.filter(inWeek).length,
    streak,
    week: Array.from({ length: WEEK_DAYS }, (_, i) =>
      active.has(dayKey(daysAgo(WEEK_DAYS - 1 - i)))
    ),
  };
}
