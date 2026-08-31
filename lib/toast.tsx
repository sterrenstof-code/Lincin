import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  creamOnDark,
  FEED_BORDER,
  feedType,
  flame,
  shell,
  space,
} from "@/lib/design/type";

/**
 * De strook bovenaan die zegt wat er zojuist misging.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * Eenentwintig plekken in de app vingen een fout op en schreven hem naar
 * `console.warn`. Op de chatlijst was dat scherp zichtbaar: de rij wordt
 * optimistisch uit de cache getrokken, de mutatie faalt, de query wordt
 * ongeldig verklaard — en de rij komt zonder één woord terug. Je hebt op
 * "verwijder definitief" gedrukt, er gebeurt iets, en dan staat het er weer.
 *
 * Een optimistische update is een belofte. Wordt die teruggedraaid, dan
 * hoort er te staan dát hij teruggedraaid is; anders lijkt de app kapot in
 * plaats van eerlijk.
 *
 * ---------------------------------------------------------------
 * DE VORM
 * ---------------------------------------------------------------
 * `bg-shell`-zwart met crème tekst — een van de drie paren uit DESIGN.md
 * §2 die in béide standen donker blijven. Dat is hier geen toeval: deze
 * strook ligt óp de pagina in plaats van erin, dus hij mag niet meekantelen
 * met het blad eronder, anders leest hij als een blok in de pagina.
 *
 * Bij een fout krijgt hij een linkerkant in `flame`. Geen tweede kleurvlak
 * en geen icoon: één lijn is genoeg om te zeggen dat dit geen bevestiging is.
 *
 * De beweging is die van `ModalShell` — 200ms op, 140ms af, 8px. Eén
 * beweging in de app, niet twee die op elkaar lijken. Hij komt van bóven,
 * want daar staat hij; zie de uitleg bij `ToastLayer`.
 */

type ToastTone = "info" | "error";

type ToastAction = { label: string; onPress: () => void };

type ToastOptions = {
  tone?: ToastTone;
  /** Eén knop rechts in de strook — meestal "Opnieuw". */
  action?: ToastAction;
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
  action?: ToastAction;
};

type ToastApi = {
  show: (message: string, options?: ToastOptions) => void;
  /** Kortere weg voor `show(msg, { tone: "error" })`. */
  error: (message: string, options?: Omit<ToastOptions, "tone">) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/**
 * Hoe lang de strook blijft staan.
 *
 * Een fout krijgt langer dan een bevestiging: bij een bevestiging weet je
 * al wat er staat voordat je het leest, bij een fout moet je hem lezen. Met
 * een knop erbij nog langer — anders is de knop weg voordat je hem raakt.
 */
function lifetimeMs(item: ToastItem): number {
  if (item.action) return 7000;
  return item.tone === "error" ? 5000 : 3200;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const nextId = useRef(0);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    nextId.current += 1;
    setItem({
      id: nextId.current,
      message,
      tone: options.tone ?? "info",
      action: options.action,
    });
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (message, options) => show(message, { ...options, tone: "error" }),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {/* De strook is een broer van de pagina en geen kind ervan: hij ligt
          erbovenop en mag niet meescrollen. Vandaar de vullende View. */}
      <View style={{ flex: 1 }}>
        {children}
        <ToastLayer item={item} onDismiss={() => setItem(null)} />
      </View>
    </ToastContext.Provider>
  );
}

/**
 * Buiten een `ToastProvider` is dit geen fout maar een stilte: de strook
 * hoort nergens de reden te zijn dat een scherm niet meer laadt. Wie geen
 * provider boven zich heeft (een los gerenderd onderdeel in een test)
 * krijgt een no-op.
 */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  return ctx ?? NOOP_TOAST;
}

const NOOP_TOAST: ToastApi = { show: () => {}, error: () => {} };

function ToastLayer({
  item,
  onDismiss,
}: {
  item: ToastItem | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  // We houden de laatste strook vast tijdens het wegvallen, anders is de
  // tekst al weg voordat de beweging klaar is.
  const [shown, setShown] = useState<ToastItem | null>(null);

  useEffect(() => {
    if (item) setShown(item);
    Animated.timing(anim, {
      toValue: item ? 1 : 0,
      duration: item ? 200 : 140,
      easing: item ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !item) setShown(null);
    });
  }, [item, anim]);

  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(onDismiss, lifetimeMs(item));
    return () => clearTimeout(timer);
    // `item.id` en niet `item`: een nieuwe strook met dezelfde tekst moet
    // de klok opnieuw starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  if (!shown) return null;

  const isError = shown.tone === "error";

  return (
    <View
      // Zonder dit vangt de laag de tikken op van de pagina eronder, over
      // de volle breedte, ook als er niets staat.
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // Bovenaan, en niet onderaan.
        //
        // Onderaan is waar in deze app het werk gebeurt: de berichtenbalk
        // in een gesprek, de zwevende deelknop op de feed. Een strook van
        // ~60 punten die daar vijf seconden overheen ligt bedekt precies
        // het veld waarin je aan het typen was — en omdat hij zijn eigen
        // tikken opvangt, kon je er ook niet doorheen drukken. Op native
        // ligt bovendien het toetsenbord in een venster boven de app, dus
        // een strook onderaan verdween daar gewoon achter.
        //
        // Bovenaan ligt alleen de kopbalk. Die overdekken kost vier
        // seconden navigatie en niets waar je middenin zat.
        top: 0,
        paddingTop: insets.top + space.sm,
        paddingHorizontal: space.lg,
        alignItems: "center",
      }}
    >
      <Animated.View
        style={{
          width: "100%",
          maxWidth: 460,
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            },
          ],
        }}
      >
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion={isError ? "assertive" : "polite"}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            // Blijft zwart in béide standen — zie de kop van dit bestand.
            // Via het token, niet via een hex: §7.
            backgroundColor: shell,
            borderWidth: FEED_BORDER,
            borderColor: isError ? flame : creamOnDark.rule,
            borderLeftWidth: isError ? 4 : FEED_BORDER,
            borderLeftColor: isError ? flame : creamOnDark.rule,
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            minHeight: 44,
          }}
        >
          <Text
            style={[
              feedType.body,
              { color: creamOnDark.DEFAULT, flex: 1 },
            ]}
          >
            {shown.message}
          </Text>

          {shown.action ? (
            <Pressable
              onPress={() => {
                onDismiss();
                shown.action?.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={shown.action.label}
              hitSlop={8}
              style={{
                paddingHorizontal: space.md,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: FEED_BORDER,
                borderColor: creamOnDark.DEFAULT,
              }}
            >
              <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
                {shown.action.label.toUpperCase()}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Melding sluiten"
            hitSlop={12}
            style={{ paddingHorizontal: space.xs }}
          >
            <Text
              style={[feedType.label, { color: creamOnDark.muted, fontSize: 15 }]}
            >
              ✕
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}
