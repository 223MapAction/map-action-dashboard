import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { useSocketIncident } from '../../hooks/useSocketIncident';
import sendMessageSound from '../../assets/send_message.mp3';
import {
  getDiscussionMessagesService,
  sendMessageService,
  updateDiscussionMessageService,
  deleteDiscussionMessageService,
  formatMessage,
} from './service/collab_detail_service';
import { logger } from '../../utils/logger';

/**
 * Toute la discussion d'une collaboration : chargement pagine, temps reel,
 * redaction, pieces jointes, enregistrement vocal, edition et suppression.
 *
 * Ces quelque 450 lignes vivaient au milieu du composant de page, entremelees
 * a la gestion des taches, des modales et de la cloture. Elles n'ont pourtant
 * aucun rapport avec elles : tout ce que ce hook consomme de l'exterieur,
 * c'est l'identifiant du signalement.
 *
 * @param {number|string|null} incidentId
 */
export function useDiscussion(incidentId) {
  const [newMessage, setNewMessage] = useState('');
  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedAudio, setAttachedAudio] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [downloadingMsgId, setDownloadingMsgId] = useState(null);
  const [activeAudioId, setActiveAudioId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // États pour la pagination du chat
  const [allMessages, setAllMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const messagesContainerRef = useRef(null);

  // Défile la liste des messages, et elle seule. scrollIntoView remontait aussi
  // les ancêtres défilables : depuis que la page entière défile, chaque nouveau
  // message faisait sauter la page vers le bas de la discussion.
  const defilerEnBas = () => {
    const liste = messagesContainerRef.current;
    if (liste) liste.scrollTo({ top: liste.scrollHeight, behavior: 'smooth' });
  };

  // Référence pour éviter les stale closures dans les effets
  const allMessagesRef = useRef([]);
  // Drapeau: true quand on ajoute des messages anciens en haut (ne pas scroller en bas)
  const isPrependingRef = useRef(false);

  // Synchroniser la ref avec l'état
  useEffect(() => {
    allMessagesRef.current = Array.isArray(allMessages) ? allMessages : [];
  }, [allMessages]);

  // Réinitialiser la pagination quand incidentId change
  useEffect(() => {
    setAllMessages([]);
    setHasMoreMessages(false);
    setNextBeforeId(null);
    allMessagesRef.current = [];
  }, [incidentId]);

  // Charger les messages initiaux (10 plus récents) via SWR
  const { data: rawMessagesData, mutate: mutateMessages } = useSWR(
    incidentId ? `discussion-${incidentId}` : null,
    () => getDiscussionMessagesService(incidentId, { limit: 10 }),
    {
      revalidateOnFocus: false
    }
  );

  // Gérer à la fois le chargement initial et les mises à jour WebSocket
  // - Si allMessages est vide : chargement initial (initialise la liste + pagination)
  // - Si allMessages n'est pas vide : mise à jour WebSocket (ajoute seulement les nouveaux messages)
  useEffect(() => {
    if (!rawMessagesData || !Array.isArray(rawMessagesData.results)) return;

    const apiResults = rawMessagesData.results;
    const currentMessages = allMessagesRef.current;

    if (currentMessages.length === 0) {
      // Chargement initial : définir tous les messages depuis l'API
      setAllMessages(apiResults);
      setHasMoreMessages(rawMessagesData.has_more || false);
      setNextBeforeId(rawMessagesData.next_before || null);

      // Scroller vers le bas après le chargement initial
      setTimeout(() => {
        defilerEnBas();
      }, 100);
    } else {
      // Mise à jour WebSocket : ajouter seulement les nouveaux messages
      const newMessages = apiResults.filter(
        newMsg => !currentMessages.some(existingMsg => existingMsg.id === newMsg.id)
      );

      if (newMessages.length > 0) {
        setAllMessages(prev => {
          const prevArray = Array.isArray(prev) ? prev : [];
          return [...prevArray, ...newMessages];
        });

        setTimeout(() => {
          defilerEnBas();
        }, 100);
      }
    }
  }, [rawMessagesData]);

  // Temps reel : a chaque notification du serveur, on redemande la page de
  // messages a SWR. L'effet ci-dessus se charge de n'ajouter que les nouveaux.
  // La reconnexion et sa temporisation vivent dans useSocketIncident.
  useSocketIncident(incidentId, 'discussion', () => mutateMessages());

  // Fonction pour charger plus de messages (messages plus anciens)
  //
  // Memoisee : l'ecouteur de defilement plus bas la capture. Sans useCallback,
  // elle etait recreee a chaque rendu, l'effet se relancait donc en permanence
  // et l'ecouteur etait detache puis rattache sur chaque frappe de l'utilisateur.
  const loadMoreMessages = useCallback(async () => {
    if (!hasMoreMessages || isLoadingMoreMessages || !nextBeforeId || !incidentId) return;

    setIsLoadingMoreMessages(true);

    try {
      const data = await getDiscussionMessagesService(incidentId, {
        limit: 10,
        before: nextBeforeId
      });

      if (data && Array.isArray(data.results)) {
        // Marquer qu'on ajoute des messages anciens (empêche le scroll vers le bas)
        isPrependingRef.current = true;
        // Ajouter les messages plus anciens au début de la liste
        setAllMessages(prev => {
          const prevArray = Array.isArray(prev) ? prev : [];
          return [...data.results, ...prevArray];
        });
        setHasMoreMessages(data.has_more || false);
        setNextBeforeId(data.next_before || null);
      }
    } catch (err) {
      logger.error('[Chat] Erreur chargement messages supplémentaires:', err);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [hasMoreMessages, isLoadingMoreMessages, nextBeforeId, incidentId]);

  // Détecter le scroll vers le haut pour charger plus de messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Si on scroll vers le haut (proche du début)
      if (container.scrollTop < 100 && hasMoreMessages && !isLoadingMoreMessages) {
        const previousScrollHeight = container.scrollHeight;
        const previousScrollTop = container.scrollTop;

        loadMoreMessages().then(() => {
          // Maintenir la position de scroll après le chargement
          requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + scrollDiff;
          });
        });
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, isLoadingMoreMessages, loadMoreMessages]);


  // Formater les messages pour l'affichage
  const messages = useMemo(() => {
    if (!Array.isArray(allMessages)) {
      logger.warn('[Chat] allMessages n\'est pas un tableau:', allMessages);
      return [];
    }
    return allMessages.map(msg => {
      const formatted = formatMessage(msg);
      if (!formatted) return null;
      return formatted;
    }).filter(Boolean);
  }, [allMessages]);

  // Faire défiler vers le bas quand les messages changent (sauf lors du chargement de messages anciens)
  useEffect(() => {
    if (isPrependingRef.current) {
      isPrependingRef.current = false;
      return;
    }
    defilerEnBas();
  }, [messages?.length]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (allowedTypes.includes(file.type)) {
        setAttachedFile(file);
      } else {
        alert('Type de fichier non supporté. Veuillez choisir un fichier PDF, Word ou Excel.');
      }
    }
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAudioSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('audio/')) {
        setAttachedAudio(file);
      } else {
        alert('Veuillez choisir un fichier audio valide.');
      }
    }
  };

  const removeAttachedAudio = () => {
    setAttachedAudio(null);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], 'enregistrement_vocal.webm', { type: 'audio/webm' });
          setAttachedAudio(audioFile);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      logger.error("Erreur d'accès au microphone:", err);
      alert("Impossible d'accéder au microphone. Veuillez vérifier vos permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };


  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  const getFileIcon = (fileName) => {
    if (!fileName) return '📎';
    const cleanName = fileName.split('?')[0];
    const ext = cleanName.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📄';
    if (ext === 'doc' || ext === 'docx') return '📝';
    if (ext === 'xls' || ext === 'xlsx') return '📊';
    if (['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(ext)) return '🎵';
    return '📎';
  };

  const handleDownload = async (url, fileName, msgId) => {
    try {
      setDownloadingMsgId(msgId);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erreur réseau');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      logger.error('Erreur lors du téléchargement:', error);
      window.open(url, '_blank');
    } finally {
      setDownloadingMsgId(null);
    }
  };


  const sendMessage = async () => {
    if (!newMessage.trim() && !attachedFile && !attachedAudio) return;

    setSendingMessage(true);
    try {
      if (attachedAudio) {
        await sendMessageService(incidentId, {
          message: newMessage.trim(),
          audio: attachedAudio
        });
      } else if (attachedFile) {
        await sendMessageService(incidentId, {
          message: newMessage.trim(),
          attachment: attachedFile
        });
      } else {
        await sendMessageService(incidentId, {
          message: newMessage.trim()
        });
      }

      await mutateMessages();

      // Jouer le son une fois le message envoyé avec succès
      try {
        const audio = new Audio(sendMessageSound);
        audio.play().catch(() => {});
      } catch {
        // Meme raison qu'ailleurs : le son de confirmation est un confort. Le
        // message est deja parti, une politique d'autoplay ne doit pas donner
        // l'impression du contraire.
      }

      setNewMessage('');
      setAttachedFile(null);
      setAttachedAudio(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }

      setTimeout(() => {
        defilerEnBas();
      }, 100);
    } catch (err) {
      logger.error('[sendMessage] Erreur envoi message:', err);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEditMessage = async (msgId) => {
    if (!editingMessageText.trim()) return;
    setSavingEdit(true);
    try {
      await updateDiscussionMessageService(incidentId, msgId, editingMessageText.trim());
      await mutateMessages();
      setEditingMessageId(null);
      setEditingMessageText('');
    } catch (err) {
      logger.error('[handleEditMessage] Erreur:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    setDeletingMessageId(msgId);
    try {
      await deleteDiscussionMessageService(incidentId, msgId);
      await mutateMessages();
    } catch (err) {
      logger.error('[handleDeleteMessage] Erreur:', err);
    } finally {
      setDeletingMessageId(null);
    }
  };

  const startEditMessage = (msg) => {
    setEditingMessageId(msg.id);
    setEditingMessageText(msg.message || '');
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return {
    // Liste et pagination
    messages,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    messagesContainerRef,
    messagesEndRef,

    // Redaction
    newMessage,
    setNewMessage,
    sendMessage,
    sendingMessage,

    // Pieces jointes
    attachedFile,
    attachedAudio,
    fileInputRef,
    handleFileSelect,
    removeAttachedFile,
    handleAudioSelect,
    removeAttachedAudio,
    getFileIcon,
    handleDownload,
    downloadingMsgId,

    // Enregistrement vocal
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    formatRecordingTime,

    // Lecture audio : un seul enregistrement joue a la fois
    activeAudioId,
    setActiveAudioId,

    // Edition et suppression
    editingMessageId,
    editingMessageText,
    setEditingMessageText,
    startEditMessage,
    cancelEditMessage,
    handleEditMessage,
    savingEdit,
    handleDeleteMessage,
    deletingMessageId,

    formatMessageTime,
  };
}
