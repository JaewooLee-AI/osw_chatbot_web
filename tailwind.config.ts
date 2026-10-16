import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0F2942",
          dark: "#001428",
          light: "#1E3F60",
        },
        coral: {
          DEFAULT: "#FF5A36",
          hover: "#E64A28",
          soft: "#FFF0EC",
        },
        ivory: {
          DEFAULT: "#FAF8F5",
          sand: "#F5F3F0",
          border: "#E4E2DF",
        },
        sky: {
          DEFAULT: "#38B6FF",
          tint: "#EBF5FB",
        },
        kakao: {
          DEFAULT: "#FEE500",
          text: "#191919",
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "Noto Sans KR",
          "sans-serif",
        ],
        serif: ["Noto Serif KR", "Noto Serif", "serif"],
      },
      boxShadow: {
        concierge:
          "0 24px 48px -12px rgba(15, 41, 66, 0.20), 0 8px 16px -4px rgba(15, 41, 66, 0.08)",
        card: "0 4px 20px -4px rgba(15, 41, 66, 0.06), 0 2px 6px -2px rgba(15, 41, 66, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
