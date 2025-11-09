#!/bin/bash
# SPA Routing Fix for CloudFront
# This script configures CloudFront to handle React Router properly

echo "🔧 Configuring CloudFront for SPA Routing..."

# Note: Replace DISTRIBUTION_ID with your actual CloudFront distribution ID
# You can find this in AWS Console > CloudFront or by running:
# aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins[0].DomainName, 'codenvia-exam-frontend-singapore')].Id" --output text

DISTRIBUTION_ID="YOUR_DISTRIBUTION_ID_HERE"

echo "📥 Getting current distribution configuration..."
aws cloudfront get-distribution-config --id $DISTRIBUTION_ID > temp-config.json

# Extract ETag for update
ETAG=$(aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --query 'ETag' --output text)

echo "📝 Creating updated configuration with SPA error pages..."

# Create the updated distribution config with custom error pages
cat > spa-config.json << 'EOF'
{
  "CustomErrorResponses": {
    "Quantity": 2,
    "Items": [
      {
        "ErrorCode": 403,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      },
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html", 
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  }
}
EOF

echo "🚀 Updating CloudFront distribution..."
echo "⏳ This will take 5-15 minutes to deploy globally..."

# Note: You'll need to manually merge this configuration with your existing config
# or use the AWS Console for easier configuration

echo "✅ Configuration created in spa-config.json"
echo "📋 Next steps:"
echo "1. Go to AWS Console > CloudFront"
echo "2. Find distribution: d3r5flnpq0n1l1.cloudfront.net"
echo "3. Go to Error Pages tab"
echo "4. Add the two error page rules from spa-config.json"
echo "5. Wait for deployment to complete"

echo "🔗 After deployment, test:"
echo "https://d3r5flnpq0n1l1.cloudfront.net/exam/test2"
echo "Refresh should stay on CloudFront URL!"