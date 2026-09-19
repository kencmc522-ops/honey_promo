
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.query.cron !== '1' && req.method !== 'GET' && req.method !== 'POST') {
    // allow manual trigger ?cron=1
    return res.status(405).json({ error: 'use ?cron=1' });
  }

  const HF_TOKEN = process.env.HF_TOKEN;
  const IG_ID = process.env.IG_ID;
  const IG_TOKEN = process.env.IG_TOKEN;
  const IMGUR_CLIENT_ID = process.env.IMGUR_CLIENT_ID || '546c25a59c58ad7';
  const LOGO_URL = process.env.LOGO_URL || 'https://upload.cc/i1/2026/09/19/irPUSQ.png';

  if (!HF_TOKEN || !IG_ID || !IG_TOKEN) {
    return res.status(500).json({ error: 'Missing HF_TOKEN / IG_ID / IG_TOKEN env' });
  }

  try {
    // A1 日常刷存在感 - 輪播文案
    const dailyCopys = [
      "今天也要開心・日常日常・小小開店日常",
      "曬住太陽等你來・甜蜜密營業中",
      "吉祥物今日也在努力・甜蜜密爆餡雞蛋仔",
      "淺木・自然光・手作的溫度",
      "早安，今日也想見到你"
    ];
    const copy = dailyCopys[new Date().getDate() % dailyCopys.length];

    // 核心風格 Prompt - 已整合你3張參考圖的淺木系台灣文青風
    const prompt = `masterpiece, best quality, light wood aesthetic, Taiwanese wenqing minimalism, natural window light, soft morning sunlight, light oak wood table texture, beige wall, lots of white space, healing daily life photo, a cute egg waffle mascot character with smiling face sitting on table, mascot is main character, cozy small shop, shallow depth of field, film grain, warm tone, handwritten Chinese text corner "${copy}", shop name "甜蜜密爆餡雞蛋仔" subtle small font, inspired by light wood + natural light + handwritten style, 4k, highly detailed`;

    const negative = `lowres, bad anatomy, blurry, dark, neon colors, bold pop poster, crowded, too much text, text error, distorted mascot, scary, watermark`;

    // 1. Call Hugging Face SDXL
    async function callHF() {
      let r = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: prompt, parameters: { negative_prompt: negative } })
      });
      if (r.status === 503) {
        const j = await r.json().catch(()=>({estimated_time:20}));
        await new Promise(res=>setTimeout(res, (j.estimated_time||20)*1000));
        r = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: prompt, parameters: { negative_prompt: negative } })
        });
      }
      if (!r.ok) throw new Error('HF failed: '+await r.text());
      return Buffer.from(await r.arrayBuffer());
    }

    let imgBuffer = await callHF();

    // 2. Overlay Logo (吉祥物/logo) - 用 sharp 貼去右下角
    try {
      const sharp = (await import('sharp')).default;
      const logoRes = await fetch(LOGO_URL);
      if (logoRes.ok) {
        const logoBuf = Buffer.from(await logoRes.arrayBuffer());
        const logoResized = await sharp(logoBuf).resize(180,180,{fit:'inside'}).png().toBuffer();
        const meta = await sharp(imgBuffer).metadata();
        const w = meta.width || 1024;
        const h = meta.height || 1024;
        imgBuffer = await sharp(imgBuffer)
          .composite([{ input: logoResized, left: w-200, top: h-200, blend: 'over' }])
          .jpeg({ quality: 90 })
          .toBuffer();
      }
    } catch (e) {
      console.log('logo overlay failed', e.message);
    }

    // 3. Upload to Imgur to get permanent URL for IG
    const imgurForm = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { 'Authorization': `Client-ID ${IMGUR_CLIENT_ID}` },
      body: (()=>{ const fd = new FormData(); fd.append('image', new Blob([imgBuffer])); return fd; })()
    }).then(r=>r.json()).catch(async ()=>{
      // fallback base64
      const b64 = imgBuffer.toString('base64');
      const r2 = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { 'Authorization': `Client-ID ${IMGUR_CLIENT_ID}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: b64, type: 'base64' })
      });
      return r2.json();
    });

    if (!imgurForm.success) throw new Error('Imgur failed: '+JSON.stringify(imgurForm));
    const permanentUrl = imgurForm.data.link;

    // 4. Post to IG
    const caption = `${copy}\n\n甜蜜密爆餡雞蛋仔｜淺木系日常\n#雞蛋仔 #甜蜜密爆餡雞蛋仔 #香港小食 #文青`;

    const m1 = await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media?image_url=${encodeURIComponent(permanentUrl)}&caption=${encodeURIComponent(caption)}&access_token=${IG_TOKEN}`, { method: 'POST' }).then(r=>r.json());
    if (!m1.id) throw new Error('IG media create failed: '+JSON.stringify(m1));

    await new Promise(r=>setTimeout(r, 6000));
    const m2 = await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media_publish?creation_id=${m1.id}&access_token=${IG_TOKEN}`, { method: 'POST' }).then(r=>r.json());

    return res.json({ success: true, permanentUrl, ig_container: m1.id, ig_publish: m2, prompt, copy });

  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
