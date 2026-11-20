// Het allereerste wat de app laadt.
//
// `@stablelib/random` kijkt één keer, bij het importeren, of er een
// `crypto.getRandomValues` is, en onthoudt het antwoord. Op iOS en Android
// komt die pas van `react-native-get-random-values`; laadde dat later dan
// stablelib (zoals in lib/crypto/keys.ts, waar x25519 vóór ./random staat),
// dan faalde elke sleutel en elke versleuteling met "System random byte
// generator is not available". Hier staat het dus vóór al het andere.
import "react-native-get-random-values";
import "expo-router/entry";
