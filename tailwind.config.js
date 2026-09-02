/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Obsidian space-black ground
        obsidian: {
          950: "#05070B",
          900: "#080B10",
          850: "#0C1017",
          800: "#11161F",
          750: "#161C28",
          700: "#1D2533",
          600: "#2A3444",
        },
        // Signal palette
        nominal: "#00F0FF", // cyan — nominal telemetry / active sat
        cyandeep: "#0891b2",
        violet: {
          DEFAULT: "#A855F7",
          soft: "#c084fc",
        },
        warn: "#FFB020", // amber — warning / staged
        crit: "#FF3B4E", // crimson — critical proximity alarm
        safe: "#20E39B", // emerald — nominal / cleared
      },
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "SFMono-Regular", "Menlo", "Consolas", "monospace"],
        sans: ['"Inter"', "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.28em",
      },
      boxShadow: {
        "glow-cyan": "0 0 24px -4px rgba(0, 240, 255, 0.45), inset 0 0 20px -12px rgba(0,240,255,0.25)",
        "glow-violet": "0 0 24px -4px rgba(168, 85, 247, 0.45)",
        "glow-crit": "0 0 28px -4px rgba(255, 59, 78, 0.55)",
        "glow-amber": "0 0 24px -4px rgba(255, 176, 32, 0.45)",
        "glow-safe": "0 0 26px -4px rgba(32, 227, 155, 0.5)",
        "panel": "0 24px 70px -24px rgba(0,0,0,0.85), inset 0 1px 0 0 rgba(255,255,255,0.03)",
      },
      backdropBlur: {
        xs: "2px",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.82)" },
        },
        "hazard-flash": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "scan-y": {
          "0%": { transform: "translateY(-120%)" },
          "100%": { transform: "translateY(2400%)" },
        },
        "sweep-x": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "stream-in": {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "ring-ping": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "75%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        "gauge-fill": {
          from: { "stroke-dashoffset": "var(--from, 999)" },
          to: { "stroke-dashoffset": "var(--to, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
        "hazard-flash": "hazard-flash 1s steps(2, jump-none) infinite",
        "scan-y": "scan-y 5s linear infinite",
        "sweep-x": "sweep-x 3.5s ease-in-out infinite",
        "stream-in": "stream-in 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)",
        "ring-ping": "ring-ping 1.9s cubic-bezier(0,0,0.2,1) infinite",
        shimmer: "shimmer 2.6s linear infinite",
      },
    },
  },
  plugins: [],
};
