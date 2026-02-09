<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select/index.js';
	import { 
		SearchIcon,
		FilterIcon,
		DumbbellIcon,
		BrainIcon,
		SettingsIcon,
		EyeIcon,
		PlusIcon
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface ExerciseConfig {
		id: string;
		name: string;
		displayName: string;
		description?: string;
		exerciseType: string;
		primaryMuscles: string[];
		movementPattern: string;
		keyJoints: string[];
		movementDirection: string;
		generatedBy: string;
		createdAt: string;
		updatedAt: string;
	}

	let exerciseConfigs: ExerciseConfig[] = [];
	let filteredConfigs: ExerciseConfig[] = [];
	let isLoading = true;
	let searchQuery = '';
	let selectedType = '';
	let selectedPattern = '';
	let selectedSource = '';

	// Filter options
	const exerciseTypes = ['upper_body', 'lower_body', 'core', 'full_body'];
	const movementPatterns = ['push', 'pull', 'squat', 'hinge', 'lunge', 'rotation', 'isometric'];
	const sources = ['AI', 'PREDEFINED'];

	onMount(async () => {
		await loadExerciseConfigs();
	});

	async function loadExerciseConfigs() {
		try {
			isLoading = true;
			console.log('Loading exercise configs...');
			// For now, we'll create a simple GET endpoint to fetch exercise configs
			// In a real implementation, this would be /api/exercise-configs
			const response = await fetch('/api/exercise-configs');
			console.log('API response status:', response.status);
			
			if (response.ok) {
				const data = await response.json();
				console.log('API response data:', data);
				exerciseConfigs = data.configs || [];
				console.log('Loaded configs count:', exerciseConfigs.length);
				applyFilters();
			} else {
				console.error('Failed to load configs, status:', response.status);
				toast.error('Failed to load exercises');
			}
		} catch (error) {
			console.error('Error loading exercise configs:', error);
			toast.error('Error loading exercises');
		} finally {
			isLoading = false;
			console.log('Loading completed, configs count:', exerciseConfigs.length);
		}
	}

	function applyFilters() {
		filteredConfigs = exerciseConfigs.filter(config => {
			const matchesSearch = config.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				config.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				config.primaryMuscles.some(muscle => muscle.toLowerCase().includes(searchQuery.toLowerCase()));
			
			const matchesType = !selectedType || config.exerciseType === selectedType;
			const matchesPattern = !selectedPattern || config.movementPattern === selectedPattern;
			const matchesSource = !selectedSource || config.generatedBy === selectedSource;

			return matchesSearch && matchesType && matchesPattern && matchesSource;
		});
	}

	$: if (searchQuery || selectedType || selectedPattern || selectedSource) {
		applyFilters();
	}

	function getTypeColor(type: string): string {
		switch (type.toLowerCase()) {
			case 'upper_body':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
			case 'lower_body':
				return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
			case 'core':
				return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
			case 'full_body':
				return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
		}
	}

	function getSourceColor(source: string): string {
		switch (source) {
			case 'AI':
				return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300';
			case 'PREDEFINED':
				return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
		}
	}

	function clearFilters() {
		searchQuery = '';
		selectedType = '';
		selectedPattern = '';
		selectedSource = '';
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">My Workouts</h1>
			<p class="text-muted-foreground">
				Exercises you can use in your workouts
			</p>
		</div>
		<Button href="/generate-exercise-config" class="gap-2">
			<PlusIcon class="h-4 w-4" />
			Add Workout
		</Button>
	</div>

	<!-- Filters -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				<FilterIcon class="h-5 w-5" />
				Find workouts
			</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				<div class="space-y-2">
					<Label for="search">Search</Label>
					<div class="relative">
						<SearchIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="search"
							bind:value={searchQuery}
							placeholder="Search workouts or exercises..."
							class="pl-10"
						/>
					</div>
				</div>
				
				<div class="space-y-2">
					<Label for="type">Body part</Label>
					<Select.Root type="single" bind:value={selectedType}>
						<Select.Trigger class="w-full">
							{selectedType ? selectedType.replace('_', ' ') : 'All body parts'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="">All body parts</Select.Item>
							{#each exerciseTypes as type (type)}
								<Select.Item value={type}>{type.replace('_', ' ')}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label for="pattern">Movement type</Label>
					<Select.Root type="single" bind:value={selectedPattern}>
						<Select.Trigger class="w-full">
							{selectedPattern || 'All movements'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="">All movements</Select.Item>
							{#each movementPatterns as pattern (pattern)}
								<Select.Item value={pattern}>{pattern}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="space-y-2">
					<Label for="source">Created by</Label>
					<Select.Root type="single" bind:value={selectedSource}>
						<Select.Trigger class="w-full">
							{selectedSource || 'All'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="">All</Select.Item>
							{#each sources as source (source)}
								<Select.Item value={source}>{source === 'AI' ? 'AI Created' : 'Built-in'}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="flex items-end space-y-2">
					<Button variant="outline" onclick={clearFilters} class="w-full">
						Clear Filters
					</Button>
				</div>
			</div>
		</CardContent>
	</Card>

	<!-- Results -->
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center space-y-4">
				<div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
				<p class="text-muted-foreground">Loading exercises...</p>
			</div>
		</div>
	{:else if filteredConfigs.length === 0}
		<Card class="border-dashed">
			<CardContent class="flex flex-col items-center justify-center py-12 space-y-4">
				<DumbbellIcon class="h-12 w-12 text-muted-foreground" />
				<h3 class="text-lg font-semibold">
					{exerciseConfigs.length === 0 ? 'No exercises yet' : 'No matches found'}
				</h3>
				<p class="text-muted-foreground text-center max-w-md">
					{exerciseConfigs.length === 0 
						? 'Create your first exercise to get started. You can add it to your workouts later.'
						: 'Try adjusting your filters or search terms to find exercises.'
					}
				</p>
				{#if exerciseConfigs.length === 0}
					<Button href="/generate-exercise-config" class="gap-2">
						<PlusIcon class="h-4 w-4" />
						Add Your First Exercise
					</Button>
				{:else}
					<Button variant="outline" onclick={clearFilters}>
						Clear Filters
					</Button>
				{/if}
			</CardContent>
		</Card>
	{:else}
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-sm text-muted-foreground">
					Showing {filteredConfigs.length} of {exerciseConfigs.length} exercises
				</p>
			</div>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredConfigs as config (config.id)}
					<Card class="hover:shadow-md transition-shadow">
						<CardHeader>
							<div class="flex items-start justify-between">
								<div class="space-y-1">
									<CardTitle class="text-lg">{config.displayName}</CardTitle>
									<div class="flex items-center gap-2">
										<Badge class={getTypeColor(config.exerciseType)}>
											{config.exerciseType.replace('_', ' ')}
										</Badge>
										<Badge class={getSourceColor(config.generatedBy)}>
											{config.generatedBy === 'AI' ? 'AI Created' : 'Built-in'}
											
										</Badge>
									</div>
								</div>
							</div>
						</CardHeader>
						<CardContent class="space-y-4">
							{#if config.description}
								<p class="text-sm text-muted-foreground line-clamp-2">
									{config.description}
								</p>
							{/if}

							{#if config.primaryMuscles.length > 0}
								<div class="space-y-2">
									<p class="text-sm font-medium">Muscles worked:</p>
									<div class="flex flex-wrap gap-1">
										{#each config.primaryMuscles.slice(0, 3) as muscle (muscle)}
											<Badge variant="secondary" class="text-xs">
												{muscle}
											</Badge>
										{/each}
										{#if config.primaryMuscles.length > 3}
											<Badge variant="secondary" class="text-xs">
												+{config.primaryMuscles.length - 3} more
											</Badge>
										{/if}
									</div>
								</div>
							{/if}

							<div class="flex gap-2 pt-2">
								<Button href="/exercise-configs/{config.id}" variant="outline" size="sm" class="flex-1 gap-2">
									<EyeIcon class="h-4 w-4" />
									View Details
								</Button>
								<Button href="/form-analysis?configId={config.id}" size="sm" class="flex-1 gap-2">
									<DumbbellIcon class="h-4 w-4" />
									Try It
								</Button>
							</div>

							<div class="text-xs text-muted-foreground">
								Created {new Date(config.createdAt).toLocaleDateString()}
							</div>
						</CardContent>
					</Card>
				{/each}
			</div>
		</div>
	{/if}
</div>
