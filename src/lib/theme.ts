"use client";

import { createTheme } from "@mui/material/styles";
import { tokens, mono, display, body } from "./tokens";

export { tokens, mono } from "./tokens";

/**
 * Design tokens and MUI theme. The listing borrows the wargaming datasheet its
 * audience already reads: condensed labels, serif body, mono figures, hairlines.
 * Brass is for data emphasis only — decorative use makes it generic.
 */



const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: tokens.brand, dark: tokens.brandDeep, light: "#4D84BD", contrastText: "#FFFFFF" },
    secondary: { main: tokens.brass, light: tokens.brassSoft, contrastText: "#241A05" },
    success: { main: tokens.positive },
    error: { main: tokens.danger },
    background: { default: tokens.surface, paper: tokens.paper },
    text: { primary: tokens.ink, secondary: tokens.inkMuted },
    divider: tokens.rule,
  },

  shape: { borderRadius: 6 },

  typography: {
    fontFamily: body,

    h1: {
      fontFamily: display,
      fontSize: "clamp(2.4rem, 6vw, 3.75rem)",
      fontWeight: 700,
      lineHeight: 1.04,
      letterSpacing: "-0.025em",
    },
    h2: {
      fontFamily: display,
      fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
      fontWeight: 700,
      lineHeight: 1.12,
      letterSpacing: "-0.02em",
    },
    h3: { fontFamily: display, fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.015em" },
    h4: { fontFamily: display, fontSize: "1.2rem", fontWeight: 600, lineHeight: 1.25 },
    h5: { fontFamily: display, fontSize: "1.05rem", fontWeight: 600 },
    h6: { fontFamily: display, fontSize: "0.95rem", fontWeight: 600 },

    // Larger than MUI's default; it's a reading face.
    body1: { fontFamily: body, fontSize: "1.0625rem", lineHeight: 1.6 },
    body2: { fontFamily: body, fontSize: "0.9375rem", lineHeight: 1.55 },

    // Eyebrow and stat labels.
    overline: {
      fontFamily: display,
      fontSize: "0.6875rem",
      fontWeight: 600,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      lineHeight: 1.4,
      fontStretch: "87.5%",
    },
    subtitle1: { fontFamily: display, fontSize: "1rem", fontWeight: 500 },
    subtitle2: { fontFamily: display, fontSize: "0.875rem", fontWeight: 600 },
    caption: { fontFamily: display, fontSize: "0.8125rem", lineHeight: 1.45 },
    button: { fontFamily: display, fontWeight: 600, textTransform: "none", letterSpacing: 0 },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Tabular figures so stat columns line up.
        "code, kbd, samp, .mono": { fontFamily: mono, fontVariantNumeric: "tabular-nums" },
        "::selection": { background: tokens.brandSoft, color: tokens.ink },
        "*:focus-visible": { outline: `2px solid ${tokens.brand}`, outlineOffset: "2px" },
      },
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 4,
          paddingInline: "1.1rem",
          "&.MuiButton-containedPrimary:hover": { backgroundColor: tokens.brandDeep },
        },
        sizeLarge: { paddingBlock: "0.65rem", paddingInline: "1.5rem", fontSize: "1rem" },
        outlined: { borderColor: tokens.rule, "&:hover": { borderColor: tokens.brand, background: "transparent" } },
      },
    },

    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: `1px solid ${tokens.rule}`,
          background: tokens.paper,
          transition: "border-color 120ms ease, box-shadow 120ms ease",
          "&:hover": { borderColor: "#B9C8DC", boxShadow: "0 1px 2px rgba(16,27,45,0.06)" },
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontFamily: display, fontWeight: 500, borderRadius: 3 },
        outlined: { borderColor: tokens.rule },
        sizeSmall: { fontSize: "0.75rem", height: 24 },
      },
    },

    MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },

    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 4, background: tokens.paper },
        notchedOutline: { borderColor: tokens.rule },
      },
    },

    MuiInputLabel: { styleOverrides: { root: { fontFamily: display } } },

    MuiAppBar: {
      defaultProps: { elevation: 0, color: "inherit", position: "sticky" },
      styleOverrides: {
        root: { borderBottom: `1px solid ${tokens.rule}`, backgroundImage: "none", background: tokens.paper },
      },
    },

    MuiLink: {
      defaultProps: { underline: "hover" },
      styleOverrides: { root: { fontFamily: "inherit", textUnderlineOffset: "0.15em" } },
    },

    MuiDivider: { styleOverrides: { root: { borderColor: tokens.rule } } },

    MuiSkeleton: { defaultProps: { animation: "wave" }, styleOverrides: { root: { backgroundColor: "#E9EFF6" } } },
  },
});

export default theme;
