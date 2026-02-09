import { z } from 'zod';

// Input schema for workout feedback
export const WorkoutFeedbackInputSchema = z.object({
	exerciseName: z.string(),
	repNumber: z.number(),
	duration: z.number(),
	angleRange: z.object({
		min: z.number(),
		max: z.number()
	}),
	averageAngle: z.number(),
	rangeOfMotion: z.number(),
	// Target angle ranges for guidance
	targetAngles: z.object({
		min: z.number(),
		max: z.number()
	}).optional(),
	// Optional feature flags
	enableRAG: z.boolean().optional().default(false),
	enableVoice: z.boolean().optional().default(false)
});

// Output schema for workout feedback response
export const WorkoutFeedbackOutputSchema = z.object({
	feedback: z.string().max(500),
	score: z.number().min(0).max(100),
	classification: z.enum(['good', 'okay', 'bad'])
});

// TypeScript types derived from schemas
export type WorkoutFeedbackInput = z.infer<typeof WorkoutFeedbackInputSchema>;
export type WorkoutFeedbackOutput = z.infer<typeof WorkoutFeedbackOutputSchema>;
