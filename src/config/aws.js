import { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand, ConfirmSignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

// AWS Configuration
const AWS_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX',
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'XXXXXXXXXXXXXXXXXXXXXXXXXX',
  // DynamoDB Table Names
  tables: {
    users: import.meta.env.VITE_DYNAMODB_USERS_TABLE || 'codenvia-users',
    tests: import.meta.env.VITE_DYNAMODB_TESTS_TABLE || 'codenvia-tests',
    results: import.meta.env.VITE_DYNAMODB_RESULTS_TABLE || 'codenvia-test-results',
    progress: import.meta.env.VITE_DYNAMODB_PROGRESS_TABLE || 'codenvia-exam-progress',
    schedules: import.meta.env.VITE_DYNAMODB_SCHEDULES_TABLE || 'codenvia-exam-platform-schedules',
    reassignments: import.meta.env.VITE_DYNAMODB_REASSIGNMENTS_TABLE || 'codenvia-exam-platform-reassignments',
    assignments: import.meta.env.VITE_DYNAMODB_ASSIGNMENTS_TABLE || 'codenvia-exam-platform-assignments',
    notifications: import.meta.env.VITE_DYNAMODB_NOTIFICATIONS_TABLE || 'codenvia-exam-platform-notifications',
    colleges: import.meta.env.VITE_DYNAMODB_COLLEGES_TABLE || 'codenvia-colleges'
  }
};

// Initialize AWS clients with secure configuration
// WARNING: Never use explicit credentials in production!
// Use IAM roles, Cognito Identity Pools, or AWS SDK credential chain instead
const getCredentials = () => {
  // In production, this should use IAM roles or Cognito Identity Pools
  const accessKey = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
  const secretKey = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
  
  if (!accessKey || !secretKey || 
      accessKey === 'YOUR_ACCESS_KEY' || 
      secretKey === 'YOUR_SECRET_KEY') {
    console.warn('⚠️  AWS credentials not configured properly. Using anonymous access.');
    return undefined; // Let SDK handle credential chain
  }
  
  return {
    accessKeyId: accessKey,
    secretAccessKey: secretKey
  };
};

const cognitoClient = new CognitoIdentityProviderClient({ 
  region: AWS_CONFIG.region,
  credentials: getCredentials()
});

const dynamoClient = new DynamoDBClient({ 
  region: AWS_CONFIG.region,
  credentials: getCredentials()
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);

export { cognitoClient, docClient, AWS_CONFIG };