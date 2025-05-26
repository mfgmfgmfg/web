import '../styles/globals.css';
import { useEffect } from 'react';
const UAParser = require('ua-parser-js');

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const sendNewVisitorNotification = async () => {
      try {
        // 1. Check if user has visited before using localStorage
        const hasVisited = localStorage.getItem('hasSiteVisitedBefore');
        if (hasVisited) {
          // console.log('Returning visitor, no notification needed.');
          return;
        }

        // 2. Fetch IP and location data
        let ipAddress = 'Bilinmiyor';
        let locationData = { city: 'Bilinmiyor', country: 'Bilinmiyor' };
        let deviceInfoString = 'Bilinmiyor';

        if (typeof navigator !== 'undefined') {
          const parser = new UAParser(navigator.userAgent);
          const result = parser.getResult();
          // Örnek: Cihaz: iPhone, OS: iOS 15.4, Tarayıcı: Mobile Safari
          // Örnek: Cihaz: PC, OS: Windows 10, Tarayıcı: Chrome 98
          const device = result.device.model || result.device.type || 'PC/Dizüstü';
          const os = `${result.os.name || ''} ${result.os.version || ''}`.trim();
          const browser = `${result.browser.name || ''} ${result.browser.version || ''}`.trim();
          
          let parts = [];
          if (device && device !== 'PC/Dizüstü') parts.push(`Cihaz: ${device}`);
          else if (device === 'PC/Dizüstü' && result.device.vendor) parts.push(`Cihaz: ${result.device.vendor} ${device}`);
          else if (device === 'PC/Dizüstü') parts.push(`Cihaz: ${device}`);

          if (os) parts.push(`OS: ${os}`);
          if (browser) parts.push(`Tarayıcı: ${browser}`);
          
          deviceInfoString = parts.join(', ') || 'Detaylı bilgi yok';
        } else {
          deviceInfoString = 'Bilinmiyor (Sunucu Tarafı)';
        }

        try {
          const geoResponse = await fetch('https://ipapi.co/json/');
          if (geoResponse.ok) {
            const geoData = await geoResponse.json();
            ipAddress = geoData.ip || 'Bilinmiyor';
            locationData = {
              city: geoData.city || 'Bilinmiyor',
              country: geoData.country_name || 'Bilinmiyor',
              region: geoData.region || 'Bilinmiyor',
              latitude: geoData.latitude,
              longitude: geoData.longitude,
            };
          } else {
            console.warn('[New Visitor Notify] IP/Konum bilgisi alınamadı, durum:', geoResponse.status);
          }
        } catch (geoError) {
          console.error('[New Visitor Notify] IP/Konum alınırken hata:', geoError);
        }
        
        // 3. Prepare payload for Discord webhook
        const apiPayload = {
          ipAddress: ipAddress,
          locationData: locationData,
          deviceInfo: deviceInfoString,
          timestamp: new Date().toISOString(),
          eventType: 'new_site_visit',
          eventSpecificData: {},
        };

        // 4. Send notification to Discord webhook
        const response = await fetch('/api/discordWebhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiPayload),
        });

        if (response.ok) {
          // console.log('[New Visitor Notify] Yeni ziyaretçi bildirimi gönderildi.');
          localStorage.setItem('hasSiteVisitedBefore', 'true');
        } else {
          const result = await response.json();
          console.error('[New Visitor Notify] API Hatası:', result.error, result.details);
        }
      } catch (error) {
        console.error('[New Visitor Notify] Genel Hata:', error);
      }
    };

    // Run only on client-side
    if (typeof window !== 'undefined') {
      sendNewVisitorNotification();
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return <Component {...pageProps} />;
}

export default MyApp;
