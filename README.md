# SnicherProblem — Action & Execution Agent

Sistem otomatis pembuatan tiket dinas untuk penanganan keluhan warga berbasis **IBM Langflow** + **IBM watsonx.ai**.

## Arsitektur

```
ChatInput (Payload JSON)
    ↓
IBM watsonx.ai (ibm/granite-4-h-small)
  [System Prompt: Action & Execution Logic]
    ↓
ChatOutput (Tiket JSON Resmi)
```

## Fitur

| Fitur | Keterangan |
|---|---|
| **Nomor Tiket** | Format `SNICH-[TAHUN][BULAN][HARI]-[XXXX]` |
| **Dispatch DINAS_PUPR** | Jalan berlubang, jembatan, trotoar, tanggul, drainase |
| **Dispatch DINAS_PERHUBUNGAN** | Lampu lalu lintas, PJU, marka jalan, rambu |
| **Dispatch DINAS_LINGKUNGAN_HIDUP** | Sampah liar, polusi limbah, pohon tumbang |
| **EMERGENCY_DISPATCH** | Urgency CRITICAL/HIGH — respon < 6 jam |
| **SCHEDULED_REPAIR** | Urgency MEDIUM — respon 24–48 jam |
| **ROUTINE_MAINTENANCE** | Urgency LOW — jadwal berkala 7–14 hari |
| **MERGE_DUPLICATE_TICKET** | Gabung tiket duplikat, naikkan prioritas |

## Struktur Proyek

```
Hackathon/
├── flows/
│   └── snicherproblem_action_execution_agent.json   # Flow Langflow (import-ready)
├── docs/
└── README.md
```

## Setup & Import Flow

### Prasyarat
- Langflow berjalan di `http://localhost:7860`
- IBM watsonx.ai API Key + Project ID

### Cara Import Flow

1. Buka `http://localhost:7860`
2. Klik **New Flow** → **Import**
3. Upload file `flows/snicherproblem_action_execution_agent.json`
4. Klik komponen **IBM watsonx.ai**, isi:
   - `Watsonx API Key` — API Key dari [IBM Cloud](https://cloud.ibm.com)
   - `watsonx Project_ID` — Project ID dari watsonx.ai

## Skema Input (dari Brain Engine)

```json
{
  "category": "string",
  "urgency": "HIGH | MEDIUM | LOW",
  "target_agency": "DINAS_PUPR | DINAS_PERHUBUNGAN | DINAS_LINGKUNGAN_HIDUP",
  "location": "string",
  "summary": "string",
  "action_code": "DISPATCH_NEW_TICKET | MERGE_DUPLICATE_TICKET"
}
```

## Contoh Output

```json
{
  "status": "SUCCESS",
  "ticket_id": "SNICH-20261010-8921",
  "timestamp": "2026-10-10T13:00:00+07:00",
  "dispatch_info": {
    "assigned_agency": "DINAS_PUPR",
    "priority_level": "EMERGENCY_DISPATCH",
    "location_target": "Jl. Sudirman No. 45, Kec. Bogor Tengah",
    "work_summary": "Perbaikan lubang jalan diameter 1m, kedalaman 30cm. Pasang rambu peringatan segera."
  },
  "citizen_tracking": {
    "tracking_code": "SNICH-20261010-8921",
    "status_message": "Laporan Anda telah berhasil diverifikasi dan diteruskan ke Dinas PUPR. Tim teknis sedang dijadwalkan ke lokasi.",
    "estimated_sla": "< 6 jam"
  },
  "system_audit_log": "TICKET_CREATED_AND_DISPATCHED_TO_DINAS_PUPR"
}
```
