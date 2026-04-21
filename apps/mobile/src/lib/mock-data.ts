// Mock data for step 4. Replaces real Health Connect reads (step 5) and
// real Neon queries (step 7+). Values mirror the design spec so Home/Circle
// look right out of the box.

export type MockWalk = {
  date: string; // YYYY-MM-DD
  distanceKm: number;
  steps: number;
  activeMinutes: number;
};

const DAY = 86400000;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Mon..Sun distances mirroring the design ([5.2, 6.1, 8.8, 4.9, 7.3, 9.1, 6.3]). */
export function getThisWeek(): { walks: MockWalk[]; todayIdx: number } {
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - dayOfWeek);

  const plan = [5.2, 6.1, 8.8, 4.9, 7.3, 9.1, 6.3];
  const walks: MockWalk[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * DAY);
    const future = i > dayOfWeek;
    const km = future ? 0 : plan[i]!;
    return {
      date: d.toISOString().slice(0, 10),
      distanceKm: km,
      steps: Math.round(km * 1350),
      activeMinutes: Math.round(km * 11),
    };
  });

  return { walks, todayIdx: dayOfWeek };
}

/** Stats for today's ring + side stats. */
export function getTodayStats() {
  const { walks, todayIdx } = getThisWeek();
  const today = walks[todayIdx]!;
  return {
    date: today.date,
    distanceKm: today.distanceKm,
    steps: today.steps,
    activeMinutes: today.activeMinutes,
    // Mock pace: km/h from distance and active min
    paceKmh: today.activeMinutes > 0
      ? Number((today.distanceKm / (today.activeMinutes / 60)).toFixed(1))
      : 0,
  };
}

/** Fake circle standings (replaced in step 7 with real leaderboard query). */
export function getMockCircleComparison() {
  return { percentAboveAverage: 12 };
}

export function greet(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAYS = [
  'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday',
];
export function formatLongDate(d = new Date()) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
