@echo off
echo Adding sample colleges to DynamoDB...

echo Adding MIT Engineering College...
aws dynamodb put-item --table-name codenvia-colleges --region ap-southeast-1 --item "{\"id\":{\"S\":\"mit-eng-001\"},\"name\":{\"S\":\"MIT Engineering College\"},\"code\":{\"S\":\"MIT-ENG-001\"},\"location\":{\"S\":\"Chennai, Tamil Nadu\"},\"status\":{\"S\":\"active\"}}"

echo Adding Stanford University...
aws dynamodb put-item --table-name codenvia-colleges --region ap-southeast-1 --item "{\"id\":{\"S\":\"stanford-uni-001\"},\"name\":{\"S\":\"Stanford University\"},\"code\":{\"S\":\"STANFORD-UNI-001\"},\"location\":{\"S\":\"Stanford, CA\"},\"status\":{\"S\":\"active\"}}"

echo.
echo Done! Verifying...
aws dynamodb scan --table-name codenvia-colleges --region ap-southeast-1 --query "Items[*].[name.S,code.S,location.S]" --output table

echo.
echo Sample colleges added. The UI should update within 10 seconds.
