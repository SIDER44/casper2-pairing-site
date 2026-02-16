let currentSessionId = null;
let currentMethod = null;
let statusCheckInterval = null;

// Show notification
function showNotification(message, isError = false) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    if (isError) {
        notification.classList.add('error');
    } else {
        notification.classList.remove('error');
    }
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Navigate between steps
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(stepId).classList.add('active');
}

function goBack() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    currentMethod = null;
    showStep('step1');
}

// Select pairing method
async function selectMethod(method) {
    currentMethod = method;
    
    try {
        // Create new session
        const response = await fetch('/api/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to create session');
        }
        
        currentSessionId = data.sessionId;
        
        if (method === 'qr') {
            showStep('step2-qr');
            startQRCheck();
        } else {
            showStep('step2-pairing');
        }
        
        // Start checking connection status
        startStatusCheck();
        
    } catch (error) {
        showNotification('Error: ' + error.message, true);
        console.error(error);
    }
}

// QR Code method
async function startQRCheck() {
    const loadingEl = document.getElementById('qr-loading');
    const qrContainer = document.getElementById('qr-code-container');
    const qrImage = document.getElementById('qr-code');
    
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds
    
    const checkQR = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
            clearInterval(checkQR);
            showNotification('QR code generation timeout. Please try again.', true);
            goBack();
            return;
        }
        
        try {
            const response = await fetch('/api/session/' + currentSessionId);
            const data = await response.json();
            
            if (data.success && data.qrImage) {
                clearInterval(checkQR);
                qrImage.src = data.qrImage;
                loadingEl.style.display = 'none';
                qrContainer.style.display = 'block';
            }
        } catch (error) {
            console.error('QR check error:', error);
        }
    }, 1000);
}

// Pairing code method
async function getPairingCode() {
    const phoneInput = document.getElementById('phone');
    const phone = phoneInput.value.trim();
    
    if (!phone || phone.length < 10) {
        showNotification('Please enter a valid phone number', true);
        return;
    }
    
    try {
        const response = await fetch('/api/get-pairing-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSessionId,
                phoneNumber: phone
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to get pairing code');
        }
        
        // Display pairing code
        document.getElementById('pairing-code').textContent = data.code;
        document.getElementById('pairing-code-display').style.display = 'block';
        
        showNotification('Pairing code generated successfully!');
        
    } catch (error) {
        showNotification('Error: ' + error.message, true);
        console.error(error);
    }
}

// Check connection status
function startStatusCheck() {
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/session/' + currentSessionId);
            const data = await response.json();
            
            if (data.success && data.connected) {
                clearInterval(statusCheckInterval);
                showStep('step3');
                showNotification('Successfully connected!');
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 2000);
}

// Download credentials
async function downloadCreds() {
    try {
        const response = await fetch('/api/download/' + currentSessionId);
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'creds.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Credentials downloaded successfully!');
        
    } catch (error) {
        showNotification('Download error: ' + error.message, true);
        console.error(error);
    }
}

// Create new session
function createNewSession() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    currentSessionId = null;
    currentMethod = null;
    showStep('step1');
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
});
      
