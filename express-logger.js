module.exports = function(RED) {
    "use strict";
    
    function ExpressLoggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // File system modules for logging
        const fs = require('fs');
        const path = require('path');
        
        // Configuration
        this.filterPaths = config.filterPaths ? config.filterPaths.split(',').map(p => p.trim()) : [];
        this.enableCsvExport = config.enableCsvExport || false;
        this.csvExportPath = config.csvExportPath || path.join(RED.settings.userDir, 'logs', 'exports');
        this.maxCsvFileSize = parseInt(config.maxCsvFileSize) || 50; // MB
        
        // CSV file configuration for direct writing
        const csvHeaders = ['timestamp', 'method', 'url', 'statusCode', 'responseTime', 'ip', 'userAgent', 'isEditorRequest', 'isDashboardRequest', 'connectionIssues'];
        
        // Main CSV log file path (single continuous file)
        this.csvLogFile = config.csvLogFile || path.join(RED.settings.userDir, 'logs', 'node-red-http-logs.csv');
        
        // Initialize CSV file with headers if it doesn't exist
        function initializeCsvFile() {
            if (!node.enableCsvExport) return;
            
            try {
                // Ensure directory exists
                const dir = path.dirname(node.csvLogFile);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                // Create CSV file with headers if it doesn't exist
                if (!fs.existsSync(node.csvLogFile)) {
                    const headerLine = csvHeaders.join(',') + '\n';
                    fs.writeFileSync(node.csvLogFile, headerLine, 'utf8');
                    node.log(`Created new CSV log file: ${node.csvLogFile}`);
                }
            } catch (error) {
                node.error(`Failed to initialize CSV file: ${error.message}`);
            }
        }
        
        function checkCsvFileSize() {
            if (!node.enableCsvExport || !fs.existsSync(node.csvLogFile)) return;
            
            const stats = fs.statSync(node.csvLogFile);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            if (fileSizeMB >= node.maxCsvFileSize) {
                try {
                    // Delete the old file and start fresh
                    fs.unlinkSync(node.csvLogFile);
                    node.log(`CSV file size limit reached (${fileSizeMB.toFixed(2)}MB), starting new file`);
                    
                    // Create a new CSV file with headers
                    initializeCsvFile();
                    
                    // Log that we started a new file
                    logSystemEventToCsv('CSV-FILE-RESET', `Previous file ${fileSizeMB.toFixed(2)}MB - started fresh`, 'info');
                } catch (err) {
                    node.error(`Failed to reset CSV file: ${err.message}`);
                }
            }
        }
        
        function addToCsvLog(logData) {
            if (!node.enableCsvExport) return;
            
            try {
                // Check if CSV file needs reset before adding new entry
                checkCsvFileSize();
                
                // Create CSV row data
                const csvEntry = {
                    timestamp: logData.timestamp || new Date().toISOString(),
                    method: logData.method || '',
                    url: logData.url || '',
                    statusCode: logData.statusCode || '',
                    responseTime: logData.responseTime || '',
                    ip: logData.ip || '',
                    userAgent: (logData.userAgent || '').substring(0, 100), // Limit length
                    isEditorRequest: logData.isEditorRequest || false,
                    isDashboardRequest: logData.isDashboardRequest || false,
                    connectionIssues: logData.connectionIssues || ''
                };
                
                // Format as CSV row
                const row = csvHeaders.map(header => {
                    let value = csvEntry[header] || '';
                    // Escape commas and quotes in CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                });
                
                // Append to CSV file
                const csvLine = row.join(',') + '\n';
                fs.appendFileSync(node.csvLogFile, csvLine, 'utf8');
                
            } catch (error) {
                node.warn(`Failed to write to CSV file: ${error.message}`);
            }
        }
        
        // Helper function to log Node-RED system events to CSV
        function logSystemEventToCsv(eventType, eventDetails, severity = 'info') {
            if (!node.enableCsvExport) return;
            
            const logData = {
                timestamp: new Date().toISOString(),
                method: 'SYSTEM',
                url: eventType,
                statusCode: severity === 'error' ? 500 : severity === 'warn' ? 300 : 200,
                responseTime: '',
                ip: 'localhost',
                userAgent: 'Node-RED-System',
                isEditorRequest: false,
                isDashboardRequest: false,
                connectionIssues: eventType.includes('CONNECTION') || eventType.includes('SERVER') ? eventDetails : ''
            };
            
            addToCsvLog(logData);
        }
        
        function exportToCsv() {
            if (!node.enableCsvExport) {
                return { success: false, error: "CSV export not enabled" };
            }
            
            try {
                // Check if CSV file exists
                if (!fs.existsSync(node.csvLogFile)) {
                    return { success: false, error: "No CSV log data available" };
                }
                
                // Get file stats to determine record count
                const stats = fs.statSync(node.csvLogFile);
                let recordCount = 0;
                
                // Count lines in the file (subtract 1 for header)
                try {
                    const content = fs.readFileSync(node.csvLogFile, 'utf8');
                    const lines = content.split('\n').filter(line => line.trim() !== '');
                    recordCount = Math.max(0, lines.length - 1); // Subtract header line
                } catch (error) {
                    node.warn(`Failed to count CSV records: ${error.message}`);
                }
                
                const fileName = path.basename(node.csvLogFile);
                
                node.log(`CSV export ready: ${node.csvLogFile} (${recordCount} entries)`);
                return { 
                    success: true, 
                    filePath: node.csvLogFile, 
                    fileName: fileName,
                    recordCount: recordCount,
                    fileSize: stats.size
                };
            } catch (err) {
                node.error(`Failed to prepare CSV export: ${err.message}`);
                return { success: false, error: err.message };
            }
        }
        
        function deleteCsvFiles() {
            if (!node.enableCsvExport) {
                return { success: false, error: "CSV export not enabled" };
            }
            
            try {
                let deletedCount = 0;
                
                // Delete the main CSV file if it exists
                if (fs.existsSync(node.csvLogFile)) {
                    fs.unlinkSync(node.csvLogFile);
                    deletedCount++;
                    node.log(`Deleted main CSV file: ${node.csvLogFile}`);
                }
                
                // Log the deletion event to CSV if we recreate the file
                if (deletedCount > 0) {
                    // Reinitialize CSV file (creates new file with headers)
                    initializeCsvFile();
                    // Log the deletion event
                    logSystemEventToCsv('CSV-FILES-DELETED', `${deletedCount} file removed by user`, 'info');
                }
                
                node.log(`CSV deletion completed: ${deletedCount} file removed`);
                return { 
                    success: true, 
                    deletedCount: deletedCount,
                    message: `Successfully deleted CSV file`
                };
            } catch (err) {
                node.error(`Failed to delete CSV files: ${err.message}`);
                return { success: false, error: err.message };
            }
        }
        
        // Expose the exportToCsv function as a node method
        node.exportToCsv = exportToCsv;
        
        // Expose the deleteCsvFiles function as a node method
        node.deleteCsvFiles = deleteCsvFiles;
        
        // Initialize CSV file on startup
        if (node.enableCsvExport) {
            initializeCsvFile();
            
            // Log node initialization to CSV for baseline tracking
            logSystemEventToCsv('EXPRESS-LOGGER-INIT', `node-${node.id}-initialized`, 'info');
        }
        
        // Add Node-RED system event monitoring
        const setupSystemEventMonitoring = function() {
            try {
                // Monitor Node-RED events that might trigger refreshes or indicate system state
                if (RED.events && RED.events.on) {
                    node.log("Setting up Node-RED system event monitoring");
                    
                    RED.events.on("flows:started", function() {
                        node.log("Flows started - deployment completed");
                        logSystemEventToCsv('FLOWS-STARTED', 'flows-deployment-completed', 'info');
                    });
                    
                    RED.events.on("flows:stopped", function() {
                        node.log("Flows stopped - shutdown initiated");
                        logSystemEventToCsv('FLOWS-STOPPED', 'flows-shutdown-initiated', 'warn');
                    });
                    
                    RED.events.on("runtime-event", function(event) {
                        if (event.id === "node-red-version" || event.id === "runtime-state") {
                            node.log(`Runtime event: ${event.id}`);
                            const payload = JSON.stringify(event.payload || {}).substring(0, 100);
                            logSystemEventToCsv(`RUNTIME-${event.id.toUpperCase()}`, payload, 'info');
                        }
                    });
                    
                    RED.events.on("registry:node-added", function(id) {
                        node.log(`Node type added: ${id}`);
                        logSystemEventToCsv('NODE-TYPE-ADDED', `node-type: ${id}`, 'info');
                    });
                    
                    RED.events.on("registry:node-removed", function(id) {
                        node.log(`Node type removed: ${id}`);
                        logSystemEventToCsv('NODE-TYPE-REMOVED', `node-type: ${id}`, 'warn');
                    });
                    
                    RED.events.on("registry:module-updated", function(module) {
                        node.log(`Module updated: ${module}`);
                        logSystemEventToCsv('MODULE-UPDATED', `module: ${module}`, 'info');
                    });
                }
                
                // Monitor server state changes if available
                if (RED.server) {
                    node.log("Setting up server event monitoring");
                    
                    // Monitor connection state
                    RED.server.on('connection', function(socket) {
                        logSystemEventToCsv('NEW-CONNECTION', `from ${socket.remoteAddress}:${socket.remotePort}`, 'info');
                    });
                    
                    RED.server.on('error', function(err) {
                        node.error(`Server error: ${err.message}`);
                        logSystemEventToCsv('SERVER-ERROR', err.message, 'error');
                    });
                    
                    RED.server.on('close', function() {
                        node.warn("Server closed event detected");
                        logSystemEventToCsv('SERVER-CLOSED', 'server-shutdown-detected', 'warn');
                    });
                }
                
                // Monitor for memory pressure that might affect performance
                const monitorMemory = () => {
                    try {
                        const usage = process.memoryUsage();
                        const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
                        const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
                        
                        // Alert if using more than 512MB
                        if (heapUsedMB > 512) {
                            node.warn(`High memory usage: ${heapUsedMB}MB used of ${heapTotalMB}MB total`);
                            logSystemEventToCsv('HIGH-MEMORY-USAGE', `${heapUsedMB}MB used of ${heapTotalMB}MB total`, 'warn');
                        }
                        
                        // Also log memory stats periodically for baseline tracking (every 10 checks = 5 minutes)
                        monitorMemory.counter = (monitorMemory.counter || 0) + 1;
                        if (monitorMemory.counter % 10 === 0) {
                            logSystemEventToCsv('MEMORY-STATS', `${heapUsedMB}MB used of ${heapTotalMB}MB total`, 'info');
                        }
                    } catch (err) {
                        // Ignore memory monitoring errors
                    }
                };
                
                // Check memory every 30 seconds
                const memoryInterval = setInterval(monitorMemory, 30000);
                
                // Store interval so we can clean it up on close
                node._memoryInterval = memoryInterval;
                
                // Monitor process events
                const onProcessExit = () => {
                    logSystemEventToCsv('PROCESS-EXIT', 'node-red-process-exiting', 'warn');
                };
                
                const onProcessSIGINT = () => {
                    logSystemEventToCsv('PROCESS-SIGINT', 'interrupt-signal-received', 'warn');
                };
                
                const onProcessSIGTERM = () => {
                    logSystemEventToCsv('PROCESS-SIGTERM', 'termination-signal-received', 'warn');
                };
                
                const onProcessUncaughtException = (err) => {
                    logSystemEventToCsv('UNCAUGHT-EXCEPTION', err.message || 'unknown-error', 'error');
                };
                
                process.on('exit', onProcessExit);
                process.on('SIGINT', onProcessSIGINT);
                process.on('SIGTERM', onProcessSIGTERM);
                process.on('uncaughtException', onProcessUncaughtException);
                
                // Store event handlers so we can clean them up
                node._processEventHandlers = {
                    exit: onProcessExit,
                    SIGINT: onProcessSIGINT,
                    SIGTERM: onProcessSIGTERM,
                    uncaughtException: onProcessUncaughtException
                };
                
                node.log("System event monitoring active");
                
            } catch (err) {
                node.warn(`System event monitoring setup error: ${err.message}`);
            }
        };
        
        // Set up system monitoring after a short delay to ensure Node-RED is fully initialized
        setTimeout(setupSystemEventMonitoring, 2000);
        
        // Main logging middleware
        const loggingMiddleware = function(req, res, next) {
            // Skip filtered paths
            if (node.filterPaths.length > 0) {
                const shouldFilter = node.filterPaths.some(path => req.url.startsWith(path));
                if (shouldFilter) {
                    return next();
                }
            }
            
            req._startTime = Date.now();
            
            // Wrap the response end method to capture when response is sent
            const originalEnd = res.end;
            const originalSend = res.send;
            const originalJson = res.json;
            
            function logRequest() {
                const responseTime = Date.now() - req._startTime;
                
                // Create log data object for CSV
                const logData = {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    responseTime: responseTime,
                    ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    timestamp: new Date().toISOString(),
                    isEditorRequest: req.url.startsWith('/red/') || req.url === '/' || req.url.startsWith('/?'),
                    isDashboardRequest: req.url.startsWith('/dashboard') || req.url.startsWith('/ui'),
                    connectionIssues: ''
                };
                
                // Add to CSV log
                addToCsvLog(logData);
            }
            
            // Override response methods to capture when response is sent
            res.end = function(chunk, encoding) {
                logRequest();
                return originalEnd.call(this, chunk, encoding);
            };
            
            res.send = function(data) {
                logRequest();
                return originalSend.call(this, data);
            };
            
            res.json = function(obj) {
                logRequest();
                return originalJson.call(this, obj);
            };
            
            next();
        };
        
        // Function to add middleware to the RED HTTP server
        const addMiddleware = function() {
            try {
                let middlewareAdded = false;
                
                // Method 1: Direct server request event hooking
                if (RED.server && RED.server.on) {
                    
                    // Hook the 'request' event directly on the HTTP server
                    RED.server.on('request', function(req, res) {
                        // Skip websocket requests and other non-HTTP traffic
                        if (!req.url || req.url.indexOf('/socket.io') !== -1) {
                            return;
                        }
                        
                        req._startTime = Date.now();
                        
                        // Enhanced logging for refresh detection
                        const isEditorRequest = req.url.startsWith('/red/') || req.url === '/' || req.url.startsWith('/?');
                        const isDashboardRequest = req.url.startsWith('/dashboard') || req.url.startsWith('/ui');
                        
                        // Hook into the response completion
                        const originalEnd = res.end;
                        if (!res._loggerHooked) {
                            res._loggerHooked = true;
                            res.end = function(chunk, encoding) {
                                try {
                                    const responseTime = Date.now() - (req._startTime || Date.now());
                                    
                                    // Enhanced logging for response analysis
                                    const responseConnection = res.get('Connection');
                                    
                                    const logData = {
                                        method: req.method,
                                        url: req.url,
                                        statusCode: res.statusCode,
                                        responseTime: responseTime,
                                        ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
                                        userAgent: req.headers ? req.headers['user-agent'] : undefined,
                                        timestamp: new Date().toISOString(),
                                        isEditorRequest: isEditorRequest,
                                        isDashboardRequest: isDashboardRequest,
                                        connectionIssues: (responseConnection && responseConnection.toLowerCase().includes('close')) ? 'connection-close' : ''
                                    };
                                    
                                    // Add to CSV log
                                    addToCsvLog(logData);
                                } catch (err) {
                                    // Ignore logging errors
                                }
                                return originalEnd.call(this, chunk, encoding);
                            };
                        }
                    });
                    
                    middlewareAdded = true;
                }
                
                if (middlewareAdded) {
                    node.log("HTTP logging active - CSV monitoring only");
                    node.status({ fill: "green", shape: "dot", text: "CSV logging active" });
                } else {
                    node.error("Could not install HTTP monitoring hooks");
                    node.status({ fill: "red", shape: "ring", text: "error" });
                }
            } catch (err) {
                console.error("EXPRESS LOGGER INSTALL ERROR:", err);
                node.error("Failed to install HTTP monitoring: " + err.message);
                node.status({ fill: "red", shape: "ring", text: "error" });
            }
        };
        
        // Initial status
        node.status({ fill: "yellow", shape: "ring", text: "initializing" });
        
        // Log Node-RED startup
        logSystemEventToCsv('NODE-RED-STARTUP', `express-logger-starting-pid-${process.pid}`, 'info');
        
        // Install immediately - HTTP module patching should work at any time
        addMiddleware();
        
        // Handle node close
        this.on('close', function(removed, done) {
            node.status({});
            
            // Clean up system monitoring
            if (node._memoryInterval) {
                clearInterval(node._memoryInterval);
            }
            
            if (node._processEventHandlers) {
                try {
                    process.removeListener('exit', node._processEventHandlers.exit);
                    process.removeListener('SIGINT', node._processEventHandlers.SIGINT);
                    process.removeListener('SIGTERM', node._processEventHandlers.SIGTERM);
                    process.removeListener('uncaughtException', node._processEventHandlers.uncaughtException);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
            
            // CSV data is automatically saved with direct file writing - no cleanup needed
            
            // Log node shutdown
            if (removed) {
                logSystemEventToCsv('EXPRESS-LOGGER-REMOVED', `node-${node.id}-removed`, 'info');
                node.log("Express logging middleware removed");
            } else {
                logSystemEventToCsv('EXPRESS-LOGGER-STOPPED', `node-${node.id}-stopped`, 'info');
            }
            
            // Note: We don't restore HTTP module patches as they might be used by other instances
            // In a production environment, you might want to implement reference counting
            
            done();
        });
    }
    
    RED.nodes.registerType("express-logger", ExpressLoggerNode);
    
    // HTTP endpoint for CSV export
    RED.httpAdmin.post("/express-logger/:id/export-csv", RED.auth.needsPermission('express-logger.write'), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (!node) {
            return res.status(404).json({ success: false, error: "Node not found" });
        }
        
        try {
            const result = node.exportToCsv();
            if (result.success) {
                res.json({ 
                    success: true, 
                    filePath: result.filePath, 
                    fileName: result.fileName,
                    recordCount: result.recordCount 
                });
            } else {
                res.json({ success: false, error: result.error });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // HTTP endpoint for CSV deletion
    RED.httpAdmin.post("/express-logger/:id/delete-csv", RED.auth.needsPermission('express-logger.write'), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (!node) {
            return res.status(404).json({ success: false, error: "Node not found" });
        }
        
        try {
            const result = node.deleteCsvFiles();
            if (result.success) {
                res.json({ 
                    success: true, 
                    deletedCount: result.deletedCount,
                    message: result.message
                });
            } else {
                res.json({ success: false, error: result.error });
            }
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // HTTP endpoint for CSV download (public endpoint)
    RED.httpNode.get("/express-logger-download/:id", function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        
        if (!node) {
            return res.status(404).json({ success: false, error: "Node not found" });
        }

        if (!node.enableCsvExport) {
            return res.status(404).json({ success: false, error: "CSV export not enabled" });
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = node.csvLogFile;
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, error: "CSV log file not found" });
            }
            
            const fileName = path.basename(filePath);
            
            // Set headers for file download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            
            // Stream the file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
            
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // HTTP endpoint for CSV download (authenticated endpoint)
    RED.httpAdmin.get("/express-logger/:id/download-csv", RED.auth.needsPermission('express-logger.read'), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        
        if (!node) {
            return res.status(404).json({ success: false, error: "Node not found" });
        }

        if (!node.enableCsvExport) {
            return res.status(404).json({ success: false, error: "CSV export not enabled" });
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = node.csvLogFile;
            
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ success: false, error: "CSV log file not found" });
            }
            
            const fileName = path.basename(filePath);
            
            // Set headers for file download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            
            // Stream the file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
            
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
};