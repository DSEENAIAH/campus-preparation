import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "ap-southeast-1",
  credentials: {
  accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
    secretAccessKey: "Wgp+Mg124ZBkgV1YHd8N7qetJ5vVVaqNaOUEMcpr"
  }
});

const docClient = DynamoDBDocumentClient.from(client);

async function checkData() {
  console.log("Fetching students...");
  const studentsResult = await docClient.send(new ScanCommand({
    TableName: "codenvia-exam-platform-users",
    FilterExpression: "#role = :role",
    ExpressionAttributeNames: { "#role": "role" },
    ExpressionAttributeValues: { ":role": "student" }
  }));
  
  console.log(`\nFound ${studentsResult.Items.length} students:`);
  studentsResult.Items.forEach(s => {
    console.log(`  - ${s.name} (${s.email}) - College: "${s.college || 'NOT SET'}"`);
  });

  console.log("\n" + "=".repeat(60));
  console.log("Fetching colleges...");
  const collegesResult = await docClient.send(new ScanCommand({
    TableName: "codenvia-colleges"
  }));
  
  console.log(`\nFound ${collegesResult.Items.length} colleges:`);
  collegesResult.Items.forEach(c => {
    console.log(`  - ${c.name} (${c.code})`);
  });
  
  console.log("\n" + "=".repeat(60));
  console.log("Matching students to colleges...\n");
  
  const collegeNames = collegesResult.Items.map(c => c.name.toLowerCase());
  studentsResult.Items.forEach(s => {
    const studentCollege = (s.college || "").toLowerCase();
    const match = collegeNames.find(cn => cn.includes(studentCollege) || studentCollege.includes(cn));
    console.log(`${s.name}: "${s.college || 'none'}" -> ${match ? '✓ MATCH' : '✗ NO MATCH'}`);
  });
}

checkData().catch(console.error);
