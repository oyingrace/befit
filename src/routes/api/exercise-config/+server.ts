import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import { json } from '@sveltejs/kit';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/prisma';
import { getOpikTelemetry } from '$lib/opik';

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const CHAT_MODEL = process.env.CHAT_MODEL || 'qwen/qwen-2.5-7b-instruct:free';

if (!OPENROUTER_API_KEY) {
	console.warn('⚠️ OPENROUTER_API_KEY not set. Exercise config generation will not work.');
}

// Initialize the chat model
const chatModel = new OpenAICompatibleChatLanguageModel(
	CHAT_MODEL,
	{},
	{
		provider: 'openai',
		url: ({ path }) => {
			const url = new URL(`${OPENROUTER_BASE_URL}${path}`);
			return url.toString();
		},
		headers: () => ({
			'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
			'HTTP-Referer': process.env.BETTER_AUTH_URL || 'http://localhost:5173',
			'X-Title': 'BeFit'
		}),
		defaultObjectGenerationMode: 'json',
		supportsStructuredOutputs: true
	}
);

// MediaPipe pose landmark indices for reference
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

// Schema for exercise configuration generation
const AngleConfigSchema = z.object({
	name: z.string().describe('Name for this angle (e.g., "left_elbow", "right_knee")'),
	points: z.array(z.number()).length(3).describe('Three joint indices for angle calculation [point1, vertex, point3]'),
	weight: z.number().describe('Weight for this angle in the composite signal (typically 1.0, use different values to emphasize certain angles)'),
	targetLowAngle: z.number().min(0).max(180).describe('Target minimum angle in degrees for optimal range of motion'),
	targetHighAngle: z.number().min(0).max(180).describe('Target maximum angle in degrees for optimal range of motion')
});

const ExerciseConfigSchema = z.object({
	name: z.string().describe('Exercise name in snake_case format (e.g., bicep_curl, shoulder_press)'),
	initialDirection: z.enum(['up', 'down']).describe('The starting direction of the exercise movement'),
	minPeakDistance: z.number().min(5).max(20).describe('Minimum distance between peaks to count as a rep (5-20 frames)'),
	inverted: z.boolean().describe('Whether to invert the composite angle signal (true when lower angles = exercise "up" position, false otherwise)'),
	anglePoints: z.array(AngleConfigSchema).min(1).describe('Array of angle configurations for tracking movement. Include both left and right sides when possible.')
});

