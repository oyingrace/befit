import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const diagnostics: {
			timestamp: string;
			environment: Record<string, string>;
			services: Record<string, { status: string; error?: string; statusCode?: number; url?: string }>;
		} = {
			timestamp: new Date().toISOString(),
			environment: {
				NODE_ENV: process.env.NODE_ENV || 'development',
				OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? '[CONFIGURED]' : '[NOT SET]',
				CHAT_MODEL: process.env.CHAT_MODEL || 'qwen/qwen-2.5-7b-instruct:free',
				EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'openai/text-embedding-ada-002',
				QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
				QDRANT_API_KEY: process.env.QDRANT_API_KEY ? '[CONFIGURED]' : '[NOT SET]',
				DATABASE_URL: process.env.DATABASE_URL ? '[CONFIGURED]' : '[NOT SET]'
			},
			services: {}
		};

		// Test OpenRouter connection
		try {
			const openRouterApiKey = process.env.OPENROUTER_API_KEY;
			if (!openRouterApiKey) {
				diagnostics.services.openRouter = {
					status: 'FAILED',
					error: 'OPENROUTER_API_KEY not set',
					url: 'https://openrouter.ai/api/v1'
				};
			} else {
				const response = await fetch('https://openrouter.ai/api/v1/models', {
					method: 'GET',
					headers: {
						'Authorization': `Bearer ${openRouterApiKey}`
					},
					signal: AbortSignal.timeout(5000) // 5 second timeout
				});
				
				diagnostics.services.openRouter = {
					status: response.ok ? 'CONNECTED' : 'ERROR',
					statusCode: response.status,
					url: 'https://openrouter.ai/api/v1'
				};
			}
		} catch (error) {
			diagnostics.services.openRouter = {
				status: 'FAILED',
				error: error instanceof Error ? error.message : 'Unknown error',
				url: 'https://openrouter.ai/api/v1'
			};
		}

		// Test Qdrant connection
		try {
			const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
			const qdrantApiKey = process.env.QDRANT_API_KEY;
			const headers: HeadersInit = {};
			if (qdrantApiKey) {
				headers['api-key'] = qdrantApiKey;
			}
			const response = await fetch(`${qdrantUrl}/health`, {
				method: 'GET',
				headers,
				signal: AbortSignal.timeout(5000) // 5 second timeout
			});
			
			diagnostics.services.qdrant = {
				status: response.ok ? 'CONNECTED' : 'ERROR',
				statusCode: response.status,
				url: qdrantUrl
			};
		} catch (error) {
			diagnostics.services.qdrant = {
				status: 'FAILED',
				error: error instanceof Error ? error.message : 'Unknown error',
				url: process.env.QDRANT_URL || 'http://localhost:6333'
			};
		}

		// Test database connection
		try {
			const { prisma } = await import('$lib/prisma');
			await prisma.$queryRaw`SELECT 1`;
			diagnostics.services.database = {
				status: 'CONNECTED'
			};
		} catch (error) {
			diagnostics.services.database = {
				status: 'FAILED',
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}

		return json(diagnostics);
	} catch (error) {
		return json(
			{
				error: 'Diagnostics failed',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
