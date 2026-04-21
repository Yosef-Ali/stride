import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { colors } from '../../src/lib/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.surface },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="circle" />
      <Tabs.Screen name="stats" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
