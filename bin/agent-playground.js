#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory where this package is installed
const packageDir = path.dirname(__dirname);

// Check if this is a development environment
const isDev = fs.existsSync(path.join(packageDir, 'src'));

if (isDev) {
  console.log('🚀 Starting Agent Playground in development mode...');
  
  // In development, run npm run dev
  const child = spawn('npm', ['run', 'dev'], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start Agent Playground:', error.message);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code);
  });
} else {
  console.log('🚀 Starting Agent Playground...');
  
  // In production, run npm start
  const child = spawn('npm', ['start'], {
    cwd: packageDir,
    stdio: 'inherit',
    shell: true
  });

  child.on('error', (error) => {
    console.error('❌ Failed to start Agent Playground:', error.message);
    console.log('💡 Make sure you have Node.js installed and try running: npm install -g agent-playground');
    process.exit(1);
  });

  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Agent Playground stopped successfully');
    } else {
      console.log(`❌ Agent Playground exited with code ${code}`);
    }
    process.exit(code);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Agent Playground...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Agent Playground...');
  process.exit(0);
});
