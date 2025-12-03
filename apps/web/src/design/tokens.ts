// apps/web/src/design/tokens.ts

export const colors = {
  // Brand
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  primaryActive: "#1e40af",

  // Neutrals
  bg: "#0f172a",
  bgElevated: "#111827",
  bgSubtle: "#020617",
  borderSubtle: "#1f2937",
  borderStrong: "#374151",
  textPrimary: "#f9fafb",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",

  // Semantic
  success: "#22c55e",
  successSoft: "#064e3b",
  warning: "#facc15",
  warningSoft: "#451a03",
  danger: "#ef4444",
  dangerSoft: "#450a0a",
  info: "#38bdf8",
  infoSoft: "#082f49",

  // Misc
  focusRing: "#38bdf8",
  overlay: "rgba(15,23,42,0.75)",
};

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
};

export const typography = {
  fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif`,
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
  },
  fontWeight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

export const shadows = {
  sm: "0 1px 2px rgba(15,23,42,0.5)",
  md: "0 4px 8px rgba(15,23,42,0.65)",
  lg: "0 12px 24px rgba(15,23,42,0.8)",
};

export const transitions = {
  fast: "150ms ease-out",
  base: "200ms ease-out",
};

