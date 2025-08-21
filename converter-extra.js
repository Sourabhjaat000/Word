// server.js - Final Version with Correct ComPDF URLs

// 1. You must install these libraries on your server by running:
//    npm install express cors multer node-fetch form-data
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const https = require('https');

// 2. Server setup
const app = express();
app.use(cors());
const upload = multer({ dest: 'uploads/' }); // Temporary folder for uploads

// 3. --- YOUR KEYS (No changes needed here) ---
const COMPDF_PUBLIC_KEY = 'public_key_793d399f8ae7e9b8b86610e37b56cd4d';
const COMPDF_SECRET_KEY = 'secret_key_d281df41c81ea80235ba83f6f228157a';

// 4. --- ALL THE CORRECT API URLs ARE HERE (I have updated this section) ---
const AUTH_URL = 'https://api.compdf.com/server/v1/oauth/token';
const WORD_TO_PDF_TASK_URL = 'https://api.compdf.com/server/v1/task/word-to-pdf'; // This is the specific URL you needed
const UPLOAD_FILE_URL = 'https://api.compdf.com/server/v1/file/upload';
const EXECUTE_TASK_URL = 'https://api.compdf.com/server/v1/execute/start';
const TASK_INFO_URL = 'https://api.compdf.com/server/v1/task/info';

// Helper function to get the Authentication Token
async function getAuthToken() {
    const response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicKey: COMPDF_PUBLIC_KEY, secretKey: COMPDF_SECRET_KEY })
    });
    const data = await response.json();
    if (data.code !== 200) throw new Error(`Failed to get auth token: ${data.msg}`);
    return data.data.accessToken;
}

// Main /convert endpoint that your website will call
app.post('/convert', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;

    try {
        console.log("Step 1: Getting authentication token...");
        const accessToken = await getAuthToken();

        console.log("Step 2: Creating Word to PDF conversion task...");
        const createTaskResponse = await fetch(WORD_TO_PDF_TASK_URL, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const taskData = await createTaskResponse.json();
        if (taskData.code !== 200) throw new Error(`Failed to create task: ${taskData.msg}`);
        const taskId = taskData.data.taskId;
        console.log(`   > Task created with ID: ${taskId}`);

        console.log("Step 3: Uploading file...");
        const formData = new FormData();
        formData.append('file', fs.createReadStream(filePath), req.file.originalname);
        const uploadResponse = await fetch(`${UPLOAD_FILE_URL}?taskId=${taskId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.code !== 200) throw new Error(`File upload failed: ${uploadData.msg}`);

        console.log("Step 4: Executing conversion task...");
        const executeTaskResponse = await fetch(EXECUTE_TASK_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId })
        });
        const executeData = await executeTaskResponse.json();
        if (executeData.code !== 200) throw new Error(`Task execution failed: ${executeData.msg}`);

        console.log("Step 5: Checking task status...");
        let taskInfo;
        let attempts = 0;
        const maxAttempts = 20; // Check for 20 seconds max

        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
            const taskInfoResponse = await fetch(`${TASK_INFO_URL}?taskId=${taskId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            taskInfo = await taskInfoResponse.json();

            if (taskInfo.data.taskStatus === 'success') {
                console.log("   > Conversion successful!");
                break;
            }
            if (taskInfo.data.taskStatus === 'failed') {
                throw new Error('ComPDF reported that the conversion task failed.');
            }
            attempts++;
            console.log(`   > Status is '${taskInfo.data.taskStatus}', checking again...`);
        }

        if (taskInfo.data.taskStatus !== 'success') {
            throw new Error('Conversion task timed out.');
        }

        console.log("Step 6: Downloading converted file...");
        const downloadUrl = taskInfo.data.downloadUrl;

        // Securely stream the file directly to the user's browser
        https.get(downloadUrl, (fileStream) => {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${taskInfo.data.fileName}"`);
            fileStream.pipe(res);
        });

    } catch (error) {
        console.error('An error occurred in the conversion process:', error);
        res.status(500).send(`Server Error: ${error.message}`);
    } finally {
        // Clean up the temporary file from the server
        fs.unlinkSync(filePath);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server for ComPDF is running on port ${PORT}`);
});
