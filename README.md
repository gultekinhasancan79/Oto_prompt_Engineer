# ✨ Prompt Enhancer

Chrome eklentisi: ChatGPT, Gemini, Claude vb. sitelerdeki metin kutularında prompt'larını AI ile geliştirir (Groq API).

## Özellikler

- **Prompt geliştirme** – Kısa/belirsiz metni detaylı prompt'a çevirir
- **Ardışık geliştirme** – Aynı metni defalarca geliştirebilirsin
- **Adım adım geri al** – Her ↩️ tıklamasında bir önceki versiyona döner
- **Dil koruma** – Türkçe yazarsan çıktı Türkçe kalır
- **Klavye kısayolu** – `Ctrl+Shift+E` ile hızlı geliştir
- **Çıktı dili** – Popup'tan Türkçe / İngilizce seçimi

## Kurulum

1. Repoyu indir veya clone'la
2. Chrome'da `chrome://extensions` aç
3. **Geliştirici modu**nu aç
4. **Paketlenmemiş öğe yükle** → Bu klasörü seç

## ⚠️ API Key (Önemli)

- **Bu repoda hiçbir API key yok.** Eklenti kendi key'ini kullanmaz.
- Key’i **sen** [Groq Console](https://console.groq.com/keys) üzerinden alıp eklenti popup’ına giriyorsun.
- Key yalnızca tarayıcıda `chrome.storage.local` içinde saklanır, sunucuya veya bu repoya gönderilmez.

**Asla yapma:**  
`.env`, `config.json` vb. dosyalara API key yazıp repoya commit etme.

## Kullanım

1. Eklenti ikonuna tıkla → Groq API Key’ini gir ve kaydet
2. ChatGPT, Gemini, Claude vb. bir sitede metin kutusuna yaz
3. Sağ alttaki **✨** butonuna tıkla veya `Ctrl+Shift+E` kullan
4. Geliştirilmiş metni tekrar geliştirebilir veya **↩️** ile bir önceki versiyona dönebilirsin

## Desteklenen siteler

ChatGPT, Gemini, Claude, Perplexity, Poe, Grok (x.com), DeepSeek, Mistral, HuggingFace Chat vb.

## Lisans

MIT
