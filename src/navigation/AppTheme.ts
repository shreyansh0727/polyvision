// src/navigation/AppTheme.ts
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────────
// Nexus Light tokens (unchanged)
// ─────────────────────────────────────────────────────────────────
export const tokens = {
  light: {
    teal:         '#01696f',
    tealHover:    '#0c4e54',
    bg:           '#f7f6f2',
    surface:      '#f9f8f5',
    card:         '#ffffff',
    text:         '#28251d',
    textMuted:    '#7a7974',
    textFaint:    '#bab9b4',
    border:       '#dcd9d5',
    divider:      '#dcd9d5',
    error:        '#a12c7b',
    success:      '#437a22',
    warning:      '#d19900',
    notification: '#a13544',
  },

  // ── "Mission Control" dark palette ─────────────────────────────
  dark: {
    // Surfaces
    bg:           '#080C14',
    surface:      '#0E1520',
    surfaceAlt:   '#131B28',
    surfaceLift:  '#1A2438',

    // Accents
    green:        '#10D876',
    greenGlow:    'rgba(16,216,118,0.18)',
    greenDim:     'rgba(16,216,118,0.08)',
    gold:         '#F4B942',
    goldDim:      'rgba(244,185,66,0.12)',
    rose:         '#F05A7E',
    roseDim:      'rgba(240,90,126,0.12)',
    blue:         '#4B8EF1',
    blueDim:      'rgba(75,142,241,0.12)',

    // Text
    textPrimary:  '#E8EDF5',
    textSub:      '#8A95A8',
    textFaint:    '#3D4A5C',

    // Borders
    border:       '#1C2840',
    borderBright: '#2A3B55',

    // React Navigation aliases (must satisfy Theme["colors"])
    primary:      '#10D876',   // green as primary
    card:         '#0E1520',   // surface
    text:         '#E8EDF5',   // textPrimary
    notification: '#F05A7E',   // rose
  },
} as const;

// ─────────────────────────────────────────────────────────────────
// MC — Mission Control shorthand (import this in every screen
//      instead of re-declaring `const C = { ... }` locally)
//
// Usage:
//   import { MC, MF } from '../../navigation/AppTheme';
//   backgroundColor: MC.bg
// ─────────────────────────────────────────────────────────────────
export const MC = tokens.dark;

// ─────────────────────────────────────────────────────────────────
// MF — Mission Control font families
//      Replaces the local `const F = { ... }` in every screen
//
// Usage:
//   fontFamily: MF.mono
// ─────────────────────────────────────────────────────────────────
export const MF = {
  display: Platform.select({
    ios:     'Georgia',
    android: 'serif',
    default: 'Georgia',
  }) as string,
  mono: Platform.select({
    ios:     'Menlo',
    android: 'monospace',
    default: 'monospace',
  }) as string,
};

// ─────────────────────────────────────────────────────────────────
// avatarColor — deterministic per-name colour from MC accent palette
//               Replaces the local helper copied across screens
//
// Usage:
//   import { avatarColor } from '../../navigation/AppTheme';
//   borderColor: avatarColor(employee.name)
// ─────────────────────────────────────────────────────────────────
const AVATAR_PALETTE = [MC.green, MC.gold, MC.blue, '#A78BFA', '#FB923C'];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// ─────────────────────────────────────────────────────────────────
// React Navigation themes
// ─────────────────────────────────────────────────────────────────
export const LightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary:      tokens.light.teal,
    background:   tokens.light.bg,
    card:         tokens.light.card,
    text:         tokens.light.text,
    border:       tokens.light.border,
    notification: tokens.light.notification,
  },
};

export const AppDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary:      MC.green,
    background:   MC.bg,
    card:         MC.card,
    text:         MC.text,
    border:       MC.border,
    notification: MC.notification,
  },
};

// ─────────────────────────────────────────────────────────────────
// Legacy aliases — keep until all imports are migrated
// ─────────────────────────────────────────────────────────────────
/** @deprecated use LightTheme */
export const AppTheme = LightTheme;

/** @deprecated use MC.green */
export const TEAL   = tokens.light.teal;
/** @deprecated use MC.textSub */
export const MUTED  = tokens.light.textMuted;
/** @deprecated use MC.bg */
export const BG     = tokens.light.bg;
/** @deprecated use MC.card (light) */
export const WHITE  = tokens.light.card;
/** @deprecated use MC.border */
export const BORDER = tokens.light.border;
/** @deprecated use MC.text */
export const TEXT   = tokens.light.text;