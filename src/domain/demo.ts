import Action from './Action';
import Board from './Board';
import solve, { inferenceToActions } from './solver/Solver';
import { explainInference } from './solver/explain';

let board = Board.ofSize(10, 10);
board = board.applyAction(Action.placeBombsAndReveal({ x: 1, y: 1 }, 10));
console.log(board.renderToString({ size: 3 }));
console.log('='.repeat(10));

let result = solve(board);

while (result.inferences.length > 0) {
	const explained = explainInference(result.inferences[0]);
	console.log(explained.steps.map((s) => ` - ${s.text}`).join('\n'));
	console.log(` => ${explained.conclusion}`);
	console.log();

	board = result.inferences
		.flatMap(inferenceToActions)
		.reduce((board, action) => board.applyAction(action), board);
	console.log(board.renderToString({ size: 3 }));
	console.log('='.repeat(10));

	result = solve(board);
}
