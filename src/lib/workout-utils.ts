export type Landmark = {
	x: number;
	y: number;
	z: number;
	visibility?: number;
};

export type Pose = Landmark[];

export type ExerciseName = string; // Now supports any exercise name

type AngleConfig = {
	name: string; // e.g., "left_elbow", "right_elbow"
	points: [number, number, number]; // Three joint indices for angle calculation [point1, vertex, point3]
	weight?: number; // Weight for this angle in the composite signal (default 1.0)
	targetLowAngle?: number; // Target minimum angle in degrees for optimal range of motion
	targetHighAngle?: number; // Target maximum angle in degrees for optimal range of motion
};

export type ExerciseConfig = {
	name: ExerciseName;
	anglePoints: AngleConfig[]; // Multiple angle configurations (left/right when possible)
	minPeakDistance: number; // Minimum distance between peaks to count as a rep
	initialDirection: 'up' | 'down';
	inverted?: boolean; // Invert the composite signal if needed
};

export type RepetitionState = {
	reps: number;
	stage: 'down' | 'up';
	feedback: string | null;
};

export type AngleData = {
	timestamp: number;
	angle: number;
	jointPositions: {
		point1: Landmark;
		point2: Landmark;
		point3: Landmark;
	};
};

export type RepSegment = {
	repNumber: number;
	exerciseType: ExerciseName;
	startIndex: number;
	endIndex: number;
	angles: AngleData[];
	duration: number;
};

export type FeedbackOptions = {
	enableRAG?: boolean;
	enableVoice?: boolean;
};

/**
 * Simple moving average smoothing
 */
function smoothData(values: number[], windowSize: number = 3): number[] {
	if (values.length < windowSize) return values;
	
	const smoothed: number[] = [];
	
	for (let i = 0; i < values.length; i++) {
		const start = Math.max(0, i - Math.floor(windowSize / 2));
		const end = Math.min(values.length, i + Math.floor(windowSize / 2) + 1);
		const window = values.slice(start, end);
		const average = window.reduce((sum, val) => sum + val, 0) / window.length;
		smoothed.push(average);
	}
	
	return smoothed;
}

/**
 * Create a composite movement signal from multiple angles
 */
function createCompositeAngleSignal(pose: Pose, angleConfigs: AngleConfig[]): number {
	let compositeValue = 0;
	let totalWeight = 0;
	
	for (const angleConfig of angleConfigs) {
		const [p1, p2, p3] = angleConfig.points;
		if (!pose[p1] || !pose[p2] || !pose[p3]) continue;
		
		const weight = angleConfig.weight || 1.0;
		const angle = calculateAngle(pose[p1], pose[p2], pose[p3]);
		
		compositeValue += angle * weight;
		totalWeight += weight;
	}
	
	return totalWeight > 0 ? compositeValue / totalWeight : 0;
}

/**
 * Advanced peak/valley detection with adaptive thresholds and trend analysis
 */
function detectPeaksAndValleysAdvanced(
	values: number[], 
	minDistance: number = 5, 
	prominenceThreshold: number = 0.15
): { peaks: number[], valleys: number[] } {
	const peaks: number[] = [];
	const valleys: number[] = [];
	
	if (values.length < 5) return { peaks, valleys };
	
	// Apply stronger smoothing for noise reduction
	const smoothed = smoothData(values, 7);
	
	// Calculate adaptive thresholds
	const min = Math.min(...smoothed);
	const max = Math.max(...smoothed);
	const range = max - min;
	const dynamicProminence = range * prominenceThreshold;
	
	// Use a larger window for trend analysis
	const trendWindow = Math.max(3, Math.floor(minDistance / 2));
	
	for (let i = trendWindow; i < smoothed.length - trendWindow; i++) {
		const current = smoothed[i];
		
		// Check if current point is a local maximum
		let isPeak = true;
		let isValley = true;
		
		// Compare with points in the trend window
		for (let j = -trendWindow; j <= trendWindow; j++) {
			if (j === 0) continue;
			const compareValue = smoothed[i + j];
			
			if (current <= compareValue) isPeak = false;
			if (current >= compareValue) isValley = false;
		}
		
		// Peak detection with prominence check
		if (isPeak && current - min > dynamicProminence) {
			if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
				peaks.push(i);
			}
		}
		
		// Valley detection with prominence check
		if (isValley && max - current > dynamicProminence) {
			if (valleys.length === 0 || i - valleys[valleys.length - 1] >= minDistance) {
				valleys.push(i);
			}
		}
	}
	
	return { peaks, valleys };
}

