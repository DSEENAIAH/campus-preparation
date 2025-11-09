// Create Test Users Script for AWS Cognito and DynamoDB
import { 
  AdminCreateUserCommand, 
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient 
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// AWS Configuration
const AWS_CONFIG = {
  region: 'ap-southeast-1',
  userPoolId: 'ap-southeast-1_Azkle9209',
  clientId: '461uprbt30da8hr0c45a6ff15t',
  tables: {
    users: 'codenvia-exam-platform-users'
  }
};

// Initialize AWS clients
const cognitoClient = new CognitoIdentityProviderClient({ 
  region: AWS_CONFIG.region,
  credentials: {
  accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
    secretAccessKey: 'Wgp+Mg124ZBkgV1YHd8N7qetJ5vVVaqNaOUEMcpr'
  }
});

const dynamoClient = new DynamoDBClient({ 
  region: AWS_CONFIG.region,
  credentials: {
  accessKeyId: process.env.VITE_AWS_ACCESS_KEY_ID || 'REDACTED_AWS_ACCESS_KEY',
    secretAccessKey: 'Wgp+Mg124ZBkgV1YHd8N7qetJ5vVVaqNaOUEMcpr'
  }
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Test users to create
const testUsers = [
  {
    email: 'admin@codenvia.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
    college: 'Codenvia Admin',
    avatar: '👨💼'
  },
  {
    email: 'student@test.com',
    password: 'student123',
    name: 'Test Student',
    role: 'student',
    college: 'Test University',
    avatar: '👤'
  },
  {
    email: 'john@student.com',
    password: 'john123',
    name: 'John Doe',
    role: 'student',
    college: 'ABC University',
    avatar: '👤'
  }
];

async function createTestUsers() {
  console.log('🚀 Creating test users in AWS Cognito and DynamoDB...\n');

  for (const user of testUsers) {
    try {
      console.log(`Creating user: ${user.email}`);

      // 1. Create user in Cognito
      const createUserCommand = new AdminCreateUserCommand({
        UserPoolId: AWS_CONFIG.userPoolId,
        Username: user.email,
        UserAttributes: [
          { Name: 'email', Value: user.email },
          { Name: 'name', Value: user.name },
          { Name: 'email_verified', Value: 'true' }
        ],
        MessageAction: 'SUPPRESS', // Don't send welcome email
        TemporaryPassword: 'TempPass123!'
      });

      await cognitoClient.send(createUserCommand);
      console.log(`✅ Created Cognito user: ${user.email}`);

      // 2. Set permanent password
      const setPasswordCommand = new AdminSetUserPasswordCommand({
        UserPoolId: AWS_CONFIG.userPoolId,
        Username: user.email,
        Password: user.password,
        Permanent: true
      });

      await cognitoClient.send(setPasswordCommand);
      console.log(`✅ Set password for: ${user.email}`);

      // 3. Create user record in DynamoDB
      const userRecord = {
        email: user.email,
        name: user.name,
        role: user.role,
        college: user.college,
        branch: user.role === 'student' ? 'Computer Science' : '',
        targetCompanies: user.role === 'student' ? ['TCS', 'Infosys', 'Cognizant'] : [],
        avatar: user.avatar,
        createdAt: new Date().toISOString()
      };

      const putCommand = new PutCommand({
        TableName: AWS_CONFIG.tables.users,
        Item: userRecord
      });

      await docClient.send(putCommand);
      console.log(`✅ Created DynamoDB record for: ${user.email}`);
      console.log('---');

    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        console.log(`⚠️  User ${user.email} already exists in Cognito`);
        
        // Still try to create DynamoDB record
        try {
          const userRecord = {
            email: user.email,
            name: user.name,
            role: user.role,
            college: user.college,
            branch: user.role === 'student' ? 'Computer Science' : '',
            targetCompanies: user.role === 'student' ? ['TCS', 'Infosys', 'Cognizant'] : [],
            avatar: user.avatar,
            createdAt: new Date().toISOString()
          };

          const putCommand = new PutCommand({
            TableName: AWS_CONFIG.tables.users,
            Item: userRecord
          });

          await docClient.send(putCommand);
          console.log(`✅ Created/Updated DynamoDB record for: ${user.email}`);
        } catch (dbError) {
          console.log(`❌ DynamoDB error for ${user.email}:`, dbError.message);
        }
      } else {
        console.error(`❌ Error creating user ${user.email}:`, error.message);
      }
      console.log('---');
    }
  }

  console.log('\n🎉 Test user creation completed!');
  console.log('\n📋 Test Credentials:');
  testUsers.forEach(user => {
    console.log(`${user.role.toUpperCase()}: ${user.email} / ${user.password}`);
  });
}

// Run the script
createTestUsers().catch(console.error);