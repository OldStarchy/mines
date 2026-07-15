/**
 * The floating reveal/flag mode switch. Lives in the fixed control
 * cluster next to the zoom buttons, so it stays on screen (and at
 * screen scale) however the board is panned or zoomed.
 */
export default function FlagModeToggle({
	flagMode,
	onChange,
}: {
	flagMode: boolean;
	onChange: (flagMode: boolean) => void;
}) {
	return (
		<button
			type="button"
			className={`fab fab-mode${flagMode ? ' fab-active' : ''}`}
			title={
				flagMode
					? 'Flag mode: tap places flags (tap to switch)'
					: 'Dig mode: tap reveals (tap to switch)'
			}
			aria-pressed={flagMode}
			aria-label="Flag mode"
			onClick={() => onChange(!flagMode)}
		>
			{flagMode ? (
				<span className="glyph-flag" />
			) : (
				<span className="glyph-dig" />
			)}
		</button>
	);
}
