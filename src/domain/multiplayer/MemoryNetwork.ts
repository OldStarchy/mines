import type {
	GuestEndpoint,
	GuestMessage,
	HostEndpoint,
	HostMessage,
} from './protocol';

/**
 * Synchronous in-process transport with the same shape as the PeerJS
 * one — sessions under test talk to each other exactly like production
 * sessions do, minus the network.
 */
export default class MemoryNetwork {
	private nextId = 1;
	private hosts = new Map<string, MemoryHost>();

	host(): HostEndpoint {
		const host = new MemoryHost(`host-${this.nextId++}`);
		this.hosts.set(host.id, host);
		return host;
	}

	join(hostId: string): GuestEndpoint {
		const host = this.hosts.get(hostId);
		if (!host) throw new Error(`no host ${hostId}`);
		return host.accept(`guest-${this.nextId++}`);
	}
}

class MemoryHost implements HostEndpoint {
	private guests = new Map<string, MemoryGuest>();
	private messageCbs = new Set<(from: string, m: GuestMessage) => void>();
	private peerCbs = new Set<(peerId: string, joined: boolean) => void>();
	private closed = false;

	constructor(readonly id: string) {}

	accept(guestId: string): MemoryGuest {
		const guest = new MemoryGuest(guestId, this);
		this.guests.set(guestId, guest);
		for (const cb of this.peerCbs) cb(guestId, true);
		return guest;
	}

	deliver(from: string, message: GuestMessage) {
		for (const cb of this.messageCbs) cb(from, message);
	}

	drop(guestId: string) {
		if (this.guests.delete(guestId)) {
			for (const cb of this.peerCbs) cb(guestId, false);
		}
	}

	send(to: string, message: HostMessage) {
		this.guests.get(to)?.deliver(message);
	}

	broadcast(message: HostMessage) {
		for (const guest of this.guests.values()) guest.deliver(message);
	}

	onMessage(cb: (from: string, m: GuestMessage) => void) {
		this.messageCbs.add(cb);
		return () => void this.messageCbs.delete(cb);
	}

	onPeer(cb: (peerId: string, joined: boolean) => void) {
		this.peerCbs.add(cb);
		return () => void this.peerCbs.delete(cb);
	}

	close() {
		if (this.closed) return;
		this.closed = true;
		for (const guest of [...this.guests.values()]) guest.dropped();
		this.guests.clear();
	}
}

class MemoryGuest implements GuestEndpoint {
	private messageCbs = new Set<(m: HostMessage) => void>();
	private closeCbs = new Set<() => void>();
	private closed = false;

	constructor(
		readonly id: string,
		private host: MemoryHost,
	) {}

	deliver(message: HostMessage) {
		for (const cb of this.messageCbs) cb(message);
	}

	/** The host side went away. */
	dropped() {
		if (this.closed) return;
		this.closed = true;
		for (const cb of this.closeCbs) cb();
	}

	send(message: GuestMessage) {
		if (!this.closed) this.host.deliver(this.id, message);
	}

	onMessage(cb: (m: HostMessage) => void) {
		this.messageCbs.add(cb);
		return () => void this.messageCbs.delete(cb);
	}

	onClose(cb: () => void) {
		this.closeCbs.add(cb);
		return () => void this.closeCbs.delete(cb);
	}

	close() {
		if (this.closed) return;
		this.closed = true;
		this.host.drop(this.id);
	}
}
