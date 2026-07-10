import Action from './Action';
import Board from './Board';

let board = Board.ofSize(10, 10);
console.log(board.renderToString({ size: 3 }));
console.log('='.repeat(10));
board = board.applyAction(Action.placeBombsAndReveal({ x: 1, y: 1 }, 10));
console.log(board.renderToString({ size: 3 }));
console.log();

let actions = board.generateConstraints().flatMap((c) => c.inferActions());

while (actions.length > 0) {
	// console.log(actions.map((a) => JSON.stringify(a)).join('\n'));

	board = actions.reduce((board, action) => board.applyAction(action), board);
	console.log(board.renderToString({ size: 3 }));
	console.log('='.repeat(10));

	actions = board.generateConstraints().flatMap((c) => c.inferActions());
	// console.log(
	// 	board.renderToString(
	// 		constraints
	// 			.filter((c) => c.cell !== undefined)
	// 			.map((c) => [c.cell!, 'C']),
	// 	),
	// );
	// console.log();
}
