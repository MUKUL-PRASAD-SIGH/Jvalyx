/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#090b0e',
          subtle: '#0e1218',
          card: '#131821',
          elevated: '#19202c',
        },
        border: {
          subtle: '#1e2633',
          DEFAULT: '#273244',
          bold: '#3b4a63',
          highlight: '#526685',
        },
        hazard: {
          critical: '#f43f5e',
          criticalBg: '#3f121a',
          criticalBorder: '#881337',
          high: '#f97316',
          highBg: '#371808',
          highBorder: '#7c2d12',
          uncertain: '#eab308',
          uncertainBg: '#382a06',
          uncertainBorder: '#854d0e',
          normal: '#06b6d4',
          normalBg: '#082f38',
          normalBorder: '#164e63',
          mining: '#a855f7',
          miningBg: '#2e1047',
          miningBorder: '#581c87',
        },
        telemetry: {
          cyan: '#38bdf8',
          amber: '#fbbf24',
          emerald: '#34d399',
          crimson: '#fb7185',
          violet: '#c084fc',
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'solid-sm': '2px 2px 0px 0px rgba(0, 0, 0, 0.8)',
        'solid-md': '4px 4px 0px 0px rgba(0, 0, 0, 0.9)',
        'solid-cyan': '3px 3px 0px 0px #0891b2',
        'solid-rose': '3px 3px 0px 0px #9f1239',
        'solid-amber': '3px 3px 0px 0px #92400e',
      }
    },
  },
  plugins: [],
}
