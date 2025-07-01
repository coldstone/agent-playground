#!/bin/bash

# Docker test script for Agent Playground
# This script tests the Docker container functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="agent-playground"
CONTAINER_NAME="agent-playground-test"
TEST_PORT="3002"
TIMEOUT=30

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up test container..."
    docker stop "$CONTAINER_NAME" &> /dev/null || true
    docker rm "$CONTAINER_NAME" &> /dev/null || true
}

# Function to test container
test_container() {
    print_status "Starting Docker container test..."
    
    # Cleanup any existing test container
    cleanup
    
    # Start the container
    print_status "Starting container on port $TEST_PORT..."
    if ! docker run -d --name "$CONTAINER_NAME" -p "$TEST_PORT:3001" "$IMAGE_NAME"; then
        print_error "Failed to start container"
        return 1
    fi
    
    # Wait for container to be ready
    print_status "Waiting for container to be ready (timeout: ${TIMEOUT}s)..."
    local count=0
    while [ $count -lt $TIMEOUT ]; do
        if docker exec "$CONTAINER_NAME" node docker-healthcheck.js &> /dev/null; then
            print_status "Container health check passed!"
            break
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    echo
    
    if [ $count -eq $TIMEOUT ]; then
        print_error "Container failed to become ready within $TIMEOUT seconds"
        docker logs "$CONTAINER_NAME"
        cleanup
        return 1
    fi
    
    # Test HTTP endpoint
    print_status "Testing HTTP endpoint..."
    if curl -f -s "http://localhost:$TEST_PORT" > /dev/null; then
        print_status "HTTP endpoint test passed!"
    else
        print_error "HTTP endpoint test failed"
        print_status "Container logs:"
        docker logs "$CONTAINER_NAME"
        cleanup
        return 1
    fi
    
    # Test container stats
    print_status "Container stats:"
    docker stats "$CONTAINER_NAME" --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    
    # Cleanup
    cleanup
    print_status "All tests passed successfully!"
    return 0
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -i, --image IMAGE   Set image name to test (default: agent-playground)"
    echo "  -p, --port PORT     Set test port (default: 3002)"
    echo "  -t, --timeout SEC   Set timeout in seconds (default: 30)"
    echo "  -h, --help          Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -p|--port)
            TEST_PORT="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_status "Starting Docker container tests..."
    
    # Check if image exists
    if ! docker images "$IMAGE_NAME" --format "{{.Repository}}" | grep -q "^$IMAGE_NAME$"; then
        print_error "Docker image '$IMAGE_NAME' not found. Please build it first:"
        echo "  npm run docker:build"
        exit 1
    fi
    
    # Check if port is available
    if lsof -i ":$TEST_PORT" &> /dev/null; then
        print_error "Port $TEST_PORT is already in use. Please choose a different port."
        exit 1
    fi
    
    # Run tests
    if test_container; then
        print_status "All Docker tests completed successfully!"
        exit 0
    else
        print_error "Docker tests failed!"
        exit 1
    fi
}

# Trap to ensure cleanup on script exit
trap cleanup EXIT

# Run main function
main
