# CSV Download Testing for Express Logger

This document explains how to test the CSV download functionality when Node-RED has authentication enabled.

## The Problem

When Node-RED is deployed with authentication (like basic auth or OAuth), the CSV download endpoints get blocked because browsers can't automatically include auth headers when using simple download links.

## The Solution

We've implemented a dual-endpoint approach with automatic fallback:

### 1. Authenticated Endpoint (Primary)
- Uses Node-RED's `httpAdmin` with proper authentication
- Endpoint: `/express-logger/:id/download-csv/:fileName`
- Requires Node-RED admin permissions

### 2. Public Endpoint (Fallback)
- Uses Node-RED's `httpNode` without authentication
- Endpoint: `/express-logger-download/:id/:fileName`
- No authentication required
- Still secure with path validation

### 3. Smart Download Logic
The frontend automatically:
1. Tries the authenticated endpoint first
2. Falls back to the public endpoint if authentication fails
3. Uses `fetch()` with blob handling for proper download

## Testing Locally

### Quick Test
```bash
# Start the test server
npm run test-csv

# In another terminal or browser, open:
# test-csv-download.html
```

### Manual Testing
1. Run the test server: `node test-csv-download.js`
2. Open `test-csv-download.html` in your browser
3. Test the export and download functions
4. Check the console for detailed logs

### Test Commands
```bash
# Test export
curl -X POST http://localhost:3000/express-logger/test-id/export-csv

# Test public download
curl -O http://localhost:3000/express-logger-download/test-id/[filename]

# Test authenticated download
curl -O http://localhost:3000/express-logger/test-id/download-csv/[filename]
```

## Security Features

- **Path Validation**: Files can only be served from the designated export directory
- **No Directory Traversal**: Prevents access to files outside the export path
- **File Existence Check**: Only serves files that actually exist
- **Optional Token Security**: Can be enhanced with time-limited tokens

## Deployment Considerations

1. **Public Endpoint Security**: The public endpoint only serves CSV files from the export directory, but consider adding IP restrictions or rate limiting in production.

2. **File Cleanup**: Consider implementing automatic cleanup of old CSV files to prevent disk space issues.

3. **Access Logging**: Monitor access to both endpoints for security auditing.

4. **CORS**: If accessing from different domains, ensure CORS is properly configured.

## Implementation Notes

- The public endpoint is created using `RED.httpNode` which bypasses Node-RED authentication
- Both endpoints use the same security checks for file access
- The frontend uses `fetch()` with blob handling for reliable downloads
- Error handling includes user-friendly notifications

## Troubleshooting

If downloads still fail:
1. Check Node-RED logs for endpoint registration
2. Verify file permissions on the export directory
3. Check browser console for JavaScript errors
4. Ensure the Node-RED instance allows httpNode endpoints
5. Verify the export directory path is accessible

## Future Enhancements

- Token-based access with expiration
- Email delivery of CSV files
- Direct integration with cloud storage
- Streaming downloads for large files