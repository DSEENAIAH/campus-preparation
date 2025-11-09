import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "ap-southeast-1",
  credentials: {
  // credentials must come from environment variables. Replace locally via .env (not committed).
  accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
  secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || 'REDACTED_AWS_SECRET'
  }
});

const docClient = DynamoDBDocumentClient.from(client);

async function addColleges() {
  const colleges = [
    {
      id: "anna-university",
      name: "Anna University",
      code: "ANNA-UNI",
      location: "Chennai, Tamil Nadu",
      status: "active"
    },
    {
      id: "mit-chennai",
      name: "MIT Chennai",
      code: "MIT-CHN",
      location: "Chennai, Tamil Nadu",
      status: "active"
    },
    {
      id: "srm-institute",
      name: "SRM Institute",
      code: "SRM-INST",
      location: "Chennai, Tamil Nadu",
      status: "active"
    },
    {
      id: "vit-vellore",
      name: "VIT Vellore",
      code: "VIT-VEL",
      location: "Vellore, Tamil Nadu",
      status: "active"
    }
  ];

  console.log("Adding colleges to DynamoDB...\n");
  
  for (const college of colleges) {
    try {
      await docClient.send(new PutCommand({
        TableName: "codenvia-colleges",
        Item: college
      }));
      console.log(`✓ Added: ${college.name}`);
    } catch (error) {
      console.error(`✗ Failed to add ${college.name}:`, error.message);
    }
  }

  console.log("\nVerifying colleges in table...");
  const scanResult = await docClient.send(new ScanCommand({
    TableName: "codenvia-colleges"
  }));
  
  console.log(`\nTotal colleges in table: ${scanResult.Items.length}`);
  scanResult.Items.forEach(c => {
    console.log(`  - ${c.name} (${c.code}) - ${c.status}`);
  });
}

addColleges().catch(console.error);
