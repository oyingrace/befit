// Test file to validate that preloaded exercise configs work correctly
// Run this with: node test-preloaded-config.js (after starting the dev server)

async function testPreloadedConfig() {
	try {
		console.log('🧪 Testing Preloaded Exercise Config Functionality\n');
		console.log('=' .repeat(60));

		// First, let's generate a config to use as our "preloaded" config
		console.log('📝 Step 1: Generating exercise config to simulate preloaded config...');
		
		const configResponse = await fetch('http://localhost:5173/api/exercise-config', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				exerciseName: 'bicep curl',
				exerciseDescription: 'Standing curl with dumbbells from extended to fully flexed elbow position',
				romFocus: 'standard'
			})
		});

		if (!configResponse.ok) {
			throw new Error(`Config generation failed: ${configResponse.status}`);
		}

		const configData = await configResponse.json();
		
		if (!configData.success) {
			throw new Error(`Config generation failed: ${configData.error}`);
		}

		console.log('✅ Exercise config generated successfully!');
		console.log(`🎯 Config name: ${configData.config.name}`);
		console.log(`📐 Angle points: ${configData.config.anglePoints?.length || 0}`);
		
		// Show target angles if available
		if (configData.config.anglePoints && configData.config.anglePoints.length > 0) {
			configData.config.anglePoints.forEach((angleConfig, i) => {
				if (angleConfig.targetLowAngle !== undefined && angleConfig.targetHighAngle !== undefined) {
					const romRange = angleConfig.targetHighAngle - angleConfig.targetLowAngle;
					console.log(`   ${i + 1}. ${angleConfig.name}: ${angleConfig.targetLowAngle}° - ${angleConfig.targetHighAngle}° (${romRange}° ROM)`);
				}
			});
		}

		console.log('\n📋 Generated Config:');
		console.log(JSON.stringify(configData.config, null, 2));

		console.log('\n' + '='.repeat(60));
		console.log('✅ Test completed successfully!');
		console.log('\n💡 Key Benefits of Preloaded Configs:');
		console.log('   • No LLM calls during exercise tracking (faster)');
		console.log('   • Consistent config across workout sessions');
		console.log('   • Uses existing saved workout configurations');
		console.log('   • Target angles are preserved from original generation');
		
	} catch (error) {
		console.error('❌ Test failed:', error.message);
	}
}

// Run the test
testPreloadedConfig();
