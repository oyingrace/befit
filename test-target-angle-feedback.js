// Test file to validate the target angle feedback functionality
// Run this with: node test-target-angle-feedback.js (after starting the dev server)

const testFeedbackCases = [
	{
		// Perfect ROM within target range
		exerciseName: "bicep curl",
		repNumber: 1,
		duration: 2500,
		angleRange: { min: 50, max: 145 },
		averageAngle: 97.5,
		rangeOfMotion: 95,
		targetAngles: { min: 45, max: 150 }, // User achieved within target
		enableRAG: false,
		enableVoice: false
	},
	{
		// Limited ROM - below target range
		exerciseName: "bicep curl", 
		repNumber: 2,
		duration: 2000,
		angleRange: { min: 70, max: 125 },
		averageAngle: 97.5,
		rangeOfMotion: 55,
		targetAngles: { min: 45, max: 150 }, // User achieved less than target
		enableRAG: false,
		enableVoice: false
	},
	{
		// Exceptional ROM - exceeding target range safely
		exerciseName: "bicep curl",
		repNumber: 3,
		duration: 3000,
		angleRange: { min: 35, max: 160 },
		averageAngle: 97.5,
		rangeOfMotion: 125,
		targetAngles: { min: 45, max: 150 }, // User exceeded target safely
		enableRAG: false,
		enableVoice: false
	},
	{
		// Standard case without target angles for comparison
		exerciseName: "bicep curl",
		repNumber: 4,
		duration: 2300,
		angleRange: { min: 55, max: 140 },
		averageAngle: 97.5,
		rangeOfMotion: 85,
		// No targetAngles provided
		enableRAG: false,
		enableVoice: false
	}
];

async function testFeedbackWithTargetAngles(testCase) {
	try {
		console.log(`\n🔄 Testing Rep ${testCase.repNumber} - ${testCase.exerciseName}`);
		
		if (testCase.targetAngles) {
			const targetRange = testCase.targetAngles.max - testCase.targetAngles.min;
			const achievedPercentage = (testCase.rangeOfMotion / targetRange * 100).toFixed(1);
			console.log(`🎯 Target Range: ${testCase.targetAngles.min}° - ${testCase.targetAngles.max}° (${targetRange}° target ROM)`);
			console.log(`📏 Achieved Range: ${testCase.angleRange.min}° - ${testCase.angleRange.max}° (${testCase.rangeOfMotion}° actual ROM)`);
			console.log(`📊 ROM Achievement: ${achievedPercentage}% of target`);
		} else {
			console.log(`📏 Achieved Range: ${testCase.angleRange.min}° - ${testCase.angleRange.max}° (${testCase.rangeOfMotion}° ROM)`);
			console.log(`ℹ️  No target angles provided - using standard feedback`);
		}
		
		const response = await fetch('http://localhost:5173/api/feedback', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(testCase)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		// Handle streaming response
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		
		let feedback = null;
		
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			
			const chunk = decoder.decode(value);
			const lines = chunk.split('\n').filter(line => line.trim());
			
			for (const line of lines) {
				try {
					const data = JSON.parse(line);
					if (data.type === 'feedback') {
						feedback = data.data;
						console.log(`💬 Feedback: "${feedback.feedback}"`);
						console.log(`⭐ Score: ${feedback.score}/100`);
						console.log(`📊 Classification: ${feedback.classification}`);
						
						// Color-code the classification
						const emoji = feedback.classification === 'good' ? '🟢' : 
									  feedback.classification === 'okay' ? '🟡' : '🔴';
						console.log(`${emoji} Overall: ${feedback.classification.toUpperCase()}`);
					}
				} catch {
					// Ignore non-JSON lines
				}
			}
		}
		
		if (!feedback) {
			console.log('❌ No feedback received');
		}
		
	} catch (error) {
		console.error('❌ Error testing feedback:', error.message);
	}
}

async function runFeedbackTests() {
	console.log('🧪 Testing Target Angle Feedback Feature\n');
	console.log('=' .repeat(80));
	
	for (const testCase of testFeedbackCases) {
		await testFeedbackWithTargetAngles(testCase);
		await new Promise(resolve => setTimeout(resolve, 1500)); // Delay between tests
	}
	
	console.log('\n' + '='.repeat(80));
	console.log('🏁 All feedback tests completed!');
	console.log('\n📋 Summary:');
	console.log('1. Test showed feedback with perfect ROM achievement');
	console.log('2. Test showed feedback with limited ROM (below target)');
	console.log('3. Test showed feedback with exceptional ROM (above target)');
	console.log('4. Test showed standard feedback without target angles');
}

// Run the tests
runFeedbackTests().catch(console.error);
