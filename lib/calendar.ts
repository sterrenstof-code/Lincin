import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Linking from "expo-linking";

export type CalendarEvent = {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toICSDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  );
}

function generateICS(event: CalendarEvent): string {
  const uid = `${Date.now()}@lincin`;
  const now = toICSDate(new Date());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Lincin//Lincin//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toICSDate(event.startsAt)}`,
    `DTEND:${toICSDate(event.endsAt)}`,
    `SUMMARY:${event.title}`,
    event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export async function downloadCalendarEvent(event: CalendarEvent): Promise<void> {
  const ics = generateICS(event);
  const filename = `${event.title.replace(/[^a-z0-9]/gi, "_")}.ics`;

  if (Platform.OS === "web") {
    // Trigger browser download
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Native: schrijf naar tijdelijk bestand en open met OS calendar app
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, ics, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Linking.openURL(path);
}
