<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Send, User, Bot, Dumbbell } from 'lucide-svelte';
	import { Chat } from '@ai-sdk/svelte';

	// Types
	interface WorkoutExercise {
		name: string;
		sets: number;
		reps: string;
		rest: string;
		equipment?: string;
		notes?: string;
	}

	interface Workout {
		name: string;
		description: string;
		exercises: WorkoutExercise[];
		totalDuration: number;
		frequency: string;
	}

	// Initialize the AI SDK chat
	const chat = new Chat({
		api: '/api/chat',
		maxSteps: 5 // Allow up to 5 sequential LLM calls for agentic workflows
	});

	// Quick start options
	let workoutGoals = $state('');
	let selectedEquipment = $state<string[]>([]);
	let selectedFitnessLevel = $state('');
	let showQuickStart = $state(true);
	let chatContainer = $state<HTMLElement>();

	$effect(() => {
		if (chat.messages.length > 0) {
			showQuickStart = false;
			setTimeout(scrollToBottom, 100);
		}
	});

	const availableEquipment = [
		'Dumbbells',
		'Barbell',
		'Kettlebells',
		'Resistance Bands',
		'Pull-up Bar',
		'Bench',
		'Yoga Mat',
		'No Equipment'
	];

	// Map equipment to their image paths
	const equipmentImages: Record<string, string> = {
		'Dumbbells': '/dumbbells.png',
		'Barbell': '/barbells.png',
		'Kettlebells': '/kettlebell.png',
		'Resistance Bands': '/resistance-bands.png',
		'Pull-up Bar': '/push-up-bar.png',
		'Bench': '/bench.png',
		'Yoga Mat': '/yoga-mat.png',
		'No Equipment': '' // No image for this one
	};

	const fitnessLevels = [
		{
			value: 'beginner',
			label: 'Beginner',
			description: 'New to fitness or returning after a break'
		},
		{ value: 'intermediate', label: 'Intermediate', description: 'Regular exercise for 6+ months' },
		{
			value: 'advanced',
			label: 'Advanced',
			description: 'Experienced with proper form and intensity'
		}
	];

	function toggleEquipment(equipment: string) {
		if (selectedEquipment.includes(equipment)) {
			selectedEquipment = selectedEquipment.filter((item) => item !== equipment);
		} else {
			selectedEquipment = [...selectedEquipment, equipment];
		}
	}

	function scrollToBottom() {
		if (chatContainer) {
			chatContainer.scrollTop = chatContainer.scrollHeight;
		}
	}

	function createQuickStartMessage() {
		if (!workoutGoals.trim()) return;

		let message = `I want to ${workoutGoals}`;
		if (selectedEquipment.length > 0) {
			message += `. I have access to: ${selectedEquipment.join(', ')}`;
		}
		if (selectedFitnessLevel) {
			message += `. My fitness level is ${selectedFitnessLevel}`;
		}
		message += '. Can you create a workout routine for me?';

		// Set the input and submit
		chat.input = message;
		chat.handleSubmit();

		// Clear form
		workoutGoals = '';
		selectedEquipment = [];
		selectedFitnessLevel = '';
	}

	// Types for tool invocations
	interface ToolInvocation {
		toolName: string;
		result?: {
			workout?: Workout;
		};
		args?: {
			workoutPlan?: Workout;
		};
	}

	// Extract workout data from tool calls
	function getWorkoutFromMessage(message: { toolInvocations?: ToolInvocation[] }): Workout | null {
		// Check for tool invocations in the message
		if (message.toolInvocations) {
			for (const tool of message.toolInvocations) {
				if (tool.toolName === 'createWorkout' && tool.result) {
					return tool.result.workout || tool.args?.workoutPlan || null;
				}
			}
		}
		return null;
	}

	$effect(() => {
		scrollToBottom();
	});
</script>

