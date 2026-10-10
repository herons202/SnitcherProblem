/* ================================================
   storage.js — localStorage helper untuk riwayat tiket
   ================================================ */

const STORAGE_KEY = "snicher_tickets";

const Storage = {
  getAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  },
  save(ticket) {
    const all = this.getAll();
    all.unshift({ ...ticket, _savedAt: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 100)));
  },
  findById(id) {
    return this.getAll().find(t => t.ticket_id === id) || null;
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
