import { useEffect, useState } from 'react';
import type { GameState } from '../../domain/game/Game';

function elapsedSeconds({ startedAt, endedAt }: GameState): number {
	if (startedAt === null) return 0;
	return Math.floor(((endedAt ?? Date.now()) - startedAt) / 1000);
}

export default function Timer({ state }: { state: GameState }) {
	const [, tick] = useState(0);

	const running = state.status === 'playing';
	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => tick((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, [running]);

	return (
		<span className="counter" title="Elapsed time">
			⏱ {String(Math.min(elapsedSeconds(state), 999)).padStart(3, '0')}
		</span>
	);
}
