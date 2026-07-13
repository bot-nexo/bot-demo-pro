// Prueba local del bot con IA (Groq) sin dependencias externas.
// 1) Mock de Evolution API (captura los mensajes salientes).
// 2) Mock de Groq (devuelve respuestas de IA simuladas).
// 3) Simula mensajes entrantes por el webhook.

const http = require('http');

require('dotenv').config();

const MOCK_EVO = 4099;
const MOCK_GROQ = 4098;
process.env.PORT = process.env.TEST_PORT || '3999';
process.env.EVOLUTION_API_URL = `http://localhost:${MOCK_EVO}`;
process.env.INSTANCE_NAME = process.env.INSTANCE_NAME || 'SPA-Cliente1';
process.env.NOMBRE_SPA = process.env.NOMBRE_SPA || 'SPA Relax';
process.env.GROQ_URL = `http://localhost:${MOCK_GROQ}`;
process.env.GROQ_KEY = 'dummy';
process.env.GROQ_MODEL = 'test';

// Mensajes salientes capturados (number -> [textos])
const salidas = {};

const mockEvo = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
        if (req.method === 'POST' && req.url.startsWith('/message/sendText/')) {
            const { number, text } = JSON.parse(body || '{}');
            (salidas[number] = salidas[number] || []).push(text);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status":200}');
    });
});

const mockGroq = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
        const data = JSON.parse(body || '{}');
        const historial = data.messages || [];
        const ultimo = [...historial].reverse().find(m => m.role === 'user');
        const texto = ultimo ? ultimo.content.toLowerCase() : '';
        let reply = 'Hola, soy la asistente de SPA Relax. ¿En que te ayudo?';
        if (texto.includes('precio') || texto.includes('servicio')) {
            reply = 'Tenemos Manicura $25k, Semipermanente $40k, Pedicura $45k, Acrilicas $60k, Nail Art $15k. ¿Agendamos?';
        } else if (texto.includes('agendar') || texto.includes('cita') || texto.includes('nombre')) {
            reply = 'Perfecto, agendemos. ¿Me das tu nombre, el servicio y el dia/hora que prefieres?';
        } else if (texto.includes('hola')) {
            reply = '¡Hola! 👋 Bienvenido a SPA Relax. Pregunta por servicios, precios o agendar.';
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: reply } }] }));
    });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function enviarWebhook(conversation, remoteJid = '573001234567@s.whatsapp.net', pushName = 'Juanda') {
    return fetch(`http://localhost:${process.env.PORT}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'messages.upsert',
            data: {
                key: { remoteJid, fromMe: false },
                message: { conversation },
                pushName
            }
        })
    });
}

async function run() {
    await new Promise((r) => mockEvo.listen(MOCK_EVO, r));
    await new Promise((r) => mockGroq.listen(MOCK_GROQ, r));
    require('./index');
    await wait(500);

    const caso = async (m) => { await enviarWebhook(m); await wait(250); };

    await caso('hola');
    await caso('Quiero agendar una cita');
    await caso('Soy Juan Perez');
    await caso('Manicura Semipermanente');
    await caso('Viernes a las 4pm');

    console.log('\n================ RESPUESTAS DEL BOT (IA) ================');
    for (const [num, textos] of Object.entries(salidas)) {
        console.log(`\n>> Para ${num}:`);
        textos.forEach((t, i) => console.log(`   ${i + 1}. ${t.replace(/\n/g, ' ⏎ ')}`));
    }
    console.log('\n=========================================================');

    mockEvo.close();
    mockGroq.close();
    process.exit(0);
}

run();
