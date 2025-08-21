// converter-extra.js

document.addEventListener('DOMContentLoaded', () => {
    // Get references to the necessary DOM elements
    const convertBtn = document.getElementById('convertBtn');
    const fileInput = document.getElementById('file-input');
    const messageArea = document.getElementById('message-area');
    
    console.log('NOTICE: Using public key in client JS as per request.');

    // Add click event listener to the "Convert" button
    convertBtn.addEventListener('click', () => {
        const file = fileInput.files[0];

        // 1. --- VALIDATE FILE INPUT ---
        if (!file) {
            messageArea.textContent = 'Please select a file first.';
            messageArea.className = 'cvt-message error';
            return;
        }

        const fileName = file.name.toLowerCase();
        const allowedExtensions = ['.doc', '.docx', '.pdf'];

        if (!allowedExtensions.some(ext => fileName.endsWith(ext))) {
            messageArea.textContent = 'Invalid file type. Please upload a DOC, DOCX, or PDF file.';
            messageArea.className = 'cvt-message error';
            fileInput.value = ''; // Clear the invalid selection
            document.getElementById('file-name').textContent = '';
            return;
        }

        // 2. --- SEND FILE TO API ---
        messageArea.textContent = 'Uploading and converting... Please wait.';
        messageArea.className = 'cvt-message progress';

        const formData = new FormData();
        formData.append('file', file);

        const publicKey = 'public_key_793d399f8ae7e9b8b86610e37b56cd4d';
        const apiUrl = `https://api.example.com/convert?key=${publicKey}`;

        fetch(apiUrl, {
            method: 'POST',
            body: formData,
        })
        .then(response => {
            if (!response.ok) {
                // If the server responds with an error, create a rejected promise
                // to be caught by the .catch() block.
                throw new Error('Conversion failed. The server responded with an error.');
            }
            // The API is expected to return the converted file as a blob
            return response.blob();
        })
        .then(blob => {
            // 3. --- HANDLE SUCCESSFUL CONVERSION ---
            messageArea.textContent = 'Success! Your file is ready for download.';
            messageArea.className = 'cvt-message success';

            // Create a temporary link to trigger the download
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            
            // Generate a new filename with a .pdf extension
            const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.'));
            a.download = `${originalNameWithoutExt}.pdf`;
            
            document.body.appendChild(a);
            a.click(); // Trigger the download
            
            // Clean up the temporary URL and link element
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
        })
        .catch(error => {
            // 4. --- HANDLE ERRORS GRACEFULLY ---
            console.error('API Call Error:', error);
            messageArea.textContent = `Error: ${error.message} Please try again.`;
            messageArea.className = 'cvt-message error';
            // Fallback: No server-side logic exists in the provided code.
            // The user can simply correct the issue (e.g., check internet) and try again.
        });
    });
});
