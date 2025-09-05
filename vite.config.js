import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Check if SSL certificates exist
const keyPath = '.cert/key.pem';
const certPath = '.cert/cert.pem';
const hasCertificates = fs.existsSync(keyPath) && fs.existsSync(certPath);

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		...(hasCertificates && {
			https: {
				key: fs.readFileSync(keyPath),
				cert: fs.readFileSync(certPath),
			}
		}),
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