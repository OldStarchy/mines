import { Dialog } from '@base-ui/react/dialog';
import { NumberField } from '@base-ui/react/number-field';
import { useState } from 'react';
import type { GameConfig } from '../../domain/game/Game';
import {
	MAX_DIMENSION,
	MIN_DIMENSION,
	maxMines,
	normalizeConfig,
	recommendedMines,
	type Density,
} from '../../domain/game/scenario';

const DENSITY_LABELS: Record<Density, string> = {
	easy: 'Easy',
	medium: 'Medium',
	hard: 'Hard',
};

function Field({
	label,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
}) {
	return (
		<label className="field">
			<span className="field-label">{label}</span>
			<NumberField.Root
				className="number-field"
				value={value}
				min={min}
				max={max}
				onValueChange={(next) => {
					if (next !== null) onChange(next);
				}}
			>
				<NumberField.Group className="number-field-group">
					<NumberField.Decrement className="number-field-button">
						−
					</NumberField.Decrement>
					<NumberField.Input className="number-field-input" />
					<NumberField.Increment className="number-field-button">
						+
					</NumberField.Increment>
				</NumberField.Group>
			</NumberField.Root>
		</label>
	);
}

export default function ScenarioDialog({
	config,
	onSubmit,
}: {
	config: GameConfig;
	onSubmit: (config: GameConfig) => void;
}) {
	const [open, setOpen] = useState(false);
	const [width, setWidth] = useState(config.width);
	const [height, setHeight] = useState(config.height);
	const [bombs, setBombs] = useState(config.bombs);

	const recommended = recommendedMines(width, height);

	return (
		<Dialog.Root
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) {
					setWidth(config.width);
					setHeight(config.height);
					setBombs(config.bombs);
				}
			}}
		>
			<Dialog.Trigger className="button" aria-label="Custom scenario">
				Custom…
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="dialog-backdrop" />
				<Dialog.Popup className="dialog">
					<Dialog.Title className="dialog-title">
						Custom scenario
					</Dialog.Title>
					<Dialog.Description className="dialog-description">
						Any board size and mine count. The first click is
						always safe.
					</Dialog.Description>

					<div className="dialog-fields">
						<Field
							label="Width"
							value={width}
							min={MIN_DIMENSION}
							max={MAX_DIMENSION}
							onChange={setWidth}
						/>
						<Field
							label="Height"
							value={height}
							min={MIN_DIMENSION}
							max={MAX_DIMENSION}
							onChange={setHeight}
						/>
						<Field
							label="Mines"
							value={bombs}
							min={1}
							max={maxMines(width, height)}
							onChange={setBombs}
						/>
					</div>

					<div className="dialog-suggestions">
						<span className="field-label">Suggested:</span>
						{(Object.keys(recommended) as Density[]).map(
							(density) => (
								<button
									key={density}
									type="button"
									className={`button button-mini${
										bombs === recommended[density]
											? ' button-selected'
											: ''
									}`}
									onClick={() =>
										setBombs(recommended[density])
									}
								>
									{DENSITY_LABELS[density]}{' '}
									{recommended[density]}
								</button>
							),
						)}
					</div>

					<div className="dialog-actions">
						<Dialog.Close className="button">Cancel</Dialog.Close>
						<button
							type="button"
							className="button button-primary"
							onClick={() => {
								onSubmit(
									normalizeConfig({ width, height, bombs }),
								);
								setOpen(false);
							}}
						>
							Start game
						</button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
