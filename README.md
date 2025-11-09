# Node-RED Express Logger

A comprehensive Node-RED custom node for detailed HTTP logging of the Express web server used by Node-RED's editor UI, with **enhanced monitoring capabilities specifically designed to debug automatic browser refreshes**.

![Node-RED Express Logger](https://img.shields.io/badge/Node--RED-contrib-red?style=flat-square)
![npm version](https://img.shields.io/npm/v/node-red-contrib-express-logger?style=flat-square)
![License](https://img.shields.io/github/license/smccamy1/node-red-contrib-express-logger?style=flat-square)

## 🎯 **Key Features**

### **HTTP Request Monitoring**
- Comprehensive logging of all HTTP requests to Node-RED's Express server
- Multiple log formats: Combined, Common, Dev, Short, Tiny, and Custom
- Real-time output to Node-RED debug panel and console

### **🔍 Enhanced Refresh Detection & Debugging**

This node includes specialized monitoring to help debug automatic browser refreshes - a common issue in Node-RED deployments:

#### **Editor & Dashboard Request Classification**
- **Editor Request Detection**: Identifies main Node-RED editor requests vs static assets
- **Dashboard Request Monitoring**: Tracks dashboard-specific traffic separately
- **Static Asset Filtering**: Distinguishes between functional requests and resources

#### **Connection Health Monitoring** 
- **Connection Timeouts**: Logs when connections timeout (common refresh trigger)
- **Connection Closures**: Monitors normal vs error connection closures
- **Server Events**: Tracks server close/error events that force refreshes
- **Keep-Alive Issues**: Detects connection header problems

#### **Cache & Browser Behavior Analysis**
- **Forced Refresh Detection**: Identifies `Cache-Control: no-cache` and `Pragma: no-cache` headers
- **Browser Refresh Patterns**: Recognizes refresh-related request sequences
- **Response Analysis**: Monitors response headers that might trigger refreshes

#### **Node-RED Runtime Monitoring**
- **Flow State Changes**: Tracks `flows:started`, `flows:stopped` events
- **Node Registry Changes**: Monitors node additions/removals that cause editor updates
- **Runtime State Events**: Logs version changes and runtime modifications

#### **Performance & Health Monitoring**
- **Memory Usage Alerts**: Warns when heap usage exceeds safe thresholds
- **Slow Response Detection**: Identifies responses that might timeout and trigger refreshes
- **Authentication Failures**: Logs 401/403 errors that could cause redirects

#### **WebSocket & Communication Monitoring**
- **Socket.IO Event Tracking**: Monitors connection/disconnect events
- **Node-RED Comms**: Tracks internal Node-RED communication events
- **Real-time Connection Status**: Logs WebSocket state changes

## 📦 **Installation**

### **Option 1: Via npm (when published)**
```bash
npm install node-red-contrib-express-logger
```

### **Option 2: Manual Installation**
1. Download the latest release
2. Extract to your Node-RED user directory
3. Install via Node-RED palette manager or:
```bash
cd ~/.node-red
npm install /path/to/node-red-contrib-express-logger-1.0.0.tgz
```

### **Option 3: Development Installation**
```bash
git clone https://github.com/smccamy1/node-red-contrib-express-logger.git
cd node-red-contrib-express-logger
npm pack
cd ~/.node-red
npm install /path/to/node-red-contrib-express-logger-1.0.0.tgz
```

## 🚀 **Quick Start**

1. **Add the Node**: Drag "Express Logger" from the Node-RED palette into your flow
2. **Configure**: Double-click to set log format and monitoring options
3. **Deploy**: The node immediately starts monitoring HTTP traffic
4. **View Logs**: Check the Node-RED debug panel for detailed request logs

## ⚙️ **Configuration Options**

- **Log Format**: Choose from Apache-style formats (Combined, Common, Dev, etc.)
- **Include Headers**: Enable to capture request headers (helpful for refresh debugging)
- **Include Request Body**: Log request payloads (with size limits)
- **Filter Paths**: Exclude specific paths from logging
- **Output to Debug Panel**: Enable/disable debug panel output
- **Output to Flow**: Send log data as Node-RED messages

## 📊 **Sample Log Output**

### **Standard HTTP Logging**
```
127.0.0.1 - - [2025-11-09T14:10:31.722Z] "GET /red/style.min.css HTTP/1.1" 304 - "http://127.0.0.1:1880/" "Mozilla/5.0..."
```

### **Enhanced Refresh Detection**
```
EXPRESS LOGGER: EDITOR REQUEST DETECTED: GET /?id=a82394ef-9695-45bc-914f-f21dc90afba5
EXPRESS LOGGER: CONNECTION TIMEOUT 127.0.0.1
EXPRESS LOGGER: FORCED REFRESH DETECTED: /settings Cache-Control: no-cache
EXPRESS LOGGER: FLOWS STARTED - may trigger browser refresh
EXPRESS LOGGER: High memory usage: 612MB used of 1024MB total - may cause performance issues
```

## 🔧 **Debugging Automatic Refreshes**

When experiencing automatic refreshes in Node-RED editor or dashboards:

### **1. Monitor Connection Health**
Look for patterns like:
```
EXPRESS LOGGER: CONNECTION TIMEOUT 127.0.0.1
EXPRESS LOGGER: CONNECTION CLOSED 127.0.0.1 normal
```

### **2. Check for Server Events**
Watch for:
```
EXPRESS LOGGER: FLOWS STOPPED - may trigger browser refresh
EXPRESS LOGGER: NODE ADDED: node-red-contrib-example - may trigger refresh
EXPRESS LOGGER: SERVER ERROR: ECONNRESET
```

### **3. Analyze Request Patterns**
Monitor for:
```
EXPRESS LOGGER: FORCED REFRESH DETECTED: Cache-Control: no-cache
EXPRESS LOGGER: SLOW EDITOR RESPONSE: 8500ms /settings - may cause timeout refresh
```

### **4. Memory & Performance Issues**
Watch for warnings:
```
EXPRESS LOGGER: High memory usage: 512MB used - may cause performance issues
```

## 🛠️ **Development**

### **Project Structure**
```
├── express-logger.js      # Main node implementation
├── express-logger.html    # Node configuration UI
├── package.json          # npm package configuration
├── README.md             # This file
├── LICENSE               # MIT License
├── example-flow.json     # Sample Node-RED flow
├── INSTALL.md           # Installation instructions
└── test-node.js         # Basic functionality test
```

### **Testing**
```bash
# Syntax check
node -c express-logger.js

# Package creation
npm pack

# Install for testing
cd ~/.node-red
npm install /path/to/node-red-contrib-express-logger-1.0.0.tgz
```

## 📋 **Requirements**

- **Node-RED**: v2.0.0 or higher
- **Node.js**: v14.0.0 or higher
- **Operating System**: Windows, macOS, Linux

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 **Issues & Support**

- **Bug Reports**: [GitHub Issues](https://github.com/smccamy1/node-red-contrib-express-logger/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/smccamy1/node-red-contrib-express-logger/discussions)
- **Node-RED Forum**: [Node-RED Community](https://discourse.nodered.org/)

## 📈 **Changelog**

### **v1.0.0** (November 2025)
- Initial release with comprehensive HTTP logging
- Enhanced refresh detection and monitoring capabilities
- Support for multiple log formats
- WebSocket and connection monitoring
- Memory usage tracking
- Node-RED runtime event monitoring

## 🙏 **Acknowledgments**

- Node-RED team for the excellent platform
- Express.js team for the robust web framework
- Morgan logging library for inspiration on log formats

---

**Need help debugging those mysterious browser refreshes?** This tool was specifically designed to help! 🔍