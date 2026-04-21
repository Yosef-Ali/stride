import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../src/stores/session';
import { colors } from '../src/lib/tokens';

/**
 * Root router. Wait until the persisted session has hydrated, then branch:
 * signed-in → tabs; signed-out → login.
 */
export default function Index() {
  const hydrated = useSession((s) => s.hydrated);
  const userId = useSession((s) => s.userId);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
        }}
      >
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }
  return userId ? (
    <Redirect href="/(tabs)/home" />
  ) : (
    <Redirect href="/(onboarding)/login" />
  );
}
