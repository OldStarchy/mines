/** A well-formed model response for tests, with both glyph kinds. */
export function oceanTheme() {
	return {
		name: 'Ocean',
		colorScheme: 'dark',
		palette: {
			bg: '#04222E',
			surface: '#0a3140',
			text: '#e2f3f7',
			muted: '#8fb7c2',
			border: '#155466',
			bevelLight: '#2a7793',
			bevelDark: '#021820',
			cellHidden: '#0e4256',
			cellHiddenHover: '#125068',
			cellRevealed: '#062b3a',
			cellHit: '#e04f4f',
			accent: '#3fd0c9',
			warningBg: '#3a2e0d',
			warningText: '#f0d264',
			hlTarget: '#ffa657',
			hlGroup: '#3fd0c955',
			hlSource: '#d2a8ff',
			numbers: [
				'#58a6ff',
				'#3fb950',
				'#ff7b72',
				'#bc8cff',
				'#f2cc60',
				'#39c5cf',
				'#e6edf3',
				'#8b949e',
			],
		},
		glyphs: {
			flag: '<svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="6" fill="#ff9dd5"/><path d="M8 14 L7 21" stroke="#ff9dd5"/></svg>',
			mine: '🐡',
			boom: '💥',
			wrong: '❌',
		},
		flourish: '🌊',
		watermark:
			'<svg viewBox="0 0 440 440" fill="#3fd0c9"><path d="M0 300 Q110 220 220 300 T440 300 V440 H0 Z"/></svg>',
	};
}
