import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStream } from '../context/StreamContext';
import UniversalVideoPlayer from './UniversalVideoPlayer';

interface VideoPlayerProps {
  playlistVideo?: {
    id: number;
    nome: string;
    url: string;
    duracao?: number;
  };
  onVideoEnd?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ playlistVideo, onVideoEnd }) => {
  const { user } = useAuth();
  const { streamData } = useStream();
  const [obsStreamActive, setObsStreamActive] = useState(false);
  const [obsStreamUrl, setObsStreamUrl] = useState<string>('');

  const userLogin = user?.email?.split('@')[0] || `user_${user?.id || 'usuario'}`;

  useEffect(() => {
    // Verificar se há stream OBS ativo
    checkOBSStream();
  }, []);

  const checkOBSStream = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch('/api/streaming/obs-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.obs_stream.is_live) {
          setObsStreamActive(true);
          // URL do stream OBS
        setObsStreamUrl(`http://samhost.wcore.com.br:1935/samhost/${userLogin}_live/playlist.m3u8`);
        } else {
          setObsStreamActive(false);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar stream OBS:', error);
    }
  };
  
  // Priorizar vídeo da playlist se fornecido, senão usar stream ao vivo
  const getVideoUrl = (url: string) => {
    if (!url) return '';
    
    // Se já é uma URL completa, usar como está
    if (url.startsWith('http')) {
      return url;
    }
    
    // Construir URL correta para VOD no Wowza
    const isProduction = window.location.hostname === 'samhost.wcore.com.br';
    const wowzaHost = isProduction ? 'samhost.wcore.com.br' : '51.222.156.223';
    
    // Se a URL já contém vod/_definst_, usar como está
    if (url.includes('vod/_definst_')) {
      return url.replace('51.222.156.223', wowzaHost);
    }
    
    // Construir URL VOD correta
    let videoUrl;
    if (url.includes('playlist.m3u8')) {
      // Para HLS, usar diretamente
      videoUrl = url.replace('51.222.156.223', wowzaHost);
    } else {
      // Para outros formatos, construir URL VOD
      const cleanPath = url.replace('/content', '').replace(/^\/+/, '');
      const pathParts = cleanPath.split('/');
      
      if (pathParts.length >= 3) {
        const userLogin = pathParts[0];
        const folderName = pathParts[1];
        const fileName = pathParts[2];
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        if (fileExtension === 'mp4') {
          videoUrl = `http://${wowzaHost}:1935/vod/_definst_/mp4:${userLogin}/${folderName}/${fileName}/playlist.m3u8`;
        } else {
          videoUrl = `http://${wowzaHost}:1935/vod/_definst_/${userLogin}/${folderName}/${fileName}/playlist.m3u8`;
        }
      } else {
        videoUrl = `http://${wowzaHost}:1935/vod/_definst_/${cleanPath}/playlist.m3u8`;
      }
    }
    
    console.log('🎥 URL do vídeo construída:', videoUrl);
    return videoUrl;
  };

  const videoSrc = playlistVideo?.url ? getVideoUrl(playlistVideo.url) : 
    (streamData.isLive ? `http://samhost.wcore.com.br:1935/samhost/${userLogin}_live/playlist.m3u8` : 
     obsStreamActive ? obsStreamUrl : undefined);

  const videoTitle = playlistVideo?.nome || 
    (streamData.isLive ? streamData.title || 'Transmissão ao Vivo' : 
     obsStreamActive ? 'Transmissão OBS ao Vivo' : undefined);

  const isLive = !playlistVideo && (streamData.isLive || obsStreamActive);

  return (
    <UniversalVideoPlayer
      src={videoSrc}
      title={videoTitle}
      isLive={isLive}
      autoplay={!!playlistVideo}
      muted={false}
      controls={true}
      onEnded={onVideoEnd}
      streamStats={isLive ? {
        viewers: streamData.viewers + (obsStreamActive ? 0 : 0), // Evitar duplicação
        bitrate: streamData.isLive ? streamData.bitrate : 2500,
        uptime: streamData.isLive ? streamData.uptime : '00:00:00',
        quality: '1080p'
      } : undefined}
      className="w-full"
    />
  );
};

export default VideoPlayer;