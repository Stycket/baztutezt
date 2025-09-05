import { writable } from 'svelte/store';

// Create a store for fullscreen state and navbar visibility
export const isFullscreenMode = writable(false);
export const showNavbar = writable(true); 