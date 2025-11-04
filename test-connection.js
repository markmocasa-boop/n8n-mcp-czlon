// Quick test script to connect to n8n and list workflows
const fs = require('fs');
const path = require('path');

// Load .env file manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#][^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

const { N8nApiClient } = require('./dist/services/n8n-api-client');

async function testConnection() {
  console.log('🔌 Connecting to n8n instance...');
  console.log(`   URL: ${process.env.N8N_API_URL}`);

  try {
    const client = new N8nApiClient({
      baseUrl: process.env.N8N_API_URL,
      apiKey: process.env.N8N_API_KEY,
      timeout: parseInt(process.env.N8N_API_TIMEOUT) || 30000,
      maxRetries: parseInt(process.env.N8N_API_MAX_RETRIES) || 3,
    });

    // Test health check
    console.log('\n🏥 Testing health check...');
    const health = await client.healthCheck();
    console.log(`   Status: ${health.status}`);

    // List workflows
    console.log('\n📋 Fetching workflows...');
    const workflows = await client.listWorkflows({ limit: 10 });

    console.log(`\n✅ Found ${workflows.data.length} workflows (total: ${workflows.total || workflows.data.length})`);

    if (workflows.data.length > 0) {
      console.log('\n📊 Your workflows:');
      workflows.data.forEach((wf, idx) => {
        console.log(`   ${idx + 1}. ${wf.name} (ID: ${wf.id})`);
        console.log(`      Active: ${wf.active ? '✅' : '❌'} | Nodes: ${wf.nodes?.length || 'N/A'}`);
      });
    } else {
      console.log('   No workflows found in your instance.');
    }

    console.log('\n🎉 Connection successful! Ready to manage workflows.');

  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Details:', error.response.data);
    }
    process.exit(1);
  }
}

testConnection();
