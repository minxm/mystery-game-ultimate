import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 深海军蓝背景 —— 柯南风核心底色
        dark: {
          900: '#040d1a',
          800: '#0a1830',
          700: '#0f2545',
          600: '#1a3560',
        },
        // 电光蓝主色调（替代旧的血红色，保留类名不动以兼容全部页面）
        blood: {
          500: '#1e90ff',
          600: '#0066cc',
        },
        // 红色危险/线索高亮
        danger: {
          500: '#e63946',
          600: '#c1121f',
        },
        // 金色推理高亮（发现关键线索时）
        clue: {
          400: '#ffd60a',
          500: '#e9c46a',
        },
        mystery: {
          500: '#4a5568',
          600: '#2d3748',
        }
      },
      fontFamily: {
        sans: ['var(--font-noto)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'fadeIn': 'fadeIn 0.5s ease-in',
        'slideUp': 'slideUp 0.6s ease-out',
        'scan-h': 'scanH 3s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scanH: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
