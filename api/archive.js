export const config = { runtime: 'nodejs' };
import { Resvg } from '@resvg/resvg-js';

export default async function handler(req, res) {
  const IMGUR_ID = process.env.IMGUR_CLIENT_ID || '546c25a59c58ad7';
  const isCron = req.query && req.query.cron === '1';

  if (req.method === 'GET' && !isCron) {
    return res.status(200).json({gallery: global._gallery || [], tip: "Add ?cron=1 to trigger PNG upload"});
  }

  try {
    const today = new Date().toLocaleDateString('zh-HK',{month:'short',day:'numeric'});
    const menus = [
      {name:'芝麻', price:'$70', desc:'黑芝麻爆餡'},
      {name:'原味', price:'$60', desc:'經典港式'},
      {name:'朱古力', price:'$75', desc:'比利時朱古力'},
      {name:'抹茶', price:'$75', desc:'京都抹茶'},
    ];
    const item = menus[new Date().getDate() % menus.length];
    const svg = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1080" fill="#fdf6e3"/><text x="60" y="80" font-family="Arial" font-size="32" fill="#8d6e63">${today}</text><rect x="60" y="140" width="600" height="600" rx="40" fill="#ffffff"/><text x="360" y="520" text-anchor="middle" font-size="200">🧇</text><text x="720" y="280" font-family="Arial" font-size="96" font-weight="900" fill="#3e2723">${item.name}</text><text x="720" y="380" font-family="Arial" font-size="72" fill="#bf360c" font-weight="700">${item.price}</text><text x="720" y="450" font-family="Arial" font-size="36" fill="#5d4037">${item.desc}</text><text x="720" y="550" font-family="Arial" font-size="28" fill="#8d6e63">每日新鮮出爐</text><text x="60" y="1010" font-family="Arial" font-size="28" fill="#a1887f">@eggette.daily</text></svg>`;
    
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
    const pngData = resvg.render().asPng();
    const base64 = Buffer.from(pngData).toString('base64');
    
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method:'POST',
      headers:{ 'Authorization': 'Client-ID ' + IMGUR_ID, 'Content-Type':'application/json' },
      body: JSON.stringify({ image: base64, type:'base64' })
    });
    const imgurData = await imgurRes.json();
    if (!imgurData.success) {
      return res.status(500).json({error:'Imgur failed', detail: imgurData});
    }
    const permanentUrl = imgurData.data.link;
    global._gallery = global._gallery || [];
    global._gallery.unshift({url: permanentUrl, time: new Date().toISOString(), name: item.name});

    const IG_ID = process.env.IG_ID;
    const IG_TOKEN = process.env.IG_TOKEN;
    let igResult = null;
    if (IG_ID && IG_TOKEN) {
      const caption = `${item.name} ${item.price} 今日 ${today} #雞蛋仔`;
      const m1 = await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media?image_url=${encodeURIComponent(permanentUrl)}&caption=${encodeURIComponent(caption)}&access_token=${IG_TOKEN}`, {method:'POST'}).then(r=>r.json());
      igResult = m1;
      if (m1.id) {
        await new Promise(r=>setTimeout(r,4000));
        await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media_publish?creation_id=${m1.id}&access_token=${IG_TOKEN}`, {method:'POST'});
      }
    }

    return res.status(200).json({ success:true, permanentUrl, ig: igResult, gallery: global._gallery });
  } catch (e) {
    return res.status(500).json({error: e.message, stack: e.stack});
  }
}
