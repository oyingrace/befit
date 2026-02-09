// Test file to validate exercise config generation and saving
// Run this with: node test-exercise-config-save.js (after starting the dev server)

const testExercises = [
	{
		exerciseName: "bicep curl",
		exerciseDescription: "Standing with weights in hands, curl the weights up to shoulder level by flexing at the elbow"
	},
	{
		exerciseName: "squat",
		exerciseDescription: "Lower body exercise squatting down by bending knees and hips, then standing back up"
	}
];

async function testGenerateAndSave(exercise) {
	try {
		console.log(`\n🏋️ Testing: ${exercise.exerciseName}`);
		console.log(`📝 Description: ${exercise.exerciseDescription}`);
		
		// Step 1: Generate the config
		console.log('📋 Step 1: Generating exercise config...');
		const generateResponse = await fetch('http://localhost:5174/api/exercise-config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(exercise)
		});

		if (!generateResponse.ok) {
			throw new Error(`Generate failed! status: ${generateResponse.status}`);
		}

		const generateData = await generateResponse.json();
		
		if (!generateData.success) {
			throw new Error(`Generation failed: ${generateData.error}`);
		}

		console.log('✅ Config Generated Successfully!');
		console.log(`📊 Exercise Type: ${generateData.analysis.exerciseType}`);
		console.log(`💪 Primary Muscles: ${generateData.analysis.primaryMuscles.join(', ')}`);
		console.log(`🔄 Movement Pattern: ${generateData.analysis.movementPattern}`);
		console.log(`📍 Config Name: ${generateData.config.name}`);
		console.log(`🎯 Angle Configurations: ${generateData.config.anglePoints?.length || 0}`);
		
		if (generateData.config.anglePoints && generateData.config.anglePoints.length > 0) {
			console.log(`📐 Angles Tracked:`);
			generateData.config.anglePoints.forEach((angleConfig, i) => {
				console.log(`     ${i + 1}. ${angleConfig.name}: [${angleConfig.points.join(', ')}] (weight: ${angleConfig.weight || 1.0})`);
			});
		}

		// Step 2: Save the config to database
		console.log('\n💾 Step 2: Saving exercise config to database...');
		const saveResponse = await fetch('http://localhost:5174/api/exercise-configs', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				name: generateData.config.name,
				displayName: generateData.exerciseName,
				description: exercise.exerciseDescription,
				exerciseType: generateData.analysis.exerciseType,
				primaryMuscles: generateData.analysis.primaryMuscles,
				movementPattern: generateData.analysis.movementPattern,
				keyJoints: generateData.analysis.keyJoints,
				movementDirection: generateData.analysis.movementDirection,
				config: generateData.config,
				generatedBy: 'AI'
			})
		});

		if (!saveResponse.ok) {
			const errorData = await saveResponse.json();
			throw new Error(`Save failed! status: ${saveResponse.status}, error: ${errorData.error}`);
		}

		const saveData = await saveResponse.json();
		
		if (!saveData.success) {
			throw new Error(`Save failed: ${saveData.error}`);
		}

		console.log('✅ Config Saved Successfully!');
		console.log(`🆔 Saved Config ID: ${saveData.config.id}`);
		console.log(`📅 Created At: ${saveData.config.createdAt}`);

		// Step 3: Verify it was saved by fetching all configs
		console.log('\n🔍 Step 3: Verifying config was saved...');
		const fetchResponse = await fetch('http://localhost:5174/api/exercise-configs');
		
		if (!fetchResponse.ok) {
			throw new Error(`Fetch failed! status: ${fetchResponse.status}`);
		}

		const fetchData = await fetchResponse.json();
		const savedConfig = fetchData.configs.find(config => config.id === saveData.config.id);
		
		if (savedConfig) {
			console.log('✅ Config verified in database!');
			console.log(`📋 Found config: ${savedConfig.displayName} (${savedConfig.name})`);
		} else {
			console.log('❌ Config not found in database!');
		}

		return {
			generated: generateData,
			saved: saveData,
			verified: !!savedConfig
		};

	} catch (error) {
		console.error('❌ Test failed:', error.message);
		return null;
	}
}

async function testAutoSave(exercise) {
	try {
		console.log(`\n🏋️ Testing Auto-Save: ${exercise.exerciseName}`);
		
		// Test the auto-save functionality
		const response = await fetch('http://localhost:5174/api/exercise-config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				...exercise,
				autoSave: true
			})
		});

		if (!response.ok) {
			throw new Error(`Auto-save test failed! status: ${response.status}`);
		}

		const data = await response.json();
		
		if (data.success) {
			console.log('✅ Config Generated with Auto-Save!');
			console.log(`💾 Auto-Saved: ${data.saved ? 'Yes' : 'No'}`);
			if (data.saved && data.savedConfig) {
				console.log(`🆔 Saved Config ID: ${data.savedConfig.id}`);
			}
		}

		return data;

	} catch (error) {
		console.error('❌ Auto-save test failed:', error.message);
		return null;
	}
}

async function runAllTests() {
	console.log('🚀 Starting Exercise Config Generation and Save Tests...\n');
	
	for (let i = 0; i < testExercises.length; i++) {
		const exercise = testExercises[i];
		
		// Test manual save process
		const result = await testGenerateAndSave(exercise);
		
		if (result && result.verified) {
			console.log(`✅ Test ${i + 1} PASSED: ${exercise.exerciseName}`);
		} else {
			console.log(`❌ Test ${i + 1} FAILED: ${exercise.exerciseName}`);
		}
		
		// Add delay between tests
		if (i < testExercises.length - 1) {
			console.log('\n⏱️ Waiting 2 seconds before next test...');
			await new Promise(resolve => setTimeout(resolve, 2000));
		}
	}

	// Test auto-save functionality
	console.log('\n\n🔄 Testing Auto-Save Functionality...');
	const autoSaveResult = await testAutoSave({
		exerciseName: "push up",
		exerciseDescription: "Classic bodyweight exercise lowering and raising body using arm strength"
	});

	console.log('\n🏁 All tests completed!');
	
	// Summary
	console.log('\n📊 Test Summary:');
	console.log('- Exercise config generation: Tested');
	console.log('- Manual save to database: Tested');
	console.log('- Database verification: Tested');
	console.log('- Auto-save functionality: Tested');
}

// Run the tests
runAllTests().catch(console.error);