<div class="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
	{#if showQuickStart && chat.messages.length === 0}
		<!-- Quick Start Section -->
		<div class="space-y-8 p-6">
			<div class="space-y-2 text-center">
				<h2 class="text-3xl font-bold tracking-tight">What are your fitness goals?</h2>
				<p class="text-muted-foreground">
					Tell us about your goals and available equipment to get a personalized workout plan.
				</p>
			</div>

			<!-- Goals Input -->
			<div class="space-y-4">
				<Textarea
					bind:value={workoutGoals}
					placeholder="I want to build muscle, lose weight, improve endurance..."
					class="min-h-[120px] resize-none text-base"
				/>

				<!-- Quick Goals -->
				<div class="flex flex-wrap justify-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onclick={() => (workoutGoals = 'Build muscle and strength')}
					>
						Build Muscle
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (workoutGoals = 'Lose weight and improve cardio')}
					>
						Lose Weight
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (workoutGoals = 'Improve flexibility and mobility')}
					>
						Flexibility
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => (workoutGoals = 'General fitness for beginners')}
					>
						Beginner
					</Button>
				</div>
			</div>

			<!-- Equipment Selection -->
			<div class="space-y-4">
				<h3 class="text-lg font-medium">Available Equipment</h3>

				{#if selectedEquipment.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each selectedEquipment as equipment (equipment)}
							<Badge variant="secondary" class="flex items-center gap-1.5">
								{#if equipmentImages[equipment]}
									<img
										src={equipmentImages[equipment]}
										alt={equipment}
										class="h-4 w-4 object-contain"
									/>
								{/if}
								{equipment}
							</Badge>
						{/each}
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{#each availableEquipment as equipment (equipment)}
						<Button
							variant={selectedEquipment.includes(equipment) ? 'default' : 'outline'}
							size="sm"
							onclick={() => toggleEquipment(equipment)}
							class="h-auto px-3 py-3 text-sm flex items-center justify-center gap-2"
						>
							{#if equipmentImages[equipment]}
								<img
									src={equipmentImages[equipment]}
									alt={equipment}
									class="h-5 w-5 object-contain flex-shrink-0"
								/>
							{/if}
							<span class="text-xs sm:text-sm">{equipment}</span>
						</Button>
					{/each}
				</div>
			</div>

			<!-- Fitness Level Selection -->
			<div class="space-y-4">
				<h3 class="text-lg font-medium">Fitness Level</h3>

				{#if selectedFitnessLevel}
					<Badge variant="secondary">
						{fitnessLevels.find((level) => level.value === selectedFitnessLevel)?.label}
					</Badge>
				{/if}

				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{#each fitnessLevels as level (level.value)}
						<Button
							variant={selectedFitnessLevel === level.value ? 'default' : 'outline'}
							size="sm"
							onclick={() => (selectedFitnessLevel = level.value)}
							class="h-auto px-4 py-3 text-sm"
						>
							{level.label}
						</Button>
					{/each}
				</div>

				<p class="text-muted-foreground text-sm">
					{#if selectedFitnessLevel === 'beginner'}
						New to fitness or returning after a break
					{:else if selectedFitnessLevel === 'intermediate'}
						Regular exercise for 6+ months
					{:else if selectedFitnessLevel === 'advanced'}
						Experienced with proper form and intensity
					{/if}
				</p>
			</div>

			<!-- Submit Button -->
			<div class="text-center">
				<Button
					size="lg"
					onclick={createQuickStartMessage}
					disabled={!workoutGoals.trim() || !selectedFitnessLevel}
					class="px-8"
				>
					<Dumbbell class="mr-2 h-4 w-4" />
					Create My Workout Plan
				</Button>
			</div>
		</div>
	{:else}
		<!-- Chat Interface -->
		<div class="flex min-h-0 flex-1 flex-col">
			<!-- Chat Messages -->
			<div class="flex-1 space-y-4 overflow-y-auto p-4" bind:this={chatContainer}>
				{#each chat.messages as message, messageIndex (messageIndex)}
					<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
						<div
							class="flex max-w-[80%] {message.role === 'user'
								? 'flex-row-reverse'
								: 'flex-row'} gap-2"
						>
							<!-- Avatar -->
							<div
								class="bg-primary flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
							>
								{#if message.role === 'user'}
									<User class="text-primary-foreground h-4 w-4" />
								{:else}
									<Bot class="text-primary-foreground h-4 w-4" />
								{/if}
							</div>

							<!-- Message Content -->
							<div class="space-y-2">
								<Card
									class="p-3 {message.role === 'user' ? 'bg-background text-primary' : 'bg-muted'}"
								>
									<div
										class="prose prose-sm max-w-none {message.role === 'user'
											? 'dark:prose-invert'
											: 'prose-gray dark:prose-invert'} whitespace-pre-wrap"
									>
										{#each message.parts as part, partIndex (partIndex)}
											{#if part.type === 'text'}
												<div class="leading-relaxed">{part.text}</div>
											{/if}
										{/each}
									</div>
								</Card>

								<!-- Workout Display -->
								{#if getWorkoutFromMessage(message)}
									{@const workout = getWorkoutFromMessage(message)}
									{#if workout}
										<Card class="bg-accent/50 p-4">
											<div class="space-y-3">
												<div class="flex items-center gap-2">
													<Dumbbell class="text-primary h-5 w-5" />
													<h3 class="text-lg font-semibold">{workout.name}</h3>
												</div>
												<p class="text-muted-foreground text-sm">{workout.description}</p>

												<div class="grid gap-3">
													{#each workout.exercises as exercise (exercise.name)}
														<div class="space-y-1 rounded-lg border p-3">
															<h4 class="font-medium">{exercise.name}</h4>
															<div class="text-muted-foreground space-y-1 text-sm">
																<div>
																	Sets: {exercise.sets} | Reps: {exercise.reps} | Rest: {exercise.rest}
																</div>
																{#if exercise.equipment}
																	<div>Equipment: {exercise.equipment}</div>
																{/if}
																{#if exercise.notes}
																	<div class="italic">{exercise.notes}</div>
																{/if}
															</div>
														</div>
													{/each}
												</div>

												<div class="text-muted-foreground text-sm">
													<div>Duration: {workout.totalDuration} minutes</div>
													<div>Frequency: {workout.frequency}</div>
												</div>
											</div>
										</Card>
									{/if}
								{/if}
							</div>
						</div>
					</div>
				{/each}

				{#if chat.status === 'streaming' || chat.status === 'submitted'}
					<div class="flex justify-start">
						<div class="flex gap-2">
							<div class="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
								<Bot class="text-primary-foreground h-4 w-4" />
							</div>
							<Card class="bg-muted p-3">
								<div class="flex space-x-1">
									<div class="h-2 w-2 animate-bounce rounded-full bg-current"></div>
									<div
										class="h-2 w-2 animate-bounce rounded-full bg-current"
										style="animation-delay: 0.1s"
									></div>
									<div
										class="h-2 w-2 animate-bounce rounded-full bg-current"
										style="animation-delay: 0.2s"
									></div>
								</div>
							</Card>
						</div>
					</div>
				{/if}
			</div>

			<!-- Chat Input -->
			<div class="border-t p-4">
				<form onsubmit={chat.handleSubmit} class="flex gap-2">
					<Textarea
						bind:value={chat.input}
						placeholder="Ask about workouts, exercises, or fitness advice..."
						class="max-h-32 min-h-[2.5rem] flex-1 resize-none"
						onkeydown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								chat.handleSubmit();
							}
						}}
					/>
					<Button
						type="submit"
						disabled={!chat.input.trim() ||
							chat.status === 'streaming' ||
							chat.status === 'submitted'}
						size="sm"
						class="self-end"
					>
						<Send class="h-4 w-4" />
					</Button>
				</form>
			</div>
		</div>
	{/if}
</div>
