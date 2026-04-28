import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../src/lib/tokens';
import { useSession } from '../src/stores/session';

export default function RootLayout() {
  const hydrate = useSession((s) => s.hydrate);
  const hydrated = useSession((s) => s.hydrated);
  const userId = useSession((s) => s.userId);
  const segments = useSegments();
  const router = useRouter();

  // Load persisted session once.
  useEffect(() => {
    hydrate().catch((e) => console.warn('hydrate failed', e));
  }, [hydrate]);

  // Auth gate.
  //   - Signed-out and trying to view the app → push to login.
  //   - Signed-in and stuck on the onboarding welcome → push into the app.
  // We deliberately allow signed-in users to visit /(onboarding)/login when
  // they tap Sign out, because signOut() clears userId before the navigation.
  useEffect(() => {
    if (!hydrated) return;
    const inOnboarding = segments[0] === '(onboarding)';
    const onWelcome = inOnboarding && (segments[1] === undefined || segments[1] === 'index');
    if (!userId && !inOnboarding) {
      router.replace('/(onboarding)/login');
    } else if (userId && onWelcome) {
      router.replace('/(tabs)/home');
    }
  }, [hydrated, userId, segments, router]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!hydrated ? (
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
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.surface },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen
              name="log-walk"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                gestureEnabled: true,
              }}
            />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
