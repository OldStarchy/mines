import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import GuestSession from '../domain/multiplayer/GuestSession';
import HostSession from '../domain/multiplayer/HostSession';
import MemoryNetwork from '../domain/multiplayer/MemoryNetwork';
import App from './App';
import type { Connector } from './components/MultiplayerLauncher';
import './styles.css';

function memoryConnector(net: MemoryNetwork): Connector & {
	hostId: () => string;
} {
	let hostId: string | null = null;
	return {
		host: async () => {
			const endpoint = net.host();
			hostId = endpoint.id;
			return endpoint;
		},
		join: async (id: string) => net.join(id),
		hostId: () => {
			if (!hostId) throw new Error('no host yet');
			return hostId;
		},
	};
}

beforeEach(() => {
	localStorage.clear();
	history.replaceState(null, '', location.pathname);
});

describe('multiplayer', () => {
	test('host creates a lobby, a guest joins, co-op play replicates', async () => {
		const net = new MemoryNetwork();
		const connector = memoryConnector(net);
		await render(<App connector={connector} />);

		// Create a lobby through the UI.
		await page.getByText('👥 Multiplayer').click();
		await page.getByLabelText('Your name').fill('Alice');
		await page.getByText('Create lobby').click();
		await expect
			.element(page.getByRole('heading', { name: 'Lobby' }))
			.toBeVisible();
		await expect.element(page.getByText('Alice')).toBeVisible();

		// A guest joins over the same network.
		const bob = new GuestSession(net.join(connector.hostId()), 'Bob');
		await expect.element(page.getByText('Bob')).toBeVisible();

		// Start the (co-op by default) game.
		await page.getByText('Start game').click();
		await vi.waitFor(() =>
			expect(document.querySelectorAll('.cell')).toHaveLength(81),
		);

		// The guest reveals a cell; the host's board follows.
		bob.dispatch({ type: 'reveal', index: { x: 4, y: 4 } });
		await vi.waitFor(() =>
			expect(
				document.querySelectorAll('.cell-revealed').length,
			).toBeGreaterThan(0),
		);
		expect(bob.game.getState().moveCount).toBe(1);
	});

	test('a ?join= link opens the join flow and lands in the lobby', async () => {
		const net = new MemoryNetwork();
		const hostEndpoint = net.host();
		const host = new HostSession(hostEndpoint, 'Alice');

		history.replaceState(null, '', `?join=${hostEndpoint.id}`);
		const connector = memoryConnector(net);
		await render(<App connector={connector} />);

		// The launcher opened itself in join mode and cleaned the URL.
		expect(location.search).toBe('');
		await expect.element(page.getByText('Join game')).toBeVisible();
		await page.getByLabelText('Your name').fill('Carol');
		await page.getByText('Join lobby').click();

		await expect
			.element(page.getByRole('heading', { name: 'Lobby' }))
			.toBeVisible();
		await expect.element(page.getByText('Carol')).toBeVisible();
		expect(host.getState().players.map((p) => p.name)).toEqual([
			'Alice',
			'Carol',
		]);

		// Host flips to competitive and starts: the guest gets a race
		// board with the opening click already made, plus a scoreboard.
		host.setSettings({
			mode: 'competitive',
			config: { width: 5, height: 5, bombs: 3 },
		});
		host.start();

		await expect.element(page.getByText('Race')).toBeVisible();
		await vi.waitFor(() =>
			expect(
				document.querySelectorAll('.cell-revealed').length,
			).toBeGreaterThan(0),
		);
	});
});
