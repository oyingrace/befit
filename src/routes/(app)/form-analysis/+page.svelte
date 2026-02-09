<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { browser } from '$app/environment';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Label } from '$lib/components/ui/label';
	import { Switch } from '$lib/components/ui/switch';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		VideoIcon,
		CameraIcon,
		PlayIcon,
		Square,
		UploadIcon,
		Dumbbell
	} from 'lucide-svelte';
	import {
		processExerciseReps,
		type Pose as PoseData,
		type ExerciseConfig
	} from '$lib/workout-utils';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/stores';
	import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

	let videoElement: HTMLVideoElement;
	let canvasElement: HTMLCanvasElement;
	let canvasCtx: CanvasRenderingContext2D;
	let fileInput: HTMLInputElement;

	let isLoading = false;
	let isDetecting = false;
	let selectedSource = 'camera';
	let availableCameras: MediaDeviceInfo[] = [];
	let selectedCameraId = '';
	let selectedWorkoutId = '';
	let currentStream: MediaStream | null = null;
	let statusMessage = '';
	let poseLandmarker: PoseLandmarker | null = null;

	// Exercise tracking variables
	let poseHistory: PoseData[] = [];
	let currentReps = 0;
	let maxRepsEverSeen = 0; // Track the highest rep count to prevent decreases
	let lastProcessedRepCount = 0; // Track how many reps we've already logged
	let feedbackList: Array<{
		id: string;
		repNumber: number;
		feedback: string;
		score: number;
		classification: string;
		timestamp: Date;
	}> = [];
	let pendingFeedback = new Set<number>(); // Track reps waiting for feedback

	// Animated rep counter
	const animatedReps = tweened(0, {
		duration: 400,
		easing: cubicOut
	});

	// Update animated counter when currentReps changes
	$: animatedReps.set(currentReps);

	// Feature toggle variables
	let enableRAG = false;
	let enableVoice = false;

	// AI feedback event handler
	const handleAIFeedback = (event: CustomEvent) => {
		const { repNumber, feedback, score, classification, timestamp } = event.detail;
		
		// Remove from pending feedback
		pendingFeedback.delete(repNumber);
		pendingFeedback = new Set(pendingFeedback); // Trigger reactivity
		
		// Update existing feedback entry if it exists, otherwise add new one
		const existingIndex = feedbackList.findIndex(f => f.repNumber === repNumber);
		const feedbackEntry = {
			id: `rep-${repNumber}-${Date.now()}`,
			repNumber,
			feedback,
			score,
			classification,
			timestamp
		};
		
		if (existingIndex >= 0) {
			feedbackList[existingIndex] = feedbackEntry;
			feedbackList = [...feedbackList]; // Trigger reactivity
		} else {
			feedbackList = [...feedbackList, feedbackEntry];
		}
	};

	onMount(async () => {
		// Initialize canvas context
		canvasCtx = canvasElement.getContext('2d')!;

		// Handle query parameters for direct workout/config loading
		const workoutId = $page.url.searchParams.get('workoutId');
		const configId = $page.url.searchParams.get('configId');

		// Load saved workouts and exercise configs
		await loadSavedWorkouts();
		await loadSavedExerciseConfigs();

		// Auto-select workout or config if specified in URL
		if (workoutId && savedWorkouts.length > 0) {
			const workout = savedWorkouts.find(w => w.id === workoutId);
			if (workout) {
				selectWorkout(workout);
				toast.success(`Loaded workout: ${workout.name}`);
			}
		} else if (configId) {
			// Auto-select exercise config if specified in URL
			selectedExerciseConfigId = configId;
			// The reactive statement will handle the selection
		}

		// Initialize MediaPipe Tasks Vision
		try {
			const vision = await FilesetResolver.forVisionTasks(
				'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
			);
			
			poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
				baseOptions: {
					modelAssetPath: '/mediapipe/pose_landmarker_heavy.task',
					delegate: 'GPU'
				},
				runningMode: 'VIDEO',
				numPoses: 1,
				minPoseDetectionConfidence: 0.5,
				minPosePresenceConfidence: 0.5,
				minTrackingConfidence: 0.5
			});
			
			statusMessage = 'MediaPipe initialized successfully';
		} catch (error) {
			console.error('Failed to load MediaPipe:', error);
			statusMessage = 'Failed to initialize MediaPipe';
		}

		// Get available cameras
		// Note: Some browsers require user interaction before camera enumeration works properly
		try {
			await getAvailableCameras();
		} catch {
			console.log('Initial camera enumeration failed, will try again when user interacts');
			statusMessage = 'Click "Refresh" to load available cameras';
		}

		// Load saved workouts and exercise configs
		await loadSavedWorkouts();
		await loadSavedExerciseConfigs();

		// Listen for AI feedback events
		const handleAIFeedback = (event: CustomEvent) => {
			const { repNumber, feedback, score, classification, timestamp } = event.detail;
			
			// Update existing feedback entry if it exists, otherwise add new one
			const existingIndex = feedbackList.findIndex(f => f.repNumber === repNumber);
			const feedbackEntry = {
				id: `rep-${repNumber}-${Date.now()}`,
				repNumber,
				feedback,
				score,
				classification,
				timestamp
			};
			
			if (existingIndex >= 0) {
				feedbackList[existingIndex] = feedbackEntry;
				feedbackList = [...feedbackList]; // Trigger reactivity
			} else {
				feedbackList = [...feedbackList, feedbackEntry];
			}
		};

		// Add event listener for AI feedback (client-side only)
		if (browser) {
			window.addEventListener('ai-feedback', handleAIFeedback as EventListener);
		}
	});

	onDestroy(() => {
		// Remove event listener (client-side only)
		if (browser) {
			window.removeEventListener('ai-feedback', handleAIFeedback as EventListener);
		}
	});

	async function getAvailableCameras() {
		try {
			// Check if MediaDevices API is available
			if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
				statusMessage = 'Camera access not available in this browser';
				return;
			}

			statusMessage = 'Requesting camera permission...';

			// First request permission to get device labels
			await navigator.mediaDevices
				.getUserMedia({ video: true })
				.then((stream) => {
					// Stop the stream immediately, we just needed permission
					stream.getTracks().forEach((track) => track.stop());
					statusMessage = 'Permission granted, enumerating cameras...';
				})
				.catch(() => {
					// Permission denied, but we can still enumerate devices without labels
					statusMessage = 'Permission denied, but will try to list cameras...';
				});

			const devices = await navigator.mediaDevices.enumerateDevices();
			availableCameras = devices.filter((device) => device.kind === 'videoinput');
			console.log('Available cameras:', availableCameras);

			if (availableCameras.length > 0) {
				if (!selectedCameraId) {
					selectedCameraId = availableCameras[0].deviceId;
				}
				statusMessage = `Found ${availableCameras.length} camera(s)`;
				// Clear success message after 3 seconds
				setTimeout(() => {
					statusMessage = '';
				}, 3000);
			} else {
				statusMessage =
					'No cameras found. Make sure camera is connected and permissions are granted.';
			}
		} catch (error) {
			console.error('Error getting cameras:', error);
			statusMessage = `Error accessing cameras: ${error instanceof Error ? error.message : 'Unknown error'}`;
		}
	}

	function processVideoFrame() {
		if (!poseLandmarker || !videoElement || videoElement.videoWidth === 0) return;
		
		try {
			const result = poseLandmarker.detectForVideo(videoElement, performance.now());
			
			// Clear canvas
			canvasCtx.save();
			canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

			// Draw the video frame
			canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

			// Draw pose landmarks if detected
			if (result.landmarks && result.landmarks.length > 0) {
				const landmarks = result.landmarks[0]; // Get first person's landmarks
				
				// Convert landmarks to the format expected by workout-utils
				const convertedLandmarks = landmarks.map(landmark => ({
					x: landmark.x,
					y: landmark.y,
					z: landmark.z,
					visibility: landmark.visibility || 1
				}));
				
				// Add pose to history for rep counting
				poseHistory.push(convertedLandmarks);
				
				// Update rep count using dynamic exercise configs
				if (poseHistory.length > 15 && currentExercise?.exerciseConfig) {
					// Use the preloaded exercise config from the workout
					const preloadedConfig = currentExercise.exerciseConfig.config;
					
					processExerciseReps(
						poseHistory, 
						currentExercise.name, 
						lastProcessedRepCount, 
						{
							enableRAG,
							enableVoice
						},
						undefined, // no description needed since we have the config
						preloadedConfig // pass the preloaded config
					)
						.then((result) => {
							if (result.repCount > maxRepsEverSeen) {
								// Add new reps to pending feedback
								for (let i = maxRepsEverSeen + 1; i <= result.repCount; i++) {
									pendingFeedback.add(i);
									
									// Set a timeout to remove from pending if no feedback comes within 30 seconds
									setTimeout(() => {
										if (pendingFeedback.has(i)) {
											pendingFeedback.delete(i);
											pendingFeedback = new Set(pendingFeedback);
										}
									}, 30000);
								}
								pendingFeedback = new Set(pendingFeedback); // Trigger reactivity
								
								maxRepsEverSeen = result.repCount;
								currentReps = result.repCount;
								lastProcessedRepCount = result.repCount;
							}
						})
						.catch(console.error);
				}

				// Draw landmarks and connections
				drawPoseLandmarks(landmarks);
			}

			canvasCtx.restore();
			
			// Continue the detection loop if we're still detecting
			if (isDetecting) {
				requestAnimationFrame(processVideoFrame);
			}
		} catch (error) {
			console.error('Error processing video frame:', error);
		}
	}
	
	function drawPoseLandmarks(landmarks: { x: number; y: number; z?: number; visibility?: number }[]) {
		// Draw connections between landmarks
		const connections = [
			// Face
			[0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
			// Torso
			[9, 10], [11, 12], [11, 13], [12, 14], [13, 15], [14, 16], [15, 17], [16, 18],
			[15, 19], [16, 20], [17, 19], [18, 20], [11, 23], [12, 24], [23, 24],
			// Arms
			[11, 13], [12, 14], [13, 15], [14, 16], [15, 17], [16, 18], [15, 19], [16, 20],
			[15, 21], [16, 22], [17, 19], [18, 20], [19, 21], [20, 22],
			// Legs
			[23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32]
		];
		
		// Draw connections
		canvasCtx.strokeStyle = '#00FF00';
		canvasCtx.lineWidth = 2;
		canvasCtx.beginPath();
		
		for (const [start, end] of connections) {
			if (landmarks[start] && landmarks[end]) {
				const startPoint = landmarks[start];
				const endPoint = landmarks[end];
				canvasCtx.moveTo(startPoint.x * canvasElement.width, startPoint.y * canvasElement.height);
				canvasCtx.lineTo(endPoint.x * canvasElement.width, endPoint.y * canvasElement.height);
			}
		}
		canvasCtx.stroke();
		
		// Draw landmarks
		canvasCtx.fillStyle = '#FF0000';
		for (const landmark of landmarks) {
			canvasCtx.beginPath();
			canvasCtx.arc(
				landmark.x * canvasElement.width,
				landmark.y * canvasElement.height,
				3,
				0,
				2 * Math.PI
			);
			canvasCtx.fill();
		}
	}

	async function startCamera() {
		if (!selectedCameraId) {
			alert('Please select a camera first');
			return;
		}

		isLoading = true;
		try {
			// Stop any existing stream
			stopDetection();

			// Get user media
			currentStream = await navigator.mediaDevices.getUserMedia({
				video: {
					deviceId: selectedCameraId,
					width: { ideal: 640 },
					height: { ideal: 480 }
				}
			});

			videoElement.srcObject = currentStream;
			await videoElement.play();

			// Set canvas dimensions to match video
			canvasElement.width = videoElement.videoWidth || 640;
			canvasElement.height = videoElement.videoHeight || 480;

			// Start pose detection with new MediaPipe Tasks
			if (poseLandmarker) {
				isDetecting = true;
				processVideoFrame();
			} else {
				statusMessage = 'MediaPipe not initialized. Please refresh the page.';
			}
		} catch (error) {
			console.error('Error starting camera:', error);
			alert('Failed to access camera. Please check permissions.');
		} finally {
			isLoading = false;
		}
	}

	function handleVideoUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;

		// Stop any existing stream
		stopDetection();

		const url = URL.createObjectURL(file);
		videoElement.src = url;
		videoElement.load();

		videoElement.onloadedmetadata = () => {
			// Set canvas dimensions to match video
			canvasElement.width = videoElement.videoWidth;
			canvasElement.height = videoElement.videoHeight;
		};

		videoElement.onplay = () => {
			if (poseLandmarker) {
				isDetecting = true;
				processVideoFrame();
			}
		};
	}

	function playVideo() {
		if (videoElement.src && !currentStream) {
			videoElement.play();
		}
	}

	function pauseVideo() {
		if (!currentStream) {
			videoElement.pause();
		}
	}

	function stopDetection() {
		isDetecting = false;

		// Stop camera stream
		if (currentStream) {
			currentStream.getTracks().forEach((track) => track.stop());
			currentStream = null;
		}

		// Clear video source
		if (videoElement.srcObject) {
			videoElement.srcObject = null;
		}
		if (videoElement.src && !videoElement.src.startsWith('blob:')) {
			URL.revokeObjectURL(videoElement.src);
		}
		videoElement.src = '';

		// Clear canvas
		if (canvasCtx) {
			canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
		}
	}

	function resetRepCount() {
		poseHistory = [];
		currentReps = 0;
		maxRepsEverSeen = 0;
		lastProcessedRepCount = 0;
		feedbackList = [];
		pendingFeedback = new Set();
		animatedReps.set(0, { duration: 200 });
	}

	// Workout management
	interface WorkoutExercise {
		id: string;
		name: string;
		sets: number;
		reps: string;
		rest: string;
		exerciseConfig?: { config: ExerciseConfig };
	}

	interface Workout {
		id: string;
		name: string;
		exercises: WorkoutExercise[];
	}

	let savedWorkouts: Workout[] = [];
	let selectedWorkout: Workout | null = null;
	let currentExercise: WorkoutExercise | null = null;

	// Exercise configs
	interface ExerciseConfigItem {
		id: string;
		displayName: string;
		name: string;
		config: ExerciseConfig;
	}
	let savedExerciseConfigs: ExerciseConfigItem[] = [];
	let selectedExerciseConfigId = '';
	let selectedExerciseConfig: ExerciseConfigItem | null = null;

	// Load saved workouts
	async function loadSavedWorkouts() {
		try {
			const response = await fetch('/api/workouts');
			if (response.ok) {
				const data = await response.json();
				savedWorkouts = data.workouts || [];
			}
		} catch (error) {
			console.error('Error loading workouts:', error);
		}
	}

	// Load saved exercise configs
	async function loadSavedExerciseConfigs() {
		try {
			const response = await fetch('/api/exercise-configs');
			if (response.ok) {
				const data = await response.json();
				savedExerciseConfigs = (data.configs || []).map((c: any) => ({
					id: c.id,
					displayName: c.displayName || c.name,
					name: c.name,
					config: c.config
				}));
			}
		} catch (error) {
			console.error('Error loading exercise configs:', error);
		}
	}

	function selectWorkout(workout: Workout) {
		selectedWorkout = workout;
		selectedExerciseConfigId = ''; // Clear exercise selection
		selectedExerciseConfig = null;
		currentExercise = workout.exercises[0] || null;
		resetRepCount();
		toast.success(`Selected: ${workout.name}`);
	}

	function selectExerciseConfig(config: ExerciseConfigItem) {
		selectedExerciseConfig = config;
		selectedWorkoutId = ''; // Clear workout selection
		selectedWorkout = null;
		// Create a temporary exercise for tracking
		currentExercise = {
			id: config.id,
			name: config.name,
			sets: 3,
			reps: '8-12',
			rest: '60s',
			exerciseConfig: { config: config.config }
		};
		resetRepCount();
		toast.success(`Selected: ${config.displayName}`);
	}

	// Handle workout selection changes
	$: if (selectedWorkoutId) {
		const workout = savedWorkouts.find((w) => w.id === selectedWorkoutId);
		if (workout) selectWorkout(workout);
	}

	// Handle exercise config selection changes
	$: if (selectedExerciseConfigId && !selectedWorkoutId) {
		const config = savedExerciseConfigs.find((c) => c.id === selectedExerciseConfigId);
		if (config) selectExerciseConfig(config);
	}
