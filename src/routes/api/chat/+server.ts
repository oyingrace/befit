import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import { json } from '@sveltejs/kit';
import { streamText, type LanguageModelV1, tool } from 'ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/prisma';
import { auth } from '$lib/auth';
import { getOpikTelemetry } from '$lib/opik';

// Types
interface RAGSource {
	title?: string;
	url?: string;
	relevance: number;
}

interface RAGResult {
	hasRelevantData: boolean;
	context: string;
	sources?: RAGSource[];
}

interface QdrantPoint {
	id: string | number;
	score: number;
	payload?: {
		title?: string;
		url?: string;
		content?: string;
		[key: string]: unknown;
	};
}

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const CHAT_MODEL = process.env.CHAT_MODEL || 'qwen/qwen-2.5-7b-instruct:free'; // Free model from OpenRouter
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'openai/text-embedding-ada-002';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY; // Optional, for Qdrant Cloud
const COLLECTION_NAME = 'rp_exercises';
const RELEVANCE_THRESHOLD = 0.7; // Only use RAG data if relevance score is above this

if (!OPENROUTER_API_KEY) {
	console.warn('⚠️ OPENROUTER_API_KEY not set. Chat and embedding features will not work.');
}

// Initialize the chat model
const chatModel: LanguageModelV1 = new OpenAICompatibleChatLanguageModel(
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

// Initialize Qdrant client (supports API key for Qdrant Cloud)
const qdrantClient = new QdrantClient({ 
	url: QDRANT_URL,
	...(QDRANT_API_KEY && { apiKey: QDRANT_API_KEY })
});

// Embedding helper class for OpenRouter
class OpenRouterEmbedding {
	private apiKey: string;
	private baseUrl: string;
	private model: string;

	constructor(apiKey: string, baseUrl = OPENROUTER_BASE_URL, model = EMBEDDING_MODEL) {
		this.apiKey = apiKey;
		this.baseUrl = baseUrl;
		this.model = model;
	}

	async encode(text: string): Promise<number[]> {
		if (!this.apiKey) {
			throw new Error('OpenRouter API key not configured');
		}

		const url = `${this.baseUrl}/embeddings`;
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.apiKey}`,
				'HTTP-Referer': process.env.BETTER_AUTH_URL || 'http://localhost:5173',
				'X-Title': 'BeFit'
			},
			body: JSON.stringify({
				model: this.model,
				input: text
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Embedding API error: ${response.status} - ${errorText}`);
		}

		const data = await response.json();
		return data.data[0].embedding;
	}
}

const embeddingModel = new OpenRouterEmbedding(OPENROUTER_API_KEY || '');

// RAG retrieval function
async function retrieveRelevantContent(query: string, topK = 3): Promise<RAGResult> {
	try {
		// Generate embedding for the query
		const queryVector = await embeddingModel.encode(query);

		// Search in Qdrant
		const searchResponse = await qdrantClient.search(COLLECTION_NAME, {
			vector: queryVector,
			limit: topK,
			with_payload: true
		});

		const results = searchResponse as QdrantPoint[];

		// Filter results by relevance threshold
		const relevantResults = results.filter(
			(result: QdrantPoint) => result.score >= RELEVANCE_THRESHOLD
		);

		if (relevantResults.length === 0) {
			return { hasRelevantData: false, context: '' };
		}

		// Format the context
		const context = relevantResults
			.map((result: QdrantPoint, index: number) => {
				const payload = result.payload;
				return `
[Source ${index + 1}] ${payload?.title || 'Unknown Title'}
Relevance: ${(result.score * 100).toFixed(1)}%
Content: ${payload?.content || 'No content available'}
URL: ${payload?.url || 'No URL'}
`.trim();
			})
			.join('\n\n');

		return {
			hasRelevantData: true,
			context,
			sources: relevantResults.map((r: QdrantPoint) => ({
				title: r.payload?.title,
				url: r.payload?.url,
				relevance: r.score
			}))
		};
	} catch (error) {
		console.error('RAG retrieval error:', error);
		return { hasRelevantData: false, context: '' };
	}
}

