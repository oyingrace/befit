// Test file to validate the dynamic exercise config generation system
// Run this with: node test-exercise-config.js (after starting the dev server)

const testExercises = [
	{
		exerciseName: "shoulder press",
		exerciseDescription: "Standing with weights overhead, press the weights up from shoulder level to full extension above the head"
	},
	{
		exerciseName: "lateral raise",
		exerciseDescription: "Standing with weights at sides, raise arms out to the sides until parallel with the ground"
	},
	{
		exerciseName: "deadlift", 
		exerciseDescription: "Lifting a barbell from the ground to hip level by bending at the hips and knees"
	},
	{
		exerciseName: "jumping jacks",
		exerciseDescription: "Full body cardio exercise jumping feet apart while raising arms overhead"
	},
	{
		exerciseName: "plank",
		exerciseDescription: "Isometric core exercise holding body in straight line supported by forearms and toes"
	}
];

async function testExerciseConfig(exercise) {
	try {
		console.log(`\n🏋️ Testing: ${exercise.exerciseName}`);
		console.log(`📝 Description: ${exercise.exerciseDescription}`);
		
		const response = await fetch('http://localhost:5173/api/exercise-config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(exercise)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		
		if (data.success) {
			console.log('✅ Config Generated Successfully!');
			console.log(`📊 Exercise Type: ${data.analysis.exerciseType}`);
			console.log(`💪 Primary Muscles: ${data.analysis.primaryMuscles.join(', ')}`);
			console.log(`🔄 Movement Pattern: ${data.analysis.movementPattern}`);
			console.log(`⚙️ Config Details:`);
			console.log(`   - Initial Direction: ${data.config.initialDirection}`);
			console.log(`   - Min Peak Distance: ${data.config.minPeakDistance}`);
			console.log(`   - Signal Inverted: ${data.config.inverted || false}`);
			
			if (data.config.anglePoints && data.config.anglePoints.length > 0) {
				console.log(`   - Angle Configurations:`);
				data.config.anglePoints.forEach((angleConfig, i) => {
					console.log(`     ${i + 1}. ${angleConfig.name}: [${angleConfig.points.join(', ')}] (weight: ${angleConfig.weight || 1.0})`);
				});
			}
		} else {
			console.log('❌ Config Generation Failed:', data.error);
		}
		
	} catch (error) {
		console.error('❌ Test failed for', exercise.exerciseName, ':', error.message);
	}
}

async function runAllTests() {
	console.log('🚀 Starting Exercise Config Generation Tests...\n');
	
	for (const exercise of testExercises) {
		await testExerciseConfig(exercise);
		// Small delay between requests to be nice to the API
		await new Promise(resolve => setTimeout(resolve, 1000));
	}
	
	console.log('\n🎉 All tests completed!');
}

runAllTests();
