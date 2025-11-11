#!/usr/bin/env node

/**
 * Test script to verify CSV export and download functionality
 * This can be run locally to test the CSV features without deploying
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();

// Mock Node-RED settings
const mockSettings = {
    userDir: path.join(__dirname, 'test-data')
};

// Ensure test directories exist
const testDir = mockSettings.userDir;
const logsDir = path.join(testDir, 'logs');
const exportsDir = path.join(logsDir, 'exports');

[testDir, logsDir, exportsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Mock CSV data for testing
const testCsvData = [
    'timestamp,method,url,statusCode,responseTime,ip,userAgent,isEditorRequest,isDashboardRequest,hasRefreshIndicators,connectionIssues',
    '2024-11-11T10:00:00.000Z,GET,/,200,45,127.0.0.1,Mozilla/5.0,false,false,false,false',
    '2024-11-11T10:01:00.000Z,POST,/api/data,201,120,127.0.0.1,Mozilla/5.0,false,true,false,false',
    '2024-11-11T10:02:00.000Z,GET,/dashboard,200,67,127.0.0.1,Mozilla/5.0,false,true,true,false'
];

// Create test CSV file
const testFileName = `express-logger-export-${Date.now()}.csv`;
const testFilePath = path.join(exportsDir, testFileName);
fs.writeFileSync(testFilePath, testCsvData.join('\n'));

console.log('✓ Created test CSV file:', testFilePath);

// Mock the express-logger node functionality
class MockExpressLoggerNode {
    constructor() {
        this.csvExportPath = exportsDir;
        this.csvLogEntries = [
            {
                timestamp: new Date().toISOString(),
                method: 'GET',
                url: '/test',
                statusCode: 200,
                responseTime: 50,
                ip: '127.0.0.1',
                userAgent: 'Test-Agent',
                isEditorRequest: false,
                isDashboardRequest: false,
                hasRefreshIndicators: false,
                connectionIssues: false
            }
        ];
    }

    exportToCsv() {
        try {
            const csvHeaders = ['timestamp', 'method', 'url', 'statusCode', 'responseTime', 'ip', 'userAgent', 'isEditorRequest', 'isDashboardRequest', 'hasRefreshIndicators', 'connectionIssues'];
            
            let csvContent = csvHeaders.join(',') + '\n';
            
            this.csvLogEntries.forEach(entry => {
                const row = csvHeaders.map(header => {
                    let value = entry[header] || '';
                    // Escape commas and quotes in CSV values
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                });
                csvContent += row.join(',') + '\n';
            });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `express-logger-export-${timestamp}.csv`;
            const filePath = path.join(this.csvExportPath, fileName);
            
            // Ensure export directory exists
            if (!fs.existsSync(this.csvExportPath)) {
                fs.mkdirSync(this.csvExportPath, { recursive: true });
            }
            
            fs.writeFileSync(filePath, csvContent);
            
            return {
                success: true,
                filePath: filePath,
                fileName: fileName,
                recordCount: this.csvLogEntries.length
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Test the CSV export functionality
console.log('\n🧪 Testing CSV Export Functionality...');
const mockNode = new MockExpressLoggerNode();
const exportResult = mockNode.exportToCsv();

if (exportResult.success) {
    console.log('✓ CSV export successful!');
    console.log(`  - File: ${exportResult.fileName}`);
    console.log(`  - Path: ${exportResult.filePath}`);
    console.log(`  - Records: ${exportResult.recordCount}`);
} else {
    console.log('✗ CSV export failed:', exportResult.error);
    process.exit(1);
}

// Set up express server to test download endpoints
app.use(express.json());

// Public download endpoint (like httpNode)
app.get('/express-logger-download/:id/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(exportsDir, fileName);
    
    console.log(`📥 Public download request for: ${fileName}`);
    
    if (!fs.existsSync(filePath) || !filePath.startsWith(exportsDir)) {
        console.log('✗ File not found or invalid path');
        return res.status(404).json({ success: false, error: "File not found" });
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log('✓ File download successful');
});

// Authenticated download endpoint (like httpAdmin)
app.get('/express-logger/:id/download-csv/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(exportsDir, fileName);
    
    console.log(`🔐 Authenticated download request for: ${fileName}`);
    
    if (!fs.existsSync(filePath) || !filePath.startsWith(exportsDir)) {
        console.log('✗ File not found or invalid path');
        return res.status(404).json({ success: false, error: "File not found" });
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    console.log('✓ File download successful');
});

// Export endpoint
app.post('/express-logger/:id/export-csv', (req, res) => {
    console.log('📤 Export CSV request received');
    
    const result = mockNode.exportToCsv();
    if (result.success) {
        console.log('✓ Export successful');
        res.json({ 
            success: true, 
            filePath: result.filePath, 
            fileName: result.fileName,
            recordCount: result.recordCount 
        });
    } else {
        console.log('✗ Export failed:', result.error);
        res.json({ success: false, error: result.error });
    }
});

// Start test server
const port = 3000;
app.listen(port, () => {
    console.log(`\n🚀 Test server running on http://localhost:${port}`);
    console.log('\n📋 Test the following endpoints:');
    console.log(`  Export: POST http://localhost:${port}/express-logger/test-id/export-csv`);
    console.log(`  Download (Auth): GET http://localhost:${port}/express-logger/test-id/download-csv/${testFileName}`);
    console.log(`  Download (Public): GET http://localhost:${port}/express-logger-download/test-id/${testFileName}`);
    console.log('\n🔧 Test with curl commands:');
    console.log(`  curl -X POST http://localhost:${port}/express-logger/test-id/export-csv`);
    console.log(`  curl -O http://localhost:${port}/express-logger-download/test-id/${testFileName}`);
    console.log('\n📁 CSV files will be in:', exportsDir);
    console.log('\n⏹  Press Ctrl+C to stop the test server');
});

// Cleanup function
process.on('SIGINT', () => {
    console.log('\n🧹 Cleaning up test files...');
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
        console.log('✓ Test files cleaned up');
    }
    process.exit(0);
});