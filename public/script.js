let currentSessionId = null;
let currentMethod = null;
let statusCheckInterval = null;

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
    }, 4000);
}

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

async function selectMethod(method) {
    currentMethod = method;
    
    try {
        showNotification('Creating session...');
        
        const response = await fetch('/api/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to create session');
        }
        
        currentSessionId = data.sessionId;
        console.log('Session created:', currentSessionId);
        
        if (method === 'qr') {
            showStep('step2-qr');
            startQRCheck();
        } else {
            showStep('step2-pairing');
        }
        
        startStatusCheck();
        
    } catch (error) {
        showNotification('Error: ' + error.message, true);
        console.error(error);
    }
}

async function startQRCheck() {
    const loadingEl = document.getElementById('qr-loading');
    const qrContainer = document.getElementById('qr-code-container');
    const qrImage = document.getElementById('qr-code');
    
    let attempts = 0;
    const maxAttempts = 30;
    
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
                showNotification('QR Code ready! Scan it now.');
            }
        } catch (error) {
            console.error('QR check error:', error);
        }
    }, 1000);
}

async function getPairingCode() {
    const phoneInput = document.getElementById('phone');
    let phone = phoneInput.value.trim();
    
    // Remove all non-digits
    phone = phone.replace(/\D/g, '');
    
    if (!phone || phone.length < 10) {
        showNotification('Please enter a valid phone number (minimum 10 digits)', true);
        phoneInput.focus();
        return;
    }
    
    if (phone.length > 15) {
        showNotification('Phone number too long (maximum 15 digits)', true);
        phoneInput.focus();
        return;
    }
    
    // Show what we're sending
    console.log('Requesting code for:', phone);
    showNotification('Requesting pairing code...');
    
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
        
        document.getElementById('pairing-code').textContent = data.code;
        document.getElementById('pairing-code-display').style.display = 'block';
        
        showNotification('Pairing code generated! Enter it in WhatsApp now!');
        
    } catch (error) {
        console.error('Pairing error:', error);
        showNotification('Error: ' + error.message, true);
        
        // Show helpful tips
        setTimeout(() => {
            showNotification('Tip: Try using QR code method instead', false);
        }, 3000);
    }
}

function startStatusCheck() {
    statusCheckInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/session/' + currentSessionId);
            const data = await response.json();
            
            if (data.success && data.connected) {
                clearInterval(statusCheckInterval);
                showStep('step3');
                showNotification('Successfully connected to WhatsApp!');
            }
            
            if (data.loggedOut) {
                clearInterval(statusCheckInterval);
                showNotification('Session logged out. Please try again.', true);
                setTimeout(() => {
                    goBack();
                }, 2000);
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 2000);
}

async function downloadCreds() {
    try {
        const response = await fetch('/api/download/' + currentSessionId);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Download failed');
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
        
        showNotification('Credentials downloaded! Save it to your bot folder.');
        
    } catch (error) {
        showNotification('Download error: ' + error.message, true);
        console.error(error);
    }
}

function createNewSession() {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
    currentSessionId = null;
    currentMethod = null;
    
    // Clear inputs
    document.getElementById('phone').value = '';
    document.getElementById('pairing-code-display').style.display = 'none';
    
    showStep('step1');
}

// Auto-format phone number as user types
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            // Remove all non-digits
            let value = e.target.value.replace(/\D/g, '');
            // Limit to 15 digits
            value = value.substring(0, 15);
            e.target.value = value;
        });
        
        phoneInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                getPairingCode();
            }
        });
    }
});

window.addEventListener('beforeunload', () => {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
});
