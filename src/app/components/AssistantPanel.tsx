import { Accordion } from '@base-ui/react/accordion';
import { Switch } from '@base-ui/react/switch';
import Index2D from '../../domain/Index2D';
import type Constraint from '../../domain/solver/Constraint';
import type { SolveResult, Inference } from '../../domain/solver/Solver';
import { explainInference } from '../../domain/solver/explain';
import {
	highlightInference,
	highlightStep,
	type Highlight,
} from '../highlight';

export type ApplyCells = (type: 'flag' | 'reveal', cells: Index2D[]) => void;

function cellsLabel(cells: readonly string[]): string {
	if (cells.length > 3) return `${cells.length} tiles`;
	return cells.map((key) => `(${key})`).join(', ');
}

/**
 * A derivation step that pins its whole cell set is directly playable,
 * even when it only appears as a premise of some deeper inference.
 */
function stepAction(
	constraint: Constraint,
): { type: 'flag' | 'reveal'; label: string } | null {
	if (constraint.isAllMines)
		return { type: 'flag', label: `Flag ${cellsLabel(constraint.cells)}` };
	if (constraint.isAllSafe)
		return {
			type: 'reveal',
			label: `Reveal ${cellsLabel(constraint.cells)}`,
		};
	return null;
}

function difficultyLabel(inference: Inference): string {
	const depth = inference.constraint.depth;
	if (depth === 0) return 'basic';
	if (depth <= 2) return 'derived';
	return 'advanced';
}

function InferenceItem({
	inference,
	onHighlight,
	onApplyCells,
}: {
	inference: Inference;
	onHighlight: (highlight: Highlight | null) => void;
	onApplyCells: ApplyCells;
}) {
	const { steps, conclusion } = explainInference(inference);
	const cellLabel = `(${Index2D.key(inference.cell)})`;

	return (
		<Accordion.Item
			className="hint"
			onMouseEnter={() => onHighlight(highlightInference(inference))}
			onMouseLeave={() => onHighlight(null)}
		>
			<Accordion.Header className="hint-header">
				<Accordion.Trigger className="hint-trigger">
					<span className={`hint-kind hint-kind-${inference.type}`}>
						{inference.type === 'flag' ? '🚩 Flag' : '⛏ Reveal'}{' '}
						{cellLabel}
					</span>
					<span className={`hint-badge hint-${difficultyLabel(inference)}`}>
						{difficultyLabel(inference)}
					</span>
					<span className="hint-chevron">▾</span>
				</Accordion.Trigger>
			</Accordion.Header>
			<Accordion.Panel className="hint-panel">
				<ol className="hint-steps">
					{steps.map((step, i) => {
						const action =
							i < steps.length - 1
								? stepAction(step.constraint)
								: null;
						return (
							<li
								key={i}
								className="hint-step"
								onMouseEnter={() =>
									onHighlight(highlightStep(step, inference))
								}
								onMouseLeave={() =>
									onHighlight(highlightInference(inference))
								}
							>
								{step.text}
								{action && (
									<button
										type="button"
										className="button button-mini"
										onClick={() =>
											onApplyCells(
												action.type,
												step.constraint.indices,
											)
										}
									>
										{action.type === 'flag' ? '🚩' : '⛏'}{' '}
										{action.label}
									</button>
								)}
							</li>
						);
					})}
				</ol>
				<p className="hint-conclusion">{conclusion}</p>
				<button
					type="button"
					className="button"
					onClick={() =>
						onApplyCells(inference.type, [inference.cell])
					}
				>
					Apply
				</button>
			</Accordion.Panel>
		</Accordion.Item>
	);
}

export default function AssistantPanel({
	enabled,
	onEnabledChange,
	result,
	idle,
	onHighlight,
	onApplyCells,
}: {
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
	/** null while the assistant is off or the game is not running. */
	result: SolveResult | null;
	/** True before the first click, when there is nothing to infer. */
	idle: boolean;
	onHighlight: (highlight: Highlight | null) => void;
	onApplyCells: ApplyCells;
}) {
	const applyAll = (inferences: Inference[]) => {
		for (const type of ['flag', 'reveal'] as const) {
			const cells = inferences
				.filter((i) => i.type === type)
				.map((i) => i.cell);
			if (cells.length > 0) onApplyCells(type, cells);
		}
	};
	const inferences = result
		? [...result.inferences].sort(
				(a, b) =>
					a.constraint.depth - b.constraint.depth ||
					a.type.localeCompare(b.type),
			)
		: [];

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
			) : idle ? (
				<p className="assistant-note">
					Reveal any tile to start. The first click is always safe.
				</p>
			) : result === null ? (
				<p className="assistant-note">The game is over.</p>
			) : (
				<>
					{result.contradictions.length > 0 && (
						<p className="assistant-warning">
							⚠ Your flags are inconsistent: the numbers on the
							board cannot all be satisfied, so at least one flag
							is wrong.
						</p>
					)}

					{inferences.length === 0 ? (
						<p className="assistant-note">
							Nothing can be proven right now — you may have to
							guess (or flag what you believe and see what
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
										key={`${inference.type}:${Index2D.key(inference.cell)}`}
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
		</aside>
	);
}
