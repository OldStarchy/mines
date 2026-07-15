import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';
import {
	clearCustomTheme,
	loadCustomTheme,
	saveCustomTheme,
} from '../customTheme';
import { describeError, generateTheme, loadApiKey, saveApiKey } from '../themeGen';
import type { ThemeName } from '../theme';

/**
 * The theme studio: describe a theme, and Claude designs it — palette,
 * cell icons, title flourish, watermark — paid for with the player's
 * own Anthropic API key. The result is stored locally and appears in
 * the theme dropdown as its own entry.
 */
export default function ThemeStudioDialog({
	onTheme,
}: {
	/** Called with 'custom' when a generated theme is applied. */
	onTheme: (theme: ThemeName) => void;
}) {
	const [open, setOpen] = useState(false);
	const [prompt, setPrompt] = useState('');
	const [apiKey, setApiKey] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [current, setCurrent] = useState<string | null>(null);

	const openDialog = (next: boolean) => {
		setOpen(next);
		if (next) {
			setApiKey(loadApiKey());
			setCurrent(loadCustomTheme()?.name ?? null);
			setPrompt((previous) => previous || (loadCustomTheme()?.prompt ?? ''));
			setError(null);
		}
	};

	const generate = async () => {
		setBusy(true);
		setError(null);
		try {
			const theme = await generateTheme({
				apiKey: apiKey.trim(),
				prompt: prompt.trim(),
			});
			saveApiKey(apiKey.trim());
			saveCustomTheme(theme);
			onTheme('custom');
			setOpen(false);
		} catch (cause) {
			setError(describeError(cause));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog.Root open={open} onOpenChange={openDialog}>
			<Dialog.Trigger className="button button-icon" aria-label="Theme studio">
				🎨
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop className="dialog-backdrop" />
				<Dialog.Popup className="dialog">
					<Dialog.Title className="dialog-title">
						Theme studio
					</Dialog.Title>
					<Dialog.Description className="dialog-description">
						Describe a theme and Claude designs it — colors, icons
						and all. Uses your own Anthropic API key; one theme is
						a single (Opus) request.
					</Dialog.Description>

					<label className="field">
						<span className="field-label">Theme prompt</span>
						<textarea
							className="text-input"
							rows={3}
							value={prompt}
							placeholder="Deep sea: hidden cells are dark water, mines are anglerfish, flags are glowing jellyfish…"
							onChange={(event) => setPrompt(event.target.value)}
						/>
					</label>

					<label className="field">
						<span className="field-label">
							Anthropic API key (kept only in this browser)
						</span>
						<input
							className="text-input"
							type="password"
							value={apiKey}
							placeholder="sk-ant-…"
							autoComplete="off"
							onChange={(event) => setApiKey(event.target.value)}
						/>
					</label>

					{error && <p className="dialog-error">{error}</p>}

					{current && (
						<p className="stats-note">
							Current custom theme: “{current}”.{' '}
							<button
								type="button"
								className="button button-mini"
								onClick={() => {
									clearCustomTheme();
									setCurrent(null);
									onTheme('classic');
								}}
							>
								Remove
							</button>
						</p>
					)}

					<div className="dialog-actions">
						<Dialog.Close className="button">Cancel</Dialog.Close>
						<button
							type="button"
							className="button button-primary"
							disabled={
								busy ||
								prompt.trim().length === 0 ||
								apiKey.trim().length === 0
							}
							onClick={generate}
						>
							{busy ? 'Designing…' : 'Generate'}
						</button>
					</div>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
