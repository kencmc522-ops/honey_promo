export const config = { runtime: 'nodejs', maxDuration: 60 };

export default async function handler(req, res) {
  const HF_TOKEN = process.env.HF_TOKEN;
  const IG_ID = process.env.IG_ID;
  const IG_TOKEN = process.env.IG_TOKEN;
  const LOGO_URL = process.env.LOGO_URL || 'https://upload.cc/i1/2026/09/19/irPUSQ.png';
  const IMGUR_ID = process.env.IMGUR_CLIENT_ID || '546c25a59c58ad7';

  try {
    const copy = "今天也要開心・日常日常";
    const prompt = `masterpiece, light wood aesthetic, Taiwanese wenqing minimalism, natural window light, light oak wood table, beige wall, cute egg waffle mascot sitting, healing daily life, shop name 甜蜜密爆餡雞蛋仔, 4k`;

    let imgBuffer = null;

    // 嘗試 1: HuggingFace
    try {
      const controller = new AbortController();
      const t = setTimeout(()=>controller.abort(), 45000);
      let r = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json', 'x-wait-for-model': 'true' },
        body: JSON.stringify({ inputs: prompt, options: { wait_for_model: true } }),
        signal: controller.signal
      });
      clearTimeout(t);
      if (r.ok) imgBuffer = Buffer.from(await r.arrayBuffer());
    } catch (e) { console.log('HF failed, fallback', e.message); }

    // 嘗試 2: 後備 Pollinations 免費 (一定得)
    if (!imgBuffer) {
      const polliUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ' Taiwanese light wood style') }?width=1080&height=1080&nologo=true&model=flux`;
      const pr = await fetch(polliUrl);
      if (!pr.ok) throw new Error('Pollinations failed '+pr.status);
      imgBuffer = Buffer.from(await pr.arrayBuffer());
    }

    // 疊加 Logo
    try {
      const sharp = (await import('sharp')).default;
      const logoBuf = Buffer.from(await (await fetch(LOGO_URL)).arrayBuffer());
      const resized = await sharp(logoBuf).resize(180,180).png().toBuffer();
      const meta = await sharp(imgBuffer).metadata();
      imgBuffer = await sharp(imgBuffer).composite([{ input: resized, left: (meta.width||1024)-200, top: (meta.height||1024)-200 }]).jpeg({quality:90}).toBuffer();
    } catch {}

    // 上 Imgur
    const b64 = imgBuffer.toString('base64');
    const imgur = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: { 'Authorization': `Client-ID ${IMGUR_ID}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64, type: 'base64' })
    }).then(r=>r.json());
    if (!imgur.success) throw new Error(JSON.stringify(imgur));
    const permanentUrl = imgur.data.link;

    // 出 IG
    const caption = `${copy}\n甜蜜密爆餡雞蛋仔 #文青`;
    const m1 = await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media?image_url=${encodeURIComponent(permanentUrl)}&caption=${encodeURIComponent(caption)}&access_token=${IG_TOKEN}`, {method:'POST'}).then(r=>r.json());
    await new Promise(r=>setTimeout(r,6000));
    const m2 = await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media_publish?creation_id=${m1.id}&access_token=${IG_TOKEN}`, {method:'POST'}).then(r=>r.json());

    return res.json({ success:true, permanentUrl, ig:m2, used: imgBuffer ? 'ok' : 'failed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
