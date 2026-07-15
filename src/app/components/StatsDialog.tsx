import { Dialog } from '@base-ui/react/dialog';
import { useMemo, useState } from 'react';
import type { GameConfig } from '../../domain/game/Game';
import { configKey, parseConfigKey } from '../../domain/game/scenario';
import { loadAllStats, normalizeStats } from '../stats';
import { configLabel } from './presets';
import ThemedSelect from './ThemedSelect';

function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Lifetime statistics per board configuration: outcome counters, how
 * flags got placed (and how well), and the best-times scoreboard with
 * assists and click ratio (raw clicks / mines — lower is sharper).
 */
export default function StatsDialog({ config }: { config: GameConfig }) {
	const [open, setOpen] = useState(false);
	const [picked, setPicked] = useState<string | null>(null);

	// Reloaded on every open, so freshly finished games show up.
	const all = useMemo(() => (open ? loadAllStats() : {}), [open]);

	const currentKey = configKey(config);
	const keys = [...new Set([currentKey, ...Object.keys(all)])];
	const key = picked && keys.includes(picked) ? picked : currentKey;
	const stats = normalizeStats(all[key]);

	const counters = [
		['Played', stats.played],
		['Won', stats.won],
		['Lost', stats.lost],
		['Abandoned', stats.abandoned],
	] as const;

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger
				className="button button-icon"
				aria-label="Statistics"
			>
				🏆
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="dialog-backdrop" />
				<Dialog.Popup className="dialog">
					<Dialog.Title className="dialog-title">
						Statistics
					</Dialog.Title>

					<ThemedSelect
						ariaLabel="Statistics board"
						value={key}
						items={Object.fromEntries(
							keys.map((k) => {
								const config = parseConfigKey(k);
								return [k, config ? configLabel(config) : k];
							}),
						)}
						onValueChange={setPicked}
					/>

					<div className="stats-counters">
						{counters.map(([label, value]) => (
							<div key={label} className="stats-counter">
								<span className="stats-value">{value}</span>
								<span className="field-label">{label}</span>
							</div>
						))}
					</div>

					<table className="stats-table">
						<thead>
							<tr>
								<th>Flags placed</th>
								<th>Correct</th>
								<th>Wrong</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th>Manually</th>
								<td>{stats.flags.manual.correct}</td>
								<td>{stats.flags.manual.incorrect}</td>
							</tr>
							<tr>
								<th>By chords</th>
								<td>{stats.flags.chorded.correct}</td>
								<td>{stats.flags.chorded.incorrect}</td>
							</tr>
						</tbody>
					</table>
					<p className="stats-note">Chords played: {stats.chords}</p>

					<h3 className="stats-heading">Best times</h3>
					{stats.board.length === 0 ? (
						<p className="stats-note">No wins yet.</p>
					) : (
						<table className="stats-table">
							<thead>
								<tr>
									<th>#</th>
									<th>Time</th>
									<th>Assists</th>
									<th>Click ratio</th>
								</tr>
							</thead>
							<tbody>
								{stats.board.map((entry, i) => (
									<tr key={`${entry.date}-${i}`}>
										<th>{i + 1}</th>
										<td>{formatTime(entry.timeMs)}</td>
										<td>{entry.assisted ? '✓' : '—'}</td>
										<td>{entry.clickRatio.toFixed(2)}</td>
									</tr>
								))}
							</tbody>
						</table>
					)}

					<div className="dialog-actions">
						<Dialog.Close className="button button-primary">
							Done
						</Dialog.Close>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
