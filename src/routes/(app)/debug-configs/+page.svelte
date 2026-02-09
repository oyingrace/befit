<script lang="ts">
	import { onMount } from 'svelte';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	let configs: any[] = [];
	let individualConfig: any = null;
	let loading = false;

	async function testApis() {
		loading = true;
		try {
			// Test all configs
			const allResponse = await fetch('/api/exercise-configs');
			const allData = await allResponse.json();
			configs = allData.configs || [];
			
			// Test individual config if we have any
			if (configs.length > 0) {
				const firstConfigId = configs[0].id;
				const individualResponse = await fetch(`/api/exercise-configs/${firstConfigId}`);
				const individualData = await individualResponse.json();
				individualConfig = individualData.config;
			}
		} catch (error) {
			console.error('Error:', error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		testApis();
	});
</script>

<div class="container mx-auto p-6">
	<h1 class="text-2xl font-bold mb-6">Exercise Config Debug Page</h1>
	
	<div class="space-y-6">
		<Card>
			<CardHeader>
				<CardTitle>All Configs ({configs.length})</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loading}
					<p>Loading...</p>
				{:else if configs.length > 0}
					<div class="space-y-2">
						{#each configs as config (config.id)}
							<div class="border p-3 rounded">
								<p><strong>Name:</strong> {config.displayName}</p>
								<p><strong>ID:</strong> {config.id}</p>
								<p><strong>Type:</strong> {config.exerciseType}</p>
								<Button href="/exercise-configs/{config.id}" size="sm" class="mt-2">
									View Details
								</Button>
							</div>
						{/each}
					</div>
				{:else}
					<p>No configs found</p>
				{/if}
			</CardContent>
		</Card>

		{#if individualConfig}
			<Card>
				<CardHeader>
					<CardTitle>Individual Config Test</CardTitle>
				</CardHeader>
				<CardContent>
					<p><strong>Name:</strong> {individualConfig.displayName}</p>
					<p><strong>ID:</strong> {individualConfig.id}</p>
					<p><strong>Description:</strong> {individualConfig.description || 'None'}</p>
					<p><strong>Exercise Type:</strong> {individualConfig.exerciseType}</p>
					<p><strong>Muscles:</strong> {individualConfig.primaryMuscles.join(', ')}</p>
				</CardContent>
			</Card>
		{/if}
	</div>
</div>
