app.get('/', (req, res) => res.send('Bot Nexo Online'));
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// SIMULACIÓN DE BASE DE DATOS
const citas = [];
const servicios = {
    "manicura": "$25.000",
    "acrilicas": "$60.000",
    "pedicura": "$30.000"
};

console.log("🤖 Bot Demo Pro iniciado para SPA DE UÑAS");

app.post('/webhook', async (req, res) => {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
        const from = message.from;
        const text = message.text?.body.toLowerCase();

        let reply = "Hola! Soy la asistente de Nexo SPA 💅\n\n¿En qué te ayudo hoy?\n1. Agendar cita\n2. Ver servicios y precios\n3. Horarios";

        if (text.includes("1") || text.includes("cita")) {
            reply = "Perfecto! ¿Qué servicio deseas?\n- Manicura $25.000\n- Acrílicas $60.000\n- Pedicura $30.000\n\nDime cuál y qué día te sirve";
        }
        else if (text.includes("2") || text.includes("precio")) {
            reply = `Nuestros servicios:\n💅 Manicura: $25.000\n✨ Acrílicas: $60.000\n🦶 Pedicura: $30.000\n¿Deseas agendar alguno?`;
        }
        else if (text.includes("3") || text.includes("horario")) {
            reply = "Atendemos:\nLun a Sáb: 9am - 7pm\nDom: 10am - 4pm\n\n¿Deseas agendar?";
        }

        await enviarMensaje(from, reply);
    }
    res.sendStatus(200);
});

async function enviarMensaje(to, body) {
    console.log(`Enviando a ${to}: ${body}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));