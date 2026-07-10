import { Dialog } from '@base-ui/react/dialog';
import type { GameConfig } from '../../domain/game/Game';

/**
 * Shown when the player switches to a scenario that has a saved game:
 * resume where they left off, or discard it and start fresh.
 */
export default function ResumeDialog({
	config,
	onResume,
	onNewGame,
	onCancel,
}: {
	config: GameConfig | null;
	onResume: () => void;
	onNewGame: () => void;
	onCancel: () => void;
}) {
	return (
		<Dialog.Root
			open={config !== null}
			onOpenChange={(open) => {
				if (!open) onCancel();
			}}
		>
			<Dialog.Portal>
				<Dialog.Backdrop className="dialog-backdrop" />
				<Dialog.Popup className="dialog">
					<Dialog.Title className="dialog-title">
						Game in progress
					</Dialog.Title>
					<Dialog.Description className="dialog-description">
						{config &&
							`You left an unfinished game on ${config.width}×${config.height} with ${config.bombs} mines. Starting a new game discards it.`}
					</Dialog.Description>
					<div className="dialog-actions">
						<button
							type="button"
							className="button"
							onClick={onNewGame}
						>
							New game
						</button>
						<button
							type="button"
							className="button button-primary"
							onClick={onResume}
						>
							Resume
						</button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
