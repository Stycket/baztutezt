import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		https: {
			key: fs.readFileSync('.cert/key.pem'),
			cert: fs.readFileSync('.cert/cert.pem'),
		},
		host: true,
		port: 5173,
		strictPort: false,
		watch: {
			usePolling: true,
			interval: 1000
		}
	},
	envPrefix: ['VITE_', 'STRIPE_']
}); 