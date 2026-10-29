// fable: the frontier model's bar while it is fine, the same in every colour set.
export const NEUTRAL = {
  dark: { text: '#ecebe8', sub: '#a7a29c', mute: '#7c776f', groove: '#3a3835', casing: '#3b3936', nub: '#57534d', segOff: '#4a4743', bg: '#181818', fg: '#cccccc', fable: '#a78bfa' },
  light: { text: '#1f1e1c', sub: '#5c574f', mute: '#857f76', groove: '#dcd8d1', casing: '#e2ded7', nub: '#c9c3ba', segOff: '#d2cdc5', bg: '#ffffff', fg: '#3b3b3b', fable: '#6d28d9' },
};
// [plenty left, going fast, almost empty, accent]
export const PRESETS = {
  claude: { name: 'Claude', note: 'Warm, the default', dark: ['#7fd8a0', '#f3c467', '#ff7f86', '#e2885f'], light: ['#1d8a4e', '#a8690a', '#d0394a', '#c45f35'] },
  frost: { name: 'Frost', note: 'Cool and soft', dark: ['#a3be8c', '#ebcb8b', '#e07a85', '#88c0d0'], light: ['#4f7a3a', '#946708', '#b03a48', '#2e6f86'] },
  calm: { name: 'Calm', note: 'Grey until it matters', dark: ['#b5b0a8', '#f3c467', '#ff7f86', '#b5b0a8'], light: ['#6b665f', '#a8690a', '#d0394a', '#6b665f'], fable: 'good' },
  // Violet and this blue can look alike to colour-blind eyes, so Fable takes the set's own pink-purple.
  safe: { name: 'Colour-blind safe', note: 'Blue, yellow, orange', dark: ['#56b4e9', '#f0e442', '#ff8b4d', '#cc79a7'], light: ['#0072b2', '#8a7200', '#d55e00', '#a8457e'], fable: 'accent' },
  bold: { name: 'High contrast', note: 'Brightest, easiest to see', dark: ['#4ade80', '#facc15', '#f87171', '#fb923c'], light: ['#15803d', '#a16207', '#b91c1c', '#c2410c'] },
  ocean: { name: 'Ocean', note: 'Teal and blue', dark: ['#5eead4', '#fcd34d', '#fb7185', '#60a5fa'], light: ['#0f766e', '#a16207', '#be123c', '#1d4ed8'] },
  midnight: { name: 'Midnight', note: 'Soft night colours', dark: ['#9ece6a', '#e0af68', '#f7768e', '#7aa2f7'], light: ['#3f6b1c', '#8f5e15', '#b4334f', '#2e5bb8'] },
  vampire: { name: 'Vampire', note: 'Bright neon on dark', dark: ['#50fa7b', '#f1fa8c', '#ff5555', '#bd93f9'], light: ['#1f8a3b', '#7d6f00', '#d42e2e', '#7c4dce'] },
  candy: { name: 'Candy', note: 'Pastel and friendly', dark: ['#a6e3a1', '#f9e2af', '#f38ba8', '#cba6f7'], light: ['#2f7d1f', '#a0650d', '#d20f39', '#8839ef'] },
  forest: { name: 'Forest', note: 'Earthy, warm retro', dark: ['#b8bb26', '#fabd2f', '#fb4934', '#fe8019'], light: ['#6f6a0c', '#a86a10', '#9d0006', '#af3a03'] },
  sunset: { name: 'Sunset', note: 'Peach, orange, pink', dark: ['#ffd59e', '#ff9e64', '#ff5c8a', '#c792ea'], light: ['#7f6512', '#c2410c', '#be185d', '#7e22ce'] },
  solar: { name: 'Solar', note: 'Classic muted tones', dark: ['#859900', '#b58900', '#dc322f', '#268bd2'], light: ['#5f6e00', '#8a6a00', '#c0281f', '#1f6fa8'] },
  rose: { name: 'Rose', note: 'Dusty pink and pine', dark: ['#9ccfd8', '#f6c177', '#eb6f92', '#c4a7e7'], light: ['#286983', '#a35f17', '#b4506e', '#7d64a0'] },
};

export function palette(settings, theme) {
  const c = settings.colors;
  const preset = typeof c === 'string' ? PRESETS[c] || PRESETS.claude : null;
  const [good, watch, bad, accent] = preset
    ? preset[theme]
    : [c[theme].plentyLeft, c[theme].goingFast, c[theme].almostEmpty, c[theme].accent];
  const P = { ...NEUTRAL[theme], good, watch, bad, accent };
  if (preset?.fable) P.fable = P[preset.fable]; // a set can pick one of its own colours for Fable
  return P;
}

export const makeCtx = (data, settings, terminal) => ({
  P: palette(settings, terminal.theme), round: terminal.ends === 'round', settings, now: data.now, fit: {},
});

const TONE = { ok: 'good', warn: 'watch', crit: 'bad', fable: 'fable' };
export const tone = (ctx, level) => ctx.P[TONE[level]];
