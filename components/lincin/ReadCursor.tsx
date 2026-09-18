import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Text, View } from "react-native";

import { mono } from "@/lib/design/type";
import { useT } from "@/lib/i18n";

/**
 * Is er een muis die kan zweven? Op native nooit; op web vraagt het de
 * browser (een laptop ja, een telefoon of tablet nee).
 */
export function canHover(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Zonder muis: een vast labeltje linksboven op de foto, "POST LEZEN →" —
 * wat de muis op desktop doet, staat hier gewoon op het beeld. Laat de
 * tik door naar wat eronder ligt.
 */
export function ReadTag() {
  const t = useT();
  return (
    <View style={{ pointerEvents: "none", position: "absolute", left: 8, top: 8, zIndex: 3, backgroundColor: "#141414", paddingVertical: 4, paddingHorizontal: 7 }}>
      <Text numberOfLines={1} style={[mono(600), { fontSize: 9, lineHeight: 12, letterSpacing: 1.1, textTransform: "uppercase", color: "#F2EFE8" }]}>
        {t.readPost} →
      </Text>
    </View>
  );
}

/**
 * De muis wordt "POST LEZEN →" boven iets dat een bijdrage opent (web,
 * met een muis). Een inktlabel volgt de pijl; de pijl zelf verdwijnt.
 * Gaat de muis naar een knop of link erbovenop, dan komt de gewone
 * pijl terug — die doen iets anders.
 *
 * Gebruik: `const read = useReadCursor();` → `ref={read.ref}` op de View
 * die het vlak is, en `{read.label}` als laatste kind erin (de View moet
 * `position: relative` zijn, wat in RN de standaard is).
 */
export function useReadCursor(): { ref: (node: unknown) => void; label: ReactNode } {
  const t = useT();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !node) return;
    // Alleen voor een echte muis: op aanraakschermen is er niets te zweven.
    if (!canHover()) return;
    const move = (e: MouseEvent) => {
      // Boven een knop of link die erbovenop ligt: de gewone pijl.
      const target = e.target as HTMLElement | null;
      const control = target?.closest?.('[role="button"], [role="link"], a, button, input, textarea');
      if (control && control !== node && node.contains(control)) {
        setPos(null);
        node.style.cursor = "";
        return;
      }
      const r = node.getBoundingClientRect();
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
      node.style.cursor = "none";
    };
    const leave = () => {
      setPos(null);
      node.style.cursor = "";
    };
    node.addEventListener("mousemove", move);
    node.addEventListener("mouseleave", leave);
    return () => {
      node.removeEventListener("mousemove", move);
      node.removeEventListener("mouseleave", leave);
      node.style.cursor = "";
    };
  }, [node]);

  const ref = (n: unknown) => {
    const el = (n as HTMLElement | null) ?? null;
    if (el !== nodeRef.current) {
      nodeRef.current = el;
      setNode(el);
    }
  };

  const label = pos ? (
    <View
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: pos.x + 12,
        top: pos.y + 12,
        zIndex: 20,
        backgroundColor: "#141414",
        paddingVertical: 6,
        paddingHorizontal: 9,
      }}
    >
      <Text numberOfLines={1} style={[mono(600), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: "#F2EFE8" }]}>
        {t.readPost} →
      </Text>
    </View>
  ) : null;

  return { ref, label };
}
