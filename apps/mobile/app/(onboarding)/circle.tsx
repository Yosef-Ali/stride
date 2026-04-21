import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle as SvgCircle, Path, Rect } from 'react-native-svg';
import {
  Heading,
  OnboardingShell,
  Sub,
} from '../../src/components/onboarding/OnboardingShell';
import { useOnboarding, type CircleChoice } from '../../src/stores/onboarding';
import { colors } from '../../src/lib/tokens';

export default function CircleChoiceScreen() {
  const router = useRouter();
  const { choice, setChoice } = useOnboarding();

  const pick = (c: CircleChoice) => {
    setChoice(c);
    if (c === 'create') router.push('/(onboarding)/create');
    else if (c === 'join') router.push('/(onboarding)/join');
  };

  return (
    <OnboardingShell
      step={4}
      footer={
        <Pressable
          style={{ alignItems: 'center', paddingVertical: 10 }}
          onPress={() => router.replace('/(tabs)/home')}
        >
          <Text style={styles.skip}>
            Skip for now ·{' '}
            <Text style={{ color: colors.tealDeep }}>add people later</Text>
          </Text>
        </Pressable>
      }
    >
      <View style={{ paddingTop: 40 }}>
        <Heading>Your circle</Heading>
        <Sub>Walk alongside 2–10 people you know.</Sub>
      </View>

      <View style={styles.options}>
        <OptionCard
          selected={choice === 'create'}
          title="Create a new circle"
          desc="Invite friends or family with a link"
          onPress={() => pick('create')}
          icon={
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <SvgCircle
                cx={9}
                cy={9}
                r={3.2}
                stroke={colors.teal}
                strokeWidth={1.8}
              />
              <SvgCircle
                cx={17}
                cy={10}
                r={2.4}
                stroke={colors.teal}
                strokeWidth={1.8}
              />
              <Path
                d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"
                stroke={colors.teal}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
              <Path
                d="M15 19c.2-2.4 2-4.4 4.2-4.6"
                stroke={colors.teal}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          }
        />
        <OptionCard
          selected={choice === 'join'}
          title="Join with a code"
          desc="Paste an invite from someone"
          onPress={() => pick('join')}
          icon={
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Rect
                x={4}
                y={5}
                width={16}
                height={14}
                rx={2}
                stroke={colors.ink}
                strokeWidth={1.8}
              />
              <Path
                d="M8 5V3.5 M16 5V3.5 M4 10h16"
                stroke={colors.ink}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            </Svg>
          }
        />
      </View>

      <View style={{ flex: 1 }} />
    </OnboardingShell>
  );
}

function OptionCard({
  icon,
  title,
  desc,
  selected,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.card,
          selected && styles.cardSelected,
        ]}
      >
        <View
          style={[
            styles.iconBox,
            { backgroundColor: selected ? '#fff' : '#F0F0EC' },
          ]}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{desc}</Text>
        </View>
        <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
          <Path
            d="M6 3l5 5-5 5"
            stroke={selected ? colors.teal : colors.faint}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  options: { marginTop: 32, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
    borderWidth: 1.5,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    letterSpacing: -0.1,
  },
  desc: { fontSize: 13, color: colors.muted, marginTop: 2 },
  skip: { fontSize: 13, color: colors.muted, letterSpacing: 0.1 },
});
