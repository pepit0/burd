/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#181e16",
        foreground: "#eee8d4",
        card: "#1f2a1c",
        "card-foreground": "#eee8d4",
        popover: "#1f2a1c",
        primary: "#5f9470",
        "primary-foreground": "#f0ead6",
        secondary: "#2a3826",
        "secondary-foreground": "#eee8d4",
        muted: "#243020",
        "muted-foreground": "#8a9e82",
        accent: "#c8893a",
        "accent-foreground": "#181e16",
        destructive: "#c0392b",
        border: "#2f3a2b",
      },
      fontFamily: {
        sans: ["DMSans_400Regular"],
        "sans-medium": ["DMSans_500Medium"],
        "sans-bold": ["DMSans_700Bold"],
        serif: ["Lora_500Medium"],
        "serif-regular": ["Lora_400Regular"],
        "serif-semibold": ["Lora_600SemiBold"],
        "serif-bold": ["Lora_700Bold"],
        "serif-italic": ["Lora_400Regular_Italic"],
        mono: ["JetBrainsMono_400Regular"],
        "mono-medium": ["JetBrainsMono_500Medium"],
      },
    },
  },
  plugins: [],
};
