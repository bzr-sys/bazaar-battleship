/* eslint-env node */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // "Sonar": a ship's combat console. Dark only.
      colors: {
        sonar: {
          deep: "#031018",
          bg: "#04121A",
          water: "#061B25",
          panel: "#071C27",
          raised: "#0A2230",
          grid: "#0E3646",
          line: "#12465A",
          edge: "#1E6E7E",
          cyan: "#46E3D2",
          "cyan-hi": "#9FF5EC",
          bright: "#E6FFFB",
          text: "#BFEFE9",
          muted: "#8FCFC8",
          dim: "#5FA9A1",
          amber: "#FFB347",
          "amber-hi": "#FFC873",
          "amber-deep": "#2A1A08",
          flare: "#FF7A45",
          "flare-text": "#FF9B6A",
        },
      },
      fontFamily: {
        display: ['"Chakra Petch"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
