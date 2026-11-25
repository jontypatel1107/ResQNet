export const Colors = {
  // Brand colors
  primary: "#14283F", // Deep Navy
  primaryDark: "#0C1B2B",
  primaryLight: "#203A5B",

  emergency: "#E53935", // Emergency Red
  emergencyDark: "#C62828",
  emergencyLight: "#FFEBEE",

  success: "#168B70", // Success Green
  successDark: "#0E5C4A",
  successLight: "#E8F5E9",

  warning: "#F57C00", // Warning Amber
  warningLight: "#FFF3E0",

  info: "#0288D1",
  infoLight: "#E1F5FE",

  // Backgrounds & Surfaces
  background: "#F2F5F8",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  cardHover: "#F8FAFC",

  // Text
  textPrimary: "#14283F",
  textSecondary: "#5A6B7C",
  textMuted: "#8898AA",
  textWhite: "#FFFFFF",

  // Borders & Dividers
  border: "#E0E6ED",
  borderLight: "#EEF2F6",

  // Statuses
  status: {
    pending: "#F57C00",
    assigned: "#0288D1",
    accepted: "#168B70",
    in_progress: "#7B1FA2",
    resolved: "#2E7D32",
    cancelled: "#757575",
  },
};

export const Typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, color: Colors.textPrimary },
  h2: { fontSize: 22, fontWeight: "700" as const, color: Colors.textPrimary },
  h3: { fontSize: 18, fontWeight: "600" as const, color: Colors.textPrimary },
  body: { fontSize: 15, fontWeight: "400" as const, color: Colors.textPrimary },
  bodySecondary: { fontSize: 13, fontWeight: "400" as const, color: Colors.textSecondary },
  caption: { fontSize: 12, fontWeight: "400" as const, color: Colors.textMuted },
  button: { fontSize: 16, fontWeight: "600" as const, color: "#FFFFFF" },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
