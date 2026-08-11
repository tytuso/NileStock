import type { Config } from "tailwindcss";
export default {darkMode:"class",content:["./app/**/*.{ts,tsx}","./components/**/*.{ts,tsx}"],theme:{extend:{colors:{ink:"var(--ink)",muted:"var(--muted)",surface:"var(--surface)",line:"var(--line)",accent:"var(--accent)"},boxShadow:{soft:"0 12px 35px rgba(20,24,20,.08)"}}},plugins:[]} satisfies Config;
