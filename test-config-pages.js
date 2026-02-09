// Quick test to check if the individual config page is working
console.log('Testing individual config page...');

const configId = 'cmc6px5in000fhg0uhz68hmda';

fetch(`http://localhost:5174/api/exercise-configs/${configId}`)
    .then(response => response.json())
    .then(data => {
        console.log('✅ Individual config API response:', data);
        if (data.config) {
            console.log(`📋 Config Name: ${data.config.displayName}`);
            console.log(`🆔 Config ID: ${data.config.id}`);
            console.log(`📊 Exercise Type: ${data.config.exerciseType}`);
        }
    })
    .catch(error => {
        console.error('❌ Error fetching config:', error);
    });

// Also test the main configs page
fetch('http://localhost:5174/api/exercise-configs')
    .then(response => response.json())
    .then(data => {
        console.log('✅ All configs API response count:', data.configs?.length || 0);
        if (data.configs && data.configs.length > 0) {
            console.log('📋 First config:', data.configs[0].displayName);
        }
    })
    .catch(error => {
        console.error('❌ Error fetching all configs:', error);
    });
