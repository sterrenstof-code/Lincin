import { Component, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Vangt onverwachte React-render-errors op zodat we niet op een wit scherm
 * eindigen — vooral nuttig op web waar de Hermes-style red box ontbreekt.
 * Toont een paper-cream fallback met reload-knop en, in dev, de stacktrace.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Loggen naar console zodat we het in DevTools terugzien. Voor MVP geen
    // remote logging — voegen we later toe (Sentry, Logflare, whatever).
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload = () => {
    if (typeof window !== "undefined" && window.location) {
      window.location.reload();
    } else {
      this.setState({ error: null });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const isDev = typeof __DEV__ !== "undefined" && __DEV__;
    return (
      <View className="flex-1 bg-shell items-center justify-center px-8">
        <View className="bg-paper rounded-3xl p-6 w-full max-w-md">
          <Text className="text-ink text-2xl font-bold mb-2">
            Er ging iets mis.
          </Text>
          <Text className="text-ink-soft text-base mb-5 leading-6">
            Lincin liep tegen een onverwachte fout aan. Laad opnieuw — meestal
            is dat genoeg. Blijft het terugkomen, geef ons een seintje.
          </Text>
          <Pressable
            onPress={this.handleReload}
            className="bg-ink active:bg-ink-soft rounded-full px-6 py-3 items-center"
          >
            <Text className="text-cream font-semibold">Herlaad app</Text>
          </Pressable>
          {isDev && (
            <View className="mt-5 pt-5 border-t border-line-paper">
              <Text className="text-ink-muted text-xs font-mono">
                {this.state.error.name}: {this.state.error.message}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }
}
