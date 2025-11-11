// Alternative CSV Download Implementation
// Add this to your express-logger.html if the main implementation fails

// Simplified download function that works with most auth setups
function downloadCsvSimple(fileName, nodeId) {
    console.log("Starting simple CSV download for:", fileName);
    
    // Try direct link first (works with most authentication)
    const authUrl = `express-logger/${nodeId}/download-csv/${encodeURIComponent(fileName)}`;
    
    // Create invisible iframe for download
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = authUrl;
    document.body.appendChild(iframe);
    
    // Remove iframe after a delay
    setTimeout(() => {
        if (iframe.parentNode) {
            document.body.removeChild(iframe);
        }
    }, 5000);
    
    // If that fails, try public endpoint after a delay
    setTimeout(() => {
        tryPublicDownloadSimple(fileName, nodeId);
    }, 2000);
}

function tryPublicDownloadSimple(fileName, nodeId) {
    console.log("Trying public download for:", fileName);
    
    // Construct public URL
    const baseUrl = window.location.origin;
    const httpRoot = RED.settings.httpNodeRoot || "";
    const publicUrl = `${baseUrl}${httpRoot}/express-logger-download/${nodeId}/${encodeURIComponent(fileName)}`;
    
    console.log("Public download URL:", publicUrl);
    
    // Try opening in new tab as fallback
    const newWindow = window.open(publicUrl, '_blank');
    
    // If popup blocked, create download link
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
        const link = document.createElement('a');
        link.href = publicUrl;
        link.download = fileName;
        link.target = '_blank';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Use this function in your download button:
/*
$("#download-csv-btn").click(function() {
    const fileName = $(this).data('filename');
    if (!fileName) {
        RED.notify("No file available for download", "error");
        return;
    }
    
    downloadCsvSimple(fileName, node.id);
    RED.notify("Download started: " + fileName, "success");
});
*/