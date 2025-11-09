const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  region: "ap-southeast-1",
  credentials: {
  accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
  secretAccessKey: process.env.VITE_AWS_SECRET_ACCESS_KEY || 'REDACTED_AWS_SECRET'
  }
});

const docClient = DynamoDBDocumentClient.from(client);

async function addAdminPassword() {
  try {
    const command = new UpdateCommand({
      TableName: "codenvia-exam-platform-users",
      Key: { email: "admin@codenvia.com" },
      UpdateExpression: "SET password = :pwd, updatedAt = :updated",
      ExpressionAttributeValues: {
        ":pwd": "Admin@123",
        ":updated": new Date().toISOString()
      }
    });

    await docClient.send(command);
    console.log("✅ Admin password set to: Admin@123");
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

addAdminPassword();
