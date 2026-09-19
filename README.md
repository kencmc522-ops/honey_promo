# 甜蜜密爆餡雞蛋仔 A1 自動出圖

## 流程
Vercel Cron 每日 20:00 (香港) -> HuggingFace SDXL 免費生淺木系文青圖 (A1 日常刷存在感) -> sharp 疊加 Logo https://upload.cc/i1/2026/09/19/irPUSQ.png -> Imgur 永久URL -> IG 自動發佈

## 環境變數 (Vercel Settings -> Env)
HF_TOKEN=hf_xxx (huggingface.co 申請免費 Read token)
IG_ID=你的IG商業帳號ID
IG_TOKEN=你的長期IG Token
IMGUR_CLIENT_ID=546c25a59c58ad7 (可用我預設)
LOGO_URL=https://upload.cc/i1/2026/09/19/irPUSQ.png

## Deploy
vercel --prod
然後手動試一次: https://你的域名/api/archive?cron=1

## 風格已整合
你3張參考圖 vIYZMt.png / T7AwNW.png / bE6QnO.png -> Prompt 已轉做 light wood + natural light + Taiwanese handwritten
公司名：甜蜜密爆餡雞蛋仔
吉祥物：logo入面雞蛋仔公仔
