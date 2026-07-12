import { Dialog } from '@base-ui/react/dialog';
import { Switch } from '@base-ui/react/switch';
import type { AppSettings } from '../settings';

function ToggleRow({
	label,
	hint,
	checked,
	onChange,
}: {
	label: string;
	hint: string;
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<div className="settings-row">
			<div className="settings-copy">
				<span>{label}</span>
				<span className="field-label">{hint}</span>
			</div>
			<Switch.Root
				className="switch"
				checked={checked}
				onCheckedChange={onChange}
				aria-label={label}
			>
				<Switch.Thumb className="switch-thumb" />
			</Switch.Root>
		</div>
	);
}

export default function SettingsDialog({
	settings,
	onChange,
}: {
	settings: AppSettings;
	onChange: (settings: AppSettings) => void;
}) {
	const patch = (part: Partial<AppSettings>) =>
		onChange({ ...settings, ...part });

	return (
		<Dialog.Root>
			<Dialog.Trigger className="button button-icon" aria-label="Settings">
				⚙
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="dialog-backdrop" />
				<Dialog.Popup className="dialog">
					<Dialog.Title className="dialog-title">Settings</Dialog.Title>

					<ToggleRow
						label="Auto-flag"
						hint="Place flags a number proves. Applies from your next move."
						checked={settings.autoFlag}
						onChange={(autoFlag) => patch({ autoFlag })}
					/>
					<ToggleRow
						label="Auto-reveal"
						hint="Chord numbers already satisfied by their flags — wrong flags will detonate, exactly like a chord."
						checked={settings.autoReveal}
						onChange={(autoReveal) => patch({ autoReveal })}
					/>
					<ToggleRow
						label="Floating board controls"
						hint="On-screen reveal/flag mode toggle and zoom buttons."
						checked={settings.showBoardControls}
						onChange={(showBoardControls) =>
							patch({ showBoardControls })
						}
					/>

					<div className="dialog-actions">
						<Dialog.Close className="button button-primary">
							Done
						</Dialog.Close>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
