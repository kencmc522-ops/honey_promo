
export const config = { runtime: 'edge' };
import { ImageResponse } from '@vercel/og';

const IMGUR_ID = process.env.IMGUR_CLIENT_ID || '546c25a59c58ad7';
let gallery = globalThis._gallery || [];
globalThis._gallery = gallery;

async function generateWaffleImage() {
  const today = new Date().toLocaleDateString('zh-HK',{month:'short',day:'numeric'});
  const menus = [
    {name:'芝麻', price:'$70', desc:'黑芝麻爆餡'},
    {name:'原味', price:'$60', desc:'經典港式'},
    {name:'朱古力', price:'$75', desc:'比利時朱古力'},
    {name:'抹茶', price:'$75', desc:'京都抹茶'},
  ];
  const item = menus[new Date().getDate() % menus.length];
  
  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: { display:'flex', flexDirection:'column', width:'1080px', height:'1080px', background:'#fdf6e3', padding:'60px', fontFamily:'sans-serif' },
        children: [
          { type:'div', props:{ style:{fontSize:'32px', color:'#8d6e63'}, children: today } },
          { type:'div', props:{ style:{marginTop:'40px', display:'flex', gap:'40px'}, children: [
            { type:'div', props:{ style:{width:'600px', height:'600px', background:'#fff', borderRadius:'40px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'200px'}, children: '🧇' }},
            { type:'div', props:{ style:{display:'flex', flexDirection:'column'}, children: [
              { type:'div', props:{ style:{fontSize:'96px', fontWeight:'900', color:'#3e2723'}, children: item.name }},
              { type:'div', props:{ style:{fontSize:'72px', color:'#bf360c', marginTop:'20px'}, children: item.price }},
              { type:'div', props:{ style:{fontSize:'36px', color:'#5d4037', marginTop:'30px'}, children: item.desc }},
              { type:'div', props:{ style:{fontSize:'28px', color:'#8d6e63', marginTop:'60px'}, children: '每日新鮮出爐 | 觀塘' }},
            ]}}
          ]},
          { type:'div', props:{ style:{marginTop:'auto', fontSize:'28px', color:'#a1887f'}, children: '@eggette.daily' }}
        ]
      }
    },
    { width:1080, height:1080 }
  );
}

async function uploadToImgur(imageBlob) {
  const arrayBuf = await imageBlob.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  const res = await fetch('https://api.imgur.com/3/image', {
    method:'POST',
    headers:{ 'Authorization': `Client-ID ${IMGUR_ID}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ image: base64, type:'base64' })
  });
  const data = await res.json();
  return data;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const isCron = url.searchParams.get('cron') === '1' || req.headers.get('x-vercel-cron') === '1';

  // GET = 睇相簿 或 Cron 觸發自動生圖
  if (req.method === 'GET') {
    if (isCron) {
      // Cron 自動生圖流程
      const imgRes = await generateWaffleImage();
      const blob = await imgRes.blob();
      const imgurData = await uploadToImgur(blob);
      if (!imgurData.success) return new Response(JSON.stringify(imgurData), {status:500});
      const permanentUrl = imgurData.data.link;
      gallery.unshift({ url: permanentUrl, time: new Date().toISOString(), auto:true });
      globalThis._gallery = gallery;

      // 自動出 IG (如有 ENV)
      const IG_ID = process.env.IG_ID;
      const IG_TOKEN = process.env.IG_TOKEN;
      if (IG_ID && IG_TOKEN) {
        const cap = `芝麻 $70 今日 ${new Date().toLocaleDateString()} #雞蛋仔`;
        const m1 = await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media?image_url=${encodeURIComponent(permanentUrl)}&caption=${encodeURIComponent(cap)}&access_token=${IG_TOKEN}`, {method:'POST'}).then(r=>r.json());
        if (m1.id) {
          await new Promise(r=>setTimeout(r,4000));
          await fetch(`https://graph.facebook.com/v18.0/${IG_ID}/media_publish?creation_id=${m1.id}&access_token=${IG_TOKEN}`, {method:'POST'});
        }
      }
      return new Response(JSON.stringify({ success:true, cron:true, permanentUrl, gallery }), {headers:{'Content-Type':'application/json'}});
    }
    return new Response(JSON.stringify({ gallery, tip:'GET ?cron=1 to trigger daily post' }), {headers:{'Content-Type':'application/json'}});
  }

  // POST = 舊版，呢度生完 POST 過嚟
  if (req.method === 'POST') {
    const body = await req.json();
    const base64 = body.image_base64;
    if (!base64) return new Response(JSON.stringify({error:'need image_base64'}),{status:400});
    const clean = base64.includes(',') ? base64.split(',')[1] : base64;
    const imgurRes = await fetch('https://api.imgur.com/3/image', {
      method:'POST',
      headers:{'Authorization':`Client-ID ${IMGUR_ID}`, 'Content-Type':'application/json'},
      body: JSON.stringify({ image: clean, type:'base64' })
    });
    const data = await imgurRes.json();
    if (!data.success) return new Response(JSON.stringify(data),{status:500});
    gallery.unshift({ url: data.data.link, caption: body.caption||'', time: new Date().toISOString() });
    globalThis._gallery = gallery;
    return new Response(JSON.stringify({ success:true, permanentUrl: data.data.link, gallery }), {headers:{'Content-Type':'application/json'}});
  }
  return new Response('Method not allowed',{status:405});
}
