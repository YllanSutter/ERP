/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ['class'],
    content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
			brand: {
				"50":  "rgb(var(--brand-50)  / <alpha-value>)",
				"100": "rgb(var(--brand-100) / <alpha-value>)",
				"200": "rgb(var(--brand-200) / <alpha-value>)",
				"300": "rgb(var(--brand-300) / <alpha-value>)",
				"400": "rgb(var(--brand-400) / <alpha-value>)",
				"500": "rgb(var(--brand-500) / <alpha-value>)",
				"600": "rgb(var(--brand-600) / <alpha-value>)",
				"700": "rgb(var(--brand-700) / <alpha-value>)",
				"800": "rgb(var(--brand-800) / <alpha-value>)",
				"900": "rgb(var(--brand-900) / <alpha-value>)",
			},
			vcolor: {
				"50":  "rgb(var(--vcolor-50)  / <alpha-value>)",
				"100": "rgb(var(--vcolor-100) / <alpha-value>)",
				"200": "rgb(var(--vcolor-200) / <alpha-value>)",
				"300": "rgb(var(--vcolor-300) / <alpha-value>)",
				"400": "rgb(var(--vcolor-400) / <alpha-value>)",
				"500": "rgb(var(--vcolor-500) / <alpha-value>)",
				"600": "rgb(var(--vcolor-600) / <alpha-value>)",
				"700": "rgb(var(--vcolor-700) / <alpha-value>)",
				"800": "rgb(var(--vcolor-800) / <alpha-value>)",
				"900": "rgb(var(--vcolor-900) / <alpha-value>)",
				"950": "rgb(var(--vcolor-950) / <alpha-value>)",
			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
