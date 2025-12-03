// server.js faylı

require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public'))); 

app.post('/api/download', async (req, res) => {
    
    console.log("[DEBUG] /api/download endpointi çağırıldı."); 

    // let istifadə edirik ki, dəyəri dəyişdirə bilək
    let { tiktokUrl } = req.body; 
    
    // 👇👇👇 1. MOBİL LINK FORMATINI DÜZƏLT (400 XƏTASINI HƏLL EDİR) 👇👇👇
    if (tiktokUrl) {
        // decodeURIComponent ilə URL-lərdəki xüsusi simvolları təmizləyirik
        tiktokUrl = decodeURIComponent(tiktokUrl); 
    }
    // 👆👆👆 👆👆👆 👆👆👆 👆👆👆

    if (!tiktokUrl) {
        return res.status(400).json({ error: 'TikTok linki tələb olunur.' });
    }

    const API_HOST = process.env.RAPIDAPI_HOST;
    const API_ENDPOINT_PATH = '/media'; 
    const apiUrl = `https://${API_HOST}${API_ENDPOINT_PATH}`; 
    
    try {
        const response = await axios.get(apiUrl, {
            // 👇👇👇 2. TIMEOUT-u 30 SANİYƏYƏ QALDIRIRIQ 👇👇👇
            timeout: 30000, 
            params: {
                videoUrl: tiktokUrl
            },
            headers: {
                'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
                'X-RapidAPI-Host': API_HOST,
                'Host': API_HOST
            }
        });

        const data = response.data;
        let downloadUrl = null;
        
        // Düzgün link sahəsi: downloadUrl (CamelCase)
        if (data && data.downloadUrl) {
            downloadUrl = data.downloadUrl;
        } else if (data && data.video_url) {
            downloadUrl = data.video_url;
        } 
        
        if (response.status !== 200) {
             console.error(`[ERROR] RapidAPI xətası: Status ${response.status}`);
             return res.status(response.status).json({ error: `RapidAPI-dən xəta: ${response.status}` });
        }
        
        if (!downloadUrl) {
            console.error("[ERROR] Cavabda yüklənmə linki tapılmadı.");
            return res.status(404).json({ error: 'API cavabında yüklənmə linki tapılmadı.' });
        }

        res.json({ success: true, download_url: downloadUrl }); 

    } catch (error) {
        let errorMessage = 'Naməlum xəta baş verdi.';
        if (error.response) {
            errorMessage = `RapidAPI Xətası: ${error.response.status} - ${error.response.statusText}`;
        } else if (error.code === 'ECONNABORTED') {
            errorMessage = `Sorğu Vaxtı Bitdi (30s): ${error.message}`;
        } else {
            errorMessage = `Şəbəkə Xətası: ${error.message}`;
        }
        
        console.error('RapidAPI Sorğusu Uğursuz Oldu:', errorMessage);
        res.status(500).json({ 
            error: 'Video yüklənməsi uğursuz oldu.', 
            details: errorMessage 
        });
    }
});

app.listen(port, () => {
    console.log(`Server http://localhost:${port} ünvanında işləyir.`);
});