// pages/api/discordWebhook.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('[Discord API] DISCORD_WEBHOOK_URL ortam değişkeni ayarlanmamış.');
    return res.status(500).json({ error: 'Discord webhook URL yapılandırılmamış' });
  }

  try {
    // Gelen tüm istek gövdesini loglayalım (hata ayıklama için)
    // Bu log, req.body'nin yapısını görmek için önemlidir ancak stringify işlemi hata verirse diye try bloğu içine alındı.
    console.log('[Discord API] Gelen istek gövdesi:', JSON.stringify(req.body, null, 2));
    const { ipAddress, locationData, timestamp, eventType, eventSpecificData, deviceInfo } = req.body;

    if (!eventType) {
        console.error('[Discord API] İstek gövdesinde eventType (olay türü) eksik.');
        // eventType eksikse Discord'a özel bir hata mesajı gönder
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: "⚠️ Sunucuda bir bildirim hatası oluştu: Olay türü (eventType) belirtilmemiş." }),
        });
        return res.status(400).json({ error: 'eventType (olay türü) gerekli' });
    }
    
    // eventSpecificData'nın her zaman bir obje olmasını garantile
    const safeEventSpecificData = eventSpecificData || {};

    const embeds = [];
    let baseEmbed = {
      timestamp: timestamp || new Date().toISOString(),
      footer: {
        text: `IP: ${ipAddress || 'Bilinmiyor'} | Konum: ${locationData?.city || 'Bilinmiyor'}, ${locationData?.country || 'Bilinmiyor'}${deviceInfo ? ` | Cihaz: ${deviceInfo}` : ''}`,
      },
    };

    switch (eventType) {
      case 'new_site_visit':
        embeds.push({
          ...baseEmbed,
          title: '🚀 Yeni Site Ziyareti',
          color: 0x5865F2, // Discord Blurple
          description: `Bir kullanıcı siteyi ziyaret etti.`,
        });
        break;

      case 'guestbook_entry':
        embeds.push({
          ...baseEmbed,
          title: '📝 Yeni Ziyaretçi Defteri Mesajı',
          color: 0x3498db, // Mavi
          fields: [
            { name: 'Gönderen', value: safeEventSpecificData.userDisplay || 'Anonim', inline: true },
            { name: 'Mesaj', value: safeEventSpecificData.message || 'İçerik yok' },
          ],
        });
        break;

      case 'new_visitor_note':
        embeds.push({
          ...baseEmbed,
          title: '📌 Yeni Ziyaretçi Notu Bırakıldı',
          color: 0x2ecc71, // Yeşil
          fields: [
            { name: 'Not İçeriği', value: safeEventSpecificData.noteText || 'İçerik yok' },
          ],
        });
        break;

      case 'surprise_comment':
        embeds.push({
          ...baseEmbed,
          title: '💬 Sürpriz Kutusuna Yeni Yorum',
          color: 0x9b59b6, // Mor
          fields: [
            { name: 'Yorum Yapan', value: safeEventSpecificData.userDisplay || 'Anonim', inline: true },
            { name: 'Sürpriz Mesajı', value: safeEventSpecificData.originalMessage || 'Belirtilmemiş', inline: true },
            { name: 'Yorum', value: safeEventSpecificData.comment || 'İçerik yok' },
          ],
        });
        break;
        
      case 'emotion_submitted':
            let latitude, longitude;
            const coordsString = safeEventSpecificData.coordinates; // örn: "34.0522, -118.2437"
            if (coordsString) {
                const parts = coordsString.split(',');
                if (parts.length === 2) {
                    latitude = parseFloat(parts[0].trim());
                    longitude = parseFloat(parts[1].trim());
                }
            }

            let staticMapUrl = null;
            let googleMapsUrl = null;
            if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
                // Basit bir statik harita URL'si (API anahtarı gerektirmeyen bir servis örneği)
                // Boyutları ve zoom seviyesini ihtiyacınıza göre ayarlayabilirsiniz.
                staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=14&size=500x300&maptype=mapnik&markers=${latitude},${longitude},blue-pushpin`;
                googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
            }

            const emotionEmbed = {
              ...baseEmbed,
              title: `💖 Yeni Duygu Eklendi: ${safeEventSpecificData.emotion || 'Bilinmiyor'}`,
              description: `Kullanıcı **${safeEventSpecificData.emotion || 'bilinmeyen'}** duygusunu haritaya ekledi.`,
              color: 0xe91e63, // Pembe/Kırmızı
              fields: [],
            };

            if (googleMapsUrl) {
              emotionEmbed.fields.push({ name: '📍 Konum Detayları', value: `[Google Haritalar'da Görüntüle](${googleMapsUrl})`, inline: false });
            } else if (coordsString) { // Eğer Google Maps linki oluşturulamazsa, sadece koordinatları göster
              emotionEmbed.fields.push({ name: 'Koordinatlar', value: coordsString, inline: true });
            }
            
            if (staticMapUrl) {
              emotionEmbed.image = { url: staticMapUrl };
            }

            embeds.push(emotionEmbed);
            break;

      default:
        console.warn(`[Discord API] Bilinmeyen eventType (olay türü) alındı: '${eventType}'. Genel bildirim gönderiliyor.`);
        embeds.push({
            ...baseEmbed,
            title: `⚠️ Bilinmeyen Olay Türü Alındı: ${eventType}`,
            description: `Bu olay türü için özel bir bildirim formatı tanımlanmamış.\nAlınan özel veri: \`\`\`json\n${JSON.stringify(safeEventSpecificData, null, 2)}\n\`\`\``,
            color: 0x7f8c8d, // Gri
        });
    }

    if (embeds.length === 0) {
        console.log('[Discord API] Bu olay türü için embed oluşturulmadı:', eventType);
        return res.status(200).json({ message: 'Bu olay türü için embed oluşturulmadı veya olay farklı şekilde işlendi.' });
    }

    const discordResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds }),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error(`[Discord API] Discord gönderme hatası (${discordResponse.status}), olay türü '${eventType}':`, errorText);
      return res.status(discordResponse.status).json({ error: 'Mesaj Discord\'a gönderilemedi', details: errorText });
    }

    return res.status(200).json({ message: 'Embed ile bildirim gönderildi' });

  } catch (error) {
    console.error('[Discord API] Sunucu içi hata:', error.message, error.stack);
    // Discord'a genel bir hata mesajı da gönder
     await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: `🚨 Sunucuda kritik bir bildirim hatası oluştu: ${error.message}` }),
    });
    return res.status(500).json({ error: 'Sunucu içi hata', details: error.message });
  }
}