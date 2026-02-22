import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json());

// Serve static files from dist with /ghostshift prefix
app.use('/ghostshift', express.static(path.join(__dirname, 'dist')));

// Also serve root for health checks
app.use(express.static(path.join(__dirname, 'dist')));

// Handle SPA routing - serve index.html for all /ghostshift routes
app.get(/^\/ghostshift(\/.*)?$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`GhostShift server running on port ${PORT}`);
  console.log(`Access at: http://localhost:${PORT}/ghostshift/`);
});
