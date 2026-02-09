import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/prisma';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const { id } = params;

		if (!id) {
			return json({ error: 'Exercise config ID is required' }, { status: 400 });
		}

		// Fetch the specific exercise config
		const config = await prisma.exerciseConfig.findUnique({
			where: {
				id: id
			}
		});

		if (!config) {
			return json({ error: 'Exercise config not found' }, { status: 404 });
		}

		return json({ config });
	} catch (error) {
		console.error('Error fetching exercise config:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};