// Check if query is fitness/hypertrophy related
function isFitnessRelated(message: string): boolean {
	const fitnessKeywords = [
		'muscle',
		'hypertrophy',
		'training',
		'workout',
		'exercise',
		'sets',
		'reps',
		'volume',
		'frequency',
		'progressive overload',
		'recovery',
		'strength',
		'bicep',
		'tricep',
		'chest',
		'back',
		'legs',
		'shoulders',
		'abs',
		'glutes',
		'cardio',
		'weight',
		'gym',
		'fitness'
	];

	const lowerMessage = message.toLowerCase();
	return fitnessKeywords.some((keyword) => lowerMessage.includes(keyword));
}

// Define the workout creation tool
const createWorkoutTool = tool({
	description: 'Create a personalized workout routine based on user goals and available equipment',
	parameters: z.object({
		goals: z.string().describe("The user's fitness goals"),
		equipment: z.array(z.string()).describe('Available equipment'),
		duration: z.number().optional().describe('Workout duration in minutes'),
		experience: z
			.enum(['beginner', 'intermediate', 'advanced'])
			.optional()
			.describe('User experience level'),
		workoutPlan: z.object({
			name: z.string().describe('Name of the workout routine'),
			description: z.string().describe('Brief description of the workout'),
			exercises: z.array(
				z.object({
					name: z.string().describe('Exercise name'),
					sets: z.number().describe('Number of sets'),
					reps: z.string().describe('Number of reps (can be a range like "8-12")'),
					rest: z.string().describe('Rest time between sets'),
					equipment: z.string().optional().describe('Required equipment'),
					notes: z.string().optional().describe('Form tips or modifications')
				})
			),
			totalDuration: z.number().describe('Estimated total workout duration in minutes'),
			frequency: z.string().describe('Recommended frequency per week')
		})
	}),
	execute: async ({ goals, equipment, duration, experience, workoutPlan }) => {
		try {
			console.log('🏋️ createWorkoutTool: Starting execution...');
			
			// Log to both console and return in response for visibility
			const logMessage = `Creating workout with: ${JSON.stringify({ goals, equipment, duration, experience })}`;
			console.log('🏋️ createWorkoutTool:', logMessage);
			
			// Validate input parameters
			if (!workoutPlan || !workoutPlan.name) {
				console.error('🏋️ createWorkoutTool: Invalid workout plan provided');
				throw new Error('Invalid workout plan structure');
			}

			console.log(`🏋️ createWorkoutTool: Workout plan created: ${workoutPlan.name} with ${workoutPlan.exercises?.length || 0} exercises`);
			
			const result = {
				success: true,
				message:
					'Workout routine created successfully! Would you like me to save this workout to your profile so you can access it later?',
				workout: workoutPlan,
				shouldAskToSave: true,
				debug: logMessage // Include debug info in response
			};
			
			console.log('🏋️ createWorkoutTool: Execution completed successfully, returning result');
			return result;
		} catch (error) {
			console.error('🏋️ createWorkoutTool: Error occurred:', error);
			const errorResult = {
				success: false,
				message: 'Sorry, there was an error creating the workout routine. Please try again.',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
			console.log('🏋️ createWorkoutTool: Returning error result:', errorResult);
			return errorResult;
		}
	}
});

// Define the save workout tool factory
const createSaveWorkoutTool = (userId: string | undefined) =>
	tool({
		description: "Save a workout routine to the user's profile",
		parameters: z.object({
			workoutPlan: z.object({
				name: z.string().describe('Name of the workout routine'),
				description: z.string().describe('Brief description of the workout'),
				exercises: z.array(
					z.object({
						name: z.string().describe('Exercise name'),
						sets: z.number().describe('Number of sets'),
						reps: z.string().describe('Number of reps (can be a range like "8-12")'),
						rest: z.string().describe('Rest time between sets'),
						equipment: z.string().optional().describe('Required equipment'),
						notes: z.string().optional().describe('Form tips or modifications')
					})
				),
				totalDuration: z.number().describe('Estimated total workout duration in minutes'),
				frequency: z.string().describe('Recommended frequency per week')
			}),
			goals: z.string().describe("The user's fitness goals"),
			equipment: z.array(z.string()).describe('Available equipment'),
			fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced']).describe('User fitness level')
		}),
		execute: async ({ workoutPlan, goals, equipment, fitnessLevel }) => {
			try {
				console.log('Starting saveWorkout execution...');
				
				if (!userId) {
					console.log('No user ID found, user not logged in');
					return {
						success: false,
						message:
							'You need to be logged in to save workouts. Please sign in to save this workout to your profile.'
					};
				}

				console.log(`Saving workout "${workoutPlan.name}" for user ${userId}`);

				// Map fitness level to enum
				const fitnessLevelEnum = fitnessLevel.toUpperCase() as
					| 'BEGINNER'
					| 'INTERMEDIATE'
					| 'ADVANCED';

				// Generate exercise configs for all exercises in the workout with timeout
				const exerciseConfigIds: (string | null)[] = [];
				const TIMEOUT_MS = 30000; // 30 second timeout per exercise
				
				console.log(`Processing ${workoutPlan.exercises.length} exercises for config generation...`);

				for (let i = 0; i < workoutPlan.exercises.length; i++) {
					const exercise = workoutPlan.exercises[i];
					console.log(`Processing exercise ${i + 1}/${workoutPlan.exercises.length}: ${exercise.name}`);
					
					try {
						// Check if config already exists
						console.log(`Checking if config exists for: ${exercise.name}`);
						const existingConfig = await prisma.exerciseConfig.findUnique({
							where: { name: exercise.name.toLowerCase().replace(/[^a-z0-9]/g, '_') }
						});

						if (existingConfig) {
							console.log(`Found existing config for ${exercise.name}`);
							exerciseConfigIds.push(existingConfig.id);
						} else {
							console.log(`Generating new config for ${exercise.name}`);
							
							// Create a promise with timeout for the API call
							const configPromise = fetch('http://localhost:5173/api/exercise-config', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									exerciseName: exercise.name,
									exerciseDescription: exercise.notes || `${exercise.name} exercise`
								})
							});

							const timeoutPromise = new Promise((_, reject) =>
								setTimeout(() => reject(new Error('Config generation timeout')), TIMEOUT_MS)
							);

							const configResponse = await Promise.race([configPromise, timeoutPromise]) as Response;

							if (configResponse.ok) {
								const configResult = await configResponse.json();
								if (configResult.success) {
									console.log(`Successfully generated config for ${exercise.name}`);
									// Save the generated config to database
									const savedConfig = await prisma.exerciseConfig.create({
										data: {
											name: configResult.config.name,
											displayName: exercise.name,
											description: exercise.notes || `${exercise.name} exercise`,
											exerciseType: configResult.analysis.exerciseType,
											primaryMuscles: configResult.analysis.primaryMuscles,
											movementPattern: configResult.analysis.movementPattern,
											keyJoints: configResult.analysis.keyJoints,
											movementDirection: configResult.analysis.movementDirection,
											config: configResult.config,
											generatedBy: 'AI'
										}
									});
									exerciseConfigIds.push(savedConfig.id);
									console.log(`Saved config to database for ${exercise.name}`);
								} else {
									console.warn(`Failed to generate config for ${exercise.name}: ${configResult.error}`);
									exerciseConfigIds.push(null);
								}
							} else {
								console.warn(`Config generation API failed for ${exercise.name}: ${configResponse.status}`);
								exerciseConfigIds.push(null);
							}
						}
					} catch (error) {
						console.error(`Error generating config for ${exercise.name}:`, error);
						exerciseConfigIds.push(null);
						// Continue with next exercise instead of failing completely
					}
				}

				console.log('Creating workout in database...');
				// Create workout in database with linked exercise configs
				const savedWorkout = await prisma.workout.create({
					data: {
						name: workoutPlan.name,
						description: workoutPlan.description,
						totalDuration: workoutPlan.totalDuration,
						frequency: workoutPlan.frequency,
						fitnessLevel: fitnessLevelEnum,
						goals,
						equipment,
						userId,
						exercises: {
							create: workoutPlan.exercises.map((exercise, index) => ({
								name: exercise.name,
								sets: exercise.sets,
								reps: exercise.reps,
								rest: exercise.rest,
								equipment: exercise.equipment,
								notes: exercise.notes,
								exerciseConfigId: exerciseConfigIds[index]
							}))
						}
					},
					include: {
						exercises: {
							include: {
								exerciseConfig: true
							}
						}
					}
				});

				const configsGenerated = exerciseConfigIds.filter((id) => id !== null).length;
				console.log(`Workout saved successfully with ${configsGenerated} configs generated`);
				
				return {
					success: true,
					message: `Perfect! Your workout "${workoutPlan.name}" has been saved to your profile with ${configsGenerated} AI-generated exercise tracking configurations. You can access it anytime from your workout library and start tracking your reps in real-time!`,
					workoutId: savedWorkout.id,
					configsGenerated
				};
			} catch (error) {
				console.error('Error saving workout:', error);
				return {
					success: false,
					message: 'Sorry, there was an error saving your workout. Please try again.',
					error: error instanceof Error ? error.message : 'Unknown error'
				};
			}
		}
	});