const ExerciseAnalysisSchema = z.object({
	exerciseType: z.enum(['upper_body', 'lower_body', 'full_body', 'core']).describe('The type of exercise'),
	primaryMuscles: z.array(z.string()).describe('Primary muscles worked by the exercise'),
	movementPattern: z.enum(['push', 'pull', 'squat', 'hinge', 'lunge', 'rotation', 'isometric']).describe('Primary movement pattern'),
	keyJoints: z.array(z.string()).describe('Key joints involved in the movement'),
	movementDirection: z.enum(['vertical', 'horizontal', 'diagonal', 'rotational']).describe('Primary direction of movement'),
	config: ExerciseConfigSchema
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('Exercise Config API: Starting request processing...');
		const { exerciseName, exerciseDescription, autoSave = false, romFocus = 'standard' } = await request.json();

		if (!exerciseName) {
			console.error('Exercise Config API: Exercise name is required');
			return json({ error: 'Exercise name is required' }, { status: 400 });
		}

		console.log(`Exercise Config API: Generating config for "${exerciseName}"`);

		const romInstructions = {
			'low': 'Generate conservative target angle ranges suitable for beginners or those with mobility limitations. Reduce the difference between targetLowAngle and targetHighAngle by 20-30%.',
			'standard': 'Generate standard target angle ranges for average fitness levels and typical range of motion.',
			'high': 'Generate extended target angle ranges for advanced users seeking maximum range of motion. Increase the difference between targetLowAngle and targetHighAngle by 20-30%.',
			'maximum': 'Generate maximum safe target angle ranges for elite athletes and those with exceptional mobility. Increase the difference between targetLowAngle and targetHighAngle by 40-50%.'
		};

		const systemPrompt = `You are an expert in biomechanics and exercise analysis. Your task is to generate MediaPipe pose tracking configurations for exercises based on ANGLE MEASUREMENTS ONLY.

AVAILABLE LANDMARK INDICES:
${Object.entries(LANDMARK_INDICES).map(([name, index]) => `${name}: ${index}`).join('\n')}

EXERCISE ANALYSIS GUIDELINES:

1. **Angle-Based Tracking**: All exercises are tracked using joint angles, not individual joint positions
   - Focus on the joints that flex/extend during the exercise
   - Common patterns:
     - Elbow angles: [shoulder, elbow, wrist]
     - Knee angles: [hip, knee, ankle]
     - Shoulder angles: [spine/torso, shoulder, elbow]
     - Hip angles: [torso, hip, knee]

2. **Bilateral Tracking**: Always include both left and right sides when possible
   - Left elbow: [LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST]
   - Right elbow: [RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST]
   - Left knee: [LEFT_HIP, LEFT_KNEE, LEFT_ANKLE]
   - Right knee: [RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE]

3. **Target Angle Ranges**: Define optimal range of motion for each angle
   - **targetLowAngle**: The target minimum angle (fully flexed position)
   - **targetHighAngle**: The target maximum angle (fully extended position)
   - Examples:
     - Bicep curl elbow: targetLowAngle=45°, targetHighAngle=150°
     - Squat knee: targetLowAngle=90°, targetHighAngle=170°
     - Push-up elbow: targetLowAngle=60°, targetHighAngle=160°
   - For higher ROM focus: Increase the difference between high and low targets
   - For safety/mobility limited: Reduce the difference between high and low targets

4. **Signal Inversion**:
   - Set inverted=true when LOWER angles represent the exercise "up" position
   - Examples:
     - Bicep curl: inverted=true (smaller elbow angle = curled up)
     - Squat: inverted=true (smaller knee angle = squatted down)
     - Push-up: inverted=true (smaller elbow angle = lowered down)
   - Most exercises will need inverted=true since flexion (smaller angles) is usually the "working" position

5. **Initial Direction**:
   - 'up': Exercise starts in the extended/top position (larger angles)
   - 'down': Exercise starts in the flexed/bottom position (smaller angles)

6. **Min Peak Distance**:
   - Faster exercises: 5-8 frames
   - Moderate exercises: 8-12 frames  
   - Slower exercises: 12-20 frames

7. **Angle Naming**: Use descriptive names like "left_elbow", "right_knee", "left_shoulder", etc.

EXAMPLE CONFIGURATIONS:
- Bicep Curl: Track left_elbow + right_elbow angles, inverted=true, initialDirection='down'
  - Elbow angles: targetLowAngle=45°, targetHighAngle=150°
- Squat: Track left_knee + right_knee angles, inverted=true, initialDirection='up'
  - Knee angles: targetLowAngle=90°, targetHighAngle=170°
- Push-up: Track left_elbow + right_elbow angles, inverted=true, initialDirection='up'
  - Elbow angles: targetLowAngle=60°, targetHighAngle=160°
- Overhead Press: Track left_elbow + right_elbow angles, inverted=true, initialDirection='down'
  - Elbow angles: targetLowAngle=30°, targetHighAngle=140°

Analyze the exercise and generate an angle-based configuration with bilateral tracking when possible. Include realistic target angle ranges based on typical human biomechanics and the specific exercise requirements.`;

		const userPrompt = `Exercise: ${exerciseName}
${exerciseDescription ? `Description: ${exerciseDescription}` : ''}
${romFocus !== 'standard' ? `Range of Motion Focus: ${romFocus} - ${romInstructions[romFocus as keyof typeof romInstructions]}` : ''}

Analyze this exercise and generate a MediaPipe pose tracking configuration. Consider the biomechanics, primary movement patterns, and which joints would provide the most reliable tracking data.`;

		console.log('Exercise Config API: Calling AI model...');
		
		// Add timeout to the AI model call
		const TIMEOUT_MS = 30000; // 30 seconds
		
		const modelPromise = generateObject({
			model: chatModel,
			schema: ExerciseAnalysisSchema,
			prompt: userPrompt,
			system: systemPrompt,
			temperature: 0.3, // Lower temperature for more consistent configs
			experimental_telemetry: getOpikTelemetry({
				name: 'exercise-config-generation',
				metadata: {
					exerciseName,
					exerciseDescription: exerciseDescription || 'none',
					romFocus,
					autoSave,
					model: CHAT_MODEL,
				},
			}),
		});

		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('AI model generation timeout')), TIMEOUT_MS)
		);

		const result = await Promise.race([modelPromise, timeoutPromise]) as Awaited<typeof modelPromise>;

		console.log('Exercise Config API: AI model completed, validating result...');

		if (!result || !result.object) {
			throw new Error('Invalid response from AI model');
		}

		console.log('Exercise Config API: Generated exercise config:', JSON.stringify(result.object, null, 2));

		let savedConfig = null;
		
		// Auto-save if requested
		if (autoSave) {
			try {
				// Check if a config with this name already exists
				const existingConfig = await prisma.exerciseConfig.findUnique({
					where: { name: result.object.config.name }
				});

				if (!existingConfig) {
					savedConfig = await prisma.exerciseConfig.create({
						data: {
							name: result.object.config.name,
							displayName: exerciseName,
							description: exerciseDescription || undefined,
							exerciseType: result.object.exerciseType,
							primaryMuscles: result.object.primaryMuscles,
							movementPattern: result.object.movementPattern,
							keyJoints: result.object.keyJoints,
							movementDirection: result.object.movementDirection,
							config: result.object.config,
							generatedBy: 'AI'
						}
					});
					console.log('Exercise Config API: Auto-saved config to database');
				} else {
					console.log('Exercise Config API: Config already exists, skipping auto-save');
				}
			} catch (saveError) {
				console.error('Exercise Config API: Error auto-saving config:', saveError);
				// Don't fail the request if saving fails
			}
		}

		return json({
			success: true,
			exerciseName,
			analysis: {
				exerciseType: result.object.exerciseType,
				primaryMuscles: result.object.primaryMuscles,
				movementPattern: result.object.movementPattern,
				keyJoints: result.object.keyJoints,
				movementDirection: result.object.movementDirection
			},
			config: result.object.config,
			saved: savedConfig !== null,
			savedConfig
		});

	} catch (error) {
		console.error('Exercise Config API: Error occurred:', error);

		return json(
			{
				error: 'Failed to generate exercise configuration',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
