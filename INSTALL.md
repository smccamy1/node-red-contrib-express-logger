# Installation Instructions

## Quick Start

1. **Install the node in your Node-RED instance:**
   ```bash
   cd ~/.node-red
   npm install /path/to/node-red-contrib-express-logger
   ```

2. **Restart Node-RED:**
   ```bash
   node-red-stop
   node-red-start
   ```

3. **Import the example flow:**
   - Copy the contents of `example-flow.json`
   - In Node-RED, go to Menu → Import
   - Paste the JSON and click Import

4. **Deploy and test:**
   - Click Deploy
   - Browse to your Node-RED editor
   - Check the debug panel for HTTP logs

## Development Installation

If you want to modify the node:

1. **Clone and link for development:**
   ```bash
   git clone <this-repo>
   cd node-red-contrib-express-logger
   npm install
   npm link
   
   cd ~/.node-red
   npm link node-red-contrib-express-logger
   ```

2. **Make changes and restart Node-RED to test**

## Verification

After installation, you should see:
- "Express Logger" node in the network category
- Green status "logging active" when deployed
- HTTP request logs in the debug panel

## Troubleshooting

- **Node not appearing:** Check Node-RED startup logs for errors
- **No logs:** Ensure the node is deployed and requests are being made
- **Permission errors:** Make sure Node-RED has write access to its directory