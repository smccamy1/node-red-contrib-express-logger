module.exports = function(RED) {
    "use strict";
    
    function ExpressLoggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        
        // File system modules for logging
        const fs = require('fs');
        const path = require('path');
        
        // Configuration
        this.logLevel = config.logLevel || 'combined';
        this.includeHeaders = config.includeHeaders || false;
        this.includeBody = config.includeBody || false;
        this.maxBodySize = parseInt(config.maxBodySize) || 1024;
        this.filterPaths = config.filterPaths ? config.filterPaths.split(',').map(p => p.trim()) : [];
        this.outputToDebug = config.outputToDebug !== false; // Default true
        this.outputToFlow = config.outputToFlow || false;
        this.saveToFile = config.saveToFile || false;
        this.logFilePath = config.logFilePath || path.join(RED.settings.userDir, 'logs', 'express-logger.log');
        this.enableCsvExport = config.enableCsvExport || false;
        this.csvExportPath = config.csvExportPath || path.join(RED.settings.userDir, 'logs', 'exports');
        this.maxLogFileSize = parseInt(config.maxLogFileSize) || 10; // MB
        this.logRotation = config.logRotation !== false; // Default true
        
        // Store original body for logging
        let requestBodies = new Map();
        
        // CSV log storage for export
        let csvLogEntries = [];
        const csvHeaders = ['timestamp', 'method', 'url', 'statusCode', 'responseTime', 'ip', 'userAgent', 'isEditorRequest', 'isDashboardRequest', 'hasRefreshIndicators', 'connectionIssues'];
        
        // Persistent storage for CSV data
        this.csvDataFile = config.csvDataFile || path.join(RED.settings.userDir, 'logs', 'express-logger-data.json');
        const maxPersistentEntries = parseInt(config.maxPersistentEntries) || 50000; // Max entries to persist
        
        // Load existing CSV data from persistent storage
        function loadCsvData() {
            try {
                if (fs.existsSync(node.csvDataFile)) {
                    const data = fs.readFileSync(node.csvDataFile, 'utf8');
                    const parsedData = JSON.parse(data);
                    if (Array.isArray(parsedData.entries)) {
                        csvLogEntries = parsedData.entries;
                        node.log(`Loaded ${csvLogEntries.length} CSV log entries from persistent storage`);
                        
                        // Remove old entries if exceeding limit
                        if (csvLogEntries.length > maxPersistentEntries) {
                            const oldCount = csvLogEntries.length;
                            csvLogEntries = csvLogEntries.slice(-Math.floor(maxPersistentEntries * 0.8));
                            node.log(`Trimmed CSV entries from ${oldCount} to ${csvLogEntries.length} to manage memory`);
                            saveCsvData(); // Save the trimmed data
                        }
                    }
                } else {
                    node.log("No existing CSV data file found, starting fresh");
                }
            } catch (error) {
                node.warn(`Failed to load CSV data from ${node.csvDataFile}: ${error.message}`);
                csvLogEntries = []; // Start fresh on error
            }
        }
        
        // Save CSV data to persistent storage
        function saveCsvData() {
            try {
                // Ensure directory exists
                const dir = path.dirname(node.csvDataFile);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                
                const dataToSave = {
                    lastUpdated: new Date().toISOString(),
                    entryCount: csvLogEntries.length,
                    entries: csvLogEntries
                };
                
                fs.writeFileSync(node.csvDataFile, JSON.stringify(dataToSave, null, 2), 'utf8');
            } catch (error) {
                node.warn(`Failed to save CSV data to ${node.csvDataFile}: ${error.message}`);
            }
        }
        
        // Periodic save of CSV data (every 100 entries or 5 minutes)
        let saveCounter = 0;
        let lastSaveTime = Date.now();
        
        function scheduleSave() {
            saveCounter++;
            const now = Date.now();
            const timeSinceLastSave = now - lastSaveTime;
            
            // Save every 100 entries or every 5 minutes, whichever comes first
            if (saveCounter >= 100 || timeSinceLastSave >= 300000) {
                saveCsvData();
                saveCounter = 0;
                lastSaveTime = now;
            }
        }
        
        // File logging functions
        function ensureLogDirectory(filePath) {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
        
        function rotateLogFile(filePath) {
            if (!fs.existsSync(filePath)) return;
            
            const stats = fs.statSync(filePath);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            if (fileSizeMB >= node.maxLogFileSize) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const ext = path.extname(filePath);
                const basename = path.basename(filePath, ext);
                const dirname = path.dirname(filePath);
                const rotatedFile = path.join(dirname, `${basename}-${timestamp}${ext}`);
                
                try {
                    fs.renameSync(filePath, rotatedFile);
                    node.log(`Log file rotated: ${rotatedFile}`);
                } catch (err) {
                    node.error(`Failed to rotate log file: ${err.message}`);
                }
            }
        }
        
        function writeToLogFile(message) {
            if (!node.saveToFile || !node.logFilePath) return;
            
            try {
                const logFilePath = node.logFilePath;
                ensureLogDirectory(logFilePath);
                
                if (node.logRotation) {
                    rotateLogFile(logFilePath);
                }
                
                const timestamp = new Date().toISOString();
                const logEntry = `[${timestamp}] ${message}\n`;
                
                fs.appendFileSync(logFilePath, logEntry, 'utf8');
            } catch (err) {
                node.error(`Failed to write to log file: ${err.message}`);
            }
        }
        
        function addToCsvLog(logData) {
            if (!node.enableCsvExport) return;
            
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
                hasRefreshIndicators: logData.hasRefreshIndicators || false,
                connectionIssues: logData.connectionIssues || ''
            };
            
            csvLogEntries.push(csvEntry);
            
            // Schedule periodic save to persistent storage
            scheduleSave();
            
            // Limit memory usage - keep only last 10000 entries in memory
            if (csvLogEntries.length > 10000) {
                csvLogEntries = csvLogEntries.slice(-5000); // Keep last 5000 in memory
                // Save immediately when trimming to avoid data loss
                saveCsvData();
            }
        }
        
        function exportToCsv() {
            if (!node.enableCsvExport || csvLogEntries.length === 0) {
                return { success: false, error: "CSV export not enabled or no data available" };
            }
            
            try {
                const exportPath = node.csvExportPath;
                
                // Ensure export directory exists
                if (!fs.existsSync(exportPath)) {
                    fs.mkdirSync(exportPath, { recursive: true });
                }
                
                // Create CSV content
                let csvContent = csvHeaders.join(',') + '\n';
                
                csvLogEntries.forEach(entry => {
                    const row = csvHeaders.map(header => {
                        let value = entry[header] || '';
                        // Escape commas and quotes in CSV
                        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                            value = '"' + value.replace(/"/g, '""') + '"';
                        }
                        return value;
                    });
                    csvContent += row.join(',') + '\n';
                });
                
                // Write to file with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const csvFileName = `node-red-http-logs-${timestamp}.csv`;
                const fullPath = path.resolve(exportPath, csvFileName);
                
                fs.writeFileSync(fullPath, csvContent, 'utf8');
                node.log(`CSV export completed: ${fullPath} (${csvLogEntries.length} entries)`);
                return { 
                    success: true, 
                    filePath: fullPath, 
                    fileName: csvFileName,
                    recordCount: csvLogEntries.length 
                };
            } catch (err) {
                node.error(`Failed to export CSV: ${err.message}`);
                return { success: false, error: err.message };
            }
        }
        
        // Format log message based on log level
        function formatLogMessage(req, res, responseTime) {
            const timestamp = new Date().toISOString();
            const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '-';
            const method = req.method || '-';
            const url = req.url || '-';
            const httpVersion = req.httpVersion || '1.1';
            const status = res.statusCode || '-';
            const contentLength = res.get('content-length') || '-';
            const referrer = req.get('referrer') || req.get('referer') || '-';
            const userAgent = req.get('user-agent') || '-';
            
            switch (node.logLevel) {
                case 'combined':
                    return `${ip} - - [${timestamp}] "${method} ${url} HTTP/${httpVersion}" ${status} ${contentLength} "${referrer}" "${userAgent}"`;
                case 'common':
                    return `${ip} - - [${timestamp}] "${method} ${url} HTTP/${httpVersion}" ${status} ${contentLength}`;
                case 'dev':
                    const statusColor = status >= 500 ? 'red' : status >= 400 ? 'yellow' : status >= 300 ? 'cyan' : 'green';
                    return `${method} ${url} ${status} ${responseTime}ms - ${contentLength}`;
                case 'short':
                    return `${ip} ${method} ${url} HTTP/${httpVersion} ${status} ${contentLength} - ${responseTime} ms`;
                case 'tiny':
                    return `${method} ${url} ${status} ${contentLength} - ${responseTime} ms`;
                case 'custom':
                default:
                    let msg = `[${timestamp}] ${method} ${url} - ${status} (${responseTime}ms) from ${ip}`;
                    if (node.includeHeaders) {
                        msg += ` | Headers: ${JSON.stringify(req.headers)}`;
                    }
                    if (node.includeBody && requestBodies.has(req)) {
                        const body = requestBodies.get(req);
                        msg += ` | Body: ${typeof body === 'string' ? body : JSON.stringify(body)}`;
                    }
                    return msg;
            }
        }
        
        // Expose the exportToCsv function as a node method
        node.exportToCsv = exportToCsv;
        
        // Load existing CSV data from persistent storage on startup
        if (node.enableCsvExport) {
            loadCsvData();
        }
        
        // Middleware to capture request body
        const bodyCapture = function(req, res, next) {
            if (node.includeBody && req.method !== 'GET' && req.method !== 'HEAD') {
                let body = '';
                let rawBody = Buffer.alloc(0);
                
                req.on('data', function(chunk) {
                    rawBody = Buffer.concat([rawBody, chunk]);
                    if (rawBody.length <= node.maxBodySize) {
                        body += chunk.toString('utf8');
                    }
                });
                
                req.on('end', function() {
                    try {
                        if (body) {
                            // Try to parse as JSON, fallback to string
                            try {
                                requestBodies.set(req, JSON.parse(body));
                            } catch (e) {
                                requestBodies.set(req, body);
                            }
                        }
                    } catch (err) {
                        // Ignore parsing errors
                    }
                });
            }
            next();
        };
        
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
                
                // Debug output to console
                console.log("EXPRESS LOGGER: Request captured:", req.method, req.url, res.statusCode);
                
                // Create log data object for flow output
                const logData = {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    responseTime: responseTime,
                    ip: req.ip || req.connection.remoteAddress || req.socket.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    timestamp: new Date().toISOString(),
                    headers: node.includeHeaders ? req.headers : undefined,
                    body: node.includeBody && requestBodies.has(req) ? requestBodies.get(req) : undefined
                };
                
                // Generate log message
                const logMessage = formatLogMessage(req, res, responseTime);
                
                // Debug: force output to console
                console.log("EXPRESS LOGGER:", logMessage);
                
                // Output to debug panel/console
                if (node.outputToDebug) {
                    node.log(logMessage);
                }
                
                // Output to flow if enabled
                if (node.outputToFlow && node.send) {
                    node.send({ payload: logData });
                }
                
                // Clean up
                if (requestBodies.has(req)) {
                    requestBodies.delete(req);
                }
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
                
                console.log("EXPRESS LOGGER: Checking available interfaces...");
                console.log("RED.httpAdmin:", !!RED.httpAdmin);
                console.log("RED.httpNode:", !!RED.httpNode);
                console.log("RED.server:", !!RED.server);
                
                // Enhanced logging for server state monitoring
                if (RED.server) {
                    console.log("EXPRESS LOGGER: Setting up enhanced server monitoring for refresh detection");
                    
                    // Monitor server state changes
                    const originalEmit = RED.server.emit;
                    RED.server.emit = function(event, ...args) {
                        if (event === 'close' || event === 'error' || event === 'connection' || event === 'clientError') {
                            console.log("EXPRESS LOGGER: SERVER EVENT:", event, args.length > 0 ? args[0]?.constructor?.name || 'data' : '');
                            node.log(`Server event: ${event} - ${args.length > 0 ? args[0]?.constructor?.name || 'data' : 'no data'}`);
                        }
                        return originalEmit.apply(this, arguments);
                    };
                    
                    // Monitor connection state
                    RED.server.on('connection', function(socket) {
                        console.log("EXPRESS LOGGER: NEW CONNECTION from", socket.remoteAddress);
                        node.log(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);
                        
                        socket.on('close', function(hadError) {
                            console.log("EXPRESS LOGGER: CONNECTION CLOSED", socket.remoteAddress, hadError ? 'with error' : 'normal');
                            node.log(`Connection closed ${socket.remoteAddress}:${socket.remotePort} ${hadError ? 'with error' : 'normal'}`);
                        });
                        
                        socket.on('error', function(err) {
                            console.log("EXPRESS LOGGER: CONNECTION ERROR", socket.remoteAddress, err.message);
                            node.log(`Connection error ${socket.remoteAddress}:${socket.remotePort} - ${err.message}`);
                        });
                        
                        socket.on('timeout', function() {
                            console.log("EXPRESS LOGGER: CONNECTION TIMEOUT", socket.remoteAddress);
                            node.log(`Connection timeout ${socket.remoteAddress}:${socket.remotePort}`);
                        });
                    });
                    
                    // Monitor for server errors
                    RED.server.on('error', function(err) {
                        console.log("EXPRESS LOGGER: SERVER ERROR:", err.message);
                        node.error(`Server error: ${err.message}`);
                    });
                    
                    // Monitor server close events
                    RED.server.on('close', function() {
                        console.log("EXPRESS LOGGER: SERVER CLOSED");
                        node.warn("Server closed event detected");
                    });
                }
                
                // Method 1: Direct server request event hooking
                if (RED.server && RED.server.on) {
                    console.log("EXPRESS LOGGER: Installing direct server request hook with refresh detection");
                    
                    // Hook the 'request' event directly on the HTTP server
                    RED.server.on('request', function(req, res) {
                        // Skip websocket requests and other non-HTTP traffic
                        if (!req.url || req.url.indexOf('/socket.io') !== -1) {
                            return;
                        }
                        
                        console.log("EXPRESS LOGGER: Direct server request:", req.method, req.url);
                        req._startTime = Date.now();
                        
                        // Enhanced logging for refresh detection
                        const isEditorRequest = req.url.startsWith('/red/') || req.url === '/' || req.url.startsWith('/?');
                        const isDashboardRequest = req.url.startsWith('/dashboard') || req.url.startsWith('/ui');
                        const isStaticAsset = req.url.includes('.js') || req.url.includes('.css') || req.url.includes('.svg') || req.url.includes('.png');
                        
                        if (isEditorRequest && !isStaticAsset) {
                            console.log("EXPRESS LOGGER: EDITOR REQUEST DETECTED:", req.method, req.url);
                            node.log(`EDITOR REQUEST: ${req.method} ${req.url} from ${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`);
                        }
                        
                        if (isDashboardRequest && !isStaticAsset) {
                            console.log("EXPRESS LOGGER: DASHBOARD REQUEST DETECTED:", req.method, req.url);
                            node.log(`DASHBOARD REQUEST: ${req.method} ${req.url} from ${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`);
                        }
                        
                        // Check for refresh-related headers
                        const cacheControl = req.get('Cache-Control');
                        const pragma = req.get('Pragma');
                        const ifModifiedSince = req.get('If-Modified-Since');
                        const ifNoneMatch = req.get('If-None-Match');
                        
                        if (cacheControl === 'no-cache' || pragma === 'no-cache') {
                            console.log("EXPRESS LOGGER: FORCED REFRESH DETECTED:", req.url, 'Cache-Control:', cacheControl, 'Pragma:', pragma);
                            node.warn(`Forced refresh detected: ${req.url} - Cache-Control: ${cacheControl}, Pragma: ${pragma}`);
                        }
                        
                        // Check for connection header issues that might cause refreshes
                        const connection = req.get('Connection');
                        const keepAlive = req.get('Keep-Alive');
                        
                        if (connection && connection.toLowerCase().includes('close')) {
                            console.log("EXPRESS LOGGER: CONNECTION CLOSE HEADER:", req.url);
                            node.log(`Connection close header on: ${req.url}`);
                        }
                        
                        // Hook into the response completion
                        const originalEnd = res.end;
                        if (!res._loggerHooked) {
                            res._loggerHooked = true;
                            res.end = function(chunk, encoding) {
                                try {
                                    const responseTime = Date.now() - (req._startTime || Date.now());
                                    const logMessage = formatLogMessage(req, res, responseTime);
                                    
                                    // Enhanced logging for response analysis
                                    const responseConnection = res.get('Connection');
                                    const responseContentType = res.get('Content-Type');
                                    const responseCacheControl = res.get('Cache-Control');
                                    
                                    console.log("EXPRESS LOGGER (DIRECT):", logMessage);
                                    
                                    // Write to log file if enabled
                                    writeToLogFile(`DIRECT: ${logMessage}`);
                                    
                                    // Log potential refresh triggers
                                    if (res.statusCode >= 400) {
                                        console.log("EXPRESS LOGGER: ERROR RESPONSE:", res.statusCode, req.url);
                                        node.warn(`Error response ${res.statusCode} for ${req.url} - may trigger refresh`);
                                        writeToLogFile(`ERROR RESPONSE: ${res.statusCode} ${req.url} - may trigger refresh`);
                                    }
                                    
                                    if (responseConnection && responseConnection.toLowerCase().includes('close')) {
                                        console.log("EXPRESS LOGGER: RESPONSE FORCES CONNECTION CLOSE:", req.url);
                                        node.warn(`Response forces connection close: ${req.url}`);
                                        writeToLogFile(`CONNECTION CLOSE FORCED: ${req.url}`);
                                    }
                                    
                                    if (isEditorRequest && res.statusCode === 200 && responseTime > 5000) {
                                        console.log("EXPRESS LOGGER: SLOW EDITOR RESPONSE:", responseTime + "ms", req.url);
                                        node.warn(`Slow editor response ${responseTime}ms for ${req.url} - may cause timeout refresh`);
                                        writeToLogFile(`SLOW RESPONSE: ${responseTime}ms ${req.url} - may cause timeout refresh`);
                                    }
                                    
                                    if (node.outputToDebug) {
                                        node.log(logMessage);
                                    }
                                    
                                    if (node.outputToFlow && node.send) {
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
                                            isStaticAsset: isStaticAsset,
                                            connectionHeader: connection,
                                            responseConnection: responseConnection,
                                            cacheControl: cacheControl,
                                            responseCacheControl: responseCacheControl,
                                            hasRefreshIndicators: !!(cacheControl === 'no-cache' || pragma === 'no-cache' || res.statusCode >= 400),
                                            connectionIssues: (responseConnection && responseConnection.toLowerCase().includes('close')) ? 'connection-close' : ''
                                        };
                                        
                                        // Add to CSV log
                                        addToCsvLog(logData);
                                        
                                        node.send({ payload: logData });
                                    } else if (node.enableCsvExport) {
                                        // Still add to CSV even if not outputting to flow
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
                                            hasRefreshIndicators: !!(cacheControl === 'no-cache' || pragma === 'no-cache' || res.statusCode >= 400),
                                            connectionIssues: (responseConnection && responseConnection.toLowerCase().includes('close')) ? 'connection-close' : ''
                                        };
                                        addToCsvLog(logData);
                                    }
                                } catch (err) {
                                    console.error("EXPRESS LOGGER DIRECT ERROR:", err);
                                }
                                return originalEnd.call(this, chunk, encoding);
                            };
                        }
                    });
                    
                    middlewareAdded = true;
                    console.log("EXPRESS LOGGER: Direct server request hook with refresh detection installed");
                }
                
                // Method 2: Try global process event hooking as backup
                if (process.listeners && !middlewareAdded) {
                    console.log("EXPRESS LOGGER: Installing process-level HTTP monitoring");
                    
                    // Monitor all HTTP requests in the process
                    const events = require('events');
                    const originalEmit = events.EventEmitter.prototype.emit;
                    
                    events.EventEmitter.prototype.emit = function(event, ...args) {
                        if (event === 'request' && this.constructor.name === 'Server' && args[0] && args[1]) {
                            const req = args[0];
                            const res = args[1];
                            
                            if (req.url && req.method && req.url.indexOf('/socket.io') === -1) {
                                console.log("EXPRESS LOGGER: Process-level request:", req.method, req.url);
                                req._startTime = Date.now();
                                
                                const originalEnd = res.end;
                                if (!res._loggerHooked) {
                                    res._loggerHooked = true;
                                    res.end = function(chunk, encoding) {
                                        try {
                                            const responseTime = Date.now() - (req._startTime || Date.now());
                                            const logMessage = formatLogMessage(req, res, responseTime);
                                            console.log("EXPRESS LOGGER (PROCESS):", logMessage);
                                            
                                            if (node.outputToDebug) {
                                                node.log(logMessage);
                                            }
                                        } catch (err) {
                                            console.error("EXPRESS LOGGER PROCESS ERROR:", err);
                                        }
                                        return originalEnd.call(this, chunk, encoding);
                                    };
                                }
                            }
                        }
                        return originalEmit.apply(this, arguments);
                    };
                    
                    middlewareAdded = true;
                    console.log("EXPRESS LOGGER: Process-level HTTP monitoring installed");
                }
                
                // Method 3: WebSocket and Socket.IO monitoring for dashboard refresh detection
                if (typeof global !== 'undefined') {
                    console.log("EXPRESS LOGGER: Setting up WebSocket monitoring for refresh detection");
                    
                    // Monitor Socket.IO events if available
                    setImmediate(() => {
                        try {
                            // Try to access Node-RED's Socket.IO instance
                            if (RED.comms && RED.comms.publish) {
                                console.log("EXPRESS LOGGER: Found Node-RED comms, monitoring");
                                const originalPublish = RED.comms.publish;
                                RED.comms.publish = function(topic, data, retain) {
                                    if (topic === 'status' || topic === 'flows' || topic === 'runtime-state') {
                                        console.log("EXPRESS LOGGER: COMMS EVENT:", topic, typeof data);
                                        node.log(`Node-RED comms event: ${topic} - ${typeof data === 'object' ? JSON.stringify(data).substring(0, 100) : data}`);
                                    }
                                    return originalPublish.call(this, topic, data, retain);
                                };
                            }
                            
                            // Monitor global socket.io if available
                            if (global.io) {
                                console.log("EXPRESS LOGGER: Found global Socket.IO, setting up monitoring");
                                const originalOn = global.io.on;
                                global.io.on = function(event, handler) {
                                    if (event === 'connection' || event === 'disconnect') {
                                        console.log("EXPRESS LOGGER: Socket.IO event:", event);
                                        node.log(`Socket.IO ${event} event`);
                                    }
                                    return originalOn.call(this, event, handler);
                                };
                            }
                        } catch (err) {
                            console.log("EXPRESS LOGGER: WebSocket monitoring setup error:", err.message);
                        }
                    });
                }
                
                // Method 4: Express middleware as final backup
                if (RED.httpAdmin && RED.httpAdmin.use) {
                    console.log("EXPRESS LOGGER: Installing Express middleware backup with refresh detection");
                    
                    RED.httpAdmin.use(function(req, res, next) {
                        console.log("EXPRESS LOGGER: Express middleware triggered:", req.method, req.url);
                        req._startTime = Date.now();
                        
                        // Log session and authentication details that might affect refreshes
                        const sessionId = req.sessionID || req.get('X-Session-ID') || 'none';
                        const authorization = req.get('Authorization') ? 'present' : 'none';
                        
                        if (req.url === '/' || req.url.startsWith('/?')) {
                            console.log("EXPRESS LOGGER: MAIN EDITOR LOAD:", sessionId, authorization);
                            node.log(`Main editor load - Session: ${sessionId}, Auth: ${authorization}`);
                        }
                        
                        const originalEnd = res.end;
                        if (!res._expressLoggerHooked) {
                            res._expressLoggerHooked = true;
                            res.end = function(chunk, encoding) {
                                try {
                                    const responseTime = Date.now() - req._startTime;
                                    const logMessage = formatLogMessage(req, res, responseTime);
                                    console.log("EXPRESS LOGGER (EXPRESS):", logMessage);
                                    
                                    // Check for session issues that might cause refreshes
                                    if (res.statusCode === 401 || res.statusCode === 403) {
                                        console.log("EXPRESS LOGGER: AUTH FAILURE - MAY TRIGGER REFRESH:", req.url);
                                        node.warn(`Authentication failure ${res.statusCode} on ${req.url} - may trigger refresh`);
                                    }
                                    
                                    if (node.outputToDebug) {
                                        node.log(logMessage);
                                    }
                                } catch (err) {
                                    console.error("EXPRESS LOGGER EXPRESS ERROR:", err);
                                }
                                return originalEnd.call(this, chunk, encoding);
                            };
                        }
                        
                        next();
                    });
                    
                    middlewareAdded = true;
                    console.log("EXPRESS LOGGER: Express middleware backup with refresh detection installed");
                }
                
                if (middlewareAdded) {
                    node.log("HTTP logging active - monitoring all requests with refresh detection");
                    console.log("EXPRESS LOGGER: All hooks installed for node " + node.id);
                    
                    // Add Node-RED specific monitoring for refresh causes
                    setTimeout(() => {
                        try {
                            // Monitor Node-RED events that might trigger refreshes
                            if (RED.events && RED.events.on) {
                                console.log("EXPRESS LOGGER: Setting up Node-RED event monitoring");
                                
                                RED.events.on("flows:started", function() {
                                    console.log("EXPRESS LOGGER: FLOWS STARTED - may trigger browser refresh");
                                    node.warn("Flows started - may trigger browser refresh");
                                });
                                
                                RED.events.on("flows:stopped", function() {
                                    console.log("EXPRESS LOGGER: FLOWS STOPPED - may trigger browser refresh");
                                    node.warn("Flows stopped - may trigger browser refresh");
                                });
                                
                                RED.events.on("runtime-event", function(event) {
                                    if (event.id === "node-red-version" || event.id === "runtime-state") {
                                        console.log("EXPRESS LOGGER: RUNTIME EVENT:", event.id, event.payload);
                                        node.log(`Runtime event: ${event.id} - ${JSON.stringify(event.payload).substring(0, 100)}`);
                                    }
                                });
                                
                                RED.events.on("registry:node-added", function(id) {
                                    console.log("EXPRESS LOGGER: NODE ADDED:", id, "- may trigger refresh");
                                    node.log(`Node added: ${id} - may trigger refresh`);
                                });
                                
                                RED.events.on("registry:node-removed", function(id) {
                                    console.log("EXPRESS LOGGER: NODE REMOVED:", id, "- may trigger refresh");
                                    node.log(`Node removed: ${id} - may trigger refresh`);
                                });
                            }
                            
                            // Monitor for memory pressure that might cause refreshes
                            const monitorMemory = () => {
                                const usage = process.memoryUsage();
                                const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
                                const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
                                
                                if (heapUsedMB > 512) { // Alert if using more than 512MB
                                    console.log("EXPRESS LOGGER: HIGH MEMORY USAGE:", heapUsedMB + "MB used of", heapTotalMB + "MB total");
                                    node.warn(`High memory usage: ${heapUsedMB}MB used of ${heapTotalMB}MB total - may cause performance issues`);
                                }
                            };
                            
                            // Check memory every 30 seconds
                            setInterval(monitorMemory, 30000);
                            
                        } catch (err) {
                            console.log("EXPRESS LOGGER: Event monitoring setup error:", err.message);
                        }
                    }, 2000);
                    
                    node.status({ fill: "green", shape: "dot", text: "refresh monitoring active" });
                } else {
                    node.error("Could not install any HTTP monitoring hooks");
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
        
        // Install immediately - HTTP module patching should work at any time
        addMiddleware();
        
        // Handle node close
        this.on('close', function(removed, done) {
            node.status({});
            
            // Save any remaining CSV data before closing
            if (node.enableCsvExport && csvLogEntries.length > 0) {
                try {
                    saveCsvData();
                    node.log(`Saved ${csvLogEntries.length} CSV entries before shutdown`);
                } catch (error) {
                    node.warn(`Failed to save CSV data on shutdown: ${error.message}`);
                }
            }
            
            // Clean up any remaining request bodies
            requestBodies.clear();
            
            // Note: We don't restore HTTP module patches as they might be used by other instances
            // In a production environment, you might want to implement reference counting
            
            if (removed) {
                node.log("Express logging middleware removed");
            }
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

    // HTTP endpoint for CSV download (public endpoint)
    RED.httpNode.get("/express-logger-download/:id/:fileName", function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        const fileName = req.params.fileName;
        
        if (!node) {
            return res.status(404).json({ success: false, error: "Node not found" });
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(node.csvExportPath, fileName);
            
            // Check if file exists and is within the export directory (security check)
            if (!fs.existsSync(filePath) || !filePath.startsWith(node.csvExportPath)) {
                return res.status(404).json({ success: false, error: "File not found" });
            }
            
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
    RED.httpAdmin.get("/express-logger/:id/download-csv/:fileName", RED.auth.needsPermission('express-logger.read'), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        const fileName = req.params.fileName;
        
        if (!node) {
            return res.status(404).json({ success: false, error: "Node not found" });
        }

        try {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(node.csvExportPath, fileName);
            
            // Check if file exists and is within the export directory (security check)
            if (!fs.existsSync(filePath) || !filePath.startsWith(node.csvExportPath)) {
                return res.status(404).json({ success: false, error: "File not found" });
            }
            
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