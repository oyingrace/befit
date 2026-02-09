import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
// Initialize Opik instrumentation early
import '$lib/opik';

export async function handle({ event, resolve }) {
	return svelteKitHandler({ event, resolve, auth });
}