/**
 * Processes a history of poses to count repetitions using comprehensive multi-joint tracking.
 * @param poseHistory An array of poses from MediaPipe.
 * @param exerciseConfig The configuration for the exercise.
 * @param lastProcessedRepCount The number of reps that were already processed (to avoid duplicate logging).
 * @param feedbackOptions Options for enabling RAG and voice features.
 * @returns An object containing the total number of repetitions detected and any new rep segments.
 */
export function segmentReps(
	poseHistory: Pose[], 
	exerciseConfig: ExerciseConfig, 
	lastProcessedRepCount: number = 0,
	feedbackOptions: FeedbackOptions = {}
): { 
	repCount: number; 
	newRepSegments: RepSegment[];
} {
	if (!poseHistory || poseHistory.length < 20) { // Increased minimum for better reliability
		return { repCount: 0, newRepSegments: [] };
	}

	// Create composite angle signal from all specified angle configurations
	const values: number[] = [];
	const angleDataHistory: AngleData[] = [];
	
	for (let i = 0; i < poseHistory.length; i++) {
		const pose = poseHistory[i];
		if (!pose || pose.length === 0) continue;
		
		// Create composite signal from all angle configurations
		const compositeValue = createCompositeAngleSignal(pose, exerciseConfig.anglePoints);
		
		// Apply inversion if specified
		const finalValue = exerciseConfig.inverted ? -compositeValue : compositeValue;
		values.push(finalValue);
		
		// Store detailed angle data for each configuration
		for (const angleConfig of exerciseConfig.anglePoints) {
			const [p1, p2, p3] = angleConfig.points;
			if (pose[p1] && pose[p2] && pose[p3]) {
				const angle = calculateAngle(pose[p1], pose[p2], pose[p3]);
				
				angleDataHistory.push({
					timestamp: i,
					angle: angle,
					jointPositions: {
						point1: pose[p1],
						point2: pose[p2],
						point3: pose[p3]
					}
				});
			}
		}
	}
	
	if (values.length < 20) return { repCount: 0, newRepSegments: [] };
	
	// Detect peaks and valleys with advanced algorithm
	const { peaks, valleys } = detectPeaksAndValleysAdvanced(values, exerciseConfig.minPeakDistance);
	
	// Only count reps if we have a minimum number of alternating events
	const allEvents = [...peaks.map(i => ({ index: i, type: 'peak' })), ...valleys.map(i => ({ index: i, type: 'valley' }))];
	allEvents.sort((a, b) => a.index - b.index);
	
	// More conservative rep counting - need proper alternating pattern
	let repCount = 0;
	const validSequence: Array<{ type: string; index: number }> = [];
	const newRepSegments: RepSegment[] = [];
	
	for (const event of allEvents) {
		const lastEvent = validSequence[validSequence.length - 1];
		
		// Only add to sequence if it's different from the last event
		if (!lastEvent || lastEvent.type !== event.type) {
			validSequence.push(event);
		}
	}
	
	// Count complete cycles and create rep segments
	for (let i = 1; i < validSequence.length; i++) {
		const prevEvent = validSequence[i - 1];
		const currEvent = validSequence[i];
		let repCompleted = false;
		
		if (exerciseConfig.initialDirection === 'down') {
			// For exercises starting down: valley -> peak = 1 rep
			if (prevEvent.type === 'valley' && currEvent.type === 'peak') {
				repCompleted = true;
			}
		} else {
			// For exercises starting up: peak -> valley = 1 rep  
			if (prevEvent.type === 'peak' && currEvent.type === 'valley') {
				repCompleted = true;
			}
		}
		
		if (repCompleted) {
			repCount++;
			
			// Only process and log if this is a new rep (beyond what was already processed)
			if (repCount > lastProcessedRepCount) {
				// Create rep segment if we have angle data
				if (angleDataHistory.length > 0) {
					const startIndex = prevEvent.index;
					const endIndex = currEvent.index;
					
					// Filter angle data for this rep
					const repAngles = angleDataHistory.filter(
						angleData => angleData.timestamp >= startIndex && angleData.timestamp <= endIndex
					);
					
					if (repAngles.length > 0) {
						const repSegment: RepSegment = {
							repNumber: repCount,
							exerciseType: exerciseConfig.name,
							startIndex: startIndex,
							endIndex: endIndex,
							angles: repAngles,
							duration: (endIndex - startIndex) * 33.33 // Approximate 30fps
						};
						
						newRepSegments.push(repSegment);
						
						// Process the rep segment (console log and AI feedback)
						processRepSegment(repSegment, exerciseConfig, feedbackOptions).catch(error => {
							console.error('Error processing rep segment:', error);
						});
					}
				}
			}
		}
	}
	
	return { repCount, newRepSegments };
}

