import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "../supabase/client";
import { getProfiles, type Profile } from "./profiles";

/**
 * Het bugbord.
 *
 * Zie `supabase/migrations/0049_bug_reports.sql` voor waarom dit een
 * gedeelde lijst is en geen formulier dat in het niets verdwijnt.
 */

export type BugStatus = "open" | "bezig" | "opgelost" | "geen_bug";

export type BugReport = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  route: string | null;
  platform: string | null;
  app_version: string | null;
  status: BugStatus;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  /** Inclusief de melder zelf. */
  affected: number;
  confirmed_by_me: boolean;
};

export type BugReportWithReporter = BugReport & { reporter: Profile | null };

export const BUG_STATUS_LABEL: Record<BugStatus, string> = {
  open: "Gemeld",
  bezig: "Wordt aan gewerkt",
  opgelost: "Opgelost",
  geen_bug: "Werkt zoals bedoeld",
};

/**
 * Wat de app over zichzelf weet, zonder ernaar te vragen.
 *
 * "Het werkt niet" is onbruikbaar; "het werkt niet, op web, versie 0.1.0,
 * op /chat/[id]" is een melding waar iets mee te beginnen valt. Niemand
 * typt dat uit eigen beweging, dus vult de app het zelf in.
 */
export function currentContext(route?: string | null) {
  return {
    route: route ?? null,
    platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web",
    app_version:
      Constants.expoConfig?.version ??
      (Constants as any).manifest?.version ??
      null,
  };
}

export async function listBugs(): Promise<BugReportWithReporter[]> {
  const { data, error } = await supabase
    .from("bug_board")
    .select("*")
    // Open bugs eerst, en daarbinnen die het meeste mensen raken. Wat af is
    // zakt naar onderen maar blijft staan — zien dat er iets mee gebeurd is
    // hoort erbij.
    .order("resolved_at", { ascending: true, nullsFirst: true })
    .order("affected", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const rows = (data ?? []) as BugReport[];
  if (rows.length === 0) return [];

  const reporters = await getProfiles(Array.from(new Set(rows.map((r) => r.user_id))));
  const byId = Object.fromEntries(reporters.map((p) => [p.id, p]));
  return rows.map((r) => ({ ...r, reporter: byId[r.user_id] ?? null }));
}

export async function reportBug(args: {
  userId: string;
  title: string;
  body?: string | null;
  route?: string | null;
}): Promise<BugReport> {
  const { data, error } = await supabase
    .from("bug_reports")
    .insert({
      user_id: args.userId,
      title: args.title.trim(),
      body: args.body?.trim() || null,
      ...currentContext(args.route),
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ...(data as any), affected: 1, confirmed_by_me: false };
}

/** "Ik heb dit ook" aan of uit. */
export async function toggleBugConfirm(args: {
  reportId: string;
  userId: string;
  confirmed: boolean;
}): Promise<void> {
  if (args.confirmed) {
    const { error } = await supabase
      .from("bug_confirms")
      .delete()
      .eq("report_id", args.reportId)
      .eq("user_id", args.userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("bug_confirms")
    .insert({ report_id: args.reportId, user_id: args.userId });
  if (error) throw error;
}

export async function withdrawBug(reportId: string): Promise<void> {
  const { error } = await supabase.from("bug_reports").delete().eq("id", reportId);
  if (error) throw error;
}
