@echo off
echo Checking students table for college names...
aws dynamodb scan --table-name codenvia-users --region ap-southeast-1 --filter-expression "role = :role" --expression-attribute-values "{\":role\":{\"S\":\"student\"}}" > students-output.json 2>&1
type students-output.json
del students-output.json
