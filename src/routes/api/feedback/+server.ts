import { WorkoutFeedbackInputSchema, WorkoutFeedbackOutputSchema } from '$lib/types/feedback';
import { OpenAICompatibleChatLanguageModel } from '@ai-sdk/openai-compatible';
import { QdrantClient } from '@qdrant/js-client-rest';
import { generateObject, type LanguageModelV1 } from 'ai';
import type { RequestHandler } from './$types';
import { getOpikTelemetry } from '$lib/opik';

// TTS Configuration - Using browser's built-in SpeechSynthesis API (free, no API key required)
// Audio is generated client-side using the browser's native TTS

// Types
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
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'openai/text-embedding-ada-002';
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY; // Optional, for Qdrant Cloud
const COLLECTION_NAME = 'rp_exercises';
const RELEVANCE_THRESHOLD = 0.6; // Lower threshold for exercise feedback

if (!OPENROUTER_API_KEY) {
	console.warn('⚠️ OPENROUTER_API_KEY not set. Feedback features will not work.');
}

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

// Simple RAG retrieval function
async function getExerciseReference(exerciseName: string, enableRAG: boolean): Promise<string> {
	if (!enableRAG) {
		return ''; // Skip RAG if disabled
	}
	
	try {
		// Create a search query focused on exercise technique and range of motion
		const searchQuery = `${exerciseName} exercise technique form range of motion proper execution`;

		// Generate embedding for the query
		const queryVector = await embeddingModel.encode(searchQuery);

		// Search in Qdrant
		const searchResponse = await qdrantClient.search(COLLECTION_NAME, {
			vector: queryVector,
			limit: 2,
			with_payload: true
		});

		const results = searchResponse as QdrantPoint[];

		// Filter results by relevance threshold
		const relevantResults = results.filter(
			(result: QdrantPoint) => result.score >= RELEVANCE_THRESHOLD
		);

		if (relevantResults.length === 0) {
			return '';
		}

		// Format the context for exercise feedback
		const context = relevantResults
			.map((result: QdrantPoint, index: number) => {
				const payload = result.payload;
				console.log(`Exercise reference result ${index + 1}:`, payload);
				return `Reference ${index + 1} (${(result.score * 100).toFixed(1)}% relevance):
${payload?.content || 'No content available'}`;
			})
			.join('\n\n');

		return context;
	} catch (error: any) {
		// Handle collection not found error gracefully (less noisy)
		if (error?.data?.status?.error?.includes("doesn't exist")) {
			// Collection doesn't exist - this is fine, just skip RAG
			return '';
		}
		// Log other errors but don't spam the console
		console.warn('Exercise reference retrieval failed (RAG disabled or collection missing):', error?.data?.status?.error || error?.message || 'Unknown error');
		return '';
	}
}

