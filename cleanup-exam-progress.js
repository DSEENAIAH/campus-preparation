/**
 * One-time cleanup script to mark stale exam progress records as completed
 * Run this to clean up orphaned "active" or "in-progress" records
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));

const PROGRESS_TABLE = 'codenvia-exam-platform-progress';
const STALE_THRESHOLD_MINUTES = 30; // Consider records older than 30 minutes as stale

async function cleanupStaleProgress() {
  try {
    console.log('🔍 Scanning for stale exam progress records...');
    
    // Scan for all active or in-progress records
    const scanCommand = new ScanCommand({
      TableName: PROGRESS_TABLE,
      FilterExpression: '#status = :active OR #status = :inprogress',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { 
        ':active': 'active', 
        ':inprogress': 'in-progress' 
      }
    });
    
    const response = await client.send(scanCommand);
    const records = response.Items || [];
    
    console.log(`📊 Found ${records.length} active/in-progress records`);
    
    if (records.length === 0) {
      console.log('✅ No stale records found. All clean!');
      return;
    }
    
    // Filter stale records (not updated in last 30 minutes)
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - STALE_THRESHOLD_MINUTES * 60 * 1000);
    
    const staleRecords = records.filter(record => {
      if (!record.lastUpdated) {
        // If no lastUpdated, check startedAt
        const startedAt = record.startedAt ? new Date(record.startedAt) : null;
        return startedAt && startedAt < staleThreshold;
      }
      const lastUpdated = new Date(record.lastUpdated);
      return lastUpdated < staleThreshold;
    });
    
    console.log(`🧹 Found ${staleRecords.length} stale records to clean up`);
    
    if (staleRecords.length === 0) {
      console.log('✅ All active records are recent. No cleanup needed!');
      return;
    }
    
    // Update each stale record
    let cleaned = 0;
    for (const record of staleRecords) {
      try {
        const updateCommand = new UpdateCommand({
          TableName: PROGRESS_TABLE,
          Key: { id: record.id },
          UpdateExpression: 'SET #status = :completed, lastUpdated = :lastUpdated',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { 
            ':completed': 'completed',
            ':lastUpdated': new Date().toISOString()
          }
        });
        
        await client.send(updateCommand);
        cleaned++;
        console.log(`✓ Cleaned up: ${record.studentEmail} - ${record.testTitle} (Last updated: ${record.lastUpdated || record.startedAt})`);
      } catch (error) {
        console.error(`✗ Failed to clean up record ${record.id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Cleanup complete! Marked ${cleaned}/${staleRecords.length} stale records as completed`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupStaleProgress()
  .then(() => {
    console.log('\n🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
