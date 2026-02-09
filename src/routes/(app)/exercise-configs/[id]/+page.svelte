<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { Separator } from '$lib/components/ui/separator';
	import {
		ArrowLeftIcon,
		PlayIcon,
		SettingsIcon,
		InfoIcon,
		ActivityIcon,
		TargetIcon,
		BrainIcon,
		CalendarIcon,
		TestTubeIcon,
		CopyIcon
	} from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import type { ExerciseConfig } from '@prisma/client';

	// Type for the exercise configuration JSON structure
	interface ExerciseConfigData {
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
	}

	let exerciseConfig: ExerciseConfig | null = null;
	let isLoading = true;

	onMount(async () => {
		await loadExerciseConfig();
	});

	async function loadExerciseConfig() {
		try {
			isLoading = true;
			const response = await fetch(`/api/exercise-configs/${$page.params.id}`);
			if (response.ok) {
				const data = await response.json();
				exerciseConfig = data.config;
				if (!exerciseConfig) {
					toast.error('Exercise configuration not found');
				}
			} else {
				toast.error('Failed to load exercise configuration');
			}
		} catch (error) {
			console.error('Error loading exercise config:', error);
			toast.error('Error loading exercise configuration');
		} finally {
			isLoading = false;
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

	function getMovementPatternColor(pattern: string): string {
		switch (pattern.toLowerCase()) {
			case 'push':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
			case 'pull':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
			case 'squat':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
			case 'hinge':
				return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
			case 'lunge':
				return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
			case 'rotation':
				return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
			case 'isometric':
				return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
		}
	}

	function getGeneratedByColor(source: string): string {
		if (source === 'AI') {
			return 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 dark:from-purple-900 dark:to-pink-900 dark:text-purple-300';
		}
		return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
	}

	async function copyConfigToClipboard() {
		try {
			if (!exerciseConfig) {
				toast.error('No configuration to copy');
				return;
			}
			await navigator.clipboard.writeText(JSON.stringify(exerciseConfig.config, null, 2));
			toast.success('Configuration copied to clipboard');
		} catch {
			toast.error('Failed to copy configuration');
		}
	}

	function formatConfigPreview(exerciseConfig: ExerciseConfig): string {
		if (!exerciseConfig?.config) return 'No configuration data';

		// The config field contains the exercise-specific MediaPipe configuration
		const config = exerciseConfig.config as unknown as ExerciseConfigData;
		
		// Create a formatted preview of the exercise configuration
		const preview = {
			exerciseName: config.name,
			initialDirection: config.initialDirection,
			minPeakDistance: config.minPeakDistance,
			inverted: config.inverted,
			anglePoints: config.anglePoints?.map((angleConfig) => ({
				name: angleConfig.name,
				points: angleConfig.points,
				weight: angleConfig.weight || 1.0,
				...(angleConfig.targetLowAngle !== undefined && angleConfig.targetHighAngle !== undefined && {
					targetLowAngle: angleConfig.targetLowAngle,
					targetHighAngle: angleConfig.targetHighAngle
				})
			})) || []
		};
		
		return JSON.stringify(preview, null, 2);
	}

	function getJointName(jointIndex: number): string {
		const jointNames: Record<number, string> = {
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
		return jointNames[jointIndex] || `Joint ${jointIndex}`;
	}

	function getConfigDetails(exerciseConfig: ExerciseConfig): ExerciseConfigData | null {
		if (!exerciseConfig?.config) return null;
		
		try {
			const config = exerciseConfig.config as unknown as ExerciseConfigData;
			return {
				name: config.name || '',
				initialDirection: config.initialDirection || 'up',
				minPeakDistance: config.minPeakDistance || 8,
				inverted: config.inverted,
				anglePoints: config.anglePoints || []
			};
		} catch {
			return null;
		}
	}
</script>

<div class="space-y-6">
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="space-y-4 text-center">
				<div
					class="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
				></div>
				<p class="text-muted-foreground">Loading exercise configuration...</p>
			</div>
		</div>
	{:else if !exerciseConfig}
		<Card>
			<CardContent class="flex flex-col items-center justify-center space-y-4 py-12">
				<InfoIcon class="text-muted-foreground h-12 w-12" />
				<h3 class="text-lg font-semibold">Configuration not found</h3>
				<p class="text-muted-foreground text-center">
					The exercise configuration you're looking for doesn't exist or has been deleted.
				</p>
				<Button href="/exercise-configs">
					<ArrowLeftIcon class="mr-2 h-4 w-4" />
					Back to Exercise Configs
				</Button>
			</CardContent>
		</Card>
	{:else}
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-4">
				<Button variant="ghost" size="sm" href="/exercise-configs">
					<ArrowLeftIcon class="mr-2 h-4 w-4" />
					Back
				</Button>
				<div>
					<h1 class="text-3xl font-bold tracking-tight">{exerciseConfig.displayName}</h1>
					<div class="mt-1 flex items-center gap-2">
						<Badge class={getGeneratedByColor(exerciseConfig.generatedBy)}>
							{exerciseConfig.generatedBy === 'AI' ? 'AI Generated' : '📋 Predefined'}
						</Badge>
						<span class="text-muted-foreground">•</span>
						<span class="text-muted-foreground text-sm">
							Created {new Date(exerciseConfig.createdAt).toLocaleDateString()}
						</span>
					</div>
				</div>
			</div>
			<div class="flex gap-2">
				<Button href="/form-analysis?configId={exerciseConfig.id}" class="gap-2">
					<PlayIcon class="h-4 w-4" />
					Try It Out
				</Button>
				<Button variant="outline" onclick={copyConfigToClipboard} class="gap-2">
					<CopyIcon class="h-4 w-4" />
					Copy Settings
				</Button>
			</div>
		</div>

		<!-- Overview -->
		<Card>
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<InfoIcon class="h-5 w-5" />
					Overview
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				{#if exerciseConfig.description}
					<p class="text-muted-foreground">{exerciseConfig.description}</p>
				{/if}

				<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div class="flex items-center gap-2">
						<ActivityIcon class="text-muted-foreground h-4 w-4" />
						<div>
							<p class="text-muted-foreground text-sm">Exercise Type</p>
							<Badge class={getExerciseTypeColor(exerciseConfig.exerciseType)}>
								{exerciseConfig.exerciseType.replace('_', ' ')}
							</Badge>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<TargetIcon class="text-muted-foreground h-4 w-4" />
						<div>
							<p class="text-muted-foreground text-sm">Movement Pattern</p>
							<Badge class={getMovementPatternColor(exerciseConfig.movementPattern)}>
								{exerciseConfig.movementPattern}
							</Badge>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<BrainIcon class="text-muted-foreground h-4 w-4" />
						<div>
							<p class="text-muted-foreground text-sm">Movement Direction</p>
							<p class="font-medium capitalize">{exerciseConfig.movementDirection}</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<CalendarIcon class="text-muted-foreground h-4 w-4" />
						<div>
							<p class="text-muted-foreground text-sm">Last Updated</p>
							<p class="font-medium">{new Date(exerciseConfig.updatedAt).toLocaleDateString()}</p>
						</div>
					</div>
				</div>

				{#if exerciseConfig.primaryMuscles?.length > 0}
					<div class="space-y-2">
						<p class="text-sm font-medium">Primary muscles worked:</p>
						<div class="flex flex-wrap gap-1">
							{#each exerciseConfig.primaryMuscles as muscle (muscle)}
								<Badge variant="secondary">
									{muscle}
								</Badge>
							{/each}
						</div>
					</div>
				{/if}

				{#if exerciseConfig.keyJoints?.length > 0}
					<div class="space-y-2">
						<p class="text-sm font-medium">Key joints involved:</p>
						<div class="flex flex-wrap gap-1">
							{#each exerciseConfig.keyJoints as joint (joint)}
								<Badge variant="outline">
									{joint}
								</Badge>
							{/each}
						</div>
					</div>
				{/if}
			</CardContent>
		</Card>

		<!-- Technical Configuration -->
		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Configuration Preview -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<SettingsIcon class="h-5 w-5" />
						Exercise Settings
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="space-y-4">
						<!-- Detailed Configuration Display -->
						{#if getConfigDetails(exerciseConfig)}
							{@const details = getConfigDetails(exerciseConfig)}
							{#if details}
								<div class="space-y-4">
									<!-- Basic Settings -->
									<div class="space-y-3">
										<div class="flex items-center justify-between rounded-lg border p-3">
											<div>
												<p class="text-sm font-medium">Exercise ID</p>
												<p class="text-muted-foreground text-xs">Unique name for this exercise</p>
											</div>
											<Badge variant="outline" class="font-mono text-xs">
												{details.name}
											</Badge>
										</div>

										<div class="flex items-center justify-between rounded-lg border p-3">
											<div>
												<p class="text-sm font-medium">Movement Start</p>
												<p class="text-muted-foreground text-xs">Does the exercise start going up or down?</p>
											</div>
											<Badge variant={details.initialDirection === 'up' ? 'default' : 'secondary'}>
												{details.initialDirection === 'up' ? 'Up' : 'Down'}
											</Badge>
										</div>

										<div class="flex items-center justify-between rounded-lg border p-3">
											<div>
												<p class="text-sm font-medium">Time Between Reps</p>
												<p class="text-muted-foreground text-xs">Minimum time needed to count separate reps</p>
											</div>
											<span class="text-sm">
												{details.minPeakDistance} frames
											</span>
										</div>

										{#if details.inverted !== undefined}
											<div class="flex items-center justify-between rounded-lg border p-3">
												<div>
													<p class="text-sm font-medium">Angle Direction</p>
													<p class="text-muted-foreground text-xs">How the movement angle is measured</p>
												</div>
												<Badge variant={details.inverted ? 'secondary' : 'outline'}>
													{details.inverted ? 'Reversed' : 'Normal'}
												</Badge>
											</div>
										{/if}
									</div>

									<!-- Angle Configuration -->
									{#if details.anglePoints.length > 0}
										<Separator />
										<div class="space-y-3">
											<h4 class="text-sm font-medium">Joints Being Tracked</h4>
											{#each details.anglePoints as angleConfig, i (i)}
												<div class="rounded-lg border p-3 space-y-2">
													<div class="flex items-center justify-between">
														<span class="text-sm font-medium capitalize">{angleConfig.name.replace('_', ' ')}</span>
														<Badge variant="outline" class="text-xs">
															Importance: {angleConfig.weight || 1.0}
														</Badge>
													</div>
													<div class="text-xs space-y-1">
														<div class="flex items-center gap-1">
															<span class="w-2 h-2 rounded-full bg-blue-500"></span>
															<span>Tracking: {angleConfig.points.map(p => getJointName(p).replace('_', ' ').toLowerCase()).join(' → ')}</span>
														</div>
														{#if angleConfig.targetLowAngle !== undefined && angleConfig.targetHighAngle !== undefined}
															<div class="flex items-center gap-1">
																<span class="w-2 h-2 rounded-full bg-green-500"></span>
																<span class="text-green-700 font-medium">
																	Optimal Range: {angleConfig.targetLowAngle}° - {angleConfig.targetHighAngle}°
																	<span class="text-gray-500">({angleConfig.targetHighAngle - angleConfig.targetLowAngle}° range)</span>
																</span>
															</div>
														{/if}
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{:else}
							<div class="text-muted-foreground p-4 text-center">
								<p>No configuration details available</p>
							</div>
						{/if}

						<!-- Raw JSON -->
						<Separator />
						<!-- <div class="space-y-2">
							<h4 class="text-sm font-medium">Raw Configuration</h4>
							<div class="bg-muted rounded-lg p-4">
								<pre class="overflow-x-auto text-xs"><code
										>{formatConfigPreview(exerciseConfig)}</code
									></pre>
							</div>
						</div> -->

						<div class="flex gap-2">
							<Button variant="outline" size="sm" onclick={copyConfigToClipboard} class="gap-2">
								<CopyIcon class="h-4 w-4" />
								Copy Settings
							</Button>
							<Button href="/form-analysis?configId={exerciseConfig.id}" size="sm" class="gap-2">
								<TestTubeIcon class="h-4 w-4" />
								Try It Live
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<!-- Technical Specifications -->
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<ActivityIcon class="h-5 w-5" />
						Details
					</CardTitle>
				</CardHeader>
				<CardContent class="space-y-4">
					<div class="space-y-3">
						<div class="flex items-center justify-between rounded-lg border p-3">
							<div>
								<p class="text-sm font-medium">ID</p>
								<p class="text-muted-foreground text-xs">Unique identifier for this exercise</p>
							</div>
							<Badge variant="outline" class="font-mono text-xs">
								{exerciseConfig.id}
							</Badge>
						</div>

						<div class="flex items-center justify-between rounded-lg border p-3">
							<div>
								<p class="text-sm font-medium">Created By</p>
								<p class="text-muted-foreground text-xs">How this exercise was set up</p>
							</div>
							<Badge class={getGeneratedByColor(exerciseConfig.generatedBy)}>
								{exerciseConfig.generatedBy === 'AI' ? 'AI Generated' : 'Predefined'}
							</Badge>
						</div>

						<div class="flex items-center justify-between rounded-lg border p-3">
							<div>
								<p class="text-sm font-medium">Created</p>
								<p class="text-muted-foreground text-xs">Initial creation date</p>
							</div>
							<span class="text-sm">
								{new Date(exerciseConfig.createdAt).toLocaleDateString()}
							</span>
						</div>

						<div class="flex items-center justify-between rounded-lg border p-3">
							<div>
								<p class="text-sm font-medium">Last Updated</p>
								<p class="text-muted-foreground text-xs">Most recent modification</p>
							</div>
							<span class="text-sm">
								{new Date(exerciseConfig.updatedAt).toLocaleDateString()}
							</span>
						</div>
					</div>

					<Separator />

					<div class="space-y-2">
						<p class="text-sm font-medium">Camera Tracking Settings:</p>
						<div class="text-muted-foreground space-y-1 text-sm bg-muted rounded-lg p-3">
							<div class="text-xs space-y-1">
								<div>• Tracking Quality: <span class="text-foreground">Standard</span></div>
								<div>• Detection Sensitivity: <span class="text-foreground">Medium</span></div>
								<div>• Smoothing: <span class="text-foreground">Enabled</span></div>
							</div>
						</div>
					</div>

					<Separator />

					<div class="space-y-2">
						<p class="text-sm font-medium">How It Works:</p>
						<ul class="text-muted-foreground space-y-1 text-sm">
							<li>• Uses your camera to track your body movements</li>
							<li>• Optimized for {exerciseConfig.movementPattern} exercises</li>
							<li>• Provides real-time feedback on your form</li>
							<li>• Works with workout routines and live training</li>
						</ul>
					</div>
				</CardContent>
			</Card>
		</div>

		<!-- Actions -->
		<Card>
			<CardHeader>
				<CardTitle>Quick Actions</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="flex flex-wrap gap-3">
					<Button href="/form-analysis?configId={exerciseConfig.id}" class="gap-2">
						<PlayIcon class="h-4 w-4" />
						Try It Out
					</Button>
					<Button variant="outline" onclick={copyConfigToClipboard} class="gap-2">
						<CopyIcon class="h-4 w-4" />
						Copy Settings
					</Button>
					<Button href="/exercise-configs" variant="outline" class="gap-2">
						<ArrowLeftIcon class="h-4 w-4" />
						Back to All Exercises
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
