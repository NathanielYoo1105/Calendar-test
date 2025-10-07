#!/bin/bash
# test-local.sh

# Load .env
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Install dependencies
npm install

# Start server
npm start &

# Wait for server to start
sleep 5

# Test frontend
echo "Opening http://localhost:5000 in browser..."
curl -s http://localhost:5000 > /dev/null
if [ $? -eq 0 ]; then
  echo "Frontend is accessible at http://localhost:5000"
else
  echo "Failed to access frontend"
  exit 1
fi

# Test API endpoints
echo "Testing API endpoints..."

# Register a test user
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}' > register.json
if [ $? -eq 0 ]; then
  echo "Registration successful"
  TOKEN=$(jq -r '.token' register.json)
else
  echo "Registration failed"
  cat register.json
  exit 1
fi

# Test events endpoint
curl -s http://localhost:5000/api/events \
  -H "Authorization: Bearer $TOKEN" > events.json
if [ $? -eq 0 ]; then
  echo "Events endpoint successful"
else
  echo "Events endpoint failed"
  cat events.json
  exit 1
fi

echo "Local tests passed!"