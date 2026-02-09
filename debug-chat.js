// Debug script to test the chat API and identify hanging issues
// Run with: node debug-chat.js

const CHAT_API_URL = 'http://localhost:5173/api/chat';

async function testChatAPI() {
	console.log('🚀 Testing Chat API...');
	
	const messages = [
		{
			role: 'user',
			content: 'Create a simple 30-minute beginner workout for chest and triceps using just dumbbells'
		}
	];

	try {
		console.log('📤 Sending request to chat API...');
		console.log('Request payload:', JSON.stringify({ messages }, null, 2));

		const startTime = Date.now();
		const response = await fetch(CHAT_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ messages })
		});

		const endTime = Date.now();
		console.log(`⏱️ Request completed in ${endTime - startTime}ms`);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		console.log('✅ Response received successfully');
		console.log('Response headers:', Object.fromEntries(response.headers.entries()));

		// Read the stream
		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('No response body');
		}

		let chunks = [];
		let totalLength = 0;

		while (true) {
			const { done, value } = await reader.read();
			
			if (done) {
				console.log('📥 Stream completed');
				break;
			}

			chunks.push(value);
			totalLength += value.length;
			
			// Convert chunk to text for debugging
			const chunkText = new TextDecoder().decode(value);
			console.log('📊 Received chunk:', chunkText.substring(0, 200) + (chunkText.length > 200 ? '...' : ''));
		}

		console.log(`📈 Total response size: ${totalLength} bytes`);
		console.log('🎉 Test completed successfully!');

	} catch (error) {
		console.error('❌ Test failed:', error);
		
		if (error.message.includes('fetch')) {
			console.log('💡 Suggestion: Check if the dev server is running on localhost:5173');
		}
		
		if (error.message.includes('timeout')) {
			console.log('💡 Suggestion: The request timed out - check for hanging operations in the backend');
		}
	}
}

// Test with timeout
async function testWithTimeout() {
	console.log('🕒 Testing with 60-second timeout...');
	
	const timeout = setTimeout(() => {
		console.error('⏰ Test timed out after 60 seconds!');
		console.log('💡 This suggests the createWorkoutTool is hanging');
		process.exit(1);
	}, 60000);

	try {
		await testChatAPI();
		clearTimeout(timeout);
	} catch (error) {
		clearTimeout(timeout);
		throw error;
	}
}

// Run the test
testWithTimeout().catch(console.error);
