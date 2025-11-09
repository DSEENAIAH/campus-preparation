// Test AWS Connection Script
import { cognitoClient, docClient, AWS_CONFIG } from './src/config/aws.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';

async function testAWSConnection() {
  console.log('Testing AWS Connection...');
  console.log('AWS Config:', AWS_CONFIG);
  
  try {
    // Test DynamoDB connection
    console.log('\n1. Testing DynamoDB connection...');
    const command = new ScanCommand({
      TableName: AWS_CONFIG.tables.users,
      Limit: 1
    });
    
    const result = await docClient.send(command);
    console.log('✅ DynamoDB connection successful');
    console.log('Users table scan result:', result.Items?.length || 0, 'items');
    
    // Test other tables
    const tables = ['tests', 'results', 'progress'];
    for (const table of tables) {
      try {
        const testCommand = new ScanCommand({
          TableName: AWS_CONFIG.tables[table],
          Limit: 1
        });
        const testResult = await docClient.send(testCommand);
        console.log(`✅ ${table} table accessible:`, testResult.Items?.length || 0, 'items');
      } catch (error) {
        console.log(`❌ ${table} table error:`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ AWS connection failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.$metadata?.httpStatusCode
    });
  }
}

// Run the test
testAWSConnection();