// Add exercise config generation capability
const generateExerciseConfigTool = tool({
	description: 'Generate MediaPipe pose tracking configuration for any exercise',
	parameters: z.object({
		exerciseName: z.string().describe('Name of the exercise'),
		exerciseDescription: z
			.string()
			.optional()
			.describe('Optional description of how the exercise is performed')
	}),
	execute: async ({ exerciseName, exerciseDescription }) => {
		try {
			console.log(`Generating exercise config for: ${exerciseName}`);
			
			const TIMEOUT_MS = 30000; // 30 second timeout
			
			const fetchPromise = fetch('/api/exercise-config', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					exerciseName,
					exerciseDescription
				})
			});

			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
			);

			const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

			if (!response.ok) {
				console.error(`Exercise config API failed with status: ${response.status}`);
				return {
					success: false,
					message: `Failed to generate exercise configuration for ${exerciseName} (HTTP ${response.status})`
				};
			}

			const result = await response.json();

			if (result.success) {
				console.log(`Successfully generated config for: ${exerciseName}`);
				return {
					success: true,
					message: `Successfully generated tracking configuration for ${exerciseName}`,
					exerciseName: result.exerciseName,
					analysis: result.analysis,
					config: result.config
				};
			} else {
				console.error(`Config generation failed for ${exerciseName}:`, result.error);
				return {
					success: false,
					message: `Failed to generate configuration: ${result.error}`
				};
			}
		} catch (error) {
			console.error(`Error in generateExerciseConfigTool for ${exerciseName}:`, error);
			return {
				success: false,
				message: `Error generating exercise configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
			};
		}
	}
});

export const POST: RequestHandler = async ({ request }) => {
	try {
		console.log('Chat API: Received request');
		const { messages } = await request.json();

		if (!messages || !Array.isArray(messages)) {
			console.error('Chat API: Invalid messages format');
			return json({ error: 'Invalid messages format' }, { status: 400 });
		}

		console.log(`Chat API: Processing ${messages.length} messages`);

		// Get user session
		console.log('Chat API: Getting user session...');
		const session = await auth.api.getSession({ headers: request.headers });
		const userId = session?.user?.id;
		console.log(`Chat API: User ID: ${userId || 'Not logged in'}`);

		// Get the latest user message
		const lastMessage = messages[messages.length - 1];
		const userQuery = lastMessage?.content || '';
		console.log(`Chat API: User query: ${userQuery.substring(0, 100)}...`);

		let systemPrompt = `You are BeFit AI, a knowledgeable fitness and hypertrophy training assistant. 
You provide evidence-based advice on muscle building, training techniques, and exercise science.

When users ask for workout routines or express fitness goals, you can create personalized workout plans using the createWorkout tool. 
Always consider their fitness level (beginner, intermediate, or advanced) and available equipment when creating workouts.

For beginners: Focus on basic movements, proper form, and gradual progression.
For intermediate: Include compound movements with moderate intensity and volume.
For advanced: Incorporate complex movements, higher intensity, and advanced techniques.

After creating a workout routine, ALWAYS ask the user if they would like to save it to their profile for future reference. If they say yes, use the saveWorkout tool to save it to their account.

NEW CAPABILITY: You can also generate pose tracking configurations for any exercise using the generateExerciseConfig tool. This allows the app to track and provide real-time feedback on virtually any exercise, not just the predefined ones. When users ask about specific exercises or mention exercises not commonly tracked, you can generate tracking configurations for them.

Important: Respond directly and clearly without showing any internal thinking process. Do not use <think> tags or expose reasoning steps.`;

		let ragContext = '';
		let sources: RAGSource[] = [];

		// Only attempt RAG if the query is fitness-related
		if (isFitnessRelated(userQuery)) {
			console.log('Chat API: Fitness-related query detected, attempting RAG retrieval...');

			try {
				const ragResult = await retrieveRelevantContent(userQuery);

				if (ragResult.hasRelevantData) {
					console.log('Chat API: High-relevance content found, using RAG data');
					ragContext = ragResult.context;
					sources = ragResult.sources || [];

					systemPrompt += `\n\nRELEVANT TRAINING INFORMATION:
${ragContext}

When answering, prioritize the information from these high-relevance sources. 
Cite specific sources when referencing their content.
If the user's question relates to the provided sources, use that information as your primary reference.`;
				} else {
					console.log('Chat API: No high-relevance content found, proceeding without RAG');
				}
			} catch (ragError) {
				console.error('Chat API: RAG retrieval failed:', ragError);
				// Continue without RAG if it fails
			}
		} else {
			console.log('Chat API: Non-fitness query, skipping RAG retrieval');
		}

		console.log('Chat API: Starting streamText generation...');
		// Generate response using the AI SDK with streaming
		const result = await streamText({
			model: chatModel,
			messages: [
				{
					role: 'system',
					content: systemPrompt
				},
				...messages
			],
			tools: {
				createWorkout: createWorkoutTool,
				saveWorkout: createSaveWorkoutTool(userId),
				generateExerciseConfig: generateExerciseConfigTool
			},
			maxSteps: 5,
			toolCallStreaming: true,
			experimental_telemetry: getOpikTelemetry({
				name: 'chat-message',
				threadId: userId || `anonymous-${Date.now()}`,
				metadata: {
					userId: userId || 'anonymous',
					messageCount: messages.length,
					hasRAG: ragContext ? true : false,
					ragSourcesCount: sources.length,
					model: CHAT_MODEL,
				},
			}),
			onStepFinish: (step) => {
				console.log('Chat API: Step finished:', {
					stepType: step.stepType,
					toolCalls: step.toolCalls?.length || 0,
					text: step.text ? step.text.substring(0, 100) + '...' : 'No text',
					toolResults: step.toolResults?.length || 0
				});
				
				// Log tool results if any
				if (step.toolResults && step.toolResults.length > 0) {
					step.toolResults.forEach((result, index) => {
						console.log(`Chat API: Tool result ${index + 1}:`, {
							toolCallId: result.toolCallId,
							toolName: result.toolName,
							result: typeof result.result === 'object' 
								? JSON.stringify(result.result).substring(0, 200) + '...'
								: result.result
						});
					});
				}
			},
			onFinish: (result) => {
				console.log('Chat API: Generation finished:', {
					finishReason: result.finishReason,
					usage: result.usage,
					steps: result.steps.length,
					totalToolCalls: result.steps.reduce((total, step) => total + (step.toolCalls?.length || 0), 0)
				});
			}
		});

		console.log('Chat API: Stream created successfully, returning response');

		// Convert the stream to a Response object
		return new Response(result.toDataStream(), {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'X-RAG-Sources': JSON.stringify(sources),
				'X-RAG-Used': ragContext ? 'true' : 'false'
			}
		});
	} catch (error) {
		console.error('Chat API: Fatal error:', error);

		return json(
			{
				error: 'Failed to process chat request',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
