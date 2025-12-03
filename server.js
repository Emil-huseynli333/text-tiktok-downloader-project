// server.js - Bütün xətaları (URL, Timeout, CORS) həll edən son versiya

require('dotenv').config(); 
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors'); // CORS dəstəyi üçün əlavə edildi

const app = express();
const port = 3000;

// CORS-u bütün sorğular üçün aktivləşdir (Android/Mobil tətbiq xətasını həll edir)
app.use(cors()); 

app.use(express.json()); 
app.use(express.static(path.join(__dirname, 'public'))); 

app.post('/api/download', async (req, res) => {
    
    console.log("[DEBUG] /api/download endpointi çağırıldı."); 

    // 'let' istifadə edirik ki, dəyəri dəyişdirə bilək
    let { tiktokUrl } = req.body; 
    
    if (!tiktokUrl) {
        return res.status(400).json({ error: 'TikTok linki tələb olunur.' });
    }

    // 1. Qısa URL-i (vt.tiktok.com) Uzun URL-ə çeviririk (Qısa link xətasını həll edir)
    if (tiktokUrl.includes('vt.tiktok.com') || tiktokUrl.includes('m.tiktok.com')) {
        try {
            console.log(`[DEBUG] Qısa URL aşkar edildi, genişləndirilir: ${tiktokUrl}`);
            
            const redirectResponse = await axios.get(tiktokUrl, {
                maxRedirects: 0, 
                timeout: 10000,
                validateStatus: (status) => status >= 200 && status < 400 
            });

            if (redirectResponse.headers.location) {
                tiktokUrl = redirectResponse.headers.location;
                console.log(`[DEBUG] Yeni Uzun URL: ${tiktokUrl}`);
            }

        } catch (redirectError) {
            if (redirectError.response && redirectError.response.headers.location) {
                tiktokUrl = redirectError.response.headers.location;
                console.log(`[DEBUG] Yeni Uzun URL (xəta tutularaq): ${tiktokUrl}`);
            } else {
                console.error("[ERROR] Link genişləndirilərkən naməlum xəta:", redirectError.message);
            }
        }
    }
    
    // 2. URL təmizlənməsi (Mobil 400 Bad Request xətasını həll edir)
    tiktokUrl = decodeURIComponent(tiktokUrl); 

    const API_HOST = process.env.RAPIDAPI_HOST;
    const API_ENDPOINT_PATH = '/media'; 
    const apiUrl = `https://${API_HOST}${API_ENDPOINT_PATH}`; 
    
    try {
        const response = await axios.get(apiUrl, {
            // 3. Timeout-u 30 saniyəyə qaldırır (Mobil şəbəkə sabitliyini təmin edir)
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
        
        // Linkin çıxarılması
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
        // Geniş xəta tutma
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