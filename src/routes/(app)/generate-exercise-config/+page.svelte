<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Loader2, Dumbbell, Settings, CheckCircle } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	let exerciseName = '';
	let exerciseDescription = '';
	let romFocus = 'standard';
	let loading = false;
	interface ExerciseConfigResult {
		success: boolean;
		exerciseName: string;
		analysis: {
			exerciseType: string;
			primaryMuscles: string[];
			movementPattern: string;
			keyJoints: string[];
			movementDirection: string;
		};
		config: {
			name: string;
			initialDirection: 'up' | 'down';
			minPeakDistance: number;
			inverted?: boolean;
			anglePoints: Array<{
				name: string;
				points: [number, number, number];
				weight?: number;
				targetLowAngle?: number;
				targetHighAngle?: number;
			}>;
		};
	}

	let result: ExerciseConfigResult | null = null;
	let saving = false;
	let saveSuccess = false;

	const predefinedExercises = [
		{
			name: 'shoulder press',
			description: 'Press weights up from your shoulders to above your head'
		},
		{
			name: 'lateral raise',
			description: 'Raise your arms out to the sides until they\'re level with your shoulders'
		},
		{
			name: 'deadlift',
			description: 'Lift a weight from the ground up to your hips by bending your hips and knees'
		},
		{
			name: 'jumping jacks',
			description: 'Jump your feet apart while raising your arms up over your head'
		},
		{
			name: 'tricep dips',
			description: 'Lower and raise your body using your arms while holding onto a bench or chair'
		}
	];

	async function generateConfig() {
		if (!exerciseName.trim()) {
			toast.error('Please enter an exercise name');
			return;
		}

		loading = true;
		result = null;

		try {
			const response = await fetch('/api/exercise-config', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					exerciseName: exerciseName.trim(),
					exerciseDescription: exerciseDescription.trim() || undefined,
					romFocus: romFocus
				})
			});

			const data = await response.json();

			if (data.success) {
				result = data;
			} else {
				toast.error(data.error || 'Failed to create tracking setup');
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
		} finally {
			loading = false;
		}
	}

	function loadPredefinedExercise(exercise: { name: string; description: string }) {
		exerciseName = exercise.name;
		exerciseDescription = exercise.description;
	}

	function clearForm() {
		exerciseName = '';
		exerciseDescription = '';
		romFocus = 'standard';
		result = null;
		saveSuccess = false;
	}

	async function saveConfig() {
		if (!result) return;

		saving = true;

		try {
			const response = await fetch('/api/exercise-configs', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: result.config.name,
					displayName: result.exerciseName,
					description: exerciseDescription.trim() || undefined,
					exerciseType: result.analysis.exerciseType,
					primaryMuscles: result.analysis.primaryMuscles,
					movementPattern: result.analysis.movementPattern,
					keyJoints: result.analysis.keyJoints,
					movementDirection: result.analysis.movementDirection,
					config: result.config,
					generatedBy: 'AI'
				})
			});

			const data = await response.json();

			if (data.success) {
				toast.success('Saved! You can use this in your workouts now.');
				saveSuccess = true;
			} else {
				toast.error(data.error || 'Failed to save setup');
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
		} finally {
			saving = false;
		}
	}

	// MediaPipe landmark names for reference
	const landmarkNames: Record<number, string> = {
		0: 'NOSE',
		11: 'LEFT_SHOULDER',
		12: 'RIGHT_SHOULDER',
		13: 'LEFT_ELBOW',
		14: 'RIGHT_ELBOW',
		15: 'LEFT_WRIST',
		16: 'RIGHT_WRIST',
		23: 'LEFT_HIP',
		24: 'RIGHT_HIP',
		25: 'LEFT_KNEE',
		26: 'RIGHT_KNEE',
		27: 'LEFT_ANKLE',
		28: 'RIGHT_ANKLE'
	};

	function getLandmarkName(index: number): string {
		return landmarkNames[index] || `LANDMARK_${index}`;
	}

	function formatMuscleName(muscle: string): string {
		// Convert technical muscle names to readable format
		const muscleMap: Record<string, string> = {
			'lateral_deltoid': 'Shoulders',
			'anterior_deltoid': 'Front Shoulders',
			'posterior_deltoid': 'Rear Shoulders',
			'trapezius': 'Upper Back',
			'pectorals': 'Chest',
			'biceps': 'Biceps',
			'triceps': 'Triceps',
			'latissimus_dorsi': 'Lats',
			'quadriceps': 'Quads',
			'hamstrings': 'Hamstrings',
			'glutes': 'Glutes',
			'calves': 'Calves',
			'abdominals': 'Abs',
			'core': 'Core'
		};
		
		// Check if we have a mapping
		if (muscleMap[muscle.toLowerCase()]) {
			return muscleMap[muscle.toLowerCase()];
		}
		
		// Otherwise, convert underscores to spaces and capitalize
		return muscle.split('_').map(word => 
			word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
		).join(' ');
	}

	function formatMovementDirection(direction: string): string {
		const directionMap: Record<string, string> = {
			'horizontal': 'Side to side',
			'vertical': 'Up and down',
			'diagonal': 'Diagonal',
			'rotational': 'Rotating',
			'circular': 'Circular'
		};
		
		return directionMap[direction.toLowerCase()] || direction.charAt(0).toUpperCase() + direction.slice(1);
	}
