/* Astranov Sites messenger — slot sites (FrogSchool fs_* messages) */
window.AstranovSitesMessenger = {
  init(adapter, config, opts = {}) {
    const chatStore = config.storage?.chat || `sb_${config.siteId}_chat_v1`;
    const $ = id => document.getElementById(id);
    const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    const clean = p => String(p || '').replace(/\D/g, '');

    function localMsgs() {
      try { return JSON.parse(localStorage.getItem(chatStore) || '[]'); } catch { return []; }
    }
    function saveMsgs(a) { localStorage.setItem(chatStore, JSON.stringify(a.slice(-500))); }

    function fileToData(f) {
      return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res({ dataUrl: fr.result, name: f.name, type: f.type, size: f.size });
        fr.onerror = rej;
        fr.readAsDataURL(f);
      });
    }

    function attach(f) {
      if (!f?.dataUrl) return '';
      const kind = f.kind || f.type || '';
      if (kind.includes('image')) return `<br><img src="${f.dataUrl}" style="max-width:220px;border-radius:12px" alt="">`;
      if (kind.includes('video')) return `<br><video src="${f.dataUrl}" controls style="max-width:260px"></video>`;
      if (kind.includes('audio') || kind === 'voice') return `<br><audio src="${f.dataUrl}" controls></audio>`;
      return `<br><a href="${f.dataUrl}" download="${esc(f.name || 'file')}">${esc(f.name || 'document')}</a>`;
    }

    function msgHtml(m) {
      return `<div class="sb-msg"><b>${esc(m.from)} · ${esc(m.role)}</b><br><span class="sb-muted">${esc(m.time)} · ${esc(m.client)}</span><br>${esc(m.text || '')}${attach(m.file)}</div>`;
    }

    async function renderChat() {
      const box = $('sbMessages');
      if (!box) return;
      const s = adapter.getSession();
      if (adapter.rpc && s?.token) {
        try {
          const d = await adapter.rpc('list_messages', {
            p_token: s.token,
            p_client_phone: $('sbChatClientPhone')?.value || null
          });
          box.innerHTML = (d || []).map(m => msgHtml({
            from: m.sender_name, role: m.sender_role, client: m.client_phone,
            text: m.body, file: { kind: m.message_type, name: m.file_name, type: m.mime_type, dataUrl: m.file_data_url },
            time: m.created_at
          })).join('') || 'No messages yet.';
          box.scrollTop = box.scrollHeight;
          return;
        } catch { /* fallback local */ }
      }
      const list = localMsgs().filter(m => !s ? false : ['admin', 'super_admin'].includes(s.role) || clean(m.client) === clean(s.phone));
      box.innerHTML = list.map(msgHtml).join('') || 'No messages yet.';
    }

    async function sendMsg() {
      const s = adapter.getSession();
      if (!s) { opts.openLogin?.(); opts.toast?.('Login to use Messenger.'); return; }
      const text = $('sbChatText')?.value?.trim() || '';
      const client = s.role === 'customer' ? s.phone : ($('sbChatClientPhone')?.value?.trim() || '');
      if (!client) return opts.toast?.('Client phone required.');
      const f = $('sbChatFile')?.files?.[0];
      const file = f ? await fileToData(f) : null;
      if (!text && !file) return opts.toast?.('Write or attach something.');
      if (adapter.rpc && s.token) {
        try {
          await adapter.rpc('send_message', {
            p_token: s.token, p_client_phone: client, p_body: text,
            p_message_type: file ? (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'voice' : 'document') : 'text',
            p_file_name: file?.name || null, p_mime_type: file?.type || null, p_file_size: file?.size || null,
            p_file_data_url: file?.dataUrl || null, p_target: 'operators'
          });
        } catch (e) { return opts.toast?.(e.message); }
      } else {
        const a = localMsgs();
        a.push({ from: s.name || s.phone, role: s.role, client, text, file, time: new Date().toLocaleString(), target: 'operators' });
        saveMsgs(a);
      }
      if ($('sbChatText')) $('sbChatText').value = '';
      if ($('sbChatFile')) $('sbChatFile').value = '';
      await renderChat();
      opts.toast?.('Message sent.');
    }

    function openChat() {
      const s = adapter.getSession();
      if (!s) { opts.openLogin?.(); opts.toast?.('Login to use Messenger.'); return; }
      $('sbChatModal')?.classList.add('show');
      if ($('sbChatClientPhone') && s.role === 'customer') $('sbChatClientPhone').value = s.phone;
      renderChat();
    }

    function closeChat() { $('sbChatModal')?.classList.remove('show'); }

    $('sbMessengerBtn')?.addEventListener('click', openChat);
    $('messengerBtn')?.addEventListener('click', openChat);
    $('sbCloseChat')?.addEventListener('click', closeChat);
    $('sbSendMsg')?.addEventListener('click', sendMsg);

    if (adapter.connect && config.decentral?.enabled) {
      const s = adapter.getSession?.();
      if (s && window.supabase) {
        try {
          const client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
          client.channel('superbooking-messenger-' + config.siteId)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fs_messages' }, () => renderChat())
            .subscribe();
        } catch { /* */ }
      }
    }

    return { openChat, closeChat, renderChat, sendMsg };
  }
};
window.SuperBookingMessenger = window.AstranovSitesMessenger;