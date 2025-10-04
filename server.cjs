const express = require("express");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const LINE_TOKEN = process.env.LINE_TOKEN || "";
const OPENAI_KEY = process.env.OPENAI_KEY || "";

function toText(x, fb=""){ if(!x) return fb; if(typeof x==="string") return x; try{return JSON.stringify(x)}catch{return String(x)} }

app.get("/", (_req, res) => res.send("OK"));

app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // 先に200でLINEのタイムアウト回避
  try {
    const events = req.body?.events || [];
    console.log("📩 Received events:", JSON.stringify(events, null, 2));

    for (const event of events) {
      if (event.type === "message" && event.message?.type === "text") {
        const userText = event.message.text;
        console.log("👤 User:", userText);

        let replyText = "すみません、もう一度お願いします。";
        try {
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type":"application/json", "Authorization":`Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({ model:"gpt-4o-mini", messages:[{ role:"user", content:userText }] })
          });
          const aiJson = await aiRes.json();
          console.log("🧠 OpenAI status:", aiRes.status, aiRes.statusText);
          replyText = aiRes.ok ? (aiJson?.choices?.[0]?.message?.content || replyText)
                               : "（OpenAIエラー）少し待ってもう一度お試しください。";
          if (!aiRes.ok) console.error("❌ OpenAI error body:", toText(aiJson));
        } catch (e) {
          console.error("❌ OpenAI fetch failed:", e);
          replyText = "（OpenAI接続エラー）もう一度お試しください。";
        }

        try {
          const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: { "Content-Type":"application/json", "Authorization":`Bearer ${LINE_TOKEN}` },
            body: JSON.stringify({ replyToken: event.replyToken, messages:[{ type:"text", text: replyText }] })
          });
          const lineText = await lineRes.text();
          if (!lineRes.ok) console.error("❌ LINE reply error:", lineRes.status, lineText);
          else console.log("✅ Replied to LINE");
        } catch (e) {
          console.error("❌ LINE reply failed:", e);
        }
      }
    }
  } catch (e) {
    console.error("❌ Handler failed:", e);
  }
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Bot running on http://localhost:3000"));