/**
 * Calculate the angle between three points
 */
function calculateAngle(point1: Landmark, vertex: Landmark, point3: Landmark): number {
	// Calculate vectors from vertex to the other two points
	const vector1 = {
		x: point1.x - vertex.x,
		y: point1.y - vertex.y
	};
	
	const vector2 = {
		x: point3.x - vertex.x,
		y: point3.y - vertex.y
	};
	
	// Calculate dot product and magnitudes
	const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
	const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
	const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);
	
	// Calculate angle in radians, then convert to degrees
	const cosAngle = dotProduct / (magnitude1 * magnitude2);
	const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp to prevent NaN
	const angleDeg = (angleRad * 180) / Math.PI;
	
	return angleDeg;
}

export type RepAnalysis = {
	exerciseName: string;
	repNumber: number;
	duration: number;
	angleRange: {
		min: number;
		max: number;
	};
	averageAngle: number;
	rangeOfMotion: number;
};

/**
 * Process a completed rep segment and send angle data to analysis
 */
async function processRepSegment(repSegment: RepSegment, exerciseConfig: ExerciseConfig, feedbackOptions: FeedbackOptions = {}): Promise<void> {
	if (repSegment.angles.length === 0) {
		console.log(`Rep #${repSegment.repNumber} - No angle data available`);
		return;
	}

	const angles = repSegment.angles.map(a => a.angle);
	const minAngle = Math.min(...angles);
	const maxAngle = Math.max(...angles);
	const avgAngle = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
	const rangeOfMotion = maxAngle - minAngle;

	// Calculate target angles from exercise config if available
	let targetAngles: { min: number; max: number } | undefined;
	if (exerciseConfig.anglePoints && exerciseConfig.anglePoints.length > 0) {
		const angleConfigs = exerciseConfig.anglePoints.filter(config => 
			config.targetLowAngle !== undefined && config.targetHighAngle !== undefined
		);
		
		if (angleConfigs.length > 0) {
			// Use average of all configured target ranges
			const avgTargetLow = angleConfigs.reduce((sum, config) => sum + (config.targetLowAngle || 0), 0) / angleConfigs.length;
			const avgTargetHigh = angleConfigs.reduce((sum, config) => sum + (config.targetHighAngle || 0), 0) / angleConfigs.length;
			targetAngles = {
				min: Math.round(avgTargetLow * 10) / 10,
				max: Math.round(avgTargetHigh * 10) / 10
			};
		}
	}

	const repAnalysis: RepAnalysis = {
		exerciseName: repSegment.exerciseType.replace('_', ' '),
		repNumber: repSegment.repNumber,
		duration: Math.round(repSegment.duration),
		angleRange: {
			min: Math.round(minAngle * 10) / 10,
			max: Math.round(maxAngle * 10) / 10
		},
		averageAngle: Math.round(avgAngle * 10) / 10,
		rangeOfMotion: Math.round(rangeOfMotion * 10) / 10
	};

	console.log('Rep Analysis:', repAnalysis);
	if (targetAngles) {
		console.log('Target Angles:', targetAngles);
	}

	// Send to AI feedback API with streaming response
	try {
		const response = await fetch('/api/feedback', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				...repAnalysis,
				...(targetAngles && { targetAngles }),
				enableRAG: feedbackOptions.enableRAG || false,
				enableVoice: feedbackOptions.enableVoice || false
			})
		});

		if (response.ok) {
			// Handle streaming response
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			let feedback: { feedback: string; score: number; classification: string } | null = null;
			let partialFeedback = '';

			if (reader) {
				let buffer = '';
				
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || ''; // Keep incomplete line in buffer

					for (const line of lines) {
						if (line.trim()) {
							try {
								const data = JSON.parse(line);
								
								if (data.type === 'feedback') {
									feedback = data.data;
									console.log('AI Feedback:', feedback);
									
									// Dispatch custom event for feedback capture
									if (typeof window !== 'undefined' && feedback) {
										const feedbackEvent = new CustomEvent('ai-feedback', {
											detail: {
												repNumber: repAnalysis.repNumber,
												feedback: feedback.feedback,
												score: feedback.score,
												classification: feedback.classification,
												timestamp: new Date()
											}
										});
										window.dispatchEvent(feedbackEvent);
									}
									
									// Show toast with feedback
									if (typeof window !== 'undefined' && feedback) {
										const { toast } = await import('svelte-sonner');
										
										toast.success(`Rep ${repAnalysis.repNumber} Analysis`, {
											description: `${feedback.feedback} (Score: ${feedback.score}/100)`,
											duration: 5000
										});
									}
								} else if (data.type === 'partial_feedback') {
									// Show partial feedback immediately for better responsiveness
									partialFeedback = data.data;
									
									if (typeof window !== 'undefined') {
										const { toast } = await import('svelte-sonner');
										
										toast.loading(`Rep ${repAnalysis.repNumber} - ${partialFeedback}`, {
											id: `rep-${repAnalysis.repNumber}`,
											duration: 2000
										});
									}
								} else if (data.type === 'voice' && feedbackOptions.enableVoice) {
									// Use browser's built-in SpeechSynthesis API (free, no API key required)
									if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
										const utterance = new SpeechSynthesisUtterance(data.text);
										utterance.lang = 'en-US';
										utterance.rate = 1.0;
										utterance.pitch = 1.0;
										utterance.volume = 1.0;
										
										// Use a natural-sounding voice if available
										const voices = speechSynthesis.getVoices();
										const preferredVoice = voices.find(voice => 
											voice.lang.startsWith('en') && voice.name.includes('Female')
										) || voices.find(voice => voice.lang.startsWith('en'));
										
										if (preferredVoice) {
											utterance.voice = preferredVoice;
										}
										
										speechSynthesis.speak(utterance);
									}
								} else if (data.type === 'audio' && feedbackOptions.enableVoice) {
									// Fallback: Play audio blob if server sends audio data
									if (typeof window !== 'undefined') {
										const audioBase64 = data.data;
										const audioBlob = new Blob([Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
										const audioUrl = URL.createObjectURL(audioBlob);
										const audio = new Audio(audioUrl);
										
										audio.play().catch(console.error);
										
										// Clean up URL after playing
										audio.addEventListener('ended', () => {
											URL.revokeObjectURL(audioUrl);
										});
									}
								}
							} catch (parseError) {
								console.error('Error parsing streaming data:', parseError);
							}
						}
					}
				}
			}
		} else {
			console.error('Failed to get AI feedback:', response.statusText);
		}
	} catch (error) {
		console.error('Error calling feedback API:', error);
	}
}

