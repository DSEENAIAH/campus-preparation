const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// Initialize AWS DynamoDB client
const client = new DynamoDBClient({ 
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "your-access-key",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "your-secret-key"
  }
});
const docClient = DynamoDBDocumentClient.from(client);

async function testProgressTable() {
  try {
    console.log("🔍 Scanning progress table...");
    
    const command = new ScanCommand({
      TableName: "codenvia-exam-progress",
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": "in-progress" }
    });
    
    const result = await docClient.send(command);
    console.log("📊 Found", result.Items?.length || 0, "in-progress exams");
    
    if (result.Items && result.Items.length > 0) {
      result.Items.forEach((item, index) => {
        console.log(`\n📝 Record ${index + 1}:`);
        console.log("   Student:", item.studentName, `(${item.studentEmail})`);
        console.log("   Test:", item.testTitle);
        console.log("   Current Module:", item.currentQuestion?.moduleKey || "unknown");
        console.log("   Current Question:", item.currentQuestion?.questionIndex || "unknown");
        console.log("   Progress:", item.overallProgress || 0, "%");
        console.log("   Last Updated:", item.lastUpdated);
      });
    } else {
      console.log("❌ No in-progress exams found");
    }
    
  } catch (error) {
    console.error("❌ Error testing progress table:", error);
  }
}

testProgressTable();