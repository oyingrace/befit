<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { 
		PlusIcon, 
		DumbbellIcon, 
		ClockIcon, 
		TargetIcon, 
		PlayIcon,
		EyeIcon,
		TrashIcon,
		CalendarIcon
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Workout {
		id: string;
		name: string;
		description: string;
		totalDuration: number;
		frequency: string;
		fitnessLevel: string;
		goals: string;
		equipment: string[];
		exercises?: { id: string; name: string }[];
		createdAt: string;
	}

	let workouts: Workout[] = [];
	let isLoading = true;

	onMount(async () => {
		await loadWorkouts();
	});

	async function loadWorkouts() {
		try {
			isLoading = true;
			const response = await fetch('/api/workouts');
			if (response.ok) {
				const data = await response.json();
				workouts = data.workouts || [];
			} else {
				toast.error('Failed to load workouts');
			}
		} catch (error) {
			console.error('Error loading workouts:', error);
			toast.error('Error loading workouts');
		} finally {
			isLoading = false;
		}
	}

	async function deleteWorkout(workoutId: string) {
		if (!confirm('Are you sure you want to delete this workout?')) {
			return;
		}

		try {
			const response = await fetch(`/api/workouts?id=${workoutId}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				toast.success('Workout deleted successfully');
				await loadWorkouts(); // Reload the list
			} else {
				toast.error('Failed to delete workout');
			}
		} catch (error) {
			console.error('Error deleting workout:', error);
			toast.error('Error deleting workout');
		}
	}

	function formatDuration(minutes: number): string {
		if (minutes < 60) {
			return `${minutes}min`;
		}
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
	}

	function getFitnessLevelColor(level: string): string {
		switch (level.toLowerCase()) {
			case 'beginner':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
			case 'intermediate':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
			case 'advanced':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">My Workouts</h1>
			<p class="text-muted-foreground">
				View and manage your generated workout plans and exercise configurations
			</p>
		</div>
		<Button href="/workout-generator" class="gap-2">
			<PlusIcon class="h-4 w-4" />
			Generate New Workout
		</Button>
	</div>

	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center space-y-4">
				<div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
				<p class="text-muted-foreground">Loading your workouts...</p>
			</div>
		</div>
	{:else if workouts.length === 0}
		<Card class="border-dashed">
			<CardContent class="flex flex-col items-center justify-center py-12 space-y-4">
				<DumbbellIcon class="h-12 w-12 text-muted-foreground" />
				<h3 class="text-lg font-semibold">No workouts yet</h3>
				<p class="text-muted-foreground text-center max-w-md">
					Get started by generating your first personalized workout plan. Our AI will create a plan tailored to your fitness level and goals.
				</p>
				<Button href="/workout-generator" class="gap-2">
					<PlusIcon class="h-4 w-4" />
					Generate Your First Workout
				</Button>
			</CardContent>
		</Card>
	{:else}
		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each workouts as workout (workout.id)}
				<Card class="hover:shadow-md transition-shadow">
					<CardHeader>
						<div class="flex items-start justify-between">
							<div class="space-y-1">
								<CardTitle class="text-lg">{workout.name}</CardTitle>
								<Badge class={getFitnessLevelColor(workout.fitnessLevel)}>
									{workout.fitnessLevel.charAt(0) + workout.fitnessLevel.slice(1).toLowerCase()}
								</Badge>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => deleteWorkout(workout.id)}
								class="text-destructive hover:text-destructive hover:bg-destructive/10"
							>
								<TrashIcon class="h-4 w-4" />
							</Button>
						</div>
					</CardHeader>
					<CardContent class="space-y-4">
						<p class="text-sm text-muted-foreground line-clamp-2">
							{workout.description}
						</p>

						<div class="grid grid-cols-2 gap-4 text-sm">
							<div class="flex items-center gap-2">
								<ClockIcon class="h-4 w-4 text-muted-foreground" />
								<span>{formatDuration(workout.totalDuration)}</span>
							</div>
							<div class="flex items-center gap-2">
								<CalendarIcon class="h-4 w-4 text-muted-foreground" />
								<span>{workout.frequency}</span>
							</div>
							<div class="flex items-center gap-2">
								<DumbbellIcon class="h-4 w-4 text-muted-foreground" />
								<span>{workout.exercises?.length || 0} exercises</span>
							</div>
							<div class="flex items-center gap-2">
								<TargetIcon class="h-4 w-4 text-muted-foreground" />
								<span class="truncate">{workout.goals}</span>
							</div>
						</div>

						{#if workout.equipment?.length > 0}
							<div class="space-y-2">
								<p class="text-sm font-medium">Equipment needed:</p>
								<div class="flex flex-wrap gap-1">
									{#each workout.equipment.slice(0, 3) as item (item)}
										<Badge variant="outline" class="text-xs">
											{item}
										</Badge>
									{/each}
									{#if workout.equipment.length > 3}
										<Badge variant="outline" class="text-xs">
											+{workout.equipment.length - 3} more
										</Badge>
									{/if}
								</div>
							</div>
						{/if}

						<Separator />

						<div class="flex gap-2">
							<Button href="/workout/{workout.id}" variant="outline" size="sm" class="flex-1 gap-2">
								<EyeIcon class="h-4 w-4" />
								View Details
							</Button>
							<Button href="/form-analysis?workoutId={workout.id}" size="sm" class="flex-1 gap-2">
								<PlayIcon class="h-4 w-4" />
								Start Training
							</Button>
						</div>

						<div class="text-xs text-muted-foreground">
							Created {new Date(workout.createdAt).toLocaleDateString()}
						</div>
					</CardContent>
				</Card>
			{/each}
		</div>
	{/if}
</div>
