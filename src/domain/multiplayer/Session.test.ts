import { describe, expect, test } from 'vitest';
import Index2D from '../Index2D';
import GuestSession from './GuestSession';
import HostSession from './HostSession';
import MemoryNetwork from './MemoryNetwork';

function trio(settings?: ConstructorParameters<typeof HostSession>[2]) {
	const net = new MemoryNetwork();
	const hostEndpoint = net.host();
	const host = new HostSession(hostEndpoint, 'Alice', settings);
	const bob = new GuestSession(net.join(hostEndpoint.id), 'Bob');
	const carol = new GuestSession(net.join(hostEndpoint.id), 'Carol');
	return { net, host, bob, carol };
}

function boardOf(session: HostSession | GuestSession) {
	return session.game.getState().board.cells.toArray();
}

describe('multiplayer sessions', () => {
	test('guests appear in everyone’s lobby, host first', () => {
		const { host, bob, carol } = trio();

		for (const session of [host, bob, carol]) {
			expect(session.getState().players.map((p) => p.name)).toEqual([
				'Alice',
				'Bob',
				'Carol',
			]);
			expect(session.getState().hostId).toBe(host.selfId);
		}
	});

	test('settings changes propagate to guests', () => {
		const { host, bob } = trio();

		host.setSettings({ mode: 'competitive', allowUndo: true });

		expect(bob.getState().settings.mode).toBe('competitive');
		expect(bob.getState().settings.allowUndo).toBe(true);
	});

	test('a leaving guest disappears from the lobby', () => {
		const { host, bob, carol } = trio();

		bob.close();

		for (const session of [host, carol]) {
			expect(session.getState().players.map((p) => p.name)).toEqual([
				'Alice',
				'Carol',
			]);
		}
	});

	test('joining a started game is refused', () => {
		const { net, host } = trio();
		host.start();

		const late = new GuestSession(net.join(host.selfId), 'Dave');

		expect(late.getState().error).toMatch(/already started/);
		expect(host.getState().players).toHaveLength(3);
	});

	describe('coop', () => {
		test('everyone plays the same board', () => {
			const { host, bob, carol } = trio();
			host.start();

			bob.dispatch({ type: 'reveal', index: { x: 4, y: 4 } });

			expect(host.game.getState().moveCount).toBe(1);
			expect(host.game.getRecord().mines).toHaveLength(
				host.game.getState().config.bombs,
			);
			for (const guest of [bob, carol]) {
				expect(guest.game.getRecord().mines).toEqual(
					host.game.getRecord().mines,
				);
				expect(boardOf(guest)).toEqual(boardOf(host));
			}

			// A flag from another player lands on all replicas.
			const hidden = host.game
				.getState()
				.board.cells.toArray()
				.find((c) => c.state.type === 'hidden')!;
			carol.dispatch({ type: 'toggleFlag', index: hidden });

			expect(host.game.getState().board.flagCount).toBe(1);
			expect(boardOf(bob)).toEqual(boardOf(host));
		});

		test('undo intents are ignored unless allowed', () => {
			const { host, bob } = trio();
			host.start();
			bob.dispatch({ type: 'reveal', index: { x: 4, y: 4 } });

			bob.dispatch({ type: 'undo' });
			expect(host.game.getState().moveCount).toBe(1);
		});

		test('with undo allowed, any player can undo the shared game', () => {
			const { host, bob } = trio();
			host.setSettings({ allowUndo: true });
			host.start();
			host.dispatch({ type: 'reveal', index: { x: 4, y: 4 } });

			bob.dispatch({ type: 'undo' });

			expect(host.game.getState().moveCount).toBe(0);
			expect(boardOf(bob)).toEqual(boardOf(host));
		});

		test('a re-randomized board after undo-to-zero reseeds replicas', () => {
			const { host, bob } = trio();
			host.setSettings({ allowUndo: true });
			host.start();

			host.dispatch({ type: 'reveal', index: { x: 4, y: 4 } });
			bob.dispatch({ type: 'undo' });
			host.dispatch({ type: 'reveal', index: { x: 0, y: 0 } });

			expect(host.game.getState().moveCount).toBe(1);
			expect(bob.game.getRecord().mines).toEqual(
				host.game.getRecord().mines,
			);
			expect(boardOf(bob)).toEqual(boardOf(host));
		});

		test('auto options apply to the shared game and its replicas', () => {
			const { host, bob } = trio();
			host.setSettings({ autoFlag: true, autoReveal: true });
			host.start();

			bob.dispatch({ type: 'reveal', index: { x: 4, y: 4 } });

			// Whatever the auto pass played, every replica ran the same
			// pass and the move logs stay identical.
			expect(bob.game.getRecord().moves).toEqual(
				host.game.getRecord().moves,
			);
			expect(boardOf(bob)).toEqual(boardOf(host));
		});

		test('restart events never replicate', () => {
			const { host, bob } = trio();
			host.start();
			bob.dispatch({ type: 'reveal', index: { x: 4, y: 4 } });

			bob.dispatch({ type: 'restart' });
			host.dispatch({ type: 'restart' });

			expect(host.game.getState().moveCount).toBe(1);
		});
	});

	describe('competitive', () => {
		function competitiveTrio() {
			const parts = trio();
			parts.host.setSettings({
				mode: 'competitive',
				config: { width: 5, height: 5, bombs: 3 },
			});
			parts.host.start();
			return parts;
		}

		test('everyone races on identical pre-clicked boards', () => {
			const { host, bob, carol } = competitiveTrio();

			for (const session of [host, bob, carol]) {
				const record = session.game.getRecord();
				expect(record.mines).toEqual(host.game.getRecord().mines);
				expect(record.moves).toEqual(host.game.getRecord().moves);
				expect(record.moves).toHaveLength(1);
				expect(session.game.getState().status).toBe('playing');
			}
		});

		test('boards are private: my reveal does not touch other boards', () => {
			const { host, bob } = competitiveTrio();
			const hidden = bob.game
				.getState()
				.board.cells.toArray()
				.filter((c) => c.state.type === 'hidden')
				.find((c) => !c.isBomb)!;

			bob.dispatch({ type: 'reveal', index: hidden });

			expect(bob.game.getState().moveCount).toBe(2);
			expect(host.game.getState().moveCount).toBe(1);
		});

		test('progress reaches every scoreboard', () => {
			const { host, bob, carol } = competitiveTrio();
			const hidden = bob.game
				.getState()
				.board.cells.toArray()
				.filter((c) => c.state.type === 'hidden')
				.find((c) => !c.isBomb)!;

			bob.dispatch({ type: 'reveal', index: hidden });

			const reported = bob.getState().progress.get(bob.selfId)!;
			expect(reported.revealed).toBeGreaterThan(0);
			for (const session of [host, carol]) {
				expect(session.getState().progress.get(bob.selfId)).toEqual(
					reported,
				);
			}
		});

		test('the first player to clear the board wins everywhere', () => {
			const { host, bob, carol } = competitiveTrio();
			const mines = new Set(bob.game.getRecord().mines);

			for (const cell of bob.game.getState().board.cells.toArray()) {
				if (!mines.has(Index2D.key(cell))) {
					bob.dispatch({ type: 'reveal', index: cell });
				}
			}

			expect(bob.game.getState().status).toBe('won');
			for (const session of [host, bob, carol]) {
				expect(session.getState().winnerId).toBe(bob.selfId);
			}
		});

		test('back to lobby resets everyone for a rematch', () => {
			const { host, bob } = competitiveTrio();

			host.backToLobby();

			for (const session of [host, bob]) {
				expect(session.getState().phase).toBe('lobby');
				expect(session.getState().winnerId).toBeNull();
				expect(session.getState().progress.size).toBe(0);
			}
		});
	});
});
