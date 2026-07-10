import { page } from 'vitest/browser';
import { describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import Board from '../../domain/Board';
import solve from '../../domain/solver/Solver';
import AssistantPanel from './AssistantPanel';
import '../styles.css';

function renderPanel(board: Board) {
	const onApplyCells = vi.fn();
	render(
		<AssistantPanel
			enabled
			onEnabledChange={() => {}}
			metaAssist={false}
			onMetaAssistChange={() => {}}
			memorySize={0}
			result={solve(board)}
			idle={false}
			onHighlight={() => {}}
			onApplyCells={onApplyCells}
		/>,
	);
	return { onApplyCells };
}

describe('AssistantPanel', () => {
	test('lists provable moves with explanations', async () => {
		// The classic 1-2-1 pattern: mines under the 1s, safe middle.
		renderPanel(Board.fromStringNotation(['!_!', '   ']));

		await expect
			.element(page.getByText('3 provable moves'))
			.toBeVisible();

		await page.getByText('⛏ Reveal (1,0)').click();

		await expect
			.element(page.getByText('safe to reveal', { exact: false }))
			.toBeVisible();
	});

	test('steps that pin cells get their own apply button', async () => {
		const { onApplyCells } = renderPanel(
			Board.fromStringNotation(['!_!', '   ']),
		);

		// Revealing (1,0) is proven via a premise of the form "(x,y) is
		// a mine"; that premise is directly playable from inside the
		// explanation, without hunting for its own list entry.
		await page.getByText('⛏ Reveal (1,0)').click();
		await page
			.getByRole('button', { name: /^🚩 Flag \(\d+,\d+\)$/ })
			.click();

		expect(onApplyCells).toHaveBeenCalledTimes(1);
		const [type, cells] = onApplyCells.mock.calls[0];
		expect(type).toBe('flag');
		expect(cells).toHaveLength(1);
	});

	test('apply all groups cells by action type', async () => {
		const { onApplyCells } = renderPanel(
			Board.fromStringNotation(['!_!', '   ']),
		);

		await page.getByRole('button', { name: 'Apply all' }).click();

		expect(onApplyCells).toHaveBeenCalledTimes(2);

		const flagCall = onApplyCells.mock.calls.find(([t]) => t === 'flag')!;
		expect(
			[...flagCall[1]].sort((a, b) => a.x - b.x),
		).toEqual([
			{ x: 0, y: 0 },
			{ x: 2, y: 0 },
		]);
		expect(onApplyCells).toHaveBeenCalledWith('reveal', [{ x: 1, y: 0 }]);
	});

	test('alternative proofs are collapsed behind an expando', async () => {
		renderPanel(Board.fromStringNotation(['!_!', '   ']));

		// (0,0) is provable more than one way; the simplest proof shows
		// first and the rest hide behind a toggle.
		await page.getByText('🚩 Flag (0,0)').click();
		const toggle = page.getByText('way to prove this', { exact: false });
		await expect.element(toggle).toBeVisible();

		await expect
			.element(page.getByText('Proof 2', { exact: true }))
			.not.toBeInTheDocument();

		await toggle.click();
		await expect
			.element(page.getByText('Proof 2', { exact: true }))
			.toBeVisible();
	});

	test('undo memory is a visible, off-by-default opt-in', async () => {
		renderPanel(Board.fromStringNotation(['!_!', '   ']));

		const meta = page.getByLabelText('Use undo memory');
		await expect.element(meta).toBeVisible();
		await expect.element(meta).not.toBeChecked();
	});

	test('warns when flags are contradictory', async () => {
		renderPanel(Board.fromStringNotation(['Ff', '  ']));

		await expect
			.element(page.getByText('flags are inconsistent', { exact: false }))
			.toBeVisible();
	});
});
