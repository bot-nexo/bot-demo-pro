const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());

const SPA = process.env.NOMBRE_SPA;
const INSTANCE = process.env.INSTANCE_NAME;
const API_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

// Base de datos simple en memoria
let citas = {};

async function enviarTexto(to, text) {
    const number = to.replace('@s.whatsapp.net', '').replace('@c.us', '');
    await fetch(`${API_URL}/message/sendText/${INSTANCE}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
        body: JSON.stringify({ number, text })
    });
}

function continuarAgenda(msg, from, nombre) {
    let respuesta = '';

    if (citas[from].paso === 2) {
        citas[from].nombre = msg;
        respuesta = `Paso 2 / 3: ¿Qué servicio deseas ?\nEj: Manicura Semipermanente`;
        citas[from].paso = 3;
    }
    else if (citas[from].paso === 3) {
        citas[from].servicio = msg;
        respuesta = `Paso 3 / 3: ¿Qué día y hora te sirve ?\nEj: Viernes 4pm`;
        citas[from].paso = 4;
    }
    else if (citas[from].paso === 4) {
        citas[from].hora = msg;
        respuesta = `✅ *CITA SOLICITADA*\n\nNombre: ${ citas[from].nombre }\nServicio: ${ citas[from].servicio }\nHora: ${ citas[from].hora }\n\nTe confirmamos en máximo 30 min. ¡Gracias!`;
        citas[from] = null; // reset
    }

    return respuesta;
}

async function procesarMensaje(msg, from, nombre) {
    const texto = msg.toLowerCase();
    let respuesta = '';

    // Si hay una cita en curso, continuar el flujo sin importar las palabras
    if (citas[from] && citas[from].paso >= 2 && citas[from].paso <= 4) {
        return continuarAgenda(msg, from, nombre);
    }

    // MENU PRINCIPAL
    if (texto.includes('hola') || texto.includes('menu') || texto === '') {
        respuesta = `¡Hola ${ nombre } ! 👋\nBienvenido a *${ SPA }*\n\n¿En qué te ayudo hoy ?\n\n1️⃣ Ver servicios y precios\n2️⃣ Agendar cita\n3️⃣ Ubicación y horarios\n4️⃣ Hablar con asesor\n0️⃣ Salir`;
    }

    // PRECIOS
    else if (texto.includes('1') || texto.includes('precios') || texto.includes('servicios')) {
        respuesta = `✨ *SERVICIOS ${ SPA }* ✨\n\n💅 Manicura Clásica - $25.000\n💎 Manicura Semipermanente - $40.000\n🌸 Pedicura Spa - $45.000\n✨ Uñas Acrílicas - $60.000\n💖 Nail Art (por diseño) - $15.000\n🧴 Tratamiento Hidratación Manos - $30.000\nEscribe *2* para agendar tu cita`;
    }

    // AGENDAR (inicio del flujo)
    else if (texto.includes('2') || texto.includes('agendar') || texto.includes('cita')) {
        citas[from] = { paso: 1 };
        respuesta = `Perfecto para agendar 📅\n\nPaso 1 / 3: ¿Cuál es tu nombre completo ?`;
        citas[from].paso = 2;
    }

    // UBICACION
    else if (texto.includes('3') || texto.includes('ubicacion') || texto.includes('horario')) {
        respuesta = `📍 *${ SPA }*\nAndes, Antioquia\n\n🕐 *HORARIOS*\nLun a Sáb: 9:00am - 7:00pm\nDomingo: 10:00am - 4:00pm\n¿Quieres que te envíe la ubicación por mapa ?`;
    }

    // ASESOR
    else if (texto.includes('4') || texto.includes('asesor') || texto.includes('humano')) {
        respuesta = `Ya mismo te atiende un asesor 😊\n\nNuestro equipo te responderá en pocos minutos.\nHorario de atención: 9am - 7pm`;
    }

    // SALIR
    else if (texto.includes('0') || texto.includes('salir')) {
        respuesta = `Gracias por escribir a ${ SPA } 🙏\n\nQue tengas un excelente día.Cuando quieras vuelves y escribes *menu*`;
    }

    else {
        respuesta = `No te entendí bien 😅\n\nEscribe *menu* para ver las opciones: \n1.Precios\n2.Agendar\n3.Ubicación\n4.Asesor`;
    }

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
    const nombre = data.pushName || 'cliente';

    if (!msg || !from) return;

    const respuesta = await procesarMensaje(msg, from, nombre);
    await enviarTexto(from, respuesta);
});

// Servidor
app.listen(process.env.PORT, () => {
    console.log(`Bot ${ SPA } corriendo`);
    console.log(`Webhook listo en: http://localhost:${ process.env.PORT }/webhook`);
    console.log(`Configura este webhook en tu instancia de Evolution API.`);
});
