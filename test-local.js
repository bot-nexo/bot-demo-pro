// Prueba local del bot sin WhatsApp real.
// 1) Arranca un Evolution API ficticio que captura los mensajes salientes.
// 2) Envía mensajes simulados al webhook del bot.
// 3) Imprime las respuestas para validar la lógica.

const http = require('http');

require('dotenv').config();
process.env.PORT = process.env.TEST_PORT || '3999';
const MOCK_PORT = 4099;
process.env.EVOLUTION_API_URL = `http://localhost:${MOCK_PORT}`;
process.env.INSTANCE_NAME = process.env.INSTANCE_NAME || 'SPA-Cliente1';
process.env.NOMBRE_SPA = process.env.NOMBRE_SPA || 'SPA Relax';

// Mensajes salientes capturados (number -> [textos])
const salidas = {};

const mock = http.createServer((req, res) => {
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
    await new Promise((r) => mock.listen(MOCK_PORT, r));
    require('./index');
    await wait(500);

    const caso = async (mensaje) => {
        await enviarWebhook(mensaje);
        await wait(250);
    };

    // Recorrido completo de agendamiento
    await caso('hola');
    await caso('2');
    await caso('Juanda Pérez');
    await caso('Manicura Semipermanente');
    await caso('Viernes 4pm');

    // Otras opciones
    await caso('1');
    await caso('3');
    await caso('4');
    await caso('0');
    await caso('texto que no entiendo');

    console.log('\n================ RESPUESTAS DEL BOT ================');
    for (const [num, textos] of Object.entries(salidas)) {
        console.log(`\n>> De ${num}:`);
        textos.forEach((t, i) => console.log(`   ${i + 1}. ${t.replace(/\n/g, ' ⏎ ')}`));
    }
    console.log('\n====================================================');

    mock.close();
    process.exit(0);
}

run();
