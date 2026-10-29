import React, { useEffect } from 'react';
import {
  Send2, Paperclip, Microphone, TickCircle, CloseSquare, Edit2, Trash, DocumentText, Messages2,
} from 'iconsax-react';
import { authService } from '../auth/services/authService';
import { CustomAudioPlayer } from './LecteurAudio';

/* --------------------------------------------------------------------------
 * Discussion de la collaboration
 *
 * Purement présentationnel : tout l'état (pagination, temps réel, pièces
 * jointes, enregistrement vocal, édition) vient de useDiscussion, transmis
 * tel quel par la page.
 * ------------------------------------------------------------------------ */

const Spin = ({ size = 14 }) => <span className="vc-spin" style={{ width: size, height: size }} aria-hidden="true" />;

const Avatar = ({ msg }) => (
  <span className="vc-msg-av" style={msg.senderAvatar ? undefined : { backgroundColor: msg.senderColor }}>
    {msg.senderAvatar ? (
      <img
        src={msg.senderAvatar}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextSibling.style.display = 'grid';
        }}
      />
    ) : null}
    <span style={msg.senderAvatar ? { display: 'none' } : undefined}>{msg.senderInitials}</span>
  </span>
);

export const Discussion = ({ discussion, lectureSeule, onRapports }) => {
  const {
    messages, hasMoreMessages, isLoadingMoreMessages, loadMoreMessages,
    messagesContainerRef, messagesEndRef,
    newMessage, setNewMessage, sendMessage, sendingMessage,
    attachedFile, attachedAudio, fileInputRef,
    handleFileSelect, removeAttachedFile, handleAudioSelect, removeAttachedAudio,
    getFileIcon, handleDownload, downloadingMsgId,
    isRecording, recordingTime, startRecording, stopRecording, formatRecordingTime,
    activeAudioId, setActiveAudioId,
    editingMessageId, editingMessageText, setEditingMessageText,
    startEditMessage, cancelEditMessage, handleEditMessage, savingEdit,
    handleDeleteMessage, deletingMessageId,
    formatMessageTime,
  } = discussion;

  // Monté plus tard (onglet sur petit écran), la liste s'ouvre sur les derniers messages.
  useEffect(() => {
    const liste = messagesContainerRef.current;
    if (liste) liste.scrollTop = liste.scrollHeight;
  }, [messagesContainerRef]);

  const utilisateur = authService.getCurrentUser();
  const estAdmin = utilisateur?.web_role === 'super_admin' || utilisateur?.web_role === 'org_admin';
  const videSaisie = !newMessage.trim() && !attachedFile && !attachedAudio;

  return (
    <div className="vd-card vc-chat">
      <div className="vc-chat-head">
        <h3>
          Discussion
          {messages.length > 0 && <span className="vd-n">{messages.length}</span>}
        </h3>
        <button type="button" className="vd-btn vd-btn-g vd-btn-s" onClick={onRapports}>
          <DocumentText size={14} color="currentColor" />Rapports de terrain
        </button>
      </div>

      <div className="vc-chat-list" ref={messagesContainerRef}>
        {isLoadingMoreMessages && (
          <div className="vc-chat-more"><Spin />Chargement des messages…</div>
        )}
        {!isLoadingMoreMessages && hasMoreMessages && messages.length > 0 && (
          <div className="vc-chat-more">
            <button type="button" className="vd-btn vd-btn-g vd-btn-s" onClick={loadMoreMessages}>
              Charger les messages précédents
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="vd-empty vc-chat-empty">
            <span className="vd-empty-ic vc-empty-ic"><Messages2 size={24} variant="Bold" color="currentColor" /></span>
            <b>Aucun message pour le moment</b>
            <p>Lancez la discussion en envoyant le premier message aux organisations partenaires.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const modifiable = msg.isMe || estAdmin;
            const enEdition = editingMessageId === msg.id;
            const enSuppression = deletingMessageId === msg.id;
            const mediaSeul = !msg.message && (msg.file || msg.audio);

            return (
              <div key={msg.id} className={`vc-msg ${msg.isMe ? 'is-me' : ''}`}>
                {!msg.isMe && <Avatar msg={msg} />}
                <div className="vc-msg-col">
                  <div className="vc-msg-who">
                    <b>{msg.isMe ? 'Vous' : msg.senderName}</b>
                    {msg.senderOrgName && <span>{msg.senderOrgName}</span>}
                  </div>

                  <div className={`vc-bubble ${mediaSeul ? 'is-media' : ''}`}>
                    {enEdition ? (
                      <div className="vc-edit">
                        <textarea
                          value={editingMessageText}
                          onChange={(e) => setEditingMessageText(e.target.value)}
                          aria-label="Modifier le message"
                          autoFocus
                        />
                        <div className="vc-edit-actions">
                          <button type="button" className="vd-btn vd-btn-g vd-btn-s" onClick={cancelEditMessage} disabled={savingEdit}>
                            Annuler
                          </button>
                          <button
                            type="button"
                            className="vd-btn vd-btn-p vd-btn-s"
                            onClick={() => handleEditMessage(msg.id)}
                            disabled={savingEdit || !editingMessageText.trim()}
                          >
                            {savingEdit ? <><Spin size={12} />Enregistrement…</> : 'Enregistrer'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg.message && <p>{msg.message}</p>}
                        {msg.file && (
                          <div className="vc-file">
                            <span className="vc-file-ic">{getFileIcon(msg.file.name)}</span>
                            <div>
                              <b>{msg.file.name}</b>
                              <span>
                                <button
                                  type="button"
                                  className="vd-link"
                                  onClick={() => handleDownload(msg.file.url, msg.file.name, msg.id)}
                                  disabled={downloadingMsgId === msg.id}
                                >
                                  {downloadingMsgId === msg.id ? <><Spin size={11} /> En cours…</> : 'Télécharger'}
                                </button>
                                {msg.file.size > 0 && <> · {(msg.file.size / 1024).toFixed(1)} Ko</>}
                              </span>
                            </div>
                          </div>
                        )}
                        {msg.audio && (
                          <div className="vc-audio">
                            <CustomAudioPlayer
                              id={msg.id}
                              src={msg.audio}
                              activeAudioId={activeAudioId}
                              setActiveAudioId={setActiveAudioId}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="vc-msg-foot">
                    <time>{formatMessageTime(msg.timestamp)}</time>
                    {modifiable && !enEdition && msg.message && (
                      <>
                        <button type="button" className="vc-ico" onClick={() => startEditMessage(msg)} aria-label="Modifier le message" title="Modifier">
                          <Edit2 size={13} color="currentColor" />
                        </button>
                        <button
                          type="button"
                          className="vc-ico vc-ico-danger"
                          onClick={() => handleDeleteMessage(msg.id)}
                          disabled={enSuppression}
                          aria-label="Supprimer le message"
                          title="Supprimer"
                        >
                          {enSuppression ? <Spin size={12} /> : <Trash size={13} color="currentColor" />}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {msg.isMe && <Avatar msg={msg} />}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {lectureSeule ? (
        <p className="vc-chat-ro">Signalement résolu : la discussion est archivée en lecture seule.</p>
      ) : (
        <div className="vc-compose">
          {(attachedFile || attachedAudio) && (
            <div className="vc-attach-list">
              {attachedFile && (
                <span className="vc-attach">
                  <span>{getFileIcon(attachedFile.name)}</span>
                  <b>{attachedFile.name}</b>
                  <button type="button" onClick={removeAttachedFile} disabled={sendingMessage} aria-label="Retirer le fichier">
                    <CloseSquare size={16} variant="Bold" color="currentColor" />
                  </button>
                </span>
              )}
              {attachedAudio && (
                <span className="vc-attach">
                  <Microphone size={14} color="currentColor" />
                  <b>{attachedAudio.name}</b>
                  <button type="button" onClick={removeAttachedAudio} disabled={sendingMessage} aria-label="Retirer l'audio">
                    <CloseSquare size={16} variant="Bold" color="currentColor" />
                  </button>
                </span>
              )}
            </div>
          )}

          {isRecording ? (
            <div className="vc-compose-row vc-rec">
              <span className="vc-rec-dot" aria-hidden="true" />
              <div className="vc-wave" aria-hidden="true">
                {Array.from({ length: 32 }).map((_, i) => (
                  <i key={i} style={{ animationDelay: `${(Math.sin(i * 0.5) + 1) * 0.6}s` }} />
                ))}
              </div>
              <time>{formatRecordingTime(recordingTime)}</time>
              <button type="button" className="vc-send" onClick={stopRecording} aria-label="Valider l'enregistrement" title="Valider l'enregistrement">
                <TickCircle size={20} variant="Bold" color="currentColor" />
              </button>
            </div>
          ) : (
            <div className="vc-compose-row">
              <label className={`vc-ico vc-ico-lg ${sendingMessage ? 'is-off' : ''}`} title="Joindre un fichier">
                <Paperclip size={19} color="currentColor" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,audio/*"
                  onChange={(e) => {
                    const fichier = e.target.files[0];
                    if (!fichier) return;
                    if (fichier.type.startsWith('audio/')) handleAudioSelect(e);
                    else handleFileSelect(e);
                  }}
                  disabled={sendingMessage}
                  hidden
                />
              </label>
              <textarea
                className="vc-field"
                placeholder={sendingMessage ? 'Envoi en cours…' : 'Écrire aux partenaires…'}
                aria-label="Message"
                value={newMessage}
                rows={1}
                disabled={sendingMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              {videSaisie ? (
                <button type="button" className="vc-send" onClick={startRecording} disabled={sendingMessage} aria-label="Enregistrer un message vocal" title="Enregistrer un message vocal">
                  <Microphone size={18} variant="Bold" color="currentColor" />
                </button>
              ) : (
                <button type="button" className="vc-send" onClick={sendMessage} disabled={sendingMessage} aria-label="Envoyer le message" title="Envoyer">
                  {sendingMessage ? <Spin size={16} /> : <Send2 size={18} variant="Bold" color="currentColor" />}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Discussion;
