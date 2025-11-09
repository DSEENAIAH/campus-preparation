@echo off
echo Fixing AWS IAM Permissions for DynamoDB Query operations...

aws iam put-user-policy ^
  --user-name codenvia-exam-user ^
  --policy-name CodenviaDynamoDBFullAccess ^
  --policy-document file://updated-iam-policy.json

if %errorlevel% == 0 (
    echo ✅ IAM policy updated successfully!
    echo ✅ DynamoDB Query permissions granted for indexes
    echo ✅ Student exam workflow should now work properly
) else (
    echo ❌ Failed to update IAM policy
    echo Please run this command manually or use AWS Console
)

pause