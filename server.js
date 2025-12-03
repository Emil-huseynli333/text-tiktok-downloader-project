// server.js - Bütün xətaları həll edən son versiya

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

    // 'let' istifadə edirik ki, dəyəri dəyişdirə bilək
    let { tiktokUrl } = req.body; 
    
    if (!tiktokUrl) {
        return res.status(400).json({ error: 'TikTok linki tələb olunur.' });
    }

    // 1. Qısa URL-i (vt.tiktok.com) Uzun URL-ə çeviririk (Qısa link xətasını həll edir)
    if (tiktokUrl.includes('vt.tiktok.com') || tiktokUrl.includes('m.tiktok.com')) {
        try {
            console.log(`[DEBUG] Qısa URL aşkar edildi, genişləndirilir: ${tiktokUrl}`);
            
            // maxRedirects: 0 ilə axios-un özünün yönləndirməni izləməsinin qarşısını alırıq.
            const redirectResponse = await axios.get(tiktokUrl, {
                maxRedirects: 0, 
                timeout: 10000,
                // Status 301/302/307-ni xəta kimi qəbul etməmək üçün
                validateStatus: (status) => status >= 200 && status < 400 
            });

            // Yönləndirmə Header-i yoxlanılır
            if (redirectResponse.headers.location) {
                tiktokUrl = redirectResponse.headers.location;
                console.log(`[DEBUG] Yeni Uzun URL: ${tiktokUrl}`);
            }

        } catch (redirectError) {
            // Əgər yönləndirmə xətası yaranarsa (adətən 301/302), URL-i Header-dən çıxarırıq.
            if (redirectError.response && redirectError.response.headers.location) {
                tiktokUrl = redirectError.response.headers.location;
                console.log(`[DEBUG] Yeni Uzun URL (xəta tutularaq): ${tiktokUrl}`);
            } else {
                console.error("[ERROR] Link genişləndirilərkən naməlum xəta:", redirectError.message);
                // Burada serveri dayandırmırıq ki, növbəti addımda ən azı orijinal link yoxlanılsın.
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
        // Geniş xəta tutma (Hər hansı bir şəbəkə/API problemini log edir)
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