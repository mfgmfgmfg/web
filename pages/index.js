import Head from 'next/head';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from "framer-motion"; 
import { supabase } from '../lib/supabase'; // Supabase client importu
const UAParser = require('ua-parser-js');
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

const initialStations = [
  { name: 'Virgin Radio Türkiye', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/VIRGIN_RADIOAAC.aac' },
  { name: 'Kral Pop', url: 'http://kralpopsc.radyotvonline.com/kralpop' },
  { name: 'PowerTürk', url: 'http://icast.powergroup.com.tr/PowerTurk/mpeg/128/tunein' },
  { name: 'Slow Türk', url: 'https://radyo.dogannet.tv/slowturk' },
  { name: 'Lofi Girl Radio', url: 'https://play.streamafrica.net/lofiradio' }, // Note: This stream URL might change
  { name: 'SomaFM: Groove Salad', url: 'http://ice1.somafm.com/groovesalad-128-mp3' },
  { name: 'SomaFM: Drone Zone', url: 'http://ice1.somafm.com/dronezone-128-mp3' },
  { name: 'Chillhop Radio', url: 'http://stream.chillhop.com/api/listen/chillhop' }, // Example, check if CORS allows
];

// Helper Components for the Map
const HeatmapLayerComponent = ({ points, useMapHook }) => {
  const map = useMapHook();
  useEffect(() => {
    let heatLayerInstance = null; // Store layer instance
    if (map && points && points.length > 0 && typeof window !== 'undefined') {
      const L = require('leaflet');
      require('leaflet.heat');
      heatLayerInstance = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 18,
        gradient: {0.4: 'blue', 0.65: 'lime', 1: 'red'}
      }).addTo(map);
    }
    return () => {
      // Robust cleanup
      if (map && heatLayerInstance && map.hasLayer(heatLayerInstance)) {
        map.removeLayer(heatLayerInstance);
      }
    };
  }, [points, map]);
  return null;
};

const MarkersComponent = ({ points, useMapHook }) => {
  const map = useMapHook();
  useEffect(() => {
    let markerLayerInstance = null; // Store layer instance
    if (map && points && points.length > 0 && typeof window !== 'undefined') {
      const L = require('leaflet');
      const markers = points.map(point => {
        if (point && typeof point.lat === 'number' && typeof point.lng === 'number') {
          const popupContent = point.emotion ? `Duygu: ${point.emotion}` : 'Konum';
          return L.marker([point.lat, point.lng]).bindPopup(popupContent);
        }
        return null;
      }).filter(marker => marker !== null);
      if (markers.length > 0) {
        markerLayerInstance = L.layerGroup(markers).addTo(map);
      }
    }
    return () => {
      // Robust cleanup
      if (map && markerLayerInstance && map.hasLayer(markerLayerInstance)) {
        map.removeLayer(markerLayerInstance);
      }
    };
  }, [points, map]);
  return null;
};

// New MapComponentBundle to encapsulate all Leaflet logic
const MapComponentBundle = ({ userLocation, currentEmotion, heatmapPoints, markerPoints, center, zoom, externalMapRef }) => {
  const [RL, setRL] = useState(null); // For ReactLeaflet components

  useEffect(() => {
    // Leaflet Icon Fix
    if (typeof window !== 'undefined') {
      const L = require('leaflet');
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/images/marker-icon-2x.png',
        iconUrl: '/images/marker-icon.png',
        shadowUrl: '/images/marker-shadow.png',
      });
    }

    // Dynamically import react-leaflet components
    Promise.all([
      import('react-leaflet').then(mod => mod.MapContainer),
      import('react-leaflet').then(mod => mod.TileLayer),
      import('react-leaflet').then(mod => mod.Marker),
      import('react-leaflet').then(mod => mod.Popup),
      import('react-leaflet').then(mod => mod.useMap),
    ]).then(([MapContainer, TileLayer, Marker, Popup, useMap]) => {
      setRL({ MapContainer, TileLayer, Marker, Popup, useMap });
    });
  }, []);

  if (!RL) {
    return <div className="h-full w-full flex items-center justify-center"><p className="text-white">Harita modülleri yükleniyor...</p></div>;
  }

  return (
    <RL.MapContainer center={center} zoom={zoom} ref={externalMapRef} style={{ height: '100%', width: '100%' }}>
      <RL.TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {userLocation && (
        <RL.Marker position={[userLocation.lat, userLocation.lng]}>
          <RL.Popup>Buradasınız! <br/> Duygunuz: {currentEmotion || "Seçilmedi"}</RL.Popup>
        </RL.Marker>
      )}
      {heatmapPoints && heatmapPoints.length > 0 && (
        <HeatmapLayerComponent points={heatmapPoints} useMapHook={RL.useMap} />
      )}
      {markerPoints && markerPoints.length > 0 && (
        <MarkersComponent points={markerPoints} useMapHook={RL.useMap} />
      )}
    </RL.MapContainer>
  );
};