// --- Dynamic Exercise Configuration System ---

// Cache for generated exercise configurations
const exerciseConfigCache = new Map<string, ExerciseConfig>();

/**
 * Generate exercise configuration using LLM
 */
async function generateExerciseConfig(exerciseName: string, exerciseDescription?: string): Promise<ExerciseConfig | null> {
	try {
		const response = await fetch('/api/exercise-config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				exerciseName,
				exerciseDescription
			})
		});

		if (!response.ok) {
			console.error('Failed to generate exercise config:', response.statusText);
			return null;
		}

		const result = await response.json();
		if (result.success && result.config) {
			console.log(`Generated config for ${exerciseName}:`, result.analysis);
			return result.config as ExerciseConfig;
		}

		return null;
	} catch (error) {
		console.error('Error generating exercise config:', error);
		return null;
	}
}

/**
 * Get exercise configuration - checks cache first, then predefined configs, then generates
 */
export async function getExerciseConfig(exerciseName: string, exerciseDescription?: string): Promise<ExerciseConfig | null> {
	// Normalize exercise name
	const normalizedName = exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '_');
	
	// Check cache first
	if (exerciseConfigCache.has(normalizedName)) {
		return exerciseConfigCache.get(normalizedName)!;
	}
	
	// Check predefined configs
	if (PREDEFINED_EXERCISE_CONFIGS[normalizedName]) {
		const config = PREDEFINED_EXERCISE_CONFIGS[normalizedName];
		exerciseConfigCache.set(normalizedName, config);
		return config;
	}
	
	// Generate new config using LLM
	console.log(`Generating new exercise config for: ${exerciseName}`);
	const generatedConfig = await generateExerciseConfig(exerciseName, exerciseDescription);
	
	if (generatedConfig) {
		// Ensure the config has the normalized name
		generatedConfig.name = normalizedName;
		exerciseConfigCache.set(normalizedName, generatedConfig);
		return generatedConfig;
	}
	
	console.warn(`Could not generate config for exercise: ${exerciseName}`);
	return null;
}

