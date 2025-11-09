// Test script to check Node-RED node loading
const path = require('path');
const fs = require('fs');

// Check if our module exists and can be loaded
const modulePath = path.join(process.env.HOME, '.node-red', 'node_modules', 'node-red-contrib-express-logger');
console.log('Module path:', modulePath);
console.log('Module exists:', fs.existsSync(modulePath));

if (fs.existsSync(modulePath)) {
    const packagePath = path.join(modulePath, 'package.json');
    const jsPath = path.join(modulePath, 'express-logger.js');
    const htmlPath = path.join(modulePath, 'express-logger.html');
    
    console.log('package.json exists:', fs.existsSync(packagePath));
    console.log('express-logger.js exists:', fs.existsSync(jsPath));
    console.log('express-logger.html exists:', fs.existsSync(htmlPath));
    
    if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        console.log('Node-RED config:', pkg['node-red']);
    }
    
    // Try to load the module
    try {
        const nodeModule = require(modulePath);
        console.log('Module loads:', typeof nodeModule);
    } catch (e) {
        console.error('Module load error:', e.message);
    }
}

// Check Node-RED's package.json to see if our module is listed
const nrPackagePath = path.join(process.env.HOME, '.node-red', 'package.json');
if (fs.existsSync(nrPackagePath)) {
    const nrPkg = JSON.parse(fs.readFileSync(nrPackagePath, 'utf8'));
    console.log('Our module in dependencies:', 'node-red-contrib-express-logger' in (nrPkg.dependencies || {}));
}