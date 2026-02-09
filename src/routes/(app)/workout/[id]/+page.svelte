<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import { 
		ArrowLeftIcon,
		ClockIcon, 
		TargetIcon, 
		PlayIcon,
		DumbbellIcon,
		CalendarIcon,
		InfoIcon,
		RepeatIcon
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Exercise {
		id: string;
		name: string;
		sets: number;
		reps: string;
		rest: string;
		equipment?: string;
		notes?: string;
		exerciseConfig?: {
			id: string;
			displayName: string;
			description?: string;
			exerciseType: string;
			primaryMuscles: string[];
			movementPattern: string;
		};
	}

	interface Workout {
		id: string;
		name: string;
		description: string;
		totalDuration: number;
		frequency: string;
		fitnessLevel: string;
		goals: string;
		equipment: string[];
		exercises: Exercise[];
		createdAt: string;
		updatedAt: string;
	}

	let workout: Workout | null = null;
	let isLoading = true;
	let workoutId = page.params.id;

	onMount(async () => {
		await loadWorkout();
	});

	async function loadWorkout() {
		try {
			isLoading = true;
			const response = await fetch('/api/workouts');
			if (response.ok) {
				const data = await response.json();
				workout = data.workouts?.find((w: Workout) => w.id === workoutId) || null;
				if (!workout) {
					toast.error('Workout not found');
				}
			} else {
				toast.error('Failed to load workout');
			}
		} catch (error) {
			console.error('Error loading workout:', error);
			toast.error('Error loading workout');
		} finally {
			isLoading = false;
		}
	}

	function formatDuration(minutes: number): string {
		if (minutes < 60) {
			return `${minutes} minutes`;
		}
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours} hour${hours > 1 ? 's' : ''}`;
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

	function getExerciseTypeColor(type: string): string {
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
</script>

<div class="space-y-6">
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-center space-y-4">
				<div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
				<p class="text-muted-foreground">Loading workout details...</p>
			</div>
		</div>
	{:else if !workout}
		<Card>
			<CardContent class="flex flex-col items-center justify-center py-12 space-y-4">
				<InfoIcon class="h-12 w-12 text-muted-foreground" />
				<h3 class="text-lg font-semibold">Workout not found</h3>
				<p class="text-muted-foreground text-center">
					The workout you're looking for doesn't exist or has been deleted.
				</p>
				<Button href="/my-workouts">
					<ArrowLeftIcon class="h-4 w-4 mr-2" />
					Back to My Workouts
				</Button>
			</CardContent>
		</Card>
	{:else}
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<Button variant="ghost" size="sm" href="/my-workouts">
					<ArrowLeftIcon class="h-4 w-4 mr-2" />
					Back
				</Button>
				<div>
					<h1 class="text-3xl font-bold tracking-tight">{workout.name}</h1>
					<div class="flex items-center gap-2 mt-1">
						<Badge class={getFitnessLevelColor(workout.fitnessLevel)}>
							{workout.fitnessLevel.charAt(0) + workout.fitnessLevel.slice(1).toLowerCase()}
						</Badge>
						<span class="text-muted-foreground">•</span>
						<span class="text-sm text-muted-foreground">
							Created {new Date(workout.createdAt).toLocaleDateString()}
						</span>
					</div>
				</div>
			</div>
			<Button href="/form-analysis?workoutId={workout.id}" class="gap-2">
				<PlayIcon class="h-4 w-4" />
				Start Training
			</Button>
		</div>

		<!-- Workout Overview -->
		<Card>
			<CardHeader>
				<CardTitle>Workout Overview</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<p class="text-muted-foreground">{workout.description}</p>
				
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<div class="flex items-center gap-2">
						<ClockIcon class="h-4 w-4 text-muted-foreground" />
						<div>
							<p class="text-sm text-muted-foreground">Duration</p>
							<p class="font-medium">{formatDuration(workout.totalDuration)}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<CalendarIcon class="h-4 w-4 text-muted-foreground" />
						<div>
							<p class="text-sm text-muted-foreground">Frequency</p>
							<p class="font-medium">{workout.frequency}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<DumbbellIcon class="h-4 w-4 text-muted-foreground" />
						<div>
							<p class="text-sm text-muted-foreground">Exercises</p>
							<p class="font-medium">{workout.exercises.length}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<TargetIcon class="h-4 w-4 text-muted-foreground" />
						<div>
							<p class="text-sm text-muted-foreground">Goals</p>
							<p class="font-medium">{workout.goals}</p>
						</div>
					</div>
				</div>

				{#if workout.equipment.length > 0}
					<div class="space-y-2">
						<p class="text-sm font-medium">Equipment needed:</p>
						<div class="flex flex-wrap gap-1">
							{#each workout.equipment as item (item)}
								<Badge variant="outline">
									{item}
								</Badge>
							{/each}
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Exercise List -->
		<Card>
			<CardHeader>
				<CardTitle>Exercises ({workout.exercises.length})</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="space-y-4">
					{#each workout.exercises as exercise, index (exercise.id)}
						<div class="border rounded-lg p-4 space-y-3">
							<div class="flex items-start justify-between">
								<div class="space-y-1">
									<div class="flex items-center gap-2">
										<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
											{index + 1}
										</span>
										<h3 class="font-semibold">
											{exercise.exerciseConfig?.displayName || exercise.name}
										</h3>
									</div>
									{#if exercise.exerciseConfig}
										<div class="flex items-center gap-2 ml-8">
											<Badge variant="outline" class={getExerciseTypeColor(exercise.exerciseConfig.exerciseType)}>
												{exercise.exerciseConfig.exerciseType.replace('_', ' ')}
											</Badge>
											<Badge variant="outline">
												{exercise.exerciseConfig.movementPattern}
											</Badge>
										</div>
									{/if}
								</div>
							</div>

							<div class="grid grid-cols-2 md:grid-cols-4 gap-4 ml-8">
								<div class="flex items-center gap-2">
									<RepeatIcon class="h-4 w-4 text-muted-foreground" />
									<div>
										<p class="text-xs text-muted-foreground">Sets</p>
										<p class="text-sm font-medium">{exercise.sets}</p>
									</div>
								</div>
								<div>
									<p class="text-xs text-muted-foreground">Reps</p>
									<p class="text-sm font-medium">{exercise.reps}</p>
								</div>
								<div>
									<p class="text-xs text-muted-foreground">Rest</p>
									<p class="text-sm font-medium">{exercise.rest}</p>
								</div>
								{#if exercise.equipment}
									<div>
										<p class="text-xs text-muted-foreground">Equipment</p>
										<p class="text-sm font-medium">{exercise.equipment}</p>
									</div>
								{/if}
							</div>

							{#if exercise.exerciseConfig?.description}
								<div class="ml-8">
									<p class="text-sm text-muted-foreground">{exercise.exerciseConfig.description}</p>
								</div>
							{/if}

							{#if (exercise.exerciseConfig?.primaryMuscles?.length ?? 0) > 0}
								<div class="ml-8">
									<p class="text-xs text-muted-foreground mb-1">Primary muscles:</p>
									<div class="flex flex-wrap gap-1">
										{#each exercise.exerciseConfig!.primaryMuscles as muscle (muscle)}
											<Badge variant="secondary" class="text-xs">
												{muscle}
											</Badge>
										{/each}
									</div>
								</div>
							{/if}

							{#if exercise.notes}
								<div class="ml-8 p-3 bg-muted rounded-md">
									<p class="text-xs text-muted-foreground mb-1">Form tips:</p>
									<p class="text-sm">{exercise.notes}</p>
								</div>
							{/if}
						</div>

						{#if index < workout.exercises.length - 1}
							<Separator />
						{/if}
					{/each}
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
