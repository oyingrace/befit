import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/prisma';

export const GET: RequestHandler = async () => {
	try {
		// Fetch all exercise configs
		const configs = await prisma.exerciseConfig.findMany({
			orderBy: {
				createdAt: 'desc'
			}
		});

		return json({ configs });
	} catch (error) {
		console.error('Error fetching exercise configs:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const {
			name,
			displayName,
			description,
			exerciseType,
			primaryMuscles,
			movementPattern,
			keyJoints,
			movementDirection,
			config,
			generatedBy = 'AI'
		} = await request.json();

		// Validate required fields
		if (!name || !displayName || !exerciseType || !movementPattern || !config) {
			return json({ 
				error: 'Missing required fields: name, displayName, exerciseType, movementPattern, config' 
			}, { status: 400 });
		}

		// Check if a config with this name already exists
		const existingConfig = await prisma.exerciseConfig.findUnique({
			where: { name }
		});

		if (existingConfig) {
			return json({ 
				error: 'An exercise config with this name already exists' 
			}, { status: 409 });
		}

		// Create the exercise config
		const exerciseConfig = await prisma.exerciseConfig.create({
			data: {
				name,
				displayName,
				description,
				exerciseType,
				primaryMuscles,
				movementPattern,
				keyJoints,
				movementDirection,
				config,
				generatedBy
			}
		});

		return json({ 
			success: true, 
			config: exerciseConfig 
		});

	} catch (error) {
		console.error('Error saving exercise config:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
