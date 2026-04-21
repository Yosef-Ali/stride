export const colors = {
  teal: '#1D9E75',
  tealDeep: '#0F7A58',
  tealSoft: '#E6F4EF',
  amber: '#EF9F27',
  amberDeep: '#C47B10',
  amberSoft: '#FAEEDA',
  ink: '#0A0A0A',
  text: '#1A1A1A',
  muted: '#6B6B6B',
  faint: '#9A9A9A',
  ghost: '#CCCCC6',
  line: '#ECECEC',
  lineSoft: '#F0F0EC',
  canvas: '#EFEEEA',
  surface: '#F6F6F4',
  card: '#FFFFFF',
  danger: '#D2453F',
} as const;

export const radius = { md: 8, lg: 12, xl: 16 } as const;

export const fontWeights = { regular: '400' as const, medium: '500' as const };

export const fontFamily =
  'System';

export const type = {
  display: { fontSize: 28, fontWeight: fontWeights.medium, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: fontWeights.medium, letterSpacing: -0.4 },
  heading: { fontSize: 17, fontWeight: fontWeights.medium, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: fontWeights.regular, letterSpacing: -0.1 },
  caption: { fontSize: 13, fontWeight: fontWeights.regular, letterSpacing: 0.1 },
  label: { fontSize: 12, fontWeight: fontWeights.regular, letterSpacing: 0.1 },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeights.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  metric: {
    fontSize: 56,
    fontWeight: fontWeights.medium,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'] as const,
  },
};

export const avatarPalette = [
  '#C49A6C',
  '#8C7B9B',
  '#D08A8A',
  '#6E8FAE',
  '#7A9E7E',
  '#B88A64',
] as const;
