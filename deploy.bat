@echo off
echo Creating AWS Services for Codenvia Exam Platform

echo Step 1: Creating Cognito User Pool...
aws cognito-idp create-user-pool --pool-name codenvia-users --region us-east-1 --output table

echo.
echo Step 2: Creating App Client...
echo Please copy the User Pool ID from above and replace USER_POOL_ID in the next command:
echo aws cognito-idp create-user-pool-client --user-pool-id USER_POOL_ID --client-name codenvia-web-client --region us-east-1 --explicit-auth-flows ADMIN_NO_SRP_AUTH ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH --generate-secret false --output table

echo.
echo Step 3: Creating DynamoDB Tables...
aws dynamodb create-table --table-name codenvia-exam-users --region us-east-1 --attribute-definitions AttributeName=email,AttributeType=S --key-schema AttributeName=email,KeyType=HASH --billing-mode PAY_PER_REQUEST --output table

aws dynamodb create-table --table-name codenvia-exam-tests --region us-east-1 --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --output table

aws dynamodb create-table --table-name codenvia-exam-test-results --region us-east-1 --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --output table

aws dynamodb create-table --table-name codenvia-exam-exam-progress --region us-east-1 --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST --output table

echo.
echo Step 4: Creating IAM User...
aws iam create-user --user-name codenvia-exam-user --output table

echo.
echo Step 5: Creating IAM Policy...
echo {^
    "Version": "2012-10-17",^
    "Statement": [^
        {^
            "Effect": "Allow",^
            "Action": [^
                "dynamodb:PutItem",^
                "dynamodb:GetItem",^
                "dynamodb:UpdateItem",^
                "dynamodb:DeleteItem",^
                "dynamodb:Query",^
                "dynamodb:Scan"^
            ],^
            "Resource": [^
                "arn:aws:dynamodb:us-east-1:*:table/codenvia-exam-users",^
                "arn:aws:dynamodb:us-east-1:*:table/codenvia-exam-tests",^
                "arn:aws:dynamodb:us-east-1:*:table/codenvia-exam-test-results",^
                "arn:aws:dynamodb:us-east-1:*:table/codenvia-exam-exam-progress"^
            ]^
        },^
        {^
            "Effect": "Allow",^
            "Action": [^
                "cognito-idp:InitiateAuth",^
                "cognito-idp:SignUp",^
                "cognito-idp:ConfirmSignUp"^
            ],^
            "Resource": "*"^
        }^
    ]^
} > codenvia-policy.json

aws iam create-policy --policy-name codenvia-exam-policy --policy-document file://codenvia-policy.json --description "Policy for Codenvia Exam Platform" --output table

aws iam attach-user-policy --user-name codenvia-exam-user --policy-arn arn:aws:iam::ACCOUNT_ID:policy/codenvia-exam-policy

echo.
echo Step 6: Creating Access Keys...
aws iam create-access-key --user-name codenvia-exam-user --output table

echo.
echo AWS Services creation completed!
echo Please copy the following information:
echo 1. User Pool ID from Step 1
echo 2. Client ID from Step 2
echo 3. Access Key ID and Secret Access Key from Step 6
echo.
echo Use these values to create your .env file

pause