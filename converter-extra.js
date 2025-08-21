import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';
import https from 'https';
import multer from 'multer';

export const config = {
  api: {
    bodyParser: false, // allow multer to handle form-data
  },
};

const upload = multer({ dest: '/tmp' }); // temp folder in Vercel

// Helper: parse upload
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  await runMiddleware(req, res, upload.single('file'));

  const filePath = req.file.path;
  const AUTH_URL = 'https://api.compdf.com/server/v1/oauth/token';
  const WORD_TO_PDF_TASK_URL = 'https://api.compdf.com/server/v1/task/word-to-pdf';
  const UPLOAD_FILE_URL = 'https://api.compdf.com/server/v1/file/upload';
  const EXECUTE_TASK_URL = 'https://api.compdf.com/server/v1/execute/start';
  const TASK_INFO_URL = 'https://api.compdf.com/server/v1/task/info';

  try {
    // 1. Auth with secret key (from Vercel env)
    const authRes = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: process.env.COMPDF_SECRET_KEY }),
    });
    const auth = await authRes.json();
    if (auth.code !== 200) throw new Error(auth.msg);
    const accessToken = auth.data.accessToken;

    // 2. Create task
    const taskRes = await fetch(WORD_TO_PDF_TASK_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const task = await taskRes.json();
    if (task.code !== 200) throw new Error(task.msg);
    const taskId = task.data.taskId;

    // 3. Upload file
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath), req.file.originalname);
    const uploadRes = await fetch(`${UPLOAD_FILE_URL}?taskId=${taskId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
    const uploaded = await uploadRes.json();
    if (uploaded.code !== 200) throw new Error(uploaded.msg);

    // 4. Execute task
    await fetch(EXECUTE_TASK_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    });

    // 5. Poll until success
    let taskInfo;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const infoRes = await fetch(`${TASK_INFO_URL}?taskId=${taskId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      taskInfo = await infoRes.json();
      if (taskInfo.data.taskStatus === 'success') break;
      if (taskInfo.data.taskStatus === 'failed') throw new Error('Conversion failed');
    }

    if (taskInfo.data.taskStatus !== 'success') throw new Error('Conversion timed out');

    // 6. Stream result
    https.get(taskInfo.data.downloadUrl, (fileStream) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${taskInfo.data.fileName}"`);
      fileStream.pipe(res);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send(`Server Error: ${err.message}`);
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
