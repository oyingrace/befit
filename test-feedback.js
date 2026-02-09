// Test file to validate the AI feedback system
// Run this with: node test-feedback.js (after starting the dev server)

const testData = {
	exerciseName: "bicep curl",
	repNumber: 1,
	duration: 1200,
	angleRange: { min: 45.2, max: 135.8 },
	averageAngle: 90.5,
	rangeOfMotion: 90.6
};

fetch('http://localhost:5173/api/feedback', {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json'
	},
	body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => {
	console.log('✅ AI Feedback Response:');
	console.log(JSON.stringify(data, null, 2));
})
.catch(error => {
	console.error('❌ Test failed:', error);
});