/**
 * Clear the exercise config cache (useful for testing or resetting)
 */
export function clearExerciseConfigCache(): void {
	exerciseConfigCache.clear();
}

/**
 * Get all cached exercise configs
 */
export function getCachedExerciseConfigs(): Record<string, ExerciseConfig> {
	return Object.fromEntries(exerciseConfigCache.entries());
}

// --- Pre-defined Exercise Configurations (Fallback) ---

const LANDMARK_INDICES = {
	NOSE: 0,
	LEFT_EYE_INNER: 1,
	LEFT_EYE: 2,
	LEFT_EYE_OUTER: 3,
	RIGHT_EYE_INNER: 4,
	RIGHT_EYE: 5,
	RIGHT_EYE_OUTER: 6,
	LEFT_EAR: 7,
	RIGHT_EAR: 8,
	MOUTH_LEFT: 9,
	MOUTH_RIGHT: 10,
	LEFT_SHOULDER: 11,
	RIGHT_SHOULDER: 12,
	LEFT_ELBOW: 13,
	RIGHT_ELBOW: 14,
	LEFT_WRIST: 15,
	RIGHT_WRIST: 16,
	LEFT_PINKY: 17,
	RIGHT_PINKY: 18,
	LEFT_INDEX: 19,
	RIGHT_INDEX: 20,
	LEFT_THUMB: 21,
	RIGHT_THUMB: 22,
	LEFT_HIP: 23,
	RIGHT_HIP: 24,
	LEFT_KNEE: 25,
	RIGHT_KNEE: 26,
	LEFT_ANKLE: 27,
	RIGHT_ANKLE: 28,
	LEFT_HEEL: 29,
	RIGHT_HEEL: 30,
	LEFT_FOOT_INDEX: 31,
	RIGHT_FOOT_INDEX: 32
};

