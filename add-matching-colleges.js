import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "ap-southeast-1",
  credentials: {
  accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
    secretAccessKey: "Wgp+Mg124ZBkgV1YHd8N7qetJ5vVVaqNaOUEMcpr"
  }
});

const docClient = DynamoDBDocumentClient.from(client);

async function addMatchingColleges() {
  const colleges = [
    {
      id: "kalasalingam",
      name: "Kalasalingam",
      code: "KALASALINGAM",
      location: "Krishnankoil, Tamil Nadu",
      status: "active"
    },
    {
      id: "kk",
      name: "KK",
      code: "KK",
      location: "Unknown",
      status: "active"
    }
  ];

  console.log("Adding colleges that match student data...\n");
  
  for (const college of colleges) {
    try {
      await docClient.send(new PutCommand({
        TableName: "codenvia-colleges",
        Item: college
      }));
      console.log(`✓ Added: ${college.name} (${college.code})`);
    } catch (error) {
      console.error(`✗ Failed to add ${college.name}:`, error.message);
    }
  }

  console.log("\nDone! The UI should update within 10 seconds with real student counts.");
}

addMatchingColleges().catch(console.error);
