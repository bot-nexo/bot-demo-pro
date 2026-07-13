const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());

const SPA = process.env.NOMBRE_SPA;
const INSTANCE = process.env.INSTANCE_NAME;
const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

// Groq (API compatible con OpenAI)
const GROQ_URL = process.env.GROQ_URL || 'https://api.groq.com/openai/v1';
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Historial de conversacion por numero (para dar contexto a la IA)
const historial = {};

const SYSTEM_PROMPT = `Eres la asistente virtual de *${SPA}*, un spa de unas ubicado en Andes, Antioquia.
Horarios: Lunes a Sabado 9:00am - 7:00pm, Domingo 10:00am - 4:00pm.
Servicios y precios:
- Manicura Clasica: $25.000
- Manicura Semipermanente: $40.000
- Pedicura Spa: $45.000
- Unas Acrilicas: $60.000
- Nail Art (por diseno): $15.000
- Tratamiento Hidratacion Manos: $30.000

Tu trabajo:
1. Saludar amablemente y ayudar con servicios, precios y horarios.
2. Para AGENDAR una cita, recolecta de forma conversacional y en este orden:
   a) Nombre completo del cliente
   b) Servicio deseado
   c) Dia y hora que le conviene
3. Cuando tengas los 3 datos, confirma la cita con un resumen claro y dile que
   un asesor la confirmara en maximo 30 minutos.
4. Si te piden hablar con un asesor, indicallo amablemente.

Reglas de estilo:
- Responde en espanol, corto, cercano y con emojis ocasionales.
- No inventes precios ni servicios que no esten listados.
- Si el cliente escribe "menu" o "reiniciar", vuelve al saludo inicial y olvida el contexto anterior.`;

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
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...hist],
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
    console.log(`Bot ${ SPA } (IA Groq) corriendo`);
    console.log(`Webhook listo en: http://localhost:${ PORT }/webhook`);
});