export const PREDEFINED_EXERCISE_CONFIGS: Record<string, ExerciseConfig> = {
	bicep_curl: {
		name: 'bicep_curl',
		initialDirection: 'down',
		inverted: true, // Inverted because as elbow flexes more, angle decreases
		minPeakDistance: 8,
		anglePoints: [
			{
				name: 'left_elbow',
				points: [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_ELBOW, LANDMARK_INDICES.LEFT_WRIST],
				weight: 1.0,
				targetLowAngle: 45,
				targetHighAngle: 150
			},
			{
				name: 'right_elbow',
				points: [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW, LANDMARK_INDICES.RIGHT_WRIST],
				weight: 1.0,
				targetLowAngle: 45,
				targetHighAngle: 150
			}
		]
	},
	squat: {
		name: 'squat',
		initialDirection: 'up',
		inverted: true, // Inverted because as knees flex more (going down), angle decreases
		minPeakDistance: 12,
		anglePoints: [
			{
				name: 'left_knee',
				points: [LANDMARK_INDICES.LEFT_HIP, LANDMARK_INDICES.LEFT_KNEE, LANDMARK_INDICES.LEFT_ANKLE],
				weight: 1.0,
				targetLowAngle: 90,
				targetHighAngle: 170
			},
			{
				name: 'right_knee',
				points: [LANDMARK_INDICES.RIGHT_HIP, LANDMARK_INDICES.RIGHT_KNEE, LANDMARK_INDICES.RIGHT_ANKLE],
				weight: 1.0,
				targetLowAngle: 90,
				targetHighAngle: 170
			}
		]
	},
	push_up: {
		name: 'push_up',
		initialDirection: 'up',
		inverted: true, // Inverted because as elbows flex more (going down), angle decreases
		minPeakDistance: 10,
		anglePoints: [
			{
				name: 'left_elbow',
				points: [LANDMARK_INDICES.LEFT_SHOULDER, LANDMARK_INDICES.LEFT_ELBOW, LANDMARK_INDICES.LEFT_WRIST],
				weight: 1.0,
				targetLowAngle: 60,
				targetHighAngle: 160
			},
			{
				name: 'right_elbow',
				points: [LANDMARK_INDICES.RIGHT_SHOULDER, LANDMARK_INDICES.RIGHT_ELBOW, LANDMARK_INDICES.RIGHT_WRIST],
				weight: 1.0,
				targetLowAngle: 60,
				targetHighAngle: 160
			}
		]
	}
};

/**
 * PERFORMANCE OPTIMIZATION:
 * The processExerciseReps function now accepts an optional preloadedConfig parameter.
 * When a preloaded config is provided (e.g., from saved workouts), it eliminates the need
 * for LLM calls during real-time exercise tracking, significantly improving performance.
 * 
 * This is particularly beneficial for the form-analysis page where configs are already
 * loaded as part of the workout data structure.
 */

/**
 * Convenience function that automatically gets exercise config and processes reps
 * @param poseHistory An array of poses from MediaPipe
 * @param exerciseName Name of the exercise (will generate config if not found)
 * @param lastProcessedRepCount The number of reps that were already processed
 * @param feedbackOptions Options for enabling RAG and voice features
 * @param exerciseDescription Optional description to help with config generation
 * @param preloadedConfig Optional pre-loaded exercise config to use instead of loading/generating
 * @returns Promise containing rep count and new rep segments
 */
export async function processExerciseReps(
	poseHistory: Pose[],
	exerciseName: string,
	lastProcessedRepCount: number = 0,
	feedbackOptions: FeedbackOptions = {},
	exerciseDescription?: string,
	preloadedConfig?: ExerciseConfig
): Promise<{ repCount: number; newRepSegments: RepSegment[]; configUsed: ExerciseConfig | null }> {
	// Use preloaded config if provided, otherwise get or generate exercise configuration
	const exerciseConfig = preloadedConfig || await getExerciseConfig(exerciseName, exerciseDescription);
	
	if (!exerciseConfig) {
		console.error(`Could not get configuration for exercise: ${exerciseName}`);
		return { repCount: 0, newRepSegments: [], configUsed: null };
	}
	
	// Process reps using the configuration
	const result = segmentReps(poseHistory, exerciseConfig, lastProcessedRepCount, feedbackOptions);
	
	return {
		...result,
		configUsed: exerciseConfig
	};
}
