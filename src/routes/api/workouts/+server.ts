import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/prisma';
import { auth } from '$lib/auth';

export const GET: RequestHandler = async ({ request }) => {
	try {
		// Get user session
		const session = await auth.api.getSession({ headers: request.headers });
		const userId = session?.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Fetch user's workouts
		const workouts = await prisma.workout.findMany({
			where: {
				userId
			},
			include: {
				exercises: {
					include: {
						exerciseConfig: true
					}
				}
			},
			orderBy: {
				createdAt: 'desc'
			}
		});

		return json({ workouts });
	} catch (error) {
		console.error('Error fetching workouts:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, url }) => {
	try {
		// Get user session
		const session = await auth.api.getSession({ headers: request.headers });
		const userId = session?.user?.id;

		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const workoutId = url.searchParams.get('id');
		if (!workoutId) {
			return json({ error: 'Workout ID is required' }, { status: 400 });
		}

		// Delete workout (only if it belongs to the user)
		const deletedWorkout = await prisma.workout.deleteMany({
			where: {
				id: workoutId,
				userId
			}
		});

		if (deletedWorkout.count === 0) {
			return json({ error: 'Workout not found or unauthorized' }, { status: 404 });
		}

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting workout:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