// Initialize the model
const CHAT_MODEL = process.env.CHAT_MODEL || 'qwen/qwen-2.5-7b-instruct:free';
const model: LanguageModelV1 = new OpenAICompatibleChatLanguageModel(
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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Validate input data
		const input = WorkoutFeedbackInputSchema.parse(body);

		// Get exercise reference information from RAG
		const exerciseReference = await getExerciseReference(input.exerciseName, input.enableRAG || false);

		// Convert technical metrics to simple descriptions
		let depthDescription = '';
		let movementQuality = '';
		let overallAssessment = '';
		
		// Assess depth/range of motion
		if (input.targetAngles) {
			const targetRange = input.targetAngles.max - input.targetAngles.min;
			const achievedRange = input.rangeOfMotion;
			const depthPercentage = (achievedRange / targetRange) * 100;
			
			if (depthPercentage >= 95) {
				depthDescription = 'excellent depth - full range achieved';
			} else if (depthPercentage >= 80) {
				depthDescription = 'good depth - almost full range';
			} else if (depthPercentage >= 60) {
				depthDescription = 'moderate depth - could go deeper';
			} else {
				depthDescription = 'limited depth - needs to go much deeper';
			}
		} else {
			// Without target angles, use relative assessment
			if (input.rangeOfMotion > 80) {
				depthDescription = 'good range of motion';
			} else if (input.rangeOfMotion > 50) {
				depthDescription = 'moderate range - could improve';
			} else {
				depthDescription = 'limited range - needs more depth';
			}
		}
		
		// Assess movement speed/control (duration)
		const durationSeconds = input.duration / 1000;
		if (durationSeconds > 3) {
			movementQuality = 'slow and controlled';
		} else if (durationSeconds > 1.5) {
			movementQuality = 'good controlled pace';
		} else if (durationSeconds > 0.8) {
			movementQuality = 'slightly rushed';
		} else {
			movementQuality = 'too fast - needs more control';
		}
		
		// Overall assessment
		const hasGoodDepth = input.targetAngles ? 
			(input.rangeOfMotion / (input.targetAngles.max - input.targetAngles.min)) >= 0.8 :
			input.rangeOfMotion > 60;
		const hasGoodControl = durationSeconds >= 1.5;
		
		if (hasGoodDepth && hasGoodControl) {
			overallAssessment = 'excellent form';
		} else if (hasGoodDepth || hasGoodControl) {
			overallAssessment = 'good form with room for improvement';
		} else {
			overallAssessment = 'needs improvement on form';
		}

		// Create the prompt for feedback generation with simple language
		let prompt = `You are a friendly, encouraging fitness coach. Give simple, natural feedback like a real person would.

Exercise: ${input.exerciseName}
Rep: ${input.repNumber}

What happened:
- Depth: ${depthDescription}
- Movement: ${movementQuality}
- Overall: ${overallAssessment}`;

		// Add exercise reference if available
		if (exerciseReference) {
			prompt += `\n\nEXERCISE REFERENCE INFORMATION:
${exerciseReference}

Use this reference information to provide more accurate feedback about proper form and technique.`;
		}

		prompt += `\n\nIMPORTANT INSTRUCTIONS:
- Use simple, everyday language - NO technical terms, NO numbers, NO degrees
- Be encouraging and supportive like a real coach
- Give actionable cues: "go deeper", "slow down", "nice control", "full range"
- Keep it under 100 characters
- Sound natural and human, not robotic

Examples of good feedback:
- "Go deeper on the next rep!"
- "Nice control, keep it up!"
- "Perfect! Full range and smooth"
- "Slow down a bit, focus on control"
- "Great depth! That's the way"

Examples of BAD feedback (don't do this):
- "Range of motion: 95 degrees" ❌
- "Angle range 50-145" ❌
- "ROM achievement 90%" ❌
- "Target was 105°, achieved 95°" ❌

Return:
- feedback: Max 100 chars, simple and encouraging (NO numbers or degrees!)
- score: 0-100 based on form quality
- classification: "good" (80-100), "okay" (60-79), "bad" (0-59)`;

		// Generate the feedback object first
		const result = await generateObject({
			model,
			schema: WorkoutFeedbackOutputSchema,
			prompt,
			experimental_telemetry: getOpikTelemetry({
				name: 'feedback-generation',
				metadata: {
					exerciseName: input.exerciseName,
					repNumber: input.repNumber,
					rangeOfMotion: input.rangeOfMotion,
					duration: input.duration,
					enableRAG: input.enableRAG || false,
					enableVoice: input.enableVoice || false,
					hasTargetAngles: !!input.targetAngles,
					model: CHAT_MODEL,
				},
			}),
		});

		const feedback = result.object;

		// Create a readable stream to send data
		const stream = new ReadableStream({
			async start(controller) {
				try {
					// First, send the feedback data as JSON
					const feedbackData = JSON.stringify({
						type: 'feedback',
						data: feedback
					}) + '\n';
					controller.enqueue(new TextEncoder().encode(feedbackData));

					// For voice feedback, send a signal to use browser's SpeechSynthesis API
					// This is free, requires no API keys, and works client-side
					if (input.enableVoice) {
						const voiceSignal = JSON.stringify({
							type: 'voice',
							text: feedback.feedback
						}) + '\n';
						controller.enqueue(new TextEncoder().encode(voiceSignal));
					}
					
					controller.close();
				} catch (error) {
					console.error('Error in stream:', error);
					controller.error(error);
				}
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'application/x-ndjson',
				'X-RAG-Used': input.enableRAG ? 'true' : 'false',
				'X-Voice-Used': input.enableVoice ? 'true' : 'false'
			}
		});
	} catch (error) {
		console.error('Feedback generation error:', error);

		// Return error response
		return new Response(
			JSON.stringify({
				error: 'Failed to generate feedback',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
};
