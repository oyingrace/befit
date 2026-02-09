// Test file to validate the target angle functionality
// Run this with: node test-target-angles.js (after starting the dev server)

const testCases = [
	{
		exerciseName: "bicep curl",
		exerciseDescription: "Standing curl with dumbbells from extended to fully flexed elbow position",
		romFocus: "standard"
	},
	{
		exerciseName: "bicep curl",
		exerciseDescription: "Standing curl with dumbbells from extended to fully flexed elbow position", 
		romFocus: "low"
	},
	{
		exerciseName: "bicep curl",
		exerciseDescription: "Standing curl with dumbbells from extended to fully flexed elbow position",
		romFocus: "high"
	},
	{
		exerciseName: "shoulder press",
		exerciseDescription: "Standing overhead press from shoulder level to full extension",
		romFocus: "maximum"
	}
];

async function testTargetAngles(testCase) {
	try {
		console.log(`\n🏋️ Testing: ${testCase.exerciseName} (ROM Focus: ${testCase.romFocus})`);
		
		const response = await fetch('http://localhost:5173/api/exercise-config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(testCase)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		
		if (data.success) {
			console.log('✅ Config Generated Successfully!');
			console.log(`🎯 Angle Configurations: ${data.config.anglePoints?.length || 0}`);
			
			if (data.config.anglePoints && data.config.anglePoints.length > 0) {
				console.log('📐 Target Angle Details:');
				data.config.anglePoints.forEach((angleConfig, i) => {
					console.log(`  ${i + 1}. ${angleConfig.name}:`);
					console.log(`     Points: [${angleConfig.points.join(', ')}]`);
					if (angleConfig.targetLowAngle !== undefined && angleConfig.targetHighAngle !== undefined) {
						const romRange = angleConfig.targetHighAngle - angleConfig.targetLowAngle;
						console.log(`     🎯 Target Range: ${angleConfig.targetLowAngle}° - ${angleConfig.targetHighAngle}° (${romRange}° ROM)`);
					} else {
						console.log('     ⚠️  No target angles defined');
					}
					if (angleConfig.weight !== undefined) {
						console.log(`     ⚖️  Weight: ${angleConfig.weight}`);
					}
				});
			}
			
			console.log('\n📋 Full Config:');
			console.log(JSON.stringify(data.config, null, 2));
			
		} else {
			console.log('❌ Failed to generate config:', data.error);
		}
		
	} catch (error) {
		console.error('❌ Error testing exercise config:', error.message);
	}
}

async function runAllTests() {
	console.log('🧪 Testing Target Angles Feature\n');
	console.log('=' .repeat(60));
	
	for (const testCase of testCases) {
		await testTargetAngles(testCase);
		await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between tests
	}
	
	console.log('\n' + '='.repeat(60));
	console.log('🏁 All tests completed!');
}

// Run the tests
runAllTests().catch(console.error);
