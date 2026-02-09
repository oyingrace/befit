<script lang="ts">
	import { browser } from '$app/environment';
	import { Toaster } from '$lib/components/ui/sonner/index.js';
	import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
	import { ModeWatcher } from 'mode-watcher';
	import '../app.css';

	let { children } = $props();

	const queryClient = new QueryClient({
		defaultOptions: { queries: { enabled: browser } }
	});

	// Set default theme to light mode if no preference is stored
	if (browser) {
		if (!localStorage.getItem('mode-watcher')) {
			localStorage.setItem('mode-watcher', 'light');
			document.documentElement.classList.remove('dark');
		}
	}
</script>

<ModeWatcher />
<Toaster />

<QueryClientProvider client={queryClient}>
	{@render children()}
</QueryClientProvider>
