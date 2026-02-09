/**
 * Opik instrumentation for Vercel AI SDK
 * Initializes OpenTelemetry SDK with OpikExporter for LLM observability
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OpikExporter } from 'opik-vercel';

// Initialize Opik exporter with configuration
const opikExporter = new OpikExporter({
	tags: ['sveltekit', 'befit'],
	metadata: {
		environment: process.env.NODE_ENV || 'development',
		framework: 'sveltekit',
	},
});

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
	traceExporter: opikExporter,
	instrumentations: [getNodeAutoInstrumentations()],
});

// Start the SDK
sdk.start();

// Export helper function to get Opik telemetry settings
export function getOpikTelemetry(settings?: {
	name?: string;
	threadId?: string;
	metadata?: Record<string, unknown>;
}) {
	return OpikExporter.getSettings({
		name: settings?.name || 'befit-llm-call',
		metadata: {
			...(settings?.metadata || {}),
			...(settings?.threadId && { threadId: settings.threadId }),
		},
	});
}

// Graceful shutdown
if (typeof process !== 'undefined') {
	process.on('SIGTERM', async () => {
		await sdk.shutdown();
	});
}

export { opikExporter };