</script>

<style>
	@keyframes slideInFromLeft {
		0% {
			transform: translateX(-20px);
			opacity: 0;
		}
		100% {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes pulseIn {
		0% {
			transform: scale(0.98);
			opacity: 0;
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	@keyframes repBounce {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
		}
	}

	.feedback-item {
		transition: all 0.3s ease-out;
	}
</style>

<div class="container mx-auto space-y-6 p-6">
	<div class="text-center">
		<h1 class="mb-2 text-3xl font-bold">Live Form Analysis</h1>
		<p class="text-muted-foreground">
			Real-time AI-powered pose detection and exercise form analysis with personalized feedback
		</p>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Controls Panel -->
		<Card class="lg:col-span-1">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<CameraIcon class="h-5 w-5" />
					Source Selection
				</CardTitle>
			</CardHeader>
			<CardContent class="space-y-4">
				<!-- Workout Selection -->
				<!-- <div class="space-y-2">
					<Label for="workout-select">Select a workout</Label>
					{#if savedWorkouts.length > 0}
						<Select.Root type="single" bind:value={selectedWorkoutId}>
							<Select.Trigger class="w-full">
								{selectedWorkout ? `🏋️ ${selectedWorkout.name}` : 'Choose a workout...'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">Choose a workout...</Select.Item>
								{#each savedWorkouts as workout (workout.id)}
									<Select.Item value={workout.id}>🏋️ {workout.name}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{:else}
						<div class="text-muted-foreground py-4 text-center">
							<Dumbbell class="mx-auto mb-2 h-8 w-8 opacity-50" />
							<p class="text-sm">No saved workouts</p>
						</div>
					{/if}
				</div> -->

				<!-- Divider -->
				<!-- <div class="flex items-center gap-2 py-2">
					<div class="flex-1 border-t"></div>
					<span class="text-muted-foreground text-xs">or</span>
					<div class="flex-1 border-t"></div>
				</div> -->

				<!-- Exercise Selection -->
				<div class="space-y-2">
					<Label for="exercise-select">Select a workout</Label>
					{#if savedExerciseConfigs.length > 0}
						<Select.Root type="single" bind:value={selectedExerciseConfigId}>
							<Select.Trigger class="w-full">
								{selectedExerciseConfig ? `💪 ${selectedExerciseConfig.displayName}` : 'Choose an exercise...'}
							</Select.Trigger>
							<Select.Content>
								<Select.Item value="">Choose a workout...</Select.Item>
								{#each savedExerciseConfigs as config (config.id)}
									<Select.Item value={config.id}>💪 {config.displayName}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
					{:else}
						<div class="text-muted-foreground py-4 text-center">
							<Dumbbell class="mx-auto mb-2 h-8 w-8 opacity-50" />
							<p class="text-sm">No saved workouts</p>
							<p class="text-xs mt-1">Go to My Workouts to add some</p>
						</div>
					{/if}
				</div>

				{#if selectedWorkout && currentExercise}
					<div class="bg-muted rounded-lg p-3">
						<p class="text-sm font-medium">{currentExercise.name}</p>
						<p class="text-muted-foreground text-xs">
							{currentExercise.sets} sets × {currentExercise.reps} reps
						</p>
					</div>
				{/if}

				{#if selectedExerciseConfig && currentExercise}
					<div class="bg-muted rounded-lg p-3">
						<p class="text-sm font-medium">{selectedExerciseConfig.displayName}</p>
						<p class="text-muted-foreground text-xs">
							Practice this exercise
						</p>
					</div>
				{/if}

				<!-- Source Type Selection -->
				<div class="space-y-2">
					<Label for="source-select">Input Source</Label>
					<Select.Root type="single" bind:value={selectedSource} onValueChange={() => stopDetection()}>
						<Select.Trigger class="w-full">
							{selectedSource === 'camera' ? '📹 Camera' : '🎥 Video File'}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="camera">📹 Camera</Select.Item>
							<Select.Item value="video">🎥 Video File</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>

				{#if selectedSource === 'camera'}
					<!-- Camera Selection -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<Label for="camera-select">Camera</Label>
							<Button onclick={getAvailableCameras} size="sm" variant="outline" class="h-8 px-2">
								🔄 Refresh
							</Button>
						</div>
						<Select.Root type="single" bind:value={selectedCameraId}>
							<Select.Trigger class="w-full">
								{#if availableCameras.length === 0}
									No cameras found - click Refresh
								{:else}
									{(() => {
										const camera = availableCameras.find(c => c.deviceId === selectedCameraId);
										return camera ? (camera.label || `Camera ${camera.deviceId.slice(0, 8)}...`) : 'Select a camera...';
									})()}
								{/if}
							</Select.Trigger>
							<Select.Content>
								{#if availableCameras.length === 0}
									<Select.Item value="">No cameras found - click Refresh</Select.Item>
								{:else}
									{#each availableCameras as camera (camera.deviceId)}
										<Select.Item value={camera.deviceId}>
											{camera.label || `Camera ${camera.deviceId.slice(0, 8)}...`}
										</Select.Item>
									{/each}
								{/if}
							</Select.Content>
						</Select.Root>

						{#if statusMessage}
							<p class="text-muted-foreground text-xs">{statusMessage}</p>
						{/if}
					</div>

					<!-- Camera Controls -->
					<div class="space-y-2">
						<Button onclick={startCamera} disabled={isLoading || !selectedCameraId} class="w-full">
							{#if isLoading}
								Loading...
							{:else if isDetecting}
								<Square class="mr-2 h-4 w-4" />
								Stop Camera
							{:else}
								<PlayIcon class="mr-2 h-4 w-4" />
								Start Camera
							{/if}
						</Button>
					</div>
				{:else}
					<!-- Video File Upload -->
					<div class="space-y-2">
						<Label for="video-upload">Upload Video</Label>
						<div class="flex flex-col gap-2">
							<input
								bind:this={fileInput}
								type="file"
								accept="video/*"
								onchange={handleVideoUpload}
								class="file:bg-primary file:text-primary-foreground hover:file:bg-primary/80 border-input bg-background w-full rounded-md border px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
							/>
						</div>
					</div>

					<!-- Video Controls -->
					{#if videoElement?.src && !currentStream}
						<div class="flex gap-2">
							<Button onclick={playVideo} size="sm" variant="outline">
								<PlayIcon class="h-4 w-4" />
							</Button>
							<Button onclick={pauseVideo} size="sm" variant="outline">
								<Square class="h-4 w-4" />
							</Button>
						</div>
					{/if}
				{/if}

				{#if isDetecting || currentStream || videoElement?.src}
					<Button onclick={stopDetection} variant="destructive" class="w-full">
						<Square class="mr-2 h-4 w-4" />
						Stop Detection
					</Button>
				{/if}

				<!-- AI Features -->
				<div class="bg-muted space-y-3 rounded-lg p-4">
					<h3 class="text-sm font-semibold">AI Features</h3>

					<div class="space-y-3">
						<!-- RAG Toggle -->
						<div class="flex items-center justify-between">
							<div class="space-y-1">
								<Label for="rag-toggle" class="text-sm font-medium">Enhanced Reference</Label>
								<p class="text-muted-foreground text-xs">
									Uses exercise database for better feedback
								</p>
							</div>
							<Switch id="rag-toggle" bind:checked={enableRAG} />
						</div>

						<!-- Voice Toggle -->
						<div class="flex items-center justify-between">
							<div class="space-y-1">
								<Label for="voice-toggle" class="text-sm font-medium">Voice Feedback</Label>
								<p class="text-muted-foreground text-xs">Spoken feedback in English</p>
							</div>
							<Switch id="voice-toggle" bind:checked={enableVoice} />
						</div>

						{#if enableRAG || enableVoice}
							<div
								class="rounded border border-orange-200 bg-orange-50 p-2 text-xs text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300"
							>
								⚠️ Enhanced features enabled - responses may be slower
								{#if enableRAG && enableVoice}
									<br />📚 Reference lookup + 🔊 Voice generation
								{:else if enableRAG}
									<br />📚 Reference lookup enabled
								{:else if enableVoice}
									<br />🔊 Voice generation enabled
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</CardContent>
		</Card>

		<!-- Video Display -->
		<Card class="lg:col-span-2">
			<CardHeader>
				<CardTitle class="flex items-center gap-2">
					<VideoIcon class="h-5 w-5" />
					Live Feed & Pose Analysis
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div class="relative aspect-video overflow-hidden rounded-lg bg-black">
					<!-- Hidden video element -->
					<video
						bind:this={videoElement}
						class="absolute inset-0 h-full w-full object-contain"
						style="display: none;"
						playsinline
						muted
					></video>

					<!-- Canvas for pose visualization -->
					<canvas
						bind:this={canvasElement}
						class="absolute inset-0 h-full w-full object-contain"
						width="640"
						height="480"
					></canvas>

					<!-- Overlay for no input state -->
					{#if !isDetecting && !videoElement?.src}
						<div
							class="text-muted-foreground absolute inset-0 flex flex-col items-center justify-center"
						>
							<div class="space-y-2 text-center">
								{#if selectedSource === 'camera'}
									<CameraIcon class="mx-auto h-12 w-12 opacity-50" />
									<p>Select a camera and click "Start Camera" to begin</p>
								{:else}
									<UploadIcon class="mx-auto h-12 w-12 opacity-50" />
									<p>Upload a video file to analyze your workout</p>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Status indicator -->
				{#if isDetecting}
					<div class="mt-4 space-y-4">
						<!-- Rep Counter and Mode Info -->
						<div class="flex items-center justify-between">						<div class="flex items-center gap-4">
							<div class="text-center">
								<div class="text-primary text-3xl font-bold transition-all duration-300 hover:scale-110">{Math.round($animatedReps)}</div>
								<div class="text-muted-foreground text-sm">Repetitions</div>
							</div>
							<Button onclick={resetRepCount} size="sm" variant="outline">Reset</Button>
						</div>
							
							<!-- Status and Mode Info -->
							<div class="flex flex-col items-end gap-1">
								<div class="flex items-center gap-2 text-sm text-green-600">
									<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
									AI pose detection active - {currentExercise?.name || 'No exercise selected'}
								</div>
								{#if enableRAG || enableVoice}
									<div class="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
										<div class="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
										Enhanced feedback:
										{#if enableRAG}📚 Reference{/if}
										{#if enableRAG && enableVoice}
											+
										{/if}
										{#if enableVoice}🔊 Voice{/if}
									</div>
								{:else}
									<div class="flex items-center gap-2 text-xs text-gray-500">
										<div class="h-1.5 w-1.5 rounded-full bg-gray-400"></div>
										Fast mode: Text feedback only
									</div>
								{/if}
							</div>
						</div>

						<!-- Feedback List -->
						{#if feedbackList.length > 0 || pendingFeedback.size > 0}
							<div class="space-y-2">
								<h3 class="text-sm font-semibold">Recent Feedback</h3>
								<div class="max-h-48 space-y-2 overflow-y-auto">
									<!-- Show last 5 reps in reverse order (newest first) -->
									{#each Array.from({ length: Math.max(currentReps, 5) }, (_, i) => currentReps - i).filter(repNum => repNum > 0).slice(0, 5) as repNumber (repNumber)}
										{@const feedback = feedbackList.find(f => f.repNumber === repNumber)}
										{@const isPending = pendingFeedback.has(repNumber)}
										
										{#if feedback}
											<!-- Completed feedback with slide-in animation -->
											<div 
												class="feedback-item border-l-4 rounded bg-gray-50 p-3 dark:bg-gray-800 {
													feedback.classification === 'good' ? 'border-green-500' :
													feedback.classification === 'poor' ? 'border-red-500' :
													'border-yellow-500'
												}"
												style="animation: slideInFromLeft 0.5s ease-out"
											>
												<div class="flex items-start justify-between">
													<div class="flex-1">
														<div class="text-xs text-gray-500 mb-1">
															Rep #{feedback.repNumber} • Score: {feedback.score}/10
														</div>
														<p class="text-sm">{feedback.feedback}</p>
													</div>
													<div class="ml-2 text-xs text-gray-400">
														{feedback.timestamp.toLocaleTimeString()}
													</div>
												</div>
											</div>
										{:else if isPending}
											<!-- Loading state with pulse animation -->
											<div 
												class="feedback-item border-l-4 border-blue-500 rounded bg-blue-50 p-3 dark:bg-blue-950/20"
												style="animation: pulseIn 0.3s ease-out"
											>
												<div class="flex items-center justify-between">
													<div class="flex items-center gap-2">
														<div class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
														<div class="text-xs text-blue-600 dark:text-blue-400">
															Rep #{repNumber} • Analyzing...
														</div>
													</div>
													<div class="text-xs text-gray-400">
														{new Date().toLocaleTimeString()}
													</div>
												</div>
												<p class="text-sm text-blue-600 dark:text-blue-300 mt-1">
													AI is analyzing your form and generating feedback...
												</p>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{:else}
							<div class="text-center text-gray-500 py-4">
								<p class="text-sm">Perform repetitions to see AI feedback here</p>
							</div>
						{/if}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>

	<!-- Instructions -->
	<Card>
		<CardHeader>
			<CardTitle>How to Use</CardTitle>
		</CardHeader>
		<CardContent>
			<div class="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
				<div>
					<h4 class="mb-2 font-medium">Camera Mode:</h4>
					<ul class="text-muted-foreground space-y-1">
						<li>• Select your preferred camera from the dropdown</li>
						<li>• Click "Start Camera" to begin live pose detection</li>
						<li>• Position yourself in front of the camera</li>
						<li>• Green lines show detected pose connections</li>
						<li>• Red dots mark key body landmarks</li>
					</ul>
				</div>
				<div>
					<h4 class="mb-2 font-medium">Video Mode:</h4>
					<ul class="text-muted-foreground space-y-1">
						<li>• Upload a video file of your workout</li>
						<li>• Use the play/pause controls to navigate</li>
						<li>• AI will analyze poses frame by frame</li>
						<li>• Supports common video formats (MP4, MOV, AVI)</li>
						<li>• Best results with clear, front-facing videos</li>
					</ul>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
