# AWS Services Deployment Script for Codenvia Exam Platform
# This script creates all required AWS services for your React examination application

Write-Host "Starting AWS Services Deployment for Codenvia Exam Platform" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green

# Set variables
$REGION = "us-east-1"
$PROJECT_NAME = "codenvia-exam"
$USER_POOL_NAME = "codenvia-users"
$APP_CLIENT_NAME = "codenvia-web-client"

Write-Host "Deploying to region: $REGION" -ForegroundColor Yellow

# 1. Create Cognito User Pool
Write-Host "`nCreating Cognito User Pool..." -ForegroundColor Cyan

$userPoolId = aws cognito-idp create-user-pool `
    --pool-name $USER_POOL_NAME `
    --region $REGION `
    --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" `
    --auto-verified-attributes email `
    --username-attributes email `
    --query 'UserPool.Id' `
    --output text

if ($userPoolId) {
    Write-Host "User Pool created successfully: $userPoolId" -ForegroundColor Green
} else {
    Write-Host "Failed to create User Pool" -ForegroundColor Red
    exit 1
}

# 2. Create Cognito App Client
Write-Host "`nCreating Cognito App Client..." -ForegroundColor Cyan

$clientId = aws cognito-idp create-user-pool-client `
    --user-pool-id $userPoolId `
    --client-name $APP_CLIENT_NAME `
    --region $REGION `
    --explicit-auth-flows ADMIN_NO_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH `
    --generate-secret $false `
    --query 'UserPoolClient.ClientId' `
    --output text

if ($clientId) {
    Write-Host "App Client created successfully: $clientId" -ForegroundColor Green
} else {
    Write-Host "Failed to create App Client" -ForegroundColor Red
    exit 1
}

# 3. Create DynamoDB Tables
Write-Host "`nCreating DynamoDB Tables..." -ForegroundColor Cyan

# Users Table
Write-Host "Creating Users table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name "$PROJECT_NAME-users" `
    --region $REGION `
    --attribute-definitions AttributeName=email,AttributeType=S `
    --key-schema AttributeName=email,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --tags Key=Project,Value=$PROJECT_NAME Key=Environment,Value=production

# Tests Table
Write-Host "Creating Tests table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name "$PROJECT_NAME-tests" `
    --region $REGION `
    --attribute-definitions AttributeName=id,AttributeType=S `
    --key-schema AttributeName=id,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --tags Key=Project,Value=$PROJECT_NAME Key=Environment,Value=production

# Test Results Table
Write-Host "Creating Test Results table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name "$PROJECT_NAME-test-results" `
    --region $REGION `
    --attribute-definitions AttributeName=id,AttributeType=S AttributeName=studentEmail,AttributeType=S `
    --key-schema AttributeName=id,KeyType=HASH `
    --global-secondary-indexes IndexName=StudentEmailIndex,KeySchema='[{AttributeName=studentEmail,KeyType=HASH}]',Projection='{ProjectionType=ALL}',ProvisionedThroughput='{ReadCapacityUnits=5,WriteCapacityUnits=5}' `
    --billing-mode PAY_PER_REQUEST `
    --tags Key=Project,Value=$PROJECT_NAME Key=Environment,Value=production

# Exam Progress Table
Write-Host "Creating Exam Progress table..." -ForegroundColor Yellow
aws dynamodb create-table `
    --table-name "$PROJECT_NAME-exam-progress" `
    --region $REGION `
    --attribute-definitions AttributeName=id,AttributeType=S `
    --key-schema AttributeName=id,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --tags Key=Project,Value=$PROJECT_NAME Key=Environment,Value=production

Write-Host "Waiting for tables to be created..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 4. Create IAM Policy for DynamoDB and Cognito
Write-Host "`nCreating IAM Policy..." -ForegroundColor Cyan

$policyDocument = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:PutItem",
                "dynamodb:GetItem",
                "dynamodb:UpdateItem",
                "dynamodb:DeleteItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:$REGION:*:table/$PROJECT_NAME-users",
                "arn:aws:dynamodb:$REGION:*:table/$PROJECT_NAME-tests", 
                "arn:aws:dynamodb:$REGION:*:table/$PROJECT_NAME-test-results",
                "arn:aws:dynamodb:$REGION:*:table/$PROJECT_NAME-exam-progress",
                "arn:aws:dynamodb:$REGION:*:table/$PROJECT_NAME-test-results/index/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "cognito-idp:InitiateAuth",
                "cognito-idp:SignUp",
                "cognito-idp:ConfirmSignUp",
                "cognito-idp:AdminGetUser"
            ],
            "Resource": "arn:aws:cognito-idp:$REGION:*:userpool/$userPoolId"
        }
    ]
}
"@

$policyDocument | Out-File -FilePath "codenvia-policy.json" -Encoding UTF8

$policyArn = aws iam create-policy `
    --policy-name "codenvia-exam-policy" `
    --policy-document file://codenvia-policy.json `
    --description "Policy for Codenvia Exam Platform" `
    --query 'Policy.Arn' `
    --output text