const IndexPage = () => {
  // Existing states for IndexPage
  // const [visitorCount, setVisitorCount] = useState(null); // Ziyaretçi sayacı kaldırıldı
  const [surpriseCommentsList, setSurpriseCommentsList] = useState([]);
  const [surpriseCommentsLoading, setSurpriseCommentsLoading] = useState(false);
  const [surpriseCommentSubmitStatus, setSurpriseCommentSubmitStatus] = useState('');
  const [randomMessage, setRandomMessage] = useState("");
  const [emotion, setEmotion] = useState(""); 
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState("");
  const [lastNote, setLastNote] = useState(null); // Initialize with null
  const [guestbookEntries, setGuestbookEntries] = useState([]);
  const [newGuestbookMessage, setNewGuestbookMessage] = useState(""); // newGuestbookName state removed
  const [guestbookLoading, setGuestbookLoading] = useState(true);
  const [guestbookSubmitStatus, setGuestbookSubmitStatus] = useState("");
  const [counter, setCounter] = useState(0); // counter state'i yeniden eklendi
  const [isRunning, setIsRunning] = useState(false);
  const [gameState, setGameState] = useState("idle");
  const [userGuess, setUserGuess] = useState("");
  const [randomNumber, setRandomNumber] = useState(null);
  const [guessMessage, setGuessMessage] = useState("");
  const [userLocation, setUserLocation] = useState(null); 
  const [mapCenter, setMapCenter] = useState([39.9334, 32.8597]); 
  const [zoomLevel, setZoomLevel] = useState(6); 
  const [heatmapData, setHeatmapData] = useState([]);
  const [emotionMapMarkers, setEmotionMapMarkers] = useState([]); 
  const [locationDetails, setLocationDetails] = useState(null);
  const mapRef = useRef(null);
  const [surpriseComment, setSurpriseComment] = useState(""); // State for surprise comment
  // Removed: showSurpriseModal and surpriseMessage (modal-specific states)
  const [rpsPlayerChoice, setRpsPlayerChoice] = useState(null);
  const [rpsComputerChoice, setRpsComputerChoice] = useState(null);
  const [rpsResult, setRpsResult] = useState("");
  const [rpsPlayerScore, setRpsPlayerScore] = useState(0);
  const [rpsComputerScore, setRpsComputerScore] = useState(0);
  const rpsChoices = ['Taş', 'Kağıt', 'Makas'];

  // Music Player States
  const [stations, setStations] = useState(initialStations);
  const [selectedStation, setSelectedStation] = useState(initialStations[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef(null);

  // Müzik Çalar Mantığı için useEffect
  useEffect(() => {
    if (audioRef.current) {
      if (selectedStation && selectedStation.url) {
        if (isPlaying) {
          // Eğer istasyon değiştiyse veya duraklatılmışsa, yeni src ata ve oynat
          if (audioRef.current.src !== selectedStation.url) {
            audioRef.current.src = selectedStation.url;
            audioRef.current.load(); // Yeni kaynağı yüklemek önemli
          }
          // Oynatma işlemini bir promise olarak ele al ve olası hataları yakala
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.then(_ => {
              // Oynatma başarılı
            }).catch(error => {
              console.error("Audio çalınırken hata oluştu:", error);
              // İsteğe bağlı: isPlaying durumunu false yap veya bir hata mesajı göster
              // setIsPlaying(false); 
            });
          }
        } else {
          audioRef.current.pause();
        }
      } else {
        // Seçili istasyon yoksa veya URL'si yoksa duraklat ve src'yi temizle
        audioRef.current.pause();
        audioRef.current.src = ""; 
      }
      audioRef.current.volume = volume;
    }
  }, [selectedStation, isPlaying, volume]); // Bağımlılıklar: bu değerler değiştiğinde useEffect tekrar çalışır

  // REMOVED: Old Leaflet icon fix useEffect (moved to MapComponentBundle)
  // REMOVED: Old useState and useEffect for ReactLeaflet components (logic moved to MapComponentBundle)

  const DynamicMapComponentBundle = dynamic(() => Promise.resolve(MapComponentBundle), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-zinc-700"><p className="text-white">Harita Başlatılıyor...</p></div>
  });

  // ... (ALL other existing functions: fetchIPLocation, handleSurprise, submitEmotionToMap, etc. remain unchanged)
  const surpriseMessages = [
    "Bir sonraki büyük fikrin tam köşede!",
    "Bugün harika bir şey başaracaksın!",
    "Unutma, her zaman öğrenilecek yeni bir şeyler vardır.",
    "Küçük adımlar büyük başarılara yol açar.",
    "Gülümse, çünkü harikasın!",
    "Hayallerinin peşinden gitmek için asla geç değil.",
    "Bugün kendine biraz zaman ayır.",
    "Pozitif düşün, pozitif sonuçlar alırsın.",
    "Yeni bir hobi edinmek için harika bir gün!",
    "Etrafına neşe saç!",
    "Bir fincan kahve/çay ile keyif yapma zamanı.",
    "Bugün birine iltifat et.",
    "En sevdiğin şarkıyı aç ve dans et!",
    "Hayat bir maceradır, tadını çıkar!",
    "Kendine inan, her şey mümkün.",
    "Bugün beklenmedik bir güzellikle karşılaşabilirsin.",
    "Yaratıcılığını serbest bırak.",
    "Mükemmel olmak zorunda değilsin, sen olmak yeterli.",
    "Her gün yeni bir başlangıçtır.",
    "Biraz mola verip derin bir nefes al.",
    "Okumak istediğin o kitaba başla!",
    "Doğada kısa bir yürüyüş iyi gelebilir.",
    "Bugün şanslı günün olabilir!",
    "Yeni bir şeyler denemekten korkma.",
    "İçindeki potansiyeli keşfet!",
    // Duygusal Özlem Temalı Mesajlar
    "Bazen en güzel anılar, bir şarkıda saklıdır.",
    "Geçmişe bir gülümseme gönder, geleceğe umutla bak.",
    "Kalbindeki o tatlı sızıyı hatırla, ne kadar büyüdüğünü gösterir.",
    "Uzaktaki bir dostu aramak için güzel bir gün.",
    "Anılar, ruhumuzun sessiz şarkılarıdır.",
    "Bir zamanlar hayalini kurduğun şeyleri düşün, ne kadar yol kat ettin?",
    "Özlem, sevginin bitmeyen yankısıdır.",
    "Eski bir fotoğraf albümüne göz atmaya ne dersin?",
    "Bazı yollar yalnız yürünür ama her adımda bir anı birikir.",
    "Gözlerini kapat ve en huzurlu anını hayal et."
  ];

  const musicSuggestions = {
    happy: "https://open.spotify.com/playlist/37i9dQZF1DXdPec7aLTmlC",
    sad: "https://open.spotify.com/playlist/37i9dQZF1DWVrtsSlLKzro",
    calm: "https://open.spotify.com/playlist/37i9dQZF1DWYcDQ1hSjOpY",
    energetic: "https://open.spotify.com/playlist/37i9dQZF1DX8tZsk68tuDw"
  };

  // Moved fetchGuestbookEntries outside of useEffect to be accessible by other functions
  const fetchGuestbookEntries = useCallback(async () => {
    setGuestbookLoading(true);
    try {
      const { data, error } = await supabase
        .from('guestbook_entries') // Use the new table
        .select('id, created_at, message, user_id') // Select specific columns
        // card_type filter is no longer needed
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching guestbook entries:', error);
        setGuestbookSubmitStatus('Ziyaretçi defteri girdileri yüklenirken hata oluştu.');
        setGuestbookEntries([]); // Hata durumunda listeyi boşalt
      } else {
        setGuestbookEntries(data || []);
      }
    } catch (error) {
      console.error('Catch Error fetching guestbook entries:', error);
      setGuestbookSubmitStatus('Ziyaretçi defteri girdileri yüklenirken bir şeyler ters gitti.');
      setGuestbookEntries([]);
    }
    setGuestbookLoading(false);
  }, [setGuestbookLoading, setGuestbookSubmitStatus, setGuestbookEntries, supabase]);

  const fetchLastNote = async () => {
    const { data, error } = await supabase
      .from('visitor_notes') // Use the new table
      .select('id, created_at, message') // Select 'message' column
      // card_type filter is no longer needed
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching last note:', error);
      setLastNote(null); // Clear last note on error
    } else if (data && data.length > 0) {
      setLastNote(data[0]); // data[0] will now have a 'message' property
    } else {
      setLastNote(null); // No note found
    }
  };

  useEffect(() => {
    fetchLastNote();
    // Diğer ilk yükleme fonksiyonlarınız burada olabilir
  }, []);

  useEffect(() => {
    // Call fetchGuestbookEntries on initial render
    fetchGuestbookEntries();
  }, [fetchGuestbookEntries]); // Added fetchGuestbookEntries to useEffect dependencies

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setCounter((prev) => prev + 1);
      }, 1000);
    } else if (!isRunning && counter !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    fetchIPLocation(); // Fetch IP location on component mount
  }, []); // Empty dependency array ensures this runs only once on mount

  // Music Player Effects
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && selectedStation) {
        audioRef.current.src = selectedStation.url;
        audioRef.current.load(); // Important to load new source
        audioRef.current.play().catch(error => console.error("Audio play error:", error));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, selectedStation]);

  useEffect(() => {
    // Play a random station on initial load if stations are available
    if (stations.length > 0) {
      const randomIndex = Math.floor(Math.random() * stations.length);
      setSelectedStation(stations[randomIndex]);
      // setIsPlaying(true); // Optionally auto-play on load
    }
  }, []); // Runs once on mount

  const fetchIPLocation = async () => {
    try {
      const response = await fetch('https://ipinfo.io/json'); // Token gerekirse ?token=YOUR_TOKEN ekleyin
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IP Geolocation API isteği başarısız: ${response.status}. ${errorText}`);
      }
      const data = await response.json();

      if (data && data.loc) {
        const [latitude, longitude] = data.loc.split(',').map(coord => parseFloat(coord));
        if (!isNaN(latitude) && !isNaN(longitude)) {
          const newLocation = { lat: latitude, lng: longitude };
          setUserLocation(newLocation);
          setMapCenter(newLocation);
          setZoomLevel(10); 
          setLocationDetails({ // Detaylı konum bilgisini kaydet
            ip: data.ip,
            city: data.city,
            region: data.region,
            country: data.country,
            loc: data.loc,
            timezone: data.timezone
          });
          return;
        } else {
          throw new Error('IP adresinden geçersiz enlem/boylam verisi alındı.');
        }
      } else {
        throw new Error('IP adresinden konum verisi (loc) alınamadı.');
      }
    } catch (error) {
      setMapCenter([39.9334, 32.8597]); 
      setZoomLevel(6);
      setLocationDetails(null); // Hata durumunda detayları temizle
      console.error('Konum alınırken hata oluştu:', error); // Hata loglama eklendi
    }
  };

  const fetchEmotionData = useCallback(async () => {
    const { data, error } = await supabase
      .from('emotion_map_entries')
      .select('latitude, longitude, emotion'); 

    if (error) {
      console.error('Error fetching emotion data:', error);
      return;
    }
    if (data) {
      const heatData = data.map(entry => ({ lat: entry.latitude, lng: entry.longitude, emotion: entry.emotion })); 
      setHeatmapData(heatData);
    }
  }, []);

  useEffect(() => {
    fetchEmotionData();
  }, [fetchEmotionData]);

  async function submitEmotionToMap() {
    if (!emotion) {
      alert('Lütfen bir duygu seçin.');
      return;
    }
    if (!userLocation && !locationDetails) { // Hem tarayıcı konumu hem de IP konumu yoksa
      alert('Konumunuz alınamadı. Lütfen konum izni verdiğinizden emin olun veya sayfanızı yenileyin.');
      return;
    }

    // Kullanılacak konumu belirle: Önce userLocation (tarayıcıdan), sonra locationDetails (IP'den)
    let submissionLat, submissionLng;
    if (userLocation && userLocation.lat && userLocation.lng) {
      submissionLat = userLocation.lat;
      submissionLng = userLocation.lng;
    } else if (locationDetails && locationDetails.loc) {
      [submissionLat, submissionLng] = locationDetails.loc.split(',').map(coord => parseFloat(coord));
    } else {
        alert('Geçerli konum bilgisi bulunamadı.');
        return;
    }

    const { data, error } = await supabase
      .from('emotion_map_entries')
      .insert([{ 
        emotion: emotion, 
        latitude: submissionLat, 
        longitude: submissionLng,
        // user_id: session?.user?.id // Eğer kullanıcı girişi varsa eklenebilir
      }]);

    if (error) {
      console.error('Supabase duygu ekleme hatası:', error);
      alert(`Duygu eklenirken bir hata oluştu: ${error.message}`);
    } else {
      // console.log('Duygu başarıyla eklendi:', data);
      alert(`${emotion} duygusu haritaya eklendi!`);
      fetchEmotionData(); // Haritayı güncelle
      setEmotion(''); // Seçimi sıfırla

      // Discord'a gönder (embed için güncellendi)
      await triggerDiscordNotification('emotion_submitted', {
        emotion: emotion, // Duygu ikonu veya adı
        // IP ve konum bilgisi API tarafında footera eklenecek
        // API'deki embed'e özel fieldlar eklemek isterseniz buraya ekleyebilirsiniz, örn: coordinates
        coordinates: submissionLat && submissionLng ? `${submissionLat.toFixed(4)}, ${submissionLng.toFixed(4)}` : 'Koordinat Yok' 
      });
    } // 'else' bloğunu kapatır
  } // submitEmotionToMap fonksiyonunu kapatır

  const fetchSurpriseComments = async (messageText) => {
    if (!messageText) {
      console.warn("fetchSurpriseComments called with no messageText");
      setSurpriseCommentsList([]);
      setSurpriseCommentsLoading(false);
      return;
    }
    setSurpriseCommentsLoading(true);
    console.log('[fetchSurpriseComments] Fetching for messageText:', messageText);
    try {
      const { data, error } = await supabase
        .from('surprise_box_comments') // Use new table
        .select('id, created_at, comment_text, user_id, surprise_message_text') // Use new column name
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching surprise comments:', error);
        console.log('[fetchSurpriseComments] Error object:', JSON.stringify(error));
        setSurpriseCommentsList([]);
      } else {
        console.log('[fetchSurpriseComments] Fetched data:', data);
        setSurpriseCommentsList(data || []);
      }
    } catch (error) {
      console.error('Error fetching surprise comments:', error);
      setSurpriseCommentsList([]);
    } finally {
      setSurpriseCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (randomMessage) { // If there's a surprise message displayed in the card
      fetchSurpriseComments(randomMessage);
    } else {
      setSurpriseCommentsList([]); // Clear comments if no surprise message
    }
  }, [randomMessage]); // Re-fetch when randomMessage changes

  const handleSurpriseCommentSubmit = async () => {
    if (!surpriseComment.trim()) {
      setSurpriseCommentSubmitStatus('Yorum boş olamaz.');
      setTimeout(() => setSurpriseCommentSubmitStatus(''), 3000);
      return;
    }
    setSurpriseCommentSubmitStatus('submitting');

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    try {
      const { error } = await supabase
        .from('surprise_box_comments') // Use new table
        .insert({
          // card_type: 'surprise_comment', // No longer needed
          comment_text: surpriseComment, // Use new column name
          surprise_message_text: randomMessage,
          user_id: user ? user.id : null,
        });

      if (error) {
        console.error('Error submitting surprise comment:', error);
        setSurpriseCommentSubmitStatus(`Hata: ${error.message}`);
        setTimeout(() => setSurpriseCommentSubmitStatus(''), 5000);
      } else {
        setSurpriseCommentSubmitStatus('Yorum başarıyla gönderildi!');
        setSurpriseComment(""); 
        fetchSurpriseComments(randomMessage); // Refresh comments list for the current card message

        // Discord notification (embed için güncellendi)
        await triggerDiscordNotification('surprise_comment', {
          originalMessage: randomMessage,
          comment: surpriseComment,
          userDisplay: user ? (user.email || `ID: ${user.id.substring(0,8)}`) : 'Anonim Kullanıcı'
        });
        setTimeout(() => setSurpriseCommentSubmitStatus(''), 3000);
      }
    } catch (error) {
      console.error('Error submitting surprise comment:', error);
      setSurpriseCommentSubmitStatus('Bir şeyler ters gitti. Lütfen tekrar deneyin.');
      setTimeout(() => setSurpriseCommentSubmitStatus(''), 5000);
    }
  };

  const handleGuestbookSubmit = async (e) => {
    e.preventDefault();
    if (!newGuestbookMessage.trim()) {
      setGuestbookSubmitStatus("Mesaj boş bırakılamaz!"); 
      setTimeout(() => setGuestbookSubmitStatus(""), 3000);
      return;
    }

    setGuestbookSubmitStatus('Gönderiliyor...');
    const { data: { user } } = await supabase.auth.getUser();

    try {
      const { error } = await supabase
        .from('guestbook_entries') // Correct table
        .insert({
          message: newGuestbookMessage, // Correct column
          user_id: user ? user.id : null
        });

      if (error) {
        console.error('Error submitting guestbook entry:', error);
        setGuestbookSubmitStatus(`Hata: ${error.message}`);
      } else {
        setGuestbookSubmitStatus('Mesajınız başarıyla gönderildi!');
        setNewGuestbookMessage(""); 
        fetchGuestbookEntries(); // Refresh the list

        // Discord'a gönder (embed için güncellendi)
        const { data: { user: guestbookUser } } = await supabase.auth.getUser(); // Kullanıcıyı tekrar alalım
        triggerDiscordNotification('guestbook_entry', { 
          message: newGuestbookMessage,
          userDisplay: guestbookUser ? (guestbookUser.email || `ID: ${guestbookUser.id.substring(0,8)}`) : 'Anonim'
          // card_type artık eventType ile yönetiliyor
        });
      }
    } catch (error) {
      console.error('Catch Error submitting guestbook entry:', error);
      setGuestbookSubmitStatus('Bir şeyler ters gitti, mesaj gönderilemedi.');
    }

    setTimeout(() => setGuestbookSubmitStatus(""), 4000); // Clear status after a few seconds
  };

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) {
      alert('Not boş bırakılamaz.'); // Basic validation
      return;
    }

    try {
      // 1. Delete all existing notes from 'visitor_notes' table
      // The RLS policy must allow this delete operation for it to succeed.
      const { error: deleteError } = await supabase
        .from('visitor_notes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all rows, RLS should allow this

      if (deleteError) {
        console.error('Error deleting existing visitor notes:', deleteError);
        alert('Eski not silinirken bir hata oluştu.');
        return;
      }

      // 2. Insert the new note into 'visitor_notes' table
      const { error: insertError } = await supabase
        .from('visitor_notes')
        .insert({
          message: newNote, // Use 'message' column
          user_id: null // Explicitly set user_id to null for anonymous notes
        });

      if (insertError) {
        console.error('Error inserting new visitor note:', insertError);
        alert('Yeni not eklenirken bir hata oluştu.');
      } else {
        setNewNote(""); // Clear the input field
        fetchLastNote(); // Refresh the displayed note
        // Discord notification for the new note (embed için güncellendi)
        await triggerDiscordNotification('new_visitor_note', { noteText: newNote });
      }
    } catch (err) {
      console.error('Catch error in handleNoteSubmit:', err);
      alert('Not gönderilirken bir hata oluştu.');
    }
  };

  const startGuessGame = () => {
    setRandomNumber(Math.floor(Math.random() * 100) + 1);
    setGameState("playing");
    setUserGuess("");
    setGuessMessage("");
  }

  const checkGuess = () => {
    const guess = parseInt(userGuess);
    if (isNaN(guess)) {
      setGuessMessage("Lütfen geçerli bir sayı gir.");
      return;
    }
    if (guess === randomNumber) {
      setGuessMessage("🎉 Doğru bildin!");
      setGameState("won");
    } else if (guess < randomNumber) {
      setGuessMessage("Daha büyük bir sayı dene.");
    } else {
      setGuessMessage("Daha küçük bir sayı dene.");
    }
  }

  // Taş Kağıt Makas Oyun Mantığı
  const playRPS = (playerChoice) => {
    setRpsPlayerChoice(playerChoice);
    const computerChoice = rpsChoices[Math.floor(Math.random() * rpsChoices.length)];
    setRpsComputerChoice(computerChoice);

    if (playerChoice === computerChoice) {
      setRpsResult("Berabere!");
    } else if (
      (playerChoice === 'Taş' && computerChoice === 'Makas') ||
      (playerChoice === 'Kağıt' && computerChoice === 'Taş') ||
      (playerChoice === 'Makas' && computerChoice === 'Kağıt')
    ) {
      setRpsResult("Oyuncu Kazandı!");
      setRpsPlayerScore(rpsPlayerScore + 1);
    } else {
      setRpsResult("Bilgisayar Kazandı!");
      setRpsComputerScore(rpsComputerScore + 1);
    }
  };

  const resetRPS = () => {
    setRpsPlayerChoice(null);
    setRpsComputerChoice(null);
    setRpsResult("");
    // Skorlar sıfırlanmasın istenirse bu satırlar kaldırılabilir
    // setRpsPlayerScore(0);
    // setRpsComputerScore(0);
  };

  const cardBaseClasses = "bg-zinc-800 p-6 rounded-xl shadow-lg hover:shadow-deep transform hover:scale-105 transition-all duration-300 ease-soft-reveal group";
  const cardTitleClasses = "text-2xl font-semibold text-gray-100 mb-4";
  const cardTextClasses = "text-gray-300";
  const buttonBaseClasses = "font-semibold px-6 py-3 rounded-lg shadow-md active:scale-95 transform transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50";
  const inputBaseClasses = "w-full bg-zinc-700 text-gray-200 p-3 rounded-md text-sm focus:ring-2 focus:border-transparent placeholder-gray-400";

  const triggerDiscordNotification = async (notificationType, eventSpecificData) => {
    if (!locationDetails || !locationDetails.ip) {
      console.warn('[Discord Notify] Konum detayları (IP vb.) mevcut değil, bildirim atlanıyor.');
      return;
    }

    const apiPayload = {
      ipAddress: locationDetails.ip,
      locationData: {
        city: locationDetails.city,
        region: locationDetails.region,
        country: locationDetails.country,
      },
      timestamp: new Date().toISOString(),
      eventType: notificationType,
      eventSpecificData: eventSpecificData || {},
      deviceInfo: (() => {
        if (typeof navigator !== 'undefined') {
          const parser = new UAParser(navigator.userAgent);
          const result = parser.getResult();
          const device = result.device.model || result.device.type || 'PC/Dizüstü';
          const os = `${result.os.name || ''} ${result.os.version || ''}`.trim();
          const browser = `${result.browser.name || ''} ${result.browser.version || ''}`.trim();
          let parts = [];
          if (device && device !== 'PC/Dizüstü') parts.push(`Cihaz: ${device}`);
          else if (device === 'PC/Dizüstü' && result.device.vendor) parts.push(`Cihaz: ${result.device.vendor} ${device}`);
          else if (device === 'PC/Dizüstü') parts.push(`Cihaz: ${device}`);
          if (os) parts.push(`OS: ${os}`);
          if (browser) parts.push(`Tarayıcı: ${browser}`);
          return parts.join(', ') || 'Detaylı bilgi yok';
        }
        return 'Bilinmiyor (Sunucu Tarafı)';
      })(),
    };

    try {
      const response = await fetch('/api/discordWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });
      const result = await response.json();
      if (!response.ok) {
        console.error(`[Discord Notify] API Hatası (${notificationType}):`, result.error, result.details);
      } else {
        // console.log(`[Discord Notify] '${notificationType}' bildirimi gönderildi.`); // Başarı logu kapalı
      }
    } catch (error) {
      console.error(`[Discord Notify] İstek Hatası (${notificationType}):`, error);
    }
  };

  // Music Player Control Functions
  const handleStationSelect = (event) => {
    const stationUrl = event.target.value;
    const newSelectedStation = stations.find(s => s.url === stationUrl);
    if (newSelectedStation) {
      setSelectedStation(newSelectedStation);
      if (!isPlaying) {
        setIsPlaying(true); // Start playing if a new station is selected and player was paused
      }
    }
  };

  const togglePlayPause = () => {
    if (!selectedStation && stations.length > 0) { // If no station selected, pick first one
      setSelectedStation(stations[0]);
    }
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (event) => {
    setVolume(parseFloat(event.target.value));
  };

  const playRandomStation = () => {
    if (stations.length > 0) {
      const randomIndex = Math.floor(Math.random() * stations.length);
      setSelectedStation(stations[randomIndex]);
      if (!isPlaying) {
        setIsPlaying(true);
      }
    }
  };

  // Sürpriz Kutusu için handleSurprise fonksiyonu
  const handleSurprise = () => {
    // surpriseMessages dizisinin bileşen kapsamında tanımlı olduğunu varsayıyoruz.
    if (surpriseMessages && surpriseMessages.length > 0) {
      const randomIndex = Math.floor(Math.random() * surpriseMessages.length);
      const newRandomMessage = surpriseMessages[randomIndex];
      setRandomMessage(newRandomMessage);
      fetchSurpriseComments(newRandomMessage); // Yeni sürpriz için yorumları yükle
      setSurpriseComment(''); // Yorum giriş alanını temizle
      setSurpriseCommentSubmitStatus(''); // Gönderim durumunu temizle
    } else {
      console.warn("surpriseMessages dizisi handleSurprise içinde mevcut değil veya boş.");
      setRandomMessage("Şu an için bir sürpriz bulunamadı."); // Kullanıcıya geri bildirim
    }
  };

  return (
    <main className="min-h-screen bg-zinc-900 p-6">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Hoş Geldin Bölümü */}
        <section className={`${cardBaseClasses} text-center md:col-span-2`}>
          <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-4xl font-bold text-white">
            Hoş Geldin 👋
          </motion.h1>
          <p className={`mt-2 text-lg ${cardTextClasses}`}>Bu site duygularını, izlerini ve sesini bırakman için var.</p>
          
        </section>

        {/* Sürpriz Kutusu Bölümü */}
        <section className={`${cardBaseClasses}`}>
          <h2 className={`${cardTitleClasses}`}>🎁 Sürpriz Kutusu</h2>
          <button 
            onClick={handleSurprise} 
            className={`${buttonBaseClasses} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500`}
          >
            Kutuyu Aç
          </button>
          {randomMessage && (
            <div className="mt-4 w-full">
              <p className={`${cardTextClasses} italic text-center mb-6`}>“{randomMessage}”</p>
              
              {/* Yorum yazma alanı - KART İÇİNE TAŞINDI */}
              <div className="mt-4 pt-4 border-t border-zinc-700">
                <h4 className="text-md font-semibold text-zinc-300 mb-2">Bu sürprize yorumun:</h4>
                <textarea 
                  value={surpriseComment}
                  onChange={(e) => setSurpriseComment(e.target.value)}
                  placeholder={`"${randomMessage}" hakkında ne düşünüyorsun?`}
                  className="w-full p-3 bg-zinc-700 border border-zinc-600 rounded-lg mb-3 text-sm text-zinc-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow duration-150 shadow-inner"
                  rows="3"
                ></textarea>
                <button 
                  onClick={handleSurpriseCommentSubmit}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition-colors duration-150 mb-4"
                >
                  Yorumu Gönder
                </button>
              </div>

              {/* Gönderim durumu - KART İÇİNE TAŞINDI */}
              {surpriseCommentSubmitStatus && (
                <p className={`text-sm mt-2 mb-4 text-center ${surpriseCommentSubmitStatus.startsWith('Hata') || surpriseCommentSubmitStatus.startsWith('Bir şeyler') || surpriseCommentSubmitStatus.startsWith('Yorum boş') ? 'text-red-400' : 'text-green-400'}`}>
                  {surpriseCommentSubmitStatus === 'submitting' ? 'Gönderiliyor...' : surpriseCommentSubmitStatus}
                </p>
              )}

              {/* Yorumlar listesi - KART İÇİNE TAŞINDI */}
              <div className="mt-6 pt-4 border-t border-zinc-700 max-h-60 overflow-y-auto">
                <h4 className="text-md font-semibold text-zinc-300 mb-3">Bu Sürprize Yorumlar:</h4>
                {surpriseCommentsLoading ? (
                  <p className="text-zinc-400 text-sm italic text-center">Yorumlar yükleniyor...</p>
                ) : (console.log('[Render Surprise Comments] surpriseCommentsList:', surpriseCommentsList), surpriseCommentsList.length > 0) ? (
                  <ul className="space-y-3">
                    {surpriseCommentsList.map((comment, index) => {
                      console.log(`[Render Surprise Comments] Mapping comment ${index}:`, comment);
                      return (
                      <li key={comment.id} className="bg-zinc-700/50 p-3 rounded-lg shadow border-l-4 border-purple-500">
                      <p className="text-zinc-200 text-sm mb-1">
                        <span className="font-semibold text-purple-300 block mb-1">Sürpriz: “{comment.surprise_message_text}”</span>
                        {comment.comment_text}
                      </p>
                      <p className="text-xs text-zinc-400 text-right mt-2">
                        {new Date(comment.created_at).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </li>
                    );}) }
                  </ul>
                ) : (
                  <p className="text-zinc-400 text-sm italic text-center">Henüz yorum yapılmamış. İlk yorumu sen yap!</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Müzik Çalar Bölümü */}
        <section className={`${cardBaseClasses}`}>
          <h2 className={`${cardTitleClasses}`}>🎧 Müzik Çalar</h2>
          <audio ref={audioRef} />
          <div className="space-y-4">
            <div>
              <label htmlFor="station-select" className={`block text-sm font-medium ${cardTextClasses} mb-1`}>İstasyon Seç:</label>
              <select 
                id="station-select" 
                value={selectedStation ? selectedStation.url : ''} 
                onChange={handleStationSelect}
                className={`${inputBaseClasses} focus:ring-purple-500 bg-zinc-700`}
              >
                {stations.map(station => (
                  <option key={station.url} value={station.url} className="bg-zinc-800 text-white">
                    {station.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button 
                onClick={togglePlayPause} 
                className={`${buttonBaseClasses} ${isPlaying ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'} text-white flex-grow`}
              >
                {isPlaying ? 'Duraklat' : 'Oynat'}
              </button>
              <button 
                onClick={playRandomStation} 
                className={`${buttonBaseClasses} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 flex-grow`}
              >
                Rastgele Çal
              </button>
            </div>

            <div>
              <label htmlFor="volume-control" className={`block text-sm font-medium ${cardTextClasses} mb-1`}>Ses Seviyesi:</label>
              <input 
                type="range" 
                id="volume-control" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume} 
                onChange={handleVolumeChange}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-50"
              />
            </div>
            {selectedStation && (
              <p className={`${cardTextClasses} text-sm text-center pt-2 border-t border-zinc-700`}>
                Şu an çalıyor: <span className="font-semibold text-purple-300">{selectedStation.name}</span>
              </p>
            )}
          </div>
        </section>

        {/* Ziyaretçi Defteri Bölümü */}
        <section className={`${cardBaseClasses}`}>
          <h2 className={`${cardTitleClasses}`}>📓 Ziyaretçi Defteri</h2>
          <form onSubmit={handleGuestbookSubmit} className="space-y-4">
            {guestbookSubmitStatus && (
              <p className={`text-sm text-center p-2 rounded-md ${guestbookSubmitStatus.startsWith('Hata') || guestbookSubmitStatus.startsWith('Bir şeyler') || guestbookSubmitStatus.startsWith('İsim ve mesaj') ? 'bg-red-500/20 text-red-300' : (guestbookSubmitStatus === 'Gönderiliyor...' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300')}`}>
                {guestbookSubmitStatus}
              </p>
            )}

            <textarea
              value={newGuestbookMessage}
              onChange={(e) => setNewGuestbookMessage(e.target.value)}
              placeholder="Mesajınızı girin"
              className={`${inputBaseClasses} focus:ring-blue-500`}
              rows={3}
            />
            <button 
              type="submit"
              className={`${buttonBaseClasses} bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500`}
            >
              Mesajı Gönder
            </button>
          </form>
          <div className="mt-8 space-y-6 max-h-[500px] overflow-y-auto pr-2"> 
            {guestbookLoading ? (
              <p className={`${cardTextClasses} italic text-center`}>Ziyaretçi defteri yükleniyor...</p> 
            ) : guestbookEntries.length === 0 ? ( 
              <p className={`${cardTextClasses} italic text-center`}>Henüz hiç mesaj yok. İlk mesajı sen yaz!</p> 
            ) : ( 
              guestbookEntries.map(entry => ( 
                <div key={entry.id} className="bg-zinc-700/50 p-4 rounded-lg shadow-md border-l-4 border-green-500"> 
                  {/* <h4 className="text-lg font-semibold text-green-400">{entry.name}</h4> */}
                  <p className={`mt-1 ${cardTextClasses}`}>{entry.message}</p> 
                  <p className="text-xs text-zinc-400 mt-2 text-right">
                    {new Date(entry.created_at).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p> 
                </div> 
              )) 
            )} 
          </div>
        </section>

        {/* Ziyaretçiden Ziyaretçiye Not Bırak Bölümü */}
        <section className={`${cardBaseClasses}`}>
          <h2 className={`${cardTitleClasses}`}>📨 Ziyaretçiden Ziyaretçiye Not Bırak</h2>
          {lastNote && (
            <div className="mb-4 p-3 bg-zinc-700/50 rounded-lg">
              <p className={`text-sm ${cardTextClasses}/80`}>
                Bir önceki ziyaretçi şöyle yazmıştı:
              </p>
              <p className={`italic text-gray-200/90 mt-1`}>“{lastNote.message}”</p>
            </div>
          )}
          <form onSubmit={handleNoteSubmit}>
            <textarea
              className={`${inputBaseClasses} focus:ring-blue-500`}
              placeholder="Buraya notunu yaz..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
            />
            <div className="text-right mt-3">
              <button 
                type="submit"
                className={`${buttonBaseClasses} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`}
              >
                Notu Gönder
              </button>
            </div>
          </form>
        </section>

        {/* Duygusal Harita Bölümü - YENİ İÇERİK */}
        <section className={`${cardBaseClasses}`}> 
          <h2 className={`${cardTitleClasses}`}>📍 Duygusal Sıcaklık Haritası</h2>
          
          <div className="mb-4">
            <p className={`text-sm ${cardTextClasses} mb-2`}>Bugün kendini nasıl hissediyorsun? Haritaya ekle!</p>
            <div className="flex gap-3 justify-center mb-3">
                {["😄", "😐", "😢", "😡"].map((emo) => (
                    <button
                        key={emo}
                        onClick={() => setEmotion(emo)} 
                        className={`text-3xl p-2 rounded-full hover:bg-zinc-700 transition-colors duration-200 ${emotion === emo ? 'bg-blue-500/30 ring-2 ring-blue-500' : 'bg-transparent'}`}
                    >
                        {emo}
                    </button>
                ))}
            </div>
            {emotion && <p className={`text-center ${cardTextClasses} text-sm`}>Seçili duygu: <span className="font-semibold text-gray-100 text-lg">{emotion}</span></p>}
            <button
                onClick={submitEmotionToMap}
                disabled={!emotion || !userLocation} 
                className={`${buttonBaseClasses} bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 mt-3 w-full disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                Duygumu Haritaya Ekle
            </button>
          </div>

          {/* Harita Konteynerinin yüksekliği de ayarlanabilir, örneğin h-[400px] */}
          <div className="h-[400px] w-full rounded-lg overflow-hidden bg-zinc-700"> 
            {userLocation ? (
              <DynamicMapComponentBundle 
                userLocation={userLocation}
                currentEmotion={emotion}
                heatmapPoints={heatmapData}
                markerPoints={emotionMapMarkers}
                center={mapCenter}
                zoom={zoomLevel}
                externalMapRef={mapRef}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <p className="text-white">Konum bilgisi ve harita için bekleniyor...</p>
              </div>
            )}
          </div>
        </section>

        {/* Sayı Tahmin Oyunu Bölümü */}
        <section className={`${cardBaseClasses} text-center`}>
          <h2 className={`${cardTitleClasses}`}>⏱️ Sayı Tahmin Oyunu</h2>
          {gameState === "idle" && (
            <button 
              onClick={startGuessGame} 
              className={`${buttonBaseClasses} bg-yellow-500 hover:bg-yellow-600 text-zinc-900 focus:ring-yellow-400`}
            >
              Oyuna Başla
            </button>
          )}
          {gameState === "playing" && (
            <div className="space-y-4 max-w-xs mx-auto">
              <input
                type="number"
                value={userGuess}
                onChange={(e) => setUserGuess(e.target.value)}
                className={`${inputBaseClasses} focus:ring-yellow-500 text-center`}
                placeholder="Tahminin (1-100)"
              />
              <button 
                onClick={checkGuess} 
                className={`${buttonBaseClasses} w-full bg-orange-500 hover:bg-orange-600 text-white focus:ring-orange-400`}
              >
                Tahmin Et
              </button>
            </div>
          )}
          {(gameState === "won" || (gameState === "playing" && guessMessage)) && (
            <p className={`mt-4 text-lg ${gameState === "won" ? 'text-green-400' : cardTextClasses}`}>{guessMessage}</p>
          )}
          {gameState === "won" && (
             <button 
              onClick={startGuessGame} 
              className={`mt-4 ${buttonBaseClasses} bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500 px-4 py-2 text-sm`}
            >
              Tekrar Oyna
            </button>
          )}

          {/* Taş Kağıt Makas Oyunu */}
          <div className="mt-8 pt-6 border-t border-zinc-700">
            <h3 className={`text-2xl font-semibold ${cardTitleClasses} mb-4 text-center`}>✂️ Taş Kağıt Makas</h3>
            <div className="flex justify-around mb-4">
              {rpsChoices.map((choice) => (
                <button 
                  key={choice} 
                  onClick={() => playRPS(choice)} 
                  className={`${buttonBaseClasses} bg-sky-500 hover:bg-sky-600 text-white focus:ring-sky-400 px-4 py-2 text-lg`}
                >
                  {choice}
                </button>
              ))}
            </div>
            {rpsPlayerChoice && rpsComputerChoice && (
              <div className="text-center space-y-2 mb-4 animate-fadeIn">
                <p className={cardTextClasses}>Senin Seçimin: <span className="font-bold text-sky-300">{rpsPlayerChoice}</span></p>
                <p className={cardTextClasses}>Bilgisayarın Seçimi: <span className="font-bold text-rose-400">{rpsComputerChoice}</span></p>
                <p className={`text-xl font-bold ${rpsResult.includes('Oyuncu') ? 'text-green-400' : rpsResult.includes('Bilgisayar') ? 'text-red-400' : 'text-yellow-400'}`}>{rpsResult}</p>
              </div>
            )}
            <div className="text-center mb-4">
              <p className={cardTextClasses}>Skor: <span className="font-semibold text-green-400">Oyuncu {rpsPlayerScore}</span> - <span className="font-semibold text-red-400">Bilgisayar {rpsComputerScore}</span></p>
            </div>
            {(rpsPlayerChoice || rpsResult) && (
               <button onClick={resetRPS} className={`${buttonBaseClasses} w-full bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500 mt-2`}>
                 Sıradaki Tur / Temizle
               </button>
            )}
          </div>
        </section>

      </div>
    </main>
  );
};

export default IndexPage;
