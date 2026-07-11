import Peer, { type DataConnection } from 'peerjs';
import type {
	GuestEndpoint,
	GuestMessage,
	HostEndpoint,
	HostMessage,
} from '../../domain/multiplayer/protocol';

/**
 * WebRTC transport over PeerJS defaults: the free PeerJS cloud broker
 * for signaling and Google's public STUN servers for connectivity. No
 * TURN relay, so peers behind symmetric NATs may not connect — fine for
 * a game between friends.
 */

function awaitOpen(peer: Peer): Promise<string> {
	return new Promise((resolve, reject) => {
		peer.once('open', (id) => resolve(id));
		peer.once('error', (error) => reject(error));
	});
}

export async function createHostEndpoint(): Promise<HostEndpoint> {
	const peer = new Peer();
	const id = await awaitOpen(peer);
	const connections = new Map<string, DataConnection>();
	const messageCbs = new Set<(from: string, m: GuestMessage) => void>();
	const peerCbs = new Set<(peerId: string, joined: boolean) => void>();

	peer.on('connection', (connection) => {
		connection.on('open', () => {
			connections.set(connection.peer, connection);
			for (const cb of peerCbs) cb(connection.peer, true);
		});
		connection.on('data', (data) => {
			for (const cb of messageCbs) cb(connection.peer, data as GuestMessage);
		});
		connection.on('close', () => {
			if (connections.delete(connection.peer)) {
				for (const cb of peerCbs) cb(connection.peer, false);
			}
		});
	});

	return {
		id,
		send(to, message) {
			connections.get(to)?.send(message);
		},
		broadcast(message) {
			for (const connection of connections.values())
				connection.send(message);
		},
		onMessage(cb) {
			messageCbs.add(cb);
			return () => void messageCbs.delete(cb);
		},
		onPeer(cb) {
			peerCbs.add(cb);
			return () => void peerCbs.delete(cb);
		},
		close() {
			peer.destroy();
		},
	};
}

export async function createGuestEndpoint(
	hostId: string,
): Promise<GuestEndpoint> {
	const peer = new Peer();
	const id = await awaitOpen(peer);
	const connection = peer.connect(hostId, {
		reliable: true,
		serialization: 'json',
	});
	const messageCbs = new Set<(m: HostMessage) => void>();
	const closeCbs = new Set<() => void>();

	await new Promise<void>((resolve, reject) => {
		connection.once('open', () => resolve());
		connection.once('error', (error) => reject(error));
		peer.once('error', (error) => reject(error));
	});

	connection.on('data', (data) => {
		for (const cb of messageCbs) cb(data as HostMessage);
	});
	connection.on('close', () => {
		for (const cb of closeCbs) cb();
	});

	return {
		id,
		send(message) {
			connection.send(message);
		},
		onMessage(cb) {
			messageCbs.add(cb);
			return () => void messageCbs.delete(cb);
		},
		onClose(cb) {
			closeCbs.add(cb);
			return () => void closeCbs.delete(cb);
		},
		close() {
			peer.destroy();
		},
	};
}