if ($policyArn) {
    Write-Host "IAM Policy created successfully: $policyArn" -ForegroundColor Green
} else {
    Write-Host "Policy might already exist or there was an issue" -ForegroundColor Yellow
}

# 5. Create IAM User for the application
Write-Host "`nCreating IAM User..." -ForegroundColor Cyan

$userName = "codenvia-exam-user"
aws iam create-user --user-name $userName

# Attach policy to user
if ($policyArn) {
    aws iam attach-user-policy --user-name $userName --policy-arn $policyArn
}

# Create access keys
Write-Host "Creating access keys..." -ForegroundColor Yellow
$accessKeys = aws iam create-access-key --user-name $userName --output json | ConvertFrom-Json

if ($accessKeys) {
    $accessKeyId = $accessKeys.AccessKey.AccessKeyId
    $secretAccessKey = $accessKeys.AccessKey.SecretAccessKey
    Write-Host "Access keys created successfully" -ForegroundColor Green
} else {
    Write-Host "Failed to create access keys" -ForegroundColor Red
}

# 6. Create admin user in Cognito
Write-Host "`nCreating admin user in Cognito..." -ForegroundColor Cyan

$adminEmail = "admin@codenvia.com"
$tempPassword = "TempPass123!"

aws cognito-idp admin-create-user `
    --user-pool-id $userPoolId `
    --username $adminEmail `
    --user-attributes Name=email,Value=$adminEmail Name=email_verified,Value=true `
    --temporary-password $tempPassword `
    --message-action SUPPRESS `
    --region $REGION

# Set permanent password
aws cognito-idp admin-set-user-password `
    --user-pool-id $userPoolId `
    --username $adminEmail `
    --password "Admin123!" `
    --permanent `
    --region $REGION

Write-Host "Admin user created with email: $adminEmail and password: Admin123!" -ForegroundColor Green

# 7. Create S3 bucket for static hosting
Write-Host "`nCreating S3 bucket for static hosting..." -ForegroundColor Cyan

$bucketName = "$PROJECT_NAME-frontend-$(Get-Random -Minimum 1000 -Maximum 9999)"

aws s3 mb s3://$bucketName --region $REGION

# Configure bucket for static website hosting
aws s3 website s3://$bucketName --index-document index.html --error-document index.html

# Set bucket policy for public read access
$bucketPolicy = @"
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::$bucketName/*"
        }
    ]
}
"@

$bucketPolicy | Out-File -FilePath "bucket-policy.json" -Encoding UTF8
aws s3api put-bucket-policy --bucket $bucketName --policy file://bucket-policy.json

Write-Host "S3 bucket created: $bucketName" -ForegroundColor Green

# 8. Generate environment file
Write-Host "`nGenerating environment configuration..." -ForegroundColor Cyan

$envContent = @"
# AWS Configuration for Codenvia Exam Platform
VITE_AWS_REGION=$REGION
VITE_AWS_ACCESS_KEY_ID=$accessKeyId
VITE_AWS_SECRET_ACCESS_KEY=$secretAccessKey
VITE_COGNITO_USER_POOL_ID=$userPoolId
VITE_COGNITO_CLIENT_ID=$clientId

# DynamoDB Table Names
VITE_DYNAMODB_USERS_TABLE=$PROJECT_NAME-users
VITE_DYNAMODB_TESTS_TABLE=$PROJECT_NAME-tests
VITE_DYNAMODB_RESULTS_TABLE=$PROJECT_NAME-test-results
VITE_DYNAMODB_PROGRESS_TABLE=$PROJECT_NAME-exam-progress

# S3 Hosting
VITE_S3_BUCKET=$bucketName
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "Environment file (.env) created successfully" -ForegroundColor Green

# 9. Summary
Write-Host "`nAWS Services Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "AWS Region: $REGION" -ForegroundColor Yellow
Write-Host "Cognito User Pool ID: $userPoolId" -ForegroundColor Yellow
Write-Host "Cognito Client ID: $clientId" -ForegroundColor Yellow
Write-Host "S3 Bucket: $bucketName" -ForegroundColor Yellow
Write-Host "Website URL: http://$bucketName.s3-website-$REGION.amazonaws.com" -ForegroundColor Yellow
Write-Host "`nAdmin Login:" -ForegroundColor Green
Write-Host "Email: admin@codenvia.com" -ForegroundColor Yellow
Write-Host "Password: Admin123!" -ForegroundColor Yellow
Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "1. Run 'npm run build' to build your React app" -ForegroundColor White
Write-Host "2. Run the deployment script to upload to S3" -ForegroundColor White
Write-Host "3. Your app will be available at the S3 website URL" -ForegroundColor White

# Cleanup temporary files
Remove-Item "codenvia-policy.json" -ErrorAction SilentlyContinue
Remove-Item "bucket-policy.json" -ErrorAction SilentlyContinue

Write-Host "`nDeployment script completed successfully!" -ForegroundColor Green