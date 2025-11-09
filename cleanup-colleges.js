import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "ap-southeast-1",
  credentials: {
  accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
    secretAccessKey: "Wgp+Mg124ZBkgV1YHd8N7qetJ5vVVaqNaOUEMcpr"
  }
});

const docClient = DynamoDBDocumentClient.from(client);

async function cleanupColleges() {
  // IDs to keep (matching student colleges)
  const keepIds = ["kalasalingam", "kk"];
  
  console.log("Fetching all colleges...");
  const scanResult = await docClient.send(new ScanCommand({
    TableName: "codenvia-colleges"
  }));
  
  console.log(`\nFound ${scanResult.Items.length} colleges total`);
  console.log("\nDeleting colleges that don't match student data...\n");
  
  let deletedCount = 0;
  
  for (const college of scanResult.Items) {
    if (!keepIds.includes(college.id)) {
      try {
        await docClient.send(new DeleteCommand({
          TableName: "codenvia-colleges",
          Key: { id: college.id }
        }));
        console.log(`✓ Deleted: ${college.name} (${college.id})`);
        deletedCount++;
      } catch (error) {
        console.error(`✗ Failed to delete ${college.name}:`, error.message);
      }
    } else {
      console.log(`→ Keeping: ${college.name} (${college.id})`);
    }
  }
  
  console.log(`\n✓ Cleanup complete! Deleted ${deletedCount} colleges.`);
  console.log("→ Kept 2 colleges that match student data.");
  
  // Verify final state
  console.log("\nVerifying final state...");
  const finalScan = await docClient.send(new ScanCommand({
    TableName: "codenvia-colleges"
  }));
  
  console.log(`\nFinal colleges in table: ${finalScan.Items.length}`);
  finalScan.Items.forEach(c => {
    console.log(`  - ${c.name} (${c.code})`);
  });
}

cleanupColleges().catch(console.error);
