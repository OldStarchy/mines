import { Accordion } from '@base-ui/react/accordion';
import { Switch } from '@base-ui/react/switch';
import type { SolveResult, Inference } from '../../domain/solver/Solver';
import type { Highlight } from '../highlight';
import InferenceItem, { type ApplyCells } from './InferenceItem';

export type { ApplyCells } from './InferenceItem';

export default function AssistantPanel({
	enabled,
	onEnabledChange,
	metaAssist,
	onMetaAssistChange,
	memorySize,
	result,
	idle,
	onHighlight,
	onApplyCells,
}: {
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
	/** Whether the assistant may use knowledge from undone reveals. */
	metaAssist: boolean;
	onMetaAssistChange: (metaAssist: boolean) => void;
	/** How many cells the player has peeked at and undone. */
	memorySize: number;
	/** null while the assistant is off or the game is not running. */
	result: SolveResult | null;
	/** True before the first click, when there is nothing to infer. */
	idle: boolean;
	onHighlight: (highlight: Highlight | null) => void;
	onApplyCells: ApplyCells;
}) {
	const applyAll = (inferences: readonly Inference[]) => {
		for (const type of ['flag', 'reveal'] as const) {
			const cells = inferences
				.filter((i) => i.type === type)
				.flatMap((i) => i.cells);
			if (cells.length > 0) onApplyCells(type, cells);
		}
	};
	// The solver already orders inferences simplest-proof-first.
	const inferences = result?.inferences ?? [];

	return (
		<aside className="assistant">
			<div className="assistant-header">
				<h2>Assistant</h2>
				<Switch.Root
					className="switch"
					checked={enabled}
					onCheckedChange={onEnabledChange}
					aria-label="Enable assistant"
				>
					<Switch.Thumb className="switch-thumb" />
				</Switch.Root>
			</div>

			{!enabled ? (
				<p className="assistant-note">
					Turn the assistant on to see which moves can be proven safe
					or unsafe — and the reasoning behind each one.
				</p>
			) : (
				<>
					<div className="assistant-meta">
						<span className="assistant-meta-label">
							Undo memory
							{memorySize > 0 &&
								metaAssist &&
								` (${memorySize} tile${memorySize === 1 ? '' : 's'} seen)`}
						</span>
						<Switch.Root
							className="switch switch-small"
							checked={metaAssist}
							onCheckedChange={onMetaAssistChange}
							aria-label="Use undo memory"
						>
							<Switch.Thumb className="switch-thumb" />
						</Switch.Root>
					</div>
					<p className="assistant-meta-note">
						Lets the assistant reason from reveals you undid — you
						did see them, after all. Meta-gaming, so it stays off
						unless you flip it. 😉
					</p>

					{idle ? (
						<p className="assistant-note">
							Reveal any tile to start. The first click is always
							safe.
						</p>
					) : result === null ? (
						<p className="assistant-note">The game is over.</p>
					) : (
						<>
							{result.contradictions.length > 0 && (
								<p className="assistant-warning">
									⚠ Your flags are inconsistent: the numbers on
									the board cannot all be satisfied, so at least
									one flag is wrong.
								</p>
							)}

							{inferences.length === 0 ? (
								<p className="assistant-note">
									Nothing can be proven right now — you may have
									to guess (or flag what you believe and see what
									follows).
								</p>
							) : (
								<>
									<div className="assistant-actions">
										<span className="assistant-count">
											{inferences.length} provable move
											{inferences.length === 1 ? '' : 's'}
										</span>
										<button
											type="button"
											className="button"
											onClick={() => applyAll(inferences)}
										>
											Apply all
										</button>
									</div>
									<Accordion.Root className="hints">
										{inferences.map((inference) => (
											<InferenceItem
												key={`${inference.type}:${inference.constraint.setKey}`}
												inference={inference}
												onHighlight={onHighlight}
												onApplyCells={onApplyCells}
											/>
										))}
									</Accordion.Root>
								</>
							)}
						</>
					)}
				</>
			)}
		</aside>
	);
}
