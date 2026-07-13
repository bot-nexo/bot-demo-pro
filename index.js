const express = require('express');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

const INSTANCE = process.env.INSTANCE_NAME;
const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

// Groq (API compatible con OpenAI)
const GROQ_URL = process.env.GROQ_URL || 'https://api.groq.com/openai/v1';
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Cargar la configuracion del negocio desde un archivo externo.
// Para un cliente nuevo solo cambias este archivo (o apuntas CONFIG_FILE a otro).
const CONFIG_FILE = process.env.CONFIG_FILE || 'negocio.json';
let CONFIG;
try {
    let raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // tolerar BOM
    CONFIG = JSON.parse(raw);
} catch (e) {
    console.error(`No se pudo leer ${CONFIG_FILE}:`, e.message);
    process.exit(1);
}
const SPA = CONFIG.negocio || process.env.NOMBRE_SPA;

// Historial de conversacion por numero (para dar contexto a la IA)
const historial = {};

function construirSystemPrompt(c) {
    const servicios = (c.servicios || [])
        .map(s => `- ${s.nombre}: $${Number(s.precio).toLocaleString('es-CO')}`)
        .join('\n');
    const reglas = (c.reglas || []).map((r, i) => `${i + 1}. ${r}`).join('\n');
    return `Eres la asistente virtual de *${c.negocio}*, un ${c.tipo || 'negocio'} ubicado en ${c.ubicacion || ''}.
Horarios: ${c.horarios || ''}.
Servicios y precios:
${servicios}

Tu trabajo:
${reglas}

Reglas de estilo:
- Responde en espanol, ${c.tono || 'amable y breve'}.
${c.no_inventar ? '- No inventes precios ni servicios que no esten en la lista.' : ''}
- Si el cliente escribe "menu" o "reiniciar", vuelve al saludo inicial y olvida el contexto anterior.`;
}

async function enviarTexto(to, text) {
    const number = to.replace('@s.whatsapp.net', '').replace('@c.us', '');
    await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
        body: JSON.stringify({ number, text })
    });
}

async function preguntarIA(hist) {
    const res = await fetch(`${GROQ_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'system', content: construirSystemPrompt(CONFIG) }, ...hist],
            max_tokens: 400,
            temperature: 0.7
        })
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Groq ${res.status}: ${txt.slice(0, 150)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Disculpa, no pude procesar tu mensaje.';
}

async function procesarMensaje(msg, from) {
    const texto = msg.toLowerCase().trim();

    if (texto === 'menu' || texto === 'reiniciar' || texto === 'reset') {
        historial[from] = [];
        return `¡Hola! 👋 Soy la asistente de *${SPA}*.\n¿En que te ayudo hoy? Puedes preguntarme por servicios, precios, horarios o agendar tu cita.`;
    }

    if (!historial[from]) historial[from] = [];

    historial[from].push({ role: 'user', content: msg });
    if (historial[from].length > 12) historial[from] = historial[from].slice(-12);

    const respuesta = await preguntarIA(historial[from]);
    historial[from].push({ role: 'assistant', content: respuesta });
    return respuesta;
}

app.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    const body = req.body;
    if (body.event !== 'messages.upsert') return;

    const data = body.data;
    if (data.key?.fromMe) return;

    const msg = data.message?.conversation || data.message?.extendedTextMessage?.text;
    const from = data.key?.remoteJid;
    if (!msg || !from) return;

    try {
        const respuesta = await procesarMensaje(msg, from);
        await enviarTexto(from, respuesta);
    } catch (e) {
        console.error('Error procesando mensaje:', e.message);
        await enviarTexto(from, 'Disculpa, estoy teniendo un problema tecnico momentaneo. Intenta de nuevo en un momento. ✅');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Bot ${ SPA } (IA Groq) corriendo con config: ${CONFIG_FILE}`);
    console.log(`Webhook listo en: http://localhost:${ PORT }/webhook`);
});
