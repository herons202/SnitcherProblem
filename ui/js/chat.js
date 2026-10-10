/* ================================================
   chat.js — Chat Pengaduan Natural
   ================================================ */

const chatMessages = document.getElementById("chatMessages");
const chatInput    = document.getElementById("chatInput");
const chatSendBtn  = document.getElementById("chatSendBtn");

const CHAT_SYSTEM_PROMPT = `Kamu adalah asisten pengaduan warga untuk sistem SnicherProblem.

Tugasmu ada DUA:
1. Jika user bercerita tentang masalah infrastruktur, ekstrak informasi dan buat tiket JSON.
2. Jika user bertanya atau mengobrol biasa, jawab dengan ramah.

Jika harus membuat tiket, balas dengan format:
TIKET_DIBUAT:
{
  "category": "[kategori masalah]",
  "urgency": "HIGH|MEDIUM|LOW",
  "target_agency": "DINAS_PUPR|DINAS_PERHUBUNGAN|DINAS_LINGKUNGAN_HIDUP",
  "location": "[lokasi dari cerita user]",
  "summary": "[ringkasan masalah]",
  "action_code": "DISPATCH_NEW_TICKET"
}

Kategori yang valid:
- DINAS_PUPR: Jalan Berlubang, Jembatan Rusak, Trotoar Rusak, Tanggul Jebol, Drainase Tersumbat
- DINAS_PERHUBUNGAN: Lampu Lalu Lintas Padam, PJU Mati, Marka Jalan Rusak, Rambu Lalu Lintas Hilang
- DINAS_LINGKUNGAN_HIDUP: Penumpukan Sampah Liar, Polusi Limbah, Pohon Tumbang

Urgency: HIGH jika berbahaya/mendesak, MEDIUM jika perlu segera, LOW jika bisa ditunda.

Jika informasi tidak lengkap, tanya dulu sebelum membuat tiket.`;

function addChatMsg(text, role, isTicket = false) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.innerHTML = `
    <span class="chat-avatar">${role === "ai" ? "🤖" : "👤"}</span>
    <div class="chat-bubble${isTicket ? " ticket-bubble" : ""}">${text}</div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
  const div = document.createElement("div");
  div.className = "chat-msg ai typing-indicator";
  div.id = "typingIndicator";
  div.innerHTML = `<span class="chat-avatar">🤖</span><div class="chat-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

async function sendChatMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  addChatMsg(text, "user");
  chatInput.value = "";
  chatSendBtn.disabled = true;

  const typing = addTypingIndicator();

  try {
    // Kirim ke Langflow dengan prompt chat khusus
    const payload = {
      chat_mode: true,
      user_message: text,
      system_context: CHAT_SYSTEM_PROMPT,
    };
    // Untuk chat natural, kirim langsung sebagai teks ke agent
    const body = JSON.stringify({
      input_value: `[CHAT MODE] ${text}\n\nContext: ${CHAT_SYSTEM_PROMPT}`,
      input_type:  "chat",
      output_type: "chat",
    });
    const resp = await fetch(
      `${CONFIG.LANGFLOW_URL}/api/v1/run/${CONFIG.FLOW_ID}?stream=false`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": CONFIG.API_KEY }, body }
    );

    typing.remove();

    if (!resp.ok) throw new Error(`Error ${resp.status}`);
    const data    = await resp.json();
    const out     = data.outputs[0].outputs[0];
    const rawText = out.results?.message?.text || out.messages?.[0]?.message || "";

    // Cek apakah ada tiket di respons
    if (rawText.includes("TIKET_DIBUAT:")) {
      const parts     = rawText.split("TIKET_DIBUAT:");
      const beforeMsg = parts[0].trim();
      const jsonPart  = parts[1].trim();

      if (beforeMsg) addChatMsg(beforeMsg, "ai");

      try {
        const ticketPayload = extractJSON(jsonPart);
        // Kirim ke Langflow untuk buat tiket resmi
        showLoading(true, "Membuat tiket dari obrolan...");
        const apiResp   = await callLangflow(ticketPayload);
        const ticketResult = parseLangflowOutput(apiResp);
        showLoading(false);

        ticketResult._location_text = ticketPayload.location;
        Storage.save(ticketResult);

        const di = ticketResult.dispatch_info || {};
        addChatMsg(`
          ✅ <strong>Tiket berhasil dibuat!</strong><br/>
          🎫 <strong>${ticketResult.ticket_id}</strong><br/>
          🏢 ${di.assigned_agency}<br/>
          ⚡ ${di.priority_level}<br/>
          ⏱️ SLA: ${(ticketResult.citizen_tracking||{}).estimated_sla}
        `, "ai", true);
      } catch (_) {
        addChatMsg(rawText, "ai");
      }
    } else {
      addChatMsg(rawText, "ai");
    }
  } catch (err) {
    typing.remove();
    showLoading(false);
    addChatMsg("Maaf, terjadi kesalahan: " + err.message, "ai");
  } finally {
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

chatSendBtn.addEventListener("click", sendChatMessage);
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
});
