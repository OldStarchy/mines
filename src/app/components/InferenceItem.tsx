import { Accordion } from '@base-ui/react/accordion';
import { useState } from 'react';
import Index2D from '../../domain/Index2D';
import type Constraint from '../../domain/solver/Constraint';
import type { Inference } from '../../domain/solver/Solver';
import {
	explainConstraint,
	explainInference,
	type ExplanationStep,
} from '../../domain/solver/explain';
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

/**
 * One proof as an ordered step list. Hovering a step highlights its
 * cells on the board and tints the earlier steps it is derived from
 * (its transitive premises), so chains read backwards at a glance.
 */
function StepList({
	steps,
	inference,
	onHighlight,
	onApplyCells,
}: {
	steps: ExplanationStep[];
	inference: Inference;
	onHighlight: (highlight: Highlight | null) => void;
	onApplyCells: ApplyCells;
}) {
	const [hovered, setHovered] = useState<ExplanationStep | null>(null);

	return (
		<ol className="hint-steps">
			{steps.map((step, i) => {
				const action =
					i < steps.length - 1 ? stepAction(step.constraint) : null;
				const isPremise =
					hovered !== null && hovered.dependsOn.includes(step.id);
				return (
					<li
						key={step.id}
						className={`hint-step${isPremise ? ' hint-step-premise' : ''}`}
						onMouseEnter={() => {
							setHovered(step);
							onHighlight(highlightStep(step, inference));
						}}
						onMouseLeave={() => {
							setHovered(null);
							onHighlight(highlightInference(inference));
						}}
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
	);
}

/** Collapsed by default: other, usually longer, proofs of the same move. */
function AlternativeProofs({
	inference,
	onHighlight,
	onApplyCells,
}: {
	inference: Inference;
	onHighlight: (highlight: Highlight | null) => void;
	onApplyCells: ApplyCells;
}) {
	const [open, setOpen] = useState(false);
	const count = inference.alternatives.length;

	return (
		<div className="hint-alternatives">
			<button
				type="button"
				className="hint-alternatives-toggle"
				onClick={() => setOpen((o) => !o)}
			>
				{open ? '▾' : '▸'}{' '}
				{count === 1
					? 'Another way to prove this'
					: `${count} other ways to prove this`}
			</button>
			{open &&
				inference.alternatives.map((alternative, i) => (
					<div key={i} className="hint-alternative">
						<span className="hint-alternative-label">
							Proof {i + 2}
						</span>
						<StepList
							steps={explainConstraint(alternative)}
							inference={inference}
							onHighlight={onHighlight}
							onApplyCells={onApplyCells}
						/>
					</div>
				))}
		</div>
	);
}

/**
 * One provable move as an accordion item: proof steps, conclusion,
 * an apply button, and any alternative proofs.
 */
export default function InferenceItem({
	inference,
	onHighlight,
	onApplyCells,
}: {
	inference: Inference;
	onHighlight: (highlight: Highlight | null) => void;
	onApplyCells: ApplyCells;
}) {
	const { steps, conclusion } = explainInference(inference);
	const cellLabel = cellsLabel(inference.cells.map(Index2D.key));

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
				<StepList
					steps={steps}
					inference={inference}
					onHighlight={onHighlight}
					onApplyCells={onApplyCells}
				/>
				<p className="hint-conclusion">{conclusion}</p>
				<button
					type="button"
					className="button"
					onClick={() =>
						onApplyCells(inference.type, inference.cells)
					}
				>
					{inference.cells.length === 1
						? 'Apply'
						: `Apply all ${inference.cells.length}`}
				</button>
				{inference.alternatives.length > 0 && (
					<AlternativeProofs
						inference={inference}
						onHighlight={onHighlight}
						onApplyCells={onApplyCells}
					/>
				)}
			</Accordion.Panel>
		</Accordion.Item>
	);
}
