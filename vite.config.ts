/// <reference types="vitest/config" />
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/domain/**/*.test.ts'],
					setupFiles: ['src/setupTests.ts'],
				},
			},
			{
				extends: true,
				test: {
					name: 'browser',
					include: ['src/app/**/*.test.tsx'],
					setupFiles: ['src/setupTests.ts'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }],
						// Keep __screenshots__ for committed visual refs only;
						// failure diffs still land in .vitest-attachments.
						screenshotFailures: false,
					},
				},
			},
		],
	},
});
