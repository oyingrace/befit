// Test file to validate the new streaming audio feedback system
// Run this with: node test-streaming-feedback.js (after starting the dev server)

const testData = {
	exerciseName: "bicep curl",
	repNumber: 1,
	duration: 1200,
	angleRange: { min: 45.2, max: 135.8 },
	averageAngle: 90.5,
	rangeOfMotion: 90.6
};

async function testStreamingFeedback() {
	try {
		const response = await fetch('http://localhost:5173/api/feedback', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(testData)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		
		if (!reader) {
			throw new Error('No reader available');
		}

		let buffer = '';
		
		console.log('🔄 Starting to read streaming response...');
		
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				if (line.trim()) {
					try {
						const data = JSON.parse(line);
						
						if (data.type === 'feedback') {
							console.log('✅ Received feedback data:');
							console.log(`   Text: ${data.data.feedback}`);
							console.log(`   Score: ${data.data.score}`);
							console.log(`   Classification: ${data.data.classification}`);
						} else if (data.type === 'audio') {
							console.log('🔊 Received audio data:');
							console.log(`   Base64 length: ${data.data.length} characters`);
							console.log(`   First 50 chars: ${data.data.substring(0, 50)}...`);
						}
					} catch (parseError) {
						console.error('❌ Error parsing streaming data:', parseError);
					}
				}
			}
		}
		
		console.log('✅ Streaming test completed successfully!');
		
	} catch (error) {
		console.error('❌ Test failed:', error);
	}
}

testStreamingFeedback();
