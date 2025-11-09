# Simple AWS Deployment Script
Write-Host "Creating AWS Services for Codenvia Exam Platform" -ForegroundColor Green

# Step 1: Create User Pool
Write-Host "Step 1: Creating Cognito User Pool..." -ForegroundColor Cyan
aws cognito-idp create-user-pool --pool-name codenvia-users --region us-east-1

Write-Host "Step 1 completed. Please check the output above for User Pool ID" -ForegroundColor Green

# Step 2: Create DynamoDB Tables
Write-Host "Step 2: Creating DynamoDB Tables..." -ForegroundColor Cyan

Write-Host "Creating Users table..." -ForegroundColor Yellow
aws dynamodb create-table --table-name codenvia-exam-users --region us-east-1 --attribute-definitions AttributeName=email,AttributeType=S --key-schema AttributeName=email,KeyType=HASH --billing-mode PAY_PER_REQUEST

Write-Host "Creating Tests table..." -ForegroundColor Yellow
aws dynamodb create-table --table-name codenvia-exam-tests --region us-east-1 --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST

Write-Host "Creating Test Results table..." -ForegroundColor Yellow
aws dynamodb create-table --table-name codenvia-exam-test-results --region us-east-1 --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST

Write-Host "Creating Exam Progress table..." -ForegroundColor Yellow
aws dynamodb create-table --table-name codenvia-exam-exam-progress --region us-east-1 --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST

Write-Host "Step 2 completed. DynamoDB tables created." -ForegroundColor Green

# Step 3: Create S3 Bucket
Write-Host "Step 3: Creating S3 Bucket..." -ForegroundColor Cyan
$bucketName = "codenvia-exam-frontend-$(Get-Random -Minimum 1000 -Maximum 9999)"
aws s3 mb s3://$bucketName --region us-east-1

Write-Host "Step 3 completed. S3 bucket created: $bucketName" -ForegroundColor Green

Write-Host "`nBasic AWS services created successfully!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Get the User Pool ID from step 1 output" -ForegroundColor White
Write-Host "2. Create an App Client for the User Pool" -ForegroundColor White
Write-Host "3. Create IAM user and access keys" -ForegroundColor White
Write-Host "4. Configure your .env file" -ForegroundColor White
Write-Host "5. Build and deploy your React app" -ForegroundColor White