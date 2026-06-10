import { createTheme, type Theme } from "@mui/material/styles";

// Bridges MUI/Emotion (used by material-react-table) to the app's Tailwind v4
// CSS variables (src/mainview/index.css) so the MRT table matches the lime/dark
// design. Reads the variables once from :root — index.css stays the single
// source of truth. No CssBaseline is applied anywhere, so Tailwind is untouched.

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

let cached: Theme | null = null;

export function getMuiTheme(): Theme {
  if (cached) return cached;

  const background = cssVar("--background", "#111115");
  const card = cssVar("--card", "#18181f");
  const primary = cssVar("--primary", "#a3e635");
  const primaryFg = cssVar("--primary-foreground", "#000000");
  const foreground = cssVar("--foreground", "#f3f4f6");
  const mutedFg = cssVar("--muted-foreground", "#a1a1aa");
  const border = cssVar("--border", "#27272a");

  cached = createTheme({
    palette: {
      mode: "dark",
      background: {
        // MRT paints the table surface with `paper`; keep it on the darker
        // background so rows read against the card chrome around them.
        default: card,
        paper: background,
      },
      primary: { main: primary, contrastText: primaryFg },
      text: { primary: foreground, secondary: mutedFg },
      divider: border,
    },
    typography: {
      fontFamily:
        "'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    components: {
      MuiTableCell: {
        styleOverrides: {
          // Match the classic table's px-3 py-2.5 density.
          root: {
            paddingTop: 10,
            paddingBottom: 10,
            paddingLeft: 12,
            paddingRight: 12,
            borderColor: border,
            fontSize: "0.875rem",
          },
          // Header row: uppercase / bold / xs, mirroring the classic
          // "text-muted-foreground text-xs font-bold uppercase tracking-wider".
          head: {
            color: mutedFg,
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            backgroundColor: background,
          },
        },
      },
    },
  });

  return cached;
}
