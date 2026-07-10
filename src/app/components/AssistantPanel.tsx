import { Accordion } from '@base-ui/react/accordion';
import { Switch } from '@base-ui/react/switch';
import Index2D from '../../domain/Index2D';
import type { SolveResult, Inference } from '../../domain/solver/Solver';
import { explainInference } from '../../domain/solver/explain';
import {
	highlightInference,
	highlightStep,
	type Highlight,
} from '../highlight';

function difficultyLabel(inference: Inference): string {
	const depth = inference.constraint.depth;
	if (depth === 0) return 'basic';
	if (depth <= 2) return 'derived';
	return 'advanced';
}

function InferenceItem({
	inference,
	onHighlight,
	onApply,
}: {
	inference: Inference;
	onHighlight: (highlight: Highlight | null) => void;
	onApply: (inference: Inference) => void;
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
					{steps.map((step, i) => (
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
						</li>
					))}
				</ol>
				<p className="hint-conclusion">{conclusion}</p>
				<button
					type="button"
					className="button"
					onClick={() => onApply(inference)}
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
	onApply,
	onApplyAll,
}: {
	enabled: boolean;
	onEnabledChange: (enabled: boolean) => void;
	/** null while the assistant is off or the game is not running. */
	result: SolveResult | null;
	/** True before the first click, when there is nothing to infer. */
	idle: boolean;
	onHighlight: (highlight: Highlight | null) => void;
	onApply: (inference: Inference) => void;
	onApplyAll: (inferences: Inference[]) => void;
}) {
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
									onClick={() => onApplyAll(inferences)}
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
										onApply={onApply}
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
