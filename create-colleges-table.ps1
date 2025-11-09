# Create the Colleges DynamoDB table in ap-southeast-1
# Usage:
#   - Ensure AWS CLI is installed and configured with credentials that can manage DynamoDB
#   - If your table name differs, pass -TableName <name>
#   - Example: ./create-colleges-table.ps1 -Region ap-southeast-1 -TableName codenvia-colleges

param(
  [string]$Region = "ap-southeast-1",
  [string]$TableName = "codenvia-colleges"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Creating DynamoDB Table: $TableName" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if table exists
aws dynamodb describe-table --table-name $TableName --region $Region 2>$null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Table '$TableName' already exists" -ForegroundColor Green
  exit 0
}

# Create a generic Colleges table with 'id' as partition key
# You can adapt the schema later if you need GSI/LSI
$createCmd = @(
  "dynamodb create-table",
  "--table-name $TableName",
  "--attribute-definitions AttributeName=id,AttributeType=S",
  "--key-schema AttributeName=id,KeyType=HASH",
  "--billing-mode PAY_PER_REQUEST",
  "--region $Region"
) -join ' '

Write-Host "Creating new table '$TableName'..." -ForegroundColor Yellow
aws $createCmd
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to create table '$TableName'" -ForegroundColor Red
  exit 1
}

Write-Host "Waiting for table to be active..." -ForegroundColor Yellow
aws dynamodb wait table-exists --table-name $TableName --region $Region
if ($LASTEXITCODE -ne 0) {
  Write-Host "Table wait failed. Please check AWS Console." -ForegroundColor Red
  exit 1
}

Write-Host "Table '$TableName' is now active!" -ForegroundColor Green

# Optional: seed two sample colleges if none exist yet
$itemsJson = @'
[
  {
    "PutRequest": {
      "Item": {
        "id": {"S": "mit-eng-001"},
        "name": {"S": "MIT Engineering College"},
        "code": {"S": "MIT-ENG-001"},
        "location": {"S": "Chennai, Tamil Nadu"},
        "status": {"S": "active"}
      }
    }
  },
  {
    "PutRequest": {
      "Item": {
        "id": {"S": "stan-uni-001"},
        "name": {"S": "Stanford University"},
        "code": {"S": "STAN-UNI-001"},
        "location": {"S": "Stanford, CA"},
        "status": {"S": "active"}
      }
    }
  }
]
'@

Write-Host "Seeding two sample colleges..." -ForegroundColor Cyan
$batchFile = New-TemporaryFile
$itemsJson | Set-Content -Path $batchFile -Encoding UTF8
aws dynamodb batch-write-item --request-items @{$TableName=@(Get-Content -Raw $batchFile | ConvertFrom-Json)} --region $Region | Out-Null
Remove-Item $batchFile -Force

Write-Host "Done." -ForegroundColor Green
