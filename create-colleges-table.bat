@echo off
echo Creating DynamoDB Colleges table...

aws dynamodb create-table ^
  --table-name codenvia-colleges ^
  --attribute-definitions AttributeName=id,AttributeType=S ^
  --key-schema AttributeName=id,KeyType=HASH ^
  --billing-mode PAY_PER_REQUEST ^
  --region ap-southeast-1

if %ERRORLEVEL% EQU 0 (
  echo Table creation initiated. Waiting for table to be active...
  aws dynamodb wait table-exists --table-name codenvia-colleges --region ap-southeast-1
  
  if %ERRORLEVEL% EQU 0 (
    echo Table is now active! Adding sample colleges...
    
    aws dynamodb put-item ^
      --table-name codenvia-colleges ^
      --region ap-southeast-1 ^
      --item "{\"id\":{\"S\":\"mit-eng-001\"},\"name\":{\"S\":\"MIT Engineering College\"},\"code\":{\"S\":\"MIT-ENG-001\"},\"location\":{\"S\":\"Chennai, Tamil Nadu\"},\"status\":{\"S\":\"active\"},\"createdAt\":{\"S\":\"%date% %time%\"}}"
    
    aws dynamodb put-item ^
      --table-name codenvia-colleges ^
      --region ap-southeast-1 ^
      --item "{\"id\":{\"S\":\"stanford-uni-001\"},\"name\":{\"S\":\"Stanford University\"},\"code\":{\"S\":\"STANFORD-UNI-001\"},\"location\":{\"S\":\"Stanford, CA\"},\"status\":{\"S\":\"active\"},\"createdAt\":{\"S\":\"%date% %time%\"}}"
    
    echo Done! Two sample colleges added.
  ) else (
    echo Table wait failed. Check AWS Console.
  )
) else (
  echo Table creation failed or table already exists. Checking...
  aws dynamodb describe-table --table-name codenvia-colleges --region ap-southeast-1 >nul 2>&1
  if %ERRORLEVEL% EQU 0 (
    echo Table already exists!
  ) else (
    echo Table creation failed. Check your AWS credentials and permissions.
  )
)