</script>

<div class="container mx-auto p-6 max-w-4xl">
	<div class="text-center mb-8">
		<h1 class="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
			
			Create Exercise Tracking
		</h1>
		<p class="text-muted-foreground">
			Set up pose tracking for any exercise with AI
		</p>
	</div>

	<div class="grid gap-6 md:grid-cols-2">
		<!-- Input Form -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<Dumbbell class="h-5 w-5" />
					Exercise Details
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<div>
					<label for="exercise-name" class="block text-sm font-medium mb-2">
						What exercise? *
					</label>
					<Input
						id="exercise-name"
						bind:value={exerciseName}
						placeholder="e.g., shoulder press, burpees, lunges"
						class="w-full"
					/>
				</div>

				<div>
					<label for="exercise-description" class="block text-sm font-medium mb-2">
						How do you do it? (optional)
					</label>
					<Textarea
						id="exercise-description"
						bind:value={exerciseDescription}
						placeholder="e.g., Stand with weights at your sides, then raise your arms out to shoulder height"
						rows={3}
						class="w-full"
					/>
				</div>

				<div>
					<label for="rom-focus" class="block text-sm font-medium mb-2">
						How much movement?
					</label>
					<Select.Root type="single" bind:value={romFocus}>
						<Select.Trigger class="w-full">
							{romFocus === 'low' ? 'Small - Easy movements' : 
							 romFocus === 'high' ? 'Large - Full stretch' :
							 romFocus === 'maximum' ? 'Maximum - Full range' :
							 'Normal - Regular range'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="low">Small - Easy movements</Select.Item>
							<Select.Item value="standard">Normal - Regular range</Select.Item>
							<Select.Item value="high">Large - Full stretch</Select.Item>
							<Select.Item value="maximum">Maximum - Full range</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				<div class="flex gap-2">
					<Button onclick={generateConfig} disabled={loading} class="flex-1">
						{#if loading}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Creating...
						{:else}
							Create Tracking
						{/if}
					</Button>
					<Button variant="outline" onclick={clearForm}>
						Start Over
					</Button>
				</div>

				<!-- Quick Examples -->
				<div class="pt-4 border-t">
					<p class="text-sm font-medium mb-2">Try these:</p>
					<div class="flex flex-wrap gap-2">
						{#each predefinedExercises as exercise (exercise.name)}
							<Button
								variant="outline"
								size="sm"
								onclick={() => loadPredefinedExercise(exercise)}
								class="text-xs"
							>
								{exercise.name}
							</Button>
						{/each}
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Results -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					{#if result}
						<CheckCircle class="h-5 w-5 text-green-500" />
						Tracking Setup
					{:else}
						<Settings class="h-5 w-5" />
						Results
					{/if}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if loading}
					<div class="flex items-center justify-center p-8">
						<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				{:else if result}
					<div class="space-y-4">
						<!-- Exercise Analysis -->
						<div>
							<h4 class="font-semibold mb-2">Exercise Info</h4>
							<div class="space-y-2">
								<div class="flex items-center gap-2">
									<Badge variant="secondary">{result.analysis.exerciseType.replace('_', ' ')}</Badge>
									<Badge variant="outline">{result.analysis.movementPattern}</Badge>
								</div>
								<p class="text-sm">
									<strong>Main muscles:</strong> {result.analysis.primaryMuscles.map(m => formatMuscleName(m)).join(', ')}
								</p>
								<p class="text-sm">
									<strong>Movement direction:</strong> {formatMovementDirection(result.analysis.movementDirection)}
								</p>
							</div>
						</div>

						<!-- Tracking Configuration -->
						<div>
							<h4 class="font-semibold mb-2">Your Tracking Setup</h4>
							<div class="p-3 rounded-lg space-y-2 text-sm bg-muted/50">
								<div><strong>Exercise ID:</strong> {result.config.name}</div>
								<div><strong>Starts going:</strong> {result.config.initialDirection === 'up' ? 'Up' : 'Down'}</div>
								<div><strong>Time between reps:</strong> {result.config.minPeakDistance} frames</div>
								{#if result.config.inverted !== undefined}
									<div><strong>Angle direction:</strong> {result.config.inverted ? 'Reversed' : 'Normal'}</div>
								{/if}
								
								{#each result.config.anglePoints as angleConfig, i (i)}
									<div class="border-t pt-2 mt-2">
										<div class="font-medium mb-1 capitalize">{angleConfig.name.replace('_', ' ')}</div>
										<div class="ml-4 space-y-1 text-xs">
											<div>Watching: {angleConfig.points.map(p => getLandmarkName(p).replace('_', ' ').toLowerCase()).join(' → ')}</div>
											{#if angleConfig.weight !== undefined}
												<div>Importance: {angleConfig.weight >= 1.5 ? 'High' : angleConfig.weight >= 1.0 ? 'Medium' : 'Low'}</div>
											{/if}
											{#if angleConfig.targetLowAngle !== undefined && angleConfig.targetHighAngle !== undefined}
												<div class="text-green-600 font-medium">
													Optimal range: {angleConfig.targetLowAngle}° - {angleConfig.targetHighAngle}°
													<span class="text-xs text-gray-500">({angleConfig.targetHighAngle - angleConfig.targetLowAngle}° range)</span>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>

						<!-- JSON Output -->
<!-- 						<details class="border rounded-lg">
							<summary class="p-3 cursor-pointer font-medium">See technical details</summary>
							<pre class="p-3 text-xs overflow-x-auto">{JSON.stringify(result.config, null, 2)}</pre>
						</details> -->

						<!-- Save Section -->
						<div class="border-t pt-4">
							<div class="flex gap-2">
								<Button onclick={saveConfig} disabled={saving || saveSuccess} class="flex-1">
									{#if saving}
										<Loader2 class="mr-2 h-4 w-4 animate-spin" />
										Saving...
									{:else if saveSuccess}
										<CheckCircle class="mr-2 h-4 w-4" />
										Saved!
									{:else}
										Save this setup
									{/if}
								</Button>
								<Button variant="outline" onclick={() => window.location.href = '/exercise-configs'}>
									View All
								</Button>
							</div>
						</div>
					</div>
				{:else}
					<div class="text-center text-muted-foreground p-8">
						Enter an exercise name above and we'll create the tracking setup for you.
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Info Section -->
	<Card class="mt-6">
		<CardContent class="pt-6">
			<h3 class="font-semibold mb-2">How it works</h3>
			<p class="text-sm text-muted-foreground mb-4">
				This tool uses AI to understand how exercises work and set up tracking. 
				The AI looks at how your body moves to figure out the best way to track your form.
			</p>
			<div class="grid md:grid-cols-3 gap-4 text-sm">
				<div>
					<strong>Which body parts to track:</strong> AI picks the most important body parts for each exercise.
				</div>
				<div>
					<strong>How your body moves:</strong> Figures out which direction you move and how to measure it.
				</div>
				<div>
					<strong>Measuring your form:</strong> Sets up angle measurements to check if you're doing the exercise correctly.
				</div>
			</div>
		</CardContent>
	</Card>
</div>